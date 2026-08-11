// FabricComponents — component-level fabric breakdown inside Raw Material.
// The Main Body component is derived live from the fabric cards; every other
// component (Filling, Interlining, Border, Piping…) is a real, named,
// pre-costed row that opens the same popup used everywhere else in the
// workspace to configure it — no inline forms, no bespoke pattern here.

import { useState } from "react";
import { ChevronRight, Lock, Plus, Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { inr } from "@/lib/fabricConfig";
import {
  COMPONENT_PRESETS,
  componentCost,
  componentsCost,
  type FabricComponent,
} from "@/lib/configTree";
import { ComponentOptionModal } from "./ComponentOptionModal";

type Props = {
  components: FabricComponent[];
  /** which per-component process assignment this view exposes, if any */
  assign?: "printing" | "embroidery";
  onChange: (id: string, patch: Partial<FabricComponent>) => void;
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
  /** open the fabric card that feeds the derived main component */
  onEditDerived?: () => void;
};

export function FabricComponents({
  components,
  assign,
  onChange,
  onAdd,
  onRemove,
  onEditDerived,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [configuringId, setConfiguringId] = useState<string | null>(null);
  const subtotal = componentsCost(components);
  const configuring = components.find((c) => c.id === configuringId) ?? null;

  const add = (value: string) => {
    const v = value.trim();
    if (!v) return;
    onAdd(v);
    setName("");
    setAdding(false);
  };

  const clearOption = (id: string) => {
    onChange(id, {
      optionId: undefined,
      spec: "Not configured",
      width: 0,
      consumption: 0,
      wastage: 0,
      rate: 0,
    });
  };

  return (
    <aside className="flex w-full flex-col border-r border-hairline bg-surface">
      <header className="shrink-0 border-b border-hairline px-4 py-3.5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[13px] font-semibold text-ink-900">Fabric components</h2>
          <span className="text-[11px] text-ink-400">{components.length} components</span>
        </div>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-500">
          {assign
            ? `Assign ${assign} to the components it applies to.`
            : "Every component is pre-costed — click one to change its option."}
        </p>
        <div className="mt-2.5 flex items-baseline justify-between rounded-lg bg-surface-alt px-3 py-2">
          <span className="text-[11px] uppercase tracking-[0.1em] text-ink-400">
            Fabric subtotal
          </span>
          <span className="text-[15px] font-semibold tabular-nums text-ink-900">
            {inr(subtotal)}
          </span>
        </div>
      </header>

      <div className="space-y-2 px-4 py-3">
        {components.map((c) => {
          const configured = c.derived || Boolean(c.optionId);
          return (
            <div
              key={c.id}
              className="rounded-xl border border-hairline bg-surface transition-colors hover:border-ink-200"
            >
              <button
                type="button"
                onClick={() => !c.derived && setConfiguringId(c.id)}
                disabled={c.derived}
                className={cn(
                  "flex w-full items-start justify-between gap-2 p-3 text-left",
                  !c.derived && "cursor-pointer",
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] font-medium text-ink-900">{c.name}</span>
                    {c.derived && <Lock className="h-3 w-3 shrink-0 text-ink-300" />}
                  </div>
                  <p
                    className={cn(
                      "mt-0.5 truncate text-[11px]",
                      configured ? "text-ink-500" : "text-ink-400",
                    )}
                  >
                    {configured ? c.spec : "Not configured — click to choose an option"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span
                    className={cn(
                      "text-[13px] font-semibold tabular-nums",
                      configured ? "text-ink-900" : "text-ink-300",
                    )}
                  >
                    {inr(componentCost(c))}
                  </span>
                  {!c.derived && <ChevronRight className="h-3.5 w-3.5 text-ink-300" />}
                </div>
              </button>

              {assign && (
                <label
                  className="flex items-center gap-2 border-t border-hairline px-3 py-2 text-[11.5px] text-ink-600"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(c[assign])}
                    onChange={(e) => onChange(c.id, { [assign]: e.target.checked })}
                    className="h-3.5 w-3.5 accent-[var(--color-brand-700)]"
                  />
                  {assign === "printing" ? "Printed component" : "Embroidered component"}
                </label>
              )}

              <div className="flex items-center justify-between gap-2 border-t border-hairline px-3 py-2">
                {c.derived && onEditDerived ? (
                  <button
                    onClick={onEditDerived}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-700 hover:underline"
                  >
                    <Sparkles className="h-3 w-3" /> Derived from the fabric cards — edit spec
                  </button>
                ) : (
                  <span className="text-[10.5px] text-ink-400">
                    {c.consumption > 0
                      ? `${c.consumption.toFixed(3)} m · ${c.wastage}% wastage`
                      : "No consumption yet"}
                  </span>
                )}
                {!c.derived && (
                  <button
                    onClick={() => onRemove(c.id)}
                    aria-label={`Remove ${c.name}`}
                    className="rounded-md p-1 text-ink-400 hover:bg-surface-alt hover:text-ink-900"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {adding ? (
          <div className="rounded-xl border border-brand-700 bg-surface p-3">
            <input
              autoFocus
              value={name}
              placeholder="Component name"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") add(name);
                if (e.key === "Escape") setAdding(false);
              }}
              className="w-full rounded-md border border-hairline px-2 py-1.5 text-[13px] text-ink-900 outline-none focus:border-brand-700"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {COMPONENT_PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => add(p)}
                  className="rounded-full bg-surface-alt px-2 py-0.5 text-[11px] text-ink-600 hover:bg-brand-50 hover:text-brand-700"
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="mt-2.5 flex gap-2">
              <button
                onClick={() => add(name)}
                className="rounded-md bg-brand-700 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-brand-800"
              >
                Add component
              </button>
              <button
                onClick={() => setAdding(false)}
                className="rounded-md border border-hairline px-3 py-1.5 text-[12px] text-ink-600 hover:bg-surface-alt"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className={cn(
              "flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-hairline",
              "px-3 py-2.5 text-[12.5px] font-medium text-ink-600 hover:border-brand-700 hover:text-brand-700",
            )}
          >
            <Plus className="h-3.5 w-3.5" /> Add component
          </button>
        )}
      </div>

      <ComponentOptionModal
        component={configuring}
        onClose={() => setConfiguringId(null)}
        onApply={onChange}
        onClear={(id) => {
          clearOption(id);
          setConfiguringId(null);
        }}
      />
    </aside>
  );
}
