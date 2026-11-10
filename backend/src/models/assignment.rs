use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct AssignTicketRequest {
    pub agency_id: Uuid,
    pub officer_id: Option<Uuid>,
    pub note: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AssignmentResponse {
    pub success: bool,
    pub ticket_no: String,
    pub assigned_agency_id: Uuid,
    pub assigned_officer_id: Option<Uuid>,
    pub status: String,
}

