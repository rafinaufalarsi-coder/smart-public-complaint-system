use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct CreateFeedbackRequest {
    pub rating: i16,
    pub comment: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CitizenFeedback {
    pub id: Uuid,
    pub complaint_id: Uuid,
    pub citizen_id: Uuid,
    pub rating: i16,
    pub comment: Option<String>,
    pub created_at: DateTime<Utc>,
}

