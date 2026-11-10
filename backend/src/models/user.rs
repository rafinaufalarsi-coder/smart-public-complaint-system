use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "user_role", rename_all = "lowercase")]
pub enum UserRole {
    Citizen,
    Admin,
    Officer,
}

impl std::fmt::Display for UserRole {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            UserRole::Citizen => write!(f, "citizen"),
            UserRole::Admin => write!(f, "admin"),
            UserRole::Officer => write!(f, "officer"),
        }
    }
}

impl std::str::FromStr for UserRole {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "citizen" => Ok(UserRole::Citizen),
            "admin" => Ok(UserRole::Admin),
            "officer" => Ok(UserRole::Officer),
            _ => Err(format!("Role {} tidak dikenal", s)),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct User {
    pub id: Uuid,
    pub full_name: String,
    pub email: String,
    pub phone: Option<String>,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub role: UserRole,
    pub nik_verified: bool,
    pub is_active: bool,
    pub agency_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct RegisterRequest {
    #[validate(length(min = 3, max = 160, message = "Nama lengkap minimal 3 karakter"))]
    pub full_name: String,
    #[validate(email(message = "Format email tidak valid"))]
    pub email: String,
    #[validate(length(min = 8, max = 128, message = "Password minimal 8 karakter"))]
    pub password: String,
    pub phone: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct LoginRequest {
    #[validate(email(message = "Format email tidak valid"))]
    pub email: String,
    #[validate(length(min = 8, max = 128, message = "Password minimal 8 karakter"))]
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub role: String,
    pub email: String,
    pub agency_id: Option<String>,
    pub exp: usize,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub access_token: String,
    pub token_type: &'static str,
    pub user: UserProfile,
}

#[derive(Debug, Serialize)]
pub struct UserProfile {
    pub id: Uuid,
    pub full_name: String,
    pub email: String,
    pub phone: Option<String>,
    pub role: String,
    pub agency_id: Option<Uuid>,
    pub agency_name: Option<String>,
}

