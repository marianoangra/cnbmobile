'use strict';

/**
 * cloak-helper.js
 * Integração com o Cloak SDK para resgate privado de pontos CNB via Solana.
 *
 * Fluxo:
 *   1. Projeto deposita SOL no pool shielded do Cloak (UTXO shielded)
 *   2. Relay do Cloak faz withdraw privado para o usuário sem link on-chain
 *   → Nenhum observer consegue ligar project_wallet ↔ user_wallet
 *
 * Taxa de câmbio: 100.000 pontos = 0.01 SOL (depósito mínimo do Cloak)
 * Fee do relay:    ~0.005 SOL (fixo) + 0.3% variável
 * Usuário recebe: ~0.005 SOL líquido por 100.000 pontos
 */

const {
  CLOAK_PROGRAM_ID,
  NATIVE_SOL_MINT,
  MIN_DEPOSIT_LAMPORTS,
  FIXED_FEE_LAMPORTS,
  createUtxo,
  createZeroUtxo,
  generateUtxoKeypair,
  transact,
  fullWithdraw,
} = require('@cloak.dev/sdk');
const { Connection, PublicKey } = require('@solana/web3.js');

const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';

// 100.000 pontos = 0.01 SOL (MIN_DEPOSIT_LAMPORTS)
const LAMPORTS_PER_BLOCO = MIN_DEPOSIT_LAMPORTS; // 10_000_000
const PONTOS_POR_BLOCO = 100_000;

/**
 * Converte pontos para lamports (arredonda para múltiplo do bloco mínimo).
 * Ex: 200.000 pontos → 20.000.000 lamports (0.02 SOL)
 */
function pontosToLamports(pontos) {
  const blocos = Math.floor(pontos / PONTOS_POR_BLOCO);
  return blocos * LAMPORTS_PER_BLOCO;
}

/**
 * Executa um resgate privado de pontos CNB via Cloak.
 *
 * @param {import('@solana/web3.js').Keypair} keypair - Keypair do projeto
 * @param {number} pontos - Quantidade de pontos a resgatar (mínimo 100.000)
 * @param {string} recipientAddress - Endereço Solana do usuário
 * @returns {{ depositSignature, transferSignature, amountLamports, netLamports }}
 */
async function resgatarPontosPrivado(keypair, pontos, recipientAddress) {
  const connection = new Connection(MAINNET_RPC, 'confirmed');
  const recipient = new PublicKey(recipientAddress);
  const amountLamports = pontosToLamports(pontos);

  if (amountLamports < MIN_DEPOSIT_LAMPORTS) {
    throw new Error(`Mínimo de ${PONTOS_POR_BLOCO.toLocaleString()} pontos para resgate privado.`);
  }

  // ── 1. Depósito no pool shielded ──────────────────────────────────────────
  console.log(`[Cloak] Depositando ${amountLamports} lamports (${pontos} pontos)...`);

  const owner = await generateUtxoKeypair();
  const output = await createUtxo(BigInt(amountLamports), owner, NATIVE_SOL_MINT);

  const deposited = await transact(
    {
      inputUtxos: [await createZeroUtxo(NATIVE_SOL_MINT)],
      outputUtxos: [output],
      externalAmount: BigInt(amountLamports),
      depositor: keypair.publicKey,
    },
    {
      connection,
      programId: CLOAK_PROGRAM_ID,
      depositorKeypair: keypair,
      walletPublicKey: keypair.publicKey,
      enforceViewingKeyRegistration: false,
    },
  );

  console.log(`[Cloak] Depósito confirmado.`);

  // ── 2. Withdraw privado via relay para carteira do usuário ────────────────
  console.log(`[Cloak] Enviando privado para ${recipientAddress.slice(0, 8)}...`);

  const withdrawn = await fullWithdraw(deposited.outputUtxos, recipient, {
    connection,
    programId: CLOAK_PROGRAM_ID,
    depositorKeypair: keypair,
    walletPublicKey: keypair.publicKey,
    cachedMerkleTree: deposited.merkleTree,
    enforceViewingKeyRegistration: false,
  });

  console.log(`[Cloak] Transferência privada confirmada: ${withdrawn.signature}`);

  const netLamports = amountLamports - FIXED_FEE_LAMPORTS;

  return {
    depositSignature: withdrawn.signature, // transact+fullWithdraw é uma operação atômica
    transferSignature: withdrawn.signature,
    amountLamports,
    netLamports: netLamports > 0 ? netLamports : 0,
  };
}

module.exports = {
  resgatarPontosPrivado,
  pontosToLamports,
  PONTOS_POR_BLOCO,
  MIN_DEPOSIT_LAMPORTS,
  FIXED_FEE_LAMPORTS,
};
