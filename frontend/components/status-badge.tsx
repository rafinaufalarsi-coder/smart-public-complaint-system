const statusLabels: Record<string, string> = {
  S01: "Terkirim ke Sistem",
  S02: "Pemeriksaan Admin",
  S03: "Perlu Revisi",
  S04: "Ditolak",
  S05: "Validasi Dinas",
  S06: "Baru Ditugaskan",
  S07: "Penanganan Teknis Lapangan",
  S08: "Menunggu Konfirmasi",
  S09: "Selesai & Diarsipkan",
  S10: "Dibatalkan Pelapor",
};

const statusStyles: Record<string, string> = {
  S01: "bg-blue-50 text-blue-800 border-blue-200",
  S02: "bg-sky-50 text-sky-800 border-sky-200",
  S03: "bg-orange-50 text-orange-800 border-orange-200",
  S04: "bg-red-50 text-red-800 border-red-200",
  S05: "bg-indigo-50 text-indigo-800 border-indigo-200",
  S06: "bg-cyan-50 text-cyan-900 border-cyan-200",
  S07: "bg-amber-50 text-amber-900 border-amber-300",
  S08: "bg-emerald-50 text-emerald-800 border-emerald-200",
  S09: "bg-slate-100 text-slate-700 border-slate-300",
  S10: "bg-rose-50 text-rose-800 border-rose-200",
};

export function StatusBadge({ status }: { status: string }) {
  const label = statusLabels[status] ?? `${status} · Tahap Belum Dikonfigurasi`;
  const style =
    statusStyles[status] ?? "bg-slate-100 text-slate-700 border-slate-300";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-75" />
      {status} · {label}
    </span>
  );
}

