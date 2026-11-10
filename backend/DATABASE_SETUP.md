# Panduan Konfigurasi Database SPCS (PostgreSQL + PostGIS)

Dokumen ini menjelaskan langkah-langkah menyiapkan basis data **Smart Public Complaint System (SPCS)** menggunakan PostgreSQL dan ekstensi PostGIS.

---

## 1. Persyaratan Lingkungan
- **PostgreSQL 14+**
- **Ekstensi PostGIS 3.0+**
- **SQLx CLI** (`cargo install sqlx-cli --no-default-features --features postgres,rustls`)

---

## 2. Pembuatan Database & User

Jalankan perintah SQL berikut di console PostgreSQL (`psql` atau pgAdmin) dengan user administratif:

```sql
-- 1. Buat user khusus aplikasi
CREATE USER spcs_user WITH PASSWORD 'ganti_password_ini';

-- 2. Buat database SPCS dengan owner user tersebut
CREATE DATABASE spcs OWNER spcs_user;

-- 3. Beri hak akses
GRANT ALL PRIVILEGES ON DATABASE spcs TO spcs_user;
```

---

## 3. Eksekusi Migrasi

### Opsi A: Menggunakan SQLx CLI (Direkomendasikan)
Masuk ke direktori `backend/`:
```bash
cd backend
cp .env.example .env
# Sesuaikan DATABASE_URL di dalam file .env
sqlx migrate run
```

### Opsi B: Menggunakan psql Manual
Jika menjalankan manual via terminal:
```bash
psql -U spcs_user -d spcs -f migrations/0001_extensions.sql
psql -U spcs_user -d spcs -f migrations/0002_schema.sql
psql -U spcs_user -d spcs -f migrations/0003_seed_reference.sql
```

---

## 4. Validasi Struktur & Query Geospasial PostGIS

Setelah migrasi selesai, uji fungsi PostGIS dan struktur tabel:

```sql
-- 1. Cek ekstensi
SELECT extname, extversion FROM pg_extension WHERE extname IN ('postgis', 'pgcrypto');

-- 2. Uji insert koordinat (Kota Bandar Lampung: Lat -5.37894, Long 105.25192)
-- Catatan: PostGIS MakePoint menggunakan format (longitude, latitude)
SELECT ST_AsText(ST_SetSRID(ST_MakePoint(105.25192, -5.37894), 4326)::geography);

-- 3. Uji query jarak (Radius 2 KM)
SELECT ST_DWithin(
  ST_SetSRID(ST_MakePoint(105.25192, -5.37894), 4326)::geography,
  ST_SetSRID(ST_MakePoint(105.25300, -5.37900), 4326)::geography,
  2000
);
```

