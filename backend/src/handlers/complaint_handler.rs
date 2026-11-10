use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Extension, Json,
};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{
    errors::ApiError,
    models::{
        complaint::{ComplaintQueryFilter, CreateComplaintRequest},
        user::Claims,
    },
    services::complaint_service::ComplaintService,
    state::AppState,
};

pub async fn create_complaint(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateComplaintRequest>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    let reporter_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| ApiError::unauthorized("Identitas token tidak valid"))?;

    let complaint = ComplaintService::create_complaint(&state.db, payload, reporter_id).await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "message": "Pengaduan berhasil dibuat.",
            "data": complaint
        })),
    ))
}

pub async fn list_complaints(
    State(state): State<AppState>,
    Query(filter): Query<ComplaintQueryFilter>,
) -> Result<Json<Value>, ApiError> {
    let list = ComplaintService::list_complaints(&state.db, filter).await?;

    Ok(Json(json!({
        "success": true,
        "count": list.len(),
        "data": list
    })))
}

pub async fn get_complaint_detail(
    State(state): State<AppState>,
    Path(ticket_no): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let detail = ComplaintService::get_detail(&state.db, &ticket_no).await?;

    Ok(Json(json!({
        "success": true,
        "data": detail
    })))
}

pub async fn list_my_complaints(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Value>, ApiError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| ApiError::unauthorized("Identitas token tidak valid"))?;

    let list = ComplaintService::list_my_complaints(&state.db, user_id).await?;

    Ok(Json(json!({
        "success": true,
        "count": list.len(),
        "data": list
    })))
}

pub async fn list_officer_tasks(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Value>, ApiError> {
    if claims.role != "officer" && claims.role != "admin" {
        return Err(ApiError::forbidden(
            "Hanya petugas lapangan yang dapat mengakses daftar tugas.",
        ));
    }

    let officer_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| ApiError::unauthorized("Identitas token tidak valid"))?;

    let tasks = ComplaintService::list_officer_tasks(&state.db, officer_id).await?;

    Ok(Json(json!({
        "success": true,
        "count": tasks.len(),
        "data": tasks
    })))
}

