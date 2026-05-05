// Local Expo module: wrapper para Google Play Integrity API (Android only).
//
// Fluxo esperado:
//   1. App chama Cloud Function initSession e recebe { attestationSessionId, nonce }
//   2. App chama requestIntegrityToken(nonce) deste módulo → recebe JWE token
//   3. App chama Cloud Function registrarProvasSessao com { attestationSessionId, integrityToken, platform: 'android' }
//   4. Backend (play-integrity-helper.js) decodifica o token via Google e valida nonce/verdicts
//
// O Cloud project number é hardcoded: cnbmobile-2053c → 144617374104.
// Linkado no Google Play Console em 2026-05-05.

import { requireNativeModule } from 'expo-modules-core';

interface PlayIntegrityNativeModule {
  requestIntegrityToken(nonce: string, cloudProjectNumber: number): Promise<string>;
}

const NativeModule = requireNativeModule<PlayIntegrityNativeModule>('PlayIntegrity');

export const CLOUD_PROJECT_NUMBER = 144617374104;

/**
 * Solicita um integrity token do Google Play Integrity API.
 *
 * @param nonce - nonce server-issued (vindo de initSession Cloud Function)
 * @returns JWE encrypted token para enviar ao backend
 * @throws INTEGRITY_FAILED — Play Services rejeitou a requisição (device não atende, app não reconhecido, sem rede)
 * @throws INTEGRITY_EXCEPTION — exceção inesperada no native module
 * @throws NO_CONTEXT — application context indisponível (raro)
 */
export async function requestIntegrityToken(nonce: string): Promise<string> {
  if (!nonce || typeof nonce !== 'string') {
    throw new Error('nonce inválido (string vazia ou ausente)');
  }
  return NativeModule.requestIntegrityToken(nonce, CLOUD_PROJECT_NUMBER);
}

export default { requestIntegrityToken, CLOUD_PROJECT_NUMBER };
