/**
 * anchor-helper.js
 * Integração Cloud Functions ↔ Anchor program (cnb-program na Solana).
 *
 * Estratégia Phase 2: dual-write.
 * Firestore continua como source of truth para leitura no app.
 * O Anchor program recebe os mesmos dados on-chain como prova auditável.
 */

'use strict';

const { AnchorProvider, Program, setProvider, web3 } = require('@coral-xyz/anchor');
const crypto = require('crypto');

const PROGRAM_ID = 'BoVj5VrUx4zzE9JWFrneGWyePNt4DYGP2AHb9ZUxXZmo';
const CLUSTER_URL = 'https://api.devnet.solana.com';

// IDL gerado pelo `anchor build` — descreve as instruções do programa on-chain
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
 * @param {web3.Keypair} keypair - authority (carteira do servidor)
 * @returns {{ program: Program, connection: web3.Connection }}
 */
function buildAnchorProgram(keypair) {
  const connection = new web3.Connection(CLUSTER_URL, 'confirmed');

  // AnchorProvider mínimo — sem wallet browser, só keypair do servidor
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
 * Garante que o UserAccount PDA existe na chain.
 * Se ainda não existir, chama initialize_user.
 * Idempotente — seguro chamar em toda sessão.
 */
async function ensureUserPDA(program, connection, keypair, uidHashBytes) {
  const [userPDA] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from('user'), Buffer.from(uidHashBytes)],
    program.programId,
  );

  const info = await connection.getAccountInfo(userPDA);
  if (info !== null) return userPDA; // já existe

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
 * Registra uma sessão de carregamento on-chain.
 * Cria o PDA se necessário, depois chama acumular_pontos.
 *
 * @param {web3.Keypair} keypair
 * @param {string} uid - Firebase UID
 * @param {number} pontos - pontos da sessão (1–20000)
 * @param {number} minutos - duração em minutos (1–1440)
 * @returns {Promise<string>} signature da transação
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
 * Debita pontos on-chain antes do SPL transfer.
 * Lança erro se saldo insuficiente (InsufficientPontos).
 *
 * @param {web3.Keypair} keypair
 * @param {string} uid - Firebase UID
 * @param {number} quantidade - pontos a debitar
 * @returns {Promise<string>} signature da transação
 */
async function resgatarTokensOnChain(keypair, uid, quantidade) {
  const { program, connection } = buildAnchorProgram(keypair);
  const uidHashBytes = uidToHashBytes(uid);

  const [userPDA] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from('user'), Buffer.from(uidHashBytes)],
    program.programId,
  );

  const sig = await program.methods
    .resgatarTokens(uidHashBytes, BigInt(quantidade))
    .accounts({
      authority: keypair.publicKey,
      userAccount: userPDA,
    })
    .signers([keypair])
    .rpc();

  return sig;
}

module.exports = { uidToHashBytes, acumularPontosOnChain, resgatarTokensOnChain };
