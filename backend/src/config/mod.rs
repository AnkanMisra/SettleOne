//! Application configuration

#![allow(dead_code)]

use serde::Deserialize;

/// Application configuration
#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    /// Server port
    pub port: u16,

    /// Ethereum RPC URL (for ENS resolution)
    pub eth_rpc_url: String,

    /// Arc chain RPC URL
    pub arc_rpc_url: String,

    /// LI.FI API URL
    pub lifi_api_url: String,

    /// LI.FI API key (optional)
    pub lifi_api_key: Option<String>,

    /// Yellow API key
    pub yellow_api_key: Option<String>,
}

impl Config {
    /// Load configuration from environment
    pub fn from_env() -> Self {
        Self {
            port: std::env::var("PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(3001),
            eth_rpc_url: std::env::var("ETH_RPC_URL")
                .unwrap_or_else(|_| "https://eth.llamarpc.com".to_string()),
            arc_rpc_url: std::env::var("ARC_RPC_URL")
                .unwrap_or_else(|_| "https://rpc.arc.circle.com".to_string()),
            lifi_api_url: std::env::var("LIFI_API_URL")
                .unwrap_or_else(|_| "https://li.quest/v1".to_string()),
            lifi_api_key: std::env::var("LIFI_API_KEY").ok(),
            yellow_api_key: std::env::var("YELLOW_API_KEY").ok(),
        }
    }
}

impl Default for Config {
    fn default() -> Self {
        Self::from_env()
    }
}
