# SettleOne – Architecture Overview

**Last Updated**: February 5, 2026 (Session 5)

SettleOne is composed of four core layers:

## 1. Frontend (Next.js + React)
- Connects wallet using wagmi/viem with MetaMask or Phantom
- Resolves ENS names via viem provider
- Displays LI.FI cross-chain quotes with QuoteDisplay component
- **Yellow Network SDK integration with @erc7824/nitrolite** (COMPLETE)
  - Full authentication flow with challenge-response
  - Session creation with ClearNode confirmation
  - State channel payments with proper allocations
  - Session close with settlement data
- **Executes on-chain settlement via `useSettlement` hook**
- **Transaction confirmation with `waitForTransactionReceipt`** (Security fix)
- Supports Base, Base Sepolia, Ethereum, and other EVM chains

## 2. Backend (Rust + Axum)
- RESTful API for session management
- **Shared `AppState` with `Arc<SessionStore>` for session persistence**
- ENS resolution service (caches results)
- LI.FI API proxy for cross-chain quotes
- **tx_hash preservation in finalize** (Bug fix)
- Async/await architecture with Tokio runtime

**Tech Stack:**
- Framework: Axum 0.7
- Runtime: Tokio
- HTTP Client: reqwest
- Serialization: serde/serde_json
- Error Handling: thiserror/anyhow

## 3. Smart Contracts (Base Sepolia - Solidity)
- **SessionSettlement.sol**: Main settlement contract
- **ISessionSettlement.sol**: Interface definitions
- **SessionErrors.sol**: Custom error library (with security errors)
- **SessionTypes.sol**: Shared type definitions
- **MockUSDC.sol**: Test mock for USDC

**Deployed Contracts (Base Sepolia)**:
- SessionSettlement: `0xe66B3Fa5F2b84df7CbD288EB3BC91feE48a90cB2`
- MockUSDC: `0xc5c8977491c2dc822F4f738356ec0231F7100f52`

**Security Features:**
- Single and batch settlement support
- Custom errors for gas efficiency
- Reentrancy protection (OpenZeppelin)
- Owner-controlled emergency functions
- Event emission for indexing
- **Integer overflow protection** (unchecked block + custom error)
- **Pre-validation of allowance** before state changes
- **InsufficientAllowance** and **BatchAmountOverflow** errors

## 4. External Integrations

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   Next.js Frontend                        │   │
│  │  • MetaMask/Phantom Wallet Connection                    │   │
│  │  • ENS Input Resolution                                   │   │
│  │  • Payment Session UI                                     │   │
│  │  • useSettlement Hook (On-chain TX)                      │   │
│  └─────────────────────────┬────────────────────────────────┘   │
└────────────────────────────┼────────────────────────────────────┘
                             │ HTTP/REST          │ wagmi/viem
                             ▼                    ▼
┌────────────────────────────────────────┐  ┌───────────────────┐
│          RUST BACKEND (Axum)           │  │   Base Sepolia    │
│  ┌──────────┐  ┌──────────┐            │  │                   │
│  │ Session  │  │  Quote   │            │  │ SessionSettlement │
│  │  Store   │  │   API    │            │  │     Contract      │
│  └────┬─────┘  └────┬─────┘            │  │                   │
│       │             │                   │  │   MockUSDC        │
│  ┌────┴─────┐  ┌────┴─────┐            │  │                   │
│  │ Session  │  │  LI.FI   │            │  └───────────────────┘
│  │ Service  │  │ Service  │            │
│  └──────────┘  └────┬─────┘            │
└─────────────────────┼──────────────────┘
                      │
                      ▼
               ┌───────────┐
               │  LI.FI    │
               │   API     │
               └───────────┘
```

### External SDKs & APIs

| Integration | Purpose | Status |
|------------|---------|--------|
| **Yellow Network** | Off-chain session management | ✅ SDK fully integrated |
| **ENS** | Human-readable addresses | ✅ Working (viem) |
| **LI.FI** | Cross-chain routing | ✅ Backend + UI complete |
| **Circle Gateway** | Gasless USDC transfers | Pending |

## Data Flow

1. **Session Creation**
   - User connects wallet in frontend
   - Backend creates Yellow session
   - Session ID returned to frontend

2. **Payment Addition**
   - User enters ENS name + amount
   - Frontend resolves ENS via backend
   - Payment added to session (off-chain)

3. **Cross-Chain (Optional)**
   - User selects source chain
   - Backend fetches LI.FI quote
   - Route executed if needed

4. **Settlement**
   - User triggers "Settle"
   - Backend prepares batch data
   - Smart contract called with settlements
   - USDC transferred to recipients
   - Events emitted for confirmation

## Security Considerations

- All private keys stay in user's wallet
- Backend stores no sensitive data
- Smart contract uses reentrancy guards
- Custom errors prevent information leakage
- Rate limiting on API endpoints
- **Integer overflow protection** in batch calculations
- **Allowance pre-validation** before state changes
- **Transaction confirmation** before proceeding in frontend
- **WebSocket connection guards** prevent duplicate connections
