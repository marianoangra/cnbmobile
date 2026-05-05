// Gera o keypair do paymaster Kora.
// Uso: node juice-kora/generate-keypair.js
// Saída: cria kora-keypair.json no diretório atual e imprime o pubkey.

const { Keypair } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

const kp = Keypair.generate();
const out = path.resolve('kora-keypair.json');
fs.writeFileSync(out, JSON.stringify(Array.from(kp.secretKey)));

console.log('───────────────────────────────────────────────');
console.log('Keypair gerado em:', out);
console.log('PUBKEY:', kp.publicKey.toBase58());
console.log('───────────────────────────────────────────────');
console.log('PRÓXIMOS PASSOS:');
console.log('1. Copiar o PUBKEY acima — vamos usar no .env do app');
console.log('2. gcloud secrets create kora-keypair --data-file=kora-keypair.json');
console.log('3. APAGAR o arquivo local após subir ao Secret Manager');
