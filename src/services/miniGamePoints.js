import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
export { MINI_GAME_DAILY_CAP, diaKeyHoje, calcularCreditavel } from './miniGamePoints.helpers';
import { MINI_GAME_DAILY_CAP, diaKeyHoje, calcularCreditavel } from './miniGamePoints.helpers';

/**
 * Credita pontos do mini-game no perfil do usuário, respeitando o cap diário.
 * Usa transação para evitar race conditions entre saves concorrentes.
 *
 * @returns {Promise<{ creditados: number, pontosHoje: number, capAtingido: boolean }>}
 */
export async function creditarPontosMiniGame(uid, pontosNovos) {
  if (!uid) throw new Error('uid obrigatório');
  if (!Number.isFinite(pontosNovos) || pontosNovos <= 0) {
    return { creditados: 0, pontosHoje: 0, capAtingido: false };
  }

  const userRef = doc(db, 'usuarios', uid);
  const hoje = diaKeyHoje();

  return runTransaction(db, async (t) => {
    const snap = await t.get(userRef);
    if (!snap.exists()) throw new Error('Perfil não encontrado');

    const data = snap.data();
    const ultimoReset = data.miniGameUltimoReset ?? null;
    const pontosHojeAnterior = ultimoReset === hoje ? (data.miniGamePontosHoje ?? 0) : 0;

    const creditados = calcularCreditavel(pontosHojeAnterior, Math.floor(pontosNovos));
    if (creditados <= 0) {
      if (ultimoReset !== hoje) {
        t.update(userRef, {
          miniGamePontosHoje: 0,
          miniGameUltimoReset: hoje,
        });
      }
      return { creditados: 0, pontosHoje: pontosHojeAnterior, capAtingido: true };
    }

    const novoPontosHoje = pontosHojeAnterior + creditados;
    t.update(userRef, {
      pontos: (data.pontos ?? 0) + creditados,
      miniGamePontosHoje: novoPontosHoje,
      miniGameUltimoReset: hoje,
      miniGameUltimoSave: serverTimestamp(),
    });

    return {
      creditados,
      pontosHoje: novoPontosHoje,
      capAtingido: novoPontosHoje >= MINI_GAME_DAILY_CAP,
    };
  });
}
