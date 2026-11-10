use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub database_url: String,
    pub jwt_secret: String,
    pub jwt_expires_in_hours: i64,
    pub frontend_origin: String,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        dotenvy::dotenv().ok();

        // SECURITY: JWT_SECRET WAJIB diset secara eksplisit. Tidak boleh ada nilai default.
        // Jika tidak diset, server PANIC dan menolak startup untuk mencegah risiko keamanan.
        let jwt_secret = env::var("JWT_SECRET")
            .map_err(|_| anyhow::anyhow!(
                "FATAL: Variabel lingkungan JWT_SECRET tidak diset. \
                 Server menolak startup untuk mencegah risiko keamanan kritis. \
                 Harap set JWT_SECRET dengan nilai acak minimal 32 karakter di file .env"
            ))?;
        anyhow::ensure!(
            jwt_secret.len() >= 32,
            "FATAL: JWT_SECRET terlalu pendek (panjang saat ini: {} karakter). \
             Minimum yang diizinkan adalah 32 karakter acak yang kuat.",
            jwt_secret.len()
        );

        let host = env::var("APP_HOST").unwrap_or_else(|_| "127.0.0.1".into());
        let port = env::var("APP_PORT")
            .unwrap_or_else(|_| "8080".into())
            .parse::<u16>()?;

        // SECURITY: DATABASE_URL wajib diset secara eksplisit.
        let database_url = env::var("DATABASE_URL")
            .map_err(|_| anyhow::anyhow!(
                "FATAL: Variabel lingkungan DATABASE_URL tidak diset. \
                 Harap konfigurasi DATABASE_URL di file .env"
            ))?;

        let jwt_expires_in_hours = env::var("JWT_EXPIRES_IN_HOURS")
            .unwrap_or_else(|_| "12".into())
            .parse::<i64>()?;
        let frontend_origin = env::var("FRONTEND_ORIGIN")
            .unwrap_or_else(|_| "http://localhost:3000".into());

        Ok(Self {
            host,
            port,
            database_url,
            jwt_secret,
            jwt_expires_in_hours,
            frontend_origin,
        })
    }
}

