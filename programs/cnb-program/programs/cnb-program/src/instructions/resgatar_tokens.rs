use anchor_lang::prelude::*;
use anchor_lang::solana_program::pubkey::Pubkey;
use std::str::FromStr;
use crate::{state::UserAccount, constants::*, error::CnbError};

const MINIMO_RESGATE: u64 = 100_000;

/// Debita pontos do UserAccount antes da Cloud Function executar o SPL transfer.
/// O SPL transfer continua sendo feito off-chain (Cloud Function) — aqui só debita atomicamente.
#[derive(Accounts)]
#[instruction(uid_hash: [u8; 16])]
pub struct ResgatarTokens<'info> {
    /// Authority do servidor
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
    ctx: Context<ResgatarTokens>,
    _uid_hash: [u8; 16],
    quantidade: u64,
) -> Result<()> {
    let expected = Pubkey::from_str(SERVER_AUTHORITY).unwrap();
    require!(ctx.accounts.authority.key() == expected, CnbError::UnauthorizedAuthority);

    require!(quantidade >= MINIMO_RESGATE, CnbError::BelowMinimumRedeem);

    let user = &mut ctx.accounts.user_account;
    require!(user.pontos >= quantidade, CnbError::InsufficientPontos);

    user.pontos = user.pontos.saturating_sub(quantidade);

    msg!(
        "ResgatarTokens: -{} pts → saldo restante: {} pts",
        quantidade, user.pontos
    );
    Ok(())
}
