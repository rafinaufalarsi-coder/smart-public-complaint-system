"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { ComplaintItem } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { StatCard } from "@/components/stat-card";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { AssignModal } from "@/components/assign-modal";
import { StatusModal } from "@/components/status-modal";

export default function AdminDashboardPage() {
  const [complaints, setComplaints] = useState<ComplaintItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [assignModal, setAssignModal] = useState<{
    ticketNo: string;
    agencyId?: string | null;
  } | null>(null);

  const [statusModal, setStatusModal] = useState<{
    ticketNo: string;
    status: string;
  } | null>(null);

  const user = getStoredUser();

  async function loadComplaints() {
    try {
      setLoading(true);
      setError("");
      let url = "/complaints?limit=100";
      if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`;
      if (searchQuery.trim()) url += `&search=${encodeURIComponent(searchQuery.trim())}`;

      const res = await apiRequest<ComplaintItem[]>(url);
      setComplaints(res.data || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal memuat data pengaduan untuk dashboard admin."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadComplaints();
  }, [statusFilter]);

  if (!user || user.role !== "admin") {
    return (
      <div className="py-12">
        <EmptyState
          icon="admin_panel_settings"
          title="Akses Dibatasi — Khusus Admin Dinas / Pemda"
          description="Halaman ini hanya dapat diakses oleh administrator dinas instansi pemerintah. Silakan masuk menggunakan akun administratif."
          actionText="Masuk Sebagai Admin"
          actionHref="/auth/login"
        />
      </div>
    );
  }

  // Hitung metrik agregat
  const totalReports = complaints.length;
  const waitingVerification = complaints.filter((c) =>
    ["S01", "S02"].includes(c.current_status)
  ).length;
  const inProgress = complaints.filter((c) =>
    ["S05", "S06", "S07"].includes(c.current_status)
  ).length;
  const resolved = complaints.filter((c) =>
    ["S08", "S09"].includes(c.current_status)
  ).length;

  return (
    <div className="space-y-6">
      {/* Header Dashboard Admin */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-blue-900">
            Pusat Komando & Disposisi
          </p>
          <h1 className="mt-1 text-2xl font-extrabold text-[#00417b]">
            Dashboard Admin Pengaduan
          </h1>
          <p className="text-xs text-slate-500">
            Kelola verifikasi, disposisi penugasan dinas teknis, dan pengawasan penanganan pengaduan Kota Bandar Lampung
          </p>
        </div>

        <button
          onClick={loadComplaints}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
        >
          <span className="material-symbols-outlined text-sm">refresh</span>
          Muat Ulang
        </button>
      </div>

      {/* Kartu Statistik Eksekutif */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total Pengaduan"
          value={totalReports}
          icon="analytics"
          variant="primary"
        />
        <StatCard
          label="Perlu Verifikasi"
          value={waitingVerification}
          icon="pending_actions"
          variant="danger"
        />
        <StatCard
          label="Dalam Penanganan"
          value={inProgress}
          icon="published_with_changes"
          variant="warning"
        />
        <StatCard
          label="Terselesaikan"
          value={resolved}
          icon="verified"
          variant="success"
        />
      </div>

      {/* Filter Bar & Search */}
      <div className="spcs-card p-4 flex flex-wrap items-center justify-between gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadComplaints();
          }}
          className="flex flex-1 items-center gap-2 max-w-md"
        >
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari judul, kata kunci, atau No. Tiket..."
              className="w-full rounded-lg border border-slate-300 py-1.5 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-[#00417b] focus:outline-hidden"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-[#00417b] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#0d59a1]"
          >
            Cari
          </button>
        </form>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">Filter Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700"
          >
            <option value="">Semua Status</option>
            <option value="S01">S01 · Terkirim ke Sistem</option>
            <option value="S02">S02 · Pemeriksaan Admin</option>
            <option value="S03">S03 · Perlu Revisi</option>
            <option value="S04">S04 · Ditolak</option>
            <option value="S05">S05 · Validasi Dinas</option>
            <option value="S06">S06 · Baru Ditugaskan</option>
            <option value="S07">S07 · Penanganan Lapangan</option>
            <option value="S08">S08 · Menunggu Konfirmasi</option>
            <option value="S09">S09 · Selesai & Diarsipkan</option>
          </select>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700"
        >
          {error}
        </div>
      )}

      {/* Tabel Data Pengaduan */}
      <div className="spcs-card overflow-hidden">
        {loading ? (
          <LoadingSpinner message="Memuat tabel data pengaduan admin..." />
        ) : complaints.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon="search_off"
              title="Tidak Ada Data Pengaduan"
              description="Tidak ada laporan yang sesuai dengan kriteria filter saat ini."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">No. Tiket</th>
                  <th className="py-3 px-4">Judul & Lokasi</th>
                  <th className="py-3 px-4">Kategori / Dinas</th>
                  <th className="py-3 px-4">Urgensi</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Pelapor</th>
                  <th className="py-3 px-4 text-right">Aksi Manajemen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
                {complaints.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-[#00417b]">
                      #{c.ticket_no}
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <p className="font-bold text-slate-900 truncate">{c.title}</p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {c.address_text || "Kota Bandar Lampung"}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-800">
                        {c.category_name || "Layanan Publik"}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {c.agency_name || "Belum Ditetapkan"}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                          c.priority === "urgent"
                            ? "bg-rose-100 text-rose-800"
                            : c.priority === "high"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {c.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={c.current_status} />
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-800">
                        {c.reporter_name || "Warga"}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(c.submitted_at).toLocaleDateString("id-ID")}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() =>
                          setAssignModal({
                            ticketNo: c.ticket_no,
                            agencyId: c.assigned_agency_id,
                          })
                        }
                        title="Disposisikan ke OPD / Petugas"
                        className="rounded-md border border-blue-300 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-[#00417b] hover:bg-blue-100"
                      >
                        Disposisi
                      </button>
                      <button
                        onClick={() =>
                          setStatusModal({
                            ticketNo: c.ticket_no,
                            status: c.current_status,
                          })
                        }
                        title="Perbarui Status Tiket"
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Status
                      </button>
                      <Link
                        href={`/lacak?no=${encodeURIComponent(c.ticket_no)}`}
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {assignModal && (
        <AssignModal
          isOpen={true}
          onClose={() => setAssignModal(null)}
          ticketNo={assignModal.ticketNo}
          currentAgencyId={assignModal.agencyId}
          onSuccess={loadComplaints}
        />
      )}

      {statusModal && (
        <StatusModal
          isOpen={true}
          onClose={() => setStatusModal(null)}
          ticketNo={statusModal.ticketNo}
          currentStatus={statusModal.status}
          onSuccess={loadComplaints}
        />
      )}
    </div>
  );
}

