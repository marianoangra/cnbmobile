'use strict';

/**
 * kora.js — Cliente do paymaster Kora (Solana)
 *
 * O Kora é um relayer que assina transações como `feePayer`, permitindo que
 * a carteira do usuário transacione mesmo sem SOL.
 *
 * Fluxo:
 *   1. App monta as instructions (transfer, swap, etc.)
 *   2. Adiciona feePayer = KORA_PUBKEY e blockhash recente
 *   3. Usuário assina parcialmente (partialSign)
 *   4. App envia tx serializada pro Kora
 *   5. Kora finaliza assinatura como feePayer e submete pra rede
 *   6. Retorna a signature confirmada
 *
 * Variáveis de ambiente:
 *   EXPO_PUBLIC_KORA_URL    — endpoint JSON-RPC (ex: https://juice-kora.run.app/v1/sign)
 *   EXPO_PUBLIC_KORA_PUBKEY — pubkey base58 do paymaster (feePayer)
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js';
import { Buffer } from 'buffer';

const KORA_URL    = process.env.EXPO_PUBLIC_KORA_URL    || '';
const KORA_PUBKEY = process.env.EXPO_PUBLIC_KORA_PUBKEY || '';

const _HELIUS_KEY = process.env.EXPO_PUBLIC_HELIUS_KEY;
const RPC_URL = _HELIUS_KEY && _HELIUS_KEY !== 'sua-api-key-aqui'
  ? `https://mainnet.helius-rpc.com/?api-key=${_HELIUS_KEY}`
  : 'https://api.mainnet-beta.solana.com';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ensureConfigured() {
  if (!KORA_URL || !KORA_PUBKEY) {
    throw new Error(
      'Kora não configurado. Defina EXPO_PUBLIC_KORA_URL e EXPO_PUBLIC_KORA_PUBKEY no .env.'
    );
  }
}

export function getKoraPubkey() {
  ensureConfigured();
  return new PublicKey(KORA_PUBKEY);
}

export function getConnection() {
  return new Connection(RPC_URL, 'confirmed');
}

/** Faz a chamada JSON-RPC ao Kora. */
async function koraRpc(method, params) {
  ensureConfigured();
  const res = await fetch(KORA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`Kora HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`Kora: ${json.error.message || 'erro desconhecido'}`);
  return json.result;
}

// ─── API pública ─────────────────────────────────────────────────────────────

/**
 * Envia uma Transaction (legacy) com Kora pagando o fee.
 *
 * @param {import('@solana/web3.js').TransactionInstruction[]} instructions
 * @param {Uint8Array} userKeypairBytes - secretKey ed25519 (64 bytes) do usuário
 * @param {{ extraSigners?: import('@solana/web3.js').Keypair[] }} [opts]
 * @returns {Promise<string>} signature confirmada
 */
export async function sendSponsored(instructions, userKeypairBytes, opts = {}) {
  ensureConfigured();
  const conn   = getConnection();
  const userKp = Keypair.fromSecretKey(userKeypairBytes);
  const koraPk = getKoraPubkey();

  const { blockhash } = await conn.getLatestBlockhash('confirmed');

  const tx = new Transaction();
  for (const ix of instructions) tx.add(ix);
  tx.feePayer = koraPk;
  tx.recentBlockhash = blockhash;

  // Assinaturas locais (usuário + signers extras)
  const signers = [userKp, ...(opts.extraSigners ?? [])];
  tx.partialSign(...signers);

  // Serializa SEM exigir todas as assinaturas (Kora ainda vai assinar como feePayer)
  const serialized = tx.serialize({ requireAllSignatures: false }).toString('base64');

  const result = await koraRpc('signAndSend', { transaction: serialized });
  return typeof result === 'string' ? result : result.signature;
}

/**
 * Envia uma VersionedTransaction (v0) já montada — usado pelo Jupiter.
 * Espera-se que a tx já tenha `feePayer = KORA_PUBKEY` (Jupiter aceita feePayer custom).
 *
 * @param {string} swapTransactionBase64 - tx base64 retornada pelo Jupiter
 * @param {Uint8Array} userKeypairBytes
 * @returns {Promise<string>} signature
 */
export async function sendSponsoredV0(swapTransactionBase64, userKeypairBytes) {
  ensureConfigured();
  const userKp = Keypair.fromSecretKey(userKeypairBytes);

  const txBytes = Buffer.from(swapTransactionBase64, 'base64');
  const vtx = VersionedTransaction.deserialize(txBytes);

  // Assina como signer da carteira (Kora vai assinar como feePayer no servidor)
  vtx.sign([userKp]);

  const reSerialized = Buffer.from(vtx.serialize()).toString('base64');
  const result = await koraRpc('signAndSend', { transaction: reSerialized });
  return typeof result === 'string' ? result : result.signature;
}

/**
 * Status do paymaster (saldo, latência) — para UI de debug ou tela de admin.
 */
export async function getKoraHealth() {
  if (!KORA_URL) return { ok: false, reason: 'não configurado' };
  try {
    const t0 = Date.now();
    const res = await fetch(KORA_URL.replace(/\/v1\/sign\/?$/, '/health'));
    const ms = Date.now() - t0;
    return { ok: res.ok, latencyMs: ms };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}
