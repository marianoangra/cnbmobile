/**
 * deviceFingerprint.js
 * Gera um hash estável do dispositivo para detecção de fraude de múltiplas contas.
 * Usado em registrarProvasSessao para enviar ao servidor.
 *
 * PRIVACIDADE: o hash é SHA-256 de características do device — não identifica
 * o usuário individualmente, apenas detecta múltiplas contas no mesmo aparelho.
 */

import * as Device from 'expo-device';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';

let cachedHash = null;

export async function getDeviceHash() {
  if (cachedHash) return cachedHash;

  try {
    // Combina características estáveis do dispositivo
    // Nota: no iOS o installationId muda por reinstalação; no Android é mais estável
    const installId = await Application.getInstallationTimeAsync()
      .then(t => t?.getTime?.()?.toString() ?? '')
      .catch(() => '');

    const components = [
      Device.brand       ?? '',   // ex: Apple, Samsung
      Device.modelName   ?? '',   // ex: iPhone 14, Galaxy S22
      Device.osVersion   ?? '',   // ex: 17.5
      Device.deviceType  ?? '',   // ex: 1 (phone), 2 (tablet)
      Application.applicationId  ?? '',  // ex: com.cnbmobile.app
      installId,
    ].join('||');

    cachedHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      components,
    );

    return cachedHash;
  } catch {
    // Fallback: retorna null se expo-crypto não disponível
    return null;
  }
}
