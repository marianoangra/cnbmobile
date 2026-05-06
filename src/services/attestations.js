'use strict';

/**
 * attestations.js — leitura das atestações SAS da JUICE Charging Network.
 *
 * Duas paths:
 *   listUserAttestations(uid)        → Firestore (rápido, primary)
 *   fetchAttestationOnChain(pda)     → RPC (verificação, on-demand)
 *
 * O write é feito pelo Cloud Function `registrarProvasSessao` ao final
 * de cada sessão de carregamento (ver functions/index.js + functions/sas-helper.js).
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { collection, query, orderBy, limit, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

import {
  parseAttestationAccount,
  SAS_PROGRAM_ID,
  SAS_CREDENTIAL_PDA,
  SAS_SCHEMA_PDA,
  SOLSCAN_TX,
  SOLSCAN_ACCOUNT,
} from './sasDecoder';

export {
  SAS_PROGRAM_ID,
  SAS_CREDENTIAL_PDA,
  SAS_SCHEMA_PDA,
  SOLSCAN_TX,
  SOLSCAN_ACCOUNT,
};

// ─── RPC singleton (mesmo padrão de walletService.js) ────────────────────────

const _HELIUS_KEY = process.env.EXPO_PUBLIC_HELIUS_KEY;
const RPC_URL = _HELIUS_KEY && _HELIUS_KEY !== 'sua-api-key-aqui'
  ? `https://mainnet.helius-rpc.com/?api-key=${_HELIUS_KEY}`
  : 'https://api.mainnet-beta.solana.com';

let _connection = null;
function getConnection() {
  if (!_connection) _connection = new Connection(RPC_URL, 'confirmed');
  return _connection;
}

// ─── API ─────────────────────────────────────────────────────────────────────

function buildAttestationsQuery(uid, max) {
  return query(
    collection(db, 'usuarios', uid, 'sessoes'),
    orderBy('criadoEm', 'desc'),
    limit(max),
  );
}

function mapDocToAttestation(d) {
  const data = d.data();
  // Só atestações concluídas — pendentes/em-progresso/falhas omitidas
  if (data.status !== 'ATTESTED') return null;
  const signature = data.sasSignature || null;
  const attestationPda = data.attestationPda || null;
  return {
    id: d.id,
    sessionId: d.id,  // sessionId == doc id na nova arquitetura
    duracaoMinutos: data.duracaoMinutos,
    pontos: data.pontos,
    signature,
    attestationPda,
    solscanUrl: data.solscanUrl || (signature ? SOLSCAN_TX(signature) : null),
    criadoEm: data.criadoEm?.toDate?.() ?? null,
    isSas: true,
  };
}

/**
 * Lista atestações do user — lê da subcoleção Firestore `usuarios/{uid}/sessoes`.
 * Retorna array ordenado por `criadoEm` desc, filtrado por status='ATTESTED'.
 * Sessões em PENDING/ATTESTING/FAILED não aparecem (trigger ainda processando ou falhou).
 *
 * @param {string} uid - Firebase UID
 * @param {{ max?: number }} opts
 * @returns {Promise<Array<Attestation>>}
 */
export async function listUserAttestations(uid, opts = {}) {
  if (!uid) return [];
  const { max = 50 } = opts;
  const snap = await getDocs(buildAttestationsQuery(uid, max));
  return snap.docs.map(mapDocToAttestation).filter(Boolean);
}

/**
 * Listener em tempo real — usado por telas que precisam refletir novas atestações
 * sem reabrir o app. Dispara o callback inicialmente com o snapshot atual e a cada
 * mudança (nova sessão atestada, status atualizado).
 *
 * @param {string} uid
 * @param {(atts: Array<Attestation>) => void} callback
 * @param {{ max?: number }} opts
 * @returns {() => void} unsubscribe
 */
export function subscribeUserAttestations(uid, callback, opts = {}) {
  if (!uid) {
    callback([]);
    return () => {};
  }
  const { max = 50 } = opts;
  return onSnapshot(
    buildAttestationsQuery(uid, max),
    (snap) => callback(snap.docs.map(mapDocToAttestation).filter(Boolean)),
    (err) => {
      console.warn('[Attestations] onSnapshot:', err?.message);
      callback([]);
    },
  );
}

/**
 * Busca a Attestation account on-chain e decodifica.
 * Útil pra tela "verificar prova" — confirma que o que tá no Firestore reflete
 * o que tá on-chain (e vice-versa).
 *
 * @param {string} attestationPda - base58 da PDA
 * @returns {Promise<DecodedAttestation>}
 */
export async function fetchAttestationOnChain(attestationPda) {
  if (!attestationPda) throw new Error('attestationPda obrigatório');

  const conn = getConnection();
  const pubkey = new PublicKey(attestationPda);
  const info = await conn.getAccountInfo(pubkey, 'confirmed');

  if (!info) throw new Error('Atestação não encontrada on-chain (PDA pode não existir ainda)');
  if (info.owner.toBase58() !== SAS_PROGRAM_ID) {
    throw new Error('Conta não pertence ao programa SAS');
  }

  return parseAttestationAccount(info.data);
}

/**
 * Verifica se uma atestação no Firestore bate com o que tá on-chain.
 * Retorna { matches: bool, firestore, onchain, mismatches: string[] }.
 *
 * @param {Object} firestoreDoc - retorno de listUserAttestations
 * @returns {Promise<VerificationResult>}
 */
export async function verifyAttestation(firestoreDoc) {
  if (!firestoreDoc?.attestationPda) {
    return { matches: false, reason: 'doc sem attestationPda (provavelmente Memo program antigo)' };
  }

  const onchain = await fetchAttestationOnChain(firestoreDoc.attestationPda);
  const fc = firestoreDoc;
  const oc = onchain.data;

  const mismatches = [];
  if (fc.sessionId && fc.sessionId !== oc.sessionId) mismatches.push('sessionId');
  if (fc.duracaoMinutos !== oc.durationMinutes) mismatches.push('duracaoMinutos');
  if (fc.pontos !== oc.pontos) mismatches.push('pontos');

  return {
    matches: mismatches.length === 0,
    mismatches,
    firestore: fc,
    onchain,
  };
}
