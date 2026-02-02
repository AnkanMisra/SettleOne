//! Session management API handlers

use axum::{extract::Path, Json};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::api::error::AppError;
use crate::models::session::{Session, SessionStatus};

/// Create session request
#[derive(Deserialize)]
pub struct CreateSessionRequest {
    pub user_address: String,
}

/// Create session response
#[derive(Serialize)]
pub struct CreateSessionResponse {
    pub session_id: String,
    pub status: String,
}

/// Add payment request
#[derive(Deserialize)]
pub struct AddPaymentRequest {
    pub recipient: String,
    pub recipient_ens: Option<String>,
    pub amount: String, // String to handle large numbers
}

/// Session response
#[derive(Serialize)]
pub struct SessionResponse {
    pub session: Session,
}

/// Create a new session
pub async fn create_session(
    Json(payload): Json<CreateSessionRequest>,
) -> Result<Json<CreateSessionResponse>, AppError> {
    let session_id = Uuid::new_v4().to_string();

    // TODO: Integrate with Yellow SDK
    tracing::info!(
        "Creating session {} for user {}",
        session_id,
        payload.user_address
    );

    Ok(Json(CreateSessionResponse {
        session_id,
        status: "active".to_string(),
    }))
}

/// Get session by ID
pub async fn get_session(Path(id): Path<String>) -> Result<Json<SessionResponse>, AppError> {
    // TODO: Fetch from session store
    tracing::info!("Getting session {}", id);

    Ok(Json(SessionResponse {
        session: Session {
            id: id.clone(),
            user: "0x...".to_string(),
            status: SessionStatus::Active,
            payments: vec![],
            total_amount: "0".to_string(),
            created_at: chrono::Utc::now(),
        },
    }))
}

/// Add payment to session
pub async fn add_payment(
    Path(id): Path<String>,
    Json(payload): Json<AddPaymentRequest>,
) -> Result<Json<SessionResponse>, AppError> {
    tracing::info!(
        "Adding payment to session {}: {} to {} (ENS: {:?})",
        id,
        payload.amount,
        payload.recipient,
        payload.recipient_ens
    );

    // TODO: Add to session store
    Err(AppError::NotImplemented(
        "Add payment not implemented".to_string(),
    ))
}

/// Finalize session
#[derive(Serialize)]
pub struct FinalizeResponse {
    pub tx_hash: String,
}

pub async fn finalize_session(Path(id): Path<String>) -> Result<Json<FinalizeResponse>, AppError> {
    tracing::info!("Finalizing session {}", id);

    // TODO: Call smart contract
    Err(AppError::NotImplemented(
        "Finalize session not implemented".to_string(),
    ))
}
