# 2-4 minute demo script

Human voice only. No AI voiceover. Record at 720p or higher after live evidence exists.

Target: 2 minutes 30 seconds if only local flow is available. Stretch to 3 minutes 30 seconds if Arc and ENS transactions exist.

## If only local / unfunded

1. Open the app. Say this is an existing SettleOne codebase, continuity track, not a new product from scratch.
2. Show the Arc-only draft. Sign in with the wallet message. Point out the message authenticates drafts and does not move funds.
3. Add two recipients with explicit amounts under a budget. Prepare the exact preview. Read recipients, amounts, token, chain, expiry, and total out loud.
4. Show that editing invalidates the preview.
5. Say Arc settlement, ENS writes, and Graph inclusion are blocked until funded keys and a deployed contract address exist. Do not pretend a toast is a settlement.

## If Arc Testnet is funded

1. Same draft and preview.
2. Check the exact USDC approval in the wallet. Sign the batch. Wait for the receipt.
3. Show Arcscan, `DraftPayment` / `DraftSettled`, and backend `confirmed`.
4. Reload and restore the session. Show duplicate submit is blocked by the retained hash.
5. If a revert or reject happens, keep it. That is part of the demo.

## If ENSv2 access exists

1. Switch to Sepolia. Say this is a different chain from Arc.
2. Resolve the current resolver. Grant `service.metadata` only to a fresh secondary wallet.
3. Secondary updates that text. Secondary `setAddr` simulation reverts.
4. Owner revokes. Secondary text update then reverts.
5. Use the resolved payout address in the Arc draft only after the operator confirms the amount.

## Closing line

"Humans approve every amount. The wallet sends one Arc batch. Identity and vendor evidence are separate reads, not an autonomous spender."
