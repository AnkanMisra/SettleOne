// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ISessionSettlement
 * @notice Interface for the SessionSettlement contract
 * @dev Defines the external functions and events for session-based USDC settlement
 */
interface ISessionSettlement {
    // =============================================================
    //                           STRUCTS
    // =============================================================

    /// @notice Struct to store session metadata
    struct Session {
        address user;
        uint256 createdAt;
        bool active;
    }

    /// @notice Struct for batch settlement data
    struct Settlement {
        address recipient;
        uint256 amount;
    }

    // =============================================================
    //                           EVENTS
    // =============================================================

    /// @notice Emitted when a new session is started
    event SessionStarted(bytes32 indexed sessionId, address indexed user, uint256 timestamp);

    /// @notice Emitted when a session is finalized and settled
    event SessionSettled(
        bytes32 indexed sessionId,
        address indexed recipient,
        uint256 amount,
        uint256 timestamp
    );

    /// @notice Emitted when a batch settlement is completed
    event BatchSettled(bytes32 indexed sessionId, uint256 totalAmount, uint256 recipientCount);

    // =============================================================
    //                         FUNCTIONS
    // =============================================================

    /// @notice Starts a new session for a user
    /// @param sessionId Unique identifier for the session
    /// @param user The address of the user starting the session
    function startSession(bytes32 sessionId, address user) external;

    /// @notice Finalizes a session and transfers USDC to the recipient
    /// @param sessionId The unique session identifier
    /// @param amount The total amount to transfer
    /// @param recipient The recipient address
    function finalizeSession(bytes32 sessionId, uint256 amount, address recipient) external;

    /// @notice Finalizes a session with multiple recipients (batch settlement)
    /// @param sessionId The unique session identifier
    /// @param settlements Array of recipient-amount pairs
    function finalizeSessionBatch(bytes32 sessionId, Settlement[] calldata settlements) external;

    /// @notice Checks if a session has been settled
    /// @param sessionId The session ID to check
    /// @return True if the session has been settled
    function isSessionSettled(bytes32 sessionId) external view returns (bool);

    /// @notice Gets session metadata
    /// @param sessionId The session ID to query
    /// @return user The user who started the session
    /// @return createdAt The timestamp when the session was created
    /// @return active Whether the session is still active
    function getSession(bytes32 sessionId) external view returns (address user, uint256 createdAt, bool active);

    /// @notice Gets the contract's USDC balance
    /// @return The current USDC balance
    function getBalance() external view returns (uint256);
}
