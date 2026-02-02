// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSDC
/// @notice A mock USDC token for testing purposes
contract MockUSDC is ERC20 {
    uint8 private _decimals;

    constructor() ERC20("USD Coin", "USDC") {
        _decimals = 6; // USDC has 6 decimals
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /// @notice Mint tokens to an address (for testing)
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice Burn tokens from an address (for testing)
    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}
