use chrono::Utc;
use sqlx::{PgPool, Postgres, Row, Transaction};
use uuid::Uuid;

use crate::{
    errors::ApiError,
    models::complaint::{ComplaintAttachmentItem, ComplaintItem, ComplaintQueryFilter},
    models::history::TicketHistoryItem,
};

pub struct ComplaintRepository;

impl ComplaintRepository {
    pub async fn next_ticket_no(tx: &mut Transaction<'_, Postgres>) -> Result<String, ApiError> {
        let seq: i64 = sqlx::query_scalar("SELECT nextval('complaint_ticket_seq')")
            .fetch_one(&mut **tx)
            .await?;
        Ok(format!("BL-{}-{:06}", Utc::now().format("%Y"), seq))
    }

    pub async fn create(
        tx: &mut Transaction<'_, Postgres>,
        ticket_no: &str,
        reporter_id: Uuid,
        category_id: Option<Uuid>,
        title: &str,
        description: &str,
        address_text: Option<&str>,
        latitude: f64,
        longitude: f64,
        priority: &str,
        visibility: &str,
    ) -> Result<Uuid, ApiError> {
        // Jika category_id diberikan, ambil default_agency_id dari master kategori jika ada
        let default_agency: Option<Uuid> = if let Some(cat_id) = category_id {
            sqlx::query_scalar("SELECT default_agency_id FROM complaint_categories WHERE id = $1")
                .bind(cat_id)
                .fetch_optional(&mut **tx)
                .await?
        } else {
            None
        };

        let row = sqlx::query(
            r#"INSERT INTO complaints
               (ticket_no, reporter_id, category_id, title, description, address_text,
                location, priority, visibility, current_status, assigned_agency_id)
               VALUES ($1, $2, $3, $4, $5, $6,
                       ST_SetSRID(ST_MakePoint($7, $8), 4326)::geography,
                       $9::complaint_priority, $10::complaint_visibility, 'S01', $11)
               RETURNING id"#,
        )
        .bind(ticket_no)
        .bind(reporter_id)
        .bind(category_id)
        .bind(title)
        .bind(description)
        .bind(address_text)
        .bind(longitude) // $7 = longitude
        .bind(latitude)  // $8 = latitude
        .bind(priority)
        .bind(visibility)
        .bind(default_agency)
        .fetch_one(&mut **tx)
        .await?;

        let complaint_id: Uuid = row.get("id");
        Ok(complaint_id)
    }

    pub async fn find_by_ticket_no(
        pool: &PgPool,
        ticket_no: &str,
    ) -> Result<Option<ComplaintItem>, ApiError> {
        let query = r#"
            SELECT c.id, c.ticket_no, c.title, c.description, c.address_text,
                   ST_Y(c.location::geometry) AS latitude,
                   ST_X(c.location::geometry) AS longitude,
                   c.priority::text AS priority,
                   c.visibility::text AS visibility,
                   c.current_status::text AS current_status,
                   c.category_id, cat.name AS category_name,
                   c.assigned_agency_id, a.name AS agency_name,
                   c.assigned_officer_id, off.full_name AS officer_name,
                   c.reporter_id, u.full_name AS reporter_name,
                   c.submitted_at, c.updated_at, c.resolved_at
            FROM complaints c
            LEFT JOIN complaint_categories cat ON c.category_id = cat.id
            LEFT JOIN agencies a ON c.assigned_agency_id = a.id
            LEFT JOIN users off ON c.assigned_officer_id = off.id
            LEFT JOIN users u ON c.reporter_id = u.id
            WHERE c.ticket_no = $1
        "#;

        let row = sqlx::query(query)
            .bind(ticket_no)
            .fetch_optional(pool)
            .await?;

        Ok(row.map(Self::map_row_to_item))
    }

    pub async fn find_all(
        pool: &PgPool,
        filter: &ComplaintQueryFilter,
    ) -> Result<Vec<ComplaintItem>, ApiError> {
        let page = filter.page.unwrap_or(1).max(1);
        let limit = filter.limit.unwrap_or(20).clamp(1, 100);
        let offset = (page - 1) * limit;

        let rows = sqlx::query(
            r#"SELECT c.id, c.ticket_no, c.title, c.description, c.address_text,
                      ST_Y(c.location::geometry) AS latitude,
                      ST_X(c.location::geometry) AS longitude,
                      c.priority::text AS priority,
                      c.visibility::text AS visibility,
                      c.current_status::text AS current_status,
                      c.category_id, cat.name AS category_name,
                      c.assigned_agency_id, a.name AS agency_name,
                      c.assigned_officer_id, off.full_name AS officer_name,
                      c.reporter_id, u.full_name AS reporter_name,
                      c.submitted_at, c.updated_at, c.resolved_at
               FROM complaints c
               LEFT JOIN complaint_categories cat ON c.category_id = cat.id
               LEFT JOIN agencies a ON c.assigned_agency_id = a.id
               LEFT JOIN users off ON c.assigned_officer_id = off.id
               LEFT JOIN users u ON c.reporter_id = u.id
               WHERE ($1::text IS NULL OR c.current_status::text = $1)
                 AND ($2::uuid IS NULL OR c.category_id = $2)
                 AND ($3::uuid IS NULL OR c.assigned_agency_id = $3)
                 AND ($4::text IS NULL OR c.priority::text = $4)
                 AND ($5::text IS NULL OR c.title ILIKE '%' || $5 || '%' OR c.ticket_no ILIKE '%' || $5 || '%')
               ORDER BY c.submitted_at DESC
               LIMIT $6 OFFSET $7"#,
        )
        .bind(&filter.status)
        .bind(filter.category_id)
        .bind(filter.agency_id)
        .bind(&filter.priority)
        .bind(&filter.search)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        Ok(rows.into_iter().map(Self::map_row_to_item).collect())
    }

    pub async fn find_mine(pool: &PgPool, user_id: Uuid) -> Result<Vec<ComplaintItem>, ApiError> {
        let rows = sqlx::query(
            r#"SELECT c.id, c.ticket_no, c.title, c.description, c.address_text,
                      ST_Y(c.location::geometry) AS latitude,
                      ST_X(c.location::geometry) AS longitude,
                      c.priority::text AS priority,
                      c.visibility::text AS visibility,
                      c.current_status::text AS current_status,
                      c.category_id, cat.name AS category_name,
                      c.assigned_agency_id, a.name AS agency_name,
                      c.assigned_officer_id, off.full_name AS officer_name,
                      c.reporter_id, u.full_name AS reporter_name,
                      c.submitted_at, c.updated_at, c.resolved_at
               FROM complaints c
               LEFT JOIN complaint_categories cat ON c.category_id = cat.id
               LEFT JOIN agencies a ON c.assigned_agency_id = a.id
               LEFT JOIN users off ON c.assigned_officer_id = off.id
               LEFT JOIN users u ON c.reporter_id = u.id
               WHERE c.reporter_id = $1
               ORDER BY c.submitted_at DESC"#,
        )
        .bind(user_id)
        .fetch_all(pool)
        .await?;

        Ok(rows.into_iter().map(Self::map_row_to_item).collect())
    }

    pub async fn find_officer_tasks(
        pool: &PgPool,
        officer_id: Uuid,
    ) -> Result<Vec<ComplaintItem>, ApiError> {
        let rows = sqlx::query(
            r#"SELECT c.id, c.ticket_no, c.title, c.description, c.address_text,
                      ST_Y(c.location::geometry) AS latitude,
                      ST_X(c.location::geometry) AS longitude,
                      c.priority::text AS priority,
                      c.visibility::text AS visibility,
                      c.current_status::text AS current_status,
                      c.category_id, cat.name AS category_name,
                      c.assigned_agency_id, a.name AS agency_name,
                      c.assigned_officer_id, off.full_name AS officer_name,
                      c.reporter_id, u.full_name AS reporter_name,
                      c.submitted_at, c.updated_at, c.resolved_at
               FROM complaints c
               LEFT JOIN complaint_categories cat ON c.category_id = cat.id
               LEFT JOIN agencies a ON c.assigned_agency_id = a.id
               LEFT JOIN users off ON c.assigned_officer_id = off.id
               LEFT JOIN users u ON c.reporter_id = u.id
               WHERE c.assigned_officer_id = $1
               ORDER BY
                 CASE c.priority
                   WHEN 'urgent' THEN 1
                   WHEN 'high' THEN 2
                   WHEN 'medium' THEN 3
                   ELSE 4
                 END,
                 c.submitted_at DESC"#,
        )
        .bind(officer_id)
        .fetch_all(pool)
        .await?;

        Ok(rows.into_iter().map(Self::map_row_to_item).collect())
    }

    pub async fn get_attachments(
        pool: &PgPool,
        complaint_id: Uuid,
    ) -> Result<Vec<ComplaintAttachmentItem>, ApiError> {
        let rows = sqlx::query(
            r#"SELECT id, object_key, original_filename, mime_type, file_size_bytes,
                      evidence_type, created_at
               FROM complaint_attachments
               WHERE complaint_id = $1
               ORDER BY created_at ASC"#,
        )
        .bind(complaint_id)
        .fetch_all(pool)
        .await?;

        let items = rows
            .into_iter()
            .map(|r| ComplaintAttachmentItem {
                id: r.get("id"),
                object_key: r.get("object_key"),
                original_filename: r.get("original_filename"),
                mime_type: r.get("mime_type"),
                file_size_bytes: r.get("file_size_bytes"),
                evidence_type: r.get("evidence_type"),
                created_at: r.get("created_at"),
            })
            .collect();

        Ok(items)
    }

    pub async fn get_history(
        pool: &PgPool,
        complaint_id: Uuid,
    ) -> Result<Vec<TicketHistoryItem>, ApiError> {
        let rows = sqlx::query(
            r#"SELECT h.id, h.status::text AS status, h.note, h.progress_percent,
                      h.changed_by, u.full_name AS actor_name, u.role::text AS actor_role,
                      h.created_at
               FROM ticket_status_history h
               LEFT JOIN users u ON h.changed_by = u.id
               WHERE h.complaint_id = $1
               ORDER BY h.created_at ASC"#,
        )
        .bind(complaint_id)
        .fetch_all(pool)
        .await?;

        let items = rows
            .into_iter()
            .map(|r| TicketHistoryItem {
                id: r.get("id"),
                status: r.get("status"),
                note: r.get("note"),
                progress_percent: r.get("progress_percent"),
                changed_by: r.get("changed_by"),
                actor_name: r.get("actor_name"),
                actor_role: r.get("actor_role"),
                created_at: r.get("created_at"),
            })
            .collect();

        Ok(items)
    }

    fn map_row_to_item(r: sqlx::postgres::PgRow) -> ComplaintItem {
        ComplaintItem {
            id: r.get("id"),
            ticket_no: r.get("ticket_no"),
            title: r.get("title"),
            description: r.get("description"),
            address_text: r.get("address_text"),
            latitude: r.get("latitude"),
            longitude: r.get("longitude"),
            priority: r.get("priority"),
            visibility: r.get("visibility"),
            current_status: r.get("current_status"),
            category_id: r.get("category_id"),
            category_name: r.get("category_name"),
            assigned_agency_id: r.get("assigned_agency_id"),
            agency_name: r.get("agency_name"),
            assigned_officer_id: r.get("assigned_officer_id"),
            officer_name: r.get("officer_name"),
            reporter_id: r.get("reporter_id"),
            reporter_name: r.get("reporter_name"),
            submitted_at: r.get("submitted_at"),
            updated_at: r.get("updated_at"),
            resolved_at: r.get("resolved_at"),
        }
    }
}

