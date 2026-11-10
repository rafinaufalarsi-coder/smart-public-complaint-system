use axum::{
    extract::{Query, State},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{
    errors::ApiError,
    repositories::{master_repository::MasterRepository, user_repository::UserRepository},
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct OfficerQuery {
    pub agency_id: Option<Uuid>,
}

pub async fn get_categories(State(state): State<AppState>) -> Result<Json<Value>, ApiError> {
    let categories = MasterRepository::get_categories(&state.db).await?;

    Ok(Json(json!({
        "success": true,
        "count": categories.len(),
        "data": categories
    })))
}

pub async fn get_agencies(State(state): State<AppState>) -> Result<Json<Value>, ApiError> {
    let agencies = MasterRepository::get_agencies(&state.db).await?;

    Ok(Json(json!({
        "success": true,
        "count": agencies.len(),
        "data": agencies
    })))
}

pub async fn get_officers(
    State(state): State<AppState>,
    Query(query): Query<OfficerQuery>,
) -> Result<Json<Value>, ApiError> {
    let officers = UserRepository::find_officers(&state.db, query.agency_id).await?;

    Ok(Json(json!({
        "success": true,
        "count": officers.len(),
        "data": officers
    })))
}
