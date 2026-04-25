import * as Battery from 'expo-battery';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { adicionarMinutoComBonus, calcularPontosTotal } from './pontos';

export const SESSAO_KEY = 'cnb_sessao_carregamento';

// ─── Guard do módulo nativo ───────────────────────────────────────────────────
// Se o build ainda não inclui react-native-background-actions compilado,
// todas as funções degradam silenciosamente sem derrubar o app.

let BackgroundService = null;
try {
  // eslint-disable-next-line import/no-extraneous-dependencies
  BackgroundService = require('react-native-background-actions').default;
} catch {
  console.warn('[BackgroundService] Módulo nativo não disponível neste build.');
}

function moduloDisponivel() {
  try {
    return BackgroundService !== null && typeof BackgroundService.isRunning === 'function';
  } catch {
    return false;
  }
}

function estaRodando() {
  try {
    return moduloDisponivel() && BackgroundService.isRunning();
  } catch {
    return false;
  }
}

// ─── Lógica da tarefa (roda em background) ───────────────────────────────────

function estaCarregando(state) {
  return state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function tarefaCarregamento(taskData) {
  const { uid } = taskData;
  let minutos = 0;
  let pendingMinutes = 0; // minutos não confirmados no Firestore (ex: ficou offline)

  try {
    const raw = await AsyncStorage.getItem(SESSAO_KEY);
    if (raw) {
      const sessao = JSON.parse(raw);
      if (sessao.uid === uid) {
        minutos = sessao.minutosAcumulados ?? 0;
        pendingMinutes = sessao.pendingMinutes ?? 0;
      }
    }
  } catch {}

  // Reconcilia minutos pendentes de sessão anterior interrompida offline
  if (pendingMinutes > 0) {
    let flushed = 0;
    while (flushed < pendingMinutes) {
      try {
        const bonusConcedido = await adicionarMinutoComBonus(uid);
        if (bonusConcedido) console.log(`[BackgroundService] Bônus de hora (reconciliação) concedido!`);
        flushed++;
      } catch {
        break; // Ainda offline — tenta no próximo ciclo
      }
    }
    pendingMinutes -= flushed;
    if (flushed > 0) console.log(`[BackgroundService] Reconciliados ${flushed} min pendentes.`);
  }

  await AsyncStorage.setItem(SESSAO_KEY, JSON.stringify({ uid, minutosAcumulados: minutos, pendingMinutes })).catch(() => {});

  while (estaRodando()) {
    await sleep(60000);
    if (!estaRodando()) break;

    try {
      const state = await Battery.getBatteryStateAsync();
      if (!estaCarregando(state)) {
        try { await BackgroundService.stop(); } catch {}
        break;
      }
    } catch {}

    minutos++;
    pendingMinutes++;

    // Tenta aplicar todos os minutos pendentes (incluindo o atual)
    let flushed = 0;
    while (flushed < pendingMinutes) {
      try {
        const bonusConcedido = await adicionarMinutoComBonus(uid);
        if (bonusConcedido) console.log(`[BackgroundService] Bônus de hora concedido! (min ${minutos})`);
        flushed++;
      } catch {
        console.warn(`[BackgroundService] Offline — ${pendingMinutes - flushed} min pendentes`);
        break;
      }
    }
    pendingMinutes -= flushed;

    try {
      await AsyncStorage.setItem(SESSAO_KEY, JSON.stringify({ uid, minutosAcumulados: minutos, pendingMinutes }));
    } catch (e) {
      console.warn('[BackgroundService] Falha ao salvar sessão no AsyncStorage:', e?.message);
    }

    try {
      await BackgroundService.updateNotification({
        taskDesc: `⚡ ${minutos} min carregando · +${calcularPontosTotal(minutos).toLocaleString('pt-BR')} pts`,
      });
    } catch {}
  }

  await AsyncStorage.removeItem(SESSAO_KEY).catch(() => {});
}

const OPCOES_BASE = {
  taskName: 'cnb-carregamento',
  taskTitle: 'CNB Mobile',
  taskDesc: 'Acumulando pontos enquanto você carrega...',
  taskIcon: { name: 'ic_launcher', type: 'mipmap' },
  color: '#00FF7F',
  linkingURI: 'com.cnb.cnbappv2://',
  // Android 14+ (API 34+) exige que o tipo declarado aqui coincida com o do AndroidManifest.
  // O plugin withBackgroundActions declara dataSync — deve ser igual aqui.
  foregroundServiceType: ['dataSync'],
};

// ─── API pública ─────────────────────────────────────────────────────────────

// Mutex nativo: impede que dois start() simultâneos cheguem ao módulo nativo.
// isRunning() pode retornar false enquanto o primeiro start() ainda não completou.
let iniciandoServico = false;

export async function iniciarForegroundService(uid) {
  if (!moduloDisponivel() || estaRodando() || iniciandoServico) return;
  iniciandoServico = true;
  try {
    await BackgroundService.start(tarefaCarregamento, { ...OPCOES_BASE, parameters: { uid } });
  } catch (e) {
    console.warn('[BackgroundService] Erro ao iniciar:', e?.message);
  } finally {
    iniciandoServico = false;
  }
}

export async function pararForegroundService() {
  if (!estaRodando()) return;
  try {
    await BackgroundService.stop();
  } catch (e) {
    console.warn('[BackgroundService] Erro ao parar:', e?.message);
  }
}

export function servicoRodando() {
  return estaRodando();
}
