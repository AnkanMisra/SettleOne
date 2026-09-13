# Live demo runbook

Do not paste private keys, Graph keys, or LLM keys into chat. Export them in the local shell or a gitignored env file.

Official cutoff: 13 September 2026, 16:00 UTC.

## 1. Funded Arc wallet

1. Add Arc Testnet in the wallet. Chain ID `5042002`. RPC `https://rpc.testnet.arc.network`. Explorer `https://testnet.arcscan.app`.
2. Get test USDC from https://faucet.circle.com . Native gas and ERC-20 USDC share the same asset. ERC-20 address `0x3600000000000000000000000000000000000000`, 6 decimals.
3. From `contracts`:

```bash
export PRIVATE_KEY=...          # funded Arc test wallet, never commit
pnpm exec hardhat run scripts/deploy.ts --network arc
export ARC_SETTLEMENT_ADDRESS=...  # printed by deploy, never invent
pnpm exec hardhat run scripts/prove-arc.ts --network arc
```

4. Point the backend at that address:

```bash
export ARC_RPC_URL=https://rpc.testnet.arc.network
export ARC_SETTLEMENT_ADDRESS=0x...
export DATABASE_PATH=settleone.sqlite
export APP_ORIGIN=http://localhost:3000
cargo run --manifest-path backend/Cargo.toml
```

5. Frontend: `cd frontend && ./node_modules/.bin/next dev`. Set `NEXT_PUBLIC_API_URL` if the API is not on `http://localhost:3001`.

## 2. ENSv2 Sepolia

1. Owner wallet with a Sepolia name, plus a fresh secondary wallet with no broad grants.
2. Use the Identity panel, or a viem script, in this order: resolve current resolver, grant `service.metadata` only, secondary text update, simulate `setAddr` revert, revoke, simulate text revert.
3. Record name, resolver, both addresses, hashes, and readbacks. Identity writes are Sepolia. Payments stay on Arc.

## 3. Graph

```bash
export GRAPH_API_KEY=...        # project-owned Studio key
export GRAPH_SUBGRAPH_ID=6wQRC7geo9XYAhckfmfo8kbMRLeWU8KQd3XsJqFKmZLT
```

Restart the backend. Open Vendor evidence. If `_meta.block.timestamp` is older than 7 days, do not include those agents. Type amounts by hand.

## 4. Hosting and recording

Deploy frontend and backend only after the Arc contract address is real. Put that address in the demo description. Record 2-4 minutes with a human voice.

## 5. Submission

Continuity track. Disclose pre-event HackMoney work. Select at most three partner prizes. Do not submit from this agent session.
