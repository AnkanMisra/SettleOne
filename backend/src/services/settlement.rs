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
        *slot = Some(candidate.clone());
        if let Some(path) = &self.persist_path {
            if let Some(parent) = path.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            let _ = std::fs::write(
                path,
                serde_json::to_string_pretty(&json!({
                    "network": "arc",
                    "chainId": ARC_CHAIN_ID,
                    "address": candidate,
                    "token": ARC_USDC,
                    "timestamp": chrono::Utc::now().to_rfc3339(),
                }))?,
            );
        }
        Ok(candidate)
    }
    async fn verify_arc_usdc_contract(&self, contract: &str) -> Result<(), AppError> {
        self.check_chain().await?;
        let code = self.rpc("eth_getCode", json!([contract, "latest"])).await?;
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
        validate_receipt(session, draft, tx_hash, &receipt)
    }
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
    }
}
