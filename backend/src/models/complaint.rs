use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "complaint_priority", rename_all = "lowercase")]
pub enum ComplaintPriority {
    Low,
    Medium,
    High,
    Urgent,
}

impl std::fmt::Display for ComplaintPriority {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ComplaintPriority::Low => write!(f, "low"),
            ComplaintPriority::Medium => write!(f, "medium"),
            ComplaintPriority::High => write!(f, "high"),
            ComplaintPriority::Urgent => write!(f, "urgent"),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "complaint_visibility", rename_all = "lowercase")]
pub enum ComplaintVisibility {
    Public,
    Private,
    Anonymous,
}

impl std::fmt::Display for ComplaintVisibility {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ComplaintVisibility::Public => write!(f, "public"),
            ComplaintVisibility::Private => write!(f, "private"),
            ComplaintVisibility::Anonymous => write!(f, "anonymous"),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "ticket_status")]
pub enum TicketStatus {
    S01,
    S02,
    S03,
    S04,
    S05,
    S06,
    S07,
    S08,
    S09,
    S10,
}

impl std::fmt::Display for TicketStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}", self)
    }
}

impl std::str::FromStr for TicketStatus {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_uppercase().as_str() {
            "S01" => Ok(TicketStatus::S01),
            "S02" => Ok(TicketStatus::S02),
            "S03" => Ok(TicketStatus::S03),
            "S04" => Ok(TicketStatus::S04),
            "S05" => Ok(TicketStatus::S05),
            "S06" => Ok(TicketStatus::S06),
            "S07" => Ok(TicketStatus::S07),
            "S08" => Ok(TicketStatus::S08),
            "S09" => Ok(TicketStatus::S09),
            "S10" => Ok(TicketStatus::S10),
            _ => Err(format!("Status {} tidak valid", s)),
        }
    }
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateComplaintRequest {
    #[validate(length(min = 5, max = 180, message = "Judul antara 5 hingga 180 karakter"))]
    pub title: String,
    #[validate(length(min = 10, max = 5000, message = "Deskripsi antara 10 hingga 5000 karakter"))]
    pub description: String,
    pub category_id: Option<Uuid>,
    pub address_text: Option<String>,
    pub latitude: f64,
    pub longitude: f64,
    pub priority: Option<String>,
    pub visibility: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ComplaintQueryFilter {
    pub page: Option<i64>,
    pub limit: Option<i64>,
    pub status: Option<String>,
    pub category_id: Option<Uuid>,
    pub agency_id: Option<Uuid>,
    pub priority: Option<String>,
    pub search: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ComplaintItem {
    pub id: Uuid,
    pub ticket_no: String,
    pub title: String,
    pub description: String,
    pub address_text: Option<String>,
    pub latitude: f64,
    pub longitude: f64,
    pub priority: String,
    pub visibility: String,
    pub current_status: String,
    pub category_id: Option<Uuid>,
    pub category_name: Option<String>,
    pub assigned_agency_id: Option<Uuid>,
    pub agency_name: Option<String>,
    pub assigned_officer_id: Option<Uuid>,
    pub officer_name: Option<String>,
    pub reporter_id: Option<Uuid>,
    pub reporter_name: Option<String>,
    pub submitted_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub resolved_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ComplaintAttachmentItem {
    pub id: Uuid,
    pub object_key: String,
    pub original_filename: String,
    pub mime_type: String,
    pub file_size_bytes: i64,
    pub evidence_type: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ComplaintDetail {
    #[serde(flatten)]
    pub item: ComplaintItem,
    pub attachments: Vec<ComplaintAttachmentItem>,
    pub history: Vec<crate::models::history::TicketHistoryItem>,
}

