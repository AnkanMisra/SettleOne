# Smart Contracts – SettleOne

**Last Updated**: February 5, 2026 (Session 5)

SettleOne uses a single Base Sepolia smart contract for secure finalization of off-chain sessions.

---

## Contract Name: `SessionSettlement.sol`

### Functions

- `startSession(bytes32 sessionId, address user)`
  - Records session metadata with timestamp
- `finalizeSession(bytes32 sessionId, uint256 amount, address recipient)`
  - Validates allowance before state changes
  - Transfers USDC to the recipient
  - Emits `SessionSettled` event
- `finalizeSessionBatch(bytes32 sessionId, Settlement[] settlements)`
  - Batch settlement for multiple recipients
  - Integer overflow protection
  - Pre-validates total allowance
  - Emits `BatchSettled` and individual `SessionSettled` events
- `getSession(bytes32 sessionId)` - Returns session details
- `isSessionSettled(bytes32 sessionId)` - Check if settled
- `emergencyWithdraw(address to, uint256 amount)` - Owner-only recovery

### Security Features

- ReentrancyGuard (OpenZeppelin)
- Ownable for admin functions
- SafeERC20 for token transfers
- Immutable USDC address
- **Integer overflow protection** using `unchecked` block with explicit check
- **Pre-validation of allowance** before any state changes
- Custom errors for gas efficiency

### Custom Errors

| Error | Description |
|-------|-------------|
| `SessionAlreadyExists` | Session ID already used |
| `SessionNotActive` | Session is inactive |
| `SessionAlreadySettled` | Session already finalized |
| `InvalidRecipient` | Zero address recipient |
| `InvalidAmount` | Zero amount |
| `EmptyBatch` | Empty settlements array |
| `BatchTooLarge` | Exceeds MAX_BATCH_SIZE (100) |
| `InsufficientBalance` | Contract balance too low |
| `InsufficientAllowance` | Sender allowance too low |
| `BatchAmountOverflow` | Total amount overflows |
| `InvalidUSDCAddress` | Zero USDC address |

### Dependencies

- OpenZeppelin Contracts v5.x
- USDC ERC-20 interface

---

## Deployment Info

| Network | Chain ID | Contract Address |
|---------|----------|------------------|
| Base Sepolia | 84532 | `0xe66B3Fa5F2b84df7CbD288EB3BC91feE48a90cB2` |
| MockUSDC | 84532 | `0xc5c8977491c2dc822F4f738356ec0231F7100f52` |

**Block Explorer**: https://sepolia.basescan.org/address/0xe66B3Fa5F2b84df7CbD288EB3BC91feE48a90cB2

**Verified**: Pending (use `npx hardhat verify` command from deploy output)

---

## Test Coverage

27 tests covering:
- Deployment validation
- Session management (start, duplicate prevention)
- Single settlement (success, errors)
- Batch settlement (success, errors, overflow protection)
- Admin functions (emergency withdraw)
- View functions

Run tests: `cd contracts && pnpm test`

---

## Future Enhancements

1. **Arc Chain Deployment** - Deploy to Circle's Arc chain when available
2. **Multi-token Support** - Support other stablecoins (USDT, DAI)
3. **Signature-based Settlement** - Allow off-chain signatures for settlement
4. **Streaming Payments** - Time-based payment streams
5. **DAO Integration** - Multi-sig approval for large settlements
