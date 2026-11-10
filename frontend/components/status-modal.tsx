"use client";

import { FormEvent, useState } from "react";
import { apiRequest } from "@/lib/api";
import { getStoredToken } from "@/lib/auth";

interface StatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketNo: string;
  currentStatus: string;
  onSuccess: () => void;
}

export function StatusModal({
  isOpen,
  onClose,
  ticketNo,
  currentStatus,
  onSuccess,
}: StatusModalProps) {
  const [status, setStatus] = useState(currentStatus || "S07");
  const [progressPercent, setProgressPercent] = useState<number>(50);
  const [note, setNote] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // 1. Update Status & Progres Tiket
      await apiRequest(`/tickets/${encodeURIComponent(ticketNo)}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          note: note.trim() || null,
          progress_percent: Number(progressPercent),
        }),
      });

      // 2. Jika ada foto bukti penanganan fisik, upload ke endpoint attachments
      if (photoFile) {
        const token = getStoredToken();
        const uploadData = new FormData();
        uploadData.append("file", photoFile);
        uploadData.append(
          "evidence_type",
          status === "S08" || status === "S09" ? "resolution" : "progress"
        );

        const apiBase =
          process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api/v1";

        await fetch(
          `${apiBase}/tickets/${encodeURIComponent(ticketNo)}/attachments`,
          {
            method: "POST",
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: uploadData,
          }
        );
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui status tiket.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="spcs-card w-full max-w-md p-5 sm:p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Perbarui Status Penanganan
            </h3>
            <p className="font-mono text-xs font-semibold text-[#00417b]">
              #{ticketNo}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-700"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-700">
              Tahap Status Baru
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
            >
              <option value="S02">S02 · Pemeriksaan Admin</option>
              <option value="S03">S03 · Perlu Revisi Informasi</option>
              <option value="S04">S04 · Laporan Ditolak</option>
              <option value="S05">S05 · Validasi Dinas Terkait</option>
              <option value="S06">S06 · Baru Ditugaskan ke Petugas</option>
              <option value="S07">S07 · Penanganan Teknis Lapangan (Sedang Dikerjakan)</option>
              <option value="S08">S08 · Menunggu Konfirmasi (Pekerjaan Fisik Selesai)</option>
              <option value="S09">S09 · Selesai & Diarsipkan</option>
            </select>
          </div>

          <div>
            <div className="flex justify-between items-center text-xs font-bold text-slate-700">
              <label>Estimasi Progres Fisik:</label>
              <span className="font-mono text-[#00417b]">{progressPercent}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={progressPercent}
              onChange={(e) => setProgressPercent(Number(e.target.value))}
              className="mt-2 w-full accent-[#00417b]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700">
              Catatan Tindak Lanjut / Progres
            </label>
            <textarea
              required
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contoh: Petugas telah tiba di lokasi. Pengerjaan pengaspalan jalan mencapai 50%..."
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700">
              Foto Bukti Penanganan Fisik (Opsional / Wajib untuk S08)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-1 text-xs text-slate-700"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-[#00417b] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#0d59a1] disabled:opacity-50"
            >
              {loading ? "Menyimpan..." : "Simpan Pembaruan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
