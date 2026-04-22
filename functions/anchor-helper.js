/**
 * anchor-helper.js
 * Integração Cloud Functions ↔ Anchor program (cnb-program na Solana mainnet).
 *
 * Estratégia Phase 3:
 * - acumular_pontos: on-chain (mainnet) + mirror Firestore
 * - resgatar_tokens: Anchor é source of truth; Firestore é mirror
 *   Fallback para Firestore se o usuário ainda não tem PDA inicializado.
 */

'use strict';

const { AnchorProvider, Program, setProvider, web3 } = require('@coral-xyz/anchor');
const crypto = require('crypto');

const PROGRAM_ID = 'BoVj5VrUx4zzE9JWFrneGWyePNt4DYGP2AHb9ZUxXZmo';
const CLUSTER_URL = 'https://api.devnet.solana.com';

// IDL gerado pelo `anchor build`
const IDL = {
  address: PROGRAM_ID,
  metadata: { name: 'cnb_program', version: '0.1.0', spec: '0.1.0' },
  instructions: [
    {
      name: 'initialize_user',
      discriminator: [111, 17, 185, 250, 60, 122, 38, 254],
      accounts: [
        { name: 'authority', writable: true, signer: true },
        { name: 'user_account', writable: true, pda: { seeds: [{ kind: 'const', value: [117,115,101,114] }, { kind: 'arg', path: 'uid_hash' }] } },
        { name: 'system_program', address: '11111111111111111111111111111111' },
      ],
      args: [{ name: 'uid_hash', type: { array: ['u8', 16] } }],
    },
    {
      name: 'acumular_pontos',
      discriminator: [48, 47, 90, 13, 87, 250, 101, 238],
      accounts: [
        { name: 'authority', signer: true },
        { name: 'user_account', writable: true, pda: { seeds: [{ kind: 'const', value: [117,115,101,114] }, { kind: 'arg', path: 'uid_hash' }] } },
      ],
      args: [
        { name: 'uid_hash', type: { array: ['u8', 16] } },
        { name: 'pontos', type: 'u64' },
        { name: 'minutos', type: 'u32' },
      ],
    },
    {
      name: 'resgatar_tokens',
      discriminator: [41, 101, 165, 255, 181, 227, 18, 58],
      accounts: [
        { name: 'authority', signer: true },
        { name: 'user_account', writable: true, pda: { seeds: [{ kind: 'const', value: [117,115,101,114] }, { kind: 'arg', path: 'uid_hash' }] } },
      ],
      args: [
        { name: 'uid_hash', type: { array: ['u8', 16] } },
        { name: 'quantidade', type: 'u64' },
      ],
    },
  ],
  accounts: [{ name: 'UserAccount', discriminator: [211, 33, 136, 16, 186, 110, 242, 127] }],
  errors: [
    { code: 6000, name: 'UnauthorizedAuthority' },
    { code: 6001, name: 'InvalidPontosAmount' },
    { code: 6002, name: 'InvalidMinutosAmount' },
    { code: 6003, name: 'InsufficientPontos' },
    { code: 6004, name: 'BelowMinimumRedeem' },
  ],
  types: [
    {
      name: 'UserAccount',
      type: {
        kind: 'struct',
        fields: [
          { name: 'uid_hash', type: { array: ['u8', 16] } },
          { name: 'pontos', type: 'u64' },
          { name: 'minutos', type: 'u32' },
          { name: 'nivel', type: 'u8' },
          { name: 'bump', type: 'u8' },
        ],
      },
    },
  ],
};

/**
 * Deriva os 16 bytes do uid_hash a partir do Firebase UID.
 * sha256(uid).slice(0, 16) — preserva privacidade na chain pública.
 */
function uidToHashBytes(uid) {
  return Array.from(crypto.createHash('sha256').update(uid).digest().slice(0, 16));
}

/**
 * Constrói o AnchorProvider e o Program a partir do keypair do projeto.
 */
function buildAnchorProgram(keypair) {
  const connection = new web3.Connection(CLUSTER_URL, 'confirmed');

  const wallet = {
    publicKey: keypair.publicKey,
    signTransaction: async (tx) => { tx.partialSign(keypair); return tx; },
    signAllTransactions: async (txs) => { txs.forEach(tx => tx.partialSign(keypair)); return txs; },
  };

  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  setProvider(provider);

  const program = new Program(IDL, provider);
  return { program, connection };
}

/**
 * Retorna o PDA do usuário (sem criar).
 */
function getUserPDA(programId, uidHashBytes) {
  const [pda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from('user'), Buffer.from(uidHashBytes)],
    new web3.PublicKey(programId),
  );
  return pda;
}

/**
 * Garante que o UserAccount PDA existe na chain.
 * Idempotente — seguro chamar em toda sessão.
 */
async function ensureUserPDA(program, connection, keypair, uidHashBytes) {
  const userPDA = getUserPDA(PROGRAM_ID, uidHashBytes);

  const info = await connection.getAccountInfo(userPDA);
  if (info !== null) return userPDA;

  await program.methods
    .initializeUser(uidHashBytes)
    .accounts({
      authority: keypair.publicKey,
      userAccount: userPDA,
      systemProgram: web3.SystemProgram.programId,
    })
    .signers([keypair])
    .rpc();

  return userPDA;
}

/**
 * Registra uma sessão de carregamento on-chain (mainnet).
 * Cria o PDA automaticamente se for o primeiro acesso.
 */
async function acumularPontosOnChain(keypair, uid, pontos, minutos) {
  const { program, connection } = buildAnchorProgram(keypair);
  const uidHashBytes = uidToHashBytes(uid);

  const userPDA = await ensureUserPDA(program, connection, keypair, uidHashBytes);

  const sig = await program.methods
    .acumularPontos(uidHashBytes, BigInt(pontos), minutos)
    .accounts({
      authority: keypair.publicKey,
      userAccount: userPDA,
    })
    .signers([keypair])
    .rpc();

  return sig;
}

/**
 * Tenta debitar pontos on-chain (mainnet).
 *
 * Retorna:
 *   { success: true,  signature }  — Anchor debitou; prosseguir com SPL
 *   { success: false, reason }     — PDA não existe ou saldo insuficiente on-chain;
 *                                    usar fallback Firestore
 *
 * Nunca lança — o chamador decide o fluxo baseado em success.
 */
async function tentarResgatarTokensOnChain(keypair, uid, quantidade) {
  try {
    const { program, connection } = buildAnchorProgram(keypair);
    const uidHashBytes = uidToHashBytes(uid);
    const userPDA = getUserPDA(PROGRAM_ID, uidHashBytes);

    // Verifica se PDA existe antes de tentar debitar
    const info = await connection.getAccountInfo(userPDA);
    if (info === null) {
      return { success: false, reason: 'pda_nao_existe' };
    }

    const sig = await program.methods
      .resgatarTokens(uidHashBytes, BigInt(quantidade))
      .accounts({
        authority: keypair.publicKey,
        userAccount: userPDA,
      })
      .signers([keypair])
      .rpc();

    return { success: true, signature: sig };
  } catch (err) {
    // InsufficientPontos = saldo on-chain ainda não espelha o Firestore (usuário antigo)
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
