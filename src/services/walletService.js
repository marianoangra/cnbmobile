'use strict';

/**
 * walletService.js
 * Carteira Solana nativa — gerada no dispositivo, sem dependência externa.
 *
 * Fluxo:
 *   getOrCreateWallet(uid) → keypair local (tweetnacl + expo-secure-store)
 *   getCNBBalance(address)  → saldo CNB via RPC mainnet
 *   linkWalletToFirestore() → salva pubkey no Firestore do usuário
 *
 * Chave privada NUNCA sai do dispositivo.
 */

import * as SecureStore from 'expo-secure-store';
import * as ExpoC from 'expo-crypto';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

const CNB_MINT      = 'Ew92cAS3PmGqeNvUjsDCwHoVsiGeLSynFnzpdLTx2pu4';
const RPC_MAINNET   = 'https://api.mainnet-beta.solana.com';
const STORE_KEY     = (uid) => `cnb_wallet_sk_${uid}`;

// ─── Keypair ─────────────────────────────────────────────────────────────────

/**
 * Gera um novo keypair ed25519 (Solana) usando bytes aleatórios do SO.
 * Retorna { publicKey: string (base58), secretKey: string (base58 64 bytes) }
 */
async function generateKeypair() {
  const seed = await ExpoC.getRandomBytesAsync(32);
  const kp   = nacl.sign.keyPair.fromSeed(seed);
  return {
    publicKey: bs58.encode(kp.publicKey),
    secretKey: bs58.encode(kp.secretKey),   // 64 bytes: seed + pubkey
  };
}

/**
 * Retorna o keypair do usuário — cria se não existir.
 * A chave privada fica no SecureStore (criptografado pelo SO).
 * A chave pública é salva no Firestore para os Cloud Functions enviarem tokens.
 */
export async function getOrCreateWallet(uid) {
  if (!uid) throw new Error('uid obrigatório');

  const storeKey = STORE_KEY(uid);
  const stored   = await SecureStore.getItemAsync(storeKey);

  if (stored) {
    const sk  = bs58.decode(stored);
    const kp  = nacl.sign.keyPair.fromSecretKey(sk);
    return {
      publicKey: bs58.encode(kp.publicKey),
      isNew: false,
    };
  }

  // Primeira vez — gera e persiste
  const { publicKey, secretKey } = await generateKeypair();
  await SecureStore.setItemAsync(storeKey, secretKey);
  await linkWalletToFirestore(uid, publicKey);

  return { publicKey, isNew: true };
}

/**
 * Salva o endereço Solana do usuário no Firestore.
 * Idempotente — seguro chamar múltiplas vezes.
 */
export async function linkWalletToFirestore(uid, publicKey) {
  await updateDoc(doc(db, 'usuarios', uid), {
    solanaWallet: publicKey,
  });
}

/**
 * Verifica se o usuário já tem carteira criada (sem criar nova).
 */
export async function getWalletAddress(uid) {
  if (!uid) return null;
  const stored = await SecureStore.getItemAsync(STORE_KEY(uid));
  if (!stored) return null;
  const sk = bs58.decode(stored);
  const kp = nacl.sign.keyPair.fromSecretKey(sk);
  return bs58.encode(kp.publicKey);
}

// ─── Saldo CNB ───────────────────────────────────────────────────────────────

/**
 * Busca o saldo de CNB tokens na mainnet via RPC direto.
 * Retorna número com 6 casas decimais (ex: 1.5 CNB = 1500000 raw → 1.5).
 * Retorna null se não houver conta de token associada.
 */
export async function getCNBBalance(walletAddress) {
  if (!walletAddress) return null;
  try {
    const res = await fetch(RPC_MAINNET, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccountsByOwner',
        params: [
          walletAddress,
          { mint: CNB_MINT },
          { encoding: 'jsonParsed' },
        ],
      }),
    });
    const data = await res.json();
    const accounts = data?.result?.value ?? [];
    if (accounts.length === 0) return 0;
    const amount = accounts[0]?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
    return amount;
  } catch {
    return null;
  }
}

/**
 * Busca o saldo de SOL nativo (em SOL, não lamports).
 */
export async function getSOLBalance(walletAddress) {
  if (!walletAddress) return null;
  try {
    const res = await fetch(RPC_MAINNET, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getBalance',
        params: [walletAddress],
      }),
    });
    const data = await res.json();
    const lamports = data?.result?.value ?? 0;
    return lamports / 1e9;
  } catch {
    return null;
  }
}
