// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {ISessionSettlement} from "./interfaces/ISessionSettlement.sol";
import {SessionErrors} from "./libraries/SessionErrors.sol";

/**
 * @title SessionSettlement
 * @author SettleOne Team
 * @notice Handles final settlement of Yellow Network off-chain sessions on Arc chain
 * @dev Receives batched session data and transfers USDC to recipients
 * 
 * Key features:
 * - Session-based payment aggregation
 * - Single and batch settlement support
 * - Reentrancy protection
 * - Owner-controlled emergency functions
 */
contract SessionSettlement is ISessionSettlement, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // =============================================================
    //                           STORAGE
    // =============================================================

    /// @notice The USDC token used for settlements
    IERC20 public immutable usdc;

    /// @notice Mapping of session IDs to their settlement status
    mapping(bytes32 => bool) private _settledSessions;

    /// @notice Mapping of session IDs to their metadata
    mapping(bytes32 => Session) private _sessions;

    // =============================================================
    //                         CONSTRUCTOR
    // =============================================================

    /**
     * @notice Initializes the contract with the USDC token address
     * @param _usdc The address of the USDC token contract
     */
    constructor(address _usdc) Ownable(msg.sender) {
        if (_usdc == address(0)) {
            revert SessionErrors.InvalidUSDCAddress();
        }
        usdc = IERC20(_usdc);
    }

    // =============================================================
    //                      SESSION MANAGEMENT
    // =============================================================

    /// @inheritdoc ISessionSettlement
    function startSession(bytes32 sessionId, address user) external {
        if (_sessions[sessionId].createdAt != 0) {
            revert SessionErrors.SessionAlreadyExists(sessionId);
        }
        if (user == address(0)) {
            revert SessionErrors.InvalidRecipient();
        }

        _sessions[sessionId] = Session({
            user: user,
            createdAt: block.timestamp,
            active: true
        });

        emit SessionStarted(sessionId, user, block.timestamp);
    }

    /// @inheritdoc ISessionSettlement
    function finalizeSession(
        bytes32 sessionId,
        uint256 amount,
        address recipient
    ) external nonReentrant {
        _validateSettlement(sessionId, amount, recipient);

        // Check contract has sufficient USDC balance
        uint256 balance = usdc.balanceOf(address(this));
        if (balance < amount) {
            revert SessionErrors.InsufficientBalance(amount, balance);
        }

        // Mark session as settled and deactivate
        _markSettled(sessionId);

        // Transfer USDC to recipient
        usdc.safeTransfer(recipient, amount);

        emit SessionSettled(sessionId, recipient, amount, block.timestamp);
    }

    /// @inheritdoc ISessionSettlement
    function finalizeSessionBatch(
        bytes32 sessionId,
        Settlement[] calldata settlements
    ) external nonReentrant {
        if (_settledSessions[sessionId]) {
            revert SessionErrors.SessionAlreadySettled(sessionId);
        }
        if (settlements.length == 0) {
            revert SessionErrors.EmptyBatch();
        }

        // Calculate total amount and validate settlements
        uint256 totalAmount = _calculateAndValidateBatch(settlements);

        // Check contract has sufficient balance
        uint256 balance = usdc.balanceOf(address(this));
        if (balance < totalAmount) {
            revert SessionErrors.InsufficientBalance(totalAmount, balance);
        }

        // Mark session as settled
        _markSettled(sessionId);

        // Execute all transfers
        _executeBatchTransfers(sessionId, settlements);

        emit BatchSettled(sessionId, totalAmount, settlements.length);
    }

    // =============================================================
    //                         VIEW FUNCTIONS
    // =============================================================

    /// @inheritdoc ISessionSettlement
    function isSessionSettled(bytes32 sessionId) external view returns (bool) {
        return _settledSessions[sessionId];
    }

    /// @inheritdoc ISessionSettlement
    function getSession(bytes32 sessionId) 
        external 
        view 
        returns (address user, uint256 createdAt, bool active) 
    {
        Session memory session = _sessions[sessionId];
        return (session.user, session.createdAt, session.active);
    }

    /// @inheritdoc ISessionSettlement
    function getBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    // =============================================================
    //                        ADMIN FUNCTIONS
    // =============================================================

    /**
     * @notice Allows owner to withdraw excess USDC (emergency only)
     * @param to The address to send USDC to
     * @param amount The amount to withdraw
     */
    function emergencyWithdraw(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) {
            revert SessionErrors.InvalidRecipient();
        }
        usdc.safeTransfer(to, amount);
    }

    // =============================================================
    //                      INTERNAL FUNCTIONS
    // =============================================================

    /**
     * @dev Validates settlement parameters
     */
    function _validateSettlement(
        bytes32 sessionId,
        uint256 amount,
        address recipient
    ) internal view {
        if (_settledSessions[sessionId]) {
            revert SessionErrors.SessionAlreadySettled(sessionId);
        }
        if (recipient == address(0)) {
            revert SessionErrors.InvalidRecipient();
        }
        if (amount == 0) {
            revert SessionErrors.InvalidAmount();
        }
    }

    /**
     * @dev Marks a session as settled and deactivates it
     */
    function _markSettled(bytes32 sessionId) internal {
        _settledSessions[sessionId] = true;
        
        if (_sessions[sessionId].active) {
            _sessions[sessionId].active = false;
        }
    }

    /**
     * @dev Calculates total amount and validates batch settlements
     */
    function _calculateAndValidateBatch(
        Settlement[] calldata settlements
    ) internal pure returns (uint256 totalAmount) {
        for (uint256 i = 0; i < settlements.length; i++) {
            if (settlements[i].recipient == address(0)) {
                revert SessionErrors.InvalidRecipient();
            }
            if (settlements[i].amount == 0) {
                revert SessionErrors.InvalidAmount();
            }
            totalAmount += settlements[i].amount;
        }
    }

    /**
     * @dev Executes batch transfers and emits events
     */
    function _executeBatchTransfers(
        bytes32 sessionId,
        Settlement[] calldata settlements
    ) internal {
        for (uint256 i = 0; i < settlements.length; i++) {
            usdc.safeTransfer(settlements[i].recipient, settlements[i].amount);
            emit SessionSettled(
                sessionId,
                settlements[i].recipient,
                settlements[i].amount,
                block.timestamp
            );
        }
    }
}
