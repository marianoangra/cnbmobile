pub mod initialize;
pub mod acumular_pontos;
pub mod resgatar_tokens;

// Glob necessário para o macro #[program] do Anchor (gera tipos __client_accounts_*)
#[allow(ambiguous_glob_reexports)]
pub use initialize::*;
#[allow(ambiguous_glob_reexports)]
pub use acumular_pontos::*;
#[allow(ambiguous_glob_reexports)]
pub use resgatar_tokens::*;

// Aliases explícitos para os handlers (evita ambiguidade no lib.rs)
pub use initialize::handler as initialize_handler;
pub use acumular_pontos::handler as acumular_handler;
pub use resgatar_tokens::handler as resgatar_handler;
