// Stub no-op: Crashlytics nativo foi removido temporariamente para simplificar
// o build iOS. JS callers continuam chamando essas APIs sem efeito.

export const setUsuarioCrash = () => {};
export const setAtributoCrash = () => {};
export const registrarErro = (erro) => {
  if (erro && typeof console !== 'undefined') console.warn('[crashlytics stub]', erro);
};
export const logCrash = () => {};
