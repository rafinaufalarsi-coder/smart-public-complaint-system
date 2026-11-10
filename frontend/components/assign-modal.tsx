"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { Agency, UserProfile } from "@/lib/types";

interface AssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketNo: string;
  currentAgencyId?: string | null;
  onSuccess: () => void;
}

export function AssignModal({
  isOpen,
  onClose,
  ticketNo,
  currentAgencyId,
  onSuccess,
}: AssignModalProps) {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [officers, setOfficers] = useState<UserProfile[]>([]);
  const [selectedAgency, setSelectedAgency] = useState(currentAgencyId || "");
  const [selectedOfficer, setSelectedOfficer] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [officersLoading, setOfficersLoading] = useState(false);
  const [error, setError] = useState("");

  // Load agencies
  useEffect(() => {
    async function loadAgencies() {
      try {
        const res = await apiRequest<Agency[]>("/agencies");
        if (res.data) {
          setAgencies(res.data);
          if (!selectedAgency && res.data.length > 0) {
            setSelectedAgency(res.data[0].id);
          }
        }
      } catch (err) {
        console.error("Gagal mengambil data dinas:", err);
      }
    }

    if (isOpen) {
      loadAgencies();
    }
  }, [isOpen, selectedAgency]);

  // Load officers whenever selectedAgency changes
  useEffect(() => {
    async function loadOfficers() {
      if (!selectedAgency) {
        setOfficers([]);
        return;
      }
      try {
        setOfficersLoading(true);
        const res = await apiRequest<UserProfile[]>(
          `/officers?agency_id=${encodeURIComponent(selectedAgency)}`
        );
        setOfficers(res.data || []);
      } catch (err) {
        console.error("Gagal mengambil daftar petugas:", err);
      } finally {
        setOfficersLoading(false);
      }
    }

    if (isOpen && selectedAgency) {
      loadOfficers();
    }
  }, [isOpen, selectedAgency]);

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await apiRequest(`/tickets/${encodeURIComponent(ticketNo)}/assign`, {
        method: "POST",
        body: JSON.stringify({
          agency_id: selectedAgency,
          officer_id: selectedOfficer || null,
          note: note.trim() || null,
        }),
      });

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mendisposisikan tiket.");
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
              Disposisi & Penugasan Tiket
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
          {/* Pilih Dinas */}
          <div>
            <label className="block text-xs font-bold text-slate-700">
              Tentukan Instansi / OPD Teknis
            </label>
            <select
              value={selectedAgency}
              onChange={(e) => {
                setSelectedAgency(e.target.value);
                setSelectedOfficer("");
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
            >
              {agencies.map((agency) => (
                <option key={agency.id} value={agency.id}>
                  {agency.code} — {agency.name}
                </option>
              ))}
            </select>
          </div>

          {/* Pilih Petugas Lapangan */}
          <div>
            <label className="block text-xs font-bold text-slate-700">
              Tugaskan Petugas Lapangan (Opsional)
            </label>
            <select
              value={selectedOfficer}
              onChange={(e) => setSelectedOfficer(e.target.value)}
              disabled={officersLoading}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 disabled:opacity-50"
            >
              <option value="">-- Disposisi ke Dinas Dulu (Status S05) --</option>
              {officers.map((officer) => (
                <option key={officer.id} value={officer.id}>
                  {officer.full_name} ({officer.phone || "Petugas"})
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-400">
              {officersLoading
                ? "Memuat daftar petugas dinas..."
                : officers.length === 0
                ? "Belum ada petugas terdaftar di dinas ini. Tiket akan disimpan dengan status S05 (Validasi Dinas)."
                : "Memilih petugas akan otomatis menggeser status ke S06 (Baru Ditugaskan)."}
            </p>
          </div>

          {/* Catatan Instruksi */}
          <div>
            <label className="block text-xs font-bold text-slate-700">
              Instruksi Penugasan / Catatan Disposisi
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contoh: Teruskan ke seksi perbaikan jalan untuk peninjauan dan penambalan segera..."
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800"
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
              {loading ? "Menugaskan..." : "Kirim Disposisi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
