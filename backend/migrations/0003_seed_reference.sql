-- Migration 0003: Seed Data Referensi
-- Data awal OPD Pemerintah Daerah, kategori pengaduan, dan katalog status

-- 1. Seed Instansi / OPD
INSERT INTO agencies(code, name, description) VALUES
 ('PUPR', 'Dinas Bina Marga & Sumber Daya Air', 'Bertanggung jawab atas infrastruktur jalan, jembatan, dan saluran drainase utama.'),
 ('DISHUB', 'Dinas Perhubungan', 'Bertanggung jawab atas rekayasa lalu lintas, marka, dan penerangan jalan umum (PJU).'),
 ('DLH', 'Dinas Lingkungan Hidup', 'Bertanggung jawab atas kebersihan kota, persampahan liar, dan ruang terbuka hijau.')
ON CONFLICT (code) DO NOTHING;

-- 2. Seed Kategori Pengaduan
INSERT INTO complaint_categories(name, description, default_agency_id)
SELECT v.name, v.description, a.id
FROM (VALUES
 ('Jalan Rusak', 'Kerusakan jalan, lubang, aspal amblas, dan infrastruktur jalan', 'PUPR'),
 ('PJU Mati', 'Lampu penerangan jalan umum tidak berfungsi atau padam', 'DISHUB'),
 ('Drainase', 'Saluran air tersumbat, meluap, atau dinding drainase rusak', 'PUPR'),
 ('Sampah Liar', 'Tumpukan sampah liar di pinggir jalan dan ruang publik', 'DLH'),
 ('Fasilitas Publik', 'Kerusakan fasilitas umum, halte, trotoar, dan jembatan penyeberangan', 'PUPR'),
 ('Lainnya', 'Pengaduan layanan publik dan fasilitas perkotaan lainnya', 'PUPR')
) AS v(name, description, agency_code)
JOIN agencies a ON a.code = v.agency_code
ON CONFLICT (name) DO NOTHING;

-- 3. Seed Katalog Status Tiket (S01–S10)
INSERT INTO ticket_status_catalog(code, label, description, is_configured) VALUES
 ('S01', 'Terkirim ke Sistem', 'Laporan berhasil diunggah ke sistem dan menunggu antrean.', TRUE),
 ('S02', 'Pemeriksaan Admin', 'Verifikasi awal kelengkapan data dan keabsahan laporan oleh admin.', TRUE),
 ('S03', 'Perlu Revisi', 'Admin meminta pelapor melengkapi foto atau informasi tambahan.', TRUE),
 ('S04', 'Ditolak', 'Laporan tidak memenuhi kriteria atau di luar kewenangan (disertai alasan).', TRUE),
 ('S05', 'Validasi Dinas', 'Laporan valid dan telah didisposisikan ke OPD/dinas teknis terkait.', TRUE),
 ('S06', 'Baru Ditugaskan', 'Perintah tugas diterbitkan untuk petugas teknis lapangan.', TRUE),
 ('S07', 'Penanganan Teknis Lapangan', 'Petugas lapangan sedang melakukan investigasi atau perbaikan fisik.', TRUE),
 ('S08', 'Menunggu Konfirmasi', 'Pekerjaan teknis selesai dengan bukti foto; menunggu konfirmasi pelapor.', TRUE),
 ('S09', 'Selesai & Diarsipkan', 'Tiket telah dikonfirmasi selesai atau ditutup sistem dan diarsipkan.', TRUE),
 ('S10', 'Dibatalkan', 'Laporan dibatalkan langsung oleh pelapor sebelum diverifikasi.', TRUE)
ON CONFLICT (code) DO UPDATE
SET label = EXCLUDED.label,
    description = EXCLUDED.description,
    is_configured = EXCLUDED.is_configured;

-- =============================================================================
-- CATATAN KEAMANAN: Seed akun pengguna demo dihapus dari migration ini.
--
-- Alasan: Hash password Argon2id TIDAK BOLEH dimasukkan sebagai literal string
-- ke dalam migration SQL. Hash harus digenerate secara runtime oleh fungsi
-- argon2::hash_encoded() agar parameter KDF (salt, memory cost, time cost)
-- diproses dengan benar. Menyisipkan string hash secara manual ke SQL
-- berpotensi menyebabkan:
--   1) Login gagal jika format hash tidak sesuai ekspektasi library
--   2) Security bypass jika nilai hash bisa ditebak
--
-- CARA MEMBUAT AKUN DEMO:
-- Setelah server berjalan, gunakan endpoint POST /api/v1/auth/register:
--
--   curl -X POST http://localhost:8080/api/v1/auth/register \
--     -H "Content-Type: application/json" \
--     -d '{"full_name":"Admin PUPR","email":"admin@bandarlampung.go.id",
--           "phone":"081100000001","password":"GantiDenganPasswordKuat!123",
--           "role":"admin"}'
--
-- Setelah register, update agency_id via psql jika diperlukan:
--   UPDATE users SET agency_id = (SELECT id FROM agencies WHERE code = 'PUPR')
--   WHERE email = 'admin@bandarlampung.go.id';
--
-- JANGAN gunakan password lemah atau password yang sama di semua akun demo.
-- =============================================================================
