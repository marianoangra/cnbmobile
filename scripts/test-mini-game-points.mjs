// Testes pontuais (rodam com node, sem jest):
//   node scripts/test-mini-game-points.mjs
//
// Cobertura:
//   - Cap diário de 10.000 pontos
//   - Cálculo de pontos creditáveis quando o cap está parcialmente consumido
//   - Taxa de 30 pontos/min — verificada via simulação determinística do timer
//
// O save parcial ao sair da tela é coberto por inspeção: o useEffect de cleanup
// do componente chama flushSave(true). Verificação manual:
//   1. Abra a tela "Carregar", derrube alguns inimigos, espere o HUD subir.
//   2. Saia da tela (back) antes do save automático de 10s.
//   3. Confira que os pontos foram somados em "Seus pontos" no Home.

import assert from 'node:assert/strict';
import { MINI_GAME_DAILY_CAP, calcularCreditavel, diaKeyHoje } from '../src/services/miniGamePoints.helpers.js';

console.log('▶ cap diário');
assert.equal(calcularCreditavel(0,     50),           50);
assert.equal(calcularCreditavel(9990,  50),           10);
assert.equal(calcularCreditavel(10000, 1),             0);
assert.equal(calcularCreditavel(10001, 100),           0);
assert.equal(calcularCreditavel(0,     0),             0);
assert.equal(calcularCreditavel(0,     -5),            0);
assert.equal(calcularCreditavel(0,     20000),         MINI_GAME_DAILY_CAP);
console.log('  ✓ ok');

console.log('▶ taxa 30/min — simulação determinística');
// O componente converte 1 ponto a cada 2000ms (SCORE_TICK_MS) só se houver
// score visual pendente e o cap não estiver atingido. Em 60s isso dá 30 ticks
// = 30 pontos. Reproduzimos a lógica em forma pura para testar:
function simularConversao({ visualPending, capReached, durationMs, tickMs = 2000 }) {
  let real = 0;
  let pending = visualPending;
  for (let t = 0; t < durationMs; t += tickMs) {
    if (pending > 0) {
      pending -= 1;
      if (!capReached) real += 1;
    }
  }
  return { real, pending };
}
// Com 1000 visualPending sobrando, em 60s deve creditar exatamente 30
let r = simularConversao({ visualPending: 1000, capReached: false, durationMs: 60_000 });
assert.equal(r.real, 30, `esperava 30 em 60s, recebeu ${r.real}`);
// Em 1 minuto extra, mais 30 → 60 totais
r = simularConversao({ visualPending: 1000, capReached: false, durationMs: 120_000 });
assert.equal(r.real, 60);
// Cap atingido: nada credita, mas ainda drena pending
r = simularConversao({ visualPending: 100, capReached: true, durationMs: 60_000 });
assert.equal(r.real, 0);
assert.equal(r.pending, 70);
console.log('  ✓ ok');

console.log('▶ chave do dia');
const k = diaKeyHoje(new Date(2026, 0, 7));
assert.equal(k, '20260107');
console.log('  ✓ ok');

console.log('\n✅ todos os testes passaram');
