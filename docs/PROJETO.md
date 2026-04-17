# CNB Mobile — Visão Geral do Projeto

## O que é
App React Native (Expo) que recompensa usuários com pontos enquanto carregam o celular. Os pontos podem ser sacados via PIX.

## Tech Stack
- **React Native** 0.81.5 + **Expo SDK** 54 (bare workflow)
- **Firebase JS SDK** 10.14.1 (web SDK — NOT @react-native-firebase)
- **Hermes** JS engine (produção)
- **Metro** bundler 0.83.3
- **EAS Build** para compilação cloud (Android + iOS)
- **Old Architecture** (`newArchEnabled: false`)

## Identificadores
- Bundle ID iOS: `com.cnb.cnbappv2`
- Package Android: `com.cnb.cnbappv2`
- EAS Project ID: `92b79039-a34d-43b2-b749-140b565e5a4c`
- EAS owner: `marianoangra`
- Firebase project: `cnbmobile-2053c`

## Versão atual
- app version: `1.1.4`
- Android versionCode: `71`
- iOS build: `1`

## Estrutura de pastas
```
CNBMobile/
├── App.js                          # Navegação principal, auth state, perfil global
├── index.js                        # Entry point (registerRootComponent)
├── metro.config.js                 # Config crítica — fix Firebase/auth
├── babel.config.js                 # babel-preset-expo + decorators
├── app.json                        # Config Expo (ícones, permissões, EAS)
├── eas.json                        # Perfis de build EAS
├── credentials.json                # Keystore Android local (NÃO commitar)
├── android/                        # Código nativo Android (bare workflow)
├── ios/                            # Código nativo iOS (bare workflow)
├── assets/                         # Ícones e splash screen
├── src/
│   ├── screens/                    # Telas do app
│   ├── services/                   # Firebase, pontos, installReferrer
│   ├── hooks/                      # useCarregamento
│   ├── components/                 # Avatar, BannerAd, AdmobBanner, ErrorBoundary
│   └── theme/                      # colors.js
└── docs/                           # Esta documentação
```

## Telas
| Tela | Arquivo | Descrição |
|------|---------|-----------|
| Login | `LoginScreen.js` | Email/senha Firebase |
| Cadastro | `RegisterScreen.js` | Cria conta + perfil Firestore |
| Início | `HomeScreen.js` | Pontos, progresso, stats |
| Carregar | `ChargingScreen.js` | Detecta carregamento, conta pontos |
| Ranking | `RankingScreen.js` | Top jogadores (global) |
| Perfil | `ProfileScreen.js` | Avatar, pontos, indicação, histórico saques |
| Editar Perfil | `EditProfileScreen.js` | Nome, foto |
| Sacar | `WithdrawScreen.js` | Solicita saque via PIX |

## Navegação
- **Stack** raiz: `MainTabs` (logado) ou `AuthNavigator` (deslogado)
- **Bottom Tabs**: Início / Carregar / Ranking / Perfil
- **Stack** modais: Withdraw, RankingDetail, EditProfile
