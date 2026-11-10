use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

#[derive(Debug)]
pub struct ApiError {
    pub status: StatusCode,
    pub message: String,
    pub details: Option<serde_json::Value>,
}

impl ApiError {
    pub fn new(status: StatusCode, message: impl Into<String>) -> Self {
        Self {
            status,
            message: message.into(),
            details: None,
        }
    }

    pub fn with_details(
        status: StatusCode,
        message: impl Into<String>,
        details: serde_json::Value,
    ) -> Self {
        Self {
            status,
            message: message.into(),
            details: Some(details),
        }
    }

    pub fn bad_request(message: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_REQUEST, message)
    }

    pub fn unauthorized(message: impl Into<String>) -> Self {
        Self::new(StatusCode::UNAUTHORIZED, message)
    }

    pub fn forbidden(message: impl Into<String>) -> Self {
        Self::new(StatusCode::FORBIDDEN, message)
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new(StatusCode::NOT_FOUND, message)
    }

    pub fn conflict(message: impl Into<String>) -> Self {
        Self::new(StatusCode::CONFLICT, message)
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::new(StatusCode::INTERNAL_SERVER_ERROR, message)
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let mut body = json!({
            "success": false,
            "message": self.message,
        });

        if let Some(details) = self.details {
            body["details"] = details;
        }

        (self.status, Json(body)).into_response()
    }
}

impl From<sqlx::Error> for ApiError {
    fn from(err: sqlx::Error) -> Self {
        tracing::error!("Database error: {:?}", err);
        match &err {
            sqlx::Error::Database(db_err) => {
                // 23505 = unique_violation
                if db_err.code().as_deref() == Some("23505") {
                    return ApiError::conflict("Data dengan nilai unik tersebut sudah ada.");
                }
                // 23503 = foreign_key_violation
                if db_err.code().as_deref() == Some("23503") {
                    return ApiError::bad_request("Referensi data relasi tidak ditemukan.");
                }
                ApiError::internal("Terjadi kesalahan pada integritas database")
            }
            sqlx::Error::RowNotFound => ApiError::not_found("Data yang diminta tidak ditemukan"),
            _ => ApiError::internal("Terjadi kesalahan sistem internal database"),
        }
    }
}

impl From<validator::ValidationErrors> for ApiError {
    fn from(err: validator::ValidationErrors) -> Self {
        let details = serde_json::to_value(err).unwrap_or(json!({}));
        ApiError::with_details(
            StatusCode::BAD_REQUEST,
            "Format data input tidak memenuhi syarat validasi",
            details,
        )
    }
}

impl From<anyhow::Error> for ApiError {
    fn from(err: anyhow::Error) -> Self {
        tracing::error!("Internal error: {:?}", err);
        ApiError::internal(err.to_string())
    }
}

