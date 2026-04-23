use anchor_lang::prelude::*;

/// Conta on-chain por usuário CNBMobile.
/// PDA seeds: ["user", uid_hash]
/// uid_hash = sha256(firebase_uid).slice(0..16) — preserva privacidade na chain pública.
#[account]
pub struct UserAccount {
    /// Hash do Firebase UID (16 bytes) — identificador privado on-chain
    pub uid_hash: [u8; 16],
    /// Total de pontos acumulados
    pub pontos: u64,
    /// Total de minutos de carregamento acumulados
    pub minutos: u32,
    /// uid_hash do referrer (None se sem indicação)
    pub referrer: Option<[u8; 16]>,
    /// Nível do usuário (calculado off-chain, gravado aqui como referência)
    pub nivel: u8,
    /// Bump seed do PDA
    pub bump: u8,
}
