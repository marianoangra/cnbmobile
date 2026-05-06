/**
 * sas-helper.js — emite atestações JUICE Charging Network no Solana Attestation Service.
 *
 * Stack:
 *   - sas-lib              builders + PDAs + (de)serialização Borsh
 *   - @solana/kit          RPC client v5 (CommonJS-friendly)
 *   - @solana/signers      KeyPairSigner via web crypto
 *   - @solana/web3.js v1   só pra base58 ↔ bytes (já era dep do projeto)
 *
 * Uso:
 *   const sas = require('./sas-helper');
 *   const issuer = await sas.loadIssuerSigner(juiceAttestorKeypair.value());
 *   const { signature, attestationPda } = await sas.attestarSessao(issuer, {
 *     firebaseUid:     'abc123',
 *     sessionId:       'uuid-da-sessao',
 *     durationMinutes: 60,
 *     endedAtSec:      Math.floor(Date.now() / 1000),
 *     pontos:          650,
 *     userPubkey:      'BoVj…XZmo',  // ou null pra privacy opt-out
 *   });
 *
 * Idempotência: nonce = sha256(`juice-session-${sessionId}`) → mesma sessão sempre
 * resolve pra mesma attestation PDA. Tentar criar 2x falha com AccountAlreadyExists —
 * o caller deve checar Firestore antes pra evitar o roundtrip on-chain duplicado.
 */

'use strict';

const crypto = require('crypto');

const kit = require('@solana/kit');
const signers = require('@solana/signers');
const sas = require('sas-lib');
const { PublicKey } = require('@solana/web3.js');

// ─── Constantes on-chain (criadas em 2026-05-05 via bootstrap-sas.js) ────────
const SAS_PROGRAM_ID = '22zoJMtdu4tQc2PzL74ZUT7FrwgB1Udec8DdW4yw4BdG';
const CREDENTIAL_PDA = '3L8DdezMmBoo7xsaA3WJbHk4Q8vUia6Qb8Q55yMSPMPQ';
const SCHEMA_PDA     = '5DiFbEsEv9SLWpjAodtVqiuVUydTTKggrmJ6NV1xzymy';
const SCHEMA_VERSION = 1;

// ─── RPC config ──────────────────────────────────────────────────────────────
// Helius é preferível (mais confiável que rpc público); fallback pra mainnet-beta.
const RPC_URL = process.env.SAS_RPC_URL
  || (process.env.HELIUS_KEY ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_KEY}` : null)
  || 'https://api.mainnet-beta.solana.com';
const RPC_WS = RPC_URL.replace(/^https/, 'wss').replace(/^http/, 'ws');

// ─── Cache module-level (sobrevive entre invocações warm da Cloud Function) ──
let _rpc = null;
let _rpcSubs = null;
let _schemaCache = null; // null até primeira fetch; cacheia o schema fetched

function getRpc() {
  if (!_rpc) _rpc = kit.createSolanaRpc(RPC_URL);
  return _rpc;
}

function getRpcSubs() {
  if (!_rpcSubs) _rpcSubs = kit.createSolanaRpcSubscriptions(RPC_WS);
  return _rpcSubs;
}

async function getCachedSchema() {
  if (_schemaCache) return _schemaCache;
  const fetched = await sas.fetchSchema(getRpc(), kit.address(SCHEMA_PDA));
  _schemaCache = fetched.data;
  return _schemaCache;
}

// ─── Utilitários ─────────────────────────────────────────────────────────────

/**
 * Carrega o issuer signer a partir do conteúdo do secret (string JSON do keypair).
 * Aceita formato Solana CLI (array de 64 bytes).
 */
async function loadIssuerSigner(secretValue) {
  if (!secretValue) throw new Error('JUICE_ATTESTOR_KEYPAIR vazio');
  let arr;
  try {
    arr = JSON.parse(secretValue.trim());
  } catch (e) {
    throw new Error('JUICE_ATTESTOR_KEYPAIR não é JSON válido: ' + e.message);
  }
  if (!Array.isArray(arr) || arr.length !== 64) {
    throw new Error('JUICE_ATTESTOR_KEYPAIR esperado: array de 64 bytes (Solana CLI format)');
  }
  return signers.createKeyPairSignerFromBytes(new Uint8Array(arr));
}

/**
 * uid_hash = sha256(firebaseUid)[:16] — match com o pattern do anchor-helper.js.
 * Retorna Buffer de 16 bytes.
 */
function computeUidHash(firebaseUid) {
  return crypto.createHash('sha256').update(firebaseUid).digest().slice(0, 16);
}

/**
 * Nonce determinístico por sessão. 32 bytes off-curve são aceitos pelo SAS
 * (verificado em program/src/processor/create_attestation.rs — não tem checagem Ed25519).
 * Retorna Address (string base58).
 */
function computeNonce(sessionId) {
  const bytes = crypto.createHash('sha256').update(`juice-session-${sessionId}`).digest();
  return new PublicKey(bytes).toBase58();
}

// ─── API principal ───────────────────────────────────────────────────────────

/**
 * Emite atestação SAS pra uma sessão de carregamento JUICE.
 *
 * @param {Object} issuer - signer construído via loadIssuerSigner
 * @param {Object} params
 * @param {string}   params.firebaseUid     Firebase UID do user (será hasheado)
 * @param {string}   params.sessionId       UUID único da sessão (vira nonce)
 * @param {number}   params.durationMinutes Duração 1..1440
 * @param {number}   params.endedAtSec      Unix timestamp em segundos do fim
 * @param {number}   params.pontos          Pontos calculados pra essa sessão
 * @param {?string}  params.userPubkey      Wallet base58 do user, ou null/undefined pra opt-out
 * @returns {Promise<{ signature: string, attestationPda: string, nonce: string }>}
 */
async function attestarSessao(issuer, params) {
  const { firebaseUid, sessionId, durationMinutes, endedAtSec, pontos, userPubkey } = params;

  // Validação
  if (!issuer || !issuer.address) throw new Error('issuer signer obrigatório');
  if (typeof firebaseUid !== 'string' || !firebaseUid) throw new Error('firebaseUid obrigatório');
  if (typeof sessionId !== 'string' || !sessionId) throw new Error('sessionId obrigatório');
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440) {
    throw new Error('durationMinutes inválido (esperado inteiro 1..1440)');
  }
  if (!Number.isInteger(endedAtSec) || endedAtSec < 0) {
    throw new Error('endedAtSec inválido (esperado inteiro ≥ 0)');
  }
  if (!Number.isInteger(pontos) || pontos < 0) {
    throw new Error('pontos inválido (esperado inteiro ≥ 0)');
  }

  // Computa identificadores
  const uidHashBytes = computeUidHash(firebaseUid);
  const nonceStr = computeNonce(sessionId);

  // userPubkey opt-out → empty bytes; opt-in → 32 bytes
  let userPubkeyBytes;
  if (userPubkey) {
    try {
      userPubkeyBytes = new PublicKey(userPubkey).toBytes(); // 32 bytes Uint8Array
    } catch (e) {
      throw new Error(`userPubkey inválido: ${e.message}`);
    }
  } else {
    userPubkeyBytes = new Uint8Array(0);
  }

  // Endereços tipados
  const credentialAddr = kit.address(CREDENTIAL_PDA);
  const schemaAddr     = kit.address(SCHEMA_PDA);
  const nonceAddr      = kit.address(nonceStr);

  // Deriva attestation PDA
  const [attestationPda] = await sas.deriveAttestationPda({
    credential: credentialAddr,
    schema: schemaAddr,
    nonce: nonceAddr,
  });

  // Serializa data conforme schema (Borsh via borsher; ver clients/typescript/src/utils.ts)
  const schema = await getCachedSchema();
  const dataObj = {
    uid_hash:         Array.from(uidHashBytes),    // VecU8 (16 bytes)
    session_id:       sessionId,                    // String
    duration_minutes: durationMinutes,              // U32
    ended_at:         BigInt(endedAtSec),           // I64 — borsher exige BigInt
    pontos:           pontos,                       // U32
    user_pubkey:      Array.from(userPubkeyBytes),  // VecU8 (32 bytes ou 0)
  };
  const dataBytes = sas.serializeAttestationData(schema, dataObj);

  // Builda instruction
  const ix = sas.getCreateAttestationInstruction({
    payer: issuer,
    authority: issuer,
    credential: credentialAddr,
    schema: schemaAddr,
    nonce: nonceAddr,
    expiry: 0,         // 0 = sem expiração (validado em create_attestation.rs)
    data: dataBytes,
    attestation: attestationPda,
  });

  // Builda + envia tx
  const rpc = getRpc();
  const rpcSubs = getRpcSubs();
  const { value: blockhash } = await rpc.getLatestBlockhash().send();
  const message = kit.pipe(
    kit.createTransactionMessage({ version: 0 }),
    (tx) => kit.setTransactionMessageFeePayer(issuer.address, tx),
    (tx) => kit.setTransactionMessageLifetimeUsingBlockhash(blockhash, tx),
    (tx) => kit.appendTransactionMessageInstruction(ix, tx),
  );
  const signed = await signers.signTransactionMessageWithSigners(message);
  const sendAndConfirm = kit.sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions: rpcSubs });
  await sendAndConfirm(signed, { commitment: 'confirmed', skipPreflight: false });
  const signature = kit.getSignatureFromTransaction(signed);

  return {
    signature,
    attestationPda: String(attestationPda),
    nonce: nonceStr,
  };
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  // Constantes (úteis pro caller logar/persistir)
  SAS_PROGRAM_ID,
  CREDENTIAL_PDA,
  SCHEMA_PDA,
  SCHEMA_VERSION,
  // Helpers
  loadIssuerSigner,
  computeUidHash,
  computeNonce,
  // API principal
  attestarSessao,
};
