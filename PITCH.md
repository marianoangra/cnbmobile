# CNB Mobile — Colosseum Hackathon Pitch

---

## One-liner

**CNB Mobile is a DePIN protocol on Solana that pays users in tokens for verified charging sessions — no hardware required, every proof on-chain, built for Latin America.**

---

## The Hook

Every day, 220 million Brazilians generate data that makes Meta, Google, and telecom companies billions of dollars. They receive nothing. Not a token. Not a receipt. Not even transparency about what's being extracted from them.

CNB Mobile flips the model: **you generate the proof, you own the token, you keep the value.**

---

## The Problem

Mobile DePIN has a hardware problem.

Helium requires a $400 hotspot. Hivemapper requires a dashcam. Even STEPN requires sneaker NFTs. The entry barrier is physical and financial — which means the people who need the income most are the least able to participate.

Brazil crystallizes this gap:
- 220M smartphones, nearly one per person
- PIX processes more transactions than Visa — payments are solved
- 60M+ unbanked or underbanked, with Android phones
- Zero DePIN protocols designed to run on hardware they already own

The attention economy extracts billions from mobile users every year and returns nothing. Every minute a user keeps their screen on generates value for someone else. We route that value back to the source — verified, immutable, on Solana.

---

## The Solution

CNB Mobile is a DePIN protocol where the phone is the node and attention is the resource.

**The mechanism:**

1. User opens the app and plugs in their phone to charge
2. Android Battery API detects charging state — a foreground service starts
3. Every verified minute → **+10 CNB tokens**
4. Every completed hour → **+50 CNB bonus**
5. At session end → a **Solana Memo transaction** is written on-chain: `{event: "session", uidHash, timestamp, duration, points}` — immutable, auditable, permanent
6. User claims CNB to any Solana wallet in one tap, or withdraws via PIX

No hardware purchase. No NFT. No seed phrase at onboarding. An Android phone you already own is enough.

---

## This Is DePIN, Not a Loyalty Program

Three properties separate a DePIN protocol from an app with points:

**The proof is permissionless.** A loyalty program can freeze your balance overnight. Our session Memos are on Solana — no entity, including us, can alter or delete a recorded proof.

**The token is ownable.** CNB is an SPL token. Users hold it, trade it, send it to any wallet. Loyalty points die with the app. CNB lives on-chain.

**The network compounds.** Each user is a verified node. The referral system creates an auditable on-chain social graph. The protocol collects privacy-preserving behavioral data — hashed UIDs, session durations, geographic density — that brands will eventually pay to access. That's the Helium model applied to attention: nodes contribute resource → protocol monetizes aggregate signal → value flows back to nodes.

---

## Traction

This is not a hackathon prototype.

- **[X] registered users** in Brazil, active and earning
- **[Y] on-chain session proofs** — each one a Memo on Solana mainnet, verifiable right now
- **[Z] CNB tokens redeemed** to Solana wallets
- **PIX withdrawals processed** — fiat onramp functional, not theoretical
- **Referral system on-chain** — each affiliate registration generates a verifiable Memo at the moment it happens
- **Public dashboard** at `cnbmobile-2053c.web.app` — live data, every proof linked to Solscan

We came to this hackathon with a working protocol, not a pitch deck. Every number above exists on mainnet today.

---

## Market

Brazil is the entry point, not the ceiling.

PIX isn't just a payment method — it's the infrastructure that makes crypto actually usable for 150M Brazilians. It's what crypto payments aspire to be, except it already works. CNB Mobile sits at that intersection: Solana for the protocol layer, PIX for the real-world exit.

Beyond Brazil: Mexico (130M smartphones), Colombia (60M), Argentina (50M). Latin America is 700M people with Android phones, high inflation, and no DePIN protocols built for them.

Helium just entered Brazil via Mambo WiFi — hardware-dependent, $400 per node. They validated the market. We capture it without the barrier.

---

## Tokenomics

- **Supply:** 21,000,000,000 CNB — fixed, mint authority renounced
- **Emission:** 650 CNB/hour of verified charging, halving every 4 years (Bitcoin-inspired schedule)
- **Burn:** 2% of every token redemption permanently removed from circulation
- **Minimum claim:** 100,000 CNB — prevents micro-transaction spam, ensures earned value is meaningful
- **Sustainability:** At 10,000 users averaging 30 min/day, the protocol runs for 45+ years with the halving schedule applied

Full tokenomics: `cnbmobile-2053c.web.app/tokenomics`

---

## Technical Architecture

**On the device:**
- React Native foreground service monitors battery state in real-time
- Every minute of verified charging increments points via Firebase (Firestore)
- Session mutex prevents double-counting from concurrent battery events

**On Solana:**
- End of each session triggers `registrarProvasSessao` — a Firebase Cloud Function that writes a Solana Memo with: `uidHash` (SHA-256, privacy-preserving), ISO timestamp, duration in minutes, CNB earned
- Daily aggregate proof written at 03:00 BRT: `{date, activeUsers, totalPoints, totalMinutes, SHA-256 hash of all UIDs}`
- Referral events recorded on-chain via Memo at moment of registration
- CNB Token redemption transfers SPL tokens from project treasury to user's wallet

**Stack:** React Native (Expo) · Firebase · `@solana/web3.js` · Solana Memo Program · SPL Token Program

**Live on mainnet:** [`Ew92cAS3PmGqeNvUjsDCwHoVsiGeLSynFnzpdLTx2pu4`](https://solscan.io/token/Ew92cAS3PmGqeNvUjsDCwHoVsiGeLSynFnzpdLTx2pu4)

Every proof is publicly auditable at `cnbmobile-2053c.web.app` — click any row to verify on Solscan.

---

## Why Solana

**Cost:** $0.00025 per Memo transaction. At 10,000 daily session proofs, that's $2.50/day in protocol infrastructure. DePIN-grade proof at consumer scale, affordable from day one.

**Speed:** Sub-second finality means proof generation is invisible to the user. Session ends → Memo confirmed → Firestore updated → notification delivered — before they read the screen.

**Ecosystem:** Mobile Wallet Adapter for React Native is production-ready. Users connect Phantom or Solflare in two taps. The Solana Seeker (150k preorders) is exactly our user base — mobile-first, crypto-native, expecting their phone to pay them.

Ore proved the formula at Renaissance 2024 — Grand Prize, C1 accelerator, $10 to $500 in six weeks. Mobile + Solana + direct reward. We extend that thesis from computation to attention. Ore mines CPU cycles. CNB Mobile mines human engagement.

---

## Why Us

We didn't build CNB Mobile for a hackathon. We built it for Brazil, before this hackathon existed.

The PIX integration isn't a feature — it's how our users actually live. The charging mechanic isn't theoretical — it's what our users actually do. We understand the experience of someone who doesn't know what a wallet is, earns minimum wage, and charges their phone twice a day.

We also understand SPL tokens, Solana Memo Program, foreground service lifecycle on Android 14, and two-phase commit patterns between Firestore and on-chain state. We live in both worlds because we have to.

---

## The Ask

**If we win, here's exactly what happens in 90 days:**

**Month 1 — Staking:** Users stake CNB to earn a 2x emission multiplier. First utility beyond holding. First deflationary lock-up that creates scarcity without removing access.

**Month 2 — Attention Marketplace v0.1:** Two Brazilian brands pay in USDC to reach CNBMobile users by segment. First external revenue. First proof that attention has a market price — not hypothetically, but in a real transaction.

**Month 3 — Mexico launch:** Same protocol, same app, different fiat rail (SPEI instead of PIX). 130M smartphones, zero DePIN competitors with software-only access.

The prize funds infrastructure and the first brand partnerships. The Colosseum community opens doors that money can't.

---

## Closing

Ore proved that a phone can mine computation.  
STEPN proved that a phone can mine movement.  
**CNB Mobile proves that a phone can mine attention** — the most abundant and least compensated resource in the digital economy, in the market that needs it most.

The protocol is live. The proofs are on-chain. Brazil is waiting.

`cnbmobile-2053c.web.app` · Solana Mainnet · Brazil 🇧🇷

---

## Short Versions

### Project Description (1 paragraph)

> CNB Mobile is a DePIN protocol on Solana that pays users in CNB tokens for verified phone charging sessions — no hardware required. Each session generates an immutable Memo on-chain via the Solana Memo Program, recording a hashed user ID, timestamp, duration, and points earned. Users redeem CNB tokens directly to a Solana wallet, or withdraw via PIX — Brazil's instant payment network. Built for Latin America, where 220M people own Android phones but have no access to DePIN protocols that don't require expensive hardware. The app is live on Google Play, the token is on Solana mainnet, and every proof is publicly auditable at cnbmobile-2053c.web.app.

### What Makes This Unique (2 sentences)

> No DePIN protocol today monetizes mobile attention at scale without requiring hardware — CNB Mobile turns every Android phone in Latin America into a verified node. Every session generates an on-chain proof via Solana Memo Program, redeemable as SPL tokens to any wallet or withdrawn via PIX, Brazil's 800M tx/month payment infrastructure.

### Video Opening Script (first 20 seconds)

> *(phone plugged into charger, app open on screen)*
>
> "This phone started earning tokens 12 seconds ago. I didn't buy any hardware. I didn't configure a wallet. I just plugged in the charger.
>
> *(show Solscan live)*
>
> This proof was written to Solana mainnet 8 seconds ago, while I was talking. That's CNB Mobile. That's DePIN without hardware. Let's go."

---

> **Note:** Replace `[X]`, `[Y]`, `[Z]` in the Traction section with real numbers before submission.
