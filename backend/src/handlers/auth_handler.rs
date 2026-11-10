use axum::{extract::State, http::StatusCode, Extension, Json};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{
    errors::ApiError,
    models::user::{AuthResponse, Claims, LoginRequest, RegisterRequest, UserProfile},
    repositories::user_repository::UserRepository,
    services::auth_service::AuthService,
    state::AppState,
};

pub async fn register(
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    let user = AuthService::register(&state.db, payload).await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "message": "Registrasi berhasil.",
            "data": user
        })),
    ))
}

pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<Value>, ApiError> {
    let auth_res: AuthResponse = AuthService::login(&state.db, &state.config, payload).await?;

    Ok(Json(json!({
        "success": true,
        "message": "Login berhasil.",
        "data": auth_res
    })))
}

pub async fn me(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Value>, ApiError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| ApiError::unauthorized("Identitas token tidak valid"))?;

    let profile: UserProfile = UserRepository::find_by_id(&state.db, user_id)
        .await?
        .ok_or_else(|| ApiError::not_found("Profil pengguna tidak ditemukan"))?;

    Ok(Json(json!({
        "success": true,
        "data": profile
    })))
}

