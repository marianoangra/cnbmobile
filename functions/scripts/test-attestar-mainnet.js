/**
 * test-attestar-mainnet.js — emite UMA atestação real na mainnet pra validar
 * o sas-helper end-to-end. Custa ~0.0021 SOL ($0.36) por execução.
 *
 * Uso: node functions/scripts/test-attestar-mainnet.js
 *
 * Reaproveita o keypair local. Mesmo path de código que a Cloud Function
 * `registrarProvasSessao` vai rodar em produção — se passar aqui, passa lá.
 *
 * Atenção: cada run gera uma sessionId nova, então cria uma atestação nova
 * (não bate na PDA da run anterior). Pra testar idempotência, fixe o sessionId.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const helper = require('../sas-helper');
const sas = require('sas-lib');
const kit = require('@solana/kit');

const KEYPAIR_FILE = path.resolve(__dirname, '..', '..', 'juice-attestor-keypair.json');

(async () => {
  console.log('Test mainnet: emitir 1 atestação SAS real');
  console.log('=========================================');

  // 1. Carrega issuer
  const keypairJson = fs.readFileSync(KEYPAIR_FILE, 'utf8');
  const issuer = await helper.loadIssuerSigner(keypairJson);

  // 2. Mock dados — replicam o que registrarProvasSessao envia em produção
  const params = {
    firebaseUid:     'test-uid-juice-attestor-' + Date.now(),
    sessionId:       crypto.randomUUID(),
    durationMinutes: 60,
    endedAtSec:      Math.floor(Date.now() / 1000),
    pontos:          650, // 60 min * 10 + 1 hour bonus 50
    userPubkey:      null, // privacy mode — testa o branch opt-out
  };

  console.log('issuer  :', issuer.address);
  console.log('uid     :', params.firebaseUid);
  console.log('session :', params.sessionId);
  console.log('duration:', params.durationMinutes, 'min |', params.pontos, 'pts');
  console.log();

  // 3. Saldo antes
  const rpc = kit.createSolanaRpc('https://api.mainnet-beta.solana.com');
  const before = (await rpc.getBalance(issuer.address).send()).value;
  console.log('saldo antes :', Number(before) / 1e9, 'SOL');

  // 4. Emite!
  const t0 = Date.now();
  const result = await helper.attestarSessao(issuer, params);
  const elapsed = Date.now() - t0;
  console.log();
  console.log('SUCCESS em', elapsed, 'ms');
  console.log('  signature      :', result.signature);
  console.log('  attestationPda :', result.attestationPda);
  console.log('  nonce          :', result.nonce);
  console.log();
  console.log('Solscan:');
  console.log('  tx  :', `https://solscan.io/tx/${result.signature}`);
  console.log('  pda :', `https://solscan.io/account/${result.attestationPda}`);

  // 5. Saldo depois
  const after = (await rpc.getBalance(issuer.address).send()).value;
  const cost = (Number(before) - Number(after)) / 1e9;
  console.log();
  console.log('saldo depois:', Number(after) / 1e9, 'SOL');
  console.log('custo       :', cost.toFixed(6), 'SOL (~$' + (cost * 170).toFixed(2) + ')');

  // 6. Roundtrip — fetcha a Attestation account e decodifica
  console.log('\n[roundtrip] fetchando + decodificando a attestation criada...');
  const fetchedSchema = await sas.fetchSchema(rpc, kit.address(helper.SCHEMA_PDA));
  const fetchedAtt = await sas.fetchAttestation(rpc, kit.address(result.attestationPda));
  const decoded = sas.deserializeAttestationData(fetchedSchema.data, new Uint8Array(fetchedAtt.data.data));
  console.log('decoded:');
  console.log('  session_id      :', decoded.session_id);
  console.log('  duration_minutes:', decoded.duration_minutes);
  console.log('  pontos          :', decoded.pontos);
  console.log('  ended_at        :', decoded.ended_at?.toString(), '(unix sec)');
  console.log('  uid_hash        :', Buffer.from(decoded.uid_hash).toString('hex'));
  console.log('  user_pubkey len :', decoded.user_pubkey.length, '(0 = opt-out)');

  const matches = decoded.session_id === params.sessionId
    && decoded.duration_minutes === params.durationMinutes
    && decoded.pontos === params.pontos;
  console.log('\nroundtrip:', matches ? 'OK ✓' : 'FAIL ✗');

  process.exit(matches ? 0 : 1);
})().catch((e) => {
  console.error('\nFAIL:', e?.stack || e);
  process.exit(1);
});
