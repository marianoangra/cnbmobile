/**
 * bootstrap-sas.js — cria Credential e Schema do JUICE Charging Network
 * no Solana Attestation Service (mainnet).
 *
 * Idempotente — checa se as PDAs já existem antes de tentar criar.
 * Roda como ferramenta local (não é Cloud Function).
 *
 * Pré-requisitos:
 *   1. node functions/scripts/generate-issuer.js (já feito)
 *   2. Funder a pubkey do issuer com ~0.1 SOL na mainnet
 *
 * Uso:
 *   node functions/scripts/bootstrap-sas.js
 *
 * Override RPC (opcional, ex. Helius):
 *   SAS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=XXX node ...
 */

'use strict';

const fs = require('fs');
const path = require('path');

const kit = require('@solana/kit');
const signers = require('@solana/signers');
const sas = require('sas-lib');

// ─── Configuração permanente ─────────────────────────────────────────────────
// IMPORTANTE: estes valores ficam gravados on-chain. Mudar requer recriar PDAs.
const CREDENTIAL_NAME = 'JUICE Charging Network';
const SCHEMA_NAME = 'Charging Session';
const SCHEMA_VERSION = 1;
const SCHEMA_DESCRIPTION =
  'Atestacao de uma sessao de carregamento de celular no app JUICE. ' +
  'Emitida pelo backend ao final de cada sessao.';

// SchemaDataTypes (ver program/src/state/schema.rs):
//   U8=0  U16=1 U32=2  U64=3  U128=4
//   I8=5  I16=6 I32=7  I64=8  I128=9
//   Bool=10 Char=11 String=12
//   VecU8=13 VecU16=14 ... VecString=25
const SCHEMA_FIELDS = {
  uid_hash:         13, // VecU8 — sha256(firebase_uid)[:16] (16 bytes)
  session_id:       12, // String — UUID gerado no Firestore
  duration_minutes: 2,  // U32   — duracao em minutos (1..1440)
  ended_at:         8,  // I64   — unix timestamp (segundos) do fim da sessao
  pontos:           2,  // U32   — pontos calculados pra essa sessao
  user_pubkey:      13, // VecU8 — wallet do user (32 bytes) ou empty bytes (privacy opt-out)
};

// ─── Setup ───────────────────────────────────────────────────────────────────
const KEYPAIR_FILE = path.resolve(__dirname, '..', '..', 'juice-attestor-keypair.json');
const RPC_URL = process.env.SAS_RPC_URL || 'https://api.mainnet-beta.solana.com';
const RPC_WS  = RPC_URL.replace(/^https/, 'wss').replace(/^http/, 'ws');

const MIN_BALANCE_SOL = 0.01;
const SOLSCAN = (sig) => `https://solscan.io/tx/${sig}`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function loadIssuerSigner() {
  if (!fs.existsSync(KEYPAIR_FILE)) {
    throw new Error(`Keypair nao encontrado em ${KEYPAIR_FILE}\n` +
      `Rode primeiro: node functions/scripts/generate-issuer.js`);
  }
  const arr = JSON.parse(fs.readFileSync(KEYPAIR_FILE, 'utf8'));
  if (!Array.isArray(arr) || arr.length !== 64) {
    throw new Error('Keypair JSON invalido (esperado array de 64 bytes)');
  }
  return signers.createKeyPairSignerFromBytes(new Uint8Array(arr));
}

async function getBalanceSol(rpc, address) {
  const { value } = await rpc.getBalance(address).send();
  return Number(value) / 1e9;
}

async function accountExists(rpc, address) {
  const { value } = await rpc.getAccountInfo(address, { encoding: 'base64' }).send();
  return value !== null;
}

async function sendIx(rpc, rpcSubs, feePayer, ix, label) {
  const { value: blockhash } = await rpc.getLatestBlockhash().send();
  const message = kit.pipe(
    kit.createTransactionMessage({ version: 0 }),
    (tx) => kit.setTransactionMessageFeePayer(feePayer, tx),
    (tx) => kit.setTransactionMessageLifetimeUsingBlockhash(blockhash, tx),
    (tx) => kit.appendTransactionMessageInstruction(ix, tx),
  );
  const signed = await signers.signTransactionMessageWithSigners(message);
  const sendAndConfirm = kit.sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions: rpcSubs });
  await sendAndConfirm(signed, { commitment: 'confirmed', skipPreflight: false });
  const sig = kit.getSignatureFromTransaction(signed);
  console.log(`  → ${label} criado.`);
  console.log(`    ${SOLSCAN(sig)}`);
  return sig;
}

// ─── Main ────────────────────────────────────────────────────────────────────
(async () => {
  console.log('='.repeat(72));
  console.log('Bootstrap SAS — JUICE Charging Network');
  console.log('='.repeat(72));
  console.log('RPC:', RPC_URL);

  const issuer = await loadIssuerSigner();
  console.log('Issuer authority/payer:', issuer.address);

  const rpc = kit.createSolanaRpc(RPC_URL);
  const rpcSubs = kit.createSolanaRpcSubscriptions(RPC_WS);

  // 1. Saldo
  const balance = await getBalanceSol(rpc, issuer.address);
  console.log('Saldo:', balance.toFixed(4), 'SOL');
  if (balance < MIN_BALANCE_SOL) {
    console.error(`\nABORT: saldo insuficiente (precisa ≥ ${MIN_BALANCE_SOL} SOL).`);
    console.error(`Envia SOL pra: ${issuer.address}`);
    console.error(`Solscan: https://solscan.io/account/${issuer.address}`);
    process.exit(1);
  }

  // 2. Credential
  const [credentialPda] = await sas.deriveCredentialPda({
    authority: issuer.address,
    name: CREDENTIAL_NAME,
  });
  console.log('\n[1/2] Credential');
  console.log('  name:', CREDENTIAL_NAME);
  console.log('  pda :', credentialPda);

  if (await accountExists(rpc, credentialPda)) {
    console.log('  → ja existe, pulando criacao.');
  } else {
    const ix = sas.getCreateCredentialInstruction({
      payer: issuer,
      authority: issuer,
      signers: [issuer.address], // somente o issuer pode emitir atestacoes sob esse credential
      credential: credentialPda,
      name: CREDENTIAL_NAME,
    });
    await sendIx(rpc, rpcSubs, issuer.address, ix, 'Credential');
  }

  // 3. Schema
  const [schemaPda] = await sas.deriveSchemaPda({
    credential: credentialPda,
    name: SCHEMA_NAME,
    version: SCHEMA_VERSION,
  });
  console.log('\n[2/2] Schema');
  console.log('  name   :', SCHEMA_NAME, '(v' + SCHEMA_VERSION + ')');
  console.log('  fields :', Object.keys(SCHEMA_FIELDS).join(', '));
  console.log('  layout :', Object.values(SCHEMA_FIELDS).join(', '), '(SchemaDataTypes)');
  console.log('  pda    :', schemaPda);

  if (await accountExists(rpc, schemaPda)) {
    console.log('  → ja existe, pulando criacao.');
  } else {
    const ix = sas.getCreateSchemaInstruction({
      payer: issuer,
      authority: issuer,
      credential: credentialPda,
      schema: schemaPda,
      name: SCHEMA_NAME,
      description: SCHEMA_DESCRIPTION,
      layout: new Uint8Array(Object.values(SCHEMA_FIELDS)),
      fieldNames: Object.keys(SCHEMA_FIELDS),
    });
    await sendIx(rpc, rpcSubs, issuer.address, ix, 'Schema');
  }

  // 4. Output — copiar pra .env / Firebase secrets
  const balanceFinal = await getBalanceSol(rpc, issuer.address);
  console.log('\n' + '='.repeat(72));
  console.log('SUCESSO. Saldo restante:', balanceFinal.toFixed(4), 'SOL');
  console.log('='.repeat(72));
  console.log('\nAdicione ao functions/.env (ou Firebase secrets em prod):');
  console.log();
  console.log(`JUICE_SAS_ISSUER_PUBKEY=${issuer.address}`);
  console.log(`JUICE_SAS_CREDENTIAL_PDA=${credentialPda}`);
  console.log(`JUICE_SAS_SCHEMA_PDA=${schemaPda}`);
  console.log(`JUICE_SAS_SCHEMA_VERSION=${SCHEMA_VERSION}`);
  console.log();
  console.log('Pra Firebase secrets:');
  console.log('  firebase functions:secrets:set JUICE_ATTESTOR_KEYPAIR < juice-attestor-keypair.json');
  console.log();

  process.exit(0); // forca close das subscriptions websocket
})().catch((e) => {
  console.error('\nFAIL:', e?.stack || e);
  process.exit(1);
});
