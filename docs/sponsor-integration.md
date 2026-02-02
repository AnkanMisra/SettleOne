# Sponsor Integration – SettleOne

SettleOne qualifies for the following ETHGlobal HackMoney 2026 sponsor tracks:

---

## 1. Yellow Network 🟡

**Requirement:** Use Yellow SDK + Nitrolite to handle off-chain session logic.  
**Integration:**  
- Users open a Yellow session on connect  
- Each payment is recorded off-chain  
- Settlement finalizes on-chain via Arc  
✅ Met via session-based architecture and SDK logic

---

## 2. Circle / Arc 🟣

**Requirement:** Use Circle's tools and Arc chain to manage USDC, enable treasury or global payouts  
**Integration:**  
- USDC is the native token for all settlements  
- Arc smart contract handles one-time finalization  
- Optional: Circle Gateway + Wallets used for gas abstraction  
✅ Met via Arc-based contracts and USDC transfer flow

---

## 3. ENS 🟦

**Requirement:** Show creative ENS use in DeFi  
**Integration:**  
- Users send payments to `.eth` names  
- All sessions/settlements resolve via ENS lookups  
✅ Met via core ENS-based UI and logic

---

## 4. LI.FI 🔀

**Requirement:** Use LI.FI SDK/API for cross-chain swaps or bridging  
**Integration:**  
- Cross-chain USDC routing handled by LI.FI route quotes  
- Smart contract call execution optionally included  
✅ Met by bridging flows in app for Ethereum → Arc and others

---

SettleOne is a four-track-qualified project, designed for high technical value, strong UX, and long-term continuation.
