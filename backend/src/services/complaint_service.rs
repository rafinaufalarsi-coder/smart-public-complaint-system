use sqlx::PgPool;
use uuid::Uuid;
use validator::Validate;

use crate::{
    errors::ApiError,
    models::complaint::{ComplaintDetail, ComplaintItem, ComplaintQueryFilter, CreateComplaintRequest},
    repositories::complaint_repository::ComplaintRepository,
};

pub struct ComplaintService;

impl ComplaintService {
    pub async fn create_complaint(
        pool: &PgPool,
        payload: CreateComplaintRequest,
        reporter_id: Uuid,
    ) -> Result<ComplaintItem, ApiError> {
        payload.validate()?;

        if !(-90.0..=90.0).contains(&payload.latitude)
            || !(-180.0..=180.0).contains(&payload.longitude)
        {
            return Err(ApiError::bad_request("Koordinat lintang atau bujur di luar batas valid"));
        }

        let priority = payload.priority.as_deref().unwrap_or("medium");
        let visibility = payload.visibility.as_deref().unwrap_or("public");

        let mut tx = pool.begin().await?;

        let ticket_no = ComplaintRepository::next_ticket_no(&mut tx).await?;

        let complaint_id = ComplaintRepository::create(
            &mut tx,
            &ticket_no,
            reporter_id,
            payload.category_id,
            &payload.title,
            &payload.description,
            payload.address_text.as_deref(),
            payload.latitude,
            payload.longitude,
            priority,
            visibility,
        )
        .await?;

        // Rekam status awal S01
        sqlx::query(
            "INSERT INTO ticket_status_history(complaint_id, status, note, changed_by) VALUES ($1, 'S01', 'Laporan berhasil diajukan ke sistem.', $2)"
        )
        .bind(complaint_id)
        .bind(reporter_id)
        .execute(&mut *tx)
        .await?;

        // Rekam audit log
        sqlx::query(
            "INSERT INTO audit_logs(actor_id, action, entity_type, entity_id, metadata) VALUES ($1, 'complaint.submitted', 'complaint', $2, jsonb_build_object('ticket_no', $3))"
        )
        .bind(reporter_id)
        .bind(complaint_id)
        .bind(&ticket_no)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        let item = ComplaintRepository::find_by_ticket_no(pool, &ticket_no)
            .await?
            .ok_or_else(|| ApiError::internal("Gagal memuat tiket yang baru dibuat"))?;

        Ok(item)
    }

    pub async fn get_detail(pool: &PgPool, ticket_no: &str) -> Result<ComplaintDetail, ApiError> {
        let item = ComplaintRepository::find_by_ticket_no(pool, ticket_no)
            .await?
            .ok_or_else(|| ApiError::not_found(format!("Tiket {} tidak ditemukan", ticket_no)))?;

        let attachments = ComplaintRepository::get_attachments(pool, item.id).await?;
        let history = ComplaintRepository::get_history(pool, item.id).await?;

        Ok(ComplaintDetail {
            item,
            attachments,
            history,
        })
    }

    pub async fn list_complaints(
        pool: &PgPool,
        filter: ComplaintQueryFilter,
    ) -> Result<Vec<ComplaintItem>, ApiError> {
        ComplaintRepository::find_all(pool, &filter).await
    }

    pub async fn list_my_complaints(
        pool: &PgPool,
        user_id: Uuid,
    ) -> Result<Vec<ComplaintItem>, ApiError> {
        ComplaintRepository::find_mine(pool, user_id).await
    }

    pub async fn list_officer_tasks(
        pool: &PgPool,
        officer_id: Uuid,
    ) -> Result<Vec<ComplaintItem>, ApiError> {
        ComplaintRepository::find_officer_tasks(pool, officer_id).await
    }
}

