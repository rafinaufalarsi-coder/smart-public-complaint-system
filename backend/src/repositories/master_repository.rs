use sqlx::PgPool;

use crate::{
    errors::ApiError,
    models::{agency::Agency, category::ComplaintCategory},
};

pub struct MasterRepository;

impl MasterRepository {
    pub async fn get_categories(pool: &PgPool) -> Result<Vec<ComplaintCategory>, ApiError> {
        let categories = sqlx::query_as::<_, ComplaintCategory>(
            "SELECT id, name, description, default_agency_id, is_active FROM complaint_categories WHERE is_active = TRUE ORDER BY name ASC"
        )
        .fetch_all(pool)
        .await?;

        Ok(categories)
    }

    pub async fn get_agencies(pool: &PgPool) -> Result<Vec<Agency>, ApiError> {
        let agencies = sqlx::query_as::<_, Agency>(
            "SELECT id, code, name, description, created_at FROM agencies ORDER BY code ASC"
        )
        .fetch_all(pool)
        .await?;

        Ok(agencies)
    }
}

