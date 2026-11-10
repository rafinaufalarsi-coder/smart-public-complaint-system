"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { apiRequest } from "@/lib/api";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleRegister(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Konfirmasi kata sandi tidak cocok.");
      return;
    }
    if (password.length < 8) {
      setError("Kata sandi minimal harus 8 karakter.");
      return;
    }

    setLoading(true);

    try {
      await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          full_name: fullName,
          email,
          phone: phone || null,
          password,
        }),
      });

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mendaftarkan akun.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center py-6">
      <div className="spcs-card w-full p-6 sm:p-8">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-[#00417b]">
            <span className="material-symbols-outlined text-2xl">person_add</span>
          </div>
          <h1 className="mt-3 text-xl font-bold text-slate-900">
            Pendaftaran Warga
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Daftarkan diri Anda untuk menyampaikan aspirasi dan laporan publik
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

        {success ? (
          <div className="mt-6 text-center space-y-4">
            <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <span className="material-symbols-outlined text-3xl">check_circle</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Pendaftaran Berhasil!
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                Akun warga Anda telah berhasil dibuat. Silakan masuk untuk mulai membuat pengaduan.
              </p>
            </div>
            <Link
              href="/auth/login"
              className="inline-block w-full rounded-lg bg-[#00417b] py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#0d59a1]"
            >
              Masuk Sekarang
            </Link>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="mt-5 space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Nama Lengkap (Sesuai KTP)
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nama Lengkap"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#00417b] focus:outline-hidden focus:ring-1 focus:ring-[#00417b]"
              />
            </div>

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
                Nomor Telepon / WhatsApp
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0812XXXXXXXX (Opsional)"
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
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 8 karakter"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#00417b] focus:outline-hidden focus:ring-1 focus:ring-[#00417b]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Konfirmasi Kata Sandi
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ketik ulang kata sandi"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#00417b] focus:outline-hidden focus:ring-1 focus:ring-[#00417b]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-lg bg-[#00417b] py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#0d59a1] disabled:opacity-50"
            >
              {loading ? "Mendaftarkan..." : "Daftar Akun Warga"}
            </button>
          </form>
        )}

        {!success && (
          <p className="mt-6 text-center text-xs text-slate-500">
            Sudah memiliki akun?{" "}
            <Link
              href="/auth/login"
              className="font-bold text-[#00417b] hover:underline"
            >
              Masuk di sini
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

