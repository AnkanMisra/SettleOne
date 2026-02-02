# AGENTS.md - SettleOne

Guidelines for AI coding agents working on this cross-chain USDC payment platform.

## Project Overview

SettleOne is a cross-chain, identity-powered, gasless USDC payment platform using:
- **Backend**: Rust (Axum), async/await, modular architecture
- **Frontend**: Next.js 16+, React 19, TypeScript, wagmi/viem, Tailwind CSS
- **Smart Contracts**: Solidity 0.8.20 on Arc testnet (EVM-compatible)
- **Integrations**: Yellow SDK, Circle Gateway, ENS, LI.FI API

## Build/Lint/Test Commands

### Backend (Rust)

```bash
cd backend/

# Check compilation
cargo check

# Build debug
cargo build

# Build release
cargo build --release

# Run development server
cargo run

# Run with logging
RUST_LOG=debug cargo run

# Run tests
cargo test

# Run single test
cargo test test_name

# Run tests with output
cargo test -- --nocapture

# Format code
cargo fmt

# Lint code
cargo clippy

# Lint with fixes
cargo clippy --fix
```

### Frontend (Next.js)

```bash
cd frontend/

# Install dependencies
pnpm install

# Development server
pnpm dev

# Production build
pnpm build

# Linting
pnpm lint

# Type checking (via build)
pnpm build
```

### Smart Contracts (Hardhat)

```bash
cd contracts/

# Compile
pnpm compile

# Run all tests
pnpm test

# Run single test file
pnpm hardhat test test/SessionSettlement.test.ts

# Run with grep pattern
pnpm hardhat test --grep "finalize"

# Gas report
REPORT_GAS=true pnpm test

# Deploy locally
pnpm hardhat run scripts/deploy.ts

# Deploy to network
pnpm hardhat run scripts/deploy.ts --network sepolia
```

## Code Style Guidelines

### Rust

**Formatting**
- Use `rustfmt` defaults (4-space indentation)
- Max line length: 100 characters
- Run `cargo fmt` before committing

**Naming Conventions**
- Modules: `snake_case` (e.g., `session_service.rs`)
- Structs/Enums: `PascalCase` (e.g., `SessionStore`)
- Functions: `snake_case` (e.g., `create_session`)
- Constants: `SCREAMING_SNAKE_CASE`
- Lifetimes: short lowercase (e.g., `'a`, `'ctx`)

**Imports**
```rust
// 1. Standard library
use std::collections::HashMap;
use std::sync::Arc;

// 2. External crates
use axum::{Router, Json};
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;

// 3. Internal modules
use crate::models::Session;
use crate::services::EnsService;
```

**Error Handling**
```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum SessionError {
    #[error("Session not found: {0}")]
    NotFound(String),
    
    #[error("Session already settled")]
    AlreadySettled,
    
    #[error("Invalid amount: {0}")]
    InvalidAmount(String),
}

// Use Result for fallible operations
pub async fn get_session(id: &str) -> Result<Session, SessionError> {
    // ...
}

// Use anyhow for application-level errors
pub async fn run_server() -> anyhow::Result<()> {
    // ...
}
```

**Async Patterns**
```rust
// Prefer async/await over manual futures
pub async fn resolve_ens(name: &str) -> Result<String, EnsError> {
    let client = reqwest::Client::new();
    let response = client.get(url).send().await?;
    // ...
}

// Use Arc<RwLock<T>> for shared state
pub struct AppState {
    sessions: Arc<RwLock<HashMap<String, Session>>>,
}
```

### Solidity

**File Structure**
```
contracts/
├── contracts/
│   ├── SessionSettlement.sol      # Main contract
│   ├── interfaces/
│   │   └── ISessionSettlement.sol # Interface definitions
│   ├── libraries/
│   │   ├── SessionErrors.sol      # Custom errors
│   │   └── SessionTypes.sol       # Type definitions
│   └── mocks/
│       └── MockUSDC.sol           # Test mocks
├── test/
│   └── SessionSettlement.test.ts
└── scripts/
    └── deploy.ts
```

**Style**
- Use custom errors over require strings (gas efficient)
- Use NatSpec comments for all public functions
- Separate concerns into libraries
- Use `@inheritdoc` for interface implementations

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ISessionSettlement} from "./interfaces/ISessionSettlement.sol";
import {SessionErrors} from "./libraries/SessionErrors.sol";

/// @title SessionSettlement
/// @author SettleOne Team
/// @notice Handles final settlement of Yellow Network sessions
contract SessionSettlement is ISessionSettlement {
    /// @inheritdoc ISessionSettlement
    function finalizeSession(
        bytes32 sessionId,
        uint256 amount,
        address recipient
    ) external override {
        if (amount == 0) revert SessionErrors.InvalidAmount();
        // ...
    }
}
```

### TypeScript (Frontend)

**Imports**
```typescript
// 1. React/Next.js
import { useState, useEffect } from 'react';

// 2. External packages
import { useAccount } from 'wagmi';

// 3. Internal (@/ alias)
import { useENS } from '@/hooks/useENS';

// 4. Types
import type { Session } from '@/types';
```

## File Structure

```
SettleOnce/
├── backend/                 # Rust API server
│   ├── src/
│   │   ├── main.rs         # Entry point
│   │   ├── api/            # HTTP handlers
│   │   │   ├── mod.rs
│   │   │   ├── ens.rs
│   │   │   ├── session.rs
│   │   │   └── quote.rs
│   │   ├── services/       # Business logic
│   │   │   ├── mod.rs
│   │   │   ├── ens.rs
│   │   │   ├── session.rs
│   │   │   └── lifi.rs
│   │   ├── models/         # Data structures
│   │   ├── config/         # Configuration
│   │   └── utils/          # Utilities
│   └── Cargo.toml
├── frontend/                # Next.js app
│   └── src/
│       ├── app/
│       ├── components/
│       ├── hooks/
│       ├── lib/
│       └── types/
├── contracts/               # Solidity (Hardhat)
│   ├── contracts/
│   │   ├── SessionSettlement.sol
│   │   ├── interfaces/
│   │   ├── libraries/
│   │   └── mocks/
│   ├── test/
│   └── scripts/
└── docs/
```

## API Endpoints (Rust Backend)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/ens/resolve?name=vitalik.eth` | Resolve ENS name |
| GET | `/api/ens/lookup?address=0x...` | Reverse ENS lookup |
| POST | `/api/session` | Create session |
| GET | `/api/session/:id` | Get session |
| POST | `/api/session/:id/payment` | Add payment |
| POST | `/api/session/:id/finalize` | Finalize session |
| GET | `/api/quote` | Get LI.FI quote |

## Environment Variables

### Backend (.env)
```bash
PORT=3001
ETH_RPC_URL=https://eth.llamarpc.com
ARC_RPC_URL=https://rpc.arc.circle.com
LIFI_API_URL=https://li.quest/v1
LIFI_API_KEY=
YELLOW_API_KEY=
SETTLEMENT_CONTRACT_ADDRESS=
```

### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WALLETCONNECT_ID=
NEXT_PUBLIC_ARC_RPC=
```

Never commit `.env` files. Use `.env.example` as template.
