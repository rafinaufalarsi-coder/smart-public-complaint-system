-- Migration 0001: Extensions
-- Mengaktifkan ekstensi PostGIS untuk geolokasi dan pgcrypto untuk hashing/UUID

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

