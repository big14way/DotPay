// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

address constant XCM_PRECOMPILE = 0x00000000000000000000000000000000000a0000;

interface IXcm {
    struct Weight {
        uint64 refTime;
        uint64 proofSize;
    }

    /// @notice Execute an XCM message locally using the caller as origin.
    /// @param message SCALE-encoded VersionedXcm bytes.
    /// @param weight  Maximum weight to spend.
    function execute(bytes calldata message, Weight calldata weight) external;

    /// @notice Send an XCM message to a remote consensus system.
    /// @param destination SCALE-encoded MultiLocation of the destination.
    /// @param message     SCALE-encoded VersionedXcm bytes.
    function send(bytes calldata destination, bytes calldata message) external;

    /// @notice Estimate the weight needed to execute a given XCM.
    function weighMessage(bytes calldata message) external view returns (Weight memory);
}
