interface StatCardProps {
  label: string;
  value: string | number;
  icon?: string;
  trend?: string;
  variant?: "primary" | "warning" | "success" | "danger" | "default";
}

export function StatCard({
  label,
  value,
  icon,
  trend,
  variant = "default",
}: StatCardProps) {
  const variantStyles = {
    primary: "border-blue-200 bg-blue-50/50 text-[#00417b]",
    warning: "border-amber-200 bg-amber-50/50 text-amber-900",
    success: "border-emerald-200 bg-emerald-50/50 text-emerald-900",
    danger: "border-rose-200 bg-rose-50/50 text-rose-900",
    default: "border-slate-200 bg-white text-slate-800",
  };

  return (
    <div
      className={`spcs-card flex items-center justify-between p-4 ${variantStyles[variant]}`}
    >
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {label}
        </p>
        <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
        {trend && <p className="mt-1 text-[11px] text-slate-500">{trend}</p>}
      </div>
      {icon && (
        <span className="material-symbols-outlined text-3xl opacity-80">
          {icon}
        </span>
      )}
    </div>
  );
}

