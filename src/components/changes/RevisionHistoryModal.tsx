// RevisionHistoryModal — full-screen popup showing a selected revision in
// read-only mode. Left: Product / Configuration / Costing / Costing Report as
// tabs with the replicated (non-interactive) data. Right: revision history with
// a version dropdown and the requested changes grouped by step; clicking a
// change jumps to that step and highlights the changed field.

import { useMemo, useState } from "react";
import { ArrowRight, ChevronDown, History, Lock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CHANGE_STEPS,
  stepForModule,
  useRequestedChanges,
  type ChangeStep,
  type RequestedChange,
} from "@/lib/requestedChangesStore";

type Row = { label: string; value: string };
type Section = { title: string; rows: Row[] };

const READ_ONLY_DATA: Record<ChangeStep, Section[]> = {
  Product: [
    {
      title: "Product details",
      rows: [
        { label: "Product", value: "Bath Towel 500 GSM" },
        { label: "Article #", value: "ART-4471-A" },
        { label: "Design #", value: "DSN-2210" },
        { label: "Style #", value: "STY-118" },
        { label: "Colour", value: "Ivory / Sand" },
        { label: "Size", value: '70 × 140 cm' },
        { label: "MOQ", value: "5,000 pcs" },
        { label: "Supplier", value: "Karur Mills" },
        { label: "Currency", value: "USD" },
        { label: "Exchange rate", value: "83.20" },
      ],
    },
  ],
  Configuration: [
    {
      title: "Fabric",
      rows: [
        { label: "Supplier", value: "ABC Textiles" },
        { label: "Fabric rate", value: "₹182.00 / m" },
        { label: "Consumption", value: "1.42 m" },
        { label: "Fabric wastage %", value: "3.0%" },
        { label: "Fabric total", value: "₹266.10" },
      ],
    },
    {
      title: "Printing · Embroidery · Washing",
      rows: [
        { label: "Printing total", value: "₹6.40" },
        { label: "Embroidery total", value: "₹0.00" },
        { label: "Washing total", value: "₹4.20" },
      ],
    },
    {
      title: "Manufacturing · Accessories",
      rows: [
        { label: "Cutting cost", value: "₹2.40" },
        { label: "Stitching cost", value: "₹16.50" },
        { label: "Accessories total", value: "₹0.00" },
        { label: "Material total", value: "₹295.60" },
      ],
    },
  ],
  Costing: [
    {
      title: "Commercial variables",
      rows: [
        { label: "MOQ", value: "5,000 pcs" },
        { label: "Quality", value: "500 GSM" },
        { label: "Target margin", value: "24.0%" },
        { label: "Supplier margin OH", value: "12.0%" },
      ],
    },
    {
      title: "Commercial pricing",
      rows: [
        { label: "Product cost", value: "₹277.20" },
        { label: "Commercial cost", value: "₹30.94" },
        { label: "Grand total", value: "₹308.14" },
        { label: "Quote / pc", value: "$6.07" },
      ],
    },
  ],
  "Costing Report": [
    {
      title: "Executive summary",
      rows: [
        { label: "Recommended variant", value: "Value engineered" },
        { label: "Quote / pc", value: "$6.07" },
        { label: "Margin", value: "24.0%" },
        { label: "Confidence", value: "86%" },
        { label: "Commercial health", value: "Strong" },
      ],
    },
  ],
};

export function RevisionHistoryModal({ onClose }: { onClose: () => void }) {
  const { revisions, changes, workingVersion } = useRequestedChanges();
  const versions = useMemo(() => [...revisions].sort((a, b) => b.version - a.version), [revisions]);
  const current = workingVersion ?? versions[0]?.version ?? 1;
  const [version, setVersion] = useState<number>(current);
  const [pickerOpen, setPickerOpen] = useState(false);

  const groups = useMemo(
    () =>
      CHANGE_STEPS.map((step) => ({
        step,
        items: changes.filter((c) => stepForModule(c.module) === step),
      })).filter((g) => g.items.length > 0),
    [changes],
  );

  // Land on the first step that actually changed in this revision.
  const [tab, setTab] = useState<ChangeStep>(groups[0]?.step ?? "Product");
  const firstChangeId = groups[0]?.items[0]?.id ?? null;
  const [highlight, setHighlight] = useState<string | null>(
    groups[0]?.items[0]?.field.toLowerCase() ?? null,
  );
  const [selectedId, setSelectedId] = useState<string | null>(firstChangeId);

  const selected = versions.find((v) => v.version === version);
  const changedFields = new Set(
    changes.filter((c) => stepForModule(c.module) === tab).map((c) => c.field.toLowerCase()),
  );

  const jump = (c: RequestedChange) => {
    setTab(stepForModule(c.module));
    setHighlight(c.field.toLowerCase());
    setSelectedId(c.id);
  };


  return (
    <div className="fixed inset-0 z-[95] flex flex-col bg-canvas">
      <header className="flex shrink-0 items-center gap-3 border-b border-hairline bg-surface px-6 py-3">
        <History className="h-4 w-4 text-ink-500" />
        <div>
          <h2 className="text-[15px] font-semibold text-ink-900">Revision history</h2>
          <p className="text-[11.5px] text-ink-500">
            Read-only snapshot of Version {version}
            {selected ? ` · ${selected.status}` : ""}
          </p>
        </div>
        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-[11px] text-ink-600">
          <Lock className="h-3 w-3" /> read only
        </span>
        <button
          onClick={onClose}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 py-2 text-[13px] text-ink-700 hover:bg-surface-alt"
        >
          <X className="h-4 w-4" /> Cancel
        </button>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* LEFT — replicated steps as tabs */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center gap-1.5 border-b border-hairline bg-surface px-6 py-2.5">
            {CHANGE_STEPS.map((s) => {
              const count = changes.filter((c) => stepForModule(c.module) === s).length;
              return (
                <button
                  key={s}
                  onClick={() => {
                    setTab(s);
                    setHighlight(null);
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                    tab === s
                      ? "bg-ink-900 text-white"
                      : "border border-hairline bg-surface text-ink-600 hover:bg-surface-alt",
                  )}
                >
                  {s}
                  {count > 0 && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-[10.5px] tabular-nums",
                        tab === s ? "bg-white/20 text-white" : "bg-red-50 text-red-700",
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            <div className="mx-auto max-w-[860px] space-y-5">
              {READ_ONLY_DATA[tab].map((sec) => (
                <section
                  key={sec.title}
                  className="overflow-hidden rounded-xl border border-hairline bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
                >
                  <div className="border-b border-hairline px-5 py-3">
                    <h3 className="text-[13.5px] font-semibold text-ink-900">{sec.title}</h3>
                  </div>
                  <dl>
                    {sec.rows.map((r) => {
                      const key = r.label.toLowerCase();
                      const changed = changedFields.has(key);
                      const isHit = highlight === key;
                      return (
                        <div
                          key={r.label}
                          className={cn(
                            "flex items-baseline justify-between gap-4 border-b border-hairline/70 px-5 py-2.5 last:border-0 transition-colors",
                            changed && "bg-amber-50/60",
                            isHit && "bg-brand-50 ring-1 ring-inset ring-brand-300",
                          )}
                        >
                          <dt className="text-[12.5px] text-ink-500">
                            {r.label}
                            {changed && (
                              <span className="ml-2 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                                changed in V{version}
                              </span>
                            )}
                          </dt>
                          <dd className="text-[13px] font-medium tabular-nums text-ink-900">{r.value}</dd>
                        </div>
                      );
                    })}
                  </dl>
                </section>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT — revision panel with version dropdown */}
        <aside className="hidden w-[364px] shrink-0 flex-col border-l border-hairline bg-white lg:flex">
          <div className="shrink-0 border-b border-hairline px-4 py-3">
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-500">
              Version
            </div>
            <div className="relative mt-1">
              <button
                onClick={() => setPickerOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-2 rounded-md border border-hairline bg-surface px-3 py-2 text-[13px] text-ink-900 hover:bg-surface-alt"
              >
                <span>
                  Version {version}
                  {version === current && (
                    <span className="ml-2 rounded-full bg-brand-50 px-1.5 py-0.5 text-[10.5px] font-medium text-brand-800">
                      current
                    </span>
                  )}
                </span>
                <ChevronDown className="h-4 w-4 text-ink-400" />
              </button>
              {pickerOpen && (
                <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-10 overflow-hidden rounded-md border border-hairline bg-surface shadow-lg">
                  {versions.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => {
                        setVersion(v.version);
                        setPickerOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[12.5px] hover:bg-surface-alt",
                        v.version === version && "bg-surface-alt",
                      )}
                    >
                      <span className="text-ink-900">Version {v.version}</span>
                      <span className="text-[11px] text-ink-500">{v.status}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selected && (
              <p className="mt-2 text-[11.5px] leading-relaxed text-ink-500">
                {selected.comments}
                <span className="mt-0.5 block text-ink-400" suppressHydrationWarning>
                  {selected.createdBy} · {selected.createdAt}
                </span>
              </p>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-500">
              Changes in this version
            </div>
            <div className="mt-2 space-y-4">
              {groups.map((g) => (
                <div key={g.step}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="text-[12px] font-semibold text-ink-900">{g.step}</span>
                    <span className="rounded-full bg-ink-100 px-1.5 py-0.5 text-[10.5px] tabular-nums text-ink-600">
                      {g.items.length}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {g.items.map((c) => {
                      const isSel = selectedId === c.id;
                      return (
                        <button
                          key={c.id}
                          onClick={() => jump(c)}
                          className={cn(
                            "group w-full rounded-lg border px-3 py-2 text-left transition-colors",
                            isSel
                              ? "border-brand-700 bg-brand-50/70 shadow-[0_1px_0_rgba(0,0,0,0.02)]"
                              : "border-hairline bg-surface hover:border-brand-700/40 hover:bg-brand-50/40",
                          )}
                        >
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                                isSel ? "bg-brand-700 text-white" : "bg-ink-100 text-ink-600",
                              )}
                            >
                              {c.module}
                            </span>
                            <span className="truncate text-[12.5px] font-medium text-ink-900">
                              {c.field}
                            </span>
                            <ArrowRight
                              className={cn(
                                "ml-auto h-3.5 w-3.5 shrink-0 transition-opacity",
                                isSel
                                  ? "text-brand-700 opacity-100"
                                  : "text-ink-400 opacity-0 group-hover:opacity-100",
                              )}
                            />
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 text-[11.5px] tabular-nums">
                            <span className="rounded bg-ink-100/70 px-1.5 py-0.5 text-ink-600 line-through decoration-ink-400/60">
                              {c.currentValue}
                            </span>
                            <span className="text-ink-400">→</span>
                            <span className="rounded bg-brand-700/10 px-1.5 py-0.5 font-medium text-brand-800">
                              {c.requestedValue}
                            </span>
                          </div>
                          <div className="mt-1 truncate text-[11px] italic text-ink-500">
                            "{c.comment}"
                          </div>
                          <div className="mt-1 text-[10.5px] text-ink-400">
                            {c.requestedBy} · {c.requestedRole}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
