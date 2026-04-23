import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const PROJECT_ID = '92b79039-a34d-43b2-b749-140b565e5a4c';

export async function registrarTokenPush(uid) {
  if (!Device.isDevice) return; // não funciona em simulador

  // Android precisa de canal de notificação
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
}
