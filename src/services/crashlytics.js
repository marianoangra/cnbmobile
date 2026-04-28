import crashlytics from '@react-native-firebase/crashlytics';

function safe(fn) {
  return (...args) => {
    try {
      const r = fn(...args);
      if (r && typeof r.catch === 'function') r.catch(() => {});
    } catch { /* módulo nativo indisponível */ }
  };
}

// ─── Identidade ───────────────────────────────────────────────────────────────

export const setUsuarioCrash = safe((uid) =>
  crashlytics().setUserId(uid || '')
);

export const setAtributoCrash = safe((chave, valor) =>
  crashlytics().setAttribute(chave, String(valor ?? ''))
);

// ─── Erros e logs ─────────────────────────────────────────────────────────────

// Registra um Error (não fatal) — agrupado por stack no console do Crashlytics.
export const registrarErro = safe((erro, jsErrorName) => {
  if (!erro) return;
  const e = erro instanceof Error ? erro : new Error(String(erro));
  return jsErrorName
    ? crashlytics().recordError(e, jsErrorName)
    : crashlytics().recordError(e);
});

// Mensagens curtas que aparecem no breadcrumb da próxima crash.
export const logCrash = safe((mensagem) =>
  crashlytics().log(String(mensagem ?? ''))
);
