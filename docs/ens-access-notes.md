# ENSv2 access and ETHOnline submission notes

Verified 2026-09-13 at 06:45 UTC against official sources. This is integration research, not evidence of completed onchain transactions.

## Deployment and library

Use a separate Sepolia client, chain ID 11155111, for ENS. ENS documents viem 2.35.0 or later and ENSjs 4.2.3 or later as supporting ENSv2. Normalize names with `normalize` from `viem/ens`. Resolve payout addresses through `getEnsAddress`, which follows the Universal Resolver and handles supported CCIP reads. Use `getEnsResolver` immediately before each write. A payment chain client alone does not resolve Sepolia ENS records. [Library readiness](https://docs.ens.domains/web/ensv2-readiness/), [application integration guide](https://docs.ens.domains/ensv2/tutorial-app-developers/).

The canonical deployment table currently lists:

| Contract | Sepolia address |
| --- | --- |
| Universal Resolver proxy | `0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe` |
| ETH registrar | `0xa88553f454b77203b0d036a05c894d555eaaa2cc` |
| ETH registry | `0xbdc85dd5b15d7ecb354cd7cb6f2c50b4f2c4f0e2` |
| Permissioned Resolver implementation | `0x9eae5c2730a7dd16bdd1dee6421a1b91e3b0365e` |
| Verifiable Factory | `0x10dc6333cdfe1fcef624c6e0a8221b91804cd7ef` |
| MockUSDC for registration | `0x768f42455a2d082e23ceef7d51e5787c82d67a39` |

The implementation address is not the address to write user records to. The name's current resolver is a separate proxy. The table also lists a legacy ENSv1 deployment; do not use that deployment for this demo. [Canonical deployments](https://docs.ens.domains/learn/deployments/).

## Exact narrow permission

Grant the secondary wallet `authorizeTextRoles(dnsName, serviceKey, secondary, true)` on the current resolver. Revoke with the same arguments and `false`. DNS encoding is `toHex(packetToBytes(normalize(name)))`; record setters instead take `namehash(normalize(name))`.

Do not use `authorizeNameRoles` for this requirement: that grants every text key on a name. Do not grant root roles. `ROLE_SET_TEXT` is `1n << 4n`; address editing uses a different role, `1n << 0n`. Root/name-wide grants can still authorize operations after a narrower record grant is revoked. Use a fresh secondary account without broader permissions for a clean demonstration. [Permissioned Resolver](https://docs.ens.domains/ensv2/permissioned-resolver/).

These signatures were checked against the official deployment artifact at commit `97a57293f3b4279d94b571e678edb53ce62638f4`:

```js
const resolverAbi = parseAbi([
  'function authorizeTextRoles(bytes toName,string key,address account,bool grant) returns (bool)',
  'function setText(bytes32 node,string key,string value)',
  'function setAddr(bytes32 node,address addr_)',
  'function setAddr(bytes32 node,uint256 coinType,bytes addressBytes)',
  'function hasRoles(uint256 resource,uint256 roleBitmap,address account) view returns (bool)',
  'function roles(uint256 resource,address account) view returns (uint256)',
]);
```

`parseAbi`, `namehash`, and `toHex` come from `viem`; `normalize` and `packetToBytes` come from `viem/ens`. `hasRoles` alone on one resource does not prove absence of permissions at every broader scope. [Pinned resolver ABI](https://github.com/ensdomains/contracts-v2/blob/97a57293f3b4279d94b571e678edb53ce62638f4/contracts/deployments/sepolia/PermissionedResolverImpl.json).

Recommended demonstration sequence, an implementation/test plan:

1. Owner sets the payout address and service text. Read the address using Sepolia `getEnsAddress` and use that actual result in the payment recipient, with an explicit confirmation before payment.
2. Resolve the current resolver and grant the single service key to the secondary wallet. Wait for the receipt.
3. Secondary resolves the current resolver again, edits that key, waits for confirmation, then reads it using `getEnsText`.
4. From the secondary account, simulate `setAddr`, an alternate text key, and an unrelated name's service key. Require actual authorization reverts, not a disabled button or generic network error. Check both address overloads if claiming all address editing is blocked.
5. Owner freshly resolves the resolver and revokes the grant. After the receipt, simulate the formerly allowed edit from the secondary and require its authorization revert. Read back the payout and service text.
6. Record network, name, resolver, wallet addresses, transaction hashes, and read results. If the resolver changes, re-resolve and explain the new permission state. An old resolver's successful write is not proof that the visible name changed.

## Registering a usable name

The official deployment page links [ENS App](https://app.ens.dev/) and [ENS Explorer](https://explorer.ens.dev/). The CLI is available at [ensdomains/ens-cli](https://github.com/ensdomains/ens-cli), but was not installed in this investigation.

Programmatic registration needs Sepolia ETH for gas, an owner signer, a resolver, and ERC20 registration funds. MockUSDC exposes unrestricted `mint(address,uint256)` and uses six decimals; the app guide suggests `100_000_000n`. Approve the registrar for the queried price. Registration alone does not create a payout record. [Test funds and record setup](https://docs.ens.domains/ensv2/tutorial-app-developers/).

Use `isAvailable(label)`, `MIN_REGISTER_DURATION`, and `getRegisterPrice(label,duration,paymentToken)` before registration. `makeCommitment` takes `(string label,address owner,bytes32 secret,address subregistry,address resolver,uint64 duration,bytes32 referrer)` and returns `bytes32`. Call `commit(bytes32)`, wait for the configured `MIN_COMMITMENT_AGE`, documented as 60 seconds, then reveal with `register(string,address,bytes32,address,address,uint64,address paymentToken,bytes32 referrer)`. Preserve every committed parameter. Check `MAX_COMMITMENT_AGE` rather than assuming a still-valid commitment. [Registrar guide](https://docs.ens.domains/ensv2/eth-registrar/), [pinned registrar ABI](https://github.com/ensdomains/contracts-v2/blob/97a57293f3b4279d94b571e678edb53ce62638f4/contracts/deployments/sepolia/ETHRegistrar.json).

If the owner needs a resolver, the factory exposes `deployProxy(address implementation,uint256 salt,bytes data) returns(address)`. Encode `initialize(address admin,uint256 roleBitmap,bytes[] setters)` for the Permissioned Resolver implementation. The official factory guide provides the `OwnedResolver` salt derivation, full-owner bitmap, and `ProxyDeployed` receipt parsing. Read the deployed proxy from the receipt and pass it to registration. [Factory guide](https://docs.ens.domains/ensv2/verifiable-factory/), [pinned factory ABI](https://github.com/ensdomains/contracts-v2/blob/97a57293f3b4279d94b571e678edb53ce62638f4/contracts/deployments/sepolia/VerifiableFactory.json).

## Live verification limits

Read-only `eth_getCode` requests to PublicNode, rpc.sepolia.org, and sepolia.drpc.org all returned HTTP 403 from this environment. Blockscout address API GET requests also returned HTTP 403. Official GitHub raw deployment artifacts were fetched successfully, and the listed signatures and addresses matched. No funded signer or owned ENS name was supplied to this investigation. No name registration, resolver deployment, record mutation, live payout resolution, or grant/revoke transaction was performed.

## ETHOnline 2026 requirements

The event details page says September 13, 2026 at 12:00 pm EDT: **16:00 UTC / 21:30 IST**. Plan against this page's earlier cutoff even if another listing differs. Submit through the Hacker Dashboard; select up to three partner prizes. Video must be 2–4 minutes, at least 720p, and use a human voice. AI voiceover is prohibited. Document AI-assisted files/assets and how humans contributed. If using a spec-driven workflow, include its prompts, specs, and planning artifacts. [Official event details](https://ethglobal.com/events/ethonline2026/info/details).

SettleOne builds on an existing project, so use an approved Continuity track. Disclose pre-event work in writing to organizers and in the submission's description, video, and repository history. Keep new extensions open source and identify substantive work made during the event. Avoid collapsing work into a single unexplained commit. This investigation did not contact organizers or submit the project. [ETHGlobal rules](https://ethglobal.com/rules).

ENS's Continuity prize is $500 for an existing-project integration on ENSv2 Sepolia, targeting that project's testnet deployment. Functional behavior and open-source code are required, with a video or live demonstration. The $4,500 general ENSv2 pool has a different track context; do not assume Continuity eligibility. Arc's Continuity pool is $3,000, with $2,000 conditional on deploying the same project to Arc mainnet by September 30. Its requirements include working frontend/backend, an architecture diagram, video/presentation, documentation, and repository link. [Official partner prize requirements](https://ethglobal.com/events/ethonline2026/prizes).
