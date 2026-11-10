"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { ComplaintDetail } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { TicketTimeline } from "@/components/ticket-timeline";
import { LoadingSpinner } from "@/components/loading-spinner";

export default function TrackingPage() {
  const [ticketNo, setTicketNo] = useState("");
  const [ticket, setTicket] = useState<ComplaintDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Feedback form state
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const noParam = urlParams.get("no");
    if (noParam) {
      setTicketNo(noParam);
      fetchTicket(noParam);
    }
  }, []);

  async function fetchTicket(numberToFetch: string) {
    if (!numberToFetch.trim()) return;

    setLoading(true);
    setError("");
    setTicket(null);
    setFeedbackSuccess(false);

    try {
      const res = await apiRequest<ComplaintDetail>(
        `/tickets/${encodeURIComponent(numberToFetch.trim())}`
      );
      setTicket(res.data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Nomor tiket tidak ditemukan atau terjadi kesalahan."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    fetchTicket(ticketNo);
  }

  async function handleFeedbackSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ticket) return;

    setFeedbackSending(true);
    setFeedbackError("");

    try {
      await apiRequest(`/tickets/${encodeURIComponent(ticket.ticket_no)}/feedback`, {
        method: "POST",
        body: JSON.stringify({
          rating,
          comment: comment || null,
        }),
      });
      setFeedbackSuccess(true);
    } catch (err) {
      setFeedbackError(
        err instanceof Error
          ? err.message
          : "Gagal mengirimkan ulasan. Pastikan Anda telah masuk sebagai pelapor tiket ini."
      );
    } finally {
      setFeedbackSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header & Search Bar */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-[#00417b]">
          Pelacakan Real-Time
        </p>
        <h1 className="mt-1 text-2xl font-extrabold text-slate-900">
          Lacak Status Pengaduan
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Masukkan nomor registrasi tiket pengaduan untuk melihat progres penanganan secara transparan
        </p>
      </div>

      {/* Input Pencarian */}
      <div className="spcs-card p-4 sm:p-5">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400">
              confirmation_number
            </span>
            <input
              type="text"
              required
              value={ticketNo}
              onChange={(e) => setTicketNo(e.target.value)}
              placeholder="Contoh: BL-2026-000001"
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 font-mono text-xs font-semibold text-slate-800 placeholder-slate-400 focus:border-[#00417b] focus:outline-hidden focus:ring-1 focus:ring-[#00417b]"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#00417b] px-5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#0d59a1] disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm">search</span>
            Lacak
          </button>
        </form>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs font-medium text-red-700"
        >
          <span className="material-symbols-outlined text-base">error</span>
          {error}
        </div>
      )}

      {/* Loading Indicator */}
      {loading && <LoadingSpinner message="Mencari riwayat tiket..." />}

      {/* Hasil Pelacakan Tiket */}
      {ticket && (
        <div className="space-y-5">
          {/* Kartu Ringkasan Tiket */}
          <div className="spcs-card space-y-4 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  ID Registrasi Tiket SPCS
                </p>
                <h2 className="font-mono text-xl font-extrabold text-[#00417b]">
                  #{ticket.ticket_no}
                </h2>
              </div>
              <StatusBadge status={ticket.current_status} />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">
                {ticket.title}
              </h3>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                {ticket.description}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 rounded-xl bg-slate-50 p-3.5 text-xs text-slate-600 border border-slate-200/60">
              <div>
                <p className="text-slate-400 text-[11px]">Kategori & Dinas</p>
                <p className="font-semibold text-slate-800">
                  {ticket.category_name || "Layanan Publik"} •{" "}
                  {ticket.agency_name || "OPD Belum Ditetapkan"}
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-[11px]">Prioritas Laporan</p>
                <p className="font-semibold uppercase tracking-wider text-amber-800">
                  {ticket.priority}
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-[11px]">Lokasi Titik</p>
                <p className="font-semibold text-slate-800">
                  {ticket.address_text || "Kota Bandar Lampung"}
                </p>
                <a
                  href={`https://www.google.com/maps?q=${ticket.latitude},${ticket.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold text-[#00417b] hover:underline"
                >
                  <span className="material-symbols-outlined text-xs">open_in_new</span>
                  Buka Titik di Google Maps ({ticket.latitude.toFixed(4)}, {ticket.longitude.toFixed(4)})
                </a>
              </div>
              <div>
                <p className="text-slate-400 text-[11px]">Waktu Diajukan</p>
                <p className="font-semibold text-slate-800">
                  {new Date(ticket.submitted_at).toLocaleString("id-ID", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>
            </div>

            {/* Lampiran Bukti Foto dengan Thumbnail */}
            {ticket.attachments && ticket.attachments.length > 0 && (
              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs font-bold text-slate-800 mb-2">
                  Dokumentasi Foto Bukti ({ticket.attachments.length}):
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {ticket.attachments.map((att) => {
                    const fileUrl = `http://localhost:8080/${att.object_key}`;
                    return (
                      <div
                        key={att.id}
                        className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs space-y-2"
                      >
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block relative h-28 w-full overflow-hidden rounded-lg bg-slate-100 group"
                        >
                          <img
                            src={fileUrl}
                            alt={att.original_filename}
                            className="h-full w-full object-cover group-hover:scale-105 transition duration-200"
                            onError={(e) => {
                              // Fallback jika file fisik tidak ada di server
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        </a>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="truncate font-semibold text-slate-700 max-w-[110px]">
                            {att.original_filename}
                          </span>
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                              att.evidence_type === "resolution"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-blue-100 text-[#00417b]"
                            }`}
                          >
                            {att.evidence_type}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Timeline Tahapan Penanganan S01–S10 */}
          <div className="spcs-card p-5 sm:p-6">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center justify-between">
              <span>Alur Riwayat Penanganan Teknis (S01–S10)</span>
              <span className="text-[11px] font-semibold text-slate-400">
                Total {ticket.history?.length || 0} Catatan
              </span>
            </h3>

            <TicketTimeline
              history={ticket.history}
              currentStatus={ticket.current_status}
            />
          </div>

          {/* Ulasan & Rating Warga (Hanya untuk S08 / S09) */}
          {["S08", "S09"].includes(ticket.current_status) && (
            <div className="spcs-card p-5 sm:p-6 border-emerald-200 bg-emerald-50/30">
              <div className="flex items-center gap-2 text-emerald-800">
                <span className="material-symbols-outlined">reviews</span>
                <h3 className="text-sm font-bold">
                  Evaluasi & Penilaian Kepuasan Pelapor
                </h3>
              </div>
              <p className="mt-1 text-xs text-slate-600">
                Laporan ini telah diselesaikan oleh dinas terkait. Berikan penilaian Anda terhadap kecepatan dan hasil penanganan.
              </p>

              {feedbackSuccess ? (
                <div className="mt-3 rounded-lg bg-emerald-100 p-3 text-xs font-bold text-emerald-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">check</span>
                  Terima kasih! Ulasan dan rating kepuasan Anda telah berhasil dikirimkan.
                </div>
              ) : (
                <form onSubmit={handleFeedbackSubmit} className="mt-3 space-y-3">
                  {feedbackError && (
                    <p className="text-xs font-semibold text-red-600">
                      {feedbackError}
                    </p>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Rating Pelayanan (1 - 5 Bintang):
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          className={`text-2xl transition ${
                            star <= rating ? "text-amber-400" : "text-slate-300"
                          }`}
                        >
                          ★
                        </button>
                      ))}
                      <span className="text-xs font-bold text-slate-700 ml-2">
                        {rating} dari 5 Bintang
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Komentar / Ulasan Penanganan:
                    </label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Tuliskan pengalaman Anda terhadap hasil perbaikan fasilitas oleh petugas..."
                      rows={2}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-800"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={feedbackSending}
                    className="rounded-lg bg-[#00417b] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#0d59a1] disabled:opacity-50"
                  >
                    {feedbackSending ? "Mengirim..." : "Kirim Penilaian Pelapor"}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
