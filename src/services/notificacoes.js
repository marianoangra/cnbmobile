import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform, Linking, AppState } from 'react-native';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const PROJECT_ID        = '92b79039-a34d-43b2-b749-140b565e5a4c';
const ID_LEMBRETE_CARGA = 'lembrete-carregar-hoje';

// ─── Permissão ───────────────────────────────────────────────────────────────

/**
 * Retorna true se as notificações push estão autorizadas no dispositivo.
 */
export async function notificacoesAtivas() {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

/**
 * Abre as configurações do sistema para o usuário habilitar notificações manualmente.
 * Chamado quando a permissão foi negada e não pode ser solicitada novamente.
 */
export function abrirConfiguracoesSistema() {
  Linking.openSettings();
}

// ─── Token push ───────────────────────────────────────────────────────────────

/**
 * Solicita permissão, registra o Expo Push Token e salva no Firestore.
 * Chamado automaticamente no login (App.js).
 */
export async function registrarTokenPush(uid) {
  if (!Device.isDevice) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Geral',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });

  await setDoc(doc(db, 'push_tokens', uid), {
    token,
    platform: Platform.OS,
    atualizadoEm: new Date().toISOString(),
  }, { merge: true });

  // Agenda lembrete local ao registrar
  await agendarLembreteCarregamento();
}

// ─── Lembretes locais ────────────────────────────────────────────────────────

/**
 * Agenda uma notificação local diária às 20h lembrando o usuário de carregar.
 * Idempotente — cancela qualquer lembrete anterior antes de agendar.
 */
export async function agendarLembreteCarregamento() {
  const ativa = await notificacoesAtivas();
  if (!ativa) return;

  // Cancela instância anterior para evitar duplicatas
  await Notifications.cancelScheduledNotificationAsync(ID_LEMBRETE_CARGA).catch(() => {});

  await Notifications.scheduleNotificationAsync({
    identifier: ID_LEMBRETE_CARGA,
    content: {
      title: 'JUICE',
      body: 'Você ainda não carregou hoje. Conecte o carregador e ganhe pontos!',
      data: { tela: 'Carregar' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 20,
      minute: 0,
    },
  });
}

/**
 * Cancela todos os lembretes locais agendados pelo app.
 * Chamado quando o usuário desativa notificações manualmente.
 */
export async function cancelarLembretes() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Envia notificação imediata quando o carregamento é detectado com o app em background.
 * Ao tocar na notificação, o usuário é levado diretamente à tela de carregamento.
 * No iOS, esta é a única forma de "trazer o app para frente" sem interação do usuário.
 */
export async function notificarInicioCarregamento() {
  // Só notifica se o app NÃO está em primeiro plano (seria redundante)
  if (AppState.currentState === 'active') return;
  const ativa = await notificacoesAtivas();
  if (!ativa) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'JUICE ⚡',
      body: 'Carregamento detectado! Abra o app para acumular pontos $JUICE.',
      data: { tela: 'Carregar' },
      sound: true,
    },
    trigger: null, // disparo imediato
  }).catch(() => {});
}
