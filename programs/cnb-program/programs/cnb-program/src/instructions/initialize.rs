use anchor_lang::prelude::*;
use anchor_lang::solana_program::pubkey::Pubkey;
use std::str::FromStr;
use crate::{state::UserAccount, constants::*, error::CnbError};

/// Cria o UserAccount PDA para um novo usuário.
/// Chamado pela Cloud Function na primeira vez que o usuário usa o app.
#[derive(Accounts)]
#[instruction(uid_hash: [u8; 16])]
pub struct InitializeUser<'info> {
    /// Authority do servidor — única que pode criar contas
    #[account(mut)]
    pub authority: Signer<'info>,

    /// PDA do usuário — criado aqui
    #[account(
        init,
        payer = authority,
        space = USER_ACCOUNT_SIZE,
        seeds = [USER_SEED, &uid_hash],
        bump,
    )]
    pub user_account: Account<'info, UserAccount>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeUser>,
    uid_hash: [u8; 16],
    referrer: Option<[u8; 16]>,
) -> Result<()> {
    let expected = Pubkey::from_str(SERVER_AUTHORITY).unwrap();
    require!(ctx.accounts.authority.key() == expected, CnbError::UnauthorizedAuthority);

    let user = &mut ctx.accounts.user_account;
    user.uid_hash = uid_hash;
    user.pontos = 0;
    user.minutos = 0;
    user.referrer = referrer;
    user.nivel = 1;
    user.bump = ctx.bumps.user_account;

    msg!(
        "UserAccount criado para uid_hash: {:?} | referrer: {:?}",
        uid_hash, referrer
    );
    Ok(())
}
