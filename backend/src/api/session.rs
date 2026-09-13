//! Authenticated persistent session endpoints.
use crate::{
    api::error::AppError,
    models::session::{address, amount, Payment, PaymentStatus, Session, SessionStatus},
    services::{auth, settlement::ReceiptOutcome},
    AppState,
};
use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Deserialize)]
pub struct CreateSessionRequest {
    pub user_address: String,
    pub budget: String,
}
#[derive(Deserialize)]
pub struct AddPaymentRequest {
    pub recipient: String,
    pub recipient_ens: Option<String>,
    pub amount: String,
}
#[derive(Deserialize)]
pub struct FinalizeRequest {
    pub tx_hash: String,
}

pub async fn create_session(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CreateSessionRequest>,
) -> Result<Json<Value>, AppError> {
    let owner = auth::owner(&state.session_store, &headers)?;
    if address(&payload.user_address)? != owner {
        return Err(AppError::Unauthorized(
            "Wallet does not own this session".into(),
        ));
    }
    amount(&payload.budget)?;
    let session = Session::new(uuid::Uuid::new_v4().to_string(), owner, payload.budget);
    state.session_store.create(&session)?;
    Ok(Json(
        json!({"session_id":session.id,"status":session.status,"session":session}),
    ))
}
pub async fn get_session(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let owner = auth::owner(&state.session_store, &headers)?;
    Ok(Json(
        json!({"session":state.session_store.get(&id,&owner)?}),
    ))
}
pub async fn add_payment(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<AddPaymentRequest>,
) -> Result<Json<Value>, AppError> {
    let owner = auth::owner(&state.session_store, &headers)?;
    let recipient = address(&payload.recipient)?;
    amount(&payload.amount)?;
    if payload
        .recipient_ens
        .as_ref()
        .is_some_and(|s| s.len() > 255)
    {
        return Err(AppError::BadRequest("Name is too long".into()));
    }
    let session = state.session_store.edit(&id, &owner, |session| {
        session.invalidate_approval()?;
        if session.payments.len() >= 100 {
            return Err(AppError::BadRequest("Maximum 100 recipients".into()));
        }
        session.payments.push(Payment {
            id: uuid::Uuid::new_v4().to_string(),
            recipient,
            recipient_ens: payload.recipient_ens,
            amount: payload.amount,
            status: PaymentStatus::Pending,
            created_at: chrono::Utc::now(),
        });
        session.recalculate()
    })?;
    Ok(Json(json!({"session":session})))
}
pub async fn remove_payment(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((id, payment_id)): Path<(String, String)>,
) -> Result<Json<Value>, AppError> {
    let owner = auth::owner(&state.session_store, &headers)?;
    let session = state.session_store.edit(&id, &owner, |session| {
        session.invalidate_approval()?;
        let index = session
            .payments
            .iter()
            .position(|p| p.id == payment_id)
            .ok_or_else(|| AppError::NotFound("Payment not found".into()))?;
        session.payments.remove(index);
        session.recalculate()
    })?;
    Ok(Json(json!({"session":session})))
}
pub async fn prepare_session(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let owner = auth::owner(&state.session_store, &headers)?;
    let snapshot = state.session_store.get(&id, &owner)?;
    if snapshot.status != SessionStatus::Draft || snapshot.payments.is_empty() {
        return Err(AppError::Conflict(
            "Prepare a nonempty editable draft".into(),
        ));
    }
    let prepared = state.settlement_service.prepare(&snapshot).await?;
    let before = serde_json::to_string(&snapshot)?;
    let session = state.session_store.edit(&id, &owner, |session| {
        if serde_json::to_string(session)? != before {
            return Err(AppError::Conflict(
                "Draft changed while preparing; review it again".into(),
            ));
        }
        session.prepared = Some(prepared);
        session.status = SessionStatus::AwaitingApproval;
        Ok(())
    })?;
    Ok(Json(json!({"session":session})))
}
pub async fn reset_session(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let owner = auth::owner(&state.session_store, &headers)?;
    let session = state
        .session_store
        .edit(&id, &owner, |session| session.invalidate_approval())?;
    Ok(Json(json!({"session":session})))
}
pub async fn finalize_session(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<FinalizeRequest>,
) -> Result<Json<Value>, AppError> {
    let owner = auth::owner(&state.session_store, &headers)?;
    let hash = payload.tx_hash.to_ascii_lowercase();
    if hash.len() != 66
        || !hash.starts_with("0x")
        || !hash[2..].bytes().all(|b| b.is_ascii_hexdigit())
    {
        return Err(AppError::BadRequest("Invalid transaction hash".into()));
    }
    let snapshot = state.session_store.get(&id, &owner)?;
    if snapshot.status == SessionStatus::Confirmed && snapshot.tx_hash.as_ref() == Some(&hash) {
        return Ok(Json(json!({"session":snapshot})));
    }
    if !matches!(
        snapshot.status,
        SessionStatus::AwaitingApproval | SessionStatus::Submitted
    ) {
        return Err(AppError::Conflict(
            "Session is not awaiting a settlement".into(),
        ));
    }
    if snapshot
        .tx_hash
        .as_ref()
        .is_some_and(|existing| existing != &hash)
    {
        return Err(AppError::Conflict(
            "A different transaction is already being reconciled".into(),
        ));
    }
    // RPC checks happen before saving a hash; hashes alone never establish confirmation.
    let outcome = state.settlement_service.verify(&snapshot, &hash).await?;
    let before = serde_json::to_string(&snapshot)?;
    let session = state.session_store.edit(&id, &owner, |session| {
        if session.status == SessionStatus::Confirmed && session.tx_hash.as_ref() == Some(&hash) {
            return Ok(());
        }
        if serde_json::to_string(session)? != before {
            return Err(AppError::Conflict(
                "Session changed; retry reconciliation".into(),
            ));
        }
        session.tx_hash = Some(hash);
        match outcome {
            ReceiptOutcome::Pending => session.status = SessionStatus::Submitted,
            ReceiptOutcome::Confirmed => {
                session.status = SessionStatus::Confirmed;
                for payment in &mut session.payments {
                    payment.status = PaymentStatus::Confirmed;
                }
            }
            ReceiptOutcome::Reverted => {
                session.status = SessionStatus::Failed;
                session.failure =
                    Some("Arc transaction reverted; no batch payments settled".into());
            }
        }
        Ok(())
    })?;
    Ok(Json(json!({"session":session})))
}
