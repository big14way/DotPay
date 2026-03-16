// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IXcm, XCM_PRECOMPILE} from "./interfaces/IXcm.sol";
import {IERC20Minimal} from "./interfaces/IERC20Minimal.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title FiatSettlement
/// @author DotPay
/// @notice Routes USDC via XCM to Pendulum parachain for Stellar fiat settlement.
///         Pendulum's Spacewalk bridge converts USDC → Stellar USDC → off-ramp NGN/KES/GHS.
contract FiatSettlement is Ownable, ReentrancyGuard {

    IXcm    constant xcm  = IXcm(XCM_PRECOMPILE);
    uint32  constant PENDULUM_PARA_ID = 2094;

    /// @notice The USDC token contract.
    IERC20Minimal public immutable usdc;

    /// @notice The InvoiceCore contract address authorized to call this contract.
    address public coreContract;

    /// @notice Supported fiat corridors for off-ramping.
    enum Corridor { NGN, KES, GHS, TZS, ZAR }

    /// @notice Settlement record for tracking fiat off-ramp requests.
    struct Settlement {
        uint256   escrowId;
        address   sender;
        bytes     stellarAddress;   // Stellar G-address as bytes
        uint256   amount;
        Corridor  corridor;
        uint64    timestamp;
        bool      completed;
    }

    /// @notice All settlements indexed by settlement ID.
    mapping(uint256 => Settlement) public settlements;

    /// @notice Auto-incrementing settlement ID counter.
    uint256 public nextSettlementId;

    /// @notice Pre-built XCM payload template for Pendulum routing (set by owner off-chain).
    bytes public xcmPendulumTemplate;

    /// @notice Whether to dispatch real XCM or simulate locally.
    bool  public useRealXcm;

    /* ─── Errors ─────────────────────────────────────────────────── */

    error NotCore();
    error InvalidStellarAddress();
    error UnsupportedCorridor();

    /* ─── Events ─────────────────────────────────────────────────── */

    event SettlementQueued(
        uint256 indexed settlementId,
        uint256 indexed escrowId,
        bytes stellarAddress,
        Corridor corridor,
        uint256 amount
    );
    event SettlementCompleted(uint256 indexed settlementId);
    event XcmPendulumDispatched(uint256 indexed settlementId, bytes payload);

    /* ─── Modifiers ──────────────────────────────────────────────── */

    modifier onlyCore() {
        if (msg.sender != coreContract) revert NotCore();
        _;
    }

    /* ─── Constructor ────────────────────────────────────────────── */

    /// @notice Deploy the FiatSettlement contract.
    /// @param _usdc  The USDC token address.
    /// @param _owner The owner address for admin functions.
    constructor(address _usdc, address _owner) Ownable(_owner) {
        usdc = IERC20Minimal(_usdc);
    }

    /* ─── Admin Functions ────────────────────────────────────────── */

    /// @notice Set the InvoiceCore contract address.
    /// @param _core The InvoiceCore contract address.
    function setCoreContract(address _core) external onlyOwner {
        coreContract = _core;
    }

    /// @notice Toggle between real XCM and local simulation.
    /// @param _use True to use real XCM.
    function setUseRealXcm(bool _use) external onlyOwner {
        useRealXcm = _use;
    }

    /// @notice Set the SCALE-encoded XCM payload template for Pendulum routing.
    /// @param tmpl The XCM payload template bytes.
    function setXcmTemplate(bytes calldata tmpl) external onlyOwner {
        xcmPendulumTemplate = tmpl;
    }

    /* ─── Core Functions ─────────────────────────────────────────── */

    /// @notice Initiate a fiat settlement via Pendulum's Spacewalk bridge.
    /// @param escrowId    Source escrow being released.
    /// @param stellarAddr Recipient's Stellar G-address (56 ASCII bytes).
    /// @param amount      USDC amount (6 decimals).
    /// @param corridor    Target fiat currency corridor.
    /// @return settlementId The ID of the created settlement record.
    function initiateFiatSettlement(
        uint256   escrowId,
        bytes calldata stellarAddr,
        uint256   amount,
        Corridor  corridor
    ) external onlyCore nonReentrant returns (uint256 settlementId) {
        // Validate Stellar address (G + 55 base58 chars = 56 bytes)
        if (stellarAddr.length != 56 || stellarAddr[0] != 0x47) revert InvalidStellarAddress();

        // Effects: record settlement before external calls
        settlementId = nextSettlementId++;
        settlements[settlementId] = Settlement({
            escrowId:       escrowId,
            sender:         tx.origin,
            stellarAddress: stellarAddr,
            amount:         amount,
            corridor:       corridor,
            timestamp:      uint64(block.timestamp),
            completed:      false
        });

        // Interaction: pull USDC from core
        bool success = usdc.transferFrom(coreContract, address(this), amount);
        require(success, "transfer failed");

        if (useRealXcm && xcmPendulumTemplate.length > 0) {
            // XCM to Pendulum: route USDC to Spacewalk vault for Stellar redemption
            // The template encodes: WithdrawAsset(USDC) + BuyExecution
            // + DepositReserveAsset → Parachain(2094)
            // + Transact(spacewalk.redeem(USDC_STELLAR, amount, stellarAddr))
            IXcm.Weight memory w = xcm.weighMessage(xcmPendulumTemplate);
            xcm.execute(xcmPendulumTemplate, w);
            emit XcmPendulumDispatched(settlementId, xcmPendulumTemplate);
        }

        emit SettlementQueued(settlementId, escrowId, stellarAddr, corridor, amount);
    }

    /// @notice Mark a settlement as completed (called by oracle/relayer).
    /// @param settlementId The settlement ID to mark as completed.
    function markCompleted(uint256 settlementId) external onlyOwner {
        settlements[settlementId].completed = true;
        emit SettlementCompleted(settlementId);
    }

    /* ─── View Functions ─────────────────────────────────────────── */

    /// @notice Get the full settlement record.
    /// @param id The settlement ID.
    /// @return The Settlement struct.
    function getSettlement(uint256 id) external view returns (Settlement memory) {
        return settlements[id];
    }
}
