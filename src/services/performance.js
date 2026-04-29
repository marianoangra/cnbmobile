// Stub no-op: Firebase Performance nativo foi removido temporariamente para
// simplificar o build iOS. JS callers continuam funcionando sem trace real.

export const iniciarTrace = async () => null;
export const pararTrace = async () => null;
export const traceAsync = async (_nome, fn) => fn();
