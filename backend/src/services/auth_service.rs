use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use chrono::{Duration, Utc};
use jsonwebtoken::{encode, EncodingKey, Header};
use sqlx::PgPool;

use crate::{
    config::Config,
    errors::ApiError,
    models::user::{AuthResponse, Claims, LoginRequest, RegisterRequest, UserProfile, UserRole},
    repositories::user_repository::UserRepository,
};

pub struct AuthService;

impl AuthService {
    pub async fn register(pool: &PgPool, payload: RegisterRequest) -> Result<UserProfile, ApiError> {
        let salt = SaltString::generate(&mut OsRng);
        let password_hash = Argon2::default()
            .hash_password(payload.password.as_bytes(), &salt)
            .map_err(|e| {
                tracing::error!("Password hashing error: {:?}", e);
                ApiError::internal("Gagal memproses keamanan password")
            })?
            .to_string();

        let user = UserRepository::create_user(
            pool,
            &payload.full_name,
            &payload.email,
            payload.phone.as_deref(),
            &password_hash,
            UserRole::Citizen, // Registrasi publik selalu role citizen
        )
        .await?;

        Ok(user)
    }

    pub async fn login(
        pool: &PgPool,
        config: &Config,
        payload: LoginRequest,
    ) -> Result<AuthResponse, ApiError> {
        let user = UserRepository::find_by_email(pool, &payload.email)
            .await?
            .ok_or_else(|| ApiError::unauthorized("Email atau password yang Anda masukkan salah"))?;

        let parsed_hash = PasswordHash::new(&user.password_hash)
            .map_err(|_| ApiError::internal("Format hash password internal tidak valid"))?;

        Argon2::default()
            .verify_password(payload.password.as_bytes(), &parsed_hash)
            .map_err(|_| ApiError::unauthorized("Email atau password yang Anda masukkan salah"))?;

        let profile = UserRepository::find_by_id(pool, user.id)
            .await?
            .ok_or_else(|| ApiError::internal("Profil pengguna tidak ditemukan"))?;

        let expires = Utc::now() + Duration::hours(config.jwt_expires_in_hours);
        let claims = Claims {
            sub: user.id.to_string(),
            role: user.role.to_string(),
            email: user.email.clone(),
            agency_id: user.agency_id.map(|id| id.to_string()),
            exp: expires.timestamp() as usize,
        };

        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(config.jwt_secret.as_bytes()),
        )
        .map_err(|e| {
            tracing::error!("JWT token generation failed: {:?}", e);
            ApiError::internal("Gagal menerbitkan token otentikasi")
        })?;

        Ok(AuthResponse {
            access_token: token,
            token_type: "Bearer",
            user: profile,
        })
    }
}

