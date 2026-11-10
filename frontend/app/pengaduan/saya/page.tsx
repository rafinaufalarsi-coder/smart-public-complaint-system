"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { getStoredToken } from "@/lib/auth";
import { ComplaintItem } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";

export default function MyComplaintsPage() {
  const [complaints, setComplaints] = useState<ComplaintItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(true);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setIsLoggedIn(false);
      setLoading(false);
      return;
    }

    async function loadMyComplaints() {
      try {
        setLoading(true);
        const res = await apiRequest<ComplaintItem[]>("/complaints/mine");
        setComplaints(res.data || []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Gagal memuat daftar pengaduan Anda."
        );
      } finally {
        setLoading(false);
      }
    }

    loadMyComplaints();
  }, []);

  if (!isLoggedIn) {
    return (
      <div className="py-12">
        <EmptyState
          icon="lock"
          title="Autentikasi Diperlukan"
          description="Silakan masuk (login) menggunakan akun warga Anda untuk melihat riwayat pengaduan yang telah diajukan."
          actionText="Masuk ke Akun"
          actionHref="/auth/login"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#00417b]">
            Portal Pelapor
          </p>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900">
            Aktivitas Pengaduan Saya
          </h1>
          <p className="text-xs text-slate-500">
            Daftar seluruh laporan keluhan publik yang telah Anda sampaikan ke Pemerintah Kota
          </p>
        </div>

        <Link
          href="/pengaduan/baru"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#00417b] px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#0d59a1]"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Buat Pengaduan Baru
        </Link>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700"
        >
          {error}
        </div>
      )}

      {loading ? (
        <LoadingSpinner message="Mengambil riwayat laporan Anda..." />
      ) : complaints.length === 0 ? (
        <EmptyState
          icon="assignment"
          title="Belum Ada Pengaduan"
          description="Anda belum pernah mengajukan laporan pengaduan fasilitas perkotaan."
          actionText="Buat Pengaduan Sekarang"
          actionHref="/pengaduan/baru"
        />
      ) : (
        <div className="grid gap-4">
          {complaints.map((item) => (
            <article
              key={item.id}
              className="spcs-card flex flex-col justify-between p-4 sm:p-5 hover:border-[#00417b]"
            >
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-extrabold text-[#00417b]">
                      #{item.ticket_no}
                    </span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                      {item.category_name || "Layanan Publik"}
                    </span>
                  </div>
                  <StatusBadge status={item.current_status} />
                </div>

                <h2 className="mt-3 text-base font-bold text-slate-900">
                  {item.title}
                </h2>
                <p className="mt-1 line-clamp-2 text-xs text-slate-600 leading-relaxed">
                  {item.description}
                </p>
              </div>

              <div className="mt-4 border-t border-slate-100 pt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">location_on</span>
                    {item.address_text || "Kota Bandar Lampung"}
                  </span>
                  <span>•</span>
                  <span>
                    Diajukan:{" "}
                    {new Date(item.submitted_at).toLocaleDateString("id-ID", {
                      dateStyle: "medium",
                    })}
                  </span>
                </div>

                <Link
                  href={`/lacak?no=${encodeURIComponent(item.ticket_no)}`}
                  className="font-bold text-[#00417b] hover:underline"
                >
                  Pantau Tahapan & Timeline →
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

