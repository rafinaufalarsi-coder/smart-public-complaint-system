"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { ComplaintCategory, ComplaintItem } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";

export default function HomePage() {
  const [categories, setCategories] = useState<ComplaintCategory[]>([]);
  const [complaints, setComplaints] = useState<ComplaintItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [trackInput, setTrackInput] = useState("");

  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        const [catRes, compRes] = await Promise.allSettled([
          apiRequest<ComplaintCategory[]>("/categories"),
          apiRequest<ComplaintItem[]>("/complaints?limit=6"),
        ]);

        if (catRes.status === "fulfilled" && catRes.value.data) {
          setCategories(catRes.value.data);
        }
        if (compRes.status === "fulfilled" && compRes.value.data) {
          setComplaints(compRes.value.data);
        }
      } catch (e) {
        console.error("Gagal memuat data beranda:", e);
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, []);

  const defaultCategoryIcons: Record<string, string> = {
    "Jalan Rusak": "edit_road",
    "PJU Mati": "lightbulb",
    "Drainase": "water",
    "Sampah Liar": "delete",
    "Fasilitas Publik": "apartment",
    "Lainnya": "more_horiz",
  };

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#00417b] via-[#0d59a1] to-[#00417b] p-6 sm:p-10 text-white shadow-lg">
        <div className="relative z-10 max-w-2xl space-y-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-blue-100 backdrop-blur-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Portal Layanan Publik Kota Bandar Lampung
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-4xl">
            Suara Anda, Perubahan Kota Kita.
          </h1>
          <p className="text-sm text-blue-100/90 sm:text-base leading-relaxed">
            Laporkan kerusakan infrastruktur jalan, lampu penerangan padam, saluran drainase,
            dan fasilitas perkotaan secara transparan, akurat dengan titik GPS, dan terpantau hingga tuntas.
          </p>

          <div className="pt-3 flex flex-wrap items-center gap-3">
            <Link
              href="/pengaduan/baru"
              className="inline-flex items-center gap-2 rounded-xl bg-[#feae2c] px-5 py-3 text-sm font-bold text-slate-900 shadow-md transition hover:bg-amber-400 active:scale-95"
            >
              <span className="material-symbols-outlined text-lg">add_circle</span>
              Buat Pengaduan Baru
            </Link>
            <Link
              href="/lacak"
              className="inline-flex items-center gap-2 rounded-xl border border-white/40 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur-xs transition hover:bg-white/20 active:scale-95"
            >
              <span className="material-symbols-outlined text-lg">travel_explore</span>
              Lacak Status Tiket
            </Link>
          </div>
        </div>

        {/* Quick Search Widget */}
        <div className="mt-8 border-t border-white/20 pt-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (trackInput.trim()) {
                window.location.href = `/lacak?no=${encodeURIComponent(trackInput.trim())}`;
              }
            }}
            className="flex max-w-md items-center gap-2"
          >
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400">
                search
              </span>
              <input
                type="text"
                value={trackInput}
                onChange={(e) => setTrackInput(e.target.value)}
                placeholder="Cari No. Tiket: BL-2026-XXXXXX"
                className="w-full rounded-lg bg-white/95 py-2 pl-9 pr-3 text-xs font-mono font-medium text-slate-900 placeholder-slate-400 shadow-inner focus:outline-hidden focus:ring-2 focus:ring-[#feae2c]"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-[#feae2c] px-4 py-2 text-xs font-bold text-slate-900 shadow-xs transition hover:bg-amber-400"
            >
              Cari
            </button>
          </form>
        </div>
      </section>

      {/* Grid Kategori Pengaduan */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#00417b]">Kategori Pengaduan</h2>
            <p className="text-xs text-slate-500">
              Pilih kategori masalah fasilitas publik yang ingin Anda laporkan
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {(categories.length > 0 ? categories : [
            { id: "1", name: "Jalan Rusak", description: "Infrastruktur jalan", is_active: true },
            { id: "2", name: "PJU Mati", description: "Lampu penerangan", is_active: true },
            { id: "3", name: "Drainase", description: "Saluran air", is_active: true },
            { id: "4", name: "Sampah Liar", description: "Kebersihan kota", is_active: true },
            { id: "5", name: "Fasilitas Publik", description: "Fasum rusak", is_active: true },
            { id: "6", name: "Lainnya", description: "Layanan umum", is_active: true },
          ]).map((cat) => {
            const iconName = defaultCategoryIcons[cat.name] || "category";
            return (
              <Link
                key={cat.id}
                href={`/pengaduan/baru?cat=${encodeURIComponent(cat.id)}`}
                className="spcs-card flex flex-col items-center p-4 text-center group"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-[#00417b] transition group-hover:scale-110 group-hover:bg-[#00417b] group-hover:text-white">
                  <span className="material-symbols-outlined text-2xl">{iconName}</span>
                </div>
                <h3 className="mt-2.5 text-xs font-bold text-slate-800 group-hover:text-[#00417b]">
                  {cat.name}
                </h3>
                <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-400">
                  {cat.description || "Laporkan segera"}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Laporan Pengaduan Publik Terbaru */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#00417b]">Pengaduan Publik Terkini</h2>
            <p className="text-xs text-slate-500">
              Pantau laporan terkini warga di Kota Bandar Lampung
            </p>
          </div>
          <Link
            href="/lacak"
            className="text-xs font-semibold text-[#00417b] hover:underline"
          >
            Lihat Semua →
          </Link>
        </div>

        {loading ? (
          <LoadingSpinner message="Memuat daftar pengaduan terkini..." />
        ) : complaints.length === 0 ? (
          <EmptyState
            title="Belum Ada Pengaduan"
            description="Belum ada laporan pengaduan masyarakat yang diajukan ke sistem."
            actionText="Buat Pengaduan Pertama"
            actionHref="/pengaduan/baru"
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {complaints.map((item) => (
              <article
                key={item.id}
                className="spcs-card flex flex-col justify-between p-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-[#00417b]">
                      #{item.ticket_no}
                    </span>
                    <StatusBadge status={item.current_status} />
                  </div>
                  <h3 className="mt-2 text-sm font-bold text-slate-800 line-clamp-2">
                    {item.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                    {item.description}
                  </p>
                </div>

                <div className="mt-4 border-t border-slate-100 pt-3 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1 truncate max-w-[180px]">
                    <span className="material-symbols-outlined text-sm">location_on</span>
                    {item.address_text || "Kota Bandar Lampung"}
                  </span>
                  <Link
                    href={`/lacak?no=${encodeURIComponent(item.ticket_no)}`}
                    className="font-semibold text-[#00417b] hover:underline"
                  >
                    Detail Tiket
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

