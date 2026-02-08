//! SettleOne Backend
//!
//! A Rust-based backend API for session-based USDC payments with:
//! - ENS resolution
//! - Yellow SDK session management
//! - LI.FI cross-chain routing
//! - Arc chain settlement

mod api;
mod config;
mod models;
mod services;
mod utils;

use std::sync::Arc;

use axum::{
    routing::{delete, get, post},
    Router,
};
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::services::ens::EnsService;
use crate::services::session::SessionStore;

/// Shared application state
#[derive(Clone)]
pub struct AppState {
    pub session_store: Arc<SessionStore>,
    pub ens_service: Arc<EnsService>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize logging
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "settleone_backend=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load environment variables
    dotenvy::dotenv().ok();

    // Initialize shared state
    let state = AppState {
        session_store: Arc::new(SessionStore::new()),
        ens_service: Arc::new(EnsService::new()),
    };

    // Build application
    let app = create_app(state.clone());

    // Get port from environment or default
    let port = std::env::var("PORT").unwrap_or_else(|_| "3001".to_string());
    let addr = format!("0.0.0.0:{}", port);

    tracing::info!("Starting SettleOne backend on {}", addr);

    // Start server
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

/// Create the application router with all API routes
fn create_app(state: AppState) -> Router {
    // CORS configuration - allow all origins for development
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Build router with all routes
    Router::new()
        // Health check
        .route("/health", get(api::health_check))
        // ENS routes
        .route("/api/ens/resolve", get(api::ens::resolve_ens))
        .route("/api/ens/lookup", get(api::ens::lookup_address))
        // Session routes
        .route("/api/session", post(api::session::create_session))
        .route("/api/session/:id", get(api::session::get_session))
        .route("/api/session/:id/payment", post(api::session::add_payment))
        .route(
            "/api/session/:id/payment/:payment_id",
            delete(api::session::remove_payment),
        )
        .route(
            "/api/session/:id/finalize",
            post(api::session::finalize_session),
        )
        // Quote routes
        .route("/api/quote", get(api::quote::get_quote))
        // Shared state
        .with_state(state)
        // Middleware
        .layer(TraceLayer::new_for_http())
        .layer(cors)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::StatusCode;
    use axum_test::TestServer;
    use serde_json::json;

    fn create_test_state() -> AppState {
        AppState {
            session_store: Arc::new(SessionStore::new()),
            ens_service: Arc::new(EnsService::new()),
        }
    }

    fn create_test_server() -> TestServer {
        let app = create_app(create_test_state());
        TestServer::new(app).unwrap()
    }

    // ── Health Check ──────────────────────────────────

    #[tokio::test]
    async fn test_health_check() {
        let server = create_test_server();
        let response = server.get("/health").await;
        assert_eq!(response.status_code(), StatusCode::OK);

        let body: serde_json::Value = response.json();
        assert_eq!(body["status"], "ok");
        assert!(!body["version"].as_str().unwrap().is_empty());
    }

    // ── Session CRUD ──────────────────────────────────

    #[tokio::test]
    async fn test_create_session() {
        let server = create_test_server();
        let response = server
            .post("/api/session")
            .json(&json!({
                "user_address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
            }))
            .await;

        assert_eq!(response.status_code(), StatusCode::OK);
        let body: serde_json::Value = response.json();
        assert_eq!(body["status"], "active");
        assert!(!body["session_id"].as_str().unwrap().is_empty());
    }

    #[tokio::test]
    async fn test_get_session() {
        let server = create_test_server();

        // Create session first
        let create_resp = server
            .post("/api/session")
            .json(&json!({
                "user_address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
            }))
            .await;

        let session_id = create_resp.json::<serde_json::Value>()["session_id"]
            .as_str()
            .unwrap()
            .to_string();

        // Retrieve session
        let get_resp = server.get(&format!("/api/session/{}", session_id)).await;

        assert_eq!(get_resp.status_code(), StatusCode::OK);
        let body: serde_json::Value = get_resp.json();
        assert_eq!(body["session"]["id"], session_id);
        assert_eq!(body["session"]["status"], "active");
        assert_eq!(body["session"]["payments"].as_array().unwrap().len(), 0);
    }

    #[tokio::test]
    async fn test_get_session_not_found() {
        let server = create_test_server();
        let response = server.get("/api/session/nonexistent-id-12345").await;

        assert_eq!(response.status_code(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn test_add_payment() {
        let server = create_test_server();

        // Create session
        let create_resp = server
            .post("/api/session")
            .json(&json!({
                "user_address": "0xSender"
            }))
            .await;

        let session_id = create_resp.json::<serde_json::Value>()["session_id"]
            .as_str()
            .unwrap()
            .to_string();

        // Add payment
        let pay_resp = server
            .post(&format!("/api/session/{}/payment", session_id))
            .json(&json!({
                "recipient": "0xRecipient1",
                "recipient_ens": "alice.eth",
                "amount": "1000000"
            }))
            .await;

        assert_eq!(pay_resp.status_code(), StatusCode::OK);
        let body: serde_json::Value = pay_resp.json();
        assert_eq!(body["session"]["payments"].as_array().unwrap().len(), 1);
        assert_eq!(body["session"]["total_amount"], "1000000");

        // Add another payment
        let pay_resp2 = server
            .post(&format!("/api/session/{}/payment", session_id))
            .json(&json!({
                "recipient": "0xRecipient2",
                "amount": "2000000"
            }))
            .await;

        assert_eq!(pay_resp2.status_code(), StatusCode::OK);
        let body2: serde_json::Value = pay_resp2.json();
        assert_eq!(body2["session"]["payments"].as_array().unwrap().len(), 2);
        assert_eq!(body2["session"]["total_amount"], "3000000");
    }

    #[tokio::test]
    async fn test_add_payment_session_not_found() {
        let server = create_test_server();
        let response = server
            .post("/api/session/nonexistent/payment")
            .json(&json!({
                "recipient": "0xRecipient",
                "amount": "1000000"
            }))
            .await;

        assert_eq!(response.status_code(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn test_finalize_session() {
        let server = create_test_server();

        // Create session
        let create_resp = server
            .post("/api/session")
            .json(&json!({
                "user_address": "0xSender"
            }))
            .await;

        let session_id = create_resp.json::<serde_json::Value>()["session_id"]
            .as_str()
            .unwrap()
            .to_string();

        // Add payment
        server
            .post(&format!("/api/session/{}/payment", session_id))
            .json(&json!({
                "recipient": "0xRecipient",
                "amount": "5000000"
            }))
            .await;

        // Finalize
        let finalize_resp = server
            .post(&format!("/api/session/{}/finalize", session_id))
            .json(&json!({
                "tx_hash": "0xabc123def456"
            }))
            .await;

        assert_eq!(finalize_resp.status_code(), StatusCode::OK);
        let body: serde_json::Value = finalize_resp.json();
        assert_eq!(body["status"], "pending");
        assert_eq!(body["tx_hash"], "0xabc123def456");

        // Verify session state updated
        let get_resp = server.get(&format!("/api/session/{}", session_id)).await;

        let session_body: serde_json::Value = get_resp.json();
        assert_eq!(session_body["session"]["status"], "pending");
        assert_eq!(session_body["session"]["tx_hash"], "0xabc123def456");
    }

    #[tokio::test]
    async fn test_finalize_session_not_found() {
        let server = create_test_server();
        let response = server
            .post("/api/session/nonexistent/finalize")
            .json(&json!({
                "tx_hash": "0xabc"
            }))
            .await;

        assert_eq!(response.status_code(), StatusCode::NOT_FOUND);
    }

    // ── ENS Routes ────────────────────────────────────

    #[tokio::test]
    async fn test_ens_resolve_invalid_name() {
        let server = create_test_server();
        let response = server.get("/api/ens/resolve?name=invalid").await;

        assert_eq!(response.status_code(), StatusCode::OK);
        let body: serde_json::Value = response.json();
        assert!(body["error"].as_str().is_some());
        assert!(body["address"].is_null());
    }

    #[tokio::test]
    async fn test_ens_lookup_returns_response() {
        let server = create_test_server();
        let response = server
            .get("/api/ens/lookup?address=0x0000000000000000000000000000000000000000")
            .await;

        assert_eq!(response.status_code(), StatusCode::OK);
        let body: serde_json::Value = response.json();
        // Should return a valid response structure even if no name found
        assert_eq!(
            body["address"],
            "0x0000000000000000000000000000000000000000"
        );
    }

    // ── Quote Route ───────────────────────────────────

    #[tokio::test]
    async fn test_quote_returns_response() {
        let server = create_test_server();
        let response = server
            .get("/api/quote?from_chain=8453&to_chain=8453&from_token=USDC&to_token=USDC&from_amount=1000000")
            .await;

        assert_eq!(response.status_code(), StatusCode::OK);
        let body: serde_json::Value = response.json();
        // Should return a valid response structure (may have error if LI.FI is unreachable)
        assert!(body["from_amount"].as_str().is_some());
    }
}
