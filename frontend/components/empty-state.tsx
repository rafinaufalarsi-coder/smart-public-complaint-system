import Link from "next/link";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: string;
  actionText?: string;
  actionHref?: string;
  onActionClick?: () => void;
}

export function EmptyState({
  title,
  description,
  icon = "inbox",
  actionText,
  actionHref,
  onActionClick,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/50 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <span className="material-symbols-outlined text-2xl">{icon}</span>
      </div>
      <h3 className="mt-3 text-sm font-bold text-slate-800">{title}</h3>
      <p className="mt-1 max-w-sm text-xs text-slate-500">{description}</p>
      {actionText && (
        <div className="mt-4">
          {actionHref ? (
            <Link
              href={actionHref}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#00417b] px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#0d59a1]"
            >
              {actionText}
            </Link>
          ) : (
            <button
              onClick={onActionClick}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#00417b] px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#0d59a1]"
            >
              {actionText}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

