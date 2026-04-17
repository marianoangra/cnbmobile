# Histórico de Builds e Problemas Resolvidos

## Android

### v63–v68 — CRASH: "Component auth has not been registered yet"
**Problema:** App crashava ao abrir em builds de produção (release).  
**Causa:** Metro resolvia `firebase/auth` para o wrapper ESM de browser (sem `registerAuth`).  
**Fix:** `metro.config.js` com `unstable_enablePackageExports=false` + `resolveRequest`.

### v69 — Firebase Auth funcionando
Primeira build estável. Crash resolvido.  
Usuário confirmou: *"Agora foi, impressionante."*

### v70 — Ícones corrigidos
**Problema:** Ícone do React Native (átomo cinza) aparecia no launcher.  
**Causa:** `ic_launcher_foreground.webp` em todos os `mipmap-*/` era o ícone padrão.  
**Fix:** Script Python/PIL regenerou todos os mipmaps a partir de `assets/adaptive-icon.png`.  
Densidades: mdpi/hdpi/xhdpi/xxhdpi/xxxhdpi para launcher e foreground.

### v71 — Login persistente + UI ajustes
- Login salvo no AsyncStorage (sessão persiste entre fechamentos)
- "Min. carregando" atualiza ao voltar para aba Início e ao parar de carregar
- Ranking: removida navegação ao detalhe ao clicar no usuário
- Perfil: removidos boxes de "Min. carregando" e "Saques realizados"
- **Keystore corrigido:** `credentialsSource: "local"` com `cnbmobile-upload.keystore`

---

## iOS (TestFlight)

### Builds ee962e64, a69dca6e — FALHA: "Bundle JavaScript build phase"
**Causa 1 (ee962e64):** `ios/` não era enviado ao EAS (estava no `.gitignore`).  
**Fix:** Criado `.easignore` para permitir `ios/` (exceto Pods e build).

**Causa 2 (a69dca6e):** `Podfile.lock` ausente — `[CP] Check Pods Manifest.lock` falha.  
**Fix tentado:** `prebuildCommand` no eas.json (não resolveu).

**Causa real (b686fc2f, e1ffea03):** `babel-preset-expo` não estava em `package.json` —  
npm o instalava aninhado em `expo/node_modules/`, inacessível ao Babel.  
**Fix:** `npm install --save-dev babel-preset-expo@~54.0.10`

### Build a18c1a33 — SUCESSO iOS
Primeira build iOS bem-sucedida. Disponível no TestFlight.  
Ambiente EAS: macOS Sequoia 15.6, Xcode 26.0, Node.js 20.19.4.

---

## Linha do tempo resumida

| Build | Plataforma | Status | Principal mudança |
|-------|-----------|--------|------------------|
| v63-v68 | Android | ❌ Crash | Tentativas de fix Firebase |
| v69 | Android | ✅ | Fix definitivo Firebase Auth |
| v70 | Android | ✅ | Ícones corrigidos |
| a18c1a33 | iOS | ✅ | Primeira build iOS (TestFlight) |
| v71 (71ece396) | Android | ✅ | Login persistente + UI + keystore correto |
