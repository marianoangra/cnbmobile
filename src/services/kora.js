'use strict';

/**
 * kora.js — Cliente do paymaster Kora
 *
 * O paymaster vive como Cloud Function (`assinarTxKora`) — usa Firebase Auth
 * automaticamente via httpsCallable, sem precisar expor endpoint público.
 *
 * Fluxo:
 *   1. App monta as instructions (transfer, swap, etc.)
 *   2. Define feePayer = KORA_PUBKEY e blockhash recente
 *   3. Usuário assina parcialmente (partialSign)
 *   4. App envia tx serializada (base64) pra Cloud Function
 *   5. Function valida (whitelist programas) + assina como feePayer + submete
 *   6. Retorna { signature }
 *
 * Variáveis de ambiente:
 *   EXPO_PUBLIC_KORA_PUBKEY — pubkey base58 do paymaster (feePayer da tx)
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js';
import { Buffer } from 'buffer';
import { getFunctions, httpsCallable } from 'firebase/functions';

const KORA_PUBKEY = process.env.EXPO_PUBLIC_KORA_PUBKEY || '';

const _HELIUS_KEY = process.env.EXPO_PUBLIC_HELIUS_KEY;
const RPC_URL = _HELIUS_KEY && _HELIUS_KEY !== 'sua-api-key-aqui'
  ? `https://mainnet.helius-rpc.com/?api-key=${_HELIUS_KEY}`
  : 'https://api.mainnet-beta.solana.com';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ensureConfigured() {
  if (!KORA_PUBKEY) {
    throw new Error(
      'Kora não configurado. Defina EXPO_PUBLIC_KORA_PUBKEY no .env.'
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

/** Chama a Cloud Function `assinarTxKora`. */
async function callKoraFunction(transactionBase64) {
  ensureConfigured();
  const fn = httpsCallable(getFunctions(), 'assinarTxKora');
  const res = await fn({ transaction: transactionBase64 });
  return res?.data?.signature;
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

  const signers = [userKp, ...(opts.extraSigners ?? [])];
  tx.partialSign(...signers);

  const serialized = tx.serialize({ requireAllSignatures: false }).toString('base64');
  const sig = await callKoraFunction(serialized);
  if (!sig) throw new Error('Kora não retornou signature.');
  return sig;
}

/**
 * Envia uma VersionedTransaction (v0) já montada — usado pelo Jupiter.
 * Espera-se que a tx já tenha `feePayer = KORA_PUBKEY`.
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
  vtx.sign([userKp]);

  const reSerialized = Buffer.from(vtx.serialize()).toString('base64');
  const sig = await callKoraFunction(reSerialized);
  if (!sig) throw new Error('Kora não retornou signature.');
  return sig;
}

/**
 * Status do paymaster (saldo SOL via RPC público).
 */
export async function getKoraHealth() {
  if (!KORA_PUBKEY) return { ok: false, reason: 'não configurado' };
  try {
    const conn = getConnection();
    const lamports = await conn.getBalance(new PublicKey(KORA_PUBKEY));
    return { ok: true, sol: lamports / 1e9 };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}
