# juice-kora — Paymaster Solana para o JUICE Mobile

Nó Kora self-hosted que assina transações como `feePayer`, permitindo
que usuários do JUICE Mobile transacionem CNB sem precisar de SOL.

## Pra que serve

Quando um usuário recebe CNB no resgate, ele tem CNB mas zero SOL —
não consegue transferir, fazer swap ou usar a carteira pra nada.

O Kora resolve isso assinando como `feePayer` em todas as txs do app.
O usuário continua signando como dono dos tokens; o Kora cobre só o
fee de rede (~0.000005 SOL por tx).

Política de fee: `free` — projeto absorve o custo total. Para escalar
com volume, mudar pra `token` no `kora.toml` e cobrar em CNB.

## Deploy no Cloud Run

### Pré-requisitos
1. `gcloud` autenticado no projeto `cnbmobile-2053c` (ou outro).
2. Cloud Build, Cloud Run e Secret Manager habilitados.
3. Keypair Solana criada e fundada (ver §Funding).

### Passos

```sh
# 1. Criar a keypair do paymaster
solana-keygen new --outfile kora-keypair.json --no-bip39-passphrase

# 2. Subir como secret no Secret Manager
gcloud secrets create kora-keypair --data-file=kora-keypair.json

# 3. Subir a chave Helius (opcional, mas recomendado pra RPC estável)
echo -n "SUA_KEY_HELIUS" | gcloud secrets create helius-key --data-file=-

# 4. APAGAR o keypair-local após subir ao Secret Manager
shred -u kora-keypair.json   # ou rm em macOS

# 5. Buildar e fazer deploy
gcloud builds submit --config cloudbuild.yaml

# 6. Pegar a URL do serviço
gcloud run services describe juice-kora --region us-central1 \
  --format 'value(status.url)'
```

A URL retornada é o `EXPO_PUBLIC_KORA_URL` do app.

### Pegar o pubkey do paymaster

```sh
# Localmente, antes de apagar o JSON:
solana-keygen pubkey kora-keypair.json
# OU baixar do Secret Manager:
gcloud secrets versions access latest --secret=kora-keypair > /tmp/kp.json \
  && solana-keygen pubkey /tmp/kp.json && shred -u /tmp/kp.json
```

Esse pubkey é o `EXPO_PUBLIC_KORA_PUBKEY` do app.

## Funding

A keypair precisa de SOL para cobrir os fees:

- **Inicial**: 0.5 SOL → ~50.000 transações cobertas
- **Manutenção**: monitor automático (ver `monitorarKoraSaldo` no app `functions/`)
  envia email quando saldo cai abaixo de 0.05 SOL

```sh
# Enviar SOL pra pubkey do paymaster
solana transfer <KORA_PUBKEY> 0.5 --keypair ~/.config/solana/id.json
```

## Operação

### Logs em tempo real
```sh
gcloud logging tail "resource.type=cloud_run_revision \
  AND resource.labels.service_name=juice-kora" --format=json
```

### Métricas
- Cloud Run dashboard: latência, error rate, instance count
- Filtros úteis: `severity>=ERROR` para erros do Kora

### Rotação de keypair
1. `solana-keygen new --outfile new-kora.json`
2. `gcloud secrets versions add kora-keypair --data-file=new-kora.json`
3. Cloud Run pega a nova versão automaticamente no próximo restart
4. Transferir o saldo da keypair antiga pra nova
5. Atualizar `EXPO_PUBLIC_KORA_PUBKEY` no app, fazer novo build

### Refunding
Quando o saldo cair abaixo de 0.05 SOL, o monitor manda email.
Recarregar com `solana transfer ...` ou automatizar via Treasury Service.

## Anti-abuso

Configurado em `kora.toml`:
- 10 txs/min por source wallet
- 200 txs/dia por source wallet
- 200 txs/min globais

Se rate limit insuficiente, ajustar valores e fazer novo deploy.

## Custo

- Cloud Run (min=1, 512Mi): **~$15/mês**
- SOL para fees: **~$5 inicial + $0.50/mês** (a 1k txs/mês)
- Total: **~$20/mês fixo + microcustos**

## Arquitetura

```
App mobile
    │ POST /v1/sign
    ▼
Cloud Run (juice-kora)
    │ Lê kora-keypair do Secret Manager
    │ Valida tx (whitelist program/mint, rate limit)
    │ Assina como feePayer
    │ Submete na Solana mainnet
    ▼
Solana RPC (Helius/mainnet)
```

## Referência

- Kora oficial: https://github.com/solana-foundation/kora
- Paymaster pattern Solana: https://docs.solana.com/developing/programming-model/transactions#fee-payer
