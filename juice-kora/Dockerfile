# ─── Build stage ─────────────────────────────────────────────────────────────
FROM rust:1.78-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y \
    pkg-config libssl-dev git \
    && rm -rf /var/lib/apt/lists/*

# Clona o Kora oficial (paymaster da Solana Foundation)
# Pin de commit recomendado: substitua o branch por --depth 1 --branch <tag>
RUN git clone --depth 1 https://github.com/solana-foundation/kora.git . \
    && cargo build --release --bin kora

# ─── Runtime stage ───────────────────────────────────────────────────────────
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates libssl3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/kora /usr/local/bin/kora
COPY kora.toml /app/kora.toml

# Cloud Run injeta PORT — Kora usa 8080 por padrão; pode ser sobrescrito via env
ENV PORT=8080
EXPOSE 8080

# Secrets esperados em /secrets (montados via Secret Manager → Cloud Run)
#   /secrets/kora-keypair.json   keypair do paymaster
#   /secrets/helius-key          chave Helius para RPC

CMD ["sh", "-c", "kora --config /app/kora.toml --host 0.0.0.0 --port ${PORT}"]
