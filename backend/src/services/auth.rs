//! Wallet proof authenticates API ownership, never authorizes spending.
use crate::{api::error::AppError, models::session::address, services::session::SessionStore};
use axum::http::HeaderMap;
use k256::ecdsa::{RecoveryId, Signature, VerifyingKey};
use rusqlite::{params, OptionalExtension};
use sha3::{Digest, Keccak256};

pub fn hash(bytes: &[u8]) -> String {
    format!("0x{}", hex::encode(Keccak256::digest(bytes)))
}

pub fn recover(message: &str, signature: &str) -> Result<String, AppError> {
    let invalid = || AppError::Unauthorized("Invalid wallet signature".into());
    let bytes =
        hex::decode(signature.strip_prefix("0x").ok_or_else(invalid)?).map_err(|_| invalid())?;
    if bytes.len() != 65 {
        return Err(invalid());
    }
    let recovery = match bytes[64] {
        27 | 28 => bytes[64] - 27,
        0 | 1 => bytes[64],
        _ => return Err(invalid()),
    };
    let signature = Signature::from_slice(&bytes[..64]).map_err(|_| invalid())?;
    let digest = Keccak256::new_with_prefix(
        format!("\x19Ethereum Signed Message:\n{}{message}", message.len()).as_bytes(),
    );
    let key = VerifyingKey::recover_from_digest(
        digest,
        &signature,
        RecoveryId::try_from(recovery).map_err(|_| invalid())?,
    )
    .map_err(|_| invalid())?;
    let encoded = key.to_encoded_point(false);
    let digest = Keccak256::digest(&encoded.as_bytes()[1..]);
    Ok(format!("0x{}", hex::encode(&digest[12..])))
}

pub fn owner(store: &SessionStore, headers: &HeaderMap) -> Result<String, AppError> {
    let token = headers
        .get("authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
        .ok_or_else(|| AppError::Unauthorized("Sign in with your wallet".into()))?;
    let owner: Option<String> = store
        .connection()?
        .query_row(
            "SELECT owner FROM auth_tokens WHERE hash=?1 AND expires>?2",
            params![hash(token.as_bytes()), chrono::Utc::now().timestamp()],
            |r| r.get(0),
        )
        .optional()?;
    owner.ok_or_else(|| AppError::Unauthorized("Wallet authentication expired".into()))
}

pub fn challenge(
    store: &SessionStore,
    wallet: &str,
    origin: &str,
) -> Result<(String, String), AppError> {
    let wallet = address(wallet)?;
    let id = uuid::Uuid::new_v4().to_string();
    let expires = chrono::Utc::now().timestamp() + 300;
    let message = format!("SettleOne wallet sign-in\nOrigin: {origin}\nWallet: {wallet}\nNonce: {id}\nExpires: {expires}\nThis authenticates payment drafts. It does not authorize transfers.");
    let connection = store.connection()?;
    connection.execute(
        "DELETE FROM challenges WHERE expires<=?1",
        [chrono::Utc::now().timestamp()],
    )?;
    connection.execute(
        "INSERT INTO challenges VALUES (?1,?2,?3,?4)",
        params![id, wallet, message, expires],
    )?;
    Ok((id, message))
}

pub fn verify(
    store: &SessionStore,
    id: &str,
    signature: &str,
) -> Result<(String, String), AppError> {
    let mut connection = store.connection()?;
    let transaction = connection.transaction()?;
    let record: Option<(String, String)> = transaction
        .query_row(
            "SELECT owner,message FROM challenges WHERE id=?1 AND expires>?2",
            params![id, chrono::Utc::now().timestamp()],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?;
    let (owner, message) =
        record.ok_or_else(|| AppError::Unauthorized("Challenge expired or already used".into()))?;
    if recover(&message, signature)? != owner {
        return Err(AppError::Unauthorized(
            "Signature belongs to a different wallet".into(),
        ));
    }
    transaction.execute("DELETE FROM challenges WHERE id=?1", [id])?;
    transaction.execute(
        "DELETE FROM auth_tokens WHERE expires<=?1",
        [chrono::Utc::now().timestamp()],
    )?;
    let token = format!(
        "{}{}",
        uuid::Uuid::new_v4().simple(),
        uuid::Uuid::new_v4().simple()
    );
    transaction.execute(
        "INSERT INTO auth_tokens VALUES (?1,?2,?3)",
        params![
            hash(token.as_bytes()),
            owner,
            chrono::Utc::now().timestamp() + 43200
        ],
    )?;
    transaction.commit()?;
    Ok((token, owner))
}
