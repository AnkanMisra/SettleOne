# Arc Continuity evidence

Recorded 2026-09-13. Independent RPC checks, not UI screenshots.

## Product

Human-approved Arc Testnet USDC batches. Code is on `main` via [PR 34](https://github.com/AnkanMisra/SettleOne/pull/34) merge `171a4fe`.

Architecture: `docs/architecture.md`.

## Live deployment

| Item | Value |
| --- | --- |
| Chain | Arc Testnet 5042002 |
| SessionSettlement | `0x178daba1115968e073cff667d276c752b319b019` |
| USDC | `0x3600000000000000000000000000000000000000` (6 decimals) |
| Deploy tx | `0x4c8bbef9de81461b1a6a2eee869d7793e9ae6515f2f5c96f9dc19d21e4a89b6a` |
| Deployer / payer | `0xe9a6ba0f611ef6c934624b52bd3843dfebbb98e6` |
| Runtime keccak | `0x479977b286b051b818d2042202b521b309b9a3c620fae31538a833538e05e468` |

## Live payment

| Item | Value |
| --- | --- |
| Tx | `0x126b478c6ff8332bae2597361816d999da672af1def5e29c78399b0d3b5691b1` |
| Amount | 1 USDC |
| Recipient | `0xd8da6bf26964af9d7eed9e03e53415d37aa96045` |
| Events | USDC Transfer, DraftPayment, DraftSettled |
| `isDraftSettled` | true |
| Explorer | https://testnet.arcscan.app/tx/0x126b478c6ff8332bae2597361816d999da672af1def5e29c78399b0d3b5691b1 |

## Still required for the prize

Human-voice 2–4 minute video. Mainnet by 30 September is a later Arc condition, not done.
