/**
 * smoke-sas.js — verifica que sas-lib + @solana/kit funcionam em CommonJS.
 * Roda offline (não toca RPC). Útil pra validar instalação local antes de bootstrap.
 *
 * Uso: node functions/scripts/smoke-sas.js
 */

'use strict';

(async () => {
  const sasLib = require('sas-lib');
  const kit = require('@solana/kit');
  const signers = require('@solana/signers');

  const sasExports = Object.keys(sasLib);
  const sasNotable = sasExports.filter(k => /derive|Create|fetch|serialize/.test(k));

  console.log('[sas-lib]      loaded —', sasExports.length, 'exports;', sasNotable.length, 'notable:', sasNotable.slice(0, 8).join(', '));
  console.log('[@solana/kit]  createSolanaRpc:', typeof kit.createSolanaRpc, '| address():', typeof kit.address);
  console.log('[signers]      createKeyPairSignerFromPrivateKeyBytes:', typeof signers.createKeyPairSignerFromPrivateKeyBytes);

  const dummyAuthority = kit.address('11111111111111111111111111111111');
  const [pda, bump] = await sasLib.deriveCredentialPda({
    authority: dummyAuthority,
    name: 'smoke-test',
  });

  console.log('\n[derive] credential PDA for system program / "smoke-test"');
  console.log('         pda  =', pda);
  console.log('         bump =', bump);

  console.log('\nALL GOOD — CommonJS require() funciona; sas-lib API acessível.');
})().catch(e => {
  console.error('\nSMOKE FAIL:');
  console.error(e?.stack || e);
  process.exit(1);
});
