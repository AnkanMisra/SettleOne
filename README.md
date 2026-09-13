# SettleOne

Prepare contractor payments as a draft, approve the exact list, then settle one Arc Testnet USDC batch. A person types every amount. The wallet is the only spender.

Live app: [settleone.vercel.app](https://settleone.vercel.app)

## What it does

You sign in with a personal-sign message. That authenticates the draft. It does not move funds.

You add recipients and amounts under a budget. Prepare locks an immutable `settleBatch` preview: recipients, amounts, Arc Testnet, official USDC, expiry, total. You tick that the preview is correct, approve USDC, and sign the batch.

The backend checks the Arc receipt: payer, contract, calldata, USDC `Transfer`, `DraftPayment`, `DraftSettled`. An unknown hash cannot mark the draft submitted.

Identity writes stay on Sepolia. Payments stay on Arc. Those are separate transactions.

## Live Arc Testnet

| Item | Value |
| --- | --- |
| Chain | Arc Testnet, id `5042002` |
| SessionSettlement | [`0x178daba1115968e073cff667d276c752b319b019`](https://testnet.arcscan.app/address/0x178daba1115968e073cff667d276c752b319b019) |
| USDC | `0x3600000000000000000000000000000000000000` (6 decimals) |
| Deploy | [`0x4c8bbef9de81461b1a6a2eee869d7793e9ae6515f2f5c96f9dc19d21e4a89b6a`](https://testnet.arcscan.app/tx/0x4c8bbef9de81461b1a6a2eee869d7793e9ae6515f2f5c96f9dc19d21e4a89b6a) |
| 1 USDC batch | [`0x126b478c6ff8332bae2597361816d999da672af1def5e29c78399b0d3b5691b1`](https://testnet.arcscan.app/tx/0x126b478c6ff8332bae2597361816d999da672af1def5e29c78399b0d3b5691b1) |

Gas on Arc is USDC. Fund the payer at the [Circle faucet](https://faucet.circle.com/). Pick Arc Testnet.

## How a batch moves

1. Connect on Arc Testnet.
2. Sign in and create a draft with a budget.
3. Add payments. Optional: resolve a Sepolia ENS name to a pinned address.
4. Prepare the exact preview.
5. Approve the preview, then USDC allowance, then `settleBatch`.
6. The API verifies the receipt and events.

States: `draft` → `awaiting_approval` → `signing` → `submitted` → `confirmed` or `failed`.

A second tab cannot sign the same draft. Reset of a locked draft waits until expiry and `isDraftSettled` is false.

## Stack

| Layer | Tech |
| --- | --- |
| App | Next.js, React, TypeScript, wagmi, viem |
| API | Rust, Axum, SQLite |
| Contract | Solidity 0.8.20, Hardhat, `settleBatch` |

## Run it

Docker:

```bash
git clone https://github.com/AnkanMisra/SettleOne.git
cd SettleOne
cp .env.docker.example .env.docker
docker compose up --build
```

App: `http://localhost:3000`. API: `http://localhost:3001`.

Set `ARC_SETTLEMENT_ADDRESS=0x178daba1115968e073cff667d276c752b319b019` and `SETTLEMENT_ADMIN` to the contract owner. `SETTLEMENT_ADMIN` is a public address, not a private key.

Manual:

```bash
# API
cd backend
DATABASE_PATH=settleone.sqlite ARC_RPC_URL=https://rpc.testnet.arc.network \
  ARC_SETTLEMENT_ADDRESS=0x178daba1115968e073cff667d276c752b319b019 \
  cargo run

# App
cd frontend
NEXT_PUBLIC_API_URL=http://localhost:3001 ./node_modules/.bin/next dev
```

More Docker detail is in [`docs/docker.md`](docs/docker.md).

## Tests

```bash
cargo test --manifest-path backend/Cargo.toml
cd contracts && ./node_modules/.bin/hardhat test test/DraftSettlement.test.ts
cd frontend && ./node_modules/.bin/tsc --noEmit
```

## Repo layout

```
frontend/    Next.js app
backend/     Axum API and SQLite
contracts/   SessionSettlement and Hardhat tests
docs/        evidence, architecture, sponsor notes
```
