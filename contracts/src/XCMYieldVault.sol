// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IXcm, XCM_PRECOMPILE} from "./interfaces/IXcm.sol";
import {IERC20Minimal} from "./interfaces/IERC20Minimal.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title XCMYieldVault
/// @author DotPay
/// @notice Routes USDC to Hydration parachain for yield via XCM.
///         On real mainnet this dispatches XCM to Hydration's money market.
///         On testnet we simulate yield locally when Hydration XCM is unavailable.
contract XCMYieldVault is Ownable, ReentrancyGuard {

    IXcm constant xcm = IXcm(XCM_PRECOMPILE);

    /// @notice The USDC token contract.
    IERC20Minimal public immutable usdc;

    /// @notice Hydration parachain ID for XCM routing.
    uint32 public constant HYDRATION_PARA_ID = 2034;

    /// @notice Simulated APY in basis points (500 = 5%).
    uint256 public simulatedApyBps = 500;

    /// @notice Whether to use real XCM or local simulation.
    bool public useRealXcm;

    /// @notice Principal deposited per escrow.
    mapping(uint256 => uint256) public deposited;

    /// @notice Timestamp of deposit per escrow.
    mapping(uint256 => uint256) public depositedAt;

    /// @notice Whether yield is active for a given escrow.
    mapping(uint256 => bool) public yieldActive;

    /// @notice Pre-computed XCM deposit payload template (SCALE-encoded off-chain).
    bytes public xcmDepositPayloadTemplate;

    /// @notice Pre-computed XCM withdraw payload template (SCALE-encoded off-chain).
    bytes public xcmWithdrawPayloadTemplate;

    /// @notice The InvoiceCore contract address authorized to call this vault.
    address public coreContract;

    /* ─── Errors ─────────────────────────────────────────────────── */

    error NotCore();
    error NotDeployed(uint256 escrowId);

    /* ─── Events ─────────────────────────────────────────────────── */

    event YieldDeployed(uint256 indexed escrowId, uint256 amount, bool realXcm);
    event YieldReclaimed(uint256 indexed escrowId, uint256 principal, uint256 yieldEarned);
    event XcmPayloadUpdated();

    /* ─── Modifiers ──────────────────────────────────────────────── */

    modifier onlyCore() {
        if (msg.sender != coreContract) revert NotCore();
        _;
    }

    /* ─── Constructor ────────────────────────────────────────────── */

    /// @notice Deploy the XCMYieldVault.
    /// @param _usdc  The USDC token address.
    /// @param _owner The owner address for admin functions.
    constructor(address _usdc, address _owner) Ownable(_owner) {
        usdc = IERC20Minimal(_usdc);
    }

    /* ─── Admin Functions ────────────────────────────────────────── */

    /// @notice Set the InvoiceCore contract address that can call this vault.
    /// @param _core The InvoiceCore contract address.
    function setCoreContract(address _core) external onlyOwner {
        coreContract = _core;
    }

    /// @notice Toggle between real XCM and local simulation.
    /// @param _use True to use real XCM, false for local simulation.
    function setUseRealXcm(bool _use) external onlyOwner {
        useRealXcm = _use;
    }

    /// @notice Set simulated APY in basis points (only used when useRealXcm=false).
    /// @param _bps APY in basis points (max 2000 = 20%).
    function setSimulatedApyBps(uint256 _bps) external onlyOwner {
        require(_bps <= 2000, "max 20% APY");
        simulatedApyBps = _bps;
    }

    /// @notice Update SCALE-encoded XCM payload templates (built off-chain via PAPI).
    /// @param deposit  The deposit XCM payload template.
    /// @param withdraw The withdraw XCM payload template.
    function setXcmPayloads(bytes calldata deposit, bytes calldata withdraw) external onlyOwner {
        xcmDepositPayloadTemplate = deposit;
        xcmWithdrawPayloadTemplate = withdraw;
        emit XcmPayloadUpdated();
    }

    /* ─── Core Functions ─────────────────────────────────────────── */

    /// @notice Deploy escrow funds into Hydration yield strategy.
    /// @dev Called by InvoiceCore when a yield-enabled escrow is created.
    /// @param escrowId The escrow ID to deploy yield for.
    /// @param amount   The USDC amount to deploy.
    function deployYield(uint256 escrowId, uint256 amount) external onlyCore nonReentrant {
        require(amount > 0, "zero amount");

        bool success = usdc.transferFrom(coreContract, address(this), amount);
        require(success, "transfer failed");

        deposited[escrowId]   = amount;
        depositedAt[escrowId] = block.timestamp;
        yieldActive[escrowId] = true;

        if (useRealXcm && xcmDepositPayloadTemplate.length > 0) {
            // Dispatch XCM to Hydration's lending pallet
            // The payload encodes: WithdrawAsset + BuyExecution + DepositReserveAsset
            // + Transact(lending.deposit(USDC, amount))
            // Payload template must be pre-computed off-chain using PAPI
            IXcm.Weight memory w = xcm.weighMessage(xcmDepositPayloadTemplate);
            xcm.execute(xcmDepositPayloadTemplate, w);
        }
        // else: funds sit in this contract, yield simulated at reclaim time

        emit YieldDeployed(escrowId, amount, useRealXcm);
    }

    /// @notice Reclaim principal + yield from Hydration and return to core.
    /// @dev Called by InvoiceCore on escrow release or refund.
    /// @param escrowId The escrow ID to reclaim yield for.
    /// @return principal   Original deposit amount.
    /// @return yieldEarned Yield accumulated during the lock period.
    function reclaimYield(uint256 escrowId)
        external
        onlyCore
        nonReentrant
        returns (uint256 principal, uint256 yieldEarned)
    {
        if (!yieldActive[escrowId]) revert NotDeployed(escrowId);

        principal    = deposited[escrowId];
        uint256 secs = block.timestamp - depositedAt[escrowId];

        if (useRealXcm && xcmWithdrawPayloadTemplate.length > 0) {
            // Dispatch XCM to withdraw from Hydration
            IXcm.Weight memory w = xcm.weighMessage(xcmWithdrawPayloadTemplate);
            xcm.execute(xcmWithdrawPayloadTemplate, w);
            yieldEarned = 0; // yield comes back via XCM, handled separately
        } else {
            // Simulate: principal * APY * seconds / year
            yieldEarned = (principal * simulatedApyBps * secs) / (10000 * 365 days);
        }

        // Effects: clear state before external calls
        deposited[escrowId]   = 0;
        depositedAt[escrowId] = 0;
        yieldActive[escrowId] = false;

        // Interaction: transfer funds back to core
        uint256 total = principal + yieldEarned;
        bool success = usdc.transfer(coreContract, total);
        require(success, "transfer failed");

        emit YieldReclaimed(escrowId, principal, yieldEarned);
    }

    /* ─── View Functions ─────────────────────────────────────────── */

    /// @notice Preview accrued yield without claiming.
    /// @param escrowId The escrow ID to preview.
    /// @return The estimated yield accrued so far.
    function previewYield(uint256 escrowId) external view returns (uint256) {
        if (!yieldActive[escrowId]) return 0;
        uint256 secs = block.timestamp - depositedAt[escrowId];
        return (deposited[escrowId] * simulatedApyBps * secs) / (10000 * 365 days);
    }
}
