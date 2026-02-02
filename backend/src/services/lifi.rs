//! LI.FI cross-chain quote service

use thiserror::Error;

use crate::api::quote::QuoteRequest;

/// LI.FI service errors
#[derive(Error, Debug)]
pub enum LifiError {
    #[error("No route available")]
    #[allow(dead_code)]
    NoRoute,

    #[error("API request failed: {0}")]
    ApiError(String),

    #[error("Invalid chain: {0}")]
    #[allow(dead_code)]
    InvalidChain(String),
}

/// Quote result from LI.FI
#[derive(Debug)]
pub struct QuoteResult {
    pub to_amount: String,
    pub estimated_gas: String,
    pub estimated_time: u64,
    pub route: Option<serde_json::Value>,
}

/// LI.FI service
pub struct LifiService {
    api_url: String,
    api_key: Option<String>,
}

impl LifiService {
    /// Create a new LI.FI service
    pub fn new() -> Self {
        let api_url =
            std::env::var("LIFI_API_URL").unwrap_or_else(|_| "https://li.quest/v1".to_string());
        let api_key = std::env::var("LIFI_API_KEY").ok();

        Self { api_url, api_key }
    }

    /// Get a cross-chain quote
    pub async fn get_quote(&self, params: &QuoteRequest) -> Result<QuoteResult, LifiError> {
        let client = reqwest::Client::new();

        let mut request = client.get(format!("{}/quote", self.api_url)).query(&[
            ("fromChain", &params.from_chain),
            ("toChain", &params.to_chain),
            ("fromToken", &params.from_token),
            ("toToken", &params.to_token),
            ("fromAmount", &params.from_amount),
        ]);

        if let Some(ref from_address) = params.from_address {
            request = request.query(&[("fromAddress", from_address)]);
        }

        if let Some(ref api_key) = self.api_key {
            request = request.header("x-lifi-api-key", api_key);
        }

        let response = request
            .send()
            .await
            .map_err(|e| LifiError::ApiError(e.to_string()))?;

        if !response.status().is_success() {
            return Err(LifiError::ApiError(format!(
                "Status: {}",
                response.status()
            )));
        }

        let data: serde_json::Value = response
            .json()
            .await
            .map_err(|e| LifiError::ApiError(e.to_string()))?;

        // Extract relevant fields from LI.FI response
        let to_amount = data["estimate"]["toAmount"]
            .as_str()
            .unwrap_or("0")
            .to_string();

        let estimated_gas = data["estimate"]["gasCosts"]
            .as_array()
            .and_then(|arr| arr.first())
            .and_then(|cost| cost["amount"].as_str())
            .unwrap_or("0")
            .to_string();

        let estimated_time = data["estimate"]["executionDuration"]
            .as_u64()
            .unwrap_or(0);

        Ok(QuoteResult {
            to_amount,
            estimated_gas,
            estimated_time,
            route: Some(data),
        })
    }
}

impl Default for LifiService {
    fn default() -> Self {
        Self::new()
    }
}
