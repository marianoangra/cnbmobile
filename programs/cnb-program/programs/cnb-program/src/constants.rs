use anchor_lang::prelude::*;

#[constant]
pub const USER_SEED: &[u8] = b"user";

#[constant]
pub const AUTHORITY_SEED: &[u8] = b"authority";

/// Única pubkey autorizada a chamar instruções privilegiadas.
/// Carteira do projeto CNBMobile (Cloud Function signer).
pub const SERVER_AUTHORITY: &str = "8Zrt5KwcFzmH1NemHNnFgiqXMP6HCThNxCNchHisQsg8";

// Tamanho do UserAccount:
//   8  discriminator
//  16  uid_hash
//   8  pontos (u64)
//   4  minutos (u32)
//  17  referrer (Option<[u8;16]> = 1 flag + 16 bytes)
//   1  nivel (u8)
//   1  bump (u8)
pub const USER_ACCOUNT_SIZE: usize = 8 + 16 + 8 + 4 + 17 + 1 + 1;
