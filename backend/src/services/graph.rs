//! Agent0 Graph evidence. Never invents payees or amounts.
use crate::api::error::AppError;
use serde_json::{json, Value};

pub const SEPOLIA_SUBGRAPH: &str = "6wQRC7geo9XYAhckfmfo8kbMRLeWU8KQd3XsJqFKmZLT";
pub const MAX_INDEX_AGE_SECS: i64 = 7 * 24 * 60 * 60;

pub struct GraphService {
    client: reqwest::Client,
    endpoint: Option<String>,
}

impl GraphService {
    pub fn disabled() -> Self {
        Self {
            client: reqwest::Client::new(),
            endpoint: None,
        }
    }
    pub fn from_env() -> Result<Self, AppError> {
        let key = std::env::var("GRAPH_API_KEY")
            .ok()
            .filter(|value| !value.is_empty());
        let subgraph = std::env::var("GRAPH_SUBGRAPH_ID")
            .ok()
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| SEPOLIA_SUBGRAPH.into());
        Ok(Self {
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(15))
                .build()
                .map_err(|_| AppError::InternalServerError("HTTP client unavailable".into()))?,
            endpoint: key.map(|key| {
                format!("https://gateway.thegraph.com/api/{key}/subgraphs/id/{subgraph}")
            }),
        })
    }
    pub async fn review(&self, ids: &[String]) -> Result<Value, AppError> {
        let Some(url) = &self.endpoint else {
            return Err(AppError::Unavailable(
                "Graph review is blocked until a project-owned GRAPH_API_KEY is configured on the server.".into(),
            ));
        };
        let selected: Vec<String> = ids
            .iter()
            .filter(|id| {
                id.len() < 64
                    && id
                        .chars()
                        .all(|c| c.is_ascii_alphanumeric() || c == ':' || c == '-')
            })
            .cloned()
            .collect();
        if selected.is_empty() {
            return Err(AppError::BadRequest("Provide at least one agent id".into()));
        }
        let query = r#"query PaymentEvidence($ids:[ID!]!) {
  _meta { deployment block { number hash timestamp } hasIndexingErrors }
  agents(where: { id_in: $ids }) {
    id chainId agentId owner agentWallet createdAt updatedAt totalFeedback
    registrationFile { name active mcpEndpoint a2aEndpoint supportedTrusts }
  }
}"#;
        let response = self
            .client
            .post(url)
            .json(&json!({"query":query,"variables":{"ids":selected}}))
            .send()
            .await
            .map_err(|_| AppError::Unavailable("Graph gateway unavailable".into()))?;
        if !response.status().is_success() {
            return Err(AppError::Unavailable(
                "Graph gateway rejected the request".into(),
            ));
        }
        let body: Value = response
            .json()
            .await
            .map_err(|_| AppError::Unavailable("Invalid Graph response".into()))?;
        if body.get("errors").is_some() {
            return Err(AppError::Unavailable(
                "Graph query returned errors. HTTP success is not enough.".into(),
            ));
        }
        let data = body.get("data").cloned().unwrap_or(Value::Null);
        let timestamp = data["_meta"]["block"]["timestamp"].as_i64();
        let now = chrono::Utc::now().timestamp();
        let fresh = timestamp.is_some_and(|ts| is_fresh(ts, now, MAX_INDEX_AGE_SECS))
            && data["_meta"]["hasIndexingErrors"] == false;
        let indexed_at = timestamp
            .and_then(|ts| chrono::DateTime::from_timestamp(ts, 0).map(|dt| dt.to_rfc3339()));
        let agents = data["agents"]
            .as_array()
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .map(|agent| {
                let active = agent["registrationFile"]["active"]
                    .as_bool()
                    .unwrap_or(false);
                let endpoint = agent["registrationFile"]["mcpEndpoint"]
                    .as_str()
                    .or_else(|| agent["registrationFile"]["a2aEndpoint"].as_str())
                    .unwrap_or("");
                let warning = if !fresh {
                    Some("Index is stale; do not treat this as current eligibility.".to_string())
                } else if !active {
                    Some("Registration is not active.".to_string())
                } else if endpoint.is_empty() {
                    Some("No service endpoint was registered.".to_string())
                } else if endpoint.contains("localhost") {
                    Some(
                        "Advertised endpoint is localhost, not an operational public service."
                            .to_string(),
                    )
                } else {
                    None
                };
                json!({
                    "id": agent["id"],
                    "wallet": agent["agentWallet"],
                    "active": active,
                    "total_feedback": agent["totalFeedback"],
                    "warning": warning,
                    "decision": inclusion_decision(fresh, warning.as_deref()),
                })
            })
            .collect::<Vec<_>>();
        Ok(json!({
            "fresh": fresh,
            "indexed_at": indexed_at,
            "deployment": data["_meta"]["deployment"],
            "retrieved_at": chrono::Utc::now().to_rfc3339(),
            "network": "Ethereum Sepolia",
            "note": if fresh {
                "Evidence is recent enough for manual review. Amounts still require explicit payer approval."
            } else {
                "Evidence is too old for inclusion. Do not pay from this index."
            },
            "agents": agents
        }))
    }
}

pub fn is_fresh(timestamp: i64, now: i64, max_age: i64) -> bool {
    timestamp <= now && now.saturating_sub(timestamp) <= max_age
}

/// Stale or warned evidence can never become a payment. Eligible still has no amount.
pub fn inclusion_decision(fresh: bool, warning: Option<&str>) -> &'static str {
    if !fresh {
        "exclude"
    } else if warning.is_some() {
        "manual_review"
    } else {
        "eligible"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn future_index_is_not_current_evidence() {
        assert!(!is_fresh(200, 100, 1000));
        assert!(is_fresh(100, 100, 1000));
    }

    #[test]
    fn stale_or_warned_agents_cannot_be_included() {
        assert_eq!(inclusion_decision(false, None), "exclude");
        assert_eq!(inclusion_decision(true, Some("localhost")), "manual_review");
        assert_eq!(inclusion_decision(true, None), "eligible");
    }

    #[test]
    fn march_2026_index_is_stale_in_september() {
        let indexed = 1_772_661_600; // 2026-03-04T22:00:00Z from live probe
        let now = 1_789_286_400; // 2026-09-13
        assert!(!is_fresh(indexed, now, MAX_INDEX_AGE_SECS));
        assert!(is_fresh(now - 3600, now, MAX_INDEX_AGE_SECS));
    }

    #[tokio::test]
    async fn missing_key_does_not_invent_agents() {
        let service = GraphService::disabled();
        let err = service.review(&["11155111:1073".into()]).await.unwrap_err();
        assert!(matches!(err, AppError::Unavailable(_)));
    }
}
