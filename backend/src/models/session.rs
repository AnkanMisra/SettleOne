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

/// Payment status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum PaymentStatus {
    Pending,
    Confirmed,
    Settled,
}

/// Payment model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Payment {
    pub id: String,
    pub recipient: String,
    pub recipient_ens: Option<String>,
    pub amount: String,
    pub status: PaymentStatus,
    pub created_at: DateTime<Utc>,
}

/// Session model
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
    pub fn add_payment(&mut self, payment: Payment) -> Result<(), String> {
        self.payments.push(payment);
        if let Err(e) = self.recalculate_total() {
            // Rollback payment addition if total calculation fails
            self.payments.pop();
            return Err(e);
        }
        Ok(())
    }

    /// Recalculate total amount
    fn recalculate_total(&mut self) -> Result<(), String> {
        // Simple string addition for now - in production use bigdecimal
        let mut total: u128 = 0;
        for payment in &self.payments {
            match payment.amount.parse::<u128>() {
                Ok(amount) => {
                    total = total
                        .checked_add(amount)
                        .ok_or_else(|| "Total amount overflow".to_string())?;
                }
                Err(_) => {
                    return Err(format!(
                        "Failed to parse payment amount: {}",
                        payment.amount
                    ));
                }
            }
        }
        self.total_amount = total.to_string();
        Ok(())
    }
}
