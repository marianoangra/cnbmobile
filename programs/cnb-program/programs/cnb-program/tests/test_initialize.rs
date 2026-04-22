use {
    anchor_lang::{
        prelude::Pubkey,
        solana_program::{instruction::Instruction, system_program},
        InstructionData, ToAccountMetas,
    },
    litesvm::LiteSVM,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_keypair::Keypair,
    solana_transaction::versioned::VersionedTransaction,
};

fn uid_hash_mock() -> [u8; 16] {
    [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]
}

#[test]
fn test_initialize_user() {
    let program_id = cnb_program::id();
    let authority = Keypair::new();
    let uid_hash = uid_hash_mock();

    let (user_pda, _bump) = Pubkey::find_program_address(
        &[b"user", uid_hash.as_ref()],
        &program_id,
    );

    let mut svm = LiteSVM::new();
    let bytes = include_bytes!("../../../target/deploy/cnb_program.so");
    svm.add_program(program_id, bytes).unwrap();
    svm.airdrop(&authority.pubkey(), 1_000_000_000).unwrap();

    let instruction = Instruction::new_with_bytes(
        program_id,
        &cnb_program::instruction::InitializeUser { uid_hash }.data(),
        cnb_program::accounts::InitializeUser {
            authority: authority.pubkey(),
            user_account: user_pda,
            system_program: system_program::ID,
        }.to_account_metas(None),
    );

    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&[instruction], Some(&authority.pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[authority]).unwrap();

    let res = svm.send_transaction(tx);
    assert!(res.is_ok(), "initialize_user falhou: {:?}", res.err());
}
