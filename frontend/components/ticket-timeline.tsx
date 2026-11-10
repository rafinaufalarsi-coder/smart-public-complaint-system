import { TicketHistoryItem } from "@/lib/types";

interface TicketTimelineProps {
  history: TicketHistoryItem[];
  currentStatus: string;
}

export function TicketTimeline({ history, currentStatus }: TicketTimelineProps) {
  if (!history || history.length === 0) {
    return (
      <p className="text-xs text-slate-400 italic">
        Belum ada catatan riwayat status untuk tiket ini.
      </p>
    );
  }

  return (
    <div className="relative border-l-2 border-blue-200 pl-4 py-2 space-y-6">
      {history.map((item, idx) => {
        const isCurrent = item.status === currentStatus && idx === history.length - 1;

        return (
          <div key={item.id} className="relative">
            {/* Dot Indicator */}
            <span
              className={`absolute -left-[23px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                isCurrent
                  ? "border-[#00417b] bg-[#feae2c] shadow-xs"
                  : "border-blue-400 bg-white"
              }`}
            />

            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="font-mono text-xs font-bold text-[#00417b]">
                Tahap {item.status}
              </span>
              <time className="text-[11px] text-slate-400">
                {new Date(item.created_at).toLocaleString("id-ID", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </time>
            </div>

            {item.note && (
              <p className="mt-1 text-sm font-medium text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                {item.note}
              </p>
            )}

            <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500">
              {item.actor_name && (
                <span>
                  Oleh: <strong className="text-slate-700">{item.actor_name}</strong>{" "}
                  {item.actor_role ? `(${item.actor_role})` : ""}
                </span>
              )}
              {item.progress_percent !== null && item.progress_percent !== undefined && (
                <span className="font-semibold text-[#00417b]">
                  Progres: {item.progress_percent}%
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

