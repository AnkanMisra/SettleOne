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
    routing::{get, post},
    Router,
};
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::services::session::SessionStore;

/// Shared application state
#[derive(Clone)]
pub struct AppState {
    pub session_store: Arc<SessionStore>,
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

    fn create_test_state() -> AppState {
        AppState {
            session_store: Arc::new(SessionStore::new()),
        }
    }

    #[tokio::test]
    async fn test_health_check() {
        let app = create_app(create_test_state());
        let server = TestServer::new(app).unwrap();

        let response = server.get("/health").await;
        assert_eq!(response.status_code(), StatusCode::OK);
    }
}
