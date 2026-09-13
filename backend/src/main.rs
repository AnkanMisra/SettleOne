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
    pub settlement_service: Arc<services::settlement::SettlementService>,
    pub graph_service: Arc<services::graph::GraphService>,
    pub auth_origin: String,
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
        session_store: Arc::new(SessionStore::open(
            &std::env::var("DATABASE_PATH").unwrap_or_else(|_| "settleone.sqlite".into()),
        )?),
        settlement_service: Arc::new(services::settlement::SettlementService::with_persist(
            std::env::var("ARC_RPC_URL")
                .unwrap_or_else(|_| "https://rpc.testnet.arc.network".into()),
            std::env::var("ARC_SETTLEMENT_ADDRESS").ok(),
            Some(std::path::PathBuf::from(
                std::env::var("ARC_SETTLEMENT_PATH").unwrap_or_else(|_| {
                    "/tmp/settleone-arc-contract.json".into()
                }),
            )),
        )?),
        auth_origin: std::env::var("APP_ORIGIN").unwrap_or_else(|_| "http://localhost:3000".into()),
        ens_service: Arc::new(EnsService::new()),
        graph_service: Arc::new(services::graph::GraphService::from_env()?),
    };

    // Build application
    let app = create_app(state.clone());

    // Get port from environment or default
    let port = std::env::var("PORT").unwrap_or_else(|_| "3001".to_string());
    let addr = format!(
        "{}:{}",
        std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".into()),
        port
    );

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
        .route("/api/auth/challenge", post(api::auth::challenge))
        .route("/api/auth/verify", post(api::auth::verify))
        .route(
            "/api/session/:id/prepare",
            post(api::session::prepare_session),
        )
        .route("/api/session/:id/reset", post(api::session::reset_session))
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
        .route("/api/graph/review", get(api::graph::review))
        .route(
            "/api/settlement/contract",
            get(api::settlement::get_contract).post(api::settlement::configure_contract),
        )
        // Shared state
        .with_state(state)
        // Middleware
        .layer(TraceLayer::new_for_http())
        .layer(cors)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::{HeaderName, HeaderValue, StatusCode};
    use axum_test::TestServer;
    use k256::ecdsa::SigningKey;
    use serde_json::{json, Value};
    use sha3::{Digest, Keccak256};

    fn state(path: &str) -> AppState {
        AppState {
            session_store: Arc::new(SessionStore::open(path).unwrap()),
            ens_service: Arc::new(EnsService::new()),
            settlement_service: Arc::new(
                services::settlement::SettlementService::new("http://127.0.0.1:1".into(), None)
                    .unwrap(),
            ),
            graph_service: Arc::new(services::graph::GraphService::disabled()),
            auth_origin: "http://localhost:3000".into(),
        }
    }
    fn wallet() -> (SigningKey, String) {
        let key = SigningKey::from_slice(&[7u8; 32]).unwrap();
        let point = key.verifying_key().to_encoded_point(false);
        let address = format!(
            "0x{}",
            hex::encode(&Keccak256::digest(&point.as_bytes()[1..])[12..])
        );
        (key, address)
    }
    fn sign(key: &SigningKey, message: &str) -> String {
        let digest = Keccak256::new_with_prefix(
            format!("\x19Ethereum Signed Message:\n{}{message}", message.len()).as_bytes(),
        );
        let (signature, recovery) = key.sign_digest_recoverable(digest).unwrap();
        format!(
            "0x{}{:02x}",
            hex::encode(signature.to_bytes()),
            recovery.to_byte() + 27
        )
    }
    async fn authenticated(server: &TestServer) -> (String, String) {
        let (key, address) = wallet();
        let challenge: Value = server
            .post("/api/auth/challenge")
            .json(&json!({"address":address}))
            .await
            .json();
        let signature = sign(&key, challenge["message"].as_str().unwrap());
        let response = server
            .post("/api/auth/verify")
            .json(&json!({"challenge_id":challenge["challenge_id"],"signature":signature}))
            .await;
        response.assert_status_ok();
        let body: Value = response.json();
        (address, body["token"].as_str().unwrap().into())
    }
    fn header(token: &str) -> (HeaderName, HeaderValue) {
        (
            HeaderName::from_static("authorization"),
            HeaderValue::from_str(&format!("Bearer {token}")).unwrap(),
        )
    }
    #[tokio::test]
    async fn settlement_contract_starts_unconfigured() {
        let server = TestServer::new(create_app(state(":memory:"))).unwrap();
        let body: Value = server.get("/api/settlement/contract").await.json();
        assert!(body["contract"].is_null());
        server
            .post("/api/settlement/contract")
            .json(&json!({"address":"0x1111111111111111111111111111111111111111"}))
            .await
            .assert_status(StatusCode::UNAUTHORIZED);
    }
    #[tokio::test]
    async fn graph_review_without_key_is_blocked() {
        let server = TestServer::new(create_app(state(":memory:"))).unwrap();
        server
            .get("/api/graph/review?ids=11155111:1073")
            .await
            .assert_status(StatusCode::SERVICE_UNAVAILABLE);
    }
    #[tokio::test]
    async fn unauthenticated_session_creation_is_rejected() {
        let server = TestServer::new(create_app(state(":memory:"))).unwrap();
        server
            .post("/api/session")
            .json(&json!({"user_address":wallet().1,"budget":"1000000"}))
            .await
            .assert_status(StatusCode::UNAUTHORIZED);
    }
    #[tokio::test]
    async fn wallet_signature_is_single_use_and_owner_bound() {
        let store = SessionStore::open(":memory:").unwrap();
        let (key, address) = wallet();
        let (id, message) = services::auth::challenge(&store, &address, "localhost").unwrap();
        let wrong = SigningKey::from_slice(&[8u8; 32]).unwrap();
        assert!(services::auth::verify(&store, &id, &sign(&wrong, &message)).is_err());
        assert!(services::auth::verify(&store, &id, &sign(&key, &message)).is_ok());
        assert!(services::auth::verify(&store, &id, &sign(&key, &message)).is_err());
    }
    #[tokio::test]
    async fn validation_budget_ownership_and_restart() {
        let path =
            std::env::temp_dir().join(format!("settleone-test-{}.sqlite", uuid::Uuid::new_v4()));
        let server = TestServer::new(create_app(state(path.to_str().unwrap()))).unwrap();
        let (owner, token) = authenticated(&server).await;
        let (h, v) = header(&token);
        let created: Value = server
            .post("/api/session")
            .add_header(h.clone(), v.clone())
            .json(&json!({"user_address":owner,"budget":"2000000"}))
            .await
            .json();
        let id = created["session_id"].as_str().unwrap();
        for amount in ["0", "-1", "1.5", "01", "+1", "2000001"] {
            server.post(&format!("/api/session/{id}/payment")).add_header(h.clone(),v.clone()).json(&json!({"recipient":"0x1111111111111111111111111111111111111111","amount":amount})).await.assert_status(StatusCode::BAD_REQUEST);
        }
        server.post(&format!("/api/session/{id}/payment")).add_header(h.clone(),v.clone()).json(&json!({"recipient":"0x1111111111111111111111111111111111111111","amount":"1000000"})).await.assert_status_ok();
        server
            .get(&format!("/api/session/{id}"))
            .await
            .assert_status(StatusCode::UNAUTHORIZED);
        let restored = SessionStore::open(path.to_str().unwrap()).unwrap();
        assert_eq!(restored.get(id, &owner).unwrap().total_amount, "1000000");
        assert!(restored
            .get(id, "0x2222222222222222222222222222222222222222")
            .is_err());
        let _ = std::fs::remove_file(path);
    }

    #[tokio::test]
    async fn add_remove_reset_and_prepare_cover_new_session_routes() {
        let server = TestServer::new(create_app(state(":memory:"))).unwrap();
        let (owner, token) = authenticated(&server).await;
        let (h, v) = header(&token);
        let created: Value = server
            .post("/api/session")
            .add_header(h.clone(), v.clone())
            .json(&json!({"user_address":owner,"budget":"2000000"}))
            .await
            .json();
        let id = created["session_id"].as_str().unwrap();
        let added = server
            .post(&format!("/api/session/{id}/payment"))
            .add_header(h.clone(), v.clone())
            .json(&json!({"recipient":"0x1111111111111111111111111111111111111111","amount":"1000000","recipient_ens":"vendor.test.eth"}))
            .await;
        added.assert_status_ok();
        let body: Value = added.json();
        let payment_id = body["session"]["payments"][0]["id"].as_str().unwrap();
        server
            .delete(&format!("/api/session/{id}/payment/{payment_id}"))
            .add_header(h.clone(), v.clone())
            .await
            .assert_status_ok();
        server
            .post(&format!("/api/session/{id}/payment"))
            .add_header(h.clone(), v.clone())
            .json(&json!({"recipient":"0x1111111111111111111111111111111111111111","amount":"1000000"}))
            .await
            .assert_status_ok();
        server
            .post(&format!("/api/session/{id}/prepare"))
            .add_header(h.clone(), v.clone())
            .await
            .assert_status(StatusCode::SERVICE_UNAVAILABLE);
        server
            .post(&format!("/api/session/{id}/reset"))
            .add_header(h.clone(), v.clone())
            .await
            .assert_status_ok();
        server
            .post(&format!("/api/session/{id}/finalize"))
            .add_header(h.clone(), v.clone())
            .json(&json!({"tx_hash":format!("0x{}","11".repeat(32))}))
            .await
            .assert_status(StatusCode::CONFLICT);
    }

    async fn mock_rpc(tx: Value, receipt: Value) -> String {
        use axum::{routing::post, Json};
        let payload = Arc::new(tokio::sync::Mutex::new((tx, receipt)));
        let app = Router::new().route(
            "/",
            post({
                let payload = payload.clone();
                move |Json(body): Json<Value>| {
                    let payload = payload.clone();
                    async move {
                        let method = body["method"].as_str().unwrap_or_default();
                        let (tx, receipt) = payload.lock().await.clone();
                        let result = match method {
                            "eth_chainId" => json!("0x4cef52"),
                            "eth_getTransactionByHash" => tx,
                            "eth_getTransactionReceipt" => receipt,
                            _ => Value::Null,
                        };
                        Json(json!({"jsonrpc":"2.0","id":1,"result":result}))
                    }
                }
            }),
        );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });
        format!("http://{addr}/")
    }

    fn prepared_app(rpc: String) -> (AppState, String, String) {
        let store = SessionStore::open(":memory:").unwrap();
        let (key, owner) = wallet();
        let (id, message) = services::auth::challenge(&store, &owner, "localhost").unwrap();
        let (token, _) = services::auth::verify(&store, &id, &sign(&key, &message)).unwrap();
        let mut session = models::session::Session::new(
            "prepared-session".into(),
            owner.clone(),
            "2000000".into(),
        );
        session.payments.push(models::session::Payment {
            id: "pay-1".into(),
            recipient: "0x1111111111111111111111111111111111111111".into(),
            recipient_ens: None,
            amount: "1000000".into(),
            status: models::session::PaymentStatus::Pending,
            created_at: chrono::Utc::now(),
        });
        session.recalculate().unwrap();
        let mut draft = models::session::PreparedDraft {
            draft_id: format!("0x{}", "ab".repeat(32)),
            contract: "0x2222222222222222222222222222222222222222".into(),
            expires_at: 1_800_000_000,
            total_limit: session.total_amount.clone(),
            calldata: String::new(),
        };
        draft.calldata = services::settlement::calldata(&session, &draft).unwrap();
        session.prepared = Some(draft);
        session.status = models::session::SessionStatus::AwaitingApproval;
        store.create(&session).unwrap();
        (
            AppState {
                session_store: Arc::new(store),
                ens_service: Arc::new(EnsService::new()),
                settlement_service: Arc::new(
                    services::settlement::SettlementService::new(rpc, None).unwrap(),
                ),
                graph_service: Arc::new(services::graph::GraphService::disabled()),
                auth_origin: "http://localhost:3000".into(),
            },
            owner,
            token,
        )
    }

    #[tokio::test]
    async fn unknown_hash_does_not_trap_session_as_submitted() {
        let rpc = mock_rpc(Value::Null, Value::Null).await;
        let (state, _owner, token) = prepared_app(rpc);
        let store = state.session_store.clone();
        let server = TestServer::new(create_app(state)).unwrap();
        let (h, v) = header(&token);
        let response = server
            .post("/api/session/prepared-session/finalize")
            .add_header(h, v)
            .json(&json!({"tx_hash":format!("0x{}","cd".repeat(32))}))
            .await;
        response.assert_status(StatusCode::NOT_FOUND);
        let session = store.get("prepared-session", &wallet().1).unwrap();
        assert_eq!(session.status, models::session::SessionStatus::AwaitingApproval);
        assert!(session.tx_hash.is_none());
    }

    #[tokio::test]
    async fn mempool_transaction_pins_submitted_and_mismatch_does_not() {
        let (_, owner) = wallet();
        let mut session = models::session::Session::new(
            "x".into(),
            owner.clone(),
            "2000000".into(),
        );
        session.payments.push(models::session::Payment {
            id: "pay-1".into(),
            recipient: "0x1111111111111111111111111111111111111111".into(),
            recipient_ens: None,
            amount: "1000000".into(),
            status: models::session::PaymentStatus::Pending,
            created_at: chrono::Utc::now(),
        });
        session.recalculate().unwrap();
        let mut draft = models::session::PreparedDraft {
            draft_id: format!("0x{}", "ab".repeat(32)),
            contract: "0x2222222222222222222222222222222222222222".into(),
            expires_at: 1_800_000_000,
            total_limit: session.total_amount.clone(),
            calldata: String::new(),
        };
        draft.calldata = services::settlement::calldata(&session, &draft).unwrap();
        let matching = json!({
            "from": owner,
            "to": draft.contract,
            "input": draft.calldata,
            "value": "0x0",
            "chainId": "0x4cef52"
        });
        let rpc = mock_rpc(matching, Value::Null).await;
        let (state, _, token) = prepared_app(rpc);
        let store = state.session_store.clone();
        let server = TestServer::new(create_app(state)).unwrap();
        let (h, v) = header(&token);
        let response = server
            .post("/api/session/prepared-session/finalize")
            .add_header(h.clone(), v.clone())
            .json(&json!({"tx_hash":format!("0x{}","11".repeat(32))}))
            .await;
        response.assert_status_ok();
        let session = store.get("prepared-session", &owner).unwrap();
        assert_eq!(session.status, models::session::SessionStatus::Submitted);
        assert_eq!(session.tx_hash.as_deref(), Some(format!("0x{}", "11".repeat(32))).as_deref());
        server
            .post("/api/session/prepared-session/finalize")
            .add_header(h, v)
            .json(&json!({"tx_hash":format!("0x{}","22".repeat(32))}))
            .await
            .assert_status(StatusCode::CONFLICT);
    }

    #[tokio::test]
    async fn reverted_receipt_marks_failed_without_confirming_payments() {
        let (_, owner) = wallet();
        let mut session = models::session::Session::new(
            "x".into(),
            owner.clone(),
            "2000000".into(),
        );
        session.payments.push(models::session::Payment {
            id: "pay-1".into(),
            recipient: "0x1111111111111111111111111111111111111111".into(),
            recipient_ens: None,
            amount: "1000000".into(),
            status: models::session::PaymentStatus::Pending,
            created_at: chrono::Utc::now(),
        });
        session.recalculate().unwrap();
        let mut draft = models::session::PreparedDraft {
            draft_id: format!("0x{}", "ab".repeat(32)),
            contract: "0x2222222222222222222222222222222222222222".into(),
            expires_at: 1_800_000_000,
            total_limit: session.total_amount.clone(),
            calldata: String::new(),
        };
        draft.calldata = services::settlement::calldata(&session, &draft).unwrap();
        let tx_hash = format!("0x{}", "11".repeat(32));
        let tx = json!({
            "from": owner,
            "to": draft.contract,
            "input": draft.calldata,
            "value": "0x0",
            "chainId": "0x4cef52"
        });
        let receipt = json!({
            "transactionHash": tx_hash,
            "from": owner,
            "to": draft.contract,
            "blockNumber": "0x1",
            "status": "0x0",
            "logs": []
        });
        let rpc = mock_rpc(tx, receipt).await;
        let (state, _, token) = prepared_app(rpc);
        let store = state.session_store.clone();
        let server = TestServer::new(create_app(state)).unwrap();
        let (h, v) = header(&token);
        server
            .post("/api/session/prepared-session/finalize")
            .add_header(h, v)
            .json(&json!({"tx_hash":tx_hash}))
            .await
            .assert_status_ok();
        let session = store.get("prepared-session", &owner).unwrap();
        assert_eq!(session.status, models::session::SessionStatus::Failed);
        assert_eq!(session.payments[0].status, models::session::PaymentStatus::Pending);
        assert!(session.failure.is_some());
    }
}
