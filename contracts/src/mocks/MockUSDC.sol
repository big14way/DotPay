// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSDC
/// @notice Mock USDC for local testing (6 decimals like real USDC).
contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mint tokens to any address (for testing).
    /// @param to     The recipient address.
    /// @param amount The amount to mint (6 decimals).
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice Mint 10,000 USDC to the caller (convenience faucet).
    function faucet() external {
        _mint(msg.sender, 10_000 * 1e6);
    }
}
