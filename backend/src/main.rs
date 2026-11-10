mod config;
mod errors;
mod handlers;
mod middleware;
mod models;
mod repositories;
mod routes;
mod services;
mod state;

use std::net::SocketAddr;
use axum::http::{HeaderName, HeaderValue, header};
use tower_http::{
    cors::CorsLayer,
    services::ServeDir,
    set_header::SetResponseHeaderLayer,
    trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::{config::Config, routes::create_router, state::AppState};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // 1. Inisialisasi Tracing & Logging
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::from_default_env())
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Memulai SPCS Backend (Smart Public Complaint System)...");

    // 2. Load Konfigurasi Environment
    let config = Config::from_env()?;
    // SECURITY: Tidak mencatat DATABASE_URL ke log untuk mencegah credential exposure
    tracing::info!("Konfigurasi environment dimuat. Menghubungkan ke database...");

    // 3. Inisialisasi Pool Database PostgreSQL
    let db = sqlx::postgres::PgPoolOptions::new()
        .max_connections(20)
        .connect(&config.database_url)
        .await?;

    tracing::info!("Koneksi database PostgreSQL berhasil. Menjalankan migrasi SQLx...");

    // 4. Jalankan Migrasi Database Otomatis
    sqlx::migrate!("./migrations").run(&db).await?;
    tracing::info!("Migrasi database selesai diverifikasi.");

    // Pastikan direktori uploads lokal tersedia
    let uploads_dir = std::path::Path::new("uploads");
    if !uploads_dir.exists() {
        let _ = std::fs::create_dir_all(uploads_dir);
    }

    // 5. Inisialisasi Shared State
    let state = AppState {
        db,
        config: config.clone(),
    };

    // 6. Konfigurasi CORS — dibatasi hanya ke origin frontend yang dikonfigurasi
    let allowed_origin: HeaderValue = config
        .frontend_origin
        .parse()
        .map_err(|_| anyhow::anyhow!("FRONTEND_ORIGIN tidak valid sebagai HTTP header value"))?;

    let cors = CorsLayer::new()
        .allow_origin(allowed_origin)
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PATCH,
            axum::http::Method::DELETE,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers([
            axum::http::header::AUTHORIZATION,
            axum::http::header::CONTENT_TYPE,
            axum::http::header::ACCEPT,
        ])
        .allow_credentials(false);

    // 7. Bangun Router Aplikasi + Serve Static Uploads
    let app = create_router(state)
        .nest_service("/uploads", ServeDir::new("uploads"))
        .layer(cors)
        // SECURITY: HTTP Security Headers
        .layer(SetResponseHeaderLayer::overriding(
            HeaderName::from_static("x-content-type-options"),
            HeaderValue::from_static("nosniff"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            HeaderName::from_static("x-frame-options"),
            HeaderValue::from_static("DENY"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            HeaderName::from_static("x-xss-protection"),
            HeaderValue::from_static("1; mode=block"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            HeaderName::from_static("referrer-policy"),
            HeaderValue::from_static("strict-origin-when-cross-origin"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            header::STRICT_TRANSPORT_SECURITY,
            HeaderValue::from_static("max-age=31536000; includeSubDomains"),
        ))
        .layer(SetResponseHeaderLayer::overriding(
            HeaderName::from_static("content-security-policy"),
            HeaderValue::from_static(
                "default-src 'none'; script-src 'none'; object-src 'none'; frame-ancestors 'none'"
            ),
        ))
        .layer(TraceLayer::new_for_http());

    // 8. Bind Listener & Jalankan Server Axum
    let address: SocketAddr = format!("{}:{}", config.host, config.port).parse()?;
    let listener = tokio::net::TcpListener::bind(address).await?;

    tracing::info!("====================================================");
    tracing::info!("SPCS API Server aktif dan mendengarkan pada http://{}", address);
    tracing::info!("Health Check: http://{}/health", address);
    tracing::info!("API Base URL: http://{}/api/v1", address);
    tracing::info!("Static Files: http://{}/uploads", address);
    tracing::info!("====================================================");

    axum::serve(listener, app).await?;

    Ok(())
}
