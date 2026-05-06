/**
 * generate-issuer.js — gera keypair Ed25519 dedicado pro issuer SAS (JUICE).
 *
 * Roda UMA vez. Salva o keypair em juice-attestor-keypair.json na raiz do repo
 * (mesma pasta do kora-keypair.json) — gitignored via padrão *-keypair.json.
 *
 * Uso: node functions/scripts/generate-issuer.js
 *
 * IMPORTANTE: este keypair é a authority de TODAS as atestações JUICE.
 * Se ele for perdido ou regenerado, atestações antigas continuam válidas
 * mas novas terão authority diferente — quebra a cadeia de confiança.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { Keypair } = require('@solana/web3.js');

const KEYPAIR_PATH = path.resolve(__dirname, '..', '..', 'juice-attestor-keypair.json');

if (fs.existsSync(KEYPAIR_PATH)) {
  console.error('ABORT: keypair já existe em', KEYPAIR_PATH);
  console.error('Pra regenerar, delete o arquivo manualmente primeiro.');
  console.error('CUIDADO: regenerar invalida a cadeia de confiança das atestações existentes.');
  process.exit(1);
}

const kp = Keypair.generate();
fs.writeFileSync(KEYPAIR_PATH, JSON.stringify(Array.from(kp.secretKey)));
try { fs.chmodSync(KEYPAIR_PATH, 0o600); } catch {} // best-effort, no-op em Windows

const pubkey = kp.publicKey.toBase58();

console.log('Issuer keypair gerado com sucesso.');
console.log('');
console.log('  pubkey:  ' + pubkey);
console.log('  arquivo: ' + KEYPAIR_PATH);
console.log('');
console.log('Próximos passos:');
console.log('  1. BACKUP esse arquivo (cofre, password manager — o que tu usar).');
console.log('  2. Enviar ~0.1 SOL pra essa pubkey na mainnet pra cobrir setup + buffer:');
console.log('     https://solscan.io/account/' + pubkey);
console.log('  3. Quando confirmar saldo: node functions/scripts/bootstrap-sas.js');
console.log('  4. Após bootstrap: registrar como Firebase Secret pra produção:');
console.log('     firebase functions:secrets:set JUICE_ATTESTOR_KEYPAIR < ' + KEYPAIR_PATH.replace(/\\/g, '/'));
