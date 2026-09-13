# SettleOne architecture (ETHOnline 2026)

Updated 2026-09-13. Pre-event HackMoney notes remain in git history. This page describes the continuity path.

```
Wallet (Arc Testnet)
  -> Next.js app
       -> Rust/Axum API (SQLite sessions, hashed bearer tokens)
       -> Arc RPC for USDC decimals, balances, receipts
       -> SessionSettlement.settleBatch on Arc after human signature
Sepolia client (separate)
  -> ENSv2 Universal Resolver reads and Permissioned Resolver writes
The Graph (optional, server key)
  -> Agent0 subgraph evidence for manual vendor review
```

## Payment state machine

`draft` -> `awaiting_approval` (immutable calldata) -> `submitted` (transaction found, receipt missing) -> `confirmed` or `failed`.

Unknown transaction hashes stay `awaiting_approval`. They do not pin `submitted`.

Edits in `draft` or after `failed` clear the preview. `submitted` and `confirmed` cannot be edited.

## Chains

| Concern | Chain | Notes |
| --- | --- | --- |
| Settlement | Arc Testnet 5042002 | Official USDC `0x3600…0000`, 6 decimals, native gas is the same asset at 18 decimals |
| Identity | Sepolia 11155111 | Resolve current resolver before every write |
| Vendor evidence | Sepolia subgraph | Stale indexes must not authorize payment |

These are separate transactions. The app must not claim atomic cross-chain execution.

## Trust

Wallet personal-sign authenticates API ownership. ERC-20 `approve` and `settleBatch` are the only spending authorizations. The backend never holds a spender key. Graph and ENS data cannot add a recipient or an amount.
