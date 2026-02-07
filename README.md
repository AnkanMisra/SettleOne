# SettleOne

**Send USDC anywhere, settle once.**

A cross-chain, identity-powered, gasless USDC payment platform built for ETHGlobal HackMoney 2026. Send payments using ENS names with session-based off-chain execution and single on-chain settlement.

## The Problem

Today's DeFi ecosystem struggles with high gas fees for small or frequent payments, fragmented user experience across chains, and poor identity UX using raw `0x` addresses. SettleOne fixes this by combining off-chain state channels, stablecoin infrastructure, and cross-chain routing into a single, seamless flow.

## Features

- **ENS-Powered Payments** — Send USDC to `name.eth` instead of long hex addresses
- **Session-Based UX** — Batch multiple payments off-chain, settle once on-chain
- **Yellow Network Integration** — Instant off-chain payments via state channels (`@erc7824/nitrolite`)
- **Cross-Chain Routing** — Bridge from any EVM chain via LI.FI
- **On-Chain Settlement** — Batch settlement on Base via smart contracts
- **Circle Arc** — USDC-focused settlement infrastructure

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                       USER BROWSER                            │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                 Next.js Frontend                        │  │
│  │  • MetaMask Wallet Connection (wagmi/viem)             │  │
│  │  • ENS Name Resolution                                  │  │
│  │  • Yellow Network SDK (off-chain payments)             │  │
│  │  • On-chain Settlement (useSettlement hook)            │  │
│  └──────────────┬──────────────────────┬──────────────────┘  │
└─────────────────┼──────────────────────┼─────────────────────┘
                  │ HTTP/REST            │ wagmi/viem
                  ▼                      ▼
┌─────────────────────────────┐  ┌─────────────────────────┐
│     RUST BACKEND (Axum)     │  │      Base Sepolia        │
│  • Session Management       │  │                          │
│  • ENS Resolution Service   │  │  SessionSettlement.sol   │
│  • LI.FI Quote Proxy        │  │  MockUSDC.sol            │
└──────────────┬──────────────┘  └─────────────────────────┘
               │
               ▼
        ┌─────────────┐
        │  LI.FI API   │
        └─────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 19, Tailwind CSS, wagmi, viem, RainbowKit |
| **Backend** | Rust, Axum 0.7, Tokio, reqwest, serde |
| **Contracts** | Solidity, Hardhat, OpenZeppelin |
| **Integrations** | Yellow Network SDK, Circle Arc, ENS, LI.FI |

## Sponsor Tracks

| Sponsor | Integration | Status |
|---------|------------|--------|
| **Yellow Network** | Off-chain payments via `@erc7824/nitrolite` state channels | Complete |
| **Circle / Arc** | USDC settlement on Base Sepolia | Complete |
| **ENS** | Name resolution for payments (forward + reverse lookup) | Complete |
| **LI.FI** | Cross-chain quote routing | Complete |

## Deployed Contracts (Base Sepolia)

| Contract | Address |
|----------|---------|
| SessionSettlement | `0xe66B3Fa5F2b84df7CbD288EB3BC91feE48a90cB2` |
| MockUSDC | `0xc5c8977491c2dc822F4f738356ec0231F7100f52` |

## Getting Started

### Prerequisites

- Node.js 18+
- Rust 1.75+
- pnpm

### Frontend

```bash
cd frontend
pnpm install
pnpm dev
# Opens http://localhost:3000
```

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your RPC URL and API keys
cargo run
# Starts on http://localhost:3001
```

### Smart Contracts

```bash
cd contracts
pnpm install
pnpm compile
pnpm test
```

### Environment Variables

#### Backend (`backend/.env`)
```
PORT=3001
ETH_RPC_URL=https://eth.llamarpc.com
LIFI_API_URL=https://li.quest/v1
LIFI_API_KEY=your_key_here
```

#### Frontend (`frontend/.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
```

## How It Works

1. **Connect Wallet** — User connects MetaMask via RainbowKit
2. **Start Session** — Creates a payment session + connects to Yellow Network
3. **Add Payments** — Enter ENS name + amount; instant off-chain via state channels
4. **Cross-Chain** (optional) — LI.FI routes if payment crosses chains
5. **Settle Once** — One on-chain transaction settles all payments via the smart contract

## Project Structure

```
SettleOne/
├── frontend/          # Next.js 16 + React 19 frontend
│   ├── src/
│   │   ├── app/       # Pages and layout
│   │   ├── components/# UI components
│   │   ├── hooks/     # React hooks (useSession, useSettlement, useYellow, useENS)
│   │   ├── lib/       # API client, contracts, wagmi config, Yellow SDK
│   │   └── types/     # TypeScript types
├── backend/           # Rust + Axum REST API
│   └── src/
│       ├── api/       # Route handlers (session, ENS, quote)
│       ├── services/  # Business logic (ENS resolution, LI.FI, sessions)
│       ├── models/    # Data models
│       └── main.rs    # Entry point
├── contracts/         # Solidity smart contracts
│   ├── contracts/     # SessionSettlement + libraries
│   ├── scripts/       # Deploy scripts
│   └── test/          # Hardhat tests
└── docs/              # Architecture and design docs
```

## License

Built for ETHGlobal HackMoney 2026.
