import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** Right-hand side drawer used across the article / kit intake flows. */
export function DrawerShell({
  open,
  onClose,
  title,
  subtitle,
  width = "max-w-[1100px]",
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  width?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-ink-900/30 backdrop-blur-[1px]" onClick={onClose} />
      <aside
        className={cn("flex h-full w-full flex-col bg-surface shadow-2xl", width)}
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-ink-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[12px] text-ink-500">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded p-1.5 text-ink-500 hover:bg-surface-alt hover:text-ink-900"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex-1 overflow-auto">{children}</div>
        {footer && (
          <footer className="flex items-center justify-between gap-3 border-t border-hairline bg-surface-alt/60 px-5 py-3">
            {footer}
          </footer>
        )}
      </aside>
    </div>
  );
}

export function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const tone =
    value >= 0.85
      ? "bg-emerald-50 text-emerald-700"
      : value >= 0.6
        ? "bg-amber-50 text-amber-700"
        : "bg-danger-50 text-danger-600";
  return (
    <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums", tone)}>{pct}%</span>
  );
}
