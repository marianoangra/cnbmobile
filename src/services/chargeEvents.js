// Emitter leve para sincronizar eventos de sessão entre telas.
// Não usa dependências externas — módulo singleton puro.

const pontosListeners   = new Set();
const attestedListeners = new Set();

// ─── Pontos atualizados (a cada minuto durante o carregamento) ───────────────
export function emitPontosUpdate(pontos) {
  pontosListeners.forEach(fn => {
    try { fn(pontos); } catch {}
  });
}

export function onPontosUpdate(fn) {
  pontosListeners.add(fn);
  return () => pontosListeners.delete(fn);
}

// ─── Sessão atestada on-chain (após registrarProvasSessao com sucesso) ───────
// payload: { sessionId, signature, attestationPda, durationMinutes, pontos, solscanUrl }
export function emitSessionAttested(payload) {
  attestedListeners.forEach(fn => {
    try { fn(payload); } catch {}
  });
}

export function onSessionAttested(fn) {
  attestedListeners.add(fn);
  return () => attestedListeners.delete(fn);
}
