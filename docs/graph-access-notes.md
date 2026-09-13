# Agent0 Graph access investigation

Checked 2026-09-13 at approximately 06:46 UTC, and re-probed at 13:02 UTC. Live Ethereum Sepolia Graph queries still succeed. The index is still stale: latest block timestamp 2026-03-04T22:00:00Z (about 193 days old). This proves provider access and real indexed records. It does not prove current agent eligibility. Inclusion is forced to `exclude` while stale. Amounts are never taken from Graph.

## Access and deployment

Use a project-owned Subgraph Studio API key on the server. The official endpoint without authorization returns HTTP 200 with `errors: [{message: "auth error: missing authorization header"}]`; checking HTTP status alone is insufficient. The [official Agent0 quick start](https://thegraph.com/docs/en/subgraphs/existing-subgraphs/agent0/) describes key creation and endpoint selection.

| Network | Chain ID | Subgraph ID |
| --- | --- | --- |
| Ethereum Sepolia | 11155111 | `6wQRC7geo9XYAhckfmfo8kbMRLeWU8KQd3XsJqFKmZLT` |
| Base Sepolia | 84532 | `4yYAvQLFjBhBtdRCY7eUWo181VNoTSLLFd5M7FXQAi6u` |

Authenticated URL format: `https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>`.

For the bounded read-only investigation, the [Agent0 SDK test configuration](https://github.com/agent0lab/agent0-ts/blob/main/tests/config.ts) publishes a default Sepolia query endpoint. That endpoint answered successfully. Its shared credential is deliberately omitted here and must not become an application default. The same credential returned `auth error: subgraph not authorized by user` for Base Sepolia. Obtain an API key authorized for the selected subgraph. No wallet, deploy key, or contract write is required to query it.

Observed Sepolia `_meta`:

```json
{
  "deployment": "QmNpJgsKoMFGjDTYMo193T562LCdAxjkDJKXrjFtcoKMHb",
  "block": {
    "number": 10385284,
    "hash": "0xef14b48014b421a3c4dc01154a9b71c12f29e0e2f69657e7f85af37e475b02b2",
    "timestamp": 1772661600
  },
  "hasIndexingErrors": false
}
```

The block timestamp is `2026-03-04T22:00:00Z`. `hasIndexingErrors: false` does not establish freshness. A subgraph ID identifies a published subgraph; `_meta.deployment` identifies the deployment that actually answered.

## Two observed agents with different evidence

Both records came from the live provider response, not fixtures. Neither is a recommended payment recipient.

| Field | Pinata MCP | CREsolver Gamma |
| --- | --- | --- |
| Entity ID | `11155111:1073` | `11155111:1301` |
| Agent wallet | `0xbc03df2d9f44cc552ebbff39860f2cc4fc751d0e` | `0x937363c82bea305369fd3e7475167b5363a2da4d` |
| Registration active | true | true |
| Advertised endpoint | MCP: `https://www.npmjs.com/package/pinata-mcp` | A2A: `http://localhost:8787` |
| Supported trust | reputation | reputation |
| Created timestamp | 1770756396 | 1771592364 |
| Updated timestamp | 1770822564 | 1772288484 |
| Total feedback | 57 | 9 |
| Latest sampled feedback | `quality`, value `88.5`, tag2 `e2e-test` | `analysis_depth`, value `0`, tag2 `cresolver` |
| Latest sampled feedback timestamp | 1770822564 | 1772288484 |

The Pinata sample's feedback author is `0x5d85b986f4fa8e625111443c180a6a009efe46d0`, feedback ID ending `:57`. Gamma's is `0x9b8927d8f78e82c3be1a233519edd9e353a318d2`, feedback ID ending `:6`. The same queried sample includes Gamma's `source_quality` and `resolution_quality`, both zero. These tags measure different things. Averaging them with Pinata's `quality` would invent a common rating scale.

The npm page is an advertised package location, not proof of an operational HTTP MCP endpoint. Gamma advertises localhost. Registration presence therefore cannot mean executable capability. Both records also fail any reasonable current-index freshness policy on the observed deployment.

## Query to reproduce

This selection uses fields confirmed by a successful live query. Replace the list with discovered IDs for other candidates. Send it as the `query` field of a JSON POST to the authenticated URL and inspect both `errors` and `data`.

```graphql
query PaymentEvidence {
  _meta {
    deployment
    block { number hash timestamp }
    hasIndexingErrors
  }
  agents(where: { id_in: ["11155111:1073", "11155111:1301"] }) {
    id chainId agentId owner agentWallet
    createdAt updatedAt totalFeedback
    registrationFile {
      name active createdAt
      mcpEndpoint a2aEndpoint supportedTrusts
      oasfSkills oasfDomains
    }
    feedback(
      first: 20
      where: { isRevoked: false }
      orderBy: createdAt
      orderDirection: desc
    ) {
      id value tag1 tag2 clientAddress createdAt
    }
  }
}
```

Discovery used `agents(first: 20, orderBy: totalFeedback, orderDirection: desc)` with the same selection. This is a bounded sample, not all feedback or all agents. Persist `queriedAt`, network, subgraph ID, `_meta`, selected entity IDs, and the evidence used for each decision. Do not record the authenticated URL.

## Schema and payment integration

Use the [current schema](https://github.com/agent0lab/subgraph/blob/main/schema.graphql), not older README examples. `Feedback.value` is a decimal string; there is no `Feedback.score` field in the checked schema. `agentWallet` belongs to `Agent`, and may be null. `registrationFile` is nullable. The [registration handler](https://github.com/agent0lab/subgraph/blob/main/src/registration-file.ts) currently initializes `mcpTools` and `a2aSkills` to empty arrays. Avoid requiring one of those arrays to contain a payment capability until the deployed mapping supports it. The [Sepolia configuration](https://github.com/agent0lab/subgraph/blob/main/config/networks/eth-sepolia.json) has identity and reputation registries but an empty validation registry configuration, so validation coverage must not be assumed.

Recommended behavior for SettleOne: use Graph evidence to determine whether a candidate may proceed to the user's payment approval. Show the specific missing capability, untrusted feedback author, absent registration, or stale index when a candidate is ineligible. Scope feedback by known tag semantics and approved evaluator addresses before applying a threshold. Keep recipient, amount, destination network, and explicit payment authorization in SettleOne's own approval record; an agent's registration is not authorization to spend. Stale evidence should block evidence-based approval rather than silently use these historical observations as a live default.

## ETHOnline 2026 qualification

The [official The Graph Continuity prize requirements](https://ethglobal.com/events/ethonline2026/prizes/the-graph) require live Graph-provider data to materially support reasoning, decisions, automation, or a natural-language interface. Static and local-only data do not qualify. Existing projects must document prior work; only event work is judged. Submission needs public runnable code and a two-to-four-minute demo.

For this project, demonstrate a live Graph response changing candidate eligibility and thus changing which payment can reach approval. Display the provider query time and index timestamp separately. The observed stale deployment is a useful rejection case, but a successful current-evidence approval demo still needs a fresh deployment and a project-owned authorized key. These research results alone do not establish prize qualification.
