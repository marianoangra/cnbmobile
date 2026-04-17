import { Platform } from 'react-native';

/**
 * Lê o referrer do Play Store na primeira abertura pós-instalação.
 * Retorna o código ou null.
 */
export async function lerReferrerInstalacao() {
  if (Platform.OS !== 'android') return null;
  try {
    const InstallReferrer = require('react-native-google-play-install-referrer').default;
    return new Promise((resolve) => {
      InstallReferrer.getInstallReferrer((err, info) => {
        if (!err && info?.installReferrer) {
          const raw = decodeURIComponent(info.installReferrer).toUpperCase().trim();
          if (raw && raw !== 'ORGANIC' && raw !== 'UNKNOWN' && raw.length <= 10) {
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

