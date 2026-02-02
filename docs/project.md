# SettleOne

**Send USDC anywhere, settle once.**

SettleOne is a cross-chain, identity-powered, gasless USDC payment platform built for ETHGlobal HackMoney 2026. It enables users to send and receive stablecoins using ENS names, route funds across multiple chains, and execute all actions off-chain in real-time using Yellow Network — with a single final settlement on-chain via Circle’s Arc chain.

## 🔍 What Problem It Solves

Today’s DeFi ecosystem struggles with:
- High gas fees for small or frequent payments
- Fragmented user experience across chains
- Poor identity UX using 0x addresses

SettleOne fixes this by combining off-chain state channels, stablecoin infrastructure, and cross-chain routing into a single, seamless flow.

## 🧠 Core Features

- **ENS-Powered Payments**: Send USDC to `name.eth` instead of long addresses.
- **Session-Based UX**: Users transact instantly off-chain during a session using Yellow Network.
- **Cross-Chain Routing**: Payments can bridge from any EVM chain to another via LI.FI.
- **Final On-Chain Settlement**: All activity settles securely in one transaction via Arc + USDC.
- **Gasless Design**: Circle’s programmable wallets allow gas fees to be covered in USDC.

## 🏆 Sponsor Tracks Covered

- **Yellow Network**: Off-chain micro-payments and session-based settlement.
- **Circle / Arc**: USDC-focused app using Arc smart contracts and Circle Gateway.
- **ENS**: Creative use of ENS names for identity and payment routing.
- **LI.FI**: Cross-chain transfers and liquidity routing via LI.FI SDK.

## ⚙️ Tech Stack

- **Frontend**: Next.js, React, ethers.js, Tailwind CSS
- **Smart Contracts**: Solidity (Arc testnet)
- **Backend**: Next.js API routes; optional Rust microservice for session logic
- **Integrations**: Yellow SDK, Circle Gateway, ENS via ethers.js, LI.FI SDK

## 🧪 How It Works

1. User connects wallet and starts a session.
2. Inputs recipient’s ENS name and amount in USDC.
3. Yellow SDK opens a session and handles real-time, off-chain transactions.
4. LI.FI handles routing if payment needs to cross chains.
5. When the session ends, user triggers “Settle” — a smart contract on Arc finalizes balances.
6. Funds arrive securely, all with one gas-efficient transaction.

## 📦 Submission Deliverables

- Live frontend (ENS resolution, wallet connect, USDC transfer UI)
- Arc-deployed contract handling settlement
- Yellow session flow (start → transact → settle)
- ENS integration demo
- Cross-chain logic using LI.FI
- Demo video (2–3 minutes)
- Architecture diagram
- Open-source GitHub repository with README and setup guide

## 🚀 Future Extensions

- Telegram or mobile plugin for DAO payments
- Multi-user streaming payments with ENS
- Optional Sui and Solana chain support
- SDK for developers to plug SettleOne into other dApps

Built at ETHGlobal HackMoney 2026 — for a faster, simpler, gasless future in DeFi.
