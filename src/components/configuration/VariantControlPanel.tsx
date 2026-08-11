// VariantControlPanel — the docked left panel from the earlier versions:
// Pricing variants (MOQ · Size · Quality) + Commercial variables, with the
// live output pinned to the bottom. Everything here writes into the same
// ConfigState the canvas edits, so the running total stays in sync.

import { useState } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALL_CARDS, inr, type ConfigState } from "@/lib/fabricConfig";

export type Commercials = {
  fxRate: number;
  marginPct: number;
  buyerTargetUsd: number;
};

type Props = {
  variantName: string;
  state: ConfigState;
  directTotal: number;
  commercials: Commercials;
  onCommercials: (patch: Partial<Commercials>) => void;
  onApply: (cardId: string, value: { value: string; optionId?: string; rate?: number }) => void;
};

const MOQ_OPTIONS = ["500", "1000", "2000", "5000", "10000"];
const SIZE_OPTIONS = ["33 × 48 cm", "40 × 40 cm", "45 × 45 cm", "18\" × 18\""];

export function VariantControlPanel({
  variantName,
  state,
  directTotal,
  commercials,
  onCommercials,
  onApply,
}: Props) {
  const qty = state.orderQty?.value ?? "—";
  const size = state.sizeSpec?.value ?? "—";
  const quality = state.gsm?.value ?? "—";

  const sellingInr = directTotal / Math.max(1 - commercials.marginPct, 0.05);
  const sellingUsd = sellingInr / commercials.fxRate;
  const onTarget = sellingUsd <= commercials.buyerTargetUsd;

  const gsmCard = ALL_CARDS.find((c) => c.id === "gsm");

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-r border-hairline bg-surface">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Pricing variants */}
        <section className="border-b border-hairline px-3 py-3">
          <div className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-500">
            Pricing variants
          </div>
          <div className="mt-0.5 text-[11px] text-ink-400">
            applies to <span className="text-ink-700">{variantName}</span>
          </div>

          <div className="mt-2.5 space-y-2">
            <ChipGroup
              label="MOQ"
              value={`${Number(qty).toLocaleString("en-IN")} pcs`}
              caption="Volume tier — setup amortised"
              options={MOQ_OPTIONS.map((o) => ({
                id: o,
                label: `${Number(o).toLocaleString("en-IN")} pcs`,
                active: o === qty,
              }))}
              onSelect={(id) => onApply("orderQty", { value: id })}
              onCustom={(v) => onApply("orderQty", { value: v.replace(/[^0-9]/g, "") })}
              customPlaceholder="Custom qty"
            />
            <ChipGroup
              label="Size"
              value={size}
              caption="Finished size drives consumption"
              options={SIZE_OPTIONS.map((o) => ({ id: o, label: o, active: o === size }))}
              onSelect={(id) => onApply("sizeSpec", { value: id })}
              onCustom={(v) => onApply("sizeSpec", { value: v })}
              customPlaceholder="Custom size"
            />
            <ChipGroup
              label="Quality"
              value={quality}
              caption="GSM band — changes the fabric rate"
              options={(gsmCard?.options ?? []).map((o) => ({
                id: o.id,
                label: o.label,
                active: o.label === quality,
              }))}
              onSelect={(id) => {
                const o = gsmCard?.options?.find((x) => x.id === id);
                if (o) onApply("gsm", { value: o.label, optionId: o.id, rate: o.rate });
              }}
            />
          </div>
        </section>

        {/* Commercial variables */}
        <section className="px-3 py-3">
          <div className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-500">
            Commercial variables
          </div>
          <div className="mt-2 space-y-2 text-[12px]">
            <EditableRow
              label="FX rate"
              value={`₹${commercials.fxRate}/$`}
              options={["₹86", "₹88", "₹90", "₹92"]}
              onSelect={(v) => onCommercials({ fxRate: Number(v.replace(/[^0-9.]/g, "")) })}
            />
            <EditableRow
              label="Target margin"
              value={`${Math.round(commercials.marginPct * 100)}%`}
              options={["22%", "26%", "30%", "34%"]}
              onSelect={(v) => onCommercials({ marginPct: Number(v.replace(/[^0-9.]/g, "")) / 100 })}
            />
            <div className="flex items-center justify-between border-t border-hairline pt-2">
              <span className="text-ink-500">Buyer target</span>
              <span className="tabular-nums text-ink-900">
                ${commercials.buyerTargetUsd.toFixed(2)}
              </span>
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-400">
            Commercial variables are indicative only — they never enter the direct manufacturing
            cost.
          </p>
        </section>
      </div>

      {/* Live output */}
      <div className="shrink-0 border-t border-hairline bg-surface-alt px-3 py-2.5">
        <div className="flex items-baseline justify-between">
          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-500">
            Live output
          </div>
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
              onTarget ? "bg-brand-50 text-brand-700" : "bg-ink-100 text-ink-600",
            )}
          >
            {onTarget ? "On target" : "Above target"}
          </span>
        </div>
        <div className="mt-1 grid grid-cols-3 gap-2">
          <Cell label="Direct" value={inr(directTotal)} sub="/pc" />
          <Cell
            label="Selling"
            value={`$${sellingUsd.toFixed(2)}`}
            sub={`tgt $${commercials.buyerTargetUsd.toFixed(2)}`}
          />
          <Cell label="Margin" value={`${Math.round(commercials.marginPct * 100)}%`} sub="target" />
        </div>
      </div>
    </aside>
  );
}

function ChipGroup({
  label,
  value,
  caption,
  options,
  onSelect,
  onCustom,
  customPlaceholder,
}: {
  label: string;
  value: string;
  caption: string;
  options: { id: string; label: string; active: boolean }[];
  onSelect: (id: string) => void;
  onCustom?: (v: string) => void;
  customPlaceholder?: string;
}) {
  const [open, setOpen] = useState(label === "MOQ");
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState("");

  return (
    <div className="rounded-lg border border-hairline bg-surface">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left"
      >
        <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink-900">
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {label}
        </span>
        <span className="truncate text-[12px] tabular-nums text-ink-600">{value}</span>
      </button>
      {open && (
        <div className="px-2.5 pb-2.5">
          <p className="text-[10.5px] text-ink-400">{caption}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {options.map((o) => (
              <button
                key={o.id}
                onClick={() => onSelect(o.id)}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[11.5px] transition-colors",
                  o.active
                    ? "border-brand-700 bg-brand-50 font-medium text-brand-700"
                    : "border-hairline text-ink-600 hover:bg-surface-alt",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          {onCustom &&
            (custom ? (
              <div className="mt-1.5 flex gap-1.5">
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={customPlaceholder}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && draft.trim()) {
                      onCustom(draft.trim());
                      setDraft("");
                      setCustom(false);
                    }
                    if (e.key === "Escape") setCustom(false);
                  }}
                  className="min-w-0 flex-1 rounded-md border border-hairline px-2 py-1 text-[11.5px] outline-none focus:border-brand-700"
                />
                <button
                  onClick={() => {
                    if (draft.trim()) onCustom(draft.trim());
                    setDraft("");
                    setCustom(false);
                  }}
                  className="rounded-md bg-brand-700 px-2 py-1 text-[11.5px] font-medium text-white"
                >
                  Add
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCustom(true)}
                className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] text-ink-500 hover:text-brand-700"
              >
                <Plus className="h-3 w-3" /> Custom
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

function EditableRow({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: string;
  options: string[];
  onSelect: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex items-center justify-between gap-2">
      <span className="text-ink-500">{label}</span>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-md border border-hairline bg-surface px-2 py-0.5 text-[11.5px] tabular-nums text-ink-900 hover:border-ink-300"
      >
        {value}
        <ChevronRight className={cn("h-3 w-3 transition-transform", open && "rotate-90")} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-32 rounded-md border border-hairline bg-surface p-1 shadow-lg">
            {options.map((o) => (
              <button
                key={o}
                onClick={() => {
                  onSelect(o);
                  setOpen(false);
                }}
                className="block w-full rounded-sm px-2 py-1 text-left text-[12px] hover:bg-surface-alt"
              >
                {o}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Cell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[9.5px] font-medium uppercase tracking-wide text-ink-500">
        {label}
      </div>
      <div className="truncate text-[14px] font-semibold tabular-nums text-ink-900">{value}</div>
      {sub && <div className="truncate text-[10px] text-ink-400">{sub}</div>}
    </div>
  );
}
