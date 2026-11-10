"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clearStoredSession, getStoredUser } from "@/lib/auth";
import { UserProfile } from "@/lib/types";

type LogoProps = { src?: string; alt: string; fallback: string };

function InstitutionalLogo({ src, alt, fallback }: LogoProps) {
  const [hasError, setHasError] = useState(false);

  if (src && !hasError) {
    return (
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-contain"
          onError={() => setHasError(true)}
        />
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={alt}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-slate-100 text-[10px] font-extrabold tracking-tight text-[#00417b] shadow-xs"
    >
      {fallback}
    </div>
  );
}

export function BrandHeader({
  subtitle = "Sistem Pengaduan Masyarakat Cerdas",
}: {
  subtitle?: string;
}) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  function handleLogout() {
    clearStoredSession();
    setUser(null);
    window.location.href = "/";
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-xs backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        {/* Bagian Branding & Dual Logo */}
        <Link href="/" className="flex min-w-0 items-center gap-3 transition hover:opacity-90">
          <div className="flex items-center gap-2">
            <InstitutionalLogo
              src={process.env.NEXT_PUBLIC_PEMDA_LOGO}
              alt="Logo Pemerintah Daerah Kota Bandar Lampung"
              fallback="PEMDA"
            />
            <span className="h-7 w-px bg-slate-300" />
            <InstitutionalLogo
              src={process.env.NEXT_PUBLIC_UTI_LOGO}
              alt="Logo Universitas Teknokrat Indonesia"
              fallback="UTI"
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-[#00417b]">
              SPCS Bandar Lampung
            </p>
            <p className="hidden truncate text-xs text-slate-500 sm:block">
              {subtitle}
            </p>
          </div>
        </Link>

        {/* Navigasi Desktop */}
        <nav className="hidden items-center gap-1 md:flex">
          <Link
            href="/"
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-[#00417b]"
          >
            Beranda
          </Link>
          <Link
            href="/pengaduan/baru"
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-[#00417b]"
          >
            Buat Laporan
          </Link>
          <Link
            href="/lacak"
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-[#00417b]"
          >
            Lacak Tiket
          </Link>
          {user && (
            <Link
              href="/pengaduan/saya"
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-[#00417b]"
            >
              Laporan Saya
            </Link>
          )}
          {user && (user.role === "officer" || user.role === "admin") && (
            <Link
              href="/petugas/tugas"
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-50"
            >
              Portal Petugas
            </Link>
          )}
          {user && user.role === "admin" && (
            <Link
              href="/admin/dashboard"
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-blue-900 transition hover:bg-blue-50"
            >
              Admin Dinas
            </Link>
          )}
        </nav>

        {/* Autentikasi Profile & Tombol Hamburger Mobile */}
        <div className="flex items-center gap-2">
          {user ? (
            <div className="flex items-center gap-2">
              <div className="hidden text-right sm:block">
                <p className="text-xs font-bold text-slate-800">{user.full_name}</p>
                <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  {user.role} {user.agency_name ? `(${user.agency_name})` : ""}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
              >
                Keluar
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/auth/login"
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[#00417b] transition hover:bg-slate-100"
              >
                Masuk
              </Link>
              <Link
                href="/auth/register"
                className="rounded-lg bg-[#00417b] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#0d59a1]"
              >
                Daftar
              </Link>
            </div>
          )}

          {/* Tombol Hamburger (Khusus Mobile) */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 md:hidden"
            aria-label="Toggle Menu"
          >
            <span className="material-symbols-outlined text-xl">
              {mobileMenuOpen ? "close" : "menu"}
            </span>
          </button>
        </div>
      </div>

      {/* Dropdown Menu Mobile */}
      {mobileMenuOpen && (
        <div className="mt-3 border-t border-slate-200 pt-3 md:hidden space-y-1">
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Beranda
          </Link>
          <Link
            href="/pengaduan/baru"
            onClick={() => setMobileMenuOpen(false)}
            className="block rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Buat Laporan Baru
          </Link>
          <Link
            href="/lacak"
            onClick={() => setMobileMenuOpen(false)}
            className="block rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Lacak Status Tiket
          </Link>
          {user && (
            <Link
              href="/pengaduan/saya"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Laporan Pengaduan Saya
            </Link>
          )}
          {user && (user.role === "officer" || user.role === "admin") && (
            <Link
              href="/petugas/tugas"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg px-3 py-2 text-xs font-semibold text-amber-900 bg-amber-50/50"
            >
              Portal Petugas Lapangan
            </Link>
          )}
          {user && user.role === "admin" && (
            <Link
              href="/admin/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg px-3 py-2 text-xs font-semibold text-blue-900 bg-blue-50/50"
            >
              Dashboard Admin Dinas
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
