# SettleOne Agent Guidelines

## Commands & Verification
- **Rust (Backend)**: `cd backend`. Check: `cargo check`. Test: `cargo test` or `cargo test test_name`.
  - *Pre-commit*: `cargo fmt --check && cargo clippy -- -D warnings && cargo test`
- **Frontend**: `cd frontend`. Dev: `pnpm dev`. Validate: `pnpm lint && pnpm build` (Types/Lint).
- **Contracts**: `cd contracts`. Compile: `pnpm compile`.
  - Test: `pnpm test` or `npx hardhat test --grep "pattern"` (e.g. `finalize`).
  - Deploy: `pnpm deploy:base-sepolia` or `pnpm deploy:sepolia` or `pnpm deploy:base`.

## Code Style & Standards
- **General**: No PRs. Commit with `feat:`/`fix:` only when asked. Absolute paths. No `.env`.
- **Rust**: `snake_case` (mod/fn), `PascalCase` (struct). Use `thiserror` for libs, `anyhow` for binaries.
  - Pattern: `api/` (handlers) -> `services/` (logic) -> `models/` (structs).
  - State: Use `State<AppState>` extractor for shared state in handlers.
- **Solidity**: Custom errors (gas efficient). NatSpec on public/external. `contracts/interfaces`.
- **TypeScript**: React 19/Next.js 16. `wagmi` for Web3. `@/` imports. `pnpm` for pkg mgmt.
  - Hooks: `useSettlement` for on-chain TX, `useSession` for API, `useENS` for resolution.

## Project Context
- **SettleOne**: Cross-chain USDC payments via Yellow Network & Circle Arc.
- **Stack**: Rust (Axum), Next.js (Tailwind), Solidity (Hardhat).
- **Deployed**: Base Sepolia - `0xe66B3Fa5F2b84df7CbD288EB3BC91feE48a90cB2`
