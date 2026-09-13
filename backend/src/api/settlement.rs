use crate::{api::error::AppError, models::session::address, services::auth, AppState};
use axum::{extract::State, http::HeaderMap, Json};
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Deserialize)]
pub struct ConfigureRequest {
    pub address: String,
}

pub async fn get_contract(State(state): State<AppState>) -> Result<Json<Value>, AppError> {
    Ok(Json(
        json!({"contract": state.settlement_service.current_contract()?}),
    ))
}

pub async fn configure_contract(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<ConfigureRequest>,
) -> Result<Json<Value>, AppError> {
    let _owner = auth::owner(&state.session_store, &headers)?;
    let contract = state
        .settlement_service
        .adopt(&address(&payload.address)?)
        .await?;
    Ok(Json(json!({"contract": contract})))
}
