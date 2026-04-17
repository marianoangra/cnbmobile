# Configurações Críticas

## 1. metro.config.js — Fix Firebase Auth

Este arquivo é a peça mais crítica do projeto. Sem ele, o app crasha com
`"Component auth has not been registered yet"` em builds de produção (Hermes).

**Causa raiz:** Expo SDK 54 ativa `unstable_enablePackageExports=true` por padrão.
O Firebase usa o campo `exports` do package.json, que não tem condição `react-native`,
fazendo o Metro resolver para o wrapper ESM de browser — que não executa
`registerAuth("ReactNative")` antes do `getAuth()`.

```js
// metro.config.js
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);

// Fix 1: desabilita package exports (Expo SDK 54 ativa por padrão)
config.resolver.unstable_enablePackageExports = false;

// Fix 2: prioriza campo react-native
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

// Fix 3: intercepta firebase/auth pelo nome exato e força o build React Native
// (extraNodeModules NÃO funciona para subpath imports como firebase/auth)
const firebaseAuthRnPath = path.resolve(
  __dirname,
  'node_modules/firebase/node_modules/@firebase/auth/dist/rn/index.js'
);
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'firebase/auth') {
    return { filePath: firebaseAuthRnPath, type: 'sourceFile' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
```

**Por que `@firebase/auth` está em `firebase/node_modules/`?**
Porque a versão de `@firebase/auth` que o pacote `firebase` usa é diferente
da versão hoisted, então o npm a aninha em `node_modules/firebase/node_modules/`.

---

## 2. src/services/firebase.js — Persistência de sessão

Usa `initializeAuth` com `getReactNativePersistence(AsyncStorage)` para manter
o login salvo entre fechamentos do app. O `try/catch` trata hot-reload do Expo Go.

```js
export const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app); // já inicializado (hot-reload)
  }
})();
```

**Por que não usar `getAuth` simples?**
`getAuth` usa `inMemoryPersistence` no React Native — a sessão some ao fechar o app.

---

## 3. babel.config.js — Dependências obrigatórias

`babel-preset-expo` deve estar em `devDependencies` do `package.json`.
Se não estiver, o EAS Build falha com `Cannot find module 'babel-preset-expo'`
porque o npm o instala aninhado em `expo/node_modules/` e o Babel não o encontra.

```json
"devDependencies": {
  "babel-preset-expo": "~54.0.10",
  "@babel/plugin-proposal-decorators": "^7.0.0"
}
```

---

## 4. .easignore — O que o EAS recebe

```
node_modules/
android/
ios/Pods/
ios/build/
```

- `android/` excluído: builds Android usam o Gradle do EAS
- `ios/` incluído (exceto Pods e build): o `Podfile.lock` é necessário para
  o `[CP] Check Pods Manifest.lock` do Xcode passar
- `ios/Pods/` excluído: ~300MB, o EAS reinstala via `pod install`

**Atenção:** O `Podfile.lock` foi gerado localmente com `cd ios && pod install`
(CocoaPods 1.16.2 disponível via rbenv). Sem ele, o build iOS falha.

---

## 5. eas.json — Perfis de build

```json
{
  "build": {
    "production": {
      "distribution": "store",
      "android": { "credentialsSource": "local" },
      "ios": { "buildConfiguration": "Release", "resourceClass": "m-medium" }
    }
  }
}
```

`credentialsSource: "local"` faz o EAS usar o `credentials.json` com o keystore
`android/app/cnbmobile-upload.keystore` (SHA1: `3C:30:AB:80:50:63:C1:ED:...`).

---

## 6. credentials.json — Keystore Android

```json
{
  "android": {
    "keystore": {
      "keystorePath": "android/app/cnbmobile-upload.keystore",
      "keystorePassword": "CNBMobile@2024",
      "keyAlias": "cnbmobile",
      "keyPassword": "CNBMobile@2024"
    }
  }
}
```

**NÃO commitar este arquivo.** O keystore físico está em:
- `android/app/cnbmobile-upload.keystore` (no projeto)
- `~/Desktop/cnbmobile-upload.keystore` (backup)
- `~/Documents/cnbmobile-upload.keystore` (backup)

SHA1 esperado pelo Google Play: `3C:30:AB:80:50:63:C1:ED:BB:E0:DA:56:E6:FD:9D:AC:2D:B2:A2:27`
