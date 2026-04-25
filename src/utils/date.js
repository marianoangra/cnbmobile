/**
 * Utilitários de data compartilhados.
 *
 * AVISO DE FUSO HORÁRIO (BUG-04):
 * diaKey usa horário LOCAL do dispositivo. Se o servidor gravar atividadeDias
 * em UTC, carregamentos entre 21h e meia-noite (BRT = UTC-3) podem gerar chaves
 * divergentes. Quando o backend confirmar o fuso, trocar getDate/getMonth/getFullYear
 * pelas variantes getUTC*.
 */

/**
 * Retorna a chave de dia no formato YYYYMMDD para um offset de dias atrás.
 * diaKey(0) = hoje, diaKey(1) = ontem, etc.
 */
export function diaKey(offsetDias = 0) {
  const d = new Date();
  d.setDate(d.getDate() - offsetDias);
  return (
    `${d.getFullYear()}` +
    `${String(d.getMonth() + 1).padStart(2, '0')}` +
    `${String(d.getDate()).padStart(2, '0')}`
  );
}

/**
 * diaKey a partir de um objeto Date já construído (sem offset).
 * Útil para iterar sobre datas em loops.
 */
export function diaKeyDe(d) {
  return (
    `${d.getFullYear()}` +
    `${String(d.getMonth() + 1).padStart(2, '0')}` +
    `${String(d.getDate()).padStart(2, '0')}`
  );
}
