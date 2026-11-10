use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    errors::ApiError,
    models::{
        assignment::{AssignTicketRequest, AssignmentResponse},
        feedback::{CitizenFeedback, CreateFeedbackRequest},
        history::{TicketHistoryItem, UpdateStatusRequest},
    },
    repositories::{complaint_repository::ComplaintRepository, ticket_repository::TicketRepository},
};

pub struct TicketService;

impl TicketService {
    pub async fn assign_ticket(
        pool: &PgPool,
        ticket_no: &str,
        payload: AssignTicketRequest,
        assigned_by: Uuid,
    ) -> Result<AssignmentResponse, ApiError> {
        let mut tx = pool.begin().await?;

        let res = TicketRepository::assign(
            &mut tx,
            ticket_no,
            payload.agency_id,
            payload.officer_id,
            payload.note.as_deref(),
            assigned_by,
        )
        .await?;

        tx.commit().await?;
        Ok(res)
    }

    pub async fn update_status(
        pool: &PgPool,
        ticket_no: &str,
        payload: UpdateStatusRequest,
        actor_id: Uuid,
        actor_role: &str,
    ) -> Result<String, ApiError> {
        let mut tx = pool.begin().await?;

        let new_status = TicketRepository::update_status(
            &mut tx,
            ticket_no,
            &payload,
            actor_id,
            actor_role,
        )
        .await?;

        tx.commit().await?;
        Ok(new_status)
    }

    pub async fn add_feedback(
        pool: &PgPool,
        ticket_no: &str,
        payload: CreateFeedbackRequest,
        citizen_id: Uuid,
    ) -> Result<CitizenFeedback, ApiError> {
        TicketRepository::add_feedback(pool, ticket_no, &payload, citizen_id).await
    }

    pub async fn get_history(
        pool: &PgPool,
        ticket_no: &str,
    ) -> Result<Vec<TicketHistoryItem>, ApiError> {
        let item = ComplaintRepository::find_by_ticket_no(pool, ticket_no)
            .await?
            .ok_or_else(|| ApiError::not_found(format!("Tiket {} tidak ditemukan", ticket_no)))?;

        ComplaintRepository::get_history(pool, item.id).await
    }
}

