// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20Minimal} from "./interfaces/IERC20Minimal.sol";
import {IDotPay} from "./interfaces/IDotPay.sol";
import {IInvoiceNFT, IComplianceOracle, IXCMYieldVault} from "./interfaces/IProtocol.sol";

/// @title EscrowCore
/// @author DotPay
/// @notice Manages USDC escrows, invoice NFT lifecycle, yield routing,
///         and fiat settlement. Split from InvoiceCore for PolkaVM size limits.
contract EscrowCore is IDotPay, Ownable, Pausable, ReentrancyGuard {

    /// @notice Fiat corridor enum (must match FiatSettlement.Corridor order).
    enum Corridor { NGN, KES, GHS, TZS, ZAR }

    mapping(uint256 => Escrow) public escrows;
    uint256 public nextEscrowId = 1;
    mapping(uint256 => uint256) public debt;

    uint256 public constant PLATFORM_FEE_BPS = 50;
    address public feeRecipient;

    IERC20Minimal public usdc;
    IInvoiceNFT public nft;
    IComplianceOracle public oracle;
    IXCMYieldVault public yieldVault;
    address public fiatSettlement;

    mapping(uint256 => bytes) public stellarAddresses;
    mapping(uint256 => Corridor) public fiatCorridors;

    address public marketContract;

    modifier onlyMarket() {
        require(msg.sender == marketContract, "only market");
        _;
    }

    constructor(
        address _usdc,
        address _nft,
        address _oracle,
        address _yieldVault,
        address _fiatSettlement,
        address _feeRecipient
    ) Ownable(msg.sender) {
        usdc           = IERC20Minimal(_usdc);
        nft            = IInvoiceNFT(_nft);
        oracle         = IComplianceOracle(_oracle);
        yieldVault     = IXCMYieldVault(_yieldVault);
        fiatSettlement = _fiatSettlement;
        feeRecipient   = _feeRecipient;

        usdc.approve(_yieldVault, type(uint256).max);
        usdc.approve(_fiatSettlement, type(uint256).max);
    }

    function createEscrow(
        address seller,
        uint256 amount,
        uint64  deadline,
        bool    yieldEnabled,
        SettlementRail rail,
        bytes32 description
    ) external whenNotPaused nonReentrant returns (uint256 escrowId) {
        if (amount == 0) revert InvalidAmount();
        if (seller == address(0) || seller == msg.sender) revert Unauthorized();
        if (deadline != 0 && deadline <= block.timestamp) revert DeadlineExpired();

        (bool allowed, ) = oracle.check(msg.sender, amount);
        if (!allowed) revert KycRequired();

        escrowId = nextEscrowId++;

        escrows[escrowId] = Escrow({
            id:           escrowId,
            buyer:        msg.sender,
            seller:       seller,
            amount:       amount,
            yieldAccrued: 0,
            createdAt:    uint64(block.timestamp),
            releasedAt:   0,
            deadline:     deadline,
            status:       EscrowStatus.Active,
            rail:         rail,
            yieldEnabled: yieldEnabled,
            nftTokenId:   escrowId,
            description:  description
        });

        bool success = usdc.transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();

        nft.mint(seller, escrowId, "dotpay://invoice", escrowId);

        if (yieldEnabled) {
            yieldVault.deployYield(escrowId, amount);
        }

        emit EscrowCreated(escrowId, msg.sender, seller, amount, escrowId, rail);
    }

    function releaseEscrow(uint256 escrowId) external whenNotPaused nonReentrant {
        Escrow storage e = escrows[escrowId];
        if (e.status != EscrowStatus.Active) revert EscrowNotActive();

        address nftOwner = nft.ownerOf(e.nftTokenId);
        if (msg.sender != e.buyer && msg.sender != nftOwner) revert Unauthorized();
        if (e.deadline != 0 && block.timestamp > e.deadline) revert DeadlineExpired();

        uint256 payout = e.amount;
        uint256 yieldEarned = 0;

        if (e.yieldEnabled) {
            (uint256 principal, uint256 yld) = yieldVault.reclaimYield(escrowId);
            yieldEarned = yld;
            payout = principal + yld;
        }

        uint256 debtAmount = debt[escrowId];
        if (debtAmount > 0) {
            payout -= debtAmount;
            debt[escrowId] = 0;
        }

        uint256 fee = (payout * PLATFORM_FEE_BPS) / 10000;
        uint256 netPayout = payout - fee;

        e.status = EscrowStatus.Released;
        e.releasedAt = uint64(block.timestamp);
        e.yieldAccrued = yieldEarned;

        if (fee > 0) {
            bool feeSuccess = usdc.transfer(feeRecipient, fee);
            if (!feeSuccess) revert TransferFailed();
        }

        if (e.rail == SettlementRail.PendulumFiat) {
            bytes memory stellarAddr = stellarAddresses[escrowId];
            if (stellarAddr.length == 0) revert InvalidStellarAddress();
            // Call FiatSettlement.initiateFiatSettlement via low-level call
            // Selector: initiateFiatSettlement(uint256,bytes,uint256,uint8)
            (bool ok, ) = fiatSettlement.call(
                abi.encodeWithSignature(
                    "initiateFiatSettlement(uint256,bytes,uint256,uint8)",
                    escrowId, stellarAddr, netPayout, uint8(fiatCorridors[escrowId])
                )
            );
            require(ok, "fiat settlement failed");
            emit FiatSettlementInitiated(escrowId, stellarAddr, netPayout);
        } else {
            bool paySuccess = usdc.transfer(nftOwner, netPayout);
            if (!paySuccess) revert TransferFailed();
        }

        nft.burnByMinter(e.nftTokenId);
        emit EscrowReleased(escrowId, nftOwner, netPayout, yieldEarned);
    }

    function refundEscrow(uint256 escrowId) external whenNotPaused nonReentrant {
        Escrow storage e = escrows[escrowId];
        if (e.status != EscrowStatus.Active) revert EscrowNotActive();
        if (msg.sender != e.buyer) revert Unauthorized();
        if (debt[escrowId] > 0) revert OutstandingDebt();

        uint256 refundAmount = e.amount;

        if (e.yieldEnabled) {
            (uint256 principal, uint256 yld) = yieldVault.reclaimYield(escrowId);
            refundAmount = principal + yld;
        }

        e.status = EscrowStatus.Refunded;

        bool success = usdc.transfer(e.buyer, refundAmount);
        if (!success) revert TransferFailed();

        nft.burnByMinter(e.nftTokenId);
        emit EscrowRefunded(escrowId, e.buyer, refundAmount);
    }

    function disputeEscrow(uint256 escrowId) external whenNotPaused {
        Escrow storage e = escrows[escrowId];
        if (e.status != EscrowStatus.Active) revert EscrowNotActive();

        address nftOwner = nft.ownerOf(e.nftTokenId);
        if (msg.sender != e.buyer && msg.sender != nftOwner) revert Unauthorized();

        e.status = EscrowStatus.Disputed;
        emit EscrowDisputed(escrowId, msg.sender);
    }

    function setFiatDetails(
        uint256 escrowId,
        bytes calldata stellarAddr,
        Corridor corridor
    ) external whenNotPaused {
        Escrow storage e = escrows[escrowId];
        if (e.status != EscrowStatus.Active) revert EscrowNotActive();

        address nftOwner = nft.ownerOf(e.nftTokenId);
        if (msg.sender != nftOwner) revert Unauthorized();
        if (stellarAddr.length != 56 || stellarAddr[0] != 0x47) revert InvalidStellarAddress();

        stellarAddresses[escrowId] = stellarAddr;
        fiatCorridors[escrowId] = corridor;
    }

    /* ─── Market Contract Helpers ─────────────────────────────────── */

    function addDebt(uint256 escrowId, uint256 amount) external onlyMarket {
        debt[escrowId] += amount;
    }

    function reduceDebt(uint256 escrowId, uint256 amount) external onlyMarket {
        debt[escrowId] -= amount;
    }

    function transferUSDC(address to, uint256 amount) external onlyMarket {
        bool success = usdc.transfer(to, amount);
        if (!success) revert TransferFailed();
    }

    /* ─── View Helpers ───────────────────────────────────────────── */

    function getEscrow(uint256 id) external view returns (Escrow memory) {
        return escrows[id];
    }

    function previewYield(uint256 escrowId) external view returns (uint256) {
        return yieldVault.previewYield(escrowId);
    }

    function getBorrowLimit(uint256 escrowId) external view returns (uint256) {
        Escrow storage e = escrows[escrowId];
        uint256 maxBorrow = (e.amount * 8000) / 10000;
        uint256 currentDebt = debt[escrowId];
        if (currentDebt >= maxBorrow) return 0;
        return maxBorrow - currentDebt;
    }

    function getDebt(uint256 escrowId) external view returns (uint256) {
        return debt[escrowId];
    }

    /* ─── Admin Functions ────────────────────────────────────────── */

    function setMarketContract(address _market) external onlyOwner {
        marketContract = _market;
    }

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        if (_feeRecipient == address(0)) revert Unauthorized();
        feeRecipient = _feeRecipient;
    }

    function emergencyPause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function rescueERC20(address token, uint256 amount) external onlyOwner {
        bool success = IERC20Minimal(token).transfer(msg.sender, amount);
        if (!success) revert TransferFailed();
    }
}
