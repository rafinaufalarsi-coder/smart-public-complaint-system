"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { getStoredToken } from "@/lib/auth";
import { ComplaintCategory } from "@/lib/types";

export default function NewComplaintPage() {
  const [categories, setCategories] = useState<ComplaintCategory[]>([]);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
    ticketNo?: string;
  } | null>(null);

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");

  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await apiRequest<ComplaintCategory[]>("/categories");
        if (res.data) {
          setCategories(res.data);
          if (res.data.length > 0) {
            setSelectedCategory(res.data[0].id);
          }
        }
      } catch (err) {
        console.error("Gagal memuat kategori:", err);
      }
    }

    loadCategories();

    // Cek parameter query ?cat=...
    const urlParams = new URLSearchParams(window.location.search);
    const catParam = urlParams.get("cat");
    if (catParam) {
      setSelectedCategory(catParam);
    }
  }, []);

  function handleGetGPS() {
    if (!navigator.geolocation) {
      setStatusMessage({
        type: "error",
        text: "Browser Anda tidak mendukung fitur Geolocation GPS.",
      });
      return;
    }

    setGpsLoading(true);
    setStatusMessage(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setGpsLoading(false);
        setStatusMessage({
          type: "info",
          text: `Koordinat GPS berhasil dikunci: ${position.coords.latitude.toFixed(
            6
          )}, ${position.coords.longitude.toFixed(6)}`,
        });
      },
      (error) => {
        setGpsLoading(false);
        // Fallback ke titik default Bandar Lampung
        setLatitude("-5.378940");
        setLongitude("105.251920");
        setStatusMessage({
          type: "info",
          text: `Izin GPS tidak diberikan (${error.message}). Menggunakan koordinat referensi Bandar Lampung (-5.378940, 105.251920).`,
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setSelectedFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const token = getStoredToken();
    if (!token) {
      setStatusMessage({
        type: "error",
        text: "Anda harus masuk (login) terlebih dahulu untuk mengirim pengaduan.",
      });
      return;
    }

    if (!latitude || !longitude) {
      setStatusMessage({
        type: "error",
        text: "Titik koordinat geolokasi wajib diisi atau diambil via tombol GPS.",
      });
      return;
    }

    setSubmitting(true);
    setStatusMessage(null);

    const form = new FormData(e.currentTarget);

    try {
      const payload = {
        title: form.get("title"),
        description: form.get("description"),
        category_id: selectedCategory || null,
        address_text: form.get("address_text") || null,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        priority: form.get("priority"),
        visibility: form.get("visibility"),
      };

      // 1. Submit Data Pengaduan
      const res = await apiRequest<{ ticket_no: string }>("/complaints", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const ticketNo = res.data.ticket_no;

      // 2. Jika ada foto bukti, upload ke endpoint attachments
      if (selectedFile) {
        try {
          const uploadData = new FormData();
          uploadData.append("file", selectedFile);
          uploadData.append("evidence_type", "initial");

          const apiBase =
            process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api/v1";

          await fetch(`${apiBase}/tickets/${encodeURIComponent(ticketNo)}/attachments`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: uploadData,
          });
        } catch (uploadErr) {
          console.warn("Gagal mengunggah foto bukti:", uploadErr);
        }
      }

      setStatusMessage({
        type: "success",
        text: "Pengaduan Anda telah berhasil diajukan dan masuk ke antrean verifikasi dinas.",
        ticketNo,
      });

      e.currentTarget.reset();
      setSelectedFile(null);
      setPreviewImage(null);
      setSelectedFileName("");
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal mengirim pengaduan.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header Form */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-[#00417b]">
          Formulir Pengaduan Cerdas
        </p>
        <h1 className="mt-1 text-2xl font-extrabold text-slate-900">
          Buat Pengaduan Baru
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Sampaikan informasi kerusakan fasilitas umum secara rinci agar petugas dinas terkait dapat segera menindaklanjuti.
        </p>
      </div>

      {/* Alert Status */}
      {statusMessage && (
        <div
          role="alert"
          className={`flex flex-col gap-2 rounded-xl border p-4 text-xs font-medium ${
            statusMessage.type === "success"
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : statusMessage.type === "error"
              ? "border-red-300 bg-red-50 text-red-900"
              : "border-blue-300 bg-blue-50 text-blue-900"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">
              {statusMessage.type === "success"
                ? "check_circle"
                : statusMessage.type === "error"
                ? "error"
                : "info"}
            </span>
            <span>{statusMessage.text}</span>
          </div>

          {statusMessage.ticketNo && (
            <div className="mt-2 rounded-lg bg-white/80 p-3 border border-emerald-200">
              <p className="text-xs font-semibold text-slate-700">
                Nomor Tiket Anda:
              </p>
              <p className="mt-0.5 font-mono text-base font-extrabold text-[#00417b]">
                #{statusMessage.ticketNo}
              </p>
              <div className="mt-2 flex gap-2">
                <Link
                  href={`/lacak?no=${encodeURIComponent(statusMessage.ticketNo)}`}
                  className="rounded-lg bg-[#00417b] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#0d59a1]"
                >
                  Lacak Progres Tiket Ini →
                </Link>
                <Link
                  href="/pengaduan/saya"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Buka Pengaduan Saya
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Form Utama */}
      <form onSubmit={handleSubmit} className="spcs-card space-y-5 p-5 sm:p-7">
        {/* Judul Pengaduan */}
        <div>
          <label className="block text-xs font-bold text-slate-800">
            Judul Pengaduan <span className="text-red-500">*</span>
          </label>
          <input
            name="title"
            required
            minLength={5}
            maxLength={180}
            placeholder="Contoh: Jalan Berlubang Dalam Membahayakan Pengendara"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#00417b] focus:outline-hidden focus:ring-1 focus:ring-[#00417b]"
          />
        </div>

        {/* Kategori Pengaduan */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-bold text-slate-800">
              Kategori Pengaduan <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#00417b] focus:outline-hidden focus:ring-1 focus:ring-[#00417b]"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800">
              Perkiraan Urgensi / Prioritas
            </label>
            <select
              name="priority"
              defaultValue="medium"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#00417b] focus:outline-hidden focus:ring-1 focus:ring-[#00417b]"
            >
              <option value="low">Rendah (Kerusakan minor)</option>
              <option value="medium">Sedang (Perlu penanganan reguler)</option>
              <option value="high">Tinggi (Mengganggu mobilitas umum)</option>
              <option value="urgent">Mendesak (Membahayakan keselamatan)</option>
            </select>
          </div>
        </div>

        {/* Keterangan Lengkap */}
        <div>
          <label className="block text-xs font-bold text-slate-800">
            Deskripsi / Keterangan Lengkap <span className="text-red-500">*</span>
          </label>
          <textarea
            name="description"
            required
            minLength={10}
            rows={4}
            placeholder="Jelaskan detail kondisi kerusakan, ukuran, sejak kapan terjadi, dan patokan sekitar lokasi..."
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#00417b] focus:outline-hidden focus:ring-1 focus:ring-[#00417b]"
          />
        </div>

        {/* Alamat & Patokan */}
        <div>
          <label className="block text-xs font-bold text-slate-800">
            Alamat / Patokan Lokasi Fisik
          </label>
          <input
            name="address_text"
            placeholder="Contoh: Jl. ZA. Pagar Alam No. 9, Labuhan Ratu (Depan Kampus Teknokrat)"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#00417b] focus:outline-hidden focus:ring-1 focus:ring-[#00417b]"
          />
        </div>

        {/* Modul Koordinat Geospasial */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-[#00417b]">
                Geolokasi Titik Laporan (PostGIS WGS 84) <span className="text-red-500">*</span>
              </p>
              <p className="text-[11px] text-slate-500">
                Gunakan GPS perangkat Anda untuk akurasi posisi lapangan tim dinas
              </p>
            </div>
            <button
              type="button"
              onClick={handleGetGPS}
              disabled={gpsLoading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#00417b] px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#0d59a1] active:scale-95 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">my_location</span>
              {gpsLoading ? "Mengunci GPS..." : "Ambil Lokasi GPS Saya"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600">
                Latitude (Garis Lintang)
              </label>
              <input
                type="number"
                step="any"
                required
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="-5.378940"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600">
                Longitude (Garis Bujur)
              </label>
              <input
                type="number"
                step="any"
                required
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="105.251920"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-800"
              />
            </div>
          </div>
        </div>

        {/* Upload Foto Bukti Kerusakan */}
        <div>
          <label className="block text-xs font-bold text-slate-800">
            Foto Bukti Kerusakan Fisik
          </label>
          <div className="mt-1 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-4 text-center">
            {previewImage ? (
              <div className="space-y-2">
                <img
                  src={previewImage}
                  alt="Pratinjau Bukti"
                  className="mx-auto max-h-48 rounded-lg object-contain shadow-xs"
                />
                <p className="text-xs font-medium text-slate-600 truncate max-w-xs mx-auto">
                  {selectedFileName}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewImage(null);
                    setSelectedFileName("");
                  }}
                  className="text-xs font-semibold text-red-600 hover:underline"
                >
                  Hapus / Ganti Foto
                </button>
              </div>
            ) : (
              <div>
                <span className="material-symbols-outlined text-3xl text-slate-400">
                  add_a_photo
                </span>
                <p className="mt-1 text-xs font-semibold text-slate-700">
                  Pilih foto dari kamera atau galeri perangkat
                </p>
                <p className="text-[11px] text-slate-400">
                  Format JPG, PNG, atau WebP (Maksimal 10 MB)
                </p>
                <label className="mt-3 inline-block cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50">
                  Jelajahi File
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Pengaturan Privasi */}
        <div className="border-t border-slate-100 pt-3">
          <label className="block text-xs font-bold text-slate-800">
            Visibilitas Identitas Pelapor
          </label>
          <select
            name="visibility"
            defaultValue="public"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#00417b] focus:outline-hidden focus:ring-1 focus:ring-[#00417b]"
          >
            <option value="public">Publik (Nama ditampilkan pada pelacakan publik)</option>
            <option value="private">Privat (Hanya petugas dan dinas yang dapat melihat nama Anda)</option>
            <option value="anonymous">Anonim (Identitas disembunyikan sepenuhnya dari publik)</option>
          </select>
        </div>

        {/* Tombol Kirim */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-[#00417b] py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#0d59a1] active:scale-98 disabled:opacity-50"
          >
            {submitting ? "Mengirim Laporan ke Sistem..." : "Kirim Pengaduan Sekarang"}
          </button>
        </div>
      </form>
    </div>
  );
}
