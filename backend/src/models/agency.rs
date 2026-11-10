use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Agency {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
}

