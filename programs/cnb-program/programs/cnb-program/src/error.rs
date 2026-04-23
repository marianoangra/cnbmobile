use anchor_lang::prelude::*;

#[error_code]
pub enum CnbError {
    #[msg("Signer não autorizado. Apenas a authority do servidor pode chamar esta instrução.")]
    UnauthorizedAuthority,

    #[msg("Quantidade de pontos inválida. Deve ser entre 1 e 20.000 por sessão.")]
    InvalidPontosAmount,

    #[msg("Minutos inválidos. Deve ser entre 1 e 1.440 por sessão (máx 24h).")]
    InvalidMinutosAmount,

    #[msg("Pontos insuficientes para resgate.")]
    InsufficientPontos,

    #[msg("Quantidade mínima de resgate: 100.000 pontos.")]
    BelowMinimumRedeem,
}
