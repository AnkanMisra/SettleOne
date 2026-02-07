//! ENS resolution service
//! Resolves ENS names to Ethereum addresses using multiple providers:
//! 1. Primary: ENS public API (ensdata.net)
//! 2. Fallback: Known name cache

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

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

/// Cached ENS entry
#[derive(Clone)]
struct CacheEntry {
    address: String,
    avatar: Option<String>,
    expires_at: std::time::Instant,
}

/// ENS resolution service with caching and real on-chain resolution
pub struct EnsService {
    http_client: reqwest::Client,
    cache: Arc<RwLock<HashMap<String, CacheEntry>>>,
    /// Reverse cache: address -> name
    reverse_cache: Arc<RwLock<HashMap<String, CacheEntry>>>,
    cache_ttl: std::time::Duration,
}

impl EnsService {
    /// Create a new ENS service
    pub fn new() -> Self {
        Self {
            http_client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .expect("Failed to create HTTP client"),
            cache: Arc::new(RwLock::new(HashMap::new())),
            reverse_cache: Arc::new(RwLock::new(HashMap::new())),
            cache_ttl: std::time::Duration::from_secs(300), // 5 minute cache
        }
    }

    /// Validate an ENS name format
    fn validate_name(name: &str) -> Result<(), EnsError> {
        if !name.ends_with(".eth") {
            return Err(EnsError::InvalidName(
                "ENS name must end with .eth".to_string(),
            ));
        }

        let label = name.trim_end_matches(".eth");
        if label.len() < 3 {
            return Err(EnsError::InvalidName(
                "ENS label must be at least 3 characters".to_string(),
            ));
        }

        // Basic character validation
        if !label
            .chars()
            .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
        {
            return Err(EnsError::InvalidName(
                "ENS label contains invalid characters".to_string(),
            ));
        }

        Ok(())
    }

    /// Resolve an ENS name to an address
    pub async fn resolve(&self, name: &str) -> Result<EnsResult, EnsError> {
        // Validate ENS name
        Self::validate_name(name)?;

        let name_lower = name.to_lowercase();

        // Check cache first
        {
            let cache = self.cache.read().await;
            if let Some(entry) = cache.get(&name_lower) {
                if entry.expires_at > std::time::Instant::now() {
                    tracing::debug!("ENS cache hit for {}", name);
                    return Ok(EnsResult {
                        address: entry.address.clone(),
                        avatar: entry.avatar.clone(),
                    });
                }
            }
        }

        // Try primary resolution via ensdata.net API
        match self.resolve_via_api(&name_lower).await {
            Ok(result) => {
                // Cache the result
                self.cache_result(&name_lower, &result.address, &result.avatar)
                    .await;
                tracing::info!("Resolved {} -> {}", name, result.address);
                return Ok(result);
            }
            Err(e) => {
                tracing::warn!("ENS API resolution failed for {}: {}", name, e);
            }
        }

        // Fallback: try the ENS subgraph
        match self.resolve_via_subgraph(&name_lower).await {
            Ok(result) => {
                self.cache_result(&name_lower, &result.address, &result.avatar)
                    .await;
                tracing::info!("Resolved {} -> {} (via subgraph)", name, result.address);
                return Ok(result);
            }
            Err(e) => {
                tracing::warn!("ENS subgraph resolution failed for {}: {}", name, e);
            }
        }

        Err(EnsError::NotFound(name.to_string()))
    }

    /// Resolve via ensdata.net public API
    async fn resolve_via_api(&self, name: &str) -> Result<EnsResult, EnsError> {
        let url = format!("https://ensdata.net/{}", name);

        let response = self
            .http_client
            .get(&url)
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|e| EnsError::ResolutionFailed(format!("HTTP request failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(EnsError::NotFound(name.to_string()));
        }

        let data: serde_json::Value = response
            .json()
            .await
            .map_err(|e| EnsError::ResolutionFailed(format!("Failed to parse response: {}", e)))?;

        // ensdata.net returns { address: "0x...", avatar: "...", ... }
        let address = data["address"]
            .as_str()
            .ok_or_else(|| EnsError::NotFound(name.to_string()))?;

        if address.is_empty() || address == "0x0000000000000000000000000000000000000000" {
            return Err(EnsError::NotFound(name.to_string()));
        }

        let avatar = data["avatar"].as_str().map(|s| s.to_string());

        Ok(EnsResult {
            address: address.to_string(),
            avatar,
        })
    }

    /// Resolve via ENS subgraph (The Graph)
    async fn resolve_via_subgraph(&self, name: &str) -> Result<EnsResult, EnsError> {
        let query = serde_json::json!({
            "query": format!(
                r#"{{
                    domains(where: {{ name: "{}" }}) {{
                        resolvedAddress {{ id }}
                    }}
                }}"#,
                name
            )
        });

        let response = self
            .http_client
            .post("https://api.thegraph.com/subgraphs/name/ensdomains/ens")
            .json(&query)
            .send()
            .await
            .map_err(|e| EnsError::ResolutionFailed(format!("Subgraph request failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(EnsError::ResolutionFailed(
                "Subgraph returned error".to_string(),
            ));
        }

        let data: serde_json::Value = response
            .json()
            .await
            .map_err(|e| EnsError::ResolutionFailed(format!("Failed to parse response: {}", e)))?;

        let address = data["data"]["domains"][0]["resolvedAddress"]["id"]
            .as_str()
            .ok_or_else(|| EnsError::NotFound(name.to_string()))?;

        if address.is_empty() || address == "0x0000000000000000000000000000000000000000" {
            return Err(EnsError::NotFound(name.to_string()));
        }

        Ok(EnsResult {
            address: address.to_string(),
            avatar: None,
        })
    }

    /// Cache a resolution result
    async fn cache_result(&self, name: &str, address: &str, avatar: &Option<String>) {
        let entry = CacheEntry {
            address: address.to_string(),
            avatar: avatar.clone(),
            expires_at: std::time::Instant::now() + self.cache_ttl,
        };

        let mut cache = self.cache.write().await;
        cache.insert(name.to_string(), entry.clone());

        // Also populate reverse cache
        let mut reverse = self.reverse_cache.write().await;
        reverse.insert(
            address.to_lowercase(),
            CacheEntry {
                address: name.to_string(), // store name in address field for reverse
                avatar: avatar.clone(),
                expires_at: std::time::Instant::now() + self.cache_ttl,
            },
        );
    }

    /// Reverse lookup: address to ENS name
    pub async fn reverse_lookup(&self, address: &str) -> Result<Option<String>, EnsError> {
        let addr_lower = address.to_lowercase();

        // Check reverse cache first
        {
            let cache = self.reverse_cache.read().await;
            if let Some(entry) = cache.get(&addr_lower) {
                if entry.expires_at > std::time::Instant::now() {
                    tracing::debug!("ENS reverse cache hit for {}", address);
                    return Ok(Some(entry.address.clone()));
                }
            }
        }

        // Try reverse lookup via ensdata.net
        match self.reverse_via_api(&addr_lower).await {
            Ok(Some(name)) => {
                // Cache the reverse result
                let mut cache = self.reverse_cache.write().await;
                cache.insert(
                    addr_lower,
                    CacheEntry {
                        address: name.clone(),
                        avatar: None,
                        expires_at: std::time::Instant::now() + self.cache_ttl,
                    },
                );
                tracing::info!("Reverse resolved {} -> {}", address, name);
                Ok(Some(name))
            }
            Ok(None) => Ok(None),
            Err(e) => {
                tracing::warn!("Reverse lookup failed for {}: {}", address, e);
                Ok(None)
            }
        }
    }

    /// Reverse lookup via ensdata.net
    async fn reverse_via_api(&self, address: &str) -> Result<Option<String>, EnsError> {
        let url = format!("https://ensdata.net/{}", address);

        let response = self
            .http_client
            .get(&url)
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|e| EnsError::ResolutionFailed(format!("HTTP request failed: {}", e)))?;

        if !response.status().is_success() {
            return Ok(None);
        }

        let data: serde_json::Value = response
            .json()
            .await
            .map_err(|e| EnsError::ResolutionFailed(format!("Failed to parse response: {}", e)))?;

        let name = data["ens"].as_str().or(data["name"].as_str());

        Ok(name.map(|s| s.to_string()))
    }
}

impl Default for EnsService {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_name_valid() {
        assert!(EnsService::validate_name("vitalik.eth").is_ok());
        assert!(EnsService::validate_name("my-name.eth").is_ok());
        assert!(EnsService::validate_name("abc.eth").is_ok());
    }

    #[test]
    fn test_validate_name_invalid() {
        // Missing .eth
        assert!(EnsService::validate_name("vitalik").is_err());
        // Too short
        assert!(EnsService::validate_name("ab.eth").is_err());
        // Invalid characters
        assert!(EnsService::validate_name("hello world.eth").is_err());
    }

    #[tokio::test]
    async fn test_cache_hit() {
        let service = EnsService::new();

        // Manually populate cache
        service
            .cache_result(
                "test.eth",
                "0x1234567890abcdef1234567890abcdef12345678",
                &None,
            )
            .await;

        // Should hit cache
        let result = service.resolve("test.eth").await;
        assert!(result.is_ok());
        assert_eq!(
            result.unwrap().address,
            "0x1234567890abcdef1234567890abcdef12345678"
        );
    }

    #[tokio::test]
    async fn test_reverse_cache_hit() {
        let service = EnsService::new();

        // Manually populate cache
        service
            .cache_result(
                "test.eth",
                "0x1234567890abcdef1234567890abcdef12345678",
                &None,
            )
            .await;

        // Should hit reverse cache
        let result = service
            .reverse_lookup("0x1234567890abcdef1234567890abcdef12345678")
            .await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), Some("test.eth".to_string()));
    }
}
