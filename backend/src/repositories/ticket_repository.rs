use sqlx::{PgPool, Postgres, Row, Transaction};
use uuid::Uuid;

use crate::{
    errors::ApiError,
    models::{
        assignment::AssignmentResponse,
        feedback::{CitizenFeedback, CreateFeedbackRequest},
        history::UpdateStatusRequest,
    },
};

pub struct TicketRepository;

impl TicketRepository {
    pub async fn assign(
        tx: &mut Transaction<'_, Postgres>,
        ticket_no: &str,
        agency_id: Uuid,
        officer_id: Option<Uuid>,
        note: Option<&str>,
        assigned_by: Uuid,
    ) -> Result<AssignmentResponse, ApiError> {
        let complaint = sqlx::query("SELECT id, current_status::text AS status FROM complaints WHERE ticket_no = $1 FOR UPDATE")
            .bind(ticket_no)
            .fetch_optional(&mut **tx)
            .await?
            .ok_or_else(|| ApiError::not_found("Tiket pengaduan tidak ditemukan"))?;

        let complaint_id: Uuid = complaint.get("id");

        // SECURITY [FIX]: Validasi bahwa petugas yang ditugaskan berasal dari dinas yang sama
        // dengan dinas yang di-assign ke tiket (mencegah cross-agency assignment)
        if let Some(oid) = officer_id {
            let officer_check = sqlx::query(
                "SELECT agency_id, role FROM users WHERE id = $1 AND is_active = TRUE"
            )
            .bind(oid)
            .fetch_optional(&mut **tx)
            .await?
            .ok_or_else(|| ApiError::not_found("Petugas tidak ditemukan atau tidak aktif"))?;

            let officer_agency: Option<Uuid> = officer_check.get("agency_id");
            let officer_role: String = officer_check.get("role");

            if officer_role != "officer" {
                return Err(ApiError::bad_request(
                    "Pengguna yang dipilih bukan petugas lapangan (role harus 'officer')"
                ));
            }

            if officer_agency != Some(agency_id) {
                return Err(ApiError::bad_request(
                    "Petugas tidak berasal dari dinas yang dipilih. \
                     Petugas hanya dapat ditugaskan ke tiket dari dinasnya sendiri."
                ));
            }
        }

        // Jika petugas ditetapkan, ubah status ke S06 (Baru Ditugaskan) jika masih S01/S02/S05
        let new_status = if officer_id.is_some() { "S06" } else { "S05" };

        sqlx::query(
            r#"UPDATE complaints
               SET assigned_agency_id = $1,
                   assigned_officer_id = $2,
                   current_status = $3::ticket_status,
                   updated_at = NOW()
               WHERE id = $4"#
        )
        .bind(agency_id)
        .bind(officer_id)
        .bind(new_status)
        .bind(complaint_id)
        .execute(&mut **tx)
        .await?;

        // Catat ke ticket_assignments
        sqlx::query(
            r#"INSERT INTO ticket_assignments(complaint_id, agency_id, officer_id, assigned_by)
               VALUES ($1, $2, $3, $4)"#
        )
        .bind(complaint_id)
        .bind(agency_id)
        .bind(officer_id)
        .bind(assigned_by)
        .execute(&mut **tx)
        .await?;

        // Catat histori status
        let default_note = if officer_id.is_some() {
            "Tiket telah ditugaskan ke petugas lapangan."
        } else {
            "Tiket telah didisposisikan ke dinas terkait."
        };
        let final_note = note.unwrap_or(default_note);

        sqlx::query(
            r#"INSERT INTO ticket_status_history(complaint_id, status, note, changed_by)
               VALUES ($1, $2::ticket_status, $3, $4)"#
        )
        .bind(complaint_id)
        .bind(new_status)
        .bind(final_note)
        .bind(assigned_by)
        .execute(&mut **tx)
        .await?;

        // Catat audit log
        sqlx::query(
            r#"INSERT INTO audit_logs(actor_id, action, entity_type, entity_id, metadata)
               VALUES ($1, 'ticket.assigned', 'complaint', $2, jsonb_build_object('agency_id', $3, 'officer_id', $4, 'status', $5))"#
        )
        .bind(assigned_by)
        .bind(complaint_id)
        .bind(agency_id)
        .bind(officer_id)
        .bind(new_status)
        .execute(&mut **tx)
        .await?;

        Ok(AssignmentResponse {
            success: true,
            ticket_no: ticket_no.to_string(),
            assigned_agency_id: agency_id,
            assigned_officer_id: officer_id,
            status: new_status.to_string(),
        })
    }

    pub async fn update_status(
        tx: &mut Transaction<'_, Postgres>,
        ticket_no: &str,
        payload: &UpdateStatusRequest,
        actor_id: Uuid,
        actor_role: &str,
    ) -> Result<String, ApiError> {
        let complaint = sqlx::query(
            "SELECT id, assigned_officer_id, assigned_agency_id, current_status::text AS status FROM complaints WHERE ticket_no = $1 FOR UPDATE"
        )
        .bind(ticket_no)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or_else(|| ApiError::not_found("Tiket pengaduan tidak ditemukan"))?;

        let complaint_id: Uuid = complaint.get("id");

        // Role Guard: Petugas lapangan hanya boleh mengupdate tiket miliknya
        if actor_role == "officer" {
            let assigned: Option<Uuid> = complaint.get("assigned_officer_id");
            if assigned != Some(actor_id) {
                return Err(ApiError::forbidden("Anda tidak memiliki kewenangan atas tiket yang bukan tugas Anda."));
            }
        }

        // Validasi status diperbolehkan
        let valid_statuses = ["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08", "S09", "S10"];
        if !valid_statuses.contains(&payload.status.as_str()) {
            return Err(ApiError::bad_request("Kode status tidak valid"));
        }

        // SECURITY [FIX]: Validasi khusus S08 — wajib ada foto bukti penyelesaian (evidence_type = 'resolution')
        // sesuai PRD BR-007: petugas wajib melampirkan foto sebelum menyatakan selesai
        if payload.status == "S08" {
            let resolution_count: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM complaint_attachments WHERE complaint_id = $1 AND evidence_type = 'resolution'"
            )
            .bind(complaint_id)
            .fetch_one(&mut **tx)
            .await?;

            if resolution_count == 0 {
                return Err(ApiError::bad_request(
                    "Status S08 (Menunggu Konfirmasi) hanya dapat diset jika sudah ada \
                     foto bukti penyelesaian (evidence_type = 'resolution') yang diunggah. \
                     Harap unggah foto hasil pekerjaan terlebih dahulu."
                ));
            }
        }

        sqlx::query(
            r#"UPDATE complaints
               SET current_status = $1::ticket_status,
                   updated_at = NOW(),
                   resolved_at = CASE WHEN $1 IN ('S08', 'S09') AND resolved_at IS NULL THEN NOW() ELSE resolved_at END
               WHERE id = $2"#
        )
        .bind(&payload.status)
        .bind(complaint_id)
        .execute(&mut **tx)
        .await?;

        sqlx::query(
            r#"INSERT INTO ticket_status_history(complaint_id, status, note, progress_percent, changed_by)
               VALUES ($1, $2::ticket_status, $3, $4, $5)"#
        )
        .bind(complaint_id)
        .bind(&payload.status)
        .bind(&payload.note)
        .bind(payload.progress_percent)
        .bind(actor_id)
        .execute(&mut **tx)
        .await?;

        sqlx::query(
            r#"INSERT INTO audit_logs(actor_id, action, entity_type, entity_id, metadata)
               VALUES ($1, 'ticket.status_updated', 'complaint', $2, jsonb_build_object('status', $3, 'progress', $4))"#
        )
        .bind(actor_id)
        .bind(complaint_id)
        .bind(&payload.status)
        .bind(payload.progress_percent)
        .execute(&mut **tx)
        .await?;

        Ok(payload.status.clone())
    }

    pub async fn add_feedback(
        pool: &PgPool,
        ticket_no: &str,
        payload: &CreateFeedbackRequest,
        citizen_id: Uuid,
    ) -> Result<CitizenFeedback, ApiError> {
        if !(1..=5).contains(&payload.rating) {
            return Err(ApiError::bad_request("Rating harus berada antara 1 sampai 5."));
        }

        let complaint = sqlx::query("SELECT id, reporter_id, current_status::text AS status FROM complaints WHERE ticket_no = $1")
            .bind(ticket_no)
            .fetch_optional(pool)
            .await?
            .ok_or_else(|| ApiError::not_found("Tiket pengaduan tidak ditemukan"))?;

        let complaint_id: Uuid = complaint.get("id");
        let reporter_id: Option<Uuid> = complaint.get("reporter_id");

        if reporter_id != Some(citizen_id) {
            return Err(ApiError::forbidden("Hanya pelapor pengaduan ini yang dapat memberikan feedback."));
        }

        let status: String = complaint.get("status");
        if !["S08", "S09"].contains(&status.as_str()) {
            return Err(ApiError::bad_request("Feedback hanya dapat diberikan jika pengaduan telah diselesaikan (S08/S09)."));
        }

        let row = sqlx::query(
            r#"INSERT INTO citizen_feedback(complaint_id, citizen_id, rating, comment)
               VALUES ($1, $2, $3, $4)
               RETURNING id, complaint_id, citizen_id, rating, comment, created_at"#
        )
        .bind(complaint_id)
        .bind(citizen_id)
        .bind(payload.rating)
        .bind(&payload.comment)
        .fetch_one(pool)
        .await?;

        Ok(CitizenFeedback {
            id: row.get("id"),
            complaint_id: row.get("complaint_id"),
            citizen_id: row.get("citizen_id"),
            rating: row.get("rating"),
            comment: row.get("comment"),
            created_at: row.get("created_at"),
        })
    }
}

