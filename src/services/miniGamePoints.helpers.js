export const MINI_GAME_DAILY_CAP = 10000;

export function diaKeyHoje(date = new Date()) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}

export function calcularCreditavel(pontosHojeAtuais, pontosNovos, cap = MINI_GAME_DAILY_CAP) {
  if (pontosNovos <= 0) return 0;
  const restante = Math.max(0, cap - pontosHojeAtuais);
  return Math.min(pontosNovos, restante);
}
