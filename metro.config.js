// https://docs.expo.dev/guides/customizing-metro/
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// ─── Fix 1: desabilita package.json exports ──────────────────────────────────
// Expo SDK 53+ ativa unstable_enablePackageExports=true por padrão.
// Com isso o Metro usa o campo "exports" do Firebase, que não tem condição
// "react-native", caindo no ESM browser wrapper e ignorando resolverMainFields.
// Desabilitar força o Metro a usar os campos main/browser/react-native normais.
config.resolver.unstable_enablePackageExports = false;

// ─── Fix 2: garante que o campo "react-native" tem prioridade ────────────────
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

// ─── Fix 3: resolveRequest (defesa em profundidade para firebase/auth) ───────
// firebase/auth/package.json não tem campo "react-native". Sem esse fix,
// mesmo com package exports desabilitado, Metro cai no campo "browser"
// (ESM wrapper) que não executa registerAuth() corretamente no Hermes.
// resolveRequest intercepta pelo nome exato do módulo antes de qualquer
// resolução de package.json — é a única forma confiável de interceptar
// subpath imports como "firebase/auth" (extraNodeModules não funciona para isso).
const firebaseAuthRnPath = path.resolve(
  __dirname,
  'node_modules/firebase/node_modules/@firebase/auth/dist/rn/index.js'
);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'firebase/auth') {
    return {
      filePath: firebaseAuthRnPath,
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
