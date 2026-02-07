//! ENS resolution API handlers

use axum::{extract::Query, extract::State, Json};
use serde::{Deserialize, Serialize};

use crate::AppState;

/// ENS resolution request
#[derive(Deserialize)]
pub struct ResolveRequest {
    pub name: String,
}

/// ENS resolution response
#[derive(Serialize)]
pub struct ResolveResponse {
    pub name: String,
    pub address: Option<String>,
    pub avatar: Option<String>,
    pub error: Option<String>,
}

/// Resolve an ENS name to an address
pub async fn resolve_ens(
    State(state): State<AppState>,
    Query(params): Query<ResolveRequest>,
) -> Json<ResolveResponse> {
    match state.ens_service.resolve(&params.name).await {
        Ok(result) => Json(ResolveResponse {
            name: params.name,
            address: Some(result.address),
            avatar: result.avatar,
            error: None,
        }),
        Err(e) => Json(ResolveResponse {
            name: params.name,
            address: None,
            avatar: None,
            error: Some(e.to_string()),
        }),
    }
}

/// Address lookup request
#[derive(Deserialize)]
pub struct LookupRequest {
    pub address: String,
}

/// Address lookup response
#[derive(Serialize)]
pub struct LookupResponse {
    pub address: String,
    pub name: Option<String>,
    pub error: Option<String>,
}

/// Reverse lookup: address to ENS name
pub async fn lookup_address(
    State(state): State<AppState>,
    Query(params): Query<LookupRequest>,
) -> Json<LookupResponse> {
    match state.ens_service.reverse_lookup(&params.address).await {
        Ok(name) => Json(LookupResponse {
            address: params.address,
            name,
            error: None,
        }),
        Err(e) => Json(LookupResponse {
            address: params.address,
            name: None,
            error: Some(e.to_string()),
        }),
    }
}
