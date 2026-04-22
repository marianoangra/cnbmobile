import * as Battery from 'expo-battery';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { adicionarMinutoComBonus } from './pontos';

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

// Tenta executar fn uma vez; se falhar, aguarda atraso e tenta mais uma vez.
async function comRetentativa(fn, atraso = 3000) {
  try {
    return await fn();
  } catch {
    await sleep(atraso);
    return await fn(); // lança se falhar novamente
  }
}

async function tarefaCarregamento(taskData) {
  const { uid } = taskData;
  let minutos = 0;

  try {
    const raw = await AsyncStorage.getItem(SESSAO_KEY);
    if (raw) {
      const sessao = JSON.parse(raw);
      if (sessao.uid === uid) minutos = sessao.minutosAcumulados ?? 0;
    }
  } catch {}

  await AsyncStorage.setItem(SESSAO_KEY, JSON.stringify({ uid, minutosAcumulados: minutos })).catch(() => {});

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

    try {
      const bonusConcedido = await comRetentativa(() => adicionarMinutoComBonus(uid));
      if (bonusConcedido) console.log(`[BackgroundService] Bônus de hora concedido! (min ${minutos})`);
    } catch (e) {
      console.warn(`[BackgroundService] Falha ao gravar min ${minutos}:`, e?.message);
    }
    try {
      await AsyncStorage.setItem(SESSAO_KEY, JSON.stringify({ uid, minutosAcumulados: minutos }));
    } catch (e) {
      console.warn('[BackgroundService] Falha ao salvar sessão no AsyncStorage:', e?.message);
    }

    const ptsTotais = minutos * 10 + Math.floor(minutos / 60) * 50;
    try {
      await BackgroundService.updateNotification({
        taskDesc: `⚡ ${minutos} min carregando · +${ptsTotais.toLocaleString('pt-BR')} pts`,
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
  // Android 14+ (API 34+) exige foregroundServiceType em runtime E no AndroidManifest.
  // connectedDevice: serviço ativo enquanto dispositivo USB/carregador está conectado.
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
