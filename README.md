# Smart Public Complaint System (SPCS) — Kota Bandar Lampung

Aplikasi pelaporan dan penanganan pengaduan masyarakat berbasis web cerdas (mobile-responsive / PWA) yang terintegrasi secara transparan, akurat dengan geolokasi PostGIS, dan akuntabel.

---

## 1. Arsitektur & Teknologi

* **Backend:** Rust, Axum 0.7, Tokio (Asynchronous Runtime), SQLx 0.8, Tower-HTTP, Serde.
* **Database:** PostgreSQL 14+ dengan ekstensi **PostGIS** (`geography(Point, 4326)`) dan `pgcrypto`.
* **Keamanan:** Password Hashing **Argon2id**, Autentikasi Stateless **JWT (HS256)**, Role-Based Access Control (RBAC).
* **Frontend:** Next.js (App Router), React 18, TypeScript, Tailwind CSS, Google Stitch Design Tokens, Material Symbols Outlined, Font Inter.
* **Komunikasi:** REST API JSON terstandarisasi + Static File Serving untuk bukti foto.

---

## 2. Akun Demo untuk Pengujian Cepat

Sistem telah dilengkapi data seed akun awal (Password: `Password123!`):

| Role | Email | Password | Hak Akses |
|---|---|---|---|
| **Admin Dinas** | `admin@bandarlampung.go.id` | `Password123!` | Dashboard Admin, Verifikasi Laporan, Disposisi Dinas & Penugasan Petugas |
| **Petugas Lapangan** | `petugas@bandarlampung.go.id` | `Password123!` | Portal Tugas, Rute Navigasi Google Maps, Update Progres & Bukti Penyelesaian |
| **Warga Pelapor** | `warga@example.test` | `Password123!` | Buat Pengaduan GPS, Laporan Saya, Pelacakan Real-time, Rating & Ulasan |

---

## 3. Langkah Menjalankan Aplikasi Secara Lokal

### A. Persiapan Database (PostgreSQL + PostGIS)
1. Pastikan PostgreSQL dan PostGIS sudah terpasang dan berjalan di komputer Anda.
2. Buka console database (`psql` / pgAdmin) dan buat database:
   ```sql
   CREATE USER spcs_user WITH PASSWORD 'change_me';
   CREATE DATABASE spcs OWNER spcs_user;
   GRANT ALL PRIVILEGES ON DATABASE spcs TO spcs_user;
   ```
3. Aktifkan ekstensi dan jalankan migrasi database:
   ```bash
   cd backend
   cp .env.example .env
   # Sesuaikan DATABASE_URL di file .env jika username/password berbeda
   ```
   *Migrasi database akan otomatis dieksekusi oleh backend saat startup (`sqlx::migrate!("./migrations").run(&db)`).*

### B. Menjalankan Backend Rust
1. Masuk ke direktori backend:
   ```bash
   cd backend
   ```
2. Jalankan pemeriksaan sintaks dan unit test:
   ```bash
   cargo test
   ```
3. Jalankan server Axum:
   ```bash
   cargo run
   ```
   *Server backend akan aktif di `http://127.0.0.1:8080`.*
   *Health check: `http://127.0.0.1:8080/health`.*
   *Static uploads: `http://127.0.0.1:8080/uploads/`.*

### C. Menjalankan Frontend Next.js
1. Buka terminal baru dan masuk ke direktori frontend:
   ```bash
   cd frontend
   ```
2. Salin environment konfigurasi:
   ```bash
   cp .env.local.example .env.local
   ```
3. Install dependensi dan jalankan server pengembangan:
   ```bash
   npm install
   npm run dev
   ```
4. Buka peramban (browser) di `http://localhost:3000`.

---

## 4. Alur Kerja Pengguna (User Workflow)

1. **Warga / Pelapor (`citizen`):**
   * Masuk ke `http://localhost:3000/auth/login` menggunakan akun `warga@example.test` atau daftar baru.
   * Klik **"Buat Pengaduan Baru"** di `/pengaduan/baru`, ambil titik lokasi via tombol **GPS**, unggah foto bukti, lalu kirim.
   * Dapatkan nomor tiket resmi (contoh: `BL-2026-000001`) dan pantau status di `/pengaduan/saya` atau `/lacak`.
2. **Admin Dinas (`admin`):**
   * Login dengan `admin@bandarlampung.go.id`.
   * Masuk ke `/admin/dashboard` untuk meninjau laporan yang masuk.
   * Klik **"Disposisi"** untuk menugaskan pengaduan ke dinas terkait (PUPR/Dishub/DLH) dan memilih petugas lapangan. Status otomatis berubah menjadi `S06` (*Baru Ditugaskan*).
3. **Petugas Lapangan (`officer`):**
   * Login dengan `petugas@bandarlampung.go.id`.
   * Masuk ke `/petugas/tugas` untuk melihat daftar tugas yang diurutkan berdasarkan urgensi.
   * Klik tombol **"Rute Navigasi"** untuk membuka Google Maps ke titik koordinat masalah.
   * Klik **"Perbarui Progres & Status"** untuk memperbarui slider persentase fisik dan mengunggah foto penyelesaian (berpindah ke status `S07` lalu `S08`).
4. **Penyelesaian & Feedback Warga:**
   * Warga membuka tiket di `/lacak?no=BL-2026-000001`.
   * Warga melihat foto bukti penyelesaian dan timeline riwayat pengerjaan.
   * Form evaluasi bintang 1–5 aktif; warga memberikan rating dan ulasan kepuasan untuk mengarsipkan tiket (`S09`).

---

## 5. Aturan Hak Cipta & Branding

Header aplikasi menampilkan dua placeholder/aset logo institusional:
* Logo Pemerintah Daerah Kota Bandar Lampung
* Logo Universitas Teknokrat Indonesia

Seluruh halaman aplikasi menampilkan footer resmi:

```text
Copyright©2026 by Rafi Naufal Arsi dan Dr. Erliyan Redy Susanto, M.Kom
```
