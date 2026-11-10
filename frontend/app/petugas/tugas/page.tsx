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
import { StatusModal } from "@/components/status-modal";

export default function OfficerTasksPage() {
  const [tasks, setTasks] = useState<ComplaintItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeModalTicket, setActiveModalTicket] = useState<{
    ticketNo: string;
    status: string;
  } | null>(null);

  const user = getStoredUser();

  async function loadTasks() {
    try {
      setLoading(true);
      setError("");
      const res = await apiRequest<ComplaintItem[]>("/officer/tasks");
      setTasks(res.data || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal memuat daftar penugasan petugas."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
  }, []);

  if (!user || (user.role !== "officer" && user.role !== "admin")) {
    return (
      <div className="py-12">
        <EmptyState
          icon="shield_lock"
          title="Akses Khusus Petugas Lapangan"
          description="Halaman ini diperuntukkan bagi Petugas Lapangan OPD Pemerintah Daerah. Silakan masuk dengan akun petugas Anda."
          actionText="Masuk ke Akun Petugas"
          actionHref="/auth/login"
        />
      </div>
    );
  }

  // Hitung metrik agregat
  const totalTasks = tasks.length;
  const inProgressTasks = tasks.filter((t) => t.current_status === "S07").length;
  const newTasks = tasks.filter((t) => t.current_status === "S06").length;
  const urgentTasks = tasks.filter(
    (t) => t.priority === "urgent" || t.priority === "high"
  ).length;

  return (
    <div className="space-y-6">
      {/* Header Dashboard Petugas */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
            Portal Penugasan Lapangan
          </p>
          <h1 className="mt-1 text-2xl font-extrabold text-[#00417b]">
            Daftar Tugas Penanganan
          </h1>
          <p className="text-xs text-slate-500">
            Petugas: <strong className="text-slate-800">{user.full_name}</strong>{" "}
            {user.agency_name ? `• ${user.agency_name}` : ""}
          </p>
        </div>

        <button
          onClick={loadTasks}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
        >
          <span className="material-symbols-outlined text-sm">refresh</span>
          Segarkan Data
        </button>
      </div>

      {/* Baris Kartu Metrik */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total Tugas"
          value={totalTasks}
          icon="assignment"
          variant="primary"
        />
        <StatCard
          label="Tugas Baru"
          value={newTasks}
          icon="fiber_new"
          variant="default"
        />
        <StatCard
          label="Sedang Dikerjakan"
          value={inProgressTasks}
          icon="engineering"
          variant="warning"
        />
        <StatCard
          label="Prioritas Tinggi"
          value={urgentTasks}
          icon="warning"
          variant="danger"
        />
      </div>

      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700"
        >
          {error}
        </div>
      )}

      {/* Daftar Tugas Petugas */}
      {loading ? (
        <LoadingSpinner message="Mengambil daftar tugas lapangan Anda..." />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon="task_alt"
          title="Tidak Ada Tugas Aktif"
          description="Saat ini belum ada pengaduan yang ditugaskan kepada Anda. Silakan hubungi admin dinas untuk penugasan baru."
        />
      ) : (
        <div className="grid gap-4">
          {tasks.map((task) => (
            <article
              key={task.id}
              className={`spcs-card flex flex-col justify-between p-4 sm:p-5 ${
                task.priority === "urgent"
                  ? "border-l-4 border-l-rose-500"
                  : task.priority === "high"
                  ? "border-l-4 border-l-amber-500"
                  : ""
              }`}
            >
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-extrabold text-[#00417b]">
                      #{task.ticket_no}
                    </span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                        task.priority === "urgent"
                          ? "bg-rose-100 text-rose-800"
                          : task.priority === "high"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      Prioritas: {task.priority}
                    </span>
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-[#00417b]">
                      {task.category_name || "Layanan Publik"}
                    </span>
                  </div>
                  <StatusBadge status={task.current_status} />
                </div>

                <h2 className="mt-3 text-base font-bold text-slate-900">
                  {task.title}
                </h2>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  {task.description}
                </p>

                <div className="mt-3 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2 border border-slate-200/60">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-[#00417b]">
                      location_on
                    </span>
                    {task.address_text || "Kota Bandar Lampung"}
                  </span>
                  <a
                    href={`https://www.google.com/maps?q=${task.latitude},${task.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-[#00417b] hover:underline text-[11px]"
                  >
                    <span className="material-symbols-outlined text-xs">navigation</span>
                    Rute Navigasi ({task.latitude.toFixed(4)}, {task.longitude.toFixed(4)})
                  </a>
                </div>
              </div>

              <div className="mt-4 border-t border-slate-100 pt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400">
                  Diajukan: {new Date(task.submitted_at).toLocaleString("id-ID", { dateStyle: "medium" })}
                </span>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/lacak?no=${encodeURIComponent(task.ticket_no)}`}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Detail Tiket
                  </Link>
                  <button
                    onClick={() =>
                      setActiveModalTicket({
                        ticketNo: task.ticket_no,
                        status: task.current_status,
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#00417b] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#0d59a1]"
                  >
                    <span className="material-symbols-outlined text-sm">edit_note</span>
                    Perbarui Progres & Status
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Modal Pembaruan Status Petugas */}
      {activeModalTicket && (
        <StatusModal
          isOpen={true}
          onClose={() => setActiveModalTicket(null)}
          ticketNo={activeModalTicket.ticketNo}
          currentStatus={activeModalTicket.status}
          onSuccess={loadTasks}
        />
      )}
    </div>
  );
}

