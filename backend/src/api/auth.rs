use crate::{api::error::AppError, services::auth, AppState};
use axum::{extract::State, Json};
use serde::Deserialize;
use serde_json::{json, Value};
#[derive(Deserialize)]
pub struct ChallengeRequest {
    pub address: String,
}
#[derive(Deserialize)]
pub struct VerifyRequest {
    pub challenge_id: String,
    pub signature: String,
}
pub async fn challenge(
    State(state): State<AppState>,
    Json(request): Json<ChallengeRequest>,
) -> Result<Json<Value>, AppError> {
    let (id, message) =
        auth::challenge(&state.session_store, &request.address, &state.auth_origin)?;
    Ok(Json(json!({"challenge_id":id,"message":message})))
}
pub async fn verify(
    State(state): State<AppState>,
    Json(request): Json<VerifyRequest>,
) -> Result<Json<Value>, AppError> {
    let (token, owner) = auth::verify(
        &state.session_store,
        &request.challenge_id,
        &request.signature,
    )?;
    Ok(Json(json!({"token":token,"address":owner})))
}
