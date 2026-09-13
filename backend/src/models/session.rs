//! Persisted payment drafts. All amounts use ERC-20 base units.
use crate::api::error::AppError;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

pub const ARC_CHAIN_ID: u64 = 5_042_002;
pub const ARC_USDC: &str = "0x3600000000000000000000000000000000000000";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SessionStatus {
    Draft,
    AwaitingApproval,
    Submitted,
    Confirmed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum PaymentStatus {
    Pending,
    Confirmed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Payment {
    pub id: String,
    pub recipient: String,
    pub recipient_ens: Option<String>,
    pub amount: String,
    pub status: PaymentStatus,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreparedDraft {
    pub draft_id: String,
    pub contract: String,
    pub expires_at: u64,
    pub total_limit: String,
    pub calldata: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub user: String,
    pub status: SessionStatus,
    pub chain_id: u64,
    pub token: String,
    pub token_decimals: u8,
    pub payments: Vec<Payment>,
    pub total_amount: String,
    pub budget: String,
    pub prepared: Option<PreparedDraft>,
    pub tx_hash: Option<String>,
    pub failure: Option<String>,
    pub created_at: DateTime<Utc>,
}

pub fn address(value: &str) -> Result<String, AppError> {
    if value.len() != 42
        || !value.starts_with("0x")
        || !value[2..].bytes().all(|c| c.is_ascii_hexdigit())
        || value[2..].bytes().all(|c| c == b'0')
    {
        return Err(AppError::BadRequest(
            "A nonzero 20-byte address is required".into(),
        ));
    }
    Ok(value.to_ascii_lowercase())
}

pub fn amount(value: &str) -> Result<u128, AppError> {
    if value.is_empty() || !value.bytes().all(|c| c.is_ascii_digit()) || value.starts_with('0') {
        return Err(AppError::BadRequest(
            "Amount must be a positive canonical integer in token base units".into(),
        ));
    }
    value
        .parse::<u128>()
        .map_err(|_| AppError::BadRequest("Amount exceeds supported range".into()))
}

impl Session {
    pub fn new(id: String, user: String, budget: String) -> Self {
        Self {
            id,
            user,
            budget,
            status: SessionStatus::Draft,
            chain_id: ARC_CHAIN_ID,
            token: ARC_USDC.into(),
            token_decimals: 6,
            payments: vec![],
            total_amount: "0".into(),
            prepared: None,
            tx_hash: None,
            failure: None,
            created_at: Utc::now(),
        }
    }
    pub fn invalidate_approval(&mut self) -> Result<(), AppError> {
        if matches!(
            self.status,
            SessionStatus::Submitted | SessionStatus::Confirmed
        ) {
            return Err(AppError::Conflict(
                "Submitted or confirmed payments cannot be edited".into(),
            ));
        }
        self.status = SessionStatus::Draft;
        self.prepared = None;
        self.tx_hash = None;
        self.failure = None;
        Ok(())
    }
    pub fn recalculate(&mut self) -> Result<(), AppError> {
        let total = self.payments.iter().try_fold(0u128, |sum, p| {
            sum.checked_add(amount(&p.amount)?)
                .ok_or_else(|| AppError::BadRequest("Total overflow".into()))
        })?;
        if total > amount(&self.budget)? {
            return Err(AppError::BadRequest(
                "Payments exceed the approved budget".into(),
            ));
        }
        self.total_amount = total.to_string();
        Ok(())
    }
}
