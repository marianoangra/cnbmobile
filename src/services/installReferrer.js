import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CODIGO_KEY = 'cnb_referrer_codigo';
const LIDO_KEY   = 'cnb_referrer_lido';

/**
 * Lê o referrer do Play Store na primeira abertura pós-instalação.
 * Salva o código no AsyncStorage para uso no cadastro.
 * Retorna o código ou null.
 */
export async function lerReferrerInstalacao() {
  if (Platform.OS !== 'android') return null;

  // Só executa uma vez (na primeira abertura após instalação)
  const jaLido = await AsyncStorage.getItem(LIDO_KEY);
  if (jaLido) {
    return AsyncStorage.getItem(CODIGO_KEY);
  }

  try {
    const InstallReferrer = require('react-native-google-play-install-referrer').default;

    return new Promise((resolve) => {
      InstallReferrer.getInstallReferrer(async (err, info) => {
        await AsyncStorage.setItem(LIDO_KEY, 'true');

        if (!err && info?.installReferrer) {
          const raw = decodeURIComponent(info.installReferrer).toUpperCase().trim();
          // Ignora valores genéricos que o Play Store retorna quando não há referrer real
          if (raw && raw !== 'ORGANIC' && raw !== 'UNKNOWN' && raw.length <= 8) {
            await AsyncStorage.setItem(CODIGO_KEY, raw);
            resolve(raw);
            return;
          }
        }
        resolve(null);
      });
    });
  } catch {
    // Expo Go ou módulo nativo não disponível
    return null;
  }
}

/**
 * Retorna o código de indicação já salvo (sem re-consultar o Play Store).
 */
export async function getReferrerSalvo() {
  return AsyncStorage.getItem(CODIGO_KEY);
}

/**
 * Limpa o referrer após o cadastro ser concluído com sucesso.
 */
export async function limparReferrer() {
  await AsyncStorage.removeItem(CODIGO_KEY);
}
