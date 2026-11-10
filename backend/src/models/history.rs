use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct TicketHistoryItem {
    pub id: Uuid,
    pub status: String,
    pub note: Option<String>,
    pub progress_percent: Option<i16>,
    pub changed_by: Option<Uuid>,
    pub actor_name: Option<String>,
    pub actor_role: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateStatusRequest {
    pub status: String,
    pub note: Option<String>,
    pub progress_percent: Option<i16>,
}

