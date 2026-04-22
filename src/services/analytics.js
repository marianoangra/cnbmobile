import analytics from '@react-native-firebase/analytics';

// Silencia erros de analytics para não quebrar o app em caso de falha.
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

// method: 'email' | 'google' | 'apple'
export const logLogin = safe((method = 'email') =>
  analytics().logLogin({ method })
);

export const logCadastro = safe((method = 'email') =>
  analytics().logSignUp({ method })
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

// Chamado pela transação Firestore quando total de minutos cruza múltiplo de 60
export const logBonusHora = safe((minutosTotal) =>
  analytics().logEvent('bonus_hora_completa', {
    minutos_acumulados: minutosTotal,
    horas_completas: Math.floor(minutosTotal / 60),
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

// ─── Solana ───────────────────────────────────────────────────────────────────

// Prova de sessão registrada on-chain (Memo na mainnet)
export const logSessaoOnChain = safe((minutos, pontos, signature) =>
  analytics().logEvent('sessao_onchain', {
    minutos_carregando: minutos,
    pontos_ganhos: pontos,
    tx_confirmada: signature ? 1 : 0,
  })
);

// Resgate de CNB tokens iniciado pelo usuário
export const logResgateCNB = safe((quantidade, walletAddress) =>
  analytics().logEvent('resgate_cnb_iniciado', {
    quantidade_pontos: quantidade,
    tem_wallet: walletAddress ? 1 : 0,
  })
);

// Resgate concluído com sucesso (tokens enviados)
export const logResgateCNBSucesso = safe((quantidade, signature) =>
  analytics().logEvent('resgate_cnb_sucesso', {
    quantidade_pontos: quantidade,
    tx_confirmada: signature ? 1 : 0,
  })
);
