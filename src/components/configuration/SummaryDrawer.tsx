import { Pencil, X } from "lucide-react";
import type { CardExplain } from "@/lib/configExplain";
import { ExplainSection } from "./ExplainSection";

type Props = {
  label: string;
  value: string;
  /** True for calculated cards (Total, Supplier Margin OH, Grand Total). */
  derived?: boolean;
  /** calculation + business rule shown in a collapsible block */
  explain?: CardExplain;
  onClose: () => void;
  onEdit?: () => void;
};


/** Read-only drawer for a Configuration Summary card. */
export function SummaryDrawer({ label, value, derived = false, explain, onClose, onEdit }: Props) {

  return (
    <aside className="flex h-full w-full flex-col border-l border-hairline bg-surface">
      <header className="flex items-start justify-between gap-3 border-b border-hairline px-5 py-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-ink-400">
            Summary <span className="text-ink-300">/</span>{" "}
            <span className="text-brand-700">{label}</span>
          </div>
          <h2 className="mt-0.5 truncate text-[15px] font-medium text-ink-900">{label}</h2>
          <p className="mt-0.5 text-[12px] text-ink-500">
            {derived
              ? "Read only — calculated from the configured modules."
              : "Read only — edit the module to change this total."}
          </p>

        </div>
        <button
          onClick={onClose}
          aria-label="Close summary"
          className="rounded-md p-1 text-ink-400 hover:bg-surface-alt hover:text-ink-900"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="rounded-xl border border-hairline bg-surface-alt p-4">
          <div className="text-[10.5px] uppercase tracking-[0.12em] text-ink-400">
            {label} / piece
          </div>
          <div className="mt-1 text-[26px] font-semibold leading-none tracking-tight tabular-nums text-ink-900">
            {value}
          </div>
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-ink-500">
          {derived
            ? "This is a calculated value from the configuration chain — it updates automatically whenever any module changes, and is carried into the Costing workspace."
            : `This value rolls up from the ${label.replace(" Total", "")} configuration and updates automatically whenever that module changes.`}
        </p>

        {explain && <ExplainSection explain={explain} />}
      </div>


      <footer className="flex items-center gap-2 border-t border-hairline px-5 py-3">
        <button
          onClick={onClose}
          className="rounded-md border border-hairline px-3 py-2 text-[13px] text-ink-600 hover:bg-surface-alt"
        >
          Close
        </button>
        {onEdit && (
          <button
            onClick={onEdit}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-4 py-2 text-[13px] font-medium text-white hover:bg-brand-800"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit {label.replace(" Total", "")}
          </button>
        )}
      </footer>
    </aside>
  );

}
