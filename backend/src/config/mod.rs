//! Application configuration

use serde::Deserialize;

/// Application configuration
#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
pub struct Config {
    /// Server port
    pub port: u16,

    /// Ethereum RPC URL (for ENS resolution)
    pub eth_rpc_url: String,

    /// Arc chain RPC URL
    pub arc_rpc_url: String,

    /// LI.FI API URL
    pub lifi_api_url: String,

    /// LI.FI API Key (optional)
    pub lifi_api_key: Option<String>,

    /// Yellow Network API Key (optional)
    pub yellow_api_key: Option<String>,
}

#[allow(dead_code)]
impl Config {
    /// Load configuration from environment
    pub fn from_env() -> Self {
        let port = std::env::var("PORT")
            .unwrap_or_else(|_| "3001".to_string())
            .parse()
            .unwrap_or(3001);

        let eth_rpc_url =
            std::env::var("ETH_RPC_URL").unwrap_or_else(|_| "https://eth.llamarpc.com".to_string());

        let arc_rpc_url = std::env::var("ARC_RPC_URL")
            .unwrap_or_else(|_| "https://rpc.arc.circle.com".to_string());

        let lifi_api_url =
            std::env::var("LIFI_API_URL").unwrap_or_else(|_| "https://li.quest/v1".to_string());

        let lifi_api_key = std::env::var("LIFI_API_KEY").ok();
        let yellow_api_key = std::env::var("YELLOW_API_KEY").ok();

        Self {
            port,
            eth_rpc_url,
            arc_rpc_url,
            lifi_api_url,
            lifi_api_key,
            yellow_api_key,
        }
    }
}
