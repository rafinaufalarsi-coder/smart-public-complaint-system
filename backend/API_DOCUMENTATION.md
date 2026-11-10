# Dokumentasi REST API — Smart Public Complaint System (SPCS)

Base URL: `http://localhost:8080/api/v1`
Static Uploads: `http://localhost:8080/uploads`

---

## 1. Akun Default untuk Pengujian (Seed Demo)

| Role | Email | Password | Keterangan |
|---|---|---|---|
| **Admin Dinas** | `admin@bandarlampung.go.id` | `Password123!` | Administrator Dinas PUPR (Hak verifikasi & disposisi) |
| **Petugas Lapangan** | `petugas@bandarlampung.go.id` | `Password123!` | Petugas Lapangan Dinas PUPR (Menerima tugas & update progres) |
| **Warga Pelapor** | `warga@example.test` | `Password123!` | Warga terdaftar (Membuat laporan & melacak) |

---

## 2. Format Respons Standar

### Berhasil (Success)
```json
{
  "success": true,
  "message": "Deskripsi pesan opsional",
  "data": { ... }
}
```

### Gagal (Error)
```json
{
  "success": false,
  "message": "Pesan kesalahan deskriptif",
  "details": { ... }
}
```

---

## 3. Modul Autentikasi

### 3.1 Registrasi Warga
* **Method:** `POST`
* **Endpoint:** `/auth/register`
* **Auth:** Tidak
* **Request Body:**
```json
{
  "full_name": "Rafi Naufal",
  "email": "rafi@example.test",
  "password": "PasswordKuat123!",
  "phone": "081234567890"
}
```

### 3.2 Login Pengguna
* **Method:** `POST`
* **Endpoint:** `/auth/login`
* **Auth:** Tidak
* **Request Body:**
```json
{
  "email": "rafi@example.test",
  "password": "PasswordKuat123!"
}
```
* **Response (200 OK):**
```json
{
  "success": true,
  "message": "Login berhasil.",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "user": {
      "id": "e2f01243-7f32-45a2-9659-c29012345678",
      "full_name": "Rafi Naufal",
      "email": "rafi@example.test",
      "phone": "081234567890",
      "role": "citizen",
      "agency_id": null,
      "agency_name": null
    }
  }
}
```

### 3.3 Profil Pengguna Aktif
* **Method:** `GET`
* **Endpoint:** `/auth/me`
* **Auth:** `Bearer <token>`

---

## 4. Modul Master Data

### 4.1 Daftar Kategori Pengaduan
* **Method:** `GET`
* **Endpoint:** `/categories`
* **Auth:** Tidak

### 4.2 Daftar Instansi / OPD
* **Method:** `GET`
* **Endpoint:** `/agencies`
* **Auth:** Tidak

### 4.3 Daftar Petugas Lapangan
* **Method:** `GET`
* **Endpoint:** `/officers?agency_id={uuid}`
* **Auth:** Tidak

---

## 5. Modul Pengaduan (Complaints)

### 5.1 Buat Pengaduan Baru
* **Method:** `POST`
* **Endpoint:** `/complaints`
* **Auth:** `Bearer <token>` (Warga)
* **Request Body:**
```json
{
  "title": "Jalan Berlubang Dalam di Jl. ZA Pagar Alam",
  "description": "Lubang berdiameter 60 cm membahayakan pengendara motor saat malam hari.",
  "category_id": "c1f7b822-1234-5678-90ab-cdef12345678",
  "address_text": "Depan Kampus Teknokrat, Labuhan Ratu, Bandar Lampung",
  "latitude": -5.37894,
  "longitude": 105.25192,
  "priority": "high",
  "visibility": "public"
}
```
* **Response (201 Created):**
```json
{
  "success": true,
  "message": "Pengaduan berhasil dibuat.",
  "data": {
    "id": "8a3d42f1-6789-4321-abcd-ef0123456789",
    "ticket_no": "BL-2026-000001",
    "title": "Jalan Berlubang Dalam di Jl. ZA Pagar Alam",
    "current_status": "S01",
    "submitted_at": "2026-11-10T21:40:00Z"
  }
}
```

### 5.2 Daftar Semua Pengaduan
* **Method:** `GET`
* **Endpoint:** `/complaints?status=S07&page=1&limit=20`
* **Auth:** Tidak

### 5.3 Detail Pengaduan & Tracking
* **Method:** `GET`
* **Endpoint:** `/tickets/BL-2026-000001`
* **Auth:** Tidak

### 5.4 Pengaduan Saya
* **Method:** `GET`
* **Endpoint:** `/complaints/mine`
* **Auth:** `Bearer <token>` (Warga)

### 5.5 Daftar Tugas Petugas
* **Method:** `GET`
* **Endpoint:** `/officer/tasks`
* **Auth:** `Bearer <token>` (Petugas Lapangan / Admin)

---

## 6. Modul Tiket, Penugasan & Bukti

### 6.1 Unggah Foto Bukti
* **Method:** `POST`
* **Endpoint:** `/tickets/{ticket_no}/attachments`
* **Auth:** `Bearer <token>`
* **Content-Type:** `multipart/form-data`
* **Form Fields:**
  - `file`: file biner gambar (JPG, PNG, WebP $\le 10\text{ MB}$)
  - `evidence_type`: `initial` (bukti warga), `progress` (foto kerja petugas), atau `resolution` (bukti tuntas)

### 6.2 Penugasan Petugas / Disposisi Dinas
* **Method:** `POST`
* **Endpoint:** `/tickets/{ticket_no}/assign`
* **Auth:** `Bearer <token>` (Hanya Admin)
* **Request Body:**
```json
{
  "agency_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "officer_id": "f5e4d3c2-b1a0-9876-5432-10fedcba9876",
  "note": "Segera lakukan peninjauan teknis ke lokasi jalan berlubang."
}
```

### 6.3 Perbarui Status Tiket
* **Method:** `PATCH`
* **Endpoint:** `/tickets/{ticket_no}/status`
* **Auth:** `Bearer <token>` (Petugas Lapangan / Admin)
* **Request Body:**
```json
{
  "status": "S07",
  "note": "Petugas tiba di lokasi dan mulai menambal lubang aspal.",
  "progress_percent": 50
}
```

### 6.4 Riwayat Tahapan Status Tiket
* **Method:** `GET`
* **Endpoint:** `/tickets/{ticket_no}/history`
* **Auth:** Tidak

### 6.5 Beri Ulasan & Rating (Feedback)
* **Method:** `POST`
* **Endpoint:** `/tickets/{ticket_no}/feedback`
* **Auth:** `Bearer <token>` (Hanya Pelapor Tiket, status S08/S09)
* **Request Body:**
```json
{
  "rating": 5,
  "comment": "Penanganan sangat cepat dan jalan sudah mulus kembali. Terima kasih Pemda & Petugas!"
}
```
