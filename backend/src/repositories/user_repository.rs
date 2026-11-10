use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::{
    errors::ApiError,
    models::user::{User, UserProfile, UserRole},
};

pub struct UserRepository;

impl UserRepository {
    pub async fn find_by_email(pool: &PgPool, email: &str) -> Result<Option<User>, ApiError> {
        let user = sqlx::query_as::<_, User>(
            r#"SELECT id, full_name, email, phone, password_hash, role,
                      nik_verified, is_active, agency_id, created_at, updated_at
               FROM users
               WHERE LOWER(email) = LOWER($1) AND is_active = TRUE"#,
        )
        .bind(email)
        .fetch_optional(pool)
        .await?;

        Ok(user)
    }

    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<UserProfile>, ApiError> {
        let row = sqlx::query(
            r#"SELECT u.id, u.full_name, u.email, u.phone, u.role::text AS role,
                      u.agency_id, a.name AS agency_name
               FROM users u
               LEFT JOIN agencies a ON u.agency_id = a.id
               WHERE u.id = $1 AND u.is_active = TRUE"#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await?;

        let user = row.map(|r| UserProfile {
            id: r.get("id"),
            full_name: r.get("full_name"),
            email: r.get("email"),
            phone: r.get("phone"),
            role: r.get("role"),
            agency_id: r.get("agency_id"),
            agency_name: r.get("agency_name"),
        });

        Ok(user)
    }

    pub async fn find_officers(
        pool: &PgPool,
        agency_id: Option<Uuid>,
    ) -> Result<Vec<UserProfile>, ApiError> {
        let rows = sqlx::query(
            r#"SELECT u.id, u.full_name, u.email, u.phone, u.role::text AS role,
                      u.agency_id, a.name AS agency_name
               FROM users u
               LEFT JOIN agencies a ON u.agency_id = a.id
               WHERE u.role = 'officer' AND u.is_active = TRUE
                 AND ($1::uuid IS NULL OR u.agency_id = $1)
               ORDER BY u.full_name ASC"#,
        )
        .bind(agency_id)
        .fetch_all(pool)
        .await?;

        let officers = rows
            .into_iter()
            .map(|r| UserProfile {
                id: r.get("id"),
                full_name: r.get("full_name"),
                email: r.get("email"),
                phone: r.get("phone"),
                role: r.get("role"),
                agency_id: r.get("agency_id"),
                agency_name: r.get("agency_name"),
            })
            .collect();

        Ok(officers)
    }

    pub async fn create_user(
        pool: &PgPool,
        full_name: &str,
        email: &str,
        phone: Option<&str>,
        password_hash: &str,
        role: UserRole,
    ) -> Result<UserProfile, ApiError> {
        let row = sqlx::query(
            r#"INSERT INTO users(full_name, email, phone, password_hash, role)
               VALUES ($1, LOWER($2), $3, $4, $5)
               RETURNING id, full_name, email, phone, role::text AS role, agency_id"#,
        )
        .bind(full_name)
        .bind(email)
        .bind(phone)
        .bind(password_hash)
        .bind(role)
        .fetch_one(pool)
        .await?;

        Ok(UserProfile {
            id: row.get("id"),
            full_name: row.get("full_name"),
            email: row.get("email"),
            phone: row.get("phone"),
            role: row.get("role"),
            agency_id: row.get("agency_id"),
            agency_name: None,
        })
    }
}
