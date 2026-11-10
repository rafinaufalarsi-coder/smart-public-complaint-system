-- Migration 0002: Core Schema
-- Smart Public Complaint System (SPCS)
-- Mendukung role warga, petugas, admin, penomoran tiket, geolokasi PostGIS, riwayat status, dan audit log

-- 1. Enum Types
CREATE TYPE user_role AS ENUM ('citizen', 'admin', 'officer');
CREATE TYPE complaint_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE complaint_visibility AS ENUM ('public', 'private', 'anonymous');
CREATE TYPE ticket_status AS ENUM (
  'S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09', 'S10'
);

-- 2. Sequence untuk Penomoran Tiket Unik
CREATE SEQUENCE complaint_ticket_seq START 1;

-- 3. Tabel OPD / Instansi Pemerintah
CREATE TABLE agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Tabel Pengguna (Users)
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

-- 5. Tabel Kategori Pengaduan
CREATE TABLE complaint_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  default_agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 6. Tabel Pengaduan (Complaints)
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
  CONSTRAINT assigned_user_must_be_officer CHECK (
    assigned_officer_id IS NULL OR assigned_agency_id IS NOT NULL
  )
);

CREATE INDEX idx_complaints_status ON complaints(current_status);
CREATE INDEX idx_complaints_priority ON complaints(priority);
CREATE INDEX idx_complaints_submitted_at ON complaints(submitted_at DESC);
CREATE INDEX idx_complaints_location ON complaints USING GIST(location);
CREATE INDEX idx_complaints_agency ON complaints(assigned_agency_id);
CREATE INDEX idx_complaints_reporter ON complaints(reporter_id);

-- 7. Tabel Lampiran Bukti Foto (Attachments)
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

CREATE INDEX idx_attachments_complaint ON complaint_attachments(complaint_id);

-- 8. Tabel Riwayat Status Tiket (Status History)
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

-- 9. Tabel Penugasan Petugas (Assignments)
CREATE TABLE ticket_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id),
  officer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_assignments_complaint ON ticket_assignments(complaint_id);
CREATE INDEX idx_assignments_officer ON ticket_assignments(officer_id);

-- 10. Tabel Notifikasi Pengguna
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_read ON notifications(user_id, read_at);

-- 11. Tabel Umpan Balik Warga (Feedback & Rating)
CREATE TABLE citizen_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL UNIQUE REFERENCES complaints(id) ON DELETE CASCADE,
  citizen_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Tabel Audit Log (Append-Only)
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- 13. Tabel Katalog Status Tiket
CREATE TABLE ticket_status_catalog (
  code ticket_status PRIMARY KEY,
  label VARCHAR(120),
  description TEXT,
  is_configured BOOLEAN NOT NULL DEFAULT FALSE
);

