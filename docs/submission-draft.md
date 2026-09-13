# ETHOnline 2026 submission draft

Do not submit this until the demo video exists. Arc Testnet receipts already exist. Add ENS only after grant/revoke hashes exist.

## Title

SettleOne: human-approved contractor payments on Arc

## Short description

SettleOne is an existing payments app. For ETHOnline 2026 we added wallet-owned drafts, an exact Arc USDC batch with expiry and replay protection, and separate Sepolia ENSv2 identity controls. A person still approves every recipient and amount. The wallet is the only spender.

## Long description

Pre-event: HackMoney 2026 SettleOne on Base Sepolia with Yellow and ENS v1-era resolution.

During the event: payer-scoped `settleBatch`, SQLite-backed authenticated drafts, immutable calldata preview, receipt and event verification, Arc Testnet configuration, ENSv2 permission helpers, and a Graph review endpoint that will not pay from stale data.

Done during the event: Arc Testnet contract `0x178daba1115968e073cff667d276c752b319b019` and funded batch `0x126b478c6ff8332bae2597361816d999da672af1def5e29c78399b0d3b5691b1`. See `docs/sponsor-notes.md`.

Not done: ENS grant/revoke hashes, Graph key, public hosting URL, video.

## Links to fill later

- Repo: https://github.com/AnkanMisra/SettleOne/pull/34
- Demo video:
- Live URL:
- Arc contract:
- Arc settlement tx:
- ENS grant tx:
- ENS revoke tx:

## Prize selection (at most three)

1. Arc Continuity
2. ENSv2 Continuity, only after live Sepolia permission receipts
3. The Graph / Agent0, only after a fresh project-owned query affects a manual include/exclude decision
