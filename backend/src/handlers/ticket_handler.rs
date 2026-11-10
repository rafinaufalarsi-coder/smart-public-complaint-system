use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{
    errors::ApiError,
    models::{
        assignment::AssignTicketRequest,
        feedback::CreateFeedbackRequest,
        history::UpdateStatusRequest,
        user::Claims,
    },
    services::ticket_service::TicketService,
    state::AppState,
};

pub async fn assign_ticket(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(ticket_no): Path<String>,
    Json(payload): Json<AssignTicketRequest>,
) -> Result<Json<Value>, ApiError> {
    if claims.role != "admin" {
        return Err(ApiError::forbidden(
            "Hanya admin dinas yang dapat menugaskan tiket pengaduan.",
        ));
    }

    let assigned_by = Uuid::parse_str(&claims.sub)
        .map_err(|_| ApiError::unauthorized("Identitas token tidak valid"))?;

    let result = TicketService::assign_ticket(&state.db, &ticket_no, payload, assigned_by).await?;

    Ok(Json(json!({
        "success": true,
        "message": "Penugasan tiket berhasil diperbarui.",
        "data": result
    })))
}

pub async fn update_ticket_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(ticket_no): Path<String>,
    Json(payload): Json<UpdateStatusRequest>,
) -> Result<Json<Value>, ApiError> {
    if !matches!(claims.role.as_str(), "admin" | "officer") {
        return Err(ApiError::forbidden(
            "Hanya admin dinas atau petugas lapangan yang dapat mengubah status tiket.",
        ));
    }

    let actor_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| ApiError::unauthorized("Identitas token tidak valid"))?;

    let new_status = TicketService::update_status(
        &state.db,
        &ticket_no,
        payload,
        actor_id,
        &claims.role,
    )
    .await?;

    Ok(Json(json!({
        "success": true,
        "message": "Status tiket berhasil diperbarui.",
        "data": {
            "ticket_no": ticket_no,
            "current_status": new_status
        }
    })))
}

pub async fn get_ticket_history(
    State(state): State<AppState>,
    Path(ticket_no): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let history = TicketService::get_history(&state.db, &ticket_no).await?;

    Ok(Json(json!({
        "success": true,
        "ticket_no": ticket_no,
        "data": history
    })))
}

pub async fn submit_feedback(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(ticket_no): Path<String>,
    Json(payload): Json<CreateFeedbackRequest>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    let citizen_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| ApiError::unauthorized("Identitas token tidak valid"))?;

    let feedback = TicketService::add_feedback(&state.db, &ticket_no, payload, citizen_id).await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "message": "Terima kasih atas ulasan dan penilaian Anda.",
            "data": feedback
        })),
    ))
}

