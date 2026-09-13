# ETHOnline 2026 sponsor notes

HackMoney 2026 sponsor claims in `docs/sponsor-integration.md` are historical. Use this page for the current event.

## Arc (priority)

Working frontend and backend exist locally. Arc Testnet SessionSettlement is deployed at `0x178daba1115968e073cff667d276c752b319b019`. A funded `settleBatch` of 1 USDC is confirmed in tx `0x126b478c6ff8332bae2597361816d999da672af1def5e29c78399b0d3b5691b1` with `DraftPayment`, `DraftSettled`, and `isDraftSettled` true. Continuity mainnet-by-September-30 is not started. Architecture diagram: `docs/architecture.md`.

## ENSv2 (priority)

Code uses the official Sepolia Universal Resolver `0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe` and `authorizeTextRoles` for `service.metadata` only. No name is owned in this environment. No grant, text update, or revoke transaction exists. Do not submit ENS Continuity until those receipts exist.

## The Graph / Agent0 (priority)

Official Sepolia subgraph id `6wQRC7geo9XYAhckfmfo8kbMRLeWU8KQd3XsJqFKmZLT`. Server requires `GRAPH_API_KEY`. A research probe on 2026-09-13 saw live data with index timestamp 2026-03-04, which is stale. The app refuses to treat that as current eligibility. No LLM is wired. Deterministic filters are not labeled AI.

## Yellow

Still in the old frontend tree (`useYellow.ts`, `@erc7824/nitrolite`). It is not on the 2026 critical payment UI. Do not list Yellow as a current prize unless that path is restored and demonstrated.

## Submission

Cutoff 16:00 UTC on 13 September 2026. Continuity track. Disclose pre-event work. Human-voiced 2-4 minute video. This agent must not submit.
