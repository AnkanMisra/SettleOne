//! ENS resolution service

use anyhow::Result;
use thiserror::Error;

/// ENS resolution errors
#[derive(Error, Debug)]
pub enum EnsError {
    #[error("Invalid ENS name: {0}")]
    InvalidName(String),

    #[error("ENS name not found: {0}")]
    NotFound(String),

    #[error("Resolution failed: {0}")]
    ResolutionFailed(String),
}

/// ENS resolution result
pub struct EnsResult {
    pub address: String,
    pub avatar: Option<String>,
}

/// ENS resolution service
pub struct EnsService {
    rpc_url: String,
}

impl EnsService {
    /// Create a new ENS service
    pub fn new() -> Self {
        let rpc_url =
            std::env::var("ETH_RPC_URL").unwrap_or_else(|_| "https://eth.llamarpc.com".to_string());

        Self { rpc_url }
    }

    /// Resolve an ENS name to an address
    pub async fn resolve(&self, name: &str) -> Result<EnsResult, EnsError> {
        // Validate ENS name
        if !name.ends_with(".eth") {
            return Err(EnsError::InvalidName(
                "ENS name must end with .eth".to_string(),
            ));
        }

        // TODO: Use alloy for actual ENS resolution
        // For now, return a placeholder for known names
        match name {
            "vitalik.eth" => Ok(EnsResult {
                address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045".to_string(),
                avatar: Some("https://euc.li/vitalik.eth".to_string()),
            }),
            _ => Err(EnsError::NotFound(name.to_string())),
        }
    }

    /// Reverse lookup: address to ENS name
    pub async fn reverse_lookup(&self, address: &str) -> Result<Option<String>, EnsError> {
        // TODO: Use alloy for actual reverse lookup
        // For now, return placeholder
        if address.to_lowercase() == "0xd8da6bf26964af9d7eed9e03e53415d37aa96045" {
            return Ok(Some("vitalik.eth".to_string()));
        }

        Ok(None)
    }
}

impl Default for EnsService {
    fn default() -> Self {
        Self::new()
    }
}
