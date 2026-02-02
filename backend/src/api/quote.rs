//! LI.FI quote API handlers

use axum::{extract::Query, Json};
use serde::{Deserialize, Serialize};

use crate::services::lifi::LifiService;

/// Quote request parameters
#[derive(Deserialize)]
pub struct QuoteRequest {
    pub from_chain: String,
    pub to_chain: String,
    pub from_token: String,
    pub to_token: String,
    pub from_amount: String,
    pub from_address: Option<String>,
}

/// Quote response
#[derive(Serialize)]
pub struct QuoteResponse {
    pub from_amount: String,
    pub to_amount: String,
    pub estimated_gas: String,
    pub estimated_time: u64, // seconds
    pub route: Option<serde_json::Value>,
    pub error: Option<String>,
}

/// Get cross-chain quote from LI.FI
pub async fn get_quote(Query(params): Query<QuoteRequest>) -> Json<QuoteResponse> {
    let lifi_service = LifiService::new();

    match lifi_service.get_quote(&params).await {
        Ok(quote) => Json(QuoteResponse {
            from_amount: params.from_amount,
            to_amount: quote.to_amount,
            estimated_gas: quote.estimated_gas,
            estimated_time: quote.estimated_time,
            route: quote.route,
            error: None,
        }),
        Err(e) => Json(QuoteResponse {
            from_amount: params.from_amount,
            to_amount: "0".to_string(),
            estimated_gas: "0".to_string(),
            estimated_time: 0,
            route: None,
            error: Some(e.to_string()),
        }),
    }
}
