//! Single-instance SQLite store; edits and auth nonce consumption are atomic.
use crate::{api::error::AppError, models::session::Session};
use rusqlite::{params, Connection, OptionalExtension};
use std::sync::Mutex;

pub struct SessionStore {
    connection: Mutex<Connection>,
}
impl SessionStore {
    pub fn open(path: &str) -> Result<Self, AppError> {
        let connection = Connection::open(path)?;
        connection.busy_timeout(std::time::Duration::from_secs(5))?;
        connection.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
            CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, owner TEXT NOT NULL, body TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS challenges (id TEXT PRIMARY KEY, owner TEXT NOT NULL, message TEXT NOT NULL, expires INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS auth_tokens (hash TEXT PRIMARY KEY, owner TEXT NOT NULL, expires INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS transactions (hash TEXT PRIMARY KEY, session_id TEXT NOT NULL);")?;
        Ok(Self {
            connection: Mutex::new(connection),
        })
    }
    pub fn connection(&self) -> Result<std::sync::MutexGuard<'_, Connection>, AppError> {
        self.connection
            .lock()
            .map_err(|_| AppError::InternalServerError("Store lock unavailable".into()))
    }
    pub fn create(&self, session: &Session) -> Result<(), AppError> {
        self.connection()?.execute(
            "INSERT INTO sessions VALUES (?1,?2,?3)",
            params![session.id, session.user, serde_json::to_string(session)?],
        )?;
        Ok(())
    }
    pub fn get(&self, id: &str, owner: &str) -> Result<Session, AppError> {
        let body: Option<String> = self
            .connection()?
            .query_row(
                "SELECT body FROM sessions WHERE id=?1 AND owner=?2",
                params![id, owner],
                |r| r.get(0),
            )
            .optional()?;
        match body {
            Some(body) => Ok(serde_json::from_str(&body)?),
            None => Err(AppError::NotFound(
                "Session not found for this wallet".into(),
            )),
        }
    }
    pub fn edit(
        &self,
        id: &str,
        owner: &str,
        edit: impl FnOnce(&mut Session) -> Result<(), AppError>,
    ) -> Result<Session, AppError> {
        let mut connection = self.connection()?;
        let transaction = connection.transaction()?;
        let body: Option<String> = transaction
            .query_row(
                "SELECT body FROM sessions WHERE id=?1 AND owner=?2",
                params![id, owner],
                |r| r.get(0),
            )
            .optional()?;
        let mut session: Session = serde_json::from_str(
            &body.ok_or_else(|| AppError::NotFound("Session not found for this wallet".into()))?,
        )?;
        edit(&mut session)?;
        if let Some(hash) = &session.tx_hash {
            let existing: Option<String> = transaction
                .query_row(
                    "SELECT session_id FROM transactions WHERE hash=?1",
                    [hash],
                    |r| r.get(0),
                )
                .optional()?;
            if existing.as_deref().is_some_and(|existing| existing != id) {
                return Err(AppError::Conflict(
                    "Transaction already belongs to another session".into(),
                ));
            }
            transaction.execute(
                "INSERT OR IGNORE INTO transactions VALUES (?1,?2)",
                params![hash, id],
            )?;
        }
        transaction.execute(
            "UPDATE sessions SET body=?1 WHERE id=?2",
            params![serde_json::to_string(&session)?, id],
        )?;
        transaction.commit()?;
        Ok(session)
    }
}
