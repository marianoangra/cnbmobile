use anchor_lang::prelude::*;

#[error_code]
pub enum CnbError {
    #[msg("Signer não autorizado. Apenas a authority do servidor pode chamar esta instrução.")]
    UnauthorizedAuthority,

    #[msg("Quantidade de pontos inválida. Deve ser entre 1 e 60.")]
    InvalidPontosAmount,

    #[msg("Minutos inválidos. Deve ser exatamente 1 por chamada.")]
    InvalidMinutosAmount,

    #[msg("Pontos insuficientes para resgate.")]
    InsufficientPontos,

    #[msg("Quantidade mínima de resgate: 100.000 pontos.")]
    BelowMinimumRedeem,
}
