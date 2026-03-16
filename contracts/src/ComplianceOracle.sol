// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IDotPay} from "./interfaces/IDotPay.sol";

/// @title ComplianceOracle
/// @author DotPay
/// @notice On-chain KYC/AML oracle for compliance gating.
///         The owner (operator) sets KYC levels, AML scores, and blacklist status.
///         InvoiceCore calls `check()` before allowing escrow creation.
contract ComplianceOracle is Ownable {

    /// @notice KYC level assigned to each address.
    mapping(address => IDotPay.KycLevel) public kycLevel;

    /// @notice AML risk score (0–100) assigned to each address. Score >= 75 is flagged.
    mapping(address => uint256) public amlScore;

    /// @notice Blacklist status for each address.
    mapping(address => bool) public blacklisted;

    /// @notice Maximum single-transaction limit per KYC level (in USDC, 6 decimals).
    mapping(IDotPay.KycLevel => uint256) public txLimit;

    /* ─── Events ─────────────────────────────────────────────────── */

    event KycSet(address indexed user, IDotPay.KycLevel level);
    event AmlScoreSet(address indexed user, uint256 score);
    event Blacklisted(address indexed user);
    event Removed(address indexed user);

    /* ─── Constructor ────────────────────────────────────────────── */

    /// @notice Deploy the ComplianceOracle with default transaction limits.
    /// @param _owner The admin address that can update compliance data.
    constructor(address _owner) Ownable(_owner) {
        txLimit[IDotPay.KycLevel.None]          = 0;
        txLimit[IDotPay.KycLevel.Basic]         = 1_000e6;        // $1,000
        txLimit[IDotPay.KycLevel.Advanced]      = 100_000e6;      // $100,000
        txLimit[IDotPay.KycLevel.Institutional] = 10_000_000e6;   // $10,000,000
    }

    /* ─── Admin Functions ────────────────────────────────────────── */

    /// @notice Set the KYC level for a user.
    /// @param user  The address to update.
    /// @param level The new KYC level.
    function setKycLevel(address user, IDotPay.KycLevel level) external onlyOwner {
        kycLevel[user] = level;
        emit KycSet(user, level);
    }

    /// @notice Batch-set KYC levels for multiple users.
    /// @param users  Array of addresses.
    /// @param levels Array of KYC levels (must match users length).
    function batchSetKycLevel(
        address[] calldata users,
        IDotPay.KycLevel[] calldata levels
    ) external onlyOwner {
        require(users.length == levels.length, "length mismatch");
        for (uint256 i = 0; i < users.length; i++) {
            kycLevel[users[i]] = levels[i];
            emit KycSet(users[i], levels[i]);
        }
    }

    /// @notice Set the AML risk score for a user (0–100).
    /// @param user  The address to update.
    /// @param score The AML risk score.
    function setAmlScore(address user, uint256 score) external onlyOwner {
        require(score <= 100, "score must be 0-100");
        amlScore[user] = score;
        emit AmlScoreSet(user, score);
    }

    /// @notice Add an address to the blacklist.
    /// @param user The address to blacklist.
    function addToBlacklist(address user) external onlyOwner {
        blacklisted[user] = true;
        emit Blacklisted(user);
    }

    /// @notice Remove an address from the blacklist.
    /// @param user The address to remove.
    function removeFromBlacklist(address user) external onlyOwner {
        blacklisted[user] = false;
        emit Removed(user);
    }

    /// @notice Update the transaction limit for a given KYC level.
    /// @param level The KYC level to update.
    /// @param limit The new max transaction limit (USDC, 6 decimals).
    function setTxLimit(IDotPay.KycLevel level, uint256 limit) external onlyOwner {
        txLimit[level] = limit;
    }

    /* ─── Compliance Check ───────────────────────────────────────── */

    /// @notice Check if a user is allowed to transact a given amount.
    /// @param user   The address to check.
    /// @param amount The USDC amount of the transaction (6 decimals).
    /// @return allowed Whether the transaction is permitted.
    /// @return reason  Human-readable denial reason (empty if allowed).
    function check(address user, uint256 amount)
        external
        view
        returns (bool allowed, string memory reason)
    {
        if (blacklisted[user]) {
            return (false, "blacklisted");
        }

        IDotPay.KycLevel level = kycLevel[user];

        if (level == IDotPay.KycLevel.None && amount > 0) {
            return (false, "kyc required");
        }

        if (amount > txLimit[level]) {
            return (false, "exceeds tx limit");
        }

        if (amlScore[user] >= 75) {
            return (false, "aml flagged");
        }

        return (true, "");
    }

    /* ─── Public View Functions ──────────────────────────────────── */

    /// @notice Get the KYC level assigned to an address.
    /// @param user The address to query.
    /// @return The KYC level enum value.
    function getKycLevel(address user) external view returns (IDotPay.KycLevel) {
        return kycLevel[user];
    }

    /// @notice Check if an address is blacklisted.
    /// @param user The address to query.
    /// @return True if the address is on the blacklist.
    function isBlacklisted(address user) external view returns (bool) {
        return blacklisted[user];
    }
}
