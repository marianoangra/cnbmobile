# CNB Mobile — Session Proof Architecture
## Agentic Engineering Grant Technical Reference

### Overview

CNB Mobile implements a **Proof of Activity** system where every engagement session generates a verifiable, immutable record on the Solana blockchain. The CLINT agent reads this data autonomously to power in-app dashboards and reward logic.

---

### Session → Proof Flow

```
┌─────────────────────────────────────────────────────┐
│                   USER DEVICE                       │
│                                                     │
│  [Battery disconnects / session ends]               │
│         │                                           │
│         ▼                                           │
│  pararSessao(durationMinutes)                       │
│  src/hooks/useCarregamento.js:126                   │
│         │                                           │
│         ▼                                           │
│  on-device ed25519 keypair                          │
│  (tweetnacl + expo-secure-store)                    │
└─────────────────┬───────────────────────────────────┘
                  │ fire-and-forget
                  ▼
┌─────────────────────────────────────────────────────┐
│              CLOUD FUNCTIONS (Firebase)             │
│                                                     │
│  registrarProvasSessao({ duracaoMinutos })          │
│         │                                           │
│         ├──► Firestore (source of truth)            │
│         │    usuarios/{uid}/provas/{sessionId}      │
│         │                                           │
│         └──► acumularPontosOnChain()                │
│                   │                                 │
└───────────────────┼─────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│              ANCHOR PROGRAM (Solana)                │
│                                                     │
│  Program: BoVj5VrUx4zzE9JWFrneGWyePNt4DYGP2AHb9ZUxXZmo (devnet)   │
│                                                     │
│  Instruction: acumular_pontos                       │
│  PDA seeds: ["user", sha256(firebase_uid)[0..16]]   │
│                                                     │
│  UserAccount {                                      │
│    uid_hash: [u8; 16],    // user identifier        │
│    total_points: u64,     // accumulated points     │
│    total_minutes: u32,    // total engagement time  │
│    last_session: i64,     // unix timestamp         │
│    authority: Pubkey,     // project wallet         │
│    bump: u8,              // PDA bump               │
│  }  // 55 bytes total                               │
│                                                     │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼ CLINT reads PDA
┌─────────────────────────────────────────────────────┐
│              CLINT AGENT (MIND Protocol)            │
│                                                     │
│  - Reads UserAccount PDA state                      │
│  - Verifies session proof authenticity              │
│  - Aggregates network-wide stats:                   │
│      stats/dashboard {                              │
│        totalMinutos, totalSessoes, totalPontos       │
│      }                                              │
│  - Surfaces data in WalletScreen (last 10 sessions) │
│  - Feeds HomeScreen DePIN live dashboard            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

### Reward Redemption Flow

```
User requests CNB token withdrawal
         │
         ▼
resgatarCNB [Cloud Function]
         │
         ├──► Firestore balance check (gate)
         │
         ├──► tentarResgatarTokensOnChain (Anchor mirror)
         │    Instruction: resgatar_tokens
         │    Constraint: minimum 100,000 points
         │
         └──► SPL Token transfer (mainnet)
              From: 8Zrt5KwcFzmH1NemHNnFgiqXMP6HCThNxCNchHisQsg8
              To: user's on-device wallet (ed25519)
              Token: Ew92cAS3PmGqeNvUjsDCwHoVsiGeLSynFnzpdLTx2pu4
```

---

### Mainnet Deploy Status

| Component | Devnet | Mainnet |
|-----------|--------|---------|
| Anchor program | Deployed + tested | Pending 1.5 SOL |
| SPL Token (CNB) | — | Live (21B supply, mint auth null) |
| registrarProvasSessao | Mirror | Pending |
| resgatarCNB | Mirror | SPL transfer live |
| resgatarPrivado (Cloak) | — | Live |

**Single blocker:** deployer wallet `3mpRhiCaYoQWTKnDkPwQxtXwyB996m6sJ35wU2gc1eiD` needs ~1.5 SOL.
After deploy: one line change in `functions/anchor-helper.js` → all proofs go to mainnet.

---

### Devnet Tests Completed (2026-04-23)

```
✅ acumular_pontos: PDA created correctly (uid_teste_rafael, 300 pts, 3 min)
✅ acumular_pontos: accumulated on same PDA (500 pts, 5 min after 2nd call)
✅ resgatar_tokens: correctly rejected with BelowMinimumRedeem (< 100,000 pts)
```

Test script: `functions/test-devnet.js`
Usage: `node test-devnet.js <base58_key> [uid] [points] [minutes]`
