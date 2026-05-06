/**
 * test-decoder.js — valida o decoder de src/services/sasDecoder.js
 * contra a atestação REAL criada em mainnet pelo test-attestar-mainnet.js.
 *
 * Também compara o resultado com o sas-lib oficial pra garantir paridade.
 *
 * Uso: node functions/scripts/test-decoder.js [<attestationPda>]
 *      (default: a PDA do último teste)
 */

'use strict';

const path = require('path');
const sas = require('sas-lib');
const kit = require('@solana/kit');

// Importa o decoder do app (CJS-friendly via Buffer + bs58 puros)
// Como o arquivo do app usa `import` ESM, precisamos rodar com a flag
// --experimental-default-type=module... ou hardcodar uma cópia mínima.
// Solução pragmática: re-implementar inline aqui pra testar a LÓGICA;
// o arquivo do app é uma transcrição direta dessa lógica.

const { Buffer } = require('buffer');
const bs58Module = require('bs58');
const bs58 = bs58Module.default || bs58Module;
const { PublicKey } = require('@solana/web3.js');

const SAS_SCHEMA_PDA = '5DiFbEsEv9SLWpjAodtVqiuVUydTTKggrmJ6NV1xzymy';

function parseAttestationAccount(rawBytes) {
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

  if (schema !== SAS_SCHEMA_PDA) {
    throw new Error(`Schema inesperado: ${schema}`);
  }

  // Decodifica data
  let o = 0;
  const uidHashLen = dataBuf.readUInt32LE(o); o += 4;
  const uidHash = dataBuf.slice(o, o + uidHashLen).toString('hex'); o += uidHashLen;
  const sessionIdLen = dataBuf.readUInt32LE(o); o += 4;
  const sessionId = dataBuf.slice(o, o + sessionIdLen).toString('utf-8'); o += sessionIdLen;
  const durationMinutes = dataBuf.readUInt32LE(o); o += 4;
  const endedAt = Number(dataBuf.readBigInt64LE(o)); o += 8;
  const pontos = dataBuf.readUInt32LE(o); o += 4;
  const userPubkeyLen = dataBuf.readUInt32LE(o); o += 4;
  const userPubkeyBytes = dataBuf.slice(o, o + userPubkeyLen);
  const userPubkey = userPubkeyLen === 32 ? bs58.encode(userPubkeyBytes) : null;

  return {
    discriminator, nonce, credential, schema, signer, expiry, tokenAccount,
    data: { uidHash, sessionId, durationMinutes, endedAt, pontos, userPubkey },
  };
}

(async () => {
  // Default: a atestação criada pelo último test-attestar-mainnet.js
  const targetPda = process.argv[2] || 'EVCmJrnNs8S5reL7d6px76YQkyu4VaBv8ZeFZsgH5nNM';

  console.log('Test decoder vs sas-lib');
  console.log('=======================');
  console.log('attestation:', targetPda);

  // 1. Fetch raw via web3.js v1 (mesmo path do mobile)
  const { Connection } = require('@solana/web3.js');
  const conn = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  const info = await conn.getAccountInfo(new PublicKey(targetPda), 'confirmed');
  if (!info) {
    console.error('FAIL: PDA não existe on-chain');
    process.exit(1);
  }
  console.log('account size:', info.data.length, 'bytes; owner:', info.owner.toBase58());

  // 2. Decode com nosso decoder hand-rolled (espelha src/services/sasDecoder.js)
  const ours = parseAttestationAccount(info.data);
  console.log('\n[ours] decoded:');
  console.log('  uid_hash         :', ours.data.uidHash);
  console.log('  session_id       :', ours.data.sessionId);
  console.log('  duration_minutes :', ours.data.durationMinutes);
  console.log('  ended_at         :', ours.data.endedAt);
  console.log('  pontos           :', ours.data.pontos);
  console.log('  user_pubkey      :', ours.data.userPubkey || '(opt-out)');

  // 3. Decode com sas-lib oficial pra cross-check
  const rpc = kit.createSolanaRpc('https://api.mainnet-beta.solana.com');
  const fetchedSchema = await sas.fetchSchema(rpc, kit.address(SAS_SCHEMA_PDA));
  const fetchedAtt = await sas.fetchAttestation(rpc, kit.address(targetPda));
  const officialDecoded = sas.deserializeAttestationData(
    fetchedSchema.data,
    new Uint8Array(fetchedAtt.data.data),
  );
  console.log('\n[sas-lib] decoded:');
  console.log('  uid_hash         :', Buffer.from(officialDecoded.uid_hash).toString('hex'));
  console.log('  session_id       :', officialDecoded.session_id);
  console.log('  duration_minutes :', officialDecoded.duration_minutes);
  console.log('  ended_at         :', officialDecoded.ended_at?.toString());
  console.log('  pontos           :', officialDecoded.pontos);
  console.log('  user_pubkey len  :', officialDecoded.user_pubkey.length);

  // 4. Compara
  const matches =
    ours.data.uidHash === Buffer.from(officialDecoded.uid_hash).toString('hex') &&
    ours.data.sessionId === officialDecoded.session_id &&
    ours.data.durationMinutes === officialDecoded.duration_minutes &&
    ours.data.endedAt === Number(officialDecoded.ended_at) &&
    ours.data.pontos === officialDecoded.pontos &&
    (officialDecoded.user_pubkey.length === 0
      ? ours.data.userPubkey === null
      : ours.data.userPubkey === bs58.encode(Uint8Array.from(officialDecoded.user_pubkey)));

  console.log('\nparity ours vs sas-lib:', matches ? 'OK' : 'FAIL');
  process.exit(matches ? 0 : 1);
})().catch((e) => {
  console.error('FAIL:', e?.stack || e);
  process.exit(1);
});
