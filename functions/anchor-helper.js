/**
 * anchor-helper.js
 * Integração Cloud Functions ↔ Anchor program (cnb-program no devnet/mainnet).
 *
 * Estratégia atual (Phase 2 — dual-write devnet):
 * - acumular_pontos: Firestore é source of truth + espelho on-chain não-crítico
 * - resgatar_tokens: Anchor debita on-chain; fallback Firestore se PDA não existe
 *
 * Para migrar para mainnet: trocar CLUSTER_URL.
 */

'use strict';

const { AnchorProvider, Program, BN } = require('@coral-xyz/anchor');
const { Connection, PublicKey, SystemProgram } = require('@solana/web3.js');
const crypto = require('crypto');

// IDL gerada pelo `anchor build` — sempre sincronizada com o programa deployado
const IDL = require('../programs/cnb-program/target/idl/cnb_program.json');

const PROGRAM_ID = 'BoVj5VrUx4zzE9JWFrneGWyePNt4DYGP2AHb9ZUxXZmo';
const CLUSTER_URL = 'https://api.devnet.solana.com'; // → mainnet quando pronto

/**
 * sha256(uid).slice(0, 16) — identificador privado on-chain.
 * Retorna Array<number> (16 elementos) — formato esperado pelo Anchor.
 */
function uidToHashBytes(uid) {
  return Array.from(crypto.createHash('sha256').update(uid).digest().slice(0, 16));
}

/**
 * Constrói AnchorProvider e Program a partir do keypair do projeto.
 */
function buildAnchorProgram(keypair) {
  const connection = new Connection(CLUSTER_URL, 'confirmed');
  const wallet = {
    publicKey: keypair.publicKey,
    signTransaction: async (tx) => { tx.partialSign(keypair); return tx; },
    signAllTransactions: async (txs) => { txs.forEach(tx => tx.partialSign(keypair)); return txs; },
  };
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  const program = new Program(IDL, provider);
  return { program, connection };
}

/**
 * Deriva o PDA do usuário sem criar conta.
 */
function getUserPDA(uidHashBytes) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('user'), Buffer.from(uidHashBytes)],
    new PublicKey(PROGRAM_ID),
  );
  return pda;
}

/**
 * Garante que o UserAccount PDA existe na chain.
 * Idempotente — seguro chamar em toda sessão.
 * @param {string|null} referrerUid - Firebase UID do referrer (null se sem indicação)
 */
async function ensureUserPDA(program, connection, keypair, uidHashBytes, referrerUid = null) {
  const userPDA = getUserPDA(uidHashBytes);

  const info = await connection.getAccountInfo(userPDA);
  if (info !== null) return userPDA; // já existe

  const referrerHash = referrerUid
    ? Array.from(crypto.createHash('sha256').update(referrerUid).digest().slice(0, 16))
    : null;

  await program.methods
    .initializeUser(uidHashBytes, referrerHash)
    .accounts({
      authority: keypair.publicKey,
      userAccount: userPDA,
      systemProgram: SystemProgram.programId,
    })
    .signers([keypair])
    .rpc();

  console.log(`[Anchor] UserAccount criado — uid_hash[0..4]: ${uidHashBytes.slice(0, 4)}`);
  return userPDA;
}

/**
 * Registra uma sessão de carregamento on-chain.
 * Cria o PDA automaticamente na primeira vez.
 *
 * @param {Keypair} keypair - Keypair da authority
 * @param {string} uid - Firebase UID do usuário
 * @param {number} pontos - Pontos da sessão (1–20.000)
 * @param {number} minutos - Minutos da sessão (1–1.440)
 * @param {string|null} referrerUid - UID do referrer para criação do PDA (opcional)
 * @returns {string} signature
 */
async function acumularPontosOnChain(keypair, uid, pontos, minutos, referrerUid = null) {
  const { program, connection } = buildAnchorProgram(keypair);
  const uidHashBytes = uidToHashBytes(uid);

  await ensureUserPDA(program, connection, keypair, uidHashBytes, referrerUid);

  const sig = await program.methods
    .acumularPontos(uidHashBytes, new BN(pontos), minutos)
    .accounts({
      authority: keypair.publicKey,
      userAccount: getUserPDA(uidHashBytes),
    })
    .signers([keypair])
    .rpc();

  return sig;
}

/**
 * Tenta debitar pontos on-chain antes do SPL transfer.
 *
 * Retorna:
 *   { success: true,  signature }  — Anchor debitou; prosseguir com SPL
 *   { success: false, reason }     — PDA não existe ou saldo insuficiente;
 *                                    usar fallback Firestore
 *
 * Nunca lança — o chamador decide o fluxo.
 */
async function tentarResgatarTokensOnChain(keypair, uid, quantidade) {
  try {
    const { program, connection } = buildAnchorProgram(keypair);
    const uidHashBytes = uidToHashBytes(uid);
    const userPDA = getUserPDA(uidHashBytes);

    const info = await connection.getAccountInfo(userPDA);
    if (info === null) {
      return { success: false, reason: 'pda_nao_existe' };
    }

    const sig = await program.methods
      .resgatarTokens(uidHashBytes, new BN(quantidade))
      .accounts({
        authority: keypair.publicKey,
        userAccount: userPDA,
      })
      .signers([keypair])
      .rpc();

    return { success: true, signature: sig };

  } catch (err) {
    const isInsufficient = err?.message?.includes('InsufficientPontos') ||
      err?.message?.includes('6003');
    return {
      success: false,
      reason: isInsufficient ? 'saldo_insuficiente_onchain' : 'erro_desconhecido',
      error: err.message,
    };
  }
}

module.exports = {
  uidToHashBytes,
  acumularPontosOnChain,
  tentarResgatarTokensOnChain,
};
