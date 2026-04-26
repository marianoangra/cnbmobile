# Agentic Engineering Grant Application — Superteam
## Project: CNB Mobile
**Applicant:** Rafael Mariano (CriptonoBolso)
**Date:** 2026-04-25
**Network:** Solana Mainnet

---

## 1. Project Overview

**CNB Mobile** is a mobile-first DePIN protocol that rewards real user engagement — charging sessions and verified app activity — with cryptographic proofs recorded on Solana.

Built for the Brazilian market (largest crypto audience in Latin America), CNB Mobile converts mobile attention into an ownable, transferable on-chain asset. This is not a prototype: the app has real users, a working referral system, leaderboard, live blockchain proofs, and a deployed Anchor program on devnet (mainnet deploy pending ~1.5 SOL).

---

## 2. The Agentic Engineering Layer

### CLINT — CNB Link Intelligence Agent

CNB Mobile has integrated with the **MIND Protocol** through an agent card called **CLINT** (CNB Link Intelligence), submitted as PR #3 to the MIND repository.

**What CLINT does:**
- Acts as an autonomous on-chain DePIN verifier for CNB Mobile sessions
- Reads Solana blockchain data to confirm proof-of-activity transactions
- Surfaces verified session data back into the app UI (WalletScreen, HomeScreen dashboard)
- Enables trustless validation of engagement claims — no need to trust the app server

**Agent card location:** `.agents/skills/clint/` (SKILL.md, index.js, manifest.json)
**MIND schema:** `agent-cards/skills/stbr/card_skill_clint.json`
**Badge:** The Garage Premium | Campaign: `the_garage_frontier_sp`

---

## 3. Technical Architecture

### On-Chain Stack
| Component | Details |
|-----------|---------|
| Anchor Program (devnet) | Program ID: `BoVj5VrUx4zzE9JWFrneGWyePNt4DYGP2AHb9ZUxXZmo` |
| CNB Token (SPL, mainnet) | Mint: `Ew92cAS3PmGqeNvUjsDCwHoVsiGeLSynFnzpdLTx2pu4` |
| Project wallet | `8Zrt5KwcFzmH1NemHNnFgiqXMP6HCThNxCNchHisQsg8` |
| Token supply | 21,000,000,000 CNB (fixed, mint authority null) |
| Anchor instructions | `initialize_user`, `acumular_pontos`, `resgatar_tokens` |

### Agentic Flow (Session → Proof → Reward)
```
User disconnects charger
  └─► pararSessao(minutes) [mobile app]
        └─► registrarProvasSessao [Cloud Function]
              ├─► Firestore (source of truth)
              └─► acumularPontosOnChain → Anchor program (on-chain mirror)
                    └─► PDA updated: UserAccount { uid_hash, total_points, total_minutes }
                          └─► CLINT Agent reads PDA → verifies proof → surfaces in UI
```

### On-Device Wallet
- **Ed25519 keypair** generated locally via `tweetnacl`
- Stored with `expo-secure-store` — no seed phrase exposed to server
- WalletScreen: shows CNB/SOL balance, address, Solscan links for last 10 sessions
- WithdrawScreen: pre-fills native wallet address for CNB token claims

### Cloud Functions (Firebase → Solana bridge)
- `registrarProvasSessao`: session proof writer
- `resgatarCNB`: Firestore gate → SPL transfer mainnet
- `resgatarPrivado`: Cloak SDK (`transact + fullWithdraw`) for private withdrawals

---

## 4. How the Grant Accelerates Agentic Engineering

The grant will be used to:

### 4.1 Mainnet Anchor Deploy (~1.5 SOL)
Deployer wallet `3mpRhiCaYoQWTKnDkPwQxtXwyB996m6sJ35wU2gc1eiD` needs SOL to deploy the Anchor program to mainnet. This is the single blocker preventing full on-chain proofs in production.

After deploy: switch `CLUSTER_URL` in `functions/anchor-helper.js` from `devnet` → `mainnet` (one line change). All proofs become real, permanent, and publicly verifiable.

### 4.2 CLINT Agent — Autonomous Reward Distribution
Extend CLINT to:
- Monitor on-chain PDA state autonomously
- Trigger CNB token airdrops when users reach point milestones
- Push verified proof summaries to the HomeScreen DePIN dashboard in real time
- Enable cross-user DePIN network statistics (total network minutes, total nodes active)

### 4.3 Affiliate Graph On-Chain
Migrate the referral system (currently Firestore) to an on-chain auditable graph. Each referral link becomes a verifiable Solana instruction, enabling agentic analytics over the referral network.

### 4.4 Mobile Wallet Adapter Integration
Add `@solana-mobile/mobile-wallet-adapter-protocol` so users can connect Phantom/Solflare instead of only using the embedded keypair — expanding the addressable user base to existing Solana wallet holders.

---

## 5. Why CNB Mobile for This Grant

| Criteria | CNB Mobile |
|----------|-----------|
| Real users | Yes — active in Brazil |
| Real blockchain proofs | Yes — devnet live, mainnet 1 deploy away |
| Agentic architecture | Yes — CLINT agent card in MIND Protocol |
| Emerging market | Yes — Brazil, largest crypto market in LatAm |
| DePIN narrative | Yes — mobile attention as a verifiable network resource |
| Grant funds immediately deployable | Yes — mainnet deploy + 3 defined features |

---

## 6. Requested Support

- **SOL for mainnet deploy:** ~1.5 SOL (deployer: `3mpRhiCaYoQWTKnDkPwQxtXwyB996m6sJ35wU2gc1eiD`)
- **Engineering grant** to fund CLINT autonomous agent expansion, on-chain affiliate graph, and Mobile Wallet Adapter integration
- **Superteam BR community support** for user acquisition in Brazil

---

## 7. Repository & Live Links

- **GitHub:** https://github.com/CriptonoBolso/CNBMobile
- **MIND Protocol PR:** https://github.com/DGuedz/MIND/pull/3
- **CNB Token on Explorer:** https://explorer.solana.com/address/Ew92cAS3PmGqeNvUjsDCwHoVsiGeLSynFnzpdLTx2pu4
- **Anchor Program (devnet):** https://explorer.solana.com/address/BoVj5VrUx4zzE9JWFrneGWyePNt4DYGP2AHb9ZUxXZmo?cluster=devnet

---

*Generated with Claude Code (claude-sonnet-4-6) via solana.new agentic engineering session.*
*Frontier Colosseum Hackathon submission — deadline 2026-04-30 (America/Sao_Paulo)*
