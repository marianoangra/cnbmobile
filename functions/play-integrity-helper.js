// functions/play-integrity-helper.js
// Validador server-side de Play Integrity tokens.
// Pattern: usa decodeIntegrityToken (Google decifra com a chave deles e devolve payload).
// Mais seguro e simples que decodificar JWT com chave pública local.

const { google } = require('googleapis');

const PACKAGE_NAME = 'com.cnb.cnbappv2';
const NONCE_TTL_MS = 30 * 60 * 1000; // 30 min — folga generosa para sessões longas
const TOKEN_AGE_MAX_MS = 10 * 60 * 1000; // token deve ter sido gerado nos últimos 10 min

const playintegrity = google.playintegrity('v1');

let authClientPromise = null;
function getAuth() {
  if (!authClientPromise) {
    authClientPromise = google.auth.getClient({
      scopes: ['https://www.googleapis.com/auth/playintegrity'],
    });
  }
  return authClientPromise;
}

/**
 * Valida um integrity token vindo do cliente Android.
 *
 * @param {string} integrityToken - JWE recebido do Play Integrity API no device
 * @param {string} expectedNonce  - nonce emitido por initSession para esta sessão
 * @param {object} opts
 *   - strict (default true): exige PLAY_RECOGNIZED
 *   - requireDeviceIntegrity (default true): exige MEETS_DEVICE_INTEGRITY
 * @returns {Promise<{ok: true, verdict: object}>}
 * @throws {Error} com message descritiva em caso de qualquer falha
 */
async function validateIntegrityToken(integrityToken, expectedNonce, opts = {}) {
  const { strict = true, requireDeviceIntegrity = true } = opts;

  if (!integrityToken || typeof integrityToken !== 'string') {
    throw new Error('integrityToken inválido ou ausente');
  }
  if (!expectedNonce || typeof expectedNonce !== 'string') {
    throw new Error('expectedNonce inválido ou ausente');
  }

  const auth = await getAuth();

  let res;
  try {
    res = await playintegrity.v1.decodeIntegrityToken({
      auth,
      packageName: PACKAGE_NAME,
      requestBody: { integrityToken },
    });
  } catch (e) {
    throw new Error('decodeIntegrityToken falhou: ' + (e?.message || e));
  }

  const payload = res?.data?.tokenPayloadExternal;
  if (!payload) throw new Error('tokenPayloadExternal ausente na resposta do Google');

  // 1. requestDetails — nonce + package + timestamp
  const req = payload.requestDetails;
  if (!req) throw new Error('requestDetails ausente');
  if (req.requestPackageName !== PACKAGE_NAME) {
    throw new Error(`packageName mismatch: ${req.requestPackageName}`);
  }
  if (req.nonce !== expectedNonce) {
    throw new Error('nonce mismatch (replay ou sessao errada)');
  }
  const tokenTs = parseInt(req.timestampMillis ?? '0', 10);
  if (!tokenTs || Date.now() - tokenTs > TOKEN_AGE_MAX_MS) {
    throw new Error(`integrity token expirado (>${TOKEN_AGE_MAX_MS / 60000}min)`);
  }

  // 2. appIntegrity — verifica reconhecimento do app pelo Play Store
  const appInt = payload.appIntegrity;
  if (!appInt) throw new Error('appIntegrity ausente');
  if (strict && appInt.appRecognitionVerdict !== 'PLAY_RECOGNIZED') {
    throw new Error(`app nao reconhecido (verdict=${appInt.appRecognitionVerdict})`);
  }
  if (appInt.packageName !== PACKAGE_NAME) {
    throw new Error('appIntegrity packageName mismatch');
  }

  // 3. deviceIntegrity — exige device nao-rooteado e nao-emulator
  const devInt = payload.deviceIntegrity;
  if (!devInt) throw new Error('deviceIntegrity ausente');
  const verdicts = devInt.deviceRecognitionVerdict || [];
  if (requireDeviceIntegrity && !verdicts.includes('MEETS_DEVICE_INTEGRITY')) {
    throw new Error(`device falhou integrity (verdicts=${JSON.stringify(verdicts)})`);
  }

  // 4. accountDetails — informativo (logamos mas nao bloqueamos)
  const licensing = payload.accountDetails?.appLicensingVerdict ?? 'UNEVALUATED';

  return {
    ok: true,
    verdict: {
      appRecognition: appInt.appRecognitionVerdict,
      deviceVerdicts: verdicts,
      licensing,
      tokenTs,
    },
  };
}

module.exports = { validateIntegrityToken, NONCE_TTL_MS };
