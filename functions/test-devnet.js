'use strict';

/**
 * test-devnet.js
 * Testa o fluxo end-to-end no devnet:
 *   1. Chama acumularPontosOnChain com um UID de teste
 *   2. Lê a PDA de volta e imprime o estado
 *
 * Uso:
 *   SOLANA_PRIVATE_KEY=<base58> node test-devnet.js [uid] [pontos] [minutos]
 *
 * Exemplo:
 *   SOLANA_PRIVATE_KEY=4UiVBe... node test-devnet.js uid_teste_123 500 5
 */

const { Keypair, Connection, PublicKey } = require('@solana/web3.js');
const { AnchorProvider, Program, BN } = require('@coral-xyz/anchor');
const bs58 = require('bs58');
const crypto = require('crypto');

const IDL = require('../programs/cnb-program/target/idl/cnb_program.json');
const { acumularPontosOnChain } = require('./anchor-helper');

const PROGRAM_ID = 'BoVj5VrUx4zzE9JWFrneGWyePNt4DYGP2AHb9ZUxXZmo';
const CLUSTER_URL = 'https://api.devnet.solana.com';

// ─── Args ────────────────────────────────────────────────────────────────────

// Aceita chave como 1º argumento ou via env var
const privateKeyB58 = process.argv[2] ?? process.env.SOLANA_PRIVATE_KEY;
if (!privateKeyB58) {
  console.error('❌  Chave não fornecida.');
  console.error('    Uso: node test-devnet.js <chave_base58> [uid] [pontos] [minutos]');
  process.exit(1);
}

const testUid    = process.argv[3] ?? 'uid_teste_cnb_devnet';
const testPontos = parseInt(process.argv[4] ?? '300', 10);
const testMinutos = parseInt(process.argv[5] ?? '3', 10);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function carregarKeypair(value) {
  const v = value.trim();
  console.log(`  [debug] key length: ${v.length}, starts: ${v.slice(0,6)}..., ends: ...${v.slice(-4)}`);
  // Verifica caracteres inválidos base58
  const invalid = [...v].filter(c => !'123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'.includes(c));
  if (invalid.length > 0) {
    console.error(`  [debug] chars inválidos encontrados: ${JSON.stringify(invalid)}`);
  }
  try {
    return Keypair.fromSecretKey(new Uint8Array(JSON.parse(v)));
  } catch {
    return Keypair.fromSecretKey(bs58.decode(v));
  }
}

function uidToHashBytes(uid) {
  return Array.from(crypto.createHash('sha256').update(uid).digest().slice(0, 16));
}

function getUserPDA(uidHashBytes) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('user'), Buffer.from(uidHashBytes)],
    new PublicKey(PROGRAM_ID),
  );
  return pda;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n═══════════════════════════════════════════');
  console.log('  CNBMobile — Teste devnet end-to-end');
  console.log('═══════════════════════════════════════════');
  console.log(`  UID:     ${testUid}`);
  console.log(`  Pontos:  ${testPontos}`);
  console.log(`  Minutos: ${testMinutos}`);
  console.log('');

  const keypair = carregarKeypair(privateKeyB58);
  console.log(`  Authority: ${keypair.publicKey.toBase58()}`);

  const connection = new Connection(CLUSTER_URL, 'confirmed');
  const balance = await connection.getBalance(keypair.publicKey);
  console.log(`  Balance:   ${(balance / 1e9).toFixed(4)} SOL`);

  if (balance === 0) {
    console.error('\n❌  Sem SOL no devnet. Faça airdrop:');
    console.error(`    solana airdrop 1 ${keypair.publicKey.toBase58()} --url devnet`);
    process.exit(1);
  }

  // 1. Chama acumularPontosOnChain
  console.log('\n[1/2] Chamando acumularPontosOnChain...');
  let sig;
  try {
    sig = await acumularPontosOnChain(keypair, testUid, testPontos, testMinutos, null);
    console.log(`  ✅  Transação confirmada`);
    console.log(`  Sig: ${sig}`);
    console.log(`  Explorer: https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  } catch (err) {
    console.error(`  ❌  Erro: ${err.message}`);
    process.exit(1);
  }

  // 2. Lê a PDA e exibe o estado
  console.log('\n[2/2] Lendo PDA...');
  try {
    const uidHashBytes = uidToHashBytes(testUid);
    const pda = getUserPDA(uidHashBytes);
    console.log(`  PDA: ${pda.toBase58()}`);

    const wallet = {
      publicKey: keypair.publicKey,
      signTransaction: async (tx) => { tx.partialSign(keypair); return tx; },
      signAllTransactions: async (txs) => { txs.forEach(tx => tx.partialSign(keypair)); return txs; },
    };
    const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
    const program = new Program(IDL, provider);

    const account = await program.account.userAccount.fetch(pda);

    console.log('\n  ┌─ UserAccount ───────────────────────────');
    console.log(`  │  uid_hash[0..4]: [${account.uidHash.slice(0, 4).join(', ')}]`);
    console.log(`  │  pontos:         ${account.pontos.toString()}`);
    console.log(`  │  minutos:        ${account.minutos}`);
    console.log(`  │  nivel:          ${account.nivel}`);
    console.log(`  │  referrer:       ${account.referrer ? '[definido]' : 'null'}`);
    console.log(`  │  bump:           ${account.bump}`);
    console.log('  └─────────────────────────────────────────\n');

    // 3. Testa resgatar_tokens (debita 100 pontos)
    const { tentarResgatarTokensOnChain } = require('./anchor-helper');
    console.log('[3/3] Testando tentarResgatarTokensOnChain (debita 100 pontos)...');
    const resgate = await tentarResgatarTokensOnChain(keypair, testUid, 100);
    if (resgate.success) {
      console.log(`  ✅  Resgate on-chain confirmado`);
      console.log(`  Sig: ${resgate.signature}`);
      // Lê PDA de novo para confirmar débito
      const after = await program.account.userAccount.fetch(pda);
      console.log(`  Pontos após resgate: ${after.pontos.toString()} (esperado: ${account.pontos.toNumber() - 100})`);
    } else {
      console.warn(`  ⚠️   Resgate não executado — ${resgate.reason}`);
      if (resgate.error) console.warn(`  Detalhe: ${resgate.error}`);
    }

    console.log('\n✅  Todos os testes concluídos!\n');
  } catch (err) {
    console.error(`  ❌  Erro: ${err.message}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
