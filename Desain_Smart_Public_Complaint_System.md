# SPCS — Smart Public Complaint System
## Implementation Blueprint untuk Antigravity (Rust + PostgreSQL/PostGIS + Next.js)

> Dokumen implementasi berdasarkan PRD/proyek SPCS dan desain Google Stitch pada file `Smart Public Complaint System(1).txt`.
> Target: scaffold yang dapat ditempel/dipecah menjadi file proyek di IDE Antigravity. Kode ini merupakan baseline MVP; isi `.env`, jalankan migrasi, lalu integrasikan halaman UI secara bertahap.

---

## 0. Ringkasan keputusan teknis

| Area | Implementasi |
|---|---|
| Backend | Rust stable, Axum, Tokio, SQLx, Serde, JWT, Argon2 |
| Database | PostgreSQL + PostGIS |
| Frontend | Next.js App Router, React, TypeScript, Tailwind CSS |
| Geo-tagging | `geography(Point, 4326)`; API menerima latitude/longitude |
| Auth | Access JWT; password di-hash dengan Argon2id |
| Upload bukti | Simpan metadata di PostgreSQL; file fisik di object storage/local storage |
| Live update | SSE (`GET /api/v1/tickets/:ticket_no/events`) |
| UI language | Bahasa Indonesia; font Inter; Material Symbols |
| Lokasi produk | Kota Bandar Lampung |
| Branding | Logo Pemda Kota Bandar Lampung + Universitas Teknokrat Indonesia |
| Footer wajib | `Copyright©2026 by Rafi Naufal Arsi dan Dr. Erliyan Redy Susanto, M.Kom` |

### Catatan kesesuaian sumber

Desain Stitch memperlihatkan portal warga, form pengaduan, pelacakan tiket dengan timeline S01–S09, peta GIS, profil/notifikasi warga, dashboard petugas lapangan, peta rute petugas, dan panel pembaruan progres. Palet utamanya menggunakan `primary #00417b`, `primary-container #0d59a1`, `secondary-container #feae2c`, `tertiary-container #b1121b`, latar `#f9f9ff`, serta font Inter.

Desain menampilkan kode tahap S01, S02, S05, S06, S07, S08, dan S09. Nama resmi S03 dan S04 tidak terdefinisi jelas dalam materi yang tersedia; karena itu database menerima kode tahap tersebut, tetapi seed data tidak mengarang labelnya. Lengkapi label S03/S04 setelah dikonfirmasi dengan pemilik proses Pemda.

Nilai koordinat, nama warga/petugas, nomor tiket, statistik, dan tanggal yang tampak di mockup adalah data ilustrasi. Jangan gunakan sebagai data produksi.

---

# BAGIAN A — STRUKTUR REPOSITORY

```text
spcs/
├── backend/
│   ├── Cargo.toml
│   ├── .env.example
│   ├── migrations/
│   │   ├── 0001_extensions.sql
│   │   ├── 0002_schema.sql
│   │   └── 0003_seed_reference.sql
│   └── src/
│       ├── main.rs
│       ├── config.rs
│       ├── state.rs
│       ├── error.rs
│       ├── auth/
│       │   ├── mod.rs
│       │   ├── dto.rs
│       │   ├── handler.rs
│       │   └── middleware.rs
│       ├── complaints/
│       │   ├── mod.rs
│       │   ├── dto.rs
│       │   └── handler.rs
│       └── tickets/
│           ├── mod.rs
│           ├── dto.rs
│           └── handler.rs
├── frontend/
│   ├── .env.local.example
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── page.tsx
│   │   ├── lacak/page.tsx
│   │   ├── pengaduan/baru/page.tsx
│   │   └── petugas/tugas/page.tsx
│   ├── components/
│   │   ├── brand-header.tsx
│   │   ├── app-footer.tsx
│   │   └── status-badge.tsx
│   └── lib/
│       └── api.ts
└── SPCS.md
```

---

# BAGIAN B — DATABASE POSTGRESQL + POSTGIS

## B1. Aktifkan extension

**`backend/migrations/0001_extensions.sql`**

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

## B2. Skema inti

**`backend/migrations/0002_schema.sql`**

```sql
CREATE TYPE user_role AS ENUM ('citizen', 'admin', 'officer');
CREATE TYPE complaint_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE complaint_visibility AS ENUM ('public', 'private', 'anonymous');
CREATE TYPE ticket_status AS ENUM (
  'S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09'
);

CREATE TABLE agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(30),
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'citizen',
  nik_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT role_agency_check CHECK (
    (role = 'officer' AND agency_id IS NOT NULL) OR role <> 'officer'
  )
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_agency ON users(agency_id);

CREATE TABLE complaint_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  default_agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_no VARCHAR(32) NOT NULL UNIQUE,
  reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
  category_id UUID REFERENCES complaint_categories(id) ON DELETE SET NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  address_text TEXT,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  priority complaint_priority NOT NULL DEFAULT 'medium',
  visibility complaint_visibility NOT NULL DEFAULT 'public',
  current_status ticket_status NOT NULL DEFAULT 'S01',
  assigned_agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL,
  assigned_officer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  sla_due_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  CONSTRAINT assigned_user_must_be_officer CHECK (assigned_officer_id IS NULL OR assigned_agency_id IS NOT NULL)
);

CREATE INDEX idx_complaints_status ON complaints(current_status);
CREATE INDEX idx_complaints_priority ON complaints(priority);
CREATE INDEX idx_complaints_submitted_at ON complaints(submitted_at DESC);
CREATE INDEX idx_complaints_location ON complaints USING GIST(location);
CREATE INDEX idx_complaints_agency ON complaints(assigned_agency_id);

CREATE TABLE complaint_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  object_key TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
  evidence_type VARCHAR(30) NOT NULL DEFAULT 'initial',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ticket_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  status ticket_status NOT NULL,
  note TEXT,
  progress_percent SMALLINT CHECK (progress_percent BETWEEN 0 AND 100),
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_status_history_complaint_time
  ON ticket_status_history(complaint_id, created_at);

CREATE TABLE ticket_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id),
  officer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE citizen_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL UNIQUE REFERENCES complaints(id) ON DELETE CASCADE,
  citizen_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## B3. Seed kategori, OPD, dan tahap yang labelnya tersedia

**`backend/migrations/0003_seed_reference.sql`**

```sql
INSERT INTO agencies(code, name) VALUES
 ('PUPR', 'Dinas Bina Marga & Sumber Daya Air'),
 ('DISHUB', 'Dinas Perhubungan'),
 ('DLH', 'Dinas Lingkungan Hidup')
ON CONFLICT (code) DO NOTHING;

INSERT INTO complaint_categories(name, description, default_agency_id)
SELECT v.name, v.description, a.id
FROM (VALUES
 ('Jalan Rusak', 'Kerusakan jalan dan infrastruktur jalan', 'PUPR'),
 ('PJU Mati', 'Lampu penerangan jalan umum tidak berfungsi', 'DISHUB'),
 ('Drainase', 'Saluran air tersumbat atau rusak', 'PUPR'),
 ('Sampah Liar', 'Tumpukan sampah di ruang publik', 'DLH'),
 ('Fasilitas Publik', 'Kerusakan fasilitas umum', 'PUPR'),
 ('Lainnya', 'Pengaduan layanan publik lainnya', 'PUPR')
) AS v(name, description, agency_code)
JOIN agencies a ON a.code = v.agency_code
ON CONFLICT (name) DO NOTHING;

-- Tahap yang labelnya muncul eksplisit pada desain.
-- S03 dan S04 tetap valid sebagai kode, tetapi labelnya belum ditetapkan di sini.
CREATE TABLE IF NOT EXISTS ticket_status_catalog (
  code ticket_status PRIMARY KEY,
  label VARCHAR(120),
  description TEXT,
  is_configured BOOLEAN NOT NULL DEFAULT FALSE
);

INSERT INTO ticket_status_catalog(code, label, description, is_configured) VALUES
 ('S01', 'Terkirim ke Sistem', 'Laporan berhasil diunggah ke sistem.', TRUE),
 ('S02', 'Pemeriksaan Admin', 'Verifikasi awal integritas laporan.', TRUE),
 ('S05', 'Validasi Dinas', 'Disposisi diterima OPD teknis.', TRUE),
 ('S06', 'Baru Ditugaskan', 'Tugas diterbitkan untuk petugas lapangan.', TRUE),
 ('S07', 'Penanganan Teknis Lapangan', 'Petugas melakukan investigasi/perbaikan.', TRUE),
 ('S08', 'Menunggu Konfirmasi', 'Menunggu verifikasi akhir hasil perbaikan.', TRUE),
 ('S09', 'Selesai & Diarsipkan', 'Tiket ditutup dan diarsipkan.', TRUE),
 ('S03', NULL, NULL, FALSE),
 ('S04', NULL, NULL, FALSE)
ON CONFLICT (code) DO NOTHING;
```

> Jalankan migrasi dengan SQLx CLI: `sqlx migrate run`. Untuk produksi, gunakan user database khusus aplikasi (bukan superuser), backup terjadwal, TLS, dan kredensial melalui secret manager.

### Contoh query spasial

```sql
-- Buat titik lokasi dari longitude dan latitude.
ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography

-- Cari laporan dalam radius 2 km dari koordinat tertentu.
SELECT ticket_no, title,
       ST_Y(location::geometry) AS latitude,
       ST_X(location::geometry) AS longitude
FROM complaints
WHERE ST_DWithin(
  location,
  ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
  2000
);
```

Ingat urutan PostGIS `ST_MakePoint(longitude, latitude)`, sedangkan payload API menggunakan properti `latitude` dan `longitude`.

---

# BAGIAN C — BACKEND RUST (AXUM)

## C1. Cargo dependencies

**`backend/Cargo.toml`**

```toml
[package]
name = "spcs-api"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = { version = "0.7", features = ["macros", "multipart"] }
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
sqlx = { version = "0.8", features = ["runtime-tokio-rustls", "postgres", "uuid", "chrono", "json", "migrate"] }
uuid = { version = "1", features = ["serde", "v4"] }
chrono = { version = "0.4", features = ["serde"] }
dotenvy = "0.15"
thiserror = "2"
anyhow = "1"
argon2 = "0.5"
password-hash = { version = "0.5", features = ["rand_core"] }
rand_core = { version = "0.6", features = ["getrandom"] }
jsonwebtoken = "9"
tower-http = { version = "0.6", features = ["cors", "trace"] }
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
validator = { version = "0.18", features = ["derive"] }
```

## C2. Environment

**`backend/.env.example`**

```dotenv
APP_HOST=127.0.0.1
APP_PORT=8080
DATABASE_URL=postgres://spcs_user:change_me@localhost:5432/spcs
JWT_SECRET=replace-with-a-long-random-secret-at-least-32-chars
JWT_EXPIRES_IN_HOURS=12
FRONTEND_ORIGIN=http://localhost:3000
RUST_LOG=info,tower_http=info
```

Jangan commit `.env` atau secret asli ke Git.

## C3. Config dan application state

**`backend/src/config.rs`**

```rust
use std::env;

#[derive(Clone)]
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

        let jwt_secret = env::var("JWT_SECRET")?;
        anyhow::ensure!(jwt_secret.len() >= 32, "JWT_SECRET minimal 32 karakter");

        Ok(Self {
            host: env::var("APP_HOST").unwrap_or_else(|_| "127.0.0.1".into()),
            port: env::var("APP_PORT").unwrap_or_else(|_| "8080".into()).parse()?,
            database_url: env::var("DATABASE_URL")?,
            jwt_secret,
            jwt_expires_in_hours: env::var("JWT_EXPIRES_IN_HOURS")
                .unwrap_or_else(|_| "12".into()).parse()?,
            frontend_origin: env::var("FRONTEND_ORIGIN")
                .unwrap_or_else(|_| "http://localhost:3000".into()),
        })
    }
}
```

**`backend/src/state.rs`**

```rust
use sqlx::PgPool;
use crate::config::Config;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub config: Config,
}
```

## C4. Error response konsisten

**`backend/src/error.rs`**

```rust
use axum::{http::StatusCode, response::{IntoResponse, Response}, Json};
use serde_json::json;

pub struct ApiError {
    pub status: StatusCode,
    pub message: String,
}

impl ApiError {
    pub fn new(status: StatusCode, message: impl Into<String>) -> Self {
        Self { status, message: message.into() }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.status, Json(json!({
            "success": false,
            "message": self.message
        }))).into_response()
    }
}

impl From<sqlx::Error> for ApiError {
    fn from(_: sqlx::Error) -> Self {
        Self::new(StatusCode::INTERNAL_SERVER_ERROR, "Terjadi kesalahan database")
    }
}
```

## C5. DTO dan handler autentikasi

**`backend/src/auth/dto.rs`**

```rust
use serde::{Deserialize, Serialize};
use validator::Validate;

#[derive(Debug, Deserialize, Validate)]
pub struct RegisterRequest {
    #[validate(length(min = 3, max = 160))]
    pub full_name: String,
    #[validate(email)]
    pub email: String,
    #[validate(length(min = 8, max = 128))]
    pub password: String,
    pub phone: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct LoginRequest {
    #[validate(email)]
    pub email: String,
    #[validate(length(min = 8, max = 128))]
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub access_token: String,
    pub token_type: &'static str,
    pub user_id: uuid::Uuid,
    pub role: String,
}
```

**`backend/src/auth/handler.rs`**

```rust
use axum::{extract::State, http::StatusCode, Json};
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use password_hash::{rand_core::OsRng, SaltString};
use jsonwebtoken::{encode, EncodingKey, Header};
use chrono::{Utc, Duration};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use validator::Validate;

use crate::{error::ApiError, state::AppState};
use super::dto::{AuthResponse, LoginRequest, RegisterRequest};

#[derive(Serialize, Deserialize)]
struct Claims {
    sub: String,
    role: String,
    exp: usize,
}

pub async fn register(
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    payload.validate().map_err(|_| ApiError::new(StatusCode::BAD_REQUEST, "Data registrasi tidak valid"))?;

    let salt = SaltString::generate(&mut OsRng);
    let password_hash = Argon2::default()
        .hash_password(payload.password.as_bytes(), &salt)
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Gagal memproses password"))?
        .to_string();

    let user = sqlx::query(
        r#"INSERT INTO users(full_name, email, phone, password_hash, role)
           VALUES ($1, $2, $3, $4, 'citizen')
           RETURNING id, full_name, email, role"#
    )
    .bind(payload.full_name)
    .bind(payload.email)
    .bind(payload.phone)
    .bind(password_hash)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(db) = &e {
            if db.code().as_deref() == Some("23505") {
                return ApiError::new(StatusCode::CONFLICT, "Email sudah terdaftar");
            }
        }
        ApiError::from(e)
    })?;

    Ok((StatusCode::CREATED, Json(serde_json::json!({
        "success": true,
        "data": {
            "id": user.get::<uuid::Uuid, _>("id"),
            "full_name": user.get::<String, _>("full_name"),
            "email": user.get::<String, _>("email"),
            "role": user.get::<String, _>("role")
        }
    }))))
}

pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, ApiError> {
    payload.validate().map_err(|_| ApiError::new(StatusCode::BAD_REQUEST, "Format login tidak valid"))?;

    let user = sqlx::query(
        "SELECT id, password_hash, role::text AS role FROM users WHERE email = $1 AND is_active = TRUE"
    )
    .bind(payload.email)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::new(StatusCode::UNAUTHORIZED, "Email atau password salah"))?;

    let hash: String = user.get("password_hash");
    let parsed_hash = PasswordHash::new(&hash)
        .map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Hash password tidak valid"))?;

    Argon2::default()
        .verify_password(payload.password.as_bytes(), &parsed_hash)
        .map_err(|_| ApiError::new(StatusCode::UNAUTHORIZED, "Email atau password salah"))?;

    let user_id: uuid::Uuid = user.get("id");
    let role: String = user.get("role");
    let expires = Utc::now() + Duration::hours(state.config.jwt_expires_in_hours);

    let token = encode(
        &Header::default(),
        &Claims {
            sub: user_id.to_string(),
            role: role.clone(),
            exp: expires.timestamp() as usize,
        },
        &EncodingKey::from_secret(state.config.jwt_secret.as_bytes()),
    ).map_err(|_| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Gagal membuat token"))?;

    Ok(Json(AuthResponse {
        access_token: token,
        token_type: "Bearer",
        user_id,
        role,
    }))
}
```

## C6. Middleware JWT

**`backend/src/auth/middleware.rs`**

```rust
use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
    http::{header::AUTHORIZATION, StatusCode},
};
use jsonwebtoken::{decode, DecodingKey, Validation};
use serde::{Deserialize, Serialize};

use crate::{error::ApiError, state::AppState};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AuthUser {
    pub sub: String,
    pub role: String,
    pub exp: usize,
}

pub async fn require_auth(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, ApiError> {
    let header = request.headers().get(AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| ApiError::new(StatusCode::UNAUTHORIZED, "Token tidak ditemukan"))?;

    let token = header.strip_prefix("Bearer ")
        .ok_or_else(|| ApiError::new(StatusCode::UNAUTHORIZED, "Format token harus Bearer"))?;

    let claims = decode::<AuthUser>(
        token,
        &DecodingKey::from_secret(state.config.jwt_secret.as_bytes()),
        &Validation::default(),
    ).map_err(|_| ApiError::new(StatusCode::UNAUTHORIZED, "Token tidak valid atau kedaluwarsa"))?
      .claims;

    request.extensions_mut().insert(claims);
    Ok(next.run(request).await)
}
```

> Untuk deployment internet, pertimbangkan refresh token dengan rotasi, logout/revocation, rate limiting login, verifikasi email/NIK melalui proses resmi, serta cookie `HttpOnly + Secure + SameSite` bila memakai browser session. Jangan mempercayai `role` yang dikirim frontend.

## C7. Pembuatan pengaduan dengan geo-tagging

**`backend/src/complaints/dto.rs`**

```rust
use serde::Deserialize;
use validator::Validate;

#[derive(Debug, Deserialize, Validate)]
pub struct CreateComplaintRequest {
    #[validate(length(min = 5, max = 180))]
    pub title: String,
    #[validate(length(min = 10, max = 5000))]
    pub description: String,
    pub category_id: Option<uuid::Uuid>,
    pub address_text: Option<String>,
    pub latitude: f64,
    pub longitude: f64,
    pub priority: Option<String>,
    pub visibility: Option<String>,
}
```

**`backend/src/complaints/handler.rs`**

```rust
use axum::{extract::State, http::StatusCode, Extension, Json};
use sqlx::Row;
use crate::{auth::middleware::AuthUser, error::ApiError, state::AppState};
use super::dto::CreateComplaintRequest;

pub async fn create_complaint(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Json(payload): Json<CreateComplaintRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    use validator::Validate;
    payload.validate().map_err(|_| ApiError::new(StatusCode::BAD_REQUEST, "Isi pengaduan tidak valid"))?;

    if !(-90.0..=90.0).contains(&payload.latitude)
        || !(-180.0..=180.0).contains(&payload.longitude) {
        return Err(ApiError::new(StatusCode::BAD_REQUEST, "Koordinat di luar rentang valid"));
    }

    let reporter_id = uuid::Uuid::parse_str(&user.sub)
        .map_err(|_| ApiError::new(StatusCode::UNAUTHORIZED, "Identitas token tidak valid"))?;

    let mut tx = state.db.begin().await?;

    // Nomor tiket menggunakan sequence agar aman terhadap request paralel.
    let ticket_seq: i64 = sqlx::query_scalar("SELECT nextval('complaint_ticket_seq')")
        .fetch_one(&mut *tx).await?;
    let ticket_no = format!("BL-{}-{:06}", chrono::Utc::now().format("%Y"), ticket_seq);

    let priority = payload.priority.as_deref().unwrap_or("medium");
    let visibility = payload.visibility.as_deref().unwrap_or("public");

    let row = sqlx::query(
        r#"INSERT INTO complaints
           (ticket_no, reporter_id, category_id, title, description, address_text,
            location, priority, visibility, current_status)
           VALUES ($1, $2, $3, $4, $5, $6,
             ST_SetSRID(ST_MakePoint($7, $8), 4326)::geography,
             $9::complaint_priority, $10::complaint_visibility, 'S01')
           RETURNING id, ticket_no, current_status::text AS status, submitted_at"#
    )
    .bind(ticket_no)
    .bind(reporter_id)
    .bind(payload.category_id)
    .bind(payload.title)
    .bind(payload.description)
    .bind(payload.address_text)
    .bind(payload.longitude)
    .bind(payload.latitude)
    .bind(priority)
    .bind(visibility)
    .fetch_one(&mut *tx).await?;

    let complaint_id: uuid::Uuid = row.get("id");

    sqlx::query(
        "INSERT INTO ticket_status_history(complaint_id, status, note, changed_by) VALUES ($1, 'S01', 'Laporan diterima sistem', $2)"
    )
    .bind(complaint_id)
    .bind(reporter_id)
    .execute(&mut *tx).await?;

    sqlx::query(
        "INSERT INTO audit_logs(actor_id, action, entity_type, entity_id) VALUES ($1, 'complaint.created', 'complaint', $2)"
    )
    .bind(reporter_id)
    .bind(complaint_id)
    .execute(&mut *tx).await?;

    tx.commit().await?;

    Ok((StatusCode::CREATED, Json(serde_json::json!({
        "success": true,
        "data": {
            "id": complaint_id,
            "ticket_no": row.get::<String, _>("ticket_no"),
            "status": row.get::<String, _>("status"),
            "submitted_at": row.get::<chrono::DateTime<chrono::Utc>, _>("submitted_at")
        }
    }))))
}
```

Tambahkan sequence berikut pada migrasi `0002_schema.sql` sebelum tabel `complaints`:

```sql
CREATE SEQUENCE complaint_ticket_seq START 1;
```

## C8. Pembaruan status tiket (admin/petugas)

**`backend/src/tickets/dto.rs`**

```rust
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct UpdateTicketStatusRequest {
    pub status: String,
    pub note: Option<String>,
    pub progress_percent: Option<i16>,
}
```

**`backend/src/tickets/handler.rs`**

```rust
use axum::{extract::{Path, State}, http::StatusCode, Extension, Json};
use sqlx::Row;
use crate::{auth::middleware::AuthUser, error::ApiError, state::AppState};
use super::dto::UpdateTicketStatusRequest;

pub async fn update_ticket_status(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(ticket_no): Path<String>,
    Json(payload): Json<UpdateTicketStatusRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    if !matches!(user.role.as_str(), "admin" | "officer") {
        return Err(ApiError::new(StatusCode::FORBIDDEN, "Hanya admin/petugas yang dapat memperbarui status"));
    }

    let allowed = ["S02", "S05", "S06", "S07", "S08", "S09"];
    if !allowed.contains(&payload.status.as_str()) {
        return Err(ApiError::new(StatusCode::BAD_REQUEST, "Tahap status tidak diizinkan untuk endpoint ini"));
    }

    if let Some(progress) = payload.progress_percent {
        if !(0..=100).contains(&progress) {
            return Err(ApiError::new(StatusCode::BAD_REQUEST, "Progress harus 0 sampai 100"));
        }
    }

    let actor_id = uuid::Uuid::parse_str(&user.sub)
        .map_err(|_| ApiError::new(StatusCode::UNAUTHORIZED, "Identitas token tidak valid"))?;

    let mut tx = state.db.begin().await?;

    let complaint = sqlx::query(
        "SELECT id, assigned_officer_id, assigned_agency_id FROM complaints WHERE ticket_no = $1 FOR UPDATE"
    )
    .bind(&ticket_no)
    .fetch_optional(&mut *tx).await?
    .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "Tiket tidak ditemukan"))?;

    let complaint_id: uuid::Uuid = complaint.get("id");

    // Petugas hanya boleh mengubah tiket yang ditugaskan kepadanya.
    if user.role == "officer" {
        let assigned: Option<uuid::Uuid> = complaint.get("assigned_officer_id");
        if assigned != Some(actor_id) {
            return Err(ApiError::new(StatusCode::FORBIDDEN, "Tiket bukan penugasan Anda"));
        }
    }

    sqlx::query(
        r#"UPDATE complaints
           SET current_status = $1::ticket_status,
               updated_at = NOW(),
               resolved_at = CASE WHEN $1 = 'S09' THEN NOW() ELSE resolved_at END
           WHERE id = $2"#
    )
    .bind(&payload.status)
    .bind(complaint_id)
    .execute(&mut *tx).await?;

    sqlx::query(
        r#"INSERT INTO ticket_status_history(complaint_id, status, note, progress_percent, changed_by)
           VALUES ($1, $2::ticket_status, $3, $4, $5)"#
    )
    .bind(complaint_id)
    .bind(&payload.status)
    .bind(&payload.note)
    .bind(payload.progress_percent)
    .bind(actor_id)
    .execute(&mut *tx).await?;

    sqlx::query(
        "INSERT INTO audit_logs(actor_id, action, entity_type, entity_id, metadata) VALUES ($1, 'ticket.status_updated', 'complaint', $2, jsonb_build_object('status', $3))"
    )
    .bind(actor_id)
    .bind(complaint_id)
    .bind(&payload.status)
    .execute(&mut *tx).await?;

    tx.commit().await?;

    Ok(Json(serde_json::json!({
        "success": true,
        "ticket_no": ticket_no,
        "current_status": payload.status
    })))
}
```

> Validasi transisi status perlu diperketat sebelum produksi (misalnya S01 → S02 → tahap disposisi → S06 → S07 → S08 → S09). Karena urutan S03/S04 belum dijelaskan dalam file desain, transisi final harus disahkan Pemda. Tambahkan juga pemeriksaan OPD, SLA, dan otorisasi per wilayah.

## C9. Router dan entry point

Buat modul `mod.rs` sederhana:

**`backend/src/auth/mod.rs`**
```rust
pub mod dto;
pub mod handler;
pub mod middleware;
```

**`backend/src/complaints/mod.rs`**
```rust
pub mod dto;
pub mod handler;
```

**`backend/src/tickets/mod.rs`**
```rust
pub mod dto;
pub mod handler;
```

**`backend/src/main.rs`**
```rust
mod auth;
mod complaints;
mod config;
mod error;
mod state;
mod tickets;

use axum::{middleware, routing::{get, post, patch}, Router};
use sqlx::postgres::PgPoolOptions;
use std::net::SocketAddr;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::from_default_env())
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = config::Config::from_env()?;
    let db = PgPoolOptions::new()
        .max_connections(20)
        .connect(&config.database_url)
        .await?;

    sqlx::migrate!("./migrations").run(&db).await?;

    let state = AppState { db, config: config.clone() };

    let public_routes = Router::new()
        .route("/health", get(|| async { "SPCS API OK" }))
        .route("/api/v1/auth/register", post(auth::handler::register))
        .route("/api/v1/auth/login", post(auth::handler::login));

    let protected_routes = Router::new()
        .route("/api/v1/complaints", post(complaints::handler::create_complaint))
        .route("/api/v1/tickets/:ticket_no/status", patch(tickets::handler::update_ticket_status))
        .layer(middleware::from_fn_with_state(state.clone(), auth::middleware::require_auth));

    let app = Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .layer(CorsLayer::new()
            .allow_origin(config.frontend_origin.parse::<axum::http::HeaderValue>()?)
            .allow_methods([axum::http::Method::GET, axum::http::Method::POST, axum::http::Method::PATCH])
            .allow_headers([axum::http::header::AUTHORIZATION, axum::http::header::CONTENT_TYPE]))
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let address = SocketAddr::new(config.host.parse()?, config.port);
    let listener = tokio::net::TcpListener::bind(address).await?;
    tracing::info!("SPCS API listening on {}", address);
    axum::serve(listener, app).await?;

    Ok(())
}
```

---

# BAGIAN D — KONTRAK API

Base URL lokal: `http://localhost:8080/api/v1`

| Method | Endpoint | Auth | Tujuan |
|---|---|---|---|
| POST | `/auth/register` | Tidak | Registrasi warga |
| POST | `/auth/login` | Tidak | Login dan menerima access token |
| POST | `/complaints` | Bearer | Membuat pengaduan + koordinat |
| PATCH | `/tickets/{ticket_no}/status` | Admin/Petugas | Memperbarui tahap tiket |
| GET | `/tickets/{ticket_no}` | Public/opsional | Detail dan status tiket |
| GET | `/tickets/{ticket_no}/history` | Public/opsional | Timeline S01–S09 |
| GET | `/tickets/{ticket_no}/events` | Public/opsional | Live update via SSE |
| GET | `/officer/tasks` | Petugas | Daftar penugasan petugas |
| POST | `/tickets/{ticket_no}/assign` | Admin | Menugaskan OPD/petugas |
| POST | `/tickets/{ticket_no}/attachments` | Bearer | Unggah foto bukti |
| POST | `/tickets/{ticket_no}/feedback` | Warga | Rating dan ulasan setelah selesai |

Empat endpoint terakhir adalah kontrak lanjutan yang perlu ditambahkan handler-nya sebelum fitur tersebut dianggap aktif. Jangan tampilkan tombol UI seolah-olah berfungsi jika endpoint belum tersedia.

### Contoh request membuat pengaduan

```http
POST /api/v1/complaints
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{
  "title": "Jalan berlubang membahayakan pengendara",
  "description": "Lubang cukup dalam pada lajur kiri dan berisiko bagi pengendara motor.",
  "category_id": null,
  "address_text": "Jl. ZA. Pagar Alam, Labuhan Ratu, Bandar Lampung",
  "latitude": -5.37894,
  "longitude": 105.25192,
  "priority": "high",
  "visibility": "public"
}
```

### Contoh request update status

```http
PATCH /api/v1/tickets/BL-2026-000001/status
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{
  "status": "S07",
  "note": "Petugas tiba di lokasi dan memulai penanganan teknis.",
  "progress_percent": 65
}
```

---

# BAGIAN E — FRONTEND NEXT.JS + TAILWIND

## E1. Setup

```bash
npx create-next-app@latest frontend --typescript --tailwind --eslint --app
cd frontend
```

**`frontend/.env.local.example`**
```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
NEXT_PUBLIC_PEMDA_LOGO=/images/logo-pemda.png
NEXT_PUBLIC_UTI_LOGO=/images/logo-uti.png
```

Tempatkan logo resmi di `frontend/public/images/`. Jika belum tersedia, komponen menggunakan placeholder berlabel; jangan mengambil logo sembarang dari internet.

## E2. Design tokens sesuai Google Stitch

Tambahkan ke `frontend/app/globals.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined');

:root {
  --spcs-primary: #00417b;
  --spcs-primary-container: #0d59a1;
  --spcs-secondary-container: #feae2c;
  --spcs-tertiary-container: #b1121b;
  --spcs-background: #f9f9ff;
  --spcs-surface: #ffffff;
  --spcs-surface-low: #f0f3ff;
  --spcs-outline: #727782;
  --spcs-outline-variant: #c2c6d2;
  --spcs-text: #111c2c;
}

* { box-sizing: border-box; }
html, body { min-height: 100%; }
body {
  margin: 0;
  background: var(--spcs-background);
  color: var(--spcs-text);
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}
.material-symbols-outlined {
  font-family: 'Material Symbols Outlined';
  font-weight: normal;
  font-style: normal;
  line-height: 1;
  display: inline-block;
  white-space: nowrap;
}
.spcs-card {
  background: var(--spcs-surface);
  border: 1px solid var(--spcs-outline-variant);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgb(17 28 44 / 6%);
}
```

## E3. Header dua logo institusi

**`frontend/components/brand-header.tsx`**

```tsx
import Image from "next/image";

type LogoProps = { src?: string; alt: string; fallback: string };

function InstitutionalLogo({ src, alt, fallback }: LogoProps) {
  if (src) {
    return (
      <div className="relative h-10 w-10 shrink-0">
        <Image src={src} alt={alt} fill className="object-contain" sizes="40px" />
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={alt}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-slate-50 text-[9px] font-bold text-[#00417b]"
    >
      {fallback}
    </div>
  );
}

export function BrandHeader({ subtitle = "Sistem Pengaduan Publik Cerdas" }: { subtitle?: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex items-center gap-2">
            <InstitutionalLogo
              src={process.env.NEXT_PUBLIC_PEMDA_LOGO}
              alt="Logo Pemerintah Kota Bandar Lampung"
              fallback="PEMDA"
            />
            <span className="h-8 w-px bg-slate-300" />
            <InstitutionalLogo
              src={process.env.NEXT_PUBLIC_UTI_LOGO}
              alt="Logo Universitas Teknokrat Indonesia"
              fallback="UTI"
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#00417b]">SPCS Bandar Lampung</p>
            <p className="truncate text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>
        <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 sm:inline-flex">
          Sistem Aktif
        </span>
      </div>
    </header>
  );
}
```

## E4. Footer wajib pada seluruh halaman

**`frontend/components/app-footer.tsx`**

```tsx
export function AppFooter() {
  return (
    <footer className="mt-10 border-t border-slate-200 bg-white px-4 py-6 text-center">
      <p className="text-xs text-slate-500">
        Copyright©2026 by Rafi Naufal Arsi dan Dr. Erliyan Redy Susanto, M.Kom
      </p>
    </footer>
  );
}
```

## E5. Status badge

**`frontend/components/status-badge.tsx`**

```tsx
const statusLabels: Record<string, string> = {
  S01: "Terkirim ke Sistem",
  S02: "Pemeriksaan Admin",
  S05: "Validasi Dinas",
  S06: "Baru Ditugaskan",
  S07: "Penanganan Teknis Lapangan",
  S08: "Menunggu Konfirmasi",
  S09: "Selesai & Diarsipkan",
};

const styles: Record<string, string> = {
  S01: "bg-blue-50 text-blue-800 border-blue-200",
  S02: "bg-sky-50 text-sky-800 border-sky-200",
  S05: "bg-indigo-50 text-indigo-800 border-indigo-200",
  S06: "bg-blue-50 text-blue-900 border-blue-200",
  S07: "bg-amber-50 text-amber-900 border-amber-300",
  S08: "bg-emerald-50 text-emerald-800 border-emerald-200",
  S09: "bg-slate-100 text-slate-700 border-slate-300",
};

export function StatusBadge({ status }: { status: string }) {
  const label = statusLabels[status] ?? `${status} · Tahap belum dikonfigurasi`;
  const style = styles[status] ?? "bg-slate-100 text-slate-700 border-slate-300";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${style}`}>
      {status} · {label}
    </span>
  );
}
```

## E6. API client

**`frontend/lib/api.ts`**

```tsx
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api/v1";

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message ?? `Request gagal (${response.status})`);
  }

  return payload as T;
}
```

## E7. Layout global

**`frontend/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { BrandHeader } from "@/components/brand-header";
import { AppFooter } from "@/components/app-footer";

export const metadata: Metadata = {
  title: "SPCS Bandar Lampung",
  description: "Sistem Pelaporan Pengaduan Cerdas Kota Bandar Lampung",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>
        <BrandHeader />
        <main className="mx-auto min-h-[70vh] w-full max-w-7xl px-4 py-6">{children}</main>
        <AppFooter />
      </body>
    </html>
  );
}
```

## E8. Beranda warga — kategori dan ringkasan pengaduan

**`frontend/app/page.tsx`**

```tsx
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";

const categories = [
  ["Jalan Rusak", "road"],
  ["PJU Mati", "lightbulb"],
  ["Drainase", "water"],
  ["Sampah Liar", "delete"],
  ["Fasilitas Publik", "apartment"],
  ["Lainnya", "more_horiz"],
];

const sampleTickets = [
  {
    no: "BL-2026-0842",
    title: "Jalan Berlubang Dalam Membahayakan Pengendara",
    address: "Jl. ZA. Pagar Alam, Labuhan Ratu",
    status: "S07",
  },
  {
    no: "BL-2026-0790",
    title: "Lampu PJU Padam di Jl. Teuku Umar",
    address: "Kedaton, Bandar Lampung",
    status: "S08",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-r from-[#00417b] to-[#0d59a1] p-6 text-white">
        <p className="text-sm text-blue-100">Portal Layanan Publik Kota Bandar Lampung</p>
        <h1 className="mt-2 text-2xl font-bold">Suara Anda, Perubahan Kota Kita.</h1>
        <p className="mt-2 max-w-2xl text-sm text-blue-100">
          Laporkan permasalahan fasilitas publik dan pantau proses penanganannya secara transparan.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/pengaduan/baru" className="rounded-lg bg-[#feae2c] px-4 py-2.5 text-sm font-bold text-slate-900">
            + Buat Pengaduan Baru
          </Link>
          <Link href="/lacak" className="rounded-lg border border-white/50 px-4 py-2.5 text-sm font-semibold text-white">
            Lacak Tiket
          </Link>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#00417b]">Kategori Pengaduan</h2>
          <span className="text-xs text-slate-500">Pilih kategori laporan</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {categories.map(([name, icon]) => (
            <Link key={name} href="/pengaduan/baru" className="spcs-card p-4 transition hover:-translate-y-0.5 hover:border-[#00417b]">
              <span className="material-symbols-outlined text-2xl text-[#00417b]">{icon}</span>
              <p className="mt-2 text-sm font-semibold">{name}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-[#00417b]">Aktivitas Pengaduan Saya</h2>
        {sampleTickets.map((ticket) => (
          <article key={ticket.no} className="spcs-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-sm font-bold text-[#00417b]">#{ticket.no}</p>
              <StatusBadge status={ticket.status} />
            </div>
            <h3 className="mt-3 font-semibold">{ticket.title}</h3>
            <p className="mt-1 text-sm text-slate-500">{ticket.address}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
```

> Data di atas hanya mock data agar layout dapat dirender. Ganti dengan data API setelah endpoint daftar pengaduan dan otorisasi warga selesai dibuat.

## E9. Form pengaduan dengan geolocation browser

**`frontend/app/pengaduan/baru/page.tsx`**

```tsx
"use client";

import { FormEvent, useState } from "react";
import { apiRequest } from "@/lib/api";

export default function NewComplaintPage() {
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setMessage("Browser tidak mendukung geolocation.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLatitude(String(coords.latitude));
        setLongitude(String(coords.longitude));
        setMessage("Lokasi berhasil diambil.");
      },
      () => setMessage("Lokasi tidak dapat diakses. Periksa izin GPS browser."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const form = new FormData(event.currentTarget);
    const token = localStorage.getItem("spcs_access_token");

    try {
      const result = await apiRequest<{ data: { ticket_no: string } }>(
        "/complaints",
        {
          method: "POST",
          body: JSON.stringify({
            title: form.get("title"),
            description: form.get("description"),
            address_text: form.get("address_text"),
            latitude: Number(latitude),
            longitude: Number(longitude),
            priority: form.get("priority"),
            visibility: form.get("visibility"),
          }),
        },
        token ?? undefined,
      );
      setMessage(`Pengaduan terkirim. Nomor tiket: ${result.data.ticket_no}`);
      event.currentTarget.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal mengirim pengaduan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl">
      <div className="mb-5">
        <p className="text-sm font-semibold text-[#00417b]">Formulir Pengaduan Cerdas</p>
        <h1 className="text-2xl font-bold">Buat Pengaduan Baru</h1>
        <p className="mt-1 text-sm text-slate-500">Jelaskan masalah dan tandai titik lokasi yang tepat.</p>
      </div>

      <form onSubmit={handleSubmit} className="spcs-card space-y-4 p-5">
        <label className="block text-sm font-semibold">
          Judul Pengaduan
          <input name="title" required minLength={5} maxLength={180}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
        </label>

        <label className="block text-sm font-semibold">
          Keterangan Lengkap
          <textarea name="description" required minLength={10} rows={5}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
        </label>

        <label className="block text-sm font-semibold">
          Alamat / Patokan Lokasi
          <input name="address_text"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
        </label>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">Titik Geolokasi</p>
            <button type="button" onClick={useCurrentLocation}
              className="rounded-lg bg-[#00417b] px-3 py-2 text-xs font-semibold text-white">
              Ambil Lokasi GPS
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input aria-label="Latitude" readOnly value={latitude} placeholder="Latitude"
              className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm" />
            <input aria-label="Longitude" readOnly value={longitude} placeholder="Longitude"
              className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Prioritas
            <select name="priority" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal">
              <option value="low">Rendah</option>
              <option value="medium" selected>Sedang</option>
              <option value="high">Tinggi</option>
              <option value="urgent">Mendesak</option>
            </select>
          </label>
          <label className="text-sm font-semibold">
            Privasi Pelapor
            <select name="visibility" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal">
              <option value="public">Publik</option>
              <option value="private">Privat</option>
              <option value="anonymous">Anonim</option>
            </select>
          </label>
        </div>

        <p className="text-xs text-slate-500">
          Lampiran foto: UI upload disiapkan sebagai tahap integrasi berikutnya; file harus divalidasi di server dan disimpan di object storage.
        </p>

        <button disabled={loading || !latitude || !longitude}
          className="w-full rounded-lg bg-[#00417b] px-4 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {loading ? "Mengirim..." : "Kirim Pengaduan"}
        </button>
        {message && <p role="status" className="text-sm text-[#00417b]">{message}</p>}
      </form>
    </section>
  );
}
```

Catatan: `localStorage` pada contoh hanya untuk memudahkan prototipe. Untuk produksi, pindahkan token ke cookie `HttpOnly; Secure; SameSite=Lax` dan buat route handler/BFF agar JavaScript browser tidak membaca token.

## E10. Halaman pelacakan (kerangka)

**`frontend/app/lacak/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/status-badge";

type Ticket = {
  ticket_no: string;
  title: string;
  current_status: string;
  address_text?: string;
  history?: { status: string; note?: string; created_at: string }[];
};

export default function TrackingPage() {
  const [ticketNo, setTicketNo] = useState("");
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState("");

  async function track() {
    setError("");
    setTicket(null);
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL;
      const response = await fetch(`${base}/tickets/${encodeURIComponent(ticketNo)}`);
      if (!response.ok) throw new Error("Nomor tiket tidak ditemukan.");
      const result = await response.json();
      setTicket(result.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal melacak tiket.");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <section className="spcs-card p-4">
        <label htmlFor="ticket" className="text-sm font-semibold">Nomor Registrasi Pengaduan</label>
        <div className="mt-2 flex gap-2">
          <input id="ticket" value={ticketNo} onChange={(e) => setTicketNo(e.target.value)}
            placeholder="Contoh: BL-2026-000001"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 font-mono" />
          <button onClick={track} className="rounded-lg bg-[#00417b] px-4 py-2 font-semibold text-white">Lacak</button>
        </div>
      </section>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {ticket && (
        <section className="spcs-card space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs text-slate-500">ID Tiket SPCS</p>
              <h1 className="font-mono text-lg font-bold text-[#00417b]">#{ticket.ticket_no}</h1>
            </div>
            <StatusBadge status={ticket.current_status} />
          </div>
          <h2 className="font-semibold">{ticket.title}</h2>
          <p className="text-sm text-slate-500">{ticket.address_text}</p>
          <h3 className="border-t pt-3 font-bold">Tahapan Penanganan</h3>
          <ol className="space-y-3 border-l-2 border-blue-200 pl-4">
            {(ticket.history ?? []).map((item, index) => (
              <li key={`${item.status}-${index}`}>
                <p className="text-sm font-semibold text-[#00417b]">{item.status}</p>
                <p className="text-sm text-slate-600">{item.note}</p>
                <time className="text-xs text-slate-400">{new Date(item.created_at).toLocaleString("id-ID")}</time>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
```

Endpoint `GET /tickets/:ticket_no` dan `/history` perlu dibuat sebelum halaman tracking dapat mengambil data nyata. Struktur timeline mengikuti pola visual S01–S09 dari desain Stitch.

## E11. Portal petugas — daftar tugas (UI starter)

**`frontend/app/petugas/tugas/page.tsx`**

```tsx
import { StatusBadge } from "@/components/status-badge";

const demoTasks = [
  {
    ticket_no: "BL-2026-0842",
    title: "Jalan Berlubang Dalam Membahayakan Pengendara",
    address: "Jl. ZA. Pagar Alam, Labuhan Ratu",
    priority: "Tinggi (Urgent)",
    status: "S07",
  },
  {
    ticket_no: "BL-2026-0850",
    title: "Lampu Penerangan Jalan Umum Padam di Perempatan",
    address: "Jl. Teuku Umar No. 45, Kedaton",
    priority: "Sedang",
    status: "S06",
  },
  {
    ticket_no: "BL-2026-0831",
    title: "Saluran Air Tersumbat Sampah Pasca Hujan",
    address: "Jl. Raden Intan, Enggal",
    priority: "Selesai Pengerjaan",
    status: "S08",
  },
];

export default function OfficerTasksPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <section className="spcs-card p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Portal Petugas Lapangan</p>
        <h1 className="mt-1 text-2xl font-bold text-[#00417b]">Daftar Tugas</h1>
        <p className="mt-1 text-sm text-slate-500">Pantau penugasan, prioritas, lokasi, dan status penanganan.</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Tugas Baru", "3"],
            ["Sedang Dikerjakan", "2"],
            ["Selesai Hari Ini", "5"],
            ["Respons Rata-rata", "42 m"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-[#f0f3ff] p-3">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="mt-1 text-xl font-bold text-[#00417b]">{value}</p>
            </div>
          ))}
        </div>
      </section>

      {demoTasks.map((task) => (
        <article key={task.ticket_no} className="spcs-card space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-sm font-bold text-[#00417b]">#{task.ticket_no}</span>
            <StatusBadge status={task.status} />
          </div>
          <h2 className="font-bold">{task.title}</h2>
          <p className="text-sm text-slate-600">{task.address}</p>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <span className="text-xs font-semibold text-amber-800">Prioritas: {task.priority}</span>
            <button className="rounded-lg bg-[#00417b] px-3 py-2 text-xs font-semibold text-white">
              Buka Detail Tugas
            </button>
          </div>
        </article>
      ))}
      <p className="text-xs text-slate-500">
        Kartu di atas adalah data demo yang mengikuti contoh desain. Hubungkan ke GET /officer/tasks dan endpoint assignment sebelum dipakai operasional.
      </p>
    </div>
  );
}
```

---

# BAGIAN F — PETA GIS, BUKTI FOTO, DAN LIVE STATUS

Fitur yang tergambar pada desain Google Stitch:
- Peta sebaran masalah Kota Bandar Lampung dengan filter kategori/prioritas, layer GIS, marker, cluster, dan bottom sheet detail tiket.
- Peta rute penanganan petugas, indikator GPS, jalur navigasi, dan tujuan tiket mendesak.
- Foto awal warga dibanding foto progres/hasil petugas.
- Timeline status S01–S09 dan indikator SLA.
- Notifikasi warga, panel komunikasi/tanggapan, dan penilaian setelah penyelesaian.

Implementasikan bertahap:
1. Peta: Leaflet/MapLibre + endpoint daftar tiket berkoordinat. Jangan mengirim identitas pelapor ke endpoint publik.
2. Foto: endpoint multipart, validasi MIME berdasarkan isi file, batas ukuran, random object key, antivirus bila tersedia, dan URL signed untuk akses privat.
3. Live status: SSE untuk mengirim event perubahan status. Server perlu melakukan autentikasi/otorisasi serta membatasi tiket yang boleh diikuti.
4. Rute: gunakan provider routing yang disetujui; jangan menghitung jarak/rute hanya dari garis lurus.
5. SLA: simpan `sla_due_at` dan hitung status terlambat di backend; angka pada mockup bukan nilai SLA final.

---

# BAGIAN G — MENJALANKAN DI ANTIGRAVITY

## G1. Siapkan PostgreSQL

Pastikan PostgreSQL sudah terpasang dan extension PostGIS tersedia. Buat database dan user khusus:

```sql
CREATE USER spcs_user WITH PASSWORD 'ganti_password_ini';
CREATE DATABASE spcs OWNER spcs_user;
```

Aktifkan PostGIS pada database `spcs`:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

## G2. Jalankan backend

```bash
cd backend
cp .env.example .env
# Edit DATABASE_URL dan JWT_SECRET
cargo install sqlx-cli --no-default-features --features postgres,rustls
sqlx migrate run
cargo run
```

Tes health:
```bash
curl http://localhost:8080/health
```

## G3. Jalankan frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Buka `http://localhost:3000`.

## G4. Smoke test API

Registrasi:
```bash
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"full_name":"Warga Demo","email":"warga@example.test","password":"PasswordAman123"}'
```

Login:
```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"warga@example.test","password":"PasswordAman123"}'
```

Gunakan token dari response login untuk mengirim pengaduan:
```bash
curl -X POST http://localhost:8080/api/v1/complaints \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Jalan berlubang","description":"Terdapat lubang di badan jalan dan berbahaya.","latitude":-5.37894,"longitude":105.25192,"priority":"high","visibility":"public"}'
```

---

# BAGIAN H — CHECKLIST SEBELUM DEMO / PRODUKSI

- [ ] Buat akun admin melalui proses bootstrap yang aman; jangan izinkan registrasi publik memilih role admin.
- [ ] Tambahkan endpoint GET detail tiket, riwayat status, daftar pengaduan, penugasan petugas, dan dashboard admin.
- [ ] Terapkan policy transisi status S01–S09 yang disahkan Pemda; lengkapi definisi S03/S04.
- [ ] Pastikan petugas hanya dapat membaca/mengubah tiket yang ditugaskan kepadanya.
- [ ] Pastikan warga hanya dapat melihat data pribadi dan laporan yang menjadi hak aksesnya.
- [ ] Terapkan verifikasi NIK melalui mekanisme resmi; jangan menyimpan NIK mentah bila tidak diperlukan.
- [ ] Tambahkan upload foto, validasi file, object storage, dan bukti sebelum/sesudah.
- [ ] Tambahkan rate limiting, CSRF protection bila memakai cookie, security headers, dan audit log.
- [ ] Tambahkan test unit, integration test database, test otorisasi, dan test alur status.
- [ ] Terapkan backup/restore PostgreSQL dan observability (tracing, metrics, alert).
- [ ] Ganti seluruh data demo/mock dengan API.
- [ ] Masukkan logo resmi Pemda dan Universitas Teknokrat Indonesia ke `public/images/`.
- [ ] Pastikan footer hak cipta muncul pada seluruh halaman dan breakpoint mobile/desktop.
- [ ] Verifikasi kontras warna, aksesibilitas form, label input, keyboard navigation, dan responsive layout.

## Batasan scaffold ini

Kode di atas menyediakan fondasi API register/login, membuat pengaduan dengan titik PostGIS, dan update status tiket dengan role guard dasar. Ini belum merupakan sistem produksi lengkap: endpoint listing/detail/SSE/upload/assignment/dashboard/feedback, validasi transisi lengkap, integrasi penyimpanan foto, refresh token, serta pengujian menyeluruh masih perlu dikerjakan. Bagian UI yang memakai `demoTasks` atau `sampleTickets` sengaja ditandai sebagai mock data.

---

## Prompt kerja bertahap untuk Antigravity

Gunakan prompt berikut satu per satu agar perubahan mudah direview:

1. **Database:** “Baca SPCS.md Bagian B. Implementasikan migration SQL ke backend/migrations, jalankan pada PostgreSQL lokal dengan PostGIS, dan perbaiki error migrasi tanpa mengubah definisi status yang belum disepakati.”
2. **Backend auth:** “Implementasikan Bagian C1–C6. Pastikan password Argon2id, JWT validation, error response konsisten, dan role tidak dapat dipilih melalui payload registrasi.”
3. **Complaint API:** “Implementasikan Bagian C7 dengan validasi koordinat, transaksi SQL, ticket number unik, status history S01, dan audit log.”
4. **Ticket workflow:** “Implementasikan Bagian C8 dan tambahkan test otorisasi petugas. Jangan mengarang label S03/S04; buat konfigurasi tahap agar admin sistem dapat melengkapinya.”
5. **Branding/UI:** “Implementasikan Bagian E. Pertahankan warna, font Inter, dual-logo header, layout card, status badge, dan footer copyright persis seperti SPCS.md.”
6. **Integrasi:** “Hubungkan form warga dan tracking ke API nyata. Hapus mock data hanya setelah endpoint yang diperlukan tersedia dan lolos test.”

