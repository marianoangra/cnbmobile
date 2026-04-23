use anchor_lang::prelude::*;
use anchor_lang::solana_program::pubkey::Pubkey;
use std::str::FromStr;
use crate::{state::UserAccount, constants::*, error::CnbError};

/// Acumula pontos e minutos para um usuário.
/// Chamado pela Cloud Function ao fim de cada sessão de carregamento.
/// Aceita a sessão completa: até 20.000 pts e 1.440 min por chamada.
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
    let expected = Pubkey::from_str(SERVER_AUTHORITY).unwrap();
    require!(ctx.accounts.authority.key() == expected, CnbError::UnauthorizedAuthority);

    // Máximo de pontos por sessão: 1440 min * 10 pts + 24h * 50 bônus = 15.600 pts
    require!(pontos >= 1 && pontos <= 20_000, CnbError::InvalidPontosAmount);
    // Sessão de no máximo 24 horas
    require!(minutos >= 1 && minutos <= 1440, CnbError::InvalidMinutosAmount);

    let user = &mut ctx.accounts.user_account;
    user.pontos = user.pontos.saturating_add(pontos);
    user.minutos = user.minutos.saturating_add(minutos);

    msg!(
        "AcumularPontos: +{} pts +{} min → total {} pts {} min",
        pontos, minutos, user.pontos, user.minutos
    );
    Ok(())
}
