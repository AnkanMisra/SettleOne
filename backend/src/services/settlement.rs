//! Arc RPC verification against the immutable draft and emitted payment events.
use crate::{
    api::error::AppError,
    models::session::{address, amount, PreparedDraft, Session, ARC_CHAIN_ID, ARC_USDC},
    services::auth::hash,
};
use serde_json::{json, Value};

pub struct SettlementService {
    client: reqwest::Client,
    rpc_url: String,
    contract: std::sync::Mutex<Option<String>>,
    persist_path: Option<std::path::PathBuf>,
}
#[derive(Debug, PartialEq)]
pub enum ReceiptOutcome {
    Pending,
    Confirmed,
    Reverted,
}
impl SettlementService {
    pub fn new(rpc_url: String, contract: Option<String>) -> Result<Self, AppError> {
        Self::with_persist(rpc_url, contract, None)
    }
    pub fn with_persist(
        rpc_url: String,
        contract: Option<String>,
        persist_path: Option<std::path::PathBuf>,
    ) -> Result<Self, AppError> {
        let persisted = persist_path.as_ref().and_then(|path| {
            let body = std::fs::read_to_string(path).ok()?;
            let value: Value = serde_json::from_str(&body).ok()?;
            value.get("address")?.as_str().map(|s| s.to_string())
        });
        Ok(Self {
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(15))
                .build()
                .map_err(|_| AppError::InternalServerError("HTTP client unavailable".into()))?,
            rpc_url,
            contract: std::sync::Mutex::new(
                contract.or(persisted).map(|v| address(&v)).transpose()?,
            ),
            persist_path,
        })
    }
    pub fn current_contract(&self) -> Result<Option<String>, AppError> {
        self.contract
            .lock()
            .map(|g| g.clone())
            .map_err(|_| AppError::InternalServerError("Contract lock unavailable".into()))
    }
    async fn rpc(&self, method: &str, params: Value) -> Result<Value, AppError> {
        let response = self
            .client
            .post(&self.rpc_url)
            .json(&json!({"jsonrpc":"2.0","id":1,"method":method,"params":params}))
            .send()
            .await
            .map_err(|_| {
                AppError::Unavailable(
                    "Arc RPC unavailable; retain the transaction and retry verification".into(),
                )
            })?;
        if !response.status().is_success() {
            return Err(AppError::Unavailable("Arc RPC rejected the request".into()));
        }
        let value: Value = response
            .json()
            .await
            .map_err(|_| AppError::Unavailable("Invalid Arc RPC response".into()))?;
        if value.get("error").is_some() {
            return Err(AppError::Unavailable("Arc RPC returned an error".into()));
        }
        value
            .get("result")
            .cloned()
            .ok_or_else(|| AppError::Unavailable("Arc RPC result missing".into()))
    }
    async fn check_chain(&self) -> Result<(), AppError> {
        if self.rpc("eth_chainId", json!([])).await?.as_str() != Some("0x4cef52") {
            return Err(AppError::Unavailable("RPC is not Arc Testnet".into()));
        }
        Ok(())
    }
    pub fn owner_from_call(result: &Value) -> Result<String, AppError> {
        let hex = result.as_str().ok_or_else(|| {
            AppError::Unauthorized("Settlement owner() did not return an address".into())
        })?;
        let digits = hex.strip_prefix("0x").unwrap_or(hex);
        if digits.len() < 40 {
            return Err(AppError::Unauthorized(
                "Settlement owner() did not return an address".into(),
            ));
        }
        address(&format!("0x{}", &digits[digits.len() - 40..]))
    }
    pub async fn adopt(&self, candidate: &str, operator: &str) -> Result<String, AppError> {
        let candidate = address(candidate)?;
        let operator = address(operator)?;
        let trusted = std::env::var("SETTLEMENT_ADMIN")
            .ok()
            .and_then(|value| address(&value).ok());
        if !is_trusted_operator(trusted.as_deref(), &operator) {
            return Err(AppError::Unauthorized(
                "Only the server-configured SETTLEMENT_ADMIN may register a contract".into(),
            ));
        }
        self.verify_arc_usdc_contract(&candidate).await?;
        let owner = self
            .rpc(
                "eth_call",
                json!([{"to":candidate,"data":&hash(b"owner()")[..10]},"latest"]),
            )
            .await?;
        if Self::owner_from_call(&owner)? != operator {
            return Err(AppError::Unauthorized(
                "Only the on-chain contract owner can register this settlement address".into(),
            ));
        }
        let mut slot = self
            .contract
            .lock()
            .map_err(|_| AppError::InternalServerError("Contract lock unavailable".into()))?;
        if let Some(existing) = slot.as_ref() {
            if existing != &candidate {
                return Err(AppError::Conflict(format!(
                    "Arc settlement is already configured at {existing}"
                )));
            }
            return Ok(existing.clone());
        }
        if let Some(path) = &self.persist_path {
            if let Some(parent) = path.parent() {
                std::fs::create_dir_all(parent).map_err(|_| {
                    AppError::InternalServerError("Cannot create contract storage directory".into())
                })?;
            }
            let temporary = path.with_extension("tmp");
            std::fs::write(
                &temporary,
                serde_json::to_string_pretty(&json!({
                    "network": "arc",
                    "chainId": ARC_CHAIN_ID,
                    "address": candidate,
                    "token": ARC_USDC,
                    "timestamp": chrono::Utc::now().to_rfc3339(),
                }))?,
            )
            .map_err(|_| {
                AppError::InternalServerError("Cannot persist contract configuration".into())
            })?;
            std::fs::rename(&temporary, path).map_err(|_| {
                AppError::InternalServerError("Cannot persist contract configuration".into())
            })?;
        }
        *slot = Some(candidate.clone());
        Ok(candidate)
    }
    async fn verify_arc_usdc_contract(&self, contract: &str) -> Result<(), AppError> {
        self.check_chain().await?;
        let code = self.rpc("eth_getCode", json!([contract, "latest"])).await?;
        // Solidity 0.8.20, optimizer 200; Arc USDC immutable filled from the checked-in contract.
        let runtime = code
            .as_str()
            .and_then(|value| value.strip_prefix("0x"))
            .and_then(|value| hex::decode(value).ok())
            .ok_or_else(|| AppError::Conflict("Invalid contract bytecode".into()))?;
        if hash(&runtime) != "0x479977b286b051b818d2042202b521b309b9a3c620fae31538a833538e05e468" {
            return Err(AppError::Conflict(
                "Contract is not the approved SessionSettlement implementation".into(),
            ));
        }
        match code.as_str() {
            Some(c) if c.len() > 4 && c != "0x" && c != "0x0" => {}
            _ => return Err(AppError::Conflict("No bytecode at that Arc address".into())),
        }
        let decimals = self
            .rpc(
                "eth_call",
                json!([{"to":ARC_USDC,"data":"0x313ce567"},"latest"]),
            )
            .await?;
        if decimals
            .as_str()
            .and_then(|v| u64::from_str_radix(v.trim_start_matches("0x"), 16).ok())
            != Some(6)
        {
            return Err(AppError::Unavailable(
                "Unexpected USDC ERC-20 decimals".into(),
            ));
        }
        let token = self
            .rpc(
                "eth_call",
                json!([{"to":contract,"data":&hash(b"usdc()")[..10]},"latest"]),
            )
            .await?;
        if token.as_str().map(|v| v.to_ascii_lowercase())
            != Some(format!("0x{:0>64}", &ARC_USDC[2..]))
        {
            return Err(AppError::Unavailable(
                "Settlement contract does not use Arc USDC".into(),
            ));
        }
        Ok(())
    }
    pub async fn prepare(&self, session: &Session) -> Result<PreparedDraft, AppError> {
        let contract = self.current_contract()?.ok_or_else(|| {
            AppError::Unavailable(
                "Arc settlement contract is not configured. Deploy it first.".into(),
            )
        })?;
        self.verify_arc_usdc_contract(&contract).await?;
        let mut draft = PreparedDraft {
            draft_id: hash(uuid::Uuid::new_v4().as_bytes()),
            contract,
            expires_at: chrono::Utc::now().timestamp() as u64 + 900,
            total_limit: session.total_amount.clone(),
            calldata: String::new(),
        };
        draft.calldata = calldata(session, &draft)?;
        Ok(draft)
    }
    pub async fn verify(
        &self,
        session: &Session,
        tx_hash: &str,
    ) -> Result<ReceiptOutcome, AppError> {
        self.check_chain().await?;
        let tx = self
            .rpc("eth_getTransactionByHash", json!([tx_hash]))
            .await?;
        require_known_transaction(&tx)?;
        let draft = session
            .prepared
            .as_ref()
            .ok_or_else(|| AppError::Conflict("No prepared draft".into()))?;
        validate_transaction(session, draft, &tx)?;
        let receipt = self
            .rpc("eth_getTransactionReceipt", json!([tx_hash]))
            .await?;
        if receipt.is_null() {
            return Ok(ReceiptOutcome::Pending);
        }
        let outcome = validate_receipt(session, draft, tx_hash, &receipt)?;
        if outcome == ReceiptOutcome::Reverted {
            let data = format!(
                "{}{:0>64}{}",
                &hash(b"isDraftSettled(address,bytes32)")[..10],
                &session.user[2..],
                &draft.draft_id[2..]
            );
            let settled = self
                .rpc(
                    "eth_call",
                    json!([{"to":draft.contract,"data":data},"latest"]),
                )
                .await?;
            if settled.as_str() != Some(&format!("0x{}", "0".repeat(64))) {
                return Err(AppError::Conflict("The draft is already settled or its state is unavailable. A reverted replay is not proof of an unpaid batch; reconcile the successful transaction.".into()));
            }
        }
        Ok(outcome)
    }

    /// A signing lock can only be released once Arc proves its calldata can no longer execute.
    pub async fn can_release(&self, session: &Session) -> Result<(), AppError> {
        let draft = session
            .prepared
            .as_ref()
            .ok_or_else(|| AppError::Conflict("Prepared draft missing".into()))?;
        if chrono::Utc::now().timestamp() <= draft.expires_at as i64 {
            return Err(AppError::Conflict(
                "Signing is locked until the draft expires. Verify any retained transaction."
                    .into(),
            ));
        }
        self.check_chain().await?;
        let block = self
            .rpc("eth_getBlockByNumber", json!(["latest", false]))
            .await?;
        let timestamp = block["timestamp"]
            .as_str()
            .and_then(|s| u64::from_str_radix(s.trim_start_matches("0x"), 16).ok())
            .ok_or_else(|| AppError::Unavailable("Arc timestamp unavailable".into()))?;
        if timestamp <= draft.expires_at {
            return Err(AppError::Conflict("Signing is locked. Verify any transaction, or wait until the draft expires before resetting.".into()));
        }
        let data = format!(
            "{}{:0>64}{}",
            &hash(b"isDraftSettled(address,bytes32)")[..10],
            &session.user[2..],
            &draft.draft_id[2..]
        );
        let result = self
            .rpc(
                "eth_call",
                json!([{"to":draft.contract,"data":data},block["number"]]),
            )
            .await?;
        if result.as_str() != Some(&format!("0x{}", "0".repeat(64))) {
            return Err(AppError::Conflict("Draft settled or state unavailable. Reconcile the original transaction instead of resetting.".into()));
        }
        Ok(())
    }
}

fn is_trusted_operator(trusted: Option<&str>, operator: &str) -> bool {
    trusted.is_some_and(|trusted| trusted == operator)
}

pub fn require_known_transaction(tx: &Value) -> Result<(), AppError> {
    if tx.is_null() {
        return Err(AppError::NotFound(
            "Transaction is not on Arc. Keep any wallet hash locally and retry after it appears; an unknown hash cannot start settlement.".into(),
        ));
    }
    Ok(())
}

pub fn calldata(session: &Session, draft: &PreparedDraft) -> Result<String, AppError> {
    let mut encoded =
        hash(b"settleBatch(bytes32,(address,uint256)[],uint256,uint256)")[..10].to_string();
    encoded.push_str(
        draft
            .draft_id
            .strip_prefix("0x")
            .ok_or_else(|| AppError::BadRequest("Invalid draft identifier".into()))?,
    );
    encoded.push_str(&format!(
        "{:064x}{:064x}{:064x}{:064x}",
        128,
        amount(&draft.total_limit)?,
        draft.expires_at,
        session.payments.len()
    ));
    for payment in &session.payments {
        encoded.push_str(&format!(
            "{:0>64}{:064x}",
            &address(&payment.recipient)?[2..],
            amount(&payment.amount)?
        ));
    }
    Ok(encoded)
}
fn same(value: &Value, expected: &str) -> bool {
    value
        .as_str()
        .is_some_and(|actual| actual.eq_ignore_ascii_case(expected))
}
pub fn validate_transaction(
    session: &Session,
    draft: &PreparedDraft,
    tx: &Value,
) -> Result<(), AppError> {
    if !same(&tx["from"], &session.user)
        || !same(&tx["to"], &draft.contract)
        || !same(&tx["input"], &draft.calldata)
        || !same(&tx["value"], "0x0")
        || (tx.get("chainId").is_some() && !same(&tx["chainId"], "0x4cef52"))
    {
        return Err(AppError::Conflict("Transaction does not match the approved payer, chain, contract and exact payment calldata".into()));
    }
    Ok(())
}
pub fn validate_receipt(
    session: &Session,
    draft: &PreparedDraft,
    tx_hash: &str,
    receipt: &Value,
) -> Result<ReceiptOutcome, AppError> {
    let invalid = || AppError::Conflict("Receipt does not prove this exact payment batch".into());
    if !same(&receipt["transactionHash"], tx_hash)
        || !same(&receipt["from"], &session.user)
        || !same(&receipt["to"], &draft.contract)
        || receipt["blockNumber"].as_str().is_none()
    {
        return Err(invalid());
    }
    match receipt["status"].as_str() {
        Some("0x0") => return Ok(ReceiptOutcome::Reverted),
        Some("0x1") => {}
        _ => return Err(invalid()),
    }
    let logs = receipt["logs"].as_array().ok_or_else(invalid)?;
    let transfer_topic = hash(b"Transfer(address,address,uint256)");
    let transfers: Vec<&Value> = logs
        .iter()
        .filter(|log| same(&log["address"], ARC_USDC) && same(&log["topics"][0], &transfer_topic))
        .collect();
    if transfers.len() != session.payments.len() {
        return Err(invalid());
    }
    for (log, payment) in transfers.iter().zip(&session.payments) {
        if !same(&log["topics"][1], &format!("0x{:0>64}", &session.user[2..]))
            || !same(
                &log["topics"][2],
                &format!("0x{:0>64}", &payment.recipient[2..]),
            )
            || !same(
                &log["data"],
                &format!("0x{:064x}", amount(&payment.amount)?),
            )
            || log["removed"] == true
        {
            return Err(invalid());
        }
    }
    let payment_topic = hash(b"DraftPayment(bytes32,address,address,uint256)");
    let settled_topic = hash(b"DraftSettled(bytes32,address,uint256,uint256)");
    let payer_topic = format!("0x{:0>64}", &session.user[2..]);
    let relevant: Vec<&Value> = logs
        .iter()
        .filter(|log| same(&log["address"], &draft.contract))
        .collect();
    let payments: Vec<&Value> = relevant
        .iter()
        .copied()
        .filter(|log| same(&log["topics"][0], &payment_topic))
        .collect();
    if payments.len() != session.payments.len() {
        return Err(invalid());
    }
    for (log, payment) in payments.iter().zip(&session.payments) {
        if !same(&log["topics"][1], &draft.draft_id)
            || !same(&log["topics"][2], &payer_topic)
            || !same(
                &log["topics"][3],
                &format!("0x{:0>64}", &payment.recipient[2..]),
            )
            || !same(
                &log["data"],
                &format!("0x{:064x}", amount(&payment.amount)?),
            )
            || log["removed"] == true
        {
            return Err(invalid());
        }
    }
    let batches: Vec<&Value> = relevant
        .iter()
        .copied()
        .filter(|log| same(&log["topics"][0], &settled_topic))
        .collect();
    if batches.len() != 1 {
        return Err(invalid());
    }
    let log = batches[0];
    if !same(&log["topics"][1], &draft.draft_id)
        || !same(&log["topics"][2], &payer_topic)
        || !same(
            &log["data"],
            &format!(
                "0x{:064x}{:064x}",
                amount(&session.total_amount)?,
                session.payments.len()
            ),
        )
        || log["removed"] == true
        || session.chain_id != ARC_CHAIN_ID
    {
        return Err(invalid());
    }
    Ok(ReceiptOutcome::Confirmed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::session::{Payment, PaymentStatus, Session, SessionStatus};
    use chrono::Utc;

    #[tokio::test]
    #[ignore = "Read-only public Arc RPC verification; run explicitly when network is available"]
    async fn live_arc_recorded_batch_has_matching_usdc_transfers() {
        let mut session = Session::new(
            "recorded-arc-proof".into(),
            "0xe9a6ba0f611ef6c934624b52bd3843dfebbb98e6".into(),
            "1000000".into(),
        );
        session.payments.push(Payment {
            id: "recorded-payment".into(),
            recipient: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045".into(),
            recipient_ens: None,
            amount: "1000000".into(),
            status: PaymentStatus::Pending,
            created_at: Utc::now(),
        });
        session.recalculate().unwrap();
        let mut draft = PreparedDraft {
            draft_id: "0x4b84325729bfdf29cfb434083e615ddd48f8d6c5f0c7f04e0b64667fd8d1407d".into(),
            contract: "0x178daba1115968e073cff667d276c752b319b019".into(),
            expires_at: 1789292278,
            total_limit: "1000000".into(),
            calldata: String::new(),
        };
        draft.calldata = calldata(&session, &draft).unwrap();
        session.prepared = Some(draft.clone());
        let service = SettlementService::new(
            "https://rpc.testnet.arc.network".into(),
            Some(draft.contract.clone()),
        )
        .unwrap();
        service
            .verify_arc_usdc_contract(&draft.contract)
            .await
            .unwrap();
        assert_eq!(
            service
                .verify(
                    &session,
                    "0x126b478c6ff8332bae2597361816d999da672af1def5e29c78399b0d3b5691b1"
                )
                .await
                .unwrap(),
            ReceiptOutcome::Confirmed
        );
    }

    #[test]
    fn public_wallet_is_not_a_configuration_admin() {
        let attacker = "0x1111111111111111111111111111111111111111";
        let operator = "0x2222222222222222222222222222222222222222";
        assert!(!is_trusted_operator(None, attacker));
        assert!(!is_trusted_operator(Some(operator), attacker));
        assert!(is_trusted_operator(Some(operator), operator));
    }

    #[tokio::test]
    async fn signing_release_requires_expiry_and_unsettled_arc_state() {
        use axum::{routing::post, Json, Router};
        for (settled, expected) in [(false, true), (true, false)] {
            let app = Router::new().route(
                "/",
                post(move |Json(body): Json<Value>| async move {
                    let result = match body["method"].as_str().unwrap() {
                        "eth_chainId" => json!("0x4cef52"),
                        "eth_getBlockByNumber" => {
                            json!({"timestamp":"0x70000000","number":"0x123"})
                        }
                        "eth_call" => json!(format!("0x{:064x}", u8::from(settled))),
                        _ => Value::Null,
                    };
                    Json(json!({"jsonrpc":"2.0","id":1,"result":result}))
                }),
            );
            let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
            let url = format!("http://{}/", listener.local_addr().unwrap());
            let task = tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
            let service = SettlementService::new(url, None).unwrap();
            let (mut session, mut draft) = sample();
            draft.expires_at = 1;
            session.prepared = Some(draft);
            session.status = SessionStatus::Signing;
            assert_eq!(service.can_release(&session).await.is_ok(), expected);
            task.abort();
        }
    }

    fn sample() -> (Session, PreparedDraft) {
        let mut session = Session::new(
            "session-1".into(),
            "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa".into(),
            "2000000".into(),
        );
        session.payments.push(Payment {
            id: "pay-1".into(),
            recipient: "0x1111111111111111111111111111111111111111".into(),
            recipient_ens: None,
            amount: "1000000".into(),
            status: PaymentStatus::Pending,
            created_at: Utc::now(),
        });
        session.recalculate().unwrap();
        session.status = SessionStatus::AwaitingApproval;
        let mut draft = PreparedDraft {
            draft_id: format!("0x{}", "ab".repeat(32)),
            contract: "0x2222222222222222222222222222222222222222".into(),
            expires_at: 1_800_000_000,
            total_limit: session.total_amount.clone(),
            calldata: String::new(),
        };
        draft.calldata = calldata(&session, &draft).unwrap();
        session.prepared = Some(draft.clone());
        (session, draft)
    }

    #[test]
    fn owner_from_call_reads_the_last_twenty_bytes() {
        let padded = json!("0x000000000000000000000000e9a6ba0f611ef6c934624b52bd3843dfebbb98e6");
        assert_eq!(
            SettlementService::owner_from_call(&padded).unwrap(),
            "0xe9a6ba0f611ef6c934624b52bd3843dfebbb98e6"
        );
        assert!(SettlementService::owner_from_call(&Value::Null).is_err());
    }

    #[test]
    fn unknown_transaction_lookup_is_not_pending() {
        let err = require_known_transaction(&Value::Null).unwrap_err();
        assert!(matches!(err, AppError::NotFound(_)));
        require_known_transaction(&json!({"hash":"0x1"})).unwrap();
    }

    #[test]
    fn transaction_must_match_payer_contract_and_calldata() {
        let (session, draft) = sample();
        let tx = json!({
            "from": session.user,
            "to": draft.contract,
            "input": draft.calldata,
            "value": "0x0",
            "chainId": "0x4cef52"
        });
        validate_transaction(&session, &draft, &tx).unwrap();
        let mut bad = tx.clone();
        bad["from"] = json!("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
        assert!(validate_transaction(&session, &draft, &bad).is_err());
        bad = tx.clone();
        bad["input"] = json!("0xdead");
        assert!(validate_transaction(&session, &draft, &bad).is_err());
    }

    #[test]
    fn reverted_receipt_is_not_confirmation() {
        let (session, draft) = sample();
        let receipt = json!({
            "transactionHash": "0x".to_string() + &"11".repeat(32),
            "from": session.user,
            "to": draft.contract,
            "blockNumber": "0x1",
            "status": "0x0",
            "logs": []
        });
        assert_eq!(
            validate_receipt(
                &session,
                &draft,
                receipt["transactionHash"].as_str().unwrap(),
                &receipt
            )
            .unwrap(),
            ReceiptOutcome::Reverted
        );
    }

    #[test]
    fn confirmed_receipt_requires_exact_payment_events() {
        let (session, draft) = sample();
        let tx_hash = format!("0x{}", "11".repeat(32));
        let payment_topic = hash(b"DraftPayment(bytes32,address,address,uint256)");
        let settled_topic = hash(b"DraftSettled(bytes32,address,uint256,uint256)");
        let payer_topic = format!("0x{:0>64}", &session.user[2..]);
        let recipient_topic = format!("0x{:0>64}", &session.payments[0].recipient[2..]);
        let receipt = json!({
            "transactionHash": tx_hash,
            "from": session.user,
            "to": draft.contract,
            "blockNumber": "0x10",
            "status": "0x1",
            "logs": [{
                "address": ARC_USDC,
                "topics": [hash(b"Transfer(address,address,uint256)"),payer_topic,recipient_topic],
                "data": format!("0x{:064x}",1_000_000u128),
                "removed": false
            }, {
                "address": draft.contract,
                "topics": [payment_topic, draft.draft_id, payer_topic, recipient_topic],
                "data": format!("0x{:064x}", 1_000_000u128),
                "removed": false
            }, {
                "address": draft.contract,
                "topics": [settled_topic.clone(), draft.draft_id, format!("0x{:0>64}", &session.user[2..])],
                "data": format!("0x{:064x}{:064x}", 1_000_000u128, 1u128),
                "removed": false
            }]
        });
        assert_eq!(
            validate_receipt(&session, &draft, &tx_hash, &receipt).unwrap(),
            ReceiptOutcome::Confirmed
        );
        let mut missing = receipt.clone();
        missing["logs"] = json!([]);
        assert!(validate_receipt(&session, &draft, &tx_hash, &missing).is_err());
        for (pointer, value) in [
            (
                "/logs/0/address",
                json!("0x3333333333333333333333333333333333333333"),
            ),
            ("/logs/0/topics/1", json!(format!("0x{}", "0".repeat(64)))),
            ("/logs/0/topics/2", json!(format!("0x{}", "0".repeat(64)))),
            ("/logs/0/data", json!(format!("0x{:064x}", 999_999))),
            ("/logs/0/removed", json!(true)),
            ("/logs/1/data", json!(format!("0x{:064x}", 999_999))),
            ("/logs/2/topics/1", json!(format!("0x{}", "cd".repeat(32)))),
        ] {
            let mut changed = receipt.clone();
            *changed.pointer_mut(pointer).unwrap() = value;
            assert!(
                validate_receipt(&session, &draft, &tx_hash, &changed).is_err(),
                "accepted changed {pointer}"
            );
        }
    }

    #[test]
    fn payment_events_without_usdc_transfers_are_not_proof() {
        let (session, draft) = sample();
        let tx_hash = format!("0x{}", "11".repeat(32));
        let receipt = json!({"transactionHash":tx_hash,"from":session.user,"to":draft.contract,
        "blockNumber":"0x10","status":"0x1","logs":[
            {"address":draft.contract,"topics":[hash(b"DraftPayment(bytes32,address,address,uint256)"),draft.draft_id,format!("0x{:0>64}",&session.user[2..]),format!("0x{:0>64}",&session.payments[0].recipient[2..])],"data":format!("0x{:064x}",1_000_000)},
            {"address":draft.contract,"topics":[hash(b"DraftSettled(bytes32,address,uint256,uint256)"),draft.draft_id,format!("0x{:0>64}",&session.user[2..])],"data":format!("0x{:064x}{:064x}",1_000_000,1)}
        ]});
        assert!(validate_receipt(&session, &draft, &tx_hash, &receipt).is_err());
    }

    #[tokio::test]
    async fn counterfeit_runtime_is_rejected_even_with_correct_usdc_getter() {
        use axum::{routing::post, Json, Router};
        let app = Router::new().route(
            "/",
            post(|Json(body): Json<Value>| async move {
                let result = match body["method"].as_str().unwrap() {
                    "eth_chainId" => json!("0x4cef52"),
                    "eth_getCode" => json!("0x60006000"),
                    _ => json!(format!("0x{:0>64}", &ARC_USDC[2..])),
                };
                Json(json!({"jsonrpc":"2.0","id":1,"result":result}))
            }),
        );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}/", listener.local_addr().unwrap());
        let task = tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
        let service = SettlementService::new(url, None).unwrap();
        assert!(matches!(
            service
                .verify_arc_usdc_contract("0x1111111111111111111111111111111111111111")
                .await,
            Err(AppError::Conflict(_))
        ));
        task.abort();
    }
}
