# Lógica de Pontos e Carregamento

## Como os pontos são ganhos

| Ação | Pontos |
|------|--------|
| 1 minuto carregando | +10 pts |
| Bônus a cada hora completa | +50 pts |
| Login diário | +10 pts |
| Amigo indicado (cadastro) | +100 pts |
| Meta para saque | 100.000 pts |

## Hook useCarregamento (`src/hooks/useCarregamento.js`)

Gerencia toda a lógica de detecção e contagem de carregamento.

**Detecção:** `expo-battery` — `Battery.getBatteryStateAsync()` + `addBatteryStateListener`  
**Estados ativos:** `CHARGING` ou `FULL`

**Fluxo ao conectar:**
1. `iniciarSessao()` — inicia intervalo de 60s
2. A cada minuto: `adicionarPontos(uid, 10 + bonus, 1)` → Firestore
3. Salva sessão em `AsyncStorage` (key: `cnb_sessao_carregamento`)
4. Chama `onAtualizar()` → App.js recarrega perfil → HomeScreen atualiza

**Fluxo ao desconectar:**
1. `pararSessao()` — limpa intervalo, zera contador
2. Remove sessão do AsyncStorage
3. Chama `onAtualizar()` → HomeScreen atualiza imediatamente

**Recuperação de background:**
Quando o app volta ao foreground (`AppState: active`), calcula os minutos
que ficaram em background com o carregador conectado e registra os pontos.

## Atualização do HomeScreen

O "Min. carregando" e "Seus Pontos" são atualizados:
1. A cada minuto durante carregamento (via `onAtualizar` no intervalo)
2. Ao desconectar o carregador (via `onAtualizar` no `pararSessao`)
3. Ao entrar na aba Início (via `useFocusEffect` no `HomeScreen`)

## Serviço de pontos (`src/services/pontos.js`)

Funções principais no Firestore:
- `getPerfil(uid)` — busca perfil do usuário
- `criarPerfil(uid, nome, email)` — cria na coleção `usuarios`
- `adicionarPontos(uid, pontos, minutos)` — incrementa pontos e minutos
- `registrarLoginDiario(uid)` — +10 pts uma vez por dia
- `getRanking()` — top usuários por pontos
- `getSaques(uid)` — histórico de saques do usuário

## Programa de indicação

- Cada usuário tem um `codigoIndicacao` único gerado no cadastro
- Novo usuário que instala via link com o código ganha crédito ao cadastrar
- Referenciador recebe +100 pts por indicado confirmado
- Link Android: `https://play.google.com/store/apps/details?id=com.cnb.cnbappv2&referrer=CODIGO`
