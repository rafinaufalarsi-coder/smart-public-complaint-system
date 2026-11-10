"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { apiRequest } from "@/lib/api";
import { setStoredSession } from "@/lib/auth";
import { AuthResponse } from "@/lib/types";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await apiRequest<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      setStoredSession(res.data.access_token, res.data.user);

      // Redirect otomatis sesuai peran pengguna
      if (res.data.user.role === "admin") {
        window.location.href = "/admin/dashboard";
      } else if (res.data.user.role === "officer") {
        window.location.href = "/petugas/tugas";
      } else {
        window.location.href = "/pengaduan/saya";
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal melakukan login.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center py-6">
      <div className="spcs-card w-full p-6 sm:p-8">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-[#00417b]">
            <span className="material-symbols-outlined text-2xl">lock</span>
          </div>
          <h1 className="mt-3 text-xl font-bold text-slate-900">
            Masuk ke Akun Anda
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Gunakan email dan password terdaftar untuk mengakses layanan SPCS
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700"
          >
            <span className="material-symbols-outlined text-base">error</span>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Alamat Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#00417b] focus:outline-hidden focus:ring-1 focus:ring-[#00417b]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Kata Sandi (Password)
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 8 karakter"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#00417b] focus:outline-hidden focus:ring-1 focus:ring-[#00417b]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#00417b] py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#0d59a1] disabled:opacity-50"
          >
            {loading ? "Memverifikasi..." : "Masuk ke Sistem"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Belum memiliki akun?{" "}
          <Link
            href="/auth/register"
            className="font-bold text-[#00417b] hover:underline"
          >
            Daftar Akun Warga
          </Link>
        </p>
      </div>
    </div>
  );
}

