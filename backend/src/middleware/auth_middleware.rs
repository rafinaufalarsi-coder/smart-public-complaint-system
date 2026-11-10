use axum::{
    extract::{Request, State},
    http::{header::AUTHORIZATION, StatusCode},
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{decode, DecodingKey, Validation};

use crate::{errors::ApiError, models::user::Claims, state::AppState};

pub async fn require_auth(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, ApiError> {
    let header = request
        .headers()
        .get(AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| ApiError::unauthorized("Token otentikasi Bearer tidak ditemukan"))?;

    let token = header
        .strip_prefix("Bearer ")
        .ok_or_else(|| ApiError::unauthorized("Format header harus 'Bearer <token>'"))?;

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(state.config.jwt_secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|e| {
        tracing::warn!("JWT verification failed: {:?}", e);
        ApiError::unauthorized("Token otentikasi tidak valid atau sudah kedaluwarsa")
    })?;

    request.extensions_mut().insert(token_data.claims);
    Ok(next.run(request).await)
}

