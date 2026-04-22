pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("BoVj5VrUx4zzE9JWFrneGWyePNt4DYGP2AHb9ZUxXZmo");

#[program]
pub mod cnb_program {
    use super::*;

    /// Cria o UserAccount PDA para um novo usuário (primeira vez)
    pub fn initialize_user(ctx: Context<InitializeUser>, uid_hash: [u8; 16]) -> Result<()> {
        instructions::initialize::handler(ctx, uid_hash)
    }

    /// Acumula pontos e minutos — chamado pela Cloud Function a cada minuto de carregamento
    pub fn acumular_pontos(
        ctx: Context<AcumularPontos>,
        uid_hash: [u8; 16],
        pontos: u64,
        minutos: u32,
    ) -> Result<()> {
        instructions::acumular_pontos::handler(ctx, uid_hash, pontos, minutos)
    }

    /// Debita pontos atomicamente antes do SPL transfer (resgate CNB)
    pub fn resgatar_tokens(
        ctx: Context<ResgatarTokens>,
        uid_hash: [u8; 16],
        quantidade: u64,
    ) -> Result<()> {
        instructions::resgatar_tokens::handler(ctx, uid_hash, quantidade)
    }
}
