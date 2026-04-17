import analytics from '@react-native-firebase/analytics';

// Silencia erros de analytics para não quebrar o app em caso de falha.
// Captura tanto erros síncronos (módulo nativo não inicializado) quanto assíncronos.
function safe(fn) {
  return (...args) => {
    try {
      const result = fn(...args);
      if (result && typeof result.catch === 'function') result.catch(() => {});
    } catch { /* módulo nativo indisponível neste build */ }
  };
}

// ─── Usuário ─────────────────────────────────────────────────────────────────

export const setUsuarioId = safe((uid) =>
  analytics().setUserId(uid)
);

export const resetUsuarioId = safe(() =>
  analytics().setUserId(null)
);

// ─── Autenticação ─────────────────────────────────────────────────────────────

export const logLogin = safe(() =>
  analytics().logLogin({ method: 'email' })
);

export const logCadastro = safe(() =>
  analytics().logSignUp({ method: 'email' })
);

// ─── Carregamento ─────────────────────────────────────────────────────────────

export const logInicioCarregamento = safe(() =>
  analytics().logEvent('charging_start')
);

export const logFimCarregamento = safe((minutos, pontos) =>
  analytics().logEvent('charging_stop', {
    minutos_carregando: minutos,
    pontos_ganhos: pontos,
  })
);

export const logBonusHora = safe((minutos) =>
  analytics().logEvent('bonus_hora_completa', {
    minutos_acumulados: minutos,
  })
);

// ─── Pontos e economia ────────────────────────────────────────────────────────

export const logSaqueSolicitado = safe((pontos) =>
  analytics().logEvent('saque_solicitado', { pontos })
);

export const logIndicacaoUsada = safe(() =>
  analytics().logEvent('indicacao_usada')
);

export const logLoginDiario = safe(() =>
  analytics().logEvent('login_diario')
);
