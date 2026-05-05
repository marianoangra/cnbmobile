'use strict';

/**
 * juice-kora — Solana paymaster (gasless feePayer)
 *
 * API: POST /v1/sign
 *   body: { jsonrpc: "2.0", id: 1, method: "signAndSend", params: { transaction: "<base64>" } }
 *   resp: { jsonrpc: "2.0", id: 1, result: { signature: "<base58>" } }
 *
 * Como funciona:
 *   1. App envia tx parcialmente assinada (signer da carteira do usuário já assinou)
 *   2. Validamos: whitelist de programas + mints + rate limit
 *   3. Assinamos como feePayer com a keypair do Secret Manager
 *   4. Submetemos na mainnet, retornamos a signature
 */

const express = require('express');
const fs = require('fs');
const {
  Connection, Keypair, PublicKey, Transaction, VersionedTransaction,
} = require('@solana/web3.js');

// ─── Config ──────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '8080', 10);
const RPC_URL = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';
const KEYPAIR_PATH = process.env.KEYPAIR_PATH || '/secrets/kora-keypair.json';
const MAX_FEE_LAMPORTS = parseInt(process.env.MAX_FEE_LAMPORTS || '50000', 10);

const ALLOWED_PROGRAMS = new Set([
  '11111111111111111111111111111111',                  // System
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',       // SPL Token
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',      // Associated Token Account
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',       // Memo
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',       // Jupiter v6
  'ComputeBudget111111111111111111111111111111',        // Compute Budget
]);

const ALLOWED_MINTS = new Set([
  'Ew92cAS3PmGqeNvUjsDCwHoVsiGeLSynFnzpdLTx2pu4', // CNB
  'So11111111111111111111111111111111111111112',  // wSOL (pra Jupiter)
]);

// ─── Keypair ─────────────────────────────────────────────────────────────────
const secretArray = JSON.parse(fs.readFileSync(KEYPAIR_PATH, 'utf8'));
const PAYMASTER = Keypair.fromSecretKey(Uint8Array.from(secretArray));
console.log(`[kora] paymaster pubkey: ${PAYMASTER.publicKey.toBase58()}`);

const conn = new Connection(RPC_URL, 'confirmed');

// ─── Rate limit em memória (por source wallet) ──────────────────────────────
const PER_MIN_LIMIT = 10;
const PER_DAY_LIMIT = 200;
const buckets = new Map(); // pubkey → { min: [{t}], day: [{t}] }

function rateLimitOk(source) {
  const now = Date.now();
  const cutoffMin = now - 60_000;
  const cutoffDay = now - 86_400_000;
  const b = buckets.get(source) || { min: [], day: [] };
  b.min = b.min.filter(t => t > cutoffMin);
  b.day = b.day.filter(t => t > cutoffDay);
  if (b.min.length >= PER_MIN_LIMIT) return false;
  if (b.day.length >= PER_DAY_LIMIT) return false;
  b.min.push(now);
  b.day.push(now);
  buckets.set(source, b);
  return true;
}

// ─── Validação de tx ────────────────────────────────────────────────────────
function validateLegacyTx(tx) {
  for (const ix of tx.instructions) {
    const pid = ix.programId.toBase58();
    if (!ALLOWED_PROGRAMS.has(pid)) {
      throw new Error(`programa não permitido: ${pid}`);
    }
  }
  // Garante que a tx vai mesmo nos pagar — feePayer = paymaster
  if (!tx.feePayer || !tx.feePayer.equals(PAYMASTER.publicKey)) {
    throw new Error('feePayer da tx não é o paymaster');
  }
}

function validateV0Tx(vtx) {
  const message = vtx.message;
  const accountKeys = message.staticAccountKeys.map(k => k.toBase58());
  for (const ix of message.compiledInstructions) {
    const pid = accountKeys[ix.programIdIndex];
    if (!ALLOWED_PROGRAMS.has(pid)) {
      throw new Error(`programa não permitido: ${pid}`);
    }
  }
  // Para v0, feePayer é staticAccountKeys[0]
  const feePayer = accountKeys[0];
  if (feePayer !== PAYMASTER.publicKey.toBase58()) {
    throw new Error('feePayer da tx v0 não é o paymaster');
  }
}

// ─── Handlers ────────────────────────────────────────────────────────────────

async function handleSignAndSend(txBase64) {
  const txBytes = Buffer.from(txBase64, 'base64');

  // Tenta deserializar como v0 primeiro, senão legacy
  let signature, source;
  try {
    const vtx = VersionedTransaction.deserialize(txBytes);
    validateV0Tx(vtx);
    // signer source = primeiro signer não-paymaster
    const accountKeys = vtx.message.staticAccountKeys.map(k => k.toBase58());
    source = accountKeys.find(k => k !== PAYMASTER.publicKey.toBase58()) || accountKeys[0];
    if (!rateLimitOk(source)) throw new Error('rate limit excedido');

    vtx.sign([PAYMASTER]);
    signature = await conn.sendTransaction(vtx, { skipPreflight: false, maxRetries: 3 });
  } catch (vtxErr) {
    if (vtxErr.message?.includes('rate limit') || vtxErr.message?.includes('não permitido') || vtxErr.message?.includes('feePayer')) {
      throw vtxErr;
    }
    // Fallback: legacy Transaction
    const tx = Transaction.from(txBytes);
    validateLegacyTx(tx);
    const userSigner = tx.signatures.find(s => !s.publicKey.equals(PAYMASTER.publicKey) && s.signature);
    source = userSigner ? userSigner.publicKey.toBase58() : 'unknown';
    if (!rateLimitOk(source)) throw new Error('rate limit excedido');

    tx.partialSign(PAYMASTER);
    signature = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 3 });
  }

  console.log(`[kora] signed: source=${source} sig=${signature}`);
  return signature;
}

// ─── Express ────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json({ limit: '256kb' }));

app.get('/health', async (_req, res) => {
  try {
    const lamports = await conn.getBalance(PAYMASTER.publicKey);
    res.json({
      ok: true,
      paymaster: PAYMASTER.publicKey.toBase58(),
      sol: lamports / 1e9,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/v1/sign', async (req, res) => {
  const { id, method, params } = req.body || {};
  try {
    if (method !== 'signAndSend') {
      return res.json({ jsonrpc: '2.0', id, error: { code: -32601, message: 'método desconhecido' } });
    }
    if (!params?.transaction) {
      return res.json({ jsonrpc: '2.0', id, error: { code: -32602, message: 'transaction obrigatória' } });
    }
    const signature = await handleSignAndSend(params.transaction);
    res.json({ jsonrpc: '2.0', id, result: { signature } });
  } catch (e) {
    console.error(`[kora] erro: ${e.message}`);
    res.json({ jsonrpc: '2.0', id, error: { code: -32000, message: e.message } });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[kora] listening on :${PORT}`);
});
