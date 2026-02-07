# SettleOne

**Send USDC anywhere, settle once.**

**Last Updated**: February 8, 2026 (Session 8)

SettleOne is a cross-chain, identity-powered USDC payment platform built for ETHGlobal HackMoney 2026. It enables users to send and receive stablecoins using ENS names, route funds across multiple chains, and execute all actions off-chain in real-time using Yellow Network — with a single final settlement on-chain via Base Sepolia.

## What Problem It Solves

Today's DeFi ecosystem struggles with:
- High gas fees for small or frequent payments
- Fragmented user experience across chains
- Poor identity UX using 0x addresses

SettleOne fixes this by combining off-chain state channels, stablecoin infrastructure, and cross-chain routing into a single, seamless flow.

## Core Features

- **ENS-Powered Payments**: Send USDC to `name.eth` instead of long addresses. Resolved on both frontend (viem) and backend (ensdata.net API with caching).
- **Session-Based UX**: Users transact instantly off-chain during a session using Yellow Network state channels.
- **Cross-Chain Routing**: Payments can bridge from any EVM chain to another via LI.FI.
- **Final On-Chain Settlement**: All activity settles securely in one batch transaction on Base.
- **Toast Notifications**: Clickable toast opens the correct block explorer per chain.
- **Security Hardened**: Reentrancy guards, overflow protection, allowance pre-validation, tx confirmation waiting.

## Sponsor Tracks Covered

| Track | Integration | Status |
|-------|------------|--------|
| **Yellow Network** | Off-chain payments via `@erc7824/nitrolite` state channels | 100% Complete |
| **Circle / Arc** | USDC settlement on Base Sepolia | 100% Complete |
| **ENS** | Name resolution for payments (frontend viem + backend ensdata.net) | 100% Complete |
| **LI.FI** | Cross-chain quote routing with fee breakdown UI | 100% Complete |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS v4, wagmi 3, viem, RainbowKit, react-hot-toast |
| **Backend** | Rust, Axum 0.7, Tokio, reqwest, serde, thiserror/anyhow |
| **Contracts** | Solidity 0.8.20, Hardhat, OpenZeppelin v5 |
| **Off-Chain** | Yellow Network (`@erc7824/nitrolite`), ClearNode WebSocket |
| **Cross-Chain** | LI.FI API (`li.quest/v1`) |
| **Identity** | ENS (viem mainnet client + ensdata.net API) |

## How It Works

1. User connects wallet and starts a session.
2. Inputs recipient's ENS name and amount in USDC.
3. Yellow SDK opens a state channel and handles real-time, off-chain transactions.
4. LI.FI handles routing if payment needs to cross chains.
5. When the session ends, user triggers "Settle" — a smart contract on Base finalizes all balances in one batch transaction.

## Project Status: ~97% Complete

| Component | Status |
|-----------|--------|
| Smart Contracts | 100% — Deployed + security hardened + 27 tests |
| Frontend | 95% — Full UI + toast + clickable explorer |
| Backend | 90% — Real ENS, 20 tests, shared EnsService singleton |
| SDK Integration | 90% — Yellow, LI.FI, ENS all complete |
| Testing & QA | 70% — 47 total tests (27 contract + 20 backend) |
| Documentation | 95% — 8 docs files + comprehensive README |
| Deployment | 80% — Contracts on Base Sepolia |

## Code Review Scores

- **Greptile PR #13** (Yellow SDK): 5/5 — "Production-ready for hackathon scope"
- **Greptile PR #14** (Backend polish): 4.5/5 — "No blocking issues. Safe to merge."

## Future Extensions

- Telegram or mobile plugin for DAO payments
- Multi-user streaming payments with ENS
- Optional Sui and Solana chain support
- SDK for developers to plug SettleOne into other dApps
- ENS subgraph integration via Graph Studio/Decentralized Network

Built at ETHGlobal HackMoney 2026 — for a faster, simpler future in DeFi.
