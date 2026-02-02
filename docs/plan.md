# SettleOne - Technical Execution Plan

**ETHGlobal HackMoney 2026**  
*Cross-chain, session-based USDC payment platform*

---

## Quick Links

| Resource | Link |
|----------|------|
| **Live Frontend** | `https://settleone.vercel.app` *(TBD)* |
| **Arc Contract** | `0x...` *(TBD - update after deployment)* |
| **Demo Video** | `https://youtu.be/...` *(TBD)* |
| **GitHub Repo** | `https://github.com/user/settleone` *(TBD)* |

---

## Table of Contents

1. [Project Modules](#project-modules)
2. [Module Breakdown & Action Items](#module-breakdown--action-items)
3. [Milestone Timeline](#milestone-timeline)
4. [Submission Checklist](#submission-checklist)
5. [Contingency Planning](#contingency-planning)
6. [Best Practices & Reminders](#best-practices--reminders)

---

## Project Modules

| Module | Description | Priority |
|--------|-------------|----------|
| **Smart Contracts** | SessionSettlement.sol on Arc testnet | P0 - Critical |
| **Frontend** | Next.js app with wallet connect, ENS input, session UI | P0 - Critical |
| **SDK Integration** | Yellow SDK, LI.FI, Circle Gateway wrappers | P0 - Critical |
| **Backend** | API routes for session state, bridging proxy | P1 - Important |
| **Testing & QA** | Unit tests, integration tests, manual testing | P1 - Important |
| **Documentation** | README, demo video, architecture diagram | P0 - Critical |

---

## Module Breakdown & Action Items

### 1. Smart Contracts (Arc Chain)

**Goal**: Deploy a working SessionSettlement contract that finalizes off-chain Yellow sessions on-chain.

#### Action Items

- [x] **1.1** Initialize Hardhat project in `/contracts` (used Hardhat instead of Foundry)
  ```bash
  mkdir contracts && cd contracts
  pnpm init && pnpm add -D hardhat @nomicfoundation/hardhat-toolbox
  ```

- [x] **1.2** Install OpenZeppelin contracts
  ```bash
  pnpm add -D @openzeppelin/contracts
  ```

- [x] **1.3** Implement `SessionSettlement.sol`
  - Constructor accepts USDC token address
  - `startSession(address user)` - records session metadata
  - `finalizeSession(bytes32 sessionId, uint256 amount, address recipient)` - transfers USDC
  - `finalizeSessionBatch(bytes32 sessionId, Settlement[] settlements)` - batch settlements
  - Emit `SessionStarted`, `SessionSettled`, and `BatchSettled` events
  - Added reentrancy guard, custom errors, and emergency withdraw

- [x] **1.4** Write comprehensive tests in `test/SessionSettlement.test.ts`
  - 25 passing tests covering all functions
  - Test session start/finalize flow
  - Test duplicate session prevention
  - Test zero amount and invalid recipient edge cases
  - Test batch settlement with multiple recipients
  - Test admin functions (emergencyWithdraw)

- [x] **1.5** Create deployment script `scripts/deploy.ts`
  - Deploys MockUSDC for local testing
  - Deploys SessionSettlement
  - Saves deployment info to `deployments/` folder
  - Exports ABI to frontend

- [ ] **1.6** Document contract address and ABI in `/lib/contracts/` (pending deployment)

---

### 2. Frontend (Next.js)

**Goal**: Build a clean, functional UI for wallet connection, ENS input, session management, and settlement.

#### Action Items

- [x] **2.1** Initialize Next.js project with TypeScript
  ```bash
  pnpm create next-app@latest frontend --typescript --tailwind --eslint --app --src-dir
  ```

- [x] **2.2** Install core dependencies
  ```bash
  pnpm add @rainbow-me/rainbowkit wagmi viem @tanstack/react-query
  ```

- [x] **2.3** Set up project structure
  ```
  frontend/src/
  ├── app/
  │   ├── layout.tsx       # Root layout with Providers
  │   ├── page.tsx         # Main payment page
  │   └── globals.css
  ├── components/
  │   ├── Providers.tsx    # Wagmi/RainbowKit/Query providers
  │   ├── ui/
  │   └── features/
  │       └── ENSInput.tsx # ENS resolution input component
  ├── hooks/
  │   └── useENS.ts        # ENS resolution hook
  ├── lib/
  │   ├── wagmi.ts         # Wagmi config with chain setup
  │   └── contracts/
  └── types/
      └── index.ts         # TypeScript type definitions
  ```

- [x] **2.4** Implement wallet connection
  - RainbowKit + wagmi v2 setup with SSR fix
  - Support MetaMask, WalletConnect, Coinbase Wallet
  - Dark theme with custom accent color
  - ConnectButton in header

- [x] **2.5** Build ENS resolution component
  - Input field with `.eth` detection
  - Real-time ENS name resolution via viem
  - Display resolved address with truncation
  - Avatar fetching support
  - Loading states and error handling
  - Debounced input (300ms)

- [ ] **2.6** Create session management UI
  - "Start Session" button → opens Yellow session
  - Display active session status
  - List of pending payments in session
  - "Add Payment" form (recipient ENS, amount)
  - "End Session & Settle" button

- [ ] **2.7** Implement cross-chain selector
  - Source chain dropdown (Ethereum, Polygon, Arbitrum, etc.)
  - Destination: Arc chain (fixed)
  - Show LI.FI quote (fees, estimated time)

- [ ] **2.8** Build settlement confirmation flow
  - Transaction preview modal
  - Gas estimation display
  - Success/failure state handling
  - Link to block explorer

- [ ] **2.9** Add loading states and error handling
  - Skeleton loaders for async data
  - Toast notifications for errors
  - Retry mechanisms for failed requests

---

### 3. SDK Integration

**Goal**: Wrap Yellow SDK, LI.FI SDK, and Circle Gateway into clean, reusable modules.

#### Action Items

- [ ] **3.1** Install SDK packages
  ```bash
  pnpm add @aspect-build/yellow-sdk @lifi/sdk
  ```

- [ ] **3.2** Create Yellow SDK wrapper (`lib/yellow.ts`)
  ```typescript
  // Core functions needed:
  - createSession(config): Promise<Session>
  - addPayment(session, recipient, amount): Promise<void>
  - getSessionState(session): SessionState
  - finalizeSession(session): Promise<TxHash>
  ```

- [ ] **3.3** Create LI.FI wrapper (`lib/lifi.ts`)
  ```typescript
  // Core functions needed:
  - getQuote(fromChain, toChain, amount): Promise<Quote>
  - executeRoute(quote, signer): Promise<TxHash>
  - getRouteStatus(txHash): Promise<Status>
  ```

- [ ] **3.4** Create ENS utilities (`lib/ens.ts`)
  ```typescript
  // Core functions needed:
  - resolveENS(name): Promise<string | null>
  - lookupAddress(address): Promise<string | null>
  - isValidENS(name): boolean
  ```

- [ ] **3.5** Implement React hooks for each SDK
  - `useYellowSession()` - session state management
  - `useLiFiQuote(params)` - quote fetching with caching
  - `useENSResolver(name)` - debounced ENS resolution

- [ ] **3.6** Handle SDK error cases
  - Network connectivity issues
  - Insufficient balance
  - Session timeout
  - Bridge route unavailable

---

### 4. Backend (API Routes)

**Goal**: Provide server-side support for session persistence and external API proxying.

#### Action Items

- [ ] **4.1** Create API route structure
  ```
  app/api/
  ├── session/
  │   ├── route.ts          # POST: create, GET: list
  │   └── [id]/route.ts     # GET: status, DELETE: cancel
  ├── quote/
  │   └── route.ts          # GET: LI.FI quote proxy
  └── health/
      └── route.ts          # GET: health check
  ```

- [ ] **4.2** Implement session storage (temporary)
  - In-memory store for hackathon (Map or Redis)
  - Store session ID, user address, payments array, status

- [ ] **4.3** Create LI.FI proxy endpoint
  - Server-side quote fetching (avoids CORS)
  - Cache quotes for 30 seconds
  - Rate limiting protection

- [ ] **4.4** Add request validation
  - Validate addresses (checksummed)
  - Validate amounts (positive, within limits)
  - Validate chain IDs

---

### 5. Testing & QA

**Goal**: Ensure reliability through automated and manual testing.

#### Action Items

- [ ] **5.1** Smart contract tests (Foundry)
  - Unit tests for each function
  - Fuzz tests for edge cases
  - Gas optimization tests

- [ ] **5.2** Frontend unit tests (Vitest)
  - Hook tests (useENS, useYellowSession)
  - Component tests (ENSInput, PaymentForm)
  - Utility function tests

- [ ] **5.3** Integration tests
  - End-to-end session flow (mock SDKs)
  - ENS resolution integration
  - Contract interaction tests

- [ ] **5.4** Manual testing checklist
  - [ ] Wallet connect/disconnect on multiple browsers
  - [ ] ENS resolution for valid/invalid names
  - [ ] Session start → add payments → settle flow
  - [ ] Cross-chain quote display
  - [ ] Error state handling
  - [ ] Mobile responsiveness

---

### 6. Documentation & Demo

**Goal**: Prepare all submission materials.

#### Action Items

- [ ] **6.1** Update README.md
  - Project description and features
  - Tech stack overview
  - Setup instructions (local development)
  - Environment variables list
  - Deployment instructions

- [ ] **6.2** Create architecture diagram
  - User flow visualization
  - Component interaction diagram
  - Chain/protocol integration map
  - **Output**: Save as `/docs/architecture-diagram.png`
  - Tools: [draw.io](https://draw.io), [Excalidraw](https://excalidraw.com), or Figma
  
  **Diagram should include:**
  ```
  ┌─────────────┐     ┌──────────────┐     ┌─────────────┐
  │   User      │────▶│   Frontend   │────▶│  Yellow SDK │
  │  (Wallet)   │     │  (Next.js)   │     │  (Session)  │
  └─────────────┘     └──────────────┘     └─────────────┘
                             │                    │
                             ▼                    ▼
                      ┌──────────────┐     ┌─────────────┐
                      │   ENS        │     │   LI.FI     │
                      │  Resolution  │     │  (Bridge)   │
                      └──────────────┘     └─────────────┘
                                                 │
                                                 ▼
                                          ┌─────────────┐
                                          │ Arc Chain   │
                                          │ Settlement  │
                                          └─────────────┘
  ```

- [ ] **6.3** Record demo video (2-3 minutes)
  - Script the demo flow beforehand
  - Show: wallet connect → ENS input → session → payments → settle
  - Highlight sponsor integrations
  - Keep it concise and professional

- [ ] **6.4** Prepare presentation materials
  - Problem statement (30 seconds)
  - Solution overview (1 minute)
  - Technical deep-dive (1 minute)
  - Future roadmap (30 seconds)

- [x] **6.5** Existing documentation (already created)
  - [x] `AGENTS.md` - AI coding agent guidelines
  - [x] `architecture.md` - System architecture overview
  - [x] `sponsor-integration.md` - Sponsor track details
  - [x] `demo-guide.md` - Judge walkthrough guide
  - [x] `future-roadmap.md` - Smart contract specs

---

## Milestone Timeline

### Day 1: Foundation

| Time | Task | Owner |
|------|------|-------|
| Morning | Initialize Next.js + Foundry projects | Dev |
| Morning | Set up environment variables and configs | Dev |
| Afternoon | Implement SessionSettlement.sol (basic) | Dev |
| Afternoon | Write contract tests | Dev |
| Evening | Set up wallet connection (RainbowKit) | Dev |

**Deliverable**: Working dev environment, basic contract, wallet connect

---

### Day 2: Core Smart Contract + ENS

| Time | Task | Owner |
|------|------|-------|
| Morning | Complete SessionSettlement.sol with events | Dev |
| Morning | Deploy to Arc testnet | Dev |
| Afternoon | Build ENS resolution component | Dev |
| Afternoon | Create useENS hook with debouncing | Dev |
| Evening | Integrate ENS into payment form | Dev |

**Deliverable**: Deployed contract, working ENS resolution UI

---

### Day 3: Yellow SDK Integration

| Time | Task | Owner |
|------|------|-------|
| Morning | Set up Yellow SDK wrapper | Dev |
| Morning | Implement useYellowSession hook | Dev |
| Afternoon | Build session management UI | Dev |
| Afternoon | Connect session to contract finalization | Dev |
| Evening | Test full session flow (start → pay → settle) | Dev |

**Deliverable**: Working session flow end-to-end

---

### Day 4: LI.FI + Cross-Chain

| Time | Task | Owner |
|------|------|-------|
| Morning | Integrate LI.FI SDK for quotes | Dev |
| Morning | Build chain selector component | Dev |
| Afternoon | Implement cross-chain route execution | Dev |
| Afternoon | Add quote caching and error handling | Dev |
| Evening | Test cross-chain payment flow | Dev |

**Deliverable**: Cross-chain payments working

---

### Day 5: Polish + Testing

| Time | Task | Owner |
|------|------|-------|
| Morning | UI/UX polish (loading states, animations) | Dev |
| Morning | Mobile responsiveness fixes | Dev |
| Afternoon | Write frontend tests | Dev |
| Afternoon | Manual QA testing | Dev |
| Evening | Bug fixes and edge case handling | Dev |

**Deliverable**: Polished, tested application

---

### Day 6: Documentation + Submission

| Time | Task | Owner |
|------|------|-------|
| Morning | Record demo video | Dev |
| Morning | Create architecture diagram | Dev |
| Afternoon | Write/update README and docs | Dev |
| Afternoon | Final deployment to Vercel | Dev |
| Evening | Submit to ETHGlobal | Dev |
| Evening | Celebrate! 🎉 | Team |

**Deliverable**: Complete submission

---

## Submission Checklist

### Required Deliverables

- [ ] **Live Demo**
  - [ ] Frontend deployed to Vercel/Netlify
  - [ ] Accessible URL with testnet support
  - [ ] Works on desktop and mobile

- [ ] **Smart Contracts**
  - [ ] Deployed to Arc testnet
  - [ ] Verified on block explorer
  - [ ] Contract address documented

- [ ] **Demo Video**
  - [ ] 2-3 minutes long
  - [ ] Shows complete user flow
  - [ ] Highlights all sponsor integrations
  - [ ] Uploaded to YouTube/Loom

- [ ] **GitHub Repository**
  - [ ] Public repository
  - [ ] Clean commit history
  - [ ] Comprehensive README
  - [ ] MIT or similar license

- [ ] **Documentation**
  - [ ] Architecture overview
  - [ ] Architecture diagram (`/docs/architecture-diagram.png`)
  - [ ] Setup instructions
  - [ ] API documentation (if applicable)

### Sponsor Track Requirements

- [ ] **Yellow Network**
  - [ ] Yellow SDK integrated
  - [ ] Session-based payment flow working
  - [ ] Off-chain → on-chain settlement demonstrated

- [ ] **Circle / Arc**
  - [ ] USDC as primary token
  - [ ] Contract deployed on Arc testnet
  - [ ] Settlement transaction visible on-chain

- [ ] **ENS**
  - [ ] ENS name resolution working
  - [ ] Creative use of ENS for payments
  - [ ] Handles edge cases gracefully

- [ ] **LI.FI**
  - [ ] LI.FI SDK/API integrated
  - [ ] Cross-chain routing functional
  - [ ] Quote display and execution working

---

## Contingency Planning

### If Yellow SDK has issues

| Problem | Fallback |
|---------|----------|
| SDK unavailable/broken | Mock session state locally; demonstrate flow with simulated off-chain logic |
| Session finalization fails | Implement direct contract call bypassing Yellow; show manual settlement |
| Documentation lacking | Check Yellow Discord, reach out to sponsor booth |

**Minimum viable**: Show session concept works even if SDK integration is partial.

### If Circle Gateway / Arc fails

| Problem | Fallback |
|---------|----------|
| Arc testnet down | Deploy to Sepolia or Polygon Mumbai instead; document Arc as intended target |
| USDC faucet unavailable | Use mock ERC20 token with same interface |
| Gateway API issues | Skip gasless feature; use native gas with clear documentation |

**Minimum viable**: Contract deployed on any EVM testnet with USDC-like token.

### If LI.FI routing fails

| Problem | Fallback |
|---------|----------|
| No routes available | Show quote UI with mock data; demonstrate intent |
| SDK errors | Use LI.FI API directly instead of SDK |
| Bridge takes too long | Pre-bridge funds before demo; show completed transaction |

**Minimum viable**: Display quote UI and explain cross-chain flow, even if execution is simulated.

### If ENS resolution fails

| Problem | Fallback |
|---------|----------|
| Mainnet ENS costs gas | Use Sepolia ENS or local ENS mock |
| Resolution slow | Cache resolved addresses; use fallback to raw address input |
| No test ENS names | Register test names beforehand or use known names like `vitalik.eth` |

**Minimum viable**: Show ENS input working with at least one resolvable name.

### General fallback priorities

1. **Always have a working demo** - even if features are mocked
2. **Document what works vs. planned** - judges appreciate honesty
3. **Prepare offline demo video** - in case of network issues
4. **Test everything 1 hour before** - catch last-minute failures

---

## Best Practices & Reminders

### Environment & Security

```bash
# .env.local (NEVER commit this file)
NEXT_PUBLIC_ALCHEMY_ID=xxx
NEXT_PUBLIC_WALLETCONNECT_ID=xxx
NEXT_PUBLIC_ARC_RPC=https://...
CIRCLE_API_KEY=xxx
YELLOW_API_KEY=xxx
```

- [ ] Add `.env.local` to `.gitignore`
- [ ] Create `.env.example` with placeholder values
- [ ] Use environment variables for all API keys
- [ ] Never hardcode private keys or secrets

### Code Quality

- [ ] Run `pnpm lint` before each commit
- [ ] Run `pnpm typecheck` to catch type errors
- [ ] Write tests for critical paths
- [ ] Use meaningful commit messages

### Git Workflow

```bash
# Suggested branch strategy
main          # Production-ready code
├── dev       # Integration branch
├── feat/ens  # Feature branches
├── feat/yellow
└── fix/session-bug
```

- [ ] Make small, focused commits
- [ ] Write descriptive PR descriptions
- [ ] Don't push directly to main

### Performance

- [ ] Debounce ENS resolution (300ms)
- [ ] Cache LI.FI quotes (30s TTL)
- [ ] Use React Query for server state
- [ ] Lazy load heavy components

### Accessibility

- [ ] Add aria-labels to interactive elements
- [ ] Ensure sufficient color contrast
- [ ] Support keyboard navigation
- [ ] Test with screen reader

### Pre-Submission Checks

- [ ] All environment variables set in production
- [ ] No console.log statements in production
- [ ] Error boundaries in place
- [ ] Analytics/monitoring set up (optional)
- [ ] Test on multiple browsers (Chrome, Firefox, Safari)
- [ ] Test on mobile devices

---

## Quick Reference Commands

```bash
# Development
pnpm dev                          # Start frontend
forge test -vvv                   # Run contract tests

# Testing
pnpm test                         # Run all tests
pnpm test:watch                   # Watch mode
forge test --match-test testName  # Single contract test

# Building
pnpm build                        # Build frontend
forge build                       # Build contracts

# Deployment
pnpm vercel --prod               # Deploy to Vercel
forge script script/Deploy.s.sol --rpc-url $ARC_RPC --broadcast
```

---

## Emergency Contacts & Resources

| Resource | Link |
|----------|------|
| Yellow SDK Docs | https://docs.yellow.org |
| LI.FI Docs | https://docs.li.fi |
| Circle Docs | https://developers.circle.com |
| ENS Docs | https://docs.ens.domains |
| Arc Testnet Faucet | TBD |
| ETHGlobal Discord | https://discord.gg/ethglobal |

---

*Last updated: Day 0 of hackathon*  
*Good luck, team! Ship it! 🚀*
