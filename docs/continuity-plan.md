# ETHOnline 2026 implementation checklist

Started: 2026-09-13 06:40:15 UTC. Six-hour delivery target: 12:40:15 UTC (18:10:15 IST).
Official event submission cutoff: September 13 16:00 UTC (21:30 IST), confirmed from https://ethglobal.com/events/ethonline2026/info/details . The earlier six-hour target governs this work.

Baseline: `6587bbecdc9fec8f29d49f554d4918a917cac2ac`, clean `main` at inspection; prior commit dated February 25, 2026. No commits or PRs without request. Existing stack stays Rust/Axum, Next.js/TypeScript, Solidity. No mainnet spending, relayers or autonomous spending keys.

Strategy read: `/home/ankanmisra/Downloads/from-mac/SettleOne_ETHOnline_2026_Strategy.pdf`, 10 pages, received through Taildrop. Its proposals are not verification evidence.

## Design

Keep the existing app and contract. Add a constrained payer-scoped batch operation. Rust authenticates wallet ownership with single-use expiring signed challenges, persists sessions and transaction state in SQLite, freezes an exact draft before signing, and checks chain/transaction/calldata/events before confirming. Human wallet signatures authorize all token approvals and payments. ENSv2 Sepolia resolves payment identities separately from Arc settlement. Live Graph data informs vendor selection only; approved amounts remain deterministic inputs.

## Milestones and gates

- [x] 07:00 UTC: baseline checks, prerequisite inventory, official sources. Code starts within 20 minutes.
- [x] 08:20 UTC: constrained Arc contract, backend ownership/persistence/receipt verification, working preview. Real Arc batch still blocked on credentials. Contract tests include invalid/replay/expiry cases.
- [ ] 09:30 UTC: ENSv2 helpers and UI exist. Live grant/edit/revoke still blocked on Sepolia name access.
- [ ] 10:40 UTC: Graph review endpoint exists and refuses missing keys and stale indexes. No project Graph key, so no live inclusion demo. No LLM.
- [ ] 11:10 UTC: local page load verified. Wallet click-through, recovery, and duplicate/revert still need a browser wallet.
- [ ] 12:40 UTC: status, sponsor notes, architecture, demo script, runbook, AI disclosure written. No hosting URL or recording.

## Files and verification

1. `contracts/contracts/SessionSettlement.sol`, interface, tests and scripts: `settleBatch(draftId,settlements,totalLimit,expiresAt)`, payer scoped replay and typed events. `pnpm test`, `pnpm compile`, actual Arc evidence script where credentials permit.
2. `backend/src/models/session.rs`, session API/service plus auth and receipt modules: validated integer units, ownership, SQLite transactions, immutable prepared drafts and verified finalization. Focused negative tests plus `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test`.
3. Existing frontend hooks, app and payment components: Arc only critical flow, exact approval preview, receipt/rejection recovery, saved sessions. `pnpm lint`, `pnpm build`, browser verification.
4. ENS and Graph narrow modules following official ABI/schema: real provider probes, tests against malformed or missing evidence; capture actual source network and retrieval time.
5. README and `docs/`: accurate implemented/verified/blocked evidence, runnable commands and human actions. No invented addresses, hashes, deployment URLs or demo recordings.

## Initial findings

Arc network and token placeholders; current deploy script substitutes MockUSDC on several testnets. Session mutation endpoints have no authentication; state uses an in-memory HashMap; arbitrary hashes can set pending state. Frontend receipt waiting does not reject status=reverted. Legacy Yellow and LI.FI remain outside the critical demo path.

## Prerequisites

No relevant credentials in process environment or project local environment files at inspection. Public Arc RPC available to probe. Funded wallets, ENSv2 name access, Graph key, LLM access and hosting credentials requested together. Never record secrets here.
