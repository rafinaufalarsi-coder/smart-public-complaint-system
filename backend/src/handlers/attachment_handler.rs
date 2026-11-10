use axum::{
    extract::{Multipart, Path, State},
    http::StatusCode,
    Extension, Json,
};
use serde_json::{json, Value};
use sqlx::Row;
use uuid::Uuid;

use crate::{
    errors::ApiError,
    models::{complaint::ComplaintAttachmentItem, user::Claims},
    state::AppState,
};

pub async fn upload_attachment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(ticket_no): Path<String>,
    mut multipart: Multipart,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| ApiError::unauthorized("Identitas token tidak valid"))?;

    // Cari ID pengaduan berdasarkan ticket_no
    let complaint = sqlx::query("SELECT id FROM complaints WHERE ticket_no = $1")
        .bind(&ticket_no)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| ApiError::not_found("Tiket pengaduan tidak ditemukan"))?;

    let complaint_id: Uuid = complaint.get("id");

    let mut evidence_type = "initial".to_string();
    let mut file_saved = false;
    let mut original_filename = String::new();
    let mut mime_type = String::new();
    let mut file_size: i64 = 0;
    let mut object_key = String::new();

    // Pastikan direktori uploads lokal tersedia
    let uploads_dir = std::path::Path::new("uploads");
    if !uploads_dir.exists() {
        let _ = std::fs::create_dir_all(uploads_dir);
    }

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| ApiError::bad_request(format!("Error membaca multipart data: {}", e)))?
    {
        let name = field.name().unwrap_or("").to_string();

        if name == "evidence_type" {
            if let Ok(text) = field.text().await {
                evidence_type = text;
            }
        } else if name == "file" {
            let filename = field
                .file_name()
                .unwrap_or("bukti_pengaduan.jpg")
                .to_string();

            let bytes = field
                .bytes()
                .await
                .map_err(|e| ApiError::bad_request(format!("Error membaca file bytes: {}", e)))?;

            file_size = bytes.len() as i64;

            // Batas ukuran 10 MB
            if file_size > 10 * 1024 * 1024 {
                return Err(ApiError::bad_request(
                    "Ukuran file melebihi batas maksimal 10 MB",
                ));
            }

            // SECURITY [FIX]: Validasi extension file (allowlist) — mencegah upload file berbahaya
            let ext = std::path::Path::new(&filename)
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            let allowed_extensions = ["jpg", "jpeg", "png", "webp"];
            if !allowed_extensions.contains(&ext.as_str()) {
                return Err(ApiError::bad_request(
                    "Hanya file gambar yang diizinkan: JPG, JPEG, PNG, WebP",
                ));
            }

            // SECURITY [FIX]: Validasi magic bytes (konten sebenarnya, bukan content-type header
            // yang bisa dipalsukan oleh klien). PRD NFR-SEC-07.
            let detected_mime = detect_image_mime(&bytes).ok_or_else(|| {
                ApiError::bad_request(
                    "File tidak valid: konten bukan gambar yang diizinkan (JPG/PNG/WebP). \
                     Pastikan file yang diunggah benar-benar berformat gambar.",
                )
            })?;

            // SECURITY [FIX]: Sanitasi nama file untuk mencegah path traversal
            let clean_filename = sanitize_filename(&filename);

            // Generate nama file unik aman
            let file_uuid = Uuid::new_v4();
            let stored_filename = format!("{}_{}", file_uuid, clean_filename);
            let file_path = uploads_dir.join(&stored_filename);

            std::fs::write(&file_path, &bytes).map_err(|e| {
                tracing::error!("Gagal menyimpan file ke disk: {:?}", e);
                ApiError::internal("Gagal menyimpan file lampiran ke server")
            })?;

            object_key = format!("uploads/{}", stored_filename);
            original_filename = clean_filename;
            mime_type = detected_mime.to_string();
            file_saved = true;
        }
    }

    if !file_saved {
        return Err(ApiError::bad_request("Field file lampiran tidak ditemukan."));
    }

    let row = sqlx::query(
        r#"INSERT INTO complaint_attachments
           (complaint_id, uploaded_by, object_key, original_filename, mime_type, file_size_bytes, evidence_type)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, object_key, original_filename, mime_type, file_size_bytes, evidence_type, created_at"#
    )
    .bind(complaint_id)
    .bind(user_id)
    .bind(&object_key)
    .bind(&original_filename)
    .bind(&mime_type)
    .bind(file_size)
    .bind(&evidence_type)
    .fetch_one(&state.db)
    .await?;

    let attachment = ComplaintAttachmentItem {
        id: row.get("id"),
        object_key: row.get("object_key"),
        original_filename: row.get("original_filename"),
        mime_type: row.get("mime_type"),
        file_size_bytes: row.get("file_size_bytes"),
        evidence_type: row.get("evidence_type"),
        created_at: row.get("created_at"),
    };

    // Audit log
    let _ = sqlx::query(
        r#"INSERT INTO audit_logs(actor_id, action, entity_type, entity_id, metadata)
           VALUES ($1, 'attachment.uploaded', 'complaint', $2, jsonb_build_object('object_key', $3, 'type', $4))"#
    )
    .bind(user_id)
    .bind(complaint_id)
    .bind(&object_key)
    .bind(&evidence_type)
    .execute(&state.db)
    .await;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "message": "Foto bukti berhasil diunggah.",
            "data": attachment
        })),
    ))
}

/// SECURITY [FIX]: Deteksi tipe MIME berdasarkan magic bytes aktual.
/// Tidak mempercayai Content-Type header dari klien (bisa dipalsukan).
/// PRD NFR-SEC-07: Hanya gambar yang diizinkan.
fn detect_image_mime(bytes: &[u8]) -> Option<&'static str> {
    if bytes.len() < 4 {
        return None;
    }

    // JPEG: FF D8 FF
    if bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF {
        return Some("image/jpeg");
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if bytes.len() >= 8
        && bytes[0] == 0x89
        && bytes[1] == 0x50
        && bytes[2] == 0x4E
        && bytes[3] == 0x47
        && bytes[4] == 0x0D
        && bytes[5] == 0x0A
        && bytes[6] == 0x1A
        && bytes[7] == 0x0A
    {
        return Some("image/png");
    }

    // WebP: 52 49 46 46 ?? ?? ?? ?? 57 45 42 50
    if bytes.len() >= 12
        && bytes[0] == 0x52  // R
        && bytes[1] == 0x49  // I
        && bytes[2] == 0x46  // F
        && bytes[3] == 0x46  // F
        && bytes[8] == 0x57  // W
        && bytes[9] == 0x45  // E
        && bytes[10] == 0x42 // B
        && bytes[11] == 0x50 // P
    {
        return Some("image/webp");
    }

    None
}

/// SECURITY [FIX]: Sanitasi nama file — hapus karakter berbahaya untuk mencegah
/// path traversal attack (misalnya: `../../etc/passwd`).
fn sanitize_filename(filename: &str) -> String {
    // Ambil hanya bagian nama file (buang path)
    let basename = std::path::Path::new(filename)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("file");

    // Izinkan hanya alphanumeric, titik, dan tanda hubung
    let sanitized: String = basename
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '.' || c == '-' {
                c
            } else {
                '_'
            }
        })
        .collect();

    // Pastikan tidak kosong setelah sanitasi
    if sanitized.is_empty() || sanitized == "." {
        "attachment".to_string()
    } else {
        sanitized
    }
}
