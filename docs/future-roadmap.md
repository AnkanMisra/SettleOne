# Smart Contracts – SettleOne

SettleOne uses a single Arc chain smart contract for secure finalization of off-chain sessions.

---

## 🔐 Contract Name: `SessionSettlement.sol`

### Functions

- `startSession(address user)`
  - Records session metadata
- `finalizeSession(bytes32 sessionId, uint256 totalAmount, address recipient)`
  - Transfers total USDC to the resolved ENS recipient
  - Emits `SessionSettled` event

### Dependencies

- USDC ERC-20 interface (via Circle)
- ENS resolver via `ENSRegistry`

---

## 🔁 Deployment Info

- Chain: Arc testnet (EVM-compatible)
- Contract Address: `0xABC123...` (to be filled)
- Verified on block explorer? Yes
