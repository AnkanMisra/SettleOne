# AI disclosure

ETHOnline 2026 requires disclosure of AI-assisted files and how humans directed the work.

## Human-directed inputs

- Strategy PDF recovered from Tailscale: `SettleOne_ETHOnline_2026_Strategy.pdf`
- Continuity plan and access notes in `docs/continuity-plan.md`, `docs/ens-access-notes.md`, `docs/graph-access-notes.md`
- Existing SettleOne stack from HackMoney 2026: Rust/Axum, Next.js, Solidity
- Instruction to stay on `feat/ethonline-2026-continuity`, not commit, not submit, not spend mainnet funds

## AI-assisted work in this event window

Agents (including this Grok Build session) drafted and edited:

- Contract batch settlement and Hardhat tests/scripts
- Backend auth, SQLite sessions, receipt verification, Graph review stub
- Frontend Arc payment flow, ENSv2 helpers, identity and Graph panels
- Status, demo, runbook, and architecture notes

Humans still have to fund wallets, deploy to Arc, send ENS permission transactions, supply a Graph key, host the app, record the video, and submit.

## What AI did not do

- No live testnet spending
- No submission to ETHGlobal
- No fabricated transaction hashes or contract addresses
- No LLM labeled as choosing vendors. There are no LLM credentials in this repo.

## Spec-driven artifacts

Keep these with the submission if the continuity track asks for planning files:

- `docs/continuity-plan.md`
- `docs/ens-access-notes.md`
- `docs/graph-access-notes.md`
- `docs/ethonline-2026-status.md`
