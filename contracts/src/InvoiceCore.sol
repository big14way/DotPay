// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20Minimal} from "./interfaces/IERC20Minimal.sol";
import {IDotPay} from "./interfaces/IDotPay.sol";
import {InvoiceNFT} from "./InvoiceNFT.sol";
import {ComplianceOracle} from "./ComplianceOracle.sol";
import {XCMYieldVault} from "./XCMYieldVault.sol";
import {FiatSettlement} from "./FiatSettlement.sol";

/// @title InvoiceCore
/// @author DotPay
/// @notice The heart of DotPay — manages USDC escrows, invoice NFT lifecycle,
///         yield routing, invoice factoring marketplace, borrowing against escrow,
///         and fiat settlement via Pendulum/Spacewalk.
contract InvoiceCore is IDotPay, Ownable, Pausable, ReentrancyGuard {

    /* ─── State Variables ────────────────────────────────────────── */

    /// @notice All escrows indexed by escrow ID.
    mapping(uint256 => Escrow) public escrows;

    /// @notice Auto-incrementing escrow ID counter, starting at 1.
    uint256 public nextEscrowId = 1;

    /// @notice All invoice listings indexed by listing ID.
    mapping(uint256 => InvoiceListing) public listings;

    /// @notice Auto-incrementing listing ID counter.
    uint256 public nextListingId;

    /// @notice Outstanding debt per escrow (escrowId → borrowed USDC amount).
    mapping(uint256 => uint256) public debt;

    /// @notice Loan-to-value ratio in basis points (8000 = 80%).
    uint256 public constant LTV_BPS = 8000;

    /// @notice Platform fee on release in basis points (50 = 0.5%).
    uint256 public constant PLATFORM_FEE_BPS = 50;

    /// @notice Yield split to seller in basis points (1500 = 15%).
    uint256 public constant YIELD_SPLIT_SELLER = 1500;

    /// @notice Yield split to buyer in basis points (8000 = 80%).
    uint256 public constant YIELD_SPLIT_BUYER = 8000;

    /// @notice Address receiving platform fees.
    address public feeRecipient;

    /// @notice The InvoiceNFT contract.
    InvoiceNFT public nft;

    /// @notice The ComplianceOracle contract.
    ComplianceOracle public oracle;

    /// @notice The XCMYieldVault contract.
    XCMYieldVault public yieldVault;

    /// @notice The FiatSettlement contract.
    FiatSettlement public fiatSettlement;

    /// @notice The USDC token contract.
    IERC20Minimal public usdc;

    /// @notice Tracks whether an escrow has an active invoice listing.
    mapping(uint256 => bool) private _escrowListed;

    /// @notice Stellar address for fiat settlement per escrow (set by seller).
    mapping(uint256 => bytes) public stellarAddresses;

    /// @notice Fiat corridor for fiat settlement per escrow.
    mapping(uint256 => FiatSettlement.Corridor) public fiatCorridors;

    /* ─── Constructor ────────────────────────────────────────────── */

    /// @notice Deploy the InvoiceCore contract.
    /// @param _usdc           The USDC token address.
    /// @param _nft            The InvoiceNFT contract address.
    /// @param _oracle         The ComplianceOracle contract address.
    /// @param _yieldVault     The XCMYieldVault contract address.
    /// @param _fiatSettlement The FiatSettlement contract address.
    /// @param _feeRecipient   The address receiving platform fees.
    constructor(
        address _usdc,
        address _nft,
        address _oracle,
        address _yieldVault,
        address _fiatSettlement,
        address _feeRecipient
    ) Ownable(msg.sender) {
        usdc           = IERC20Minimal(_usdc);
        nft            = InvoiceNFT(_nft);
        oracle         = ComplianceOracle(_oracle);
        yieldVault     = XCMYieldVault(_yieldVault);
        fiatSettlement = FiatSettlement(_fiatSettlement);
        feeRecipient   = _feeRecipient;

        // Approve yieldVault and fiatSettlement to pull USDC from this contract
        usdc.approve(address(_yieldVault), type(uint256).max);
        usdc.approve(address(_fiatSettlement), type(uint256).max);
    }

    /* ─── Escrow Creation ────────────────────────────────────────── */

    /// @notice Create a new USDC escrow with an invoice NFT minted to the seller.
    /// @param seller       The seller/beneficiary address.
    /// @param amount       USDC amount (6 decimals).
    /// @param deadline     Unix timestamp deadline (0 = no deadline).
    /// @param yieldEnabled Whether to route funds to Hydration for yield.
    /// @param rail         Settlement rail (Direct, HydrationYield, PendulumFiat).
    /// @param description  Short descriptor hash for the escrow.
    /// @return escrowId    The ID of the created escrow.
    function createEscrow(
        address seller,
        uint256 amount,
        uint64  deadline,
        bool    yieldEnabled,
        SettlementRail rail,
        bytes32 description
    ) external whenNotPaused nonReentrant returns (uint256 escrowId) {
        // Checks
        if (amount == 0) revert InvalidAmount();
        if (seller == address(0) || seller == msg.sender) revert Unauthorized();
        if (deadline != 0 && deadline <= block.timestamp) revert DeadlineExpired();

        // Compliance check on buyer
        (bool allowed, ) = oracle.check(msg.sender, amount);
        if (!allowed) revert KycRequired();

        // Effects: assign escrow ID
        escrowId = nextEscrowId++;
        uint256 nftTokenId = escrowId; // 1:1 mapping for simplicity

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
            nftTokenId:   nftTokenId,
            description:  description
        });

        // Interaction: pull USDC from buyer
        bool success = usdc.transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();

        // Mint InvoiceNFT to seller
        string memory tokenURI = _buildTokenURI(escrowId, amount, seller);
        nft.mint(seller, nftTokenId, tokenURI, escrowId);

        // If yield-enabled, deploy funds to yield vault
        if (yieldEnabled) {
            yieldVault.deployYield(escrowId, amount);
        }

        emit EscrowCreated(escrowId, msg.sender, seller, amount, nftTokenId, rail);
    }

    /* ─── Escrow Release ─────────────────────────────────────────── */

    /// @notice Release escrow funds to the current NFT holder (seller or factoring buyer).
    /// @param escrowId The escrow ID to release.
    function releaseEscrow(uint256 escrowId) external whenNotPaused nonReentrant {
        Escrow storage e = escrows[escrowId];
        if (e.status != EscrowStatus.Active) revert EscrowNotActive();

        address nftOwner = nft.ownerOf(e.nftTokenId);
        // Only the buyer or the current NFT owner can release
        if (msg.sender != e.buyer && msg.sender != nftOwner) revert Unauthorized();

        // Check deadline
        if (e.deadline != 0 && block.timestamp > e.deadline) revert DeadlineExpired();

        uint256 payout = e.amount;
        uint256 yieldEarned = 0;

        // Reclaim yield if enabled
        if (e.yieldEnabled) {
            (uint256 principal, uint256 yld) = yieldVault.reclaimYield(escrowId);
            yieldEarned = yld;
            payout = principal + yld;
        }

        // Deduct outstanding debt
        uint256 debtAmount = debt[escrowId];
        if (debtAmount > 0) {
            payout -= debtAmount;
            debt[escrowId] = 0;
        }

        // Compute platform fee
        uint256 fee = (payout * PLATFORM_FEE_BPS) / 10000;
        uint256 netPayout = payout - fee;

        // Effects: update state
        e.status = EscrowStatus.Released;
        e.releasedAt = uint64(block.timestamp);
        e.yieldAccrued = yieldEarned;

        // Interaction: pay fee recipient
        if (fee > 0) {
            bool feeSuccess = usdc.transfer(feeRecipient, fee);
            if (!feeSuccess) revert TransferFailed();
        }

        // Pay the NFT owner via the appropriate rail
        if (e.rail == SettlementRail.PendulumFiat) {
            bytes memory stellarAddr = stellarAddresses[escrowId];
            if (stellarAddr.length == 0) revert InvalidStellarAddress();
            fiatSettlement.initiateFiatSettlement(
                escrowId,
                stellarAddr,
                netPayout,
                fiatCorridors[escrowId]
            );
            emit FiatSettlementInitiated(escrowId, stellarAddr, netPayout);
        } else {
            bool paySuccess = usdc.transfer(nftOwner, netPayout);
            if (!paySuccess) revert TransferFailed();
        }

        // Burn the NFT
        nft.burnByMinter(e.nftTokenId);

        emit EscrowReleased(escrowId, nftOwner, netPayout, yieldEarned);
    }

    /* ─── Escrow Refund ──────────────────────────────────────────── */

    /// @notice Refund the escrow back to the buyer.
    /// @param escrowId The escrow ID to refund.
    function refundEscrow(uint256 escrowId) external whenNotPaused nonReentrant {
        Escrow storage e = escrows[escrowId];
        if (e.status != EscrowStatus.Active) revert EscrowNotActive();
        if (msg.sender != e.buyer) revert Unauthorized();
        if (debt[escrowId] > 0) revert OutstandingDebt();

        uint256 refundAmount = e.amount;

        // Reclaim yield if enabled — buyer gets yield bonus for funding
        if (e.yieldEnabled) {
            (uint256 principal, uint256 yld) = yieldVault.reclaimYield(escrowId);
            refundAmount = principal + yld;
        }

        // Effects
        e.status = EscrowStatus.Refunded;

        // Interaction: transfer back to buyer
        bool success = usdc.transfer(e.buyer, refundAmount);
        if (!success) revert TransferFailed();

        // Burn the NFT
        nft.burnByMinter(e.nftTokenId);

        emit EscrowRefunded(escrowId, e.buyer, refundAmount);
    }

    /* ─── Escrow Dispute ─────────────────────────────────────────── */

    /// @notice Flag an escrow as disputed (freezes release until resolution).
    /// @param escrowId The escrow ID to dispute.
    function disputeEscrow(uint256 escrowId) external whenNotPaused {
        Escrow storage e = escrows[escrowId];
        if (e.status != EscrowStatus.Active) revert EscrowNotActive();

        address nftOwner = nft.ownerOf(e.nftTokenId);
        if (msg.sender != e.buyer && msg.sender != nftOwner) revert Unauthorized();

        e.status = EscrowStatus.Disputed;

        emit EscrowDisputed(escrowId, msg.sender);
    }

    /* ─── Invoice Marketplace ────────────────────────────────────── */

    /// @notice List an invoice NFT for sale on the factoring marketplace.
    /// @param escrowId  The escrow ID whose invoice to list.
    /// @param listPrice The discounted ask price in USDC (must be < face value).
    function listInvoice(uint256 escrowId, uint256 listPrice) external whenNotPaused {
        Escrow storage e = escrows[escrowId];
        if (e.status != EscrowStatus.Active) revert EscrowNotActive();

        address nftOwner = nft.ownerOf(e.nftTokenId);
        if (msg.sender != nftOwner) revert Unauthorized();
        if (_escrowListed[escrowId]) revert AlreadyListed();
        if (listPrice == 0 || listPrice >= e.amount) revert InvalidAmount();

        uint256 listingId = nextListingId++;
        listings[listingId] = InvoiceListing({
            escrowId:  escrowId,
            tokenId:   e.nftTokenId,
            seller:    msg.sender,
            listPrice: listPrice,
            faceValue: e.amount,
            active:    true
        });

        _escrowListed[escrowId] = true;

        emit InvoiceListed(escrowId, e.nftTokenId, listPrice);
    }

    /// @notice Buy a listed invoice NFT (become the new escrow beneficiary).
    /// @param listingId The listing ID to purchase.
    function buyInvoice(uint256 listingId) external whenNotPaused nonReentrant {
        InvoiceListing storage listing = listings[listingId];
        if (!listing.active) revert InvoiceNotListed();

        address currentOwner = listing.seller;
        uint256 price = listing.listPrice;

        // Effects: mark listing inactive
        listing.active = false;
        _escrowListed[listing.escrowId] = false;

        // Interaction: pull USDC from buyer, pay current NFT owner
        bool pullSuccess = usdc.transferFrom(msg.sender, currentOwner, price);
        if (!pullSuccess) revert TransferFailed();

        // Transfer NFT to new buyer (they become the release beneficiary)
        nft.transferFrom(currentOwner, msg.sender, listing.tokenId);

        emit InvoiceSold(listing.escrowId, listing.tokenId, msg.sender, price);
    }

    /* ─── Borrowing Against Escrow ───────────────────────────────── */

    /// @notice Borrow USDC against a yield-enabled escrow as working capital.
    /// @param escrowId     The escrow ID to borrow against.
    /// @param borrowAmount The USDC amount to borrow.
    function borrowAgainstEscrow(uint256 escrowId, uint256 borrowAmount)
        external
        whenNotPaused
        nonReentrant
    {
        Escrow storage e = escrows[escrowId];
        if (e.status != EscrowStatus.Active) revert EscrowNotActive();
        if (!e.yieldEnabled) revert InvalidAmount();

        address nftOwner = nft.ownerOf(e.nftTokenId);
        if (msg.sender != nftOwner) revert Unauthorized();

        uint256 maxBorrow = (e.amount * LTV_BPS) / 10000;
        if (debt[escrowId] + borrowAmount > maxBorrow) revert BorrowLimitExceeded();

        // Effects
        debt[escrowId] += borrowAmount;

        // Interaction: transfer USDC to borrower
        bool success = usdc.transfer(nftOwner, borrowAmount);
        if (!success) revert TransferFailed();

        emit BorrowTaken(escrowId, nftOwner, borrowAmount);
    }

    /// @notice Repay outstanding debt on an escrow.
    /// @param escrowId    The escrow ID to repay debt for.
    /// @param repayAmount The USDC amount to repay.
    function repayBorrow(uint256 escrowId, uint256 repayAmount)
        external
        whenNotPaused
        nonReentrant
    {
        if (repayAmount == 0) revert InvalidAmount();
        if (repayAmount > debt[escrowId]) revert InvalidAmount();

        // Effects
        debt[escrowId] -= repayAmount;

        // Interaction: pull USDC from caller
        bool success = usdc.transferFrom(msg.sender, address(this), repayAmount);
        if (!success) revert TransferFailed();

        emit BorrowRepaid(escrowId, repayAmount);
    }

    /* ─── Fiat Settlement Config ─────────────────────────────────── */

    /// @notice Set the Stellar address and corridor for fiat settlement on an escrow.
    /// @dev Must be called by the NFT owner before release if rail is PendulumFiat.
    /// @param escrowId     The escrow ID.
    /// @param stellarAddr  The Stellar G-address (56 bytes).
    /// @param corridor     The fiat corridor (NGN, KES, GHS, etc.).
    function setFiatDetails(
        uint256 escrowId,
        bytes calldata stellarAddr,
        FiatSettlement.Corridor corridor
    ) external whenNotPaused {
        Escrow storage e = escrows[escrowId];
        if (e.status != EscrowStatus.Active) revert EscrowNotActive();

        address nftOwner = nft.ownerOf(e.nftTokenId);
        if (msg.sender != nftOwner) revert Unauthorized();
        if (stellarAddr.length != 56 || stellarAddr[0] != 0x47) revert InvalidStellarAddress();

        stellarAddresses[escrowId] = stellarAddr;
        fiatCorridors[escrowId] = corridor;
    }

    /* ─── View Helpers ───────────────────────────────────────────── */

    /// @notice Get the full escrow struct.
    /// @param id The escrow ID.
    /// @return The Escrow struct.
    function getEscrow(uint256 id) external view returns (Escrow memory) {
        return escrows[id];
    }

    /// @notice Get the full invoice listing struct.
    /// @param id The listing ID.
    /// @return The InvoiceListing struct.
    function getListing(uint256 id) external view returns (InvoiceListing memory) {
        return listings[id];
    }

    /// @notice Preview accrued yield for an escrow.
    /// @param escrowId The escrow ID.
    /// @return The estimated yield accrued.
    function previewYield(uint256 escrowId) external view returns (uint256) {
        return yieldVault.previewYield(escrowId);
    }

    /// @notice Get the maximum borrowable amount for an escrow.
    /// @param escrowId The escrow ID.
    /// @return The max USDC that can be borrowed.
    function getBorrowLimit(uint256 escrowId) external view returns (uint256) {
        Escrow storage e = escrows[escrowId];
        uint256 maxBorrow = (e.amount * LTV_BPS) / 10000;
        uint256 currentDebt = debt[escrowId];
        if (currentDebt >= maxBorrow) return 0;
        return maxBorrow - currentDebt;
    }

    /// @notice Get the current outstanding debt for an escrow.
    /// @param escrowId The escrow ID.
    /// @return The outstanding USDC debt.
    function getDebt(uint256 escrowId) external view returns (uint256) {
        return debt[escrowId];
    }

    /* ─── Admin Functions ────────────────────────────────────────── */

    /// @notice Update the platform fee recipient address.
    /// @param _feeRecipient The new fee recipient address.
    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        if (_feeRecipient == address(0)) revert Unauthorized();
        feeRecipient = _feeRecipient;
    }

    /// @notice Pause all state-changing user functions.
    function emergencyPause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause the contract.
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Rescue accidentally sent ERC-20 tokens (safety net).
    /// @param token  The ERC-20 token address to rescue.
    /// @param amount The amount to rescue.
    function rescueERC20(address token, uint256 amount) external onlyOwner {
        bool success = IERC20Minimal(token).transfer(msg.sender, amount);
        if (!success) revert TransferFailed();
    }

    /* ─── Internal Helpers ───────────────────────────────────────── */

    /// @dev Build a simple token URI string for the invoice NFT.
    function _buildTokenURI(
        uint256 escrowId,
        uint256 amount,
        address seller
    ) internal pure returns (string memory) {
        return string(
            abi.encodePacked(
                "dotpay://invoice/",
                _uint2str(escrowId),
                "/",
                _uint2str(amount),
                "/",
                _addr2str(seller)
            )
        );
    }

    /// @dev Convert uint256 to decimal string.
    function _uint2str(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    /// @dev Convert address to hex string.
    function _addr2str(address addr) internal pure returns (string memory) {
        bytes memory s = new bytes(42);
        s[0] = "0";
        s[1] = "x";
        for (uint256 i = 0; i < 20; i++) {
            bytes1 b = bytes1(uint8(uint160(addr) / (2 ** (8 * (19 - i)))));
            bytes1 hi = bytes1(uint8(b) / 16);
            bytes1 lo = bytes1(uint8(b) - 16 * uint8(hi));
            s[2 + 2 * i] = _char(hi);
            s[3 + 2 * i] = _char(lo);
        }
        return string(s);
    }

    /// @dev Convert a nibble to its hex character.
    function _char(bytes1 b) internal pure returns (bytes1 c) {
        if (uint8(b) < 10) return bytes1(uint8(b) + 0x30);
        else return bytes1(uint8(b) + 0x57);
    }
}
