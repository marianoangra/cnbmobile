import perf from '@react-native-firebase/perf';

// Silencia falhas para não quebrar o app caso o módulo nativo não esteja disponível.
function safeAsync(fn) {
  return async (...args) => {
    try { return await fn(...args); }
    catch { return null; }
  };
}

// ─── Trace customizado ────────────────────────────────────────────────────────

// Inicia um trace. Retorna o objeto trace (ou null se falhar) — use trace.stop() depois.
export const iniciarTrace = safeAsync(async (nome) => {
  const trace = await perf().startTrace(nome);
  return trace;
});

export const pararTrace = safeAsync(async (trace) => {
  if (!trace) return null;
  await trace.stop();
  return null;
});

// Helper de alto nível: mede uma função async como um trace nomeado.
export const traceAsync = async (nome, fn) => {
  let trace;
  try { trace = await perf().startTrace(nome); } catch { /* segue sem trace */ }
  try {
    return await fn();
  } finally {
    try { if (trace) await trace.stop(); } catch {}
  }
};
