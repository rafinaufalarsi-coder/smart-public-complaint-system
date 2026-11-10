use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ComplaintCategory {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub default_agency_id: Option<Uuid>,
    pub is_active: bool,
}

