// Emitter leve para sincronizar pontosGanhos do ChargingScreen com outras telas.
// Não usa dependências externas — módulo singleton puro.

const listeners = new Set();

export function emitPontosUpdate(pontos) {
  listeners.forEach(fn => {
    try { fn(pontos); } catch {}
  });
}

export function onPontosUpdate(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
