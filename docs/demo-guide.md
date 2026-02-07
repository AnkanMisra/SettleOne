# Demo Guide – SettleOne

**Last Updated**: February 8, 2026 (Session 8)

This guide explains how to demo SettleOne for judges.

## Live Frontend
**URL:** [https://settleone.vercel.app](https://settleone.vercel.app) *(TBD - pending deployment)*  
**Network:** Base Sepolia (Chain ID: 84532)

## Prerequisites

1. **MetaMask or Phantom wallet**
2. **Base Sepolia network configured**:
   - Network Name: Base Sepolia
   - RPC URL: `https://sepolia.base.org`
   - Chain ID: `84532`
   - Currency: ETH
   - Explorer: `https://sepolia.basescan.org`

3. **Test ETH for gas** - Get from Base Sepolia faucet
4. **MockUSDC for testing** - Mint from contract or request from team

## Deployed Contracts

| Contract | Address | Explorer |
|----------|---------|----------|
| SessionSettlement | `0xe66B3Fa5F2b84df7CbD288EB3BC91feE48a90cB2` | [View](https://sepolia.basescan.org/address/0xe66B3Fa5F2b84df7CbD288EB3BC91feE48a90cB2) |
| MockUSDC | `0xc5c8977491c2dc822F4f738356ec0231F7100f52` | [View](https://sepolia.basescan.org/address/0xc5c8977491c2dc822F4f738356ec0231F7100f52) |

## Walkthrough

### 1. Connect Wallet
- Click "Connect Wallet" in header
- Select MetaMask or injected wallet
- Approve connection request
- Ensure you're on Base Sepolia network

### 2. Start a Session
- Click "Start Session" button
- This creates an off-chain Yellow Network session
- **Yellow Network status indicator appears showing connection**
- Session is confirmed by ClearNode before proceeding

### 3. Add Payments
- Click "Add Payment"
- Enter recipient's ENS name (e.g., `vitalik.eth`) or address
- Enter amount in USDC
- Select source/destination chains for cross-chain transfers
- **Cross-chain quote displays automatically** (fees, time, gas)
- Submit payment

### 4. Review Session
- See all pending payments in session card
- Total amount calculated automatically
- Each payment shows recipient and amount
- **Yellow session state tracked in real-time**

### 5. Settle On-Chain
- Click "Settle All" button
- **Step 1**: Approve USDC spending (if needed)
  - Wait for approval transaction to confirm
- **Step 2**: Execute batch settlement
  - All payments transfer in one transaction
- Success toast notification with clickable link to block explorer
- **Dynamic explorer URL** based on connected chain (Base Sepolia, Base, Ethereum, Sepolia)

## What to Highlight for Judges

### Yellow Network Integration (Full SDK)
- Show Yellow connection status in UI
- Explain @erc7824/nitrolite SDK integration
- Demonstrate:
  - Authentication with challenge-response
  - Session creation with ClearNode confirmation
  - State channel payments with proper allocations
  - Session close with settlement data
- **Mention Greptile 5/5 code review score for Yellow SDK (PR #13)**
- **Mention Greptile 4.5/5 code review score for backend polish (PR #14)**

### Cross-Chain Quote Display (LI.FI)
- Select different source/destination chains
- Show quote breakdown:
  - "You send" / "Recipient gets"
  - Bridge fees with percentage
  - Gas estimate
  - Estimated time
- Demonstrate negative fee handling (shows as "Bonus")

### ENS Integration
- Type `vitalik.eth` and show address resolution
- Show avatar loading (when available)
- Demonstrate error handling for invalid names
- **Backend resolves ENS via ensdata.net API with caching** (not just frontend)

### On-Chain Settlement
- Show USDC approval transaction
- Show batch settlement transaction
- **Click toast notification to open block explorer** (dynamic per chain)
- Point to block explorer for verification

### Security Features
- Mention integer overflow protection
- Mention allowance pre-validation
- Mention transaction confirmation waiting
- Mention safe BigInt parsing
- Mention WebSocket disconnect handling
- **Mention 20 backend tests + 27 contract tests (47 total)**
- **Mention Greptile AI code review: 5/5 (PR #13), 4.5/5 (PR #14)**

## Demo Video
Length: 2-3 minutes  
**Link:** [YouTube / Loom demo link TBD]

### Video Script:
1. **Intro** (15s): "SettleOne - Send USDC anywhere, settle once"
2. **Connect Wallet** (15s): Show MetaMask connection
3. **Start Session** (15s): Create new session
4. **Add Payments** (30s): Add 2-3 payments with ENS names
5. **Yellow Status** (15s): Show off-chain payment tracking
6. **Settlement** (45s): Execute on-chain settlement
7. **Verify** (15s): Show transaction on explorer
8. **Outro** (15s): Recap sponsor integrations

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Wrong network | Switch to Base Sepolia (84532) |
| Insufficient gas | Get test ETH from faucet |
| Approval fails | Check USDC balance |
| Settlement fails | Check allowance is sufficient |
| ENS not resolving | Ensure mainnet ENS (uses mainnet for resolution) |

## Technical Details

- Frontend: Next.js 16 + React 19 + wagmi 3
- Contracts: Solidity 0.8.20 + OpenZeppelin
- Backend: Rust + Axum (real ENS resolution + 20 tests)
- Settlement: Batch transfers via `finalizeSessionBatch()`
- **Toast notifications**: react-hot-toast with clickable explorer links
