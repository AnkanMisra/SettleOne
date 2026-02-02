// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ISessionSettlement} from "../interfaces/ISessionSettlement.sol";

/**
 * @title SessionTypes
 * @notice Type definitions for the SessionSettlement contract
 * @dev Re-exports types from interface for convenience
 */
library SessionTypes {
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
}
