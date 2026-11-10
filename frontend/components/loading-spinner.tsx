export function LoadingSpinner({
  message = "Memuat data...",
}: {
  message?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-3">
      <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-200 border-t-[#00417b]" />
      <p className="text-xs font-medium text-slate-500">{message}</p>
    </div>
  );
}

