use anchor_lang::prelude::*;

#[constant]
pub const USER_SEED: &[u8] = b"user";

#[constant]
pub const AUTHORITY_SEED: &[u8] = b"authority";

// Tamanho do UserAccount: 8 (discriminator) + 16 (uid_hash) + 8 (pontos) + 4 (minutos) + 1 (nivel) + 1 (bump)
pub const USER_ACCOUNT_SIZE: usize = 8 + 16 + 8 + 4 + 1 + 1;
