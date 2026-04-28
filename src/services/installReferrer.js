import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';

const REFERRER_CHECKED_KEY = '@cnb/referrer_checked_v1';
const CODE_REGEX = /^[A-Z0-9]{1,10}$/;

async function lerClipboardIOS() {
  try {
    const checked = await AsyncStorage.getItem(REFERRER_CHECKED_KEY);
    if (checked) return null;
    await AsyncStorage.setItem(REFERRER_CHECKED_KEY, '1');
    const text = (await Clipboard.getStringAsync())?.toUpperCase().trim();
    if (text && CODE_REGEX.test(text)) return text;
    return null;
  } catch {
    return null;
  }
}

async function lerReferrerAndroid() {
  try {
    const InstallReferrer = require('react-native-google-play-install-referrer').default;
    return new Promise((resolve) => {
      InstallReferrer.getInstallReferrer((err, info) => {
        if (!err && info?.installReferrer) {
          const raw = decodeURIComponent(info.installReferrer).toUpperCase().trim();
          if (raw && raw !== 'ORGANIC' && raw !== 'UNKNOWN' && CODE_REGEX.test(raw)) {
            resolve(raw);
            return;
          }
        }
        resolve(null);
      });
    });
  } catch {
    return null;
  }
}

/**
 * Lê o código de indicação na primeira abertura pós-instalação.
 * Android: usa Play Install Referrer.
 * iOS: lê clipboard (uma única vez) — landing page coloca o código lá.
 */
export async function lerReferrerInstalacao() {
  if (Platform.OS === 'android') return lerReferrerAndroid();
  if (Platform.OS === 'ios') return lerClipboardIOS();
  return null;
}
