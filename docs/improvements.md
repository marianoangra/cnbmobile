# CNB Mobile — Relatório de Melhorias Contínuas

> Gerado automaticamente via Colosseum Copilot + Kuka Agent.
> Atualizado a cada sessão de análise. Última revisão: **2026-04-25**.

---

## Contexto

CNB Mobile é uma aplicação React Native DePIN que rastreia atividade de carregamento de EVs, emite recompensas em CNB Token (SPL mainnet), usa Anchor para proof-of-activity on-chain, Solana Memo para referrals, e Cloak SDK para resgates privados via ZK proofs. Compete no Hackathon Frontier Colosseum (2026).

---

## Análise Competitiva

### Concorrentes Diretos (acelerados e premiados)

| Projeto | Hackathon | Resultado | Diferencial |
|---|---|---|---|
| `devolt` / `devolt-1` | Renaissance (Mar 2024) / Radar (Set 2024) | 2º lugar DePIN, $20k — Accelerator C4 (Cloak) | P2P energy marketplace, tokeniza kWh |
| `decharge` | Renaissance (Mar 2024) | 2º lugar DePIN, $20k — Accelerator C1 | Hardware DePIN, 9-person team |
| `svachsakthi` | Radar (Set 2024) | **1º lugar DePIN, $25k** — Accelerator C2 | Off-grid energia renovável, IoT real |
| `biq-1` | Cypherpunk (Set 2025) | — | Proof of presence + loyalty, React Native + Anchor |
| `decal-payments-and-loyalty` | Breakout (Abr 2025) | 2º lugar Stablecoins, $20k — Accelerator C3 | Pagamentos + loyalty Solana |

### Diferencial CNB Mobile

Nenhum concorrente acelerado combina: **EV charging** + **proof-of-activity comportamental** + **ZK redemption privado** + **mercado brasileiro**. Esse stack conjunto é único no corpus de 5.400+ projetos analisados.

**Pitch frame para Frontier:** "A primeira rede DePIN de mobilidade sustentável da América Latina com privacy-preserving redemption."

---

## Relatório por Área

### 1. Estratégia DePIN

- **Definir o ativo tokenizado:** sessão de carregamento (kWh) ou comportamento do usuário (proof-of-activity)? Modelos com lógicas de valor distintas — definir antes do pitch.
- **Hardware anchor:** todos os projetos premiados têm hardware IoT real. Integrar com protocolo OCPP (padrão de charging stations) para atestação mais forte que dado de app.
- **Supply-side faltando:** o app incentiva usuários (demand). Falta programa de onboarding para operadores de estações como nós DePIN — aumenta defensibilidade.
- **Cluster alvo:** posicionar no cluster "Solar Energy DePIN and Verification" (v1-c29), não apenas Consumer Apps — é onde os juízes alocam os projetos de energia premiados.

### 2. Tokenomics

- **Sink obrigatório antes do pitch:** emitir CNB sem destruição replica a spiral do STEPN (Galaxy Research, 2024: *"for older users to recoup, value must continually flow from newer users"*). Implementar pelo menos um sink: upgrade de perfil, acesso a ranking premium, ou resgate acelerado.
- **Vesting on-chain para recompensas:** 30–90 dias via Anchor evita dump imediato e sinaliza maturidade técnica para juízes.
- **Revenue loop real:** operadores de estação pagam taxa de listagem em CNB → CNB é queimado → pressão deflacionária → sustenta o preço → incentiva usuários. Fecha o flywheel sem depender de novos entrantes.
- **Separar utility de governance:** CNB como token de utilidade puro (pagar, resgatar, queimar). Governance separada quando escalar.

### 3. Produto e UX

- **Onboarding sem jargão crypto:** `bondum-1` e `redemption` ganham pontos por "abstracted blockchain complexity". Fluxo de primeiro uso que não exige que o usuário entenda Solana.
- **Feedback visual imediato pós-sessão:** usuário conecta → carrega → vê confirmação on-chain em linguagem humana ("Sessão registrada • +12 CNB"), não uma tx hash.
- **Rankings contextualizados:** ranking por cidade brasileira, por modelo de EV, por streak semanal. O RankingScreen existe mas está subutilizado.
- **CTA de referral proeminente pós-sessão:** "Ganhou 12 CNB. Convide um amigo e ganhe +5 na próxima sessão." Referral via Memo já funciona — o fluxo de compartilhamento é o gap.
- **Missões contextuais:** refletir comportamento real de carregamento ("5 sessões em 30 dias", "carregue em 3 cidades", "sessão noturna") — reforça o dado DePIN para os juízes.

### 4. Arquitetura Técnica

- **Migrar Anchor para mainnet é bloqueador crítico** (prioridade #1). Enquanto o programa está só no devnet, proof-of-activity é decorativo para qualquer avaliação técnica.
- **Dual-write Firestore + Anchor:** definir claramente qual é source of truth quando divergem. Juízes técnicos vão perguntar. Caminho ideal: Anchor como primary gate, Firestore como cache.
- **BIP39 mnemonic no app é risco UX/segurança** para usuário comum. Considerar social recovery (Squads/Fuse) ou custódia gerenciada para o mercado brasileiro.
- **Compressed tokens para distribuição em escala:** cada token account custa ~0.002 SOL. Light Protocol reduz custo em 1000x para distribuição de recompensas em escala.

### 5. Go-to-Market

- **Parceria com rede de charging stations brasileira** (Tupinambá, EletroPost, Voltz) como anchor de supply-side — diferencial geográfico defensável que DeVolt/DeCharge não têm no Brasil.
- **B2B2C via montadoras e frotas corporativas:** CNB como loyalty token de frota para motoristas de EVs (BYD Brasil, Volkswagen).
- **DREX:** posicionar CNB como complementar ao CBDC brasileiro para recompensas EV — coloca o projeto em pauta regulatória positiva.
- **TAM pitch:** Brasil tem ~100k EVs (crescimento 3x em 2 anos). Early mover advantage real. LatAm é underserved — mesmo ângulo que projetou `credix` ao foco em LatAm.

---

## Prioridades por Sessão

### Sprint atual (pré-Frontier)

| # | Ação | Status |
|---|---|---|
| 1 | Deploy Anchor mainnet | Pendente — aguarda SOL no deployer wallet |
| 2 | Implementar token sink on-chain | Pendente |
| 3 | Parceria com rede de charging stations BR | Em prospecção |
| 4 | Onboarding sem jargão crypto | Pendente |
| 5 | Vesting on-chain para recompensas | Pendente |

---

## Histórico de Sessões

### 2026-04-25 — Análise Frontier Colosseum
- Corpus analisado: 5.400+ projetos Colosseum + arquivos a16z, Galaxy Research, Helius H1 2025
- Projetos comparados: `devolt`, `devolt-1`, `decharge`, `svachsakthi`, `biq-1`, `decal-payments-and-loyalty`, `bondum-1`, `redemption`, `greengait`
- Insight crítico: DeVolt está no Accelerator C4 da Cloak — mesmo SDK usado pelo CNBMobile
- Relatório gerado por: Kuka + Colosseum Copilot

---

*Próxima atualização: adicionar análise pós-deploy mainnet + métricas de usuário.*
