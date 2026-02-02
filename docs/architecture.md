# SettleOne – Architecture Overview

SettleOne is composed of four core layers:

## 1. Frontend (Next.js + React)
- Connects wallet using wagmi/viem with MetaMask
- Resolves ENS names via viem provider
- Displays LI.FI cross-chain quotes
- Opens Yellow Network session and manages payments
- Triggers session finalization via backend API

## 2. Backend (Rust + Axum)
- RESTful API for session management
- ENS resolution service (caches results)
- LI.FI API proxy for cross-chain quotes
- Yellow SDK integration for off-chain state
- Prepares batch settlement data for on-chain call
- Async/await architecture with Tokio runtime

**Tech Stack:**
- Framework: Axum 0.7
- Runtime: Tokio
- HTTP Client: reqwest
- Serialization: serde/serde_json
- Error Handling: thiserror/anyhow

## 3. Smart Contracts (Arc Chain - Solidity)
- **SessionSettlement.sol**: Main settlement contract
- **ISessionSettlement.sol**: Interface definitions
- **SessionErrors.sol**: Custom error library
- **SessionTypes.sol**: Shared type definitions
- **MockUSDC.sol**: Test mock for USDC

**Features:**
- Single and batch settlement support
- Custom errors for gas efficiency
- Reentrancy protection
- Owner-controlled emergency functions
- Event emission for indexing

## 4. External Integrations

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   Next.js Frontend                        │   │
│  │  • MetaMask Wallet Connection                            │   │
│  │  • ENS Input Resolution                                   │   │
│  │  • Payment Session UI                                     │   │
│  └─────────────────────────┬────────────────────────────────┘   │
└────────────────────────────┼────────────────────────────────────┘
                             │ HTTP/REST
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      RUST BACKEND (Axum)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ ENS API  │  │ Session  │  │  Quote   │  │  Health  │        │
│  │ Handler  │  │  API     │  │   API    │  │  Check   │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────────┘        │
│       │             │             │                              │
│  ┌────┴─────┐  ┌────┴─────┐  ┌────┴─────┐                       │
│  │   ENS    │  │ Session  │  │  LI.FI   │                       │
│  │ Service  │  │ Service  │  │ Service  │                       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                       │
└───────┼─────────────┼─────────────┼─────────────────────────────┘
        │             │             │
        ▼             ▼             ▼
┌───────────┐  ┌───────────┐  ┌───────────┐
│ Ethereum  │  │  Yellow   │  │  LI.FI    │
│ Mainnet   │  │  Network  │  │   API     │
│   (ENS)   │  │   SDK     │  │           │
└───────────┘  └─────┬─────┘  └───────────┘
                     │
                     ▼
              ┌───────────┐
              │ Arc Chain │
              │  (USDC)   │
              │ Settlement│
              └───────────┘
```

### External SDKs & APIs

| Integration | Purpose | Rust Crate |
|------------|---------|------------|
| **Yellow Network** | Off-chain session management | TBD |
| **ENS** | Human-readable addresses | alloy (pending) |
| **LI.FI** | Cross-chain routing | reqwest (HTTP) |
| **Circle Gateway** | Gasless USDC transfers | reqwest (HTTP) |

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
