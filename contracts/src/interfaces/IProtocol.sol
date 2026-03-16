// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Minimal interfaces for cross-contract calls to reduce bytecode.

interface IInvoiceNFT {
    function mint(address to, uint256 tokenId, string memory uri, uint256 escrowId) external;
    function burnByMinter(uint256 tokenId) external;
    function ownerOf(uint256 tokenId) external view returns (address);
    function transferFrom(address from, address to, uint256 tokenId) external;
}

interface IComplianceOracle {
    function check(address user, uint256 amount) external view returns (bool allowed, string memory reason);
}

interface IXCMYieldVault {
    function deployYield(uint256 escrowId, uint256 amount) external;
    function reclaimYield(uint256 escrowId) external returns (uint256 principal, uint256 yieldEarned);
    function previewYield(uint256 escrowId) external view returns (uint256);
}
