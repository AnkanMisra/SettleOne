//! Session management service

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::models::session::{Payment, Session, SessionStatus};

/// Session store (in-memory for hackathon)
#[allow(dead_code)]
pub struct SessionStore {
    sessions: Arc<RwLock<HashMap<String, Session>>>,
}

#[allow(dead_code)]
impl SessionStore {
    /// Create a new session store
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Create a new session
    pub async fn create(&self, id: String, user: String) -> Session {
        let session = Session::new(id.clone(), user);
        let mut sessions = self.sessions.write().await;
        sessions.insert(id, session.clone());
        session
    }

    /// Get a session by ID
    pub async fn get(&self, id: &str) -> Option<Session> {
        let sessions = self.sessions.read().await;
        sessions.get(id).cloned()
    }

    /// Add payment to session
    pub async fn add_payment(&self, session_id: &str, payment: Payment) -> Option<Session> {
        let mut sessions = self.sessions.write().await;
        if let Some(session) = sessions.get_mut(session_id) {
            session.add_payment(payment);
            return Some(session.clone());
        }
        None
    }

    /// Update session status
    pub async fn update_status(&self, session_id: &str, status: SessionStatus) -> Option<Session> {
        let mut sessions = self.sessions.write().await;
        if let Some(session) = sessions.get_mut(session_id) {
            session.status = status;
            return Some(session.clone());
        }
        None
    }
}

impl Default for SessionStore {
    fn default() -> Self {
        Self::new()
    }
}

/// Session service
#[allow(dead_code)]
pub struct SessionService {
    store: SessionStore,
}

#[allow(dead_code)]
impl SessionService {
    /// Create a new session service
    pub fn new() -> Self {
        Self {
            store: SessionStore::new(),
        }
    }

    /// Create session
    pub async fn create_session(&self, user: String) -> Session {
        let id = uuid::Uuid::new_v4().to_string();
        self.store.create(id, user).await
    }

    /// Get session
    pub async fn get_session(&self, id: &str) -> Option<Session> {
        self.store.get(id).await
    }
}

impl Default for SessionService {
    fn default() -> Self {
        Self::new()
    }
}
