// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SessionErrors
 * @notice Custom errors for the SessionSettlement contract
 * @dev Using custom errors for gas efficiency over require strings
 */
library SessionErrors {
    /// @notice Thrown when attempting to create a session that already exists
    /// @param sessionId The duplicate session ID
    error SessionAlreadyExists(bytes32 sessionId);

    /// @notice Thrown when attempting to operate on an inactive session
    /// @param sessionId The inactive session ID
    error SessionNotActive(bytes32 sessionId);

    /// @notice Thrown when attempting to settle an already settled session
    /// @param sessionId The already settled session ID
    error SessionAlreadySettled(bytes32 sessionId);

    /// @notice Thrown when recipient address is zero
    error InvalidRecipient();

    /// @notice Thrown when amount is zero
    error InvalidAmount();

    /// @notice Thrown when batch settlement array is empty
    error EmptyBatch();

    /// @notice Thrown when batch exceeds maximum allowed size
    /// @param size The batch size provided
    /// @param maxSize The maximum allowed batch size
    error BatchTooLarge(uint256 size, uint256 maxSize);

    /// @notice Thrown when contract has insufficient USDC balance
    /// @param required The required amount
    /// @param available The available balance
    error InsufficientBalance(uint256 required, uint256 available);

    /// @notice Thrown when sender has insufficient USDC allowance
    /// @param required The required allowance
    /// @param available The current allowance
    error InsufficientAllowance(uint256 required, uint256 available);

    /// @notice Thrown when USDC address is invalid
    error InvalidUSDCAddress();

    /// @notice Thrown when batch total amount overflows
    error BatchAmountOverflow();
}
