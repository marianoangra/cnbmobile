// ─── Tokens semânticos do tema ──────────────────────────────────────────────
// Cada token tem um propósito claro. Componentes consomem `colors.X` via
// `useTheme()` em vez de hex/rgba hardcoded — assim a paleta inteira
// reage à troca de tema.

export const darkColors = {
  // Backgrounds
  background:    '#0b1310',  // base do app (gradient bottom)
  card:          '#14251a',  // card destacado
  card2:         '#0a130e',  // card secundário (mais escuro)
  modalBg:       '#0d1a0d',  // bottom sheet / modal background

  // Surfaces (camadas sobre o background)
  surface:       'rgba(255,255,255,0.03)',  // surface mais sutil
  surfaceAlt:    'rgba(255,255,255,0.05)',  // surface média
  surfaceStrong: 'rgba(255,255,255,0.10)',  // surface destacada (track de progresso)

  // Texto
  text:          '#FFFFFF',                 // texto principal (alias: white)
  white:         '#FFFFFF',                 // legado
  textStrong:    'rgba(255,255,255,0.85)',  // texto secundário forte
  textMuted:     'rgba(255,255,255,0.70)',  // texto secundário
  textSecondary: 'rgba(255,255,255,0.60)',  // labels
  textFaint:     'rgba(255,255,255,0.50)',  // hints
  textDim:       'rgba(255,255,255,0.40)',  // texto muito sutil
  textGhost:     'rgba(255,255,255,0.25)',  // texto fantasma
  secondary:     '#8A9BB0',                 // legado (cinza azulado)

  // Bordas
  border:         'rgba(255,255,255,0.07)',  // borda padrão
  borderSubtle:   'rgba(255,255,255,0.05)',  // borda muito sutil
  borderStrong:   'rgba(255,255,255,0.12)',  // borda destacada
  divider:        'rgba(255,255,255,0.10)',  // divisor

  // Primary (accent)
  primary:        '#c6ff4a',                  // verde-limão neon
  primarySoft:    'rgba(198,255,74,0.08)',    // bg sutil de accent
  primaryMid:     'rgba(198,255,74,0.15)',    // bg médio de accent
  primaryStrong:  'rgba(198,255,74,0.25)',    // bg forte de accent (border de cards destacados)
  primaryGlow:    'rgba(198,255,74,0.35)',    // glow / overlay
  glow:           'rgba(198,255,74,0.35)',    // legado

  // Overlays (modal backdrops)
  overlay:        'rgba(0,0,0,0.70)',
  overlayStrong:  'rgba(0,0,0,0.85)',

  // Status
  danger:         '#FF4444',
  success:        '#2ecc71',
};

export const lightColors = {
  // Backgrounds
  background:    '#F2F5F8',
  card:          '#FFFFFF',
  card2:         '#F7F9FB',
  modalBg:       '#FFFFFF',

  // Surfaces
  surface:       'rgba(0,0,0,0.03)',
  surfaceAlt:    'rgba(0,0,0,0.05)',
  surfaceStrong: 'rgba(0,0,0,0.10)',

  // Texto
  text:          '#0A1628',
  white:         '#0A1628',                 // alias legado
  textStrong:    'rgba(10,22,40,0.90)',
  textMuted:     'rgba(10,22,40,0.72)',
  textSecondary: 'rgba(10,22,40,0.60)',
  textFaint:     'rgba(10,22,40,0.50)',
  textDim:       'rgba(10,22,40,0.40)',
  textGhost:     'rgba(10,22,40,0.25)',
  secondary:     '#6B7A90',

  // Bordas
  border:         'rgba(0,0,0,0.08)',
  borderSubtle:   'rgba(0,0,0,0.05)',
  borderStrong:   'rgba(0,0,0,0.14)',
  divider:        'rgba(0,0,0,0.10)',

  // Primary (mantém verde-limão como cor de marca, mas com tons mais sólidos
  // que funcionam sobre fundo claro — primary vira verde escuro pra texto)
  primary:        '#1A8C3E',                  // verde escuro pra contraste em fundo claro
  primarySoft:    'rgba(26,140,62,0.08)',
  primaryMid:     'rgba(26,140,62,0.16)',
  primaryStrong:  'rgba(26,140,62,0.28)',
  primaryGlow:    'rgba(26,140,62,0.25)',
  glow:           'rgba(26,140,62,0.25)',

  // Overlays
  overlay:        'rgba(0,0,0,0.35)',
  overlayStrong:  'rgba(0,0,0,0.50)',

  // Status
  danger:         '#CC2222',
  success:        '#1A8C3E',
};

// Retrocompatibilidade — telas ainda não migradas continuam recebendo dark
export const colors = darkColors;
