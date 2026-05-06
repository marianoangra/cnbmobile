'use strict';

/**
 * sasDecoder.js — decoder puro do layout on-chain do SAS Attestation Service.
 *
 * Sem dependências de RN, Firebase, ou @solana/kit. Só Buffer, bs58 e PublicKey
 * (todos já são deps do projeto). Pode ser importado tanto do app (RN) quanto
 * de scripts Node de teste/validação.
 *
 * Schema "Charging Session v1" (criado em 2026-05-05):
 *   uid_hash:         VecU8 (16 bytes)
 *   session_id:       String (UTF-8)
 *   duration_minutes: U32
 *   ended_at:         I64 (unix seconds)
 *   pontos:           U32
 *   user_pubkey:      VecU8 (32 bytes ou 0 = privacy opt-out)
 */

import { Buffer } from 'buffer';
import bs58 from 'bs58';
import { PublicKey } from '@solana/web3.js';

// ─── Constantes mainnet ──────────────────────────────────────────────────────

export const SAS_PROGRAM_ID    = '22zoJMtdu4tQc2PzL74ZUT7FrwgB1Udec8DdW4yw4BdG';
export const SAS_CREDENTIAL_PDA = '3L8DdezMmBoo7xsaA3WJbHk4Q8vUia6Qb8Q55yMSPMPQ';
export const SAS_SCHEMA_PDA     = '5DiFbEsEv9SLWpjAodtVqiuVUydTTKggrmJ6NV1xzymy';

export const SOLSCAN_TX      = (sig)  => `https://solscan.io/tx/${sig}`;
export const SOLSCAN_ACCOUNT = (addr) => `https://solscan.io/account/${addr}`;

// ─── Decoder ─────────────────────────────────────────────────────────────────

/**
 * Decodifica o conteúdo bruto de uma Attestation account (raw bytes do RPC).
 * Layout (de program/src/state/attestation.rs):
 *   discriminator (1)
 *   nonce          (32)
 *   credential     (32)
 *   schema         (32)
 *   data_len       (4)   u32 LE
 *   data           (variable)
 *   signer         (32)
 *   expiry         (8)   i64 LE
 *   token_account  (32)
 */
export function parseAttestationAccount(rawBytes) {
  const buf = Buffer.from(rawBytes);
  let offset = 0;

  const discriminator = buf[offset]; offset += 1;

  const nonce      = bs58.encode(buf.slice(offset, offset + 32)); offset += 32;
  const credential = bs58.encode(buf.slice(offset, offset + 32)); offset += 32;
  const schema     = bs58.encode(buf.slice(offset, offset + 32)); offset += 32;

  const dataLen = buf.readUInt32LE(offset); offset += 4;
  const dataBuf = buf.slice(offset, offset + dataLen); offset += dataLen;

  const signer       = bs58.encode(buf.slice(offset, offset + 32)); offset += 32;
  const expiry       = Number(buf.readBigInt64LE(offset)); offset += 8;
  const tokenAccount = bs58.encode(buf.slice(offset, offset + 32)); offset += 32;

  // Sanity: confirma que é o nosso schema antes de decodificar o data
  if (schema !== SAS_SCHEMA_PDA) {
    throw new Error(`Schema inesperado: ${schema} (esperado ${SAS_SCHEMA_PDA})`);
  }

  return {
    discriminator,
    nonce,
    credential,
    schema,
    signer,
    expiry,                      // 0 = sem expiração
    tokenAccount,
    data: decodeChargingSessionData(dataBuf),
  };
}

/**
 * Borsh decoder para o data field do schema "Charging Session v1".
 * Manualmente serializado conforme o layout — match com convertSasSchemaToBorshSchema
 * em sas-lib/clients/typescript/src/utils.ts.
 */
export function decodeChargingSessionData(buf) {
  let offset = 0;

  const uidHashLen = buf.readUInt32LE(offset); offset += 4;
  const uidHash = buf.slice(offset, offset + uidHashLen).toString('hex'); offset += uidHashLen;

  const sessionIdLen = buf.readUInt32LE(offset); offset += 4;
  const sessionId = buf.slice(offset, offset + sessionIdLen).toString('utf-8'); offset += sessionIdLen;

  const durationMinutes = buf.readUInt32LE(offset); offset += 4;
  const endedAt = Number(buf.readBigInt64LE(offset)); offset += 8;
  const pontos = buf.readUInt32LE(offset); offset += 4;

  const userPubkeyLen = buf.readUInt32LE(offset); offset += 4;
  const userPubkeyBytes = buf.slice(offset, offset + userPubkeyLen);
  const userPubkey = userPubkeyLen === 32 ? bs58.encode(userPubkeyBytes) : null;

  return {
    uidHash,         // hex string (32 chars = 16 bytes)
    sessionId,       // UUID
    durationMinutes,
    endedAt,         // unix seconds (number; safe até ano 2255)
    pontos,
    userPubkey,      // base58 string ou null se opt-out
  };
}

/**
 * Sanity check leve em uma account address. Retorna true/false sem throw.
 */
export function isValidPubkey(addrStr) {
  if (typeof addrStr !== 'string') return false;
  try {
    new PublicKey(addrStr);
    return true;
  } catch {
    return false;
  }
}
