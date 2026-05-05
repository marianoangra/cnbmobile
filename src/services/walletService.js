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
import { generateMnemonic, mnemonicToEntropy, validateMnemonic as bip39Validate } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

const CNB_MINT       = 'Ew92cAS3PmGqeNvUjsDCwHoVsiGeLSynFnzpdLTx2pu4';
const STORE_KEY      = (uid) => `cnb_wallet_sk_${uid}`;
const MNEMONIC_KEY   = (uid) => `cnb_wallet_mnemonic_${uid}`;

// RPC: usa Helius (com API key) como primário e o endpoint público como fallback.
// A key é lida de EXPO_PUBLIC_HELIUS_KEY (.env local / EAS Secret em produção).
const _HELIUS_KEY = process.env.EXPO_PUBLIC_HELIUS_KEY;
const RPC_ENDPOINTS = _HELIUS_KEY && _HELIUS_KEY !== 'sua-api-key-aqui'
  ? [
      `https://mainnet.helius-rpc.com/?api-key=${_HELIUS_KEY}`,
      'https://api.mainnet-beta.solana.com',
    ]
  : ['https://api.mainnet-beta.solana.com'];

// ─── RPC helper com retry e fallback ─────────────────────────────────────────

/**
 * Executa uma chamada JSON-RPC contra os endpoints em ordem.
 * Tenta cada endpoint até 2 vezes com backoff exponencial antes de passar pro próximo.
 * Lança erro somente se todos os endpoints falharem.
 */
async function rpcPost(body) {
  const TENTATIVAS_POR_ENDPOINT = 2;
  const BACKOFF_MS = 600;

  for (const endpoint of RPC_ENDPOINTS) {
    for (let t = 0; t < TENTATIVAS_POR_ENDPOINT; t++) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch {
        if (t < TENTATIVAS_POR_ENDPOINT - 1) {
          await new Promise(r => setTimeout(r, BACKOFF_MS * (t + 1)));
        }
      }
    }
  }
  throw new Error('RPC indisponível em todos os endpoints.');
}

// ─── Keypair ─────────────────────────────────────────────────────────────────

/**
 * Deriva um keypair ed25519 a partir de um mnemonic BIP39.
 * Fluxo: mnemonic → entropy (16 bytes) → SHA-256 → seed (32 bytes) → keypair.
 * Não usa PBKDF2 nem BIP32 — derivação simples e rápida para uso interno do app.
 */
async function keypairFromMnemonic(mnemonic) {
  const entropy    = mnemonicToEntropy(mnemonic.trim().toLowerCase(), wordlist);
  const entropyHex = Array.from(entropy).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex    = await ExpoC.digestStringAsync(
    ExpoC.CryptoDigestAlgorithm.SHA256,
    entropyHex,
    { encoding: ExpoC.CryptoEncoding.HEX },
  );
  const seed = new Uint8Array(hashHex.match(/.{2}/g).map(b => parseInt(b, 16)));
  return nacl.sign.keyPair.fromSeed(seed);
}

/**
 * Gera um novo mnemonic de 12 palavras e deriva o keypair correspondente.
 */
async function generateMnemonicKeypair() {
  const mnemonic = generateMnemonic(wordlist, 128); // 128 bits = 12 palavras
  const kp       = await keypairFromMnemonic(mnemonic);
  return {
    mnemonic,
    publicKey: bs58.encode(kp.publicKey),
    secretKey: bs58.encode(kp.secretKey),
  };
}

/**
 * Valida se uma string é um mnemonic BIP39 de 12 palavras válido.
 */
export function validarMnemonic(mnemonic) {
  return bip39Validate(mnemonic.trim().toLowerCase(), wordlist);
}

/**
 * Retorna o mnemonic armazenado no SecureStore (se existir).
 * Carteiras antigas criadas sem mnemonic retornam null.
 */
export async function getMnemonic(uid) {
  if (!uid) return null;
  return SecureStore.getItemAsync(MNEMONIC_KEY(uid));
}

/**
 * Restaura uma carteira a partir de um mnemonic fornecido pelo usuário.
 * Substitui qualquer keypair existente no dispositivo.
 */
export async function restoreWalletFromMnemonic(uid, mnemonic) {
  if (!uid) throw new Error('uid obrigatório');
  if (!validarMnemonic(mnemonic)) throw new Error('Mnemonic inválido.');

  const kp        = await keypairFromMnemonic(mnemonic);
  const publicKey = bs58.encode(kp.publicKey);
  const secretKey = bs58.encode(kp.secretKey);

  await SecureStore.setItemAsync(MNEMONIC_KEY(uid), mnemonic.trim().toLowerCase());
  await SecureStore.setItemAsync(STORE_KEY(uid), secretKey);
  await linkWalletToFirestore(uid, publicKey);

  return { publicKey };
}

/**
 * Retorna o keypair do usuário — cria se não existir.
 * Novas carteiras sempre geram um mnemonic de 12 palavras.
 * Carteiras legadas (sem mnemonic) continuam funcionando normalmente.
 *
 * Retorna { publicKey, isNew, mnemonic? }
 * mnemonic está presente apenas quando isNew === true — exibir ao usuário uma única vez.
 */
export async function getOrCreateWallet(uid) {
  if (!uid) throw new Error('uid obrigatório');

  const stored = await SecureStore.getItemAsync(STORE_KEY(uid));

  if (stored) {
    const sk  = bs58.decode(stored);
    const kp  = nacl.sign.keyPair.fromSecretKey(sk);
    return { publicKey: bs58.encode(kp.publicKey), isNew: false };
  }

  // Primeira vez — gera mnemonic + keypair e persiste ambos
  const { mnemonic, publicKey, secretKey } = await generateMnemonicKeypair();
  await SecureStore.setItemAsync(MNEMONIC_KEY(uid), mnemonic);
  await SecureStore.setItemAsync(STORE_KEY(uid), secretKey);
  await linkWalletToFirestore(uid, publicKey);

  return { publicKey, isNew: true, mnemonic };
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

/**
 * Retorna a secret key (64 bytes ed25519) para assinar transações.
 * Usar SOMENTE em memória — nunca persistir fora do SecureStore.
 * Necessário para o Kora paymaster (assinatura local antes do envio).
 */
export async function getKeypairBytes(uid) {
  if (!uid) throw new Error('uid obrigatório');
  const stored = await SecureStore.getItemAsync(STORE_KEY(uid));
  if (!stored) throw new Error('Carteira não encontrada — execute getOrCreateWallet primeiro.');
  return bs58.decode(stored);
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
    const data = await rpcPost({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTokenAccountsByOwner',
      params: [
        walletAddress,
        { mint: CNB_MINT },
        { encoding: 'jsonParsed' },
      ],
    });
    const accounts = data?.result?.value ?? [];
    if (accounts.length === 0) return 0;
    return accounts[0]?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
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
    const data = await rpcPost({
      jsonrpc: '2.0',
      id: 1,
      method: 'getBalance',
      params: [walletAddress],
    });
    const lamports = data?.result?.value ?? 0;
    return lamports / 1e9;
  } catch {
    return null;
  }
}
