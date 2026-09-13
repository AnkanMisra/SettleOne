# ETHOnline 2026 status

Checked 2026-09-13. This file is the honest record for the continuity track. It does not invent addresses, hashes, hosting URLs, or recordings.

## What is implemented and locally tested

- Solidity `settleBatch(bytes32 draftId, Settlement[] settlements, uint256 totalLimit, uint256 expiresAt)` with payer-scoped replay protection, expiry, total limit, bounded batches, and atomic transfers.
- Events `DraftPayment` and `DraftSettled`, plus `isDraftSettled(address,bytes32)`.
- Contract tests: `pnpm test` in `contracts` previously passed 36 tests, including replay, expiry, limit, overflow, and rollback.
- Rust backend: wallet sign-in, SQLite sessions, positive integer amounts, budget checks, prepared immutable calldata, receipt verification, unknown-hash rejection.
- Backend tests this session: `cargo test --manifest-path backend/Cargo.toml` 23 passed, including unknown-hash, mempool pin, revert, route coverage, and Graph-without-key.
- Frontend payment path is Arc-only: sign-in, draft, exact preview, separate prepare vs approve/sign, receipt verify, retained local hash.
- Frontend `tsc --noEmit` passed. Local `GET /` returned 200. Local `/health` returned ok. `/api/graph/review` returned 503 without a key. Homepage HTML does not include Yellow, gasless, LI.FI, or state-channel claims.

## Live Arc Testnet evidence (verified 2026-09-13 09:22 UTC)

- SessionSettlement: `0x178daba1115968e073cff667d276c752b319b019`
- Deploy tx: `0x4c8bbef9de81461b1a6a2eee869d7793e9ae6515f2f5c96f9dc19d21e4a89b6a`
- Deployer: `0xe9a6ba0f611ef6c934624b52bd3843dfebbb98e6`
- Block 61876484, chain 5042002, receipt status success, bytecode present
- `usdc()` returns official Arc USDC `0x3600000000000000000000000000000000000000`
- Explorer: https://testnet.arcscan.app/address/0x178daba1115968e073cff667d276c752b319b019
- Backend `GET /api/settlement/contract` returns this address
- Funded `settleBatch` proof (verified 2026-09-13):
  - Session `17d4220c-2f95-4576-af73-f3b5cbd4a0ef` status confirmed
  - Tx `0x126b478c6ff8332bae2597361816d999da672af1def5e29c78399b0d3b5691b1`
  - Payer `0xe9a6ba0f611ef6c934624b52bd3843dfebbb98e6`
  - Recipient `0xd8da6bf26964af9d7eed9e03e53415d37aa96045` (UI label vitalik.eth)
  - Amount 1 USDC, `DraftPayment` + `DraftSettled`, USDC Transfer, `isDraftSettled` true
  - Explorer https://testnet.arcscan.app/tx/0x126b478c6ff8332bae2597361816d999da672af1def5e29c78399b0d3b5691b1

## What is written but not live

- ENSv2 Sepolia helpers and a grant/edit/revoke UI exist. No permission transactions have been sent.
- Graph review endpoint exists. Without `GRAPH_API_KEY` it returns 503. A March 2026 index was observed earlier and is treated as stale.

## Still blocked

Sepolia ENS name access, Graph key, LLM key, public hosting URL, and demo recording. Do not paste secrets into chat. Use `docs/runbook-live-demo.md`.

## Do not claim

- Yellow Network as part of the 2026 critical payment path
- Gasless payments
- Atomic cross-chain ENS + Arc execution
- AI choosing payees or amounts
- Live Graph eligibility from a March 2026 index
