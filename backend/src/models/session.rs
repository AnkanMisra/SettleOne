//! Session and payment models

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Session status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SessionStatus {
    Active,
    Pending,
    Settled,
    Cancelled,
}

/// Payment within a session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Payment {
    pub id: String,
    pub recipient: String,
    pub recipient_ens: Option<String>,
    pub amount: String,
    pub status: PaymentStatus,
    pub created_at: DateTime<Utc>,
}

/// Payment status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum PaymentStatus {
    Pending,
    Confirmed,
    Settled,
}

/// Session data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub user: String,
    pub status: SessionStatus,
    pub payments: Vec<Payment>,
    pub total_amount: String,
    pub created_at: DateTime<Utc>,
}

impl Session {
    /// Create a new session
    pub fn new(id: String, user: String) -> Self {
        Self {
            id,
            user,
            status: SessionStatus::Active,
            payments: Vec::new(),
            total_amount: "0".to_string(),
            created_at: Utc::now(),
        }
    }

    /// Add a payment to the session
    pub fn add_payment(&mut self, payment: Payment) {
        self.payments.push(payment);
        self.recalculate_total();
    }

    /// Recalculate total amount
    fn recalculate_total(&mut self) {
        // TODO: Proper big number handling
        let total: u128 = self
            .payments
            .iter()
            .filter_map(|p| p.amount.parse::<u128>().ok())
            .sum();
        self.total_amount = total.to_string();
    }
}
