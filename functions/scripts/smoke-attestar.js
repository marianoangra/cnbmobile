/**
 * smoke-attestar.js — valida sas-helper.js end-to-end SEM emitir atestação real.
 *
 * Executa: load issuer → fetch schema → derive PDAs → serialize data → build ix.
 * Sai antes de send. Custo: 0 SOL (1 RPC read-only).
 *
 * Roda offline (não precisa de saldo no issuer): node functions/scripts/smoke-attestar.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const kit = require('@solana/kit');
const sas = require('sas-lib');
const helper = require('../sas-helper');

const KEYPAIR_FILE = path.resolve(__dirname, '..', '..', 'juice-attestor-keypair.json');

(async () => {
  console.log('Smoke test sas-helper (sem emissão real)');
  console.log('========================================');

  // 1. Issuer
  const keypairJson = fs.readFileSync(KEYPAIR_FILE, 'utf8');
  const issuer = await helper.loadIssuerSigner(keypairJson);
  console.log('[1] issuer       :', issuer.address);

  // 2. Hashes determinísticos
  const FAKE_UID = 'firebase-uid-de-teste-xxx';
  const FAKE_SESSION_ID = '7f3e1b8a-2c4d-4e5f-9a1b-3c5d7e9f1a2b';
  const uidHash = helper.computeUidHash(FAKE_UID);
  const nonce = helper.computeNonce(FAKE_SESSION_ID);
  console.log('[2] uid_hash     :', uidHash.toString('hex'), `(${uidHash.length} bytes)`);
  console.log('    nonce        :', nonce, '(determinístico)');

  // 3. Fetch schema da mainnet (read-only)
  const rpc = kit.createSolanaRpc('https://api.mainnet-beta.solana.com');
  const schemaAddr = kit.address(helper.SCHEMA_PDA);
  const fetched = await sas.fetchSchema(rpc, schemaAddr);
  const schemaData = fetched.data;
  console.log('[3] schema       :', helper.SCHEMA_PDA);
  console.log('    layout       :', Array.from(schemaData.layout).join(', '));
  console.log('    field count  :', schemaData.layout.length);

  // 4. Derive attestation PDA
  const [attestationPda] = await sas.deriveAttestationPda({
    credential: kit.address(helper.CREDENTIAL_PDA),
    schema: schemaAddr,
    nonce: kit.address(nonce),
  });
  console.log('[4] attestation  :', attestationPda);

  // 5. Builda data e serializa
  const FAKE_USER_PUBKEY = '9YoNgPF2bkaRcdzWEE47atb5s2CUx7vUjXmmZuFPv3tX'; // o próprio issuer só pra teste
  const dataObj = {
    uid_hash:         Array.from(uidHash),
    session_id:       FAKE_SESSION_ID,
    duration_minutes: 60,
    ended_at:         BigInt(Math.floor(Date.now() / 1000)),
    pontos:           650,
    user_pubkey:      Array.from(new (require('@solana/web3.js').PublicKey)(FAKE_USER_PUBKEY).toBytes()),
  };
  const dataBytes = sas.serializeAttestationData(schemaData, dataObj);
  console.log('[5] data bytes   :', dataBytes.length, 'bytes');
  console.log('    hex preview  :', Buffer.from(dataBytes).toString('hex').slice(0, 80) + '...');

  // 6. Builda a instruction (não envia)
  const ix = sas.getCreateAttestationInstruction({
    payer: issuer,
    authority: issuer,
    credential: kit.address(helper.CREDENTIAL_PDA),
    schema: schemaAddr,
    nonce: kit.address(nonce),
    expiry: 0,
    data: dataBytes,
    attestation: attestationPda,
  });
  console.log('[6] instruction  : built ok');
  console.log('    program      :', ix.programAddress);
  console.log('    accounts     :', ix.accounts.length);

  // 7. Sanity check: deserialize e compara
  const decoded = sas.deserializeAttestationData(schemaData, dataBytes);
  const matches = decoded.session_id === dataObj.session_id
    && decoded.duration_minutes === dataObj.duration_minutes
    && decoded.pontos === dataObj.pontos;
  console.log('[7] roundtrip    :', matches ? 'OK' : 'FAIL');
  if (!matches) {
    console.log('    expected     :', dataObj);
    console.log('    decoded      :', decoded);
    process.exit(1);
  }

  console.log('\nALL GOOD — sas-helper validado, pronto pra F3.');
  process.exit(0);
})().catch((e) => {
  console.error('\nSMOKE FAIL:');
  console.error(e?.stack || e);
  process.exit(1);
});
