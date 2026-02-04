//! Session management API handlers

use axum::{
    extract::{Path, State},
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::api::error::AppError;
use crate::models::session::{Payment, PaymentStatus, Session};
use crate::AppState;

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
    State(state): State<AppState>,
    Json(payload): Json<CreateSessionRequest>,
) -> Result<Json<CreateSessionResponse>, AppError> {
    let session_id = Uuid::new_v4().to_string();

    // Create session in the store
    let session = state
        .session_store
        .create(session_id.clone(), payload.user_address.clone())
        .await;

    tracing::info!(
        "Created session {} for user {}",
        session.id,
        payload.user_address
    );

    Ok(Json(CreateSessionResponse {
        session_id: session.id,
        status: "active".to_string(),
    }))
}

/// Get session by ID
pub async fn get_session(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<SessionResponse>, AppError> {
    tracing::info!("Getting session {}", id);

    match state.session_store.get(&id).await {
        Some(session) => Ok(Json(SessionResponse { session })),
        None => Err(AppError::NotFound(format!("Session {} not found", id))),
    }
}

/// Add payment to session
pub async fn add_payment(
    State(state): State<AppState>,
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

    // Create the payment
    let payment = Payment {
        id: Uuid::new_v4().to_string(),
        recipient: payload.recipient,
        recipient_ens: payload.recipient_ens,
        amount: payload.amount,
        status: PaymentStatus::Pending,
        created_at: chrono::Utc::now(),
    };

    // Add to session store
    match state.session_store.add_payment(&id, payment).await {
        Some(session) => Ok(Json(SessionResponse { session })),
        None => Err(AppError::NotFound(format!(
            "Session {} not found or payment failed",
            id
        ))),
    }
}

/// Finalize session
#[derive(Serialize)]
pub struct FinalizeResponse {
    pub session_id: String,
    pub status: String,
    pub tx_hash: Option<String>,
}

pub async fn finalize_session(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<FinalizeResponse>, AppError> {
    tracing::info!("Finalizing session {}", id);

    use crate::models::session::SessionStatus;

    // Update session status to pending settlement
    match state
        .session_store
        .update_status(&id, SessionStatus::Pending)
        .await
    {
        Some(_session) => {
            // TODO: Call smart contract for on-chain settlement
            // For now, return a placeholder response
            Ok(Json(FinalizeResponse {
                session_id: id,
                status: "pending".to_string(),
                tx_hash: None, // Will be set after actual contract call
            }))
        }
        None => Err(AppError::NotFound(format!("Session {} not found", id))),
    }
}
