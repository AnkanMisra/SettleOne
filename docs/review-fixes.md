# Independent review fixes

These changes follow independent review of PR 34 at `5ab930b`.

- Contract adoption requires `SETTLEMENT_ADMIN` to match the authenticated wallet and onchain owner. Preparation validates the exact Solidity 0.8.20 / optimizer-200 runtime with the Arc USDC immutable. The existing Arc deployment remains compatible. A future contract version requires explicitly updating the approved runtime hash after verification.
- Before the wallet settlement prompt, the server atomically locks the exact approved draft as `signing`. A second tab cannot sign, edit or reset it while executable. The hash is reconciled immediately after broadcast and again after inclusion.
- If signing is rejected or interrupted, refresh the saved session. A signing lock can be reset only after Arc's latest block timestamp exceeds the draft expiry and `isDraftSettled` is false. If it settled, reconcile its original transaction. This conservative recovery can require waiting up to 15 minutes; it does not assume that closing a wallet prompt cancels a signed transaction.
- ENS results are tied to the exact current input. Simulation infrastructure failures are no longer reported as permission-denial evidence.
- Docker uses the real Arc RPC, externally reachable container binding, a writable `/data` directory and a named data volume. Browser API configuration uses localhost only for local Docker; set `NEXT_PUBLIC_API_URL` to a reachable HTTPS endpoint remotely. Railway still requires an explicitly provisioned persistent volume and `DATABASE_PATH`/`ARC_SETTLEMENT_PATH` pointing into it.
- Graph review rejects future timestamps, indexing errors and absent service endpoints. This remains deterministic evidence review, not an AI assistant or proof of completed work.

## Deployment configuration

Set `ARC_SETTLEMENT_ADDRESS=0x178daba1115968e073cff667d276c752b319b019` for the existing deployment. `SETTLEMENT_ADMIN` is a public wallet address, not a private key; it is needed only for the authenticated contract-registration route. The current deployment's owner is `0xe9a6ba0f611ef6c934624b52bd3843dfebbb98e6`.

Deploy frontend and backend together and reload open browser tabs for the signing-lock protocol. Do not downgrade a running backend while `signing` sessions exist. Preserve the SQLite database and contract configuration file across deployments. Do not reset an old, unreconciled payment from a previously running client; reconcile its transaction first.

No new testnet payment, ENS permission transaction, mainnet transaction, public deployment or submission is claimed by these fixes.
