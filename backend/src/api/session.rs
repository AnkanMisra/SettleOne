//! Session management API handlers

#![allow(dead_code)]
#![allow(unused_imports)]

use axum::{
    extract::{Path, State},
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::models::session::{Payment, Session, SessionStatus};
use crate::services::session::SessionService;

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
    pub session: Option<Session>,
    pub error: Option<String>,
}

/// Create a new session
pub async fn create_session(
    Json(payload): Json<CreateSessionRequest>,
) -> Json<CreateSessionResponse> {
    let session_id = Uuid::new_v4().to_string();

    // TODO: Integrate with Yellow SDK
    tracing::info!(
        "Creating session {} for user {}",
        session_id,
        payload.user_address
    );

    Json(CreateSessionResponse {
        session_id,
        status: "active".to_string(),
    })
}

/// Get session by ID
pub async fn get_session(Path(id): Path<String>) -> Json<SessionResponse> {
    // TODO: Fetch from session store
    tracing::info!("Getting session {}", id);

    Json(SessionResponse {
        session: Some(Session {
            id: id.clone(),
            user: "0x...".to_string(),
            status: SessionStatus::Active,
            payments: vec![],
            total_amount: "0".to_string(),
            created_at: chrono::Utc::now(),
        }),
        error: None,
    })
}

/// Add payment to session
pub async fn add_payment(
    Path(id): Path<String>,
    Json(payload): Json<AddPaymentRequest>,
) -> Json<SessionResponse> {
    tracing::info!(
        "Adding payment to session {}: {} to {}",
        id,
        payload.amount,
        payload.recipient
    );

    // TODO: Add to session store
    Json(SessionResponse {
        session: None,
        error: Some("Not implemented".to_string()),
    })
}

/// Finalize session
#[derive(Serialize)]
pub struct FinalizeResponse {
    pub tx_hash: Option<String>,
    pub error: Option<String>,
}

pub async fn finalize_session(Path(id): Path<String>) -> Json<FinalizeResponse> {
    tracing::info!("Finalizing session {}", id);

    // TODO: Call smart contract
    Json(FinalizeResponse {
        tx_hash: None,
        error: Some("Not implemented".to_string()),
    })
}
