use crate::{api::error::AppError, AppState};
use axum::{
    extract::{Query, State},
    Json,
};
use serde::Deserialize;
use serde_json::Value;

#[derive(Deserialize)]
pub struct ReviewQuery {
    pub ids: Option<String>,
}

pub async fn review(
    State(state): State<AppState>,
    Query(query): Query<ReviewQuery>,
) -> Result<Json<Value>, AppError> {
    let ids = query
        .ids
        .unwrap_or_default()
        .split(',')
        .filter(|id| !id.is_empty())
        .map(|id| id.to_string())
        .collect::<Vec<_>>();
    Ok(Json(state.graph_service.review(&ids).await?))
}
