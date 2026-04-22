use anchor_lang::prelude::*;
use crate::{state::UserAccount, constants::*, error::CnbError};

/// Acumula pontos e minutos para um usuário.
/// Chamado pela Cloud Function a cada minuto de carregamento.
/// Máximo 60 pts por chamada (10/min + 50 bônus hora) — espelha a regra do Firestore.
#[derive(Accounts)]
#[instruction(uid_hash: [u8; 16])]
pub struct AcumularPontos<'info> {
    /// Authority do servidor — única permitida
    pub authority: Signer<'info>,

    /// PDA do usuário
    #[account(
        mut,
        seeds = [USER_SEED, &uid_hash],
        bump = user_account.bump,
    )]
    pub user_account: Account<'info, UserAccount>,
}

pub fn handler(
    ctx: Context<AcumularPontos>,
    _uid_hash: [u8; 16],
    pontos: u64,
    minutos: u32,
) -> Result<()> {
    // Valida quantidade de pontos (máx 60 por chamada)
    require!(pontos >= 1 && pontos <= 60, CnbError::InvalidPontosAmount);
    // Valida minutos (sempre 1 por chamada)
    require!(minutos == 1, CnbError::InvalidMinutosAmount);

    let user = &mut ctx.accounts.user_account;
    user.pontos = user.pontos.saturating_add(pontos);
    user.minutos = user.minutos.saturating_add(minutos);

    msg!(
        "AcumularPontos: +{} pts +{} min → total {} pts {} min",
        pontos, minutos, user.pontos, user.minutos
    );
    Ok(())
}
