// QuickAddVariantModal — the "Add variant" entry point.
// A single pop-up with exactly two choices: duplicate the current selection,
// or describe the change in plain language and let the matcher build a patch
// from the same option library the forms use. No other path to add a variant.

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Copy, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { interpretVariantPrompt, type VariantMatch } from "@/lib/naturalVariant";
import type { VariantSpec } from "./VariantOptionDrawer";
import type { WorkVariant } from "./VariantTabs";

const ALL_CARRY = {
  fabric: true,
  components: true,
  processes: true,
  consumption: true,
  trims: true,
  packaging: true,
} as const;

type Mode = "choose" | "compose";

const SCENARIOS = [
  {
    id: "premium",
    label: "Premium",
    meta: "Higher-specification materials, processes or packaging",
  },
  {
    id: "value",
    label: "Value Engineered",
    meta: "Reduce cost while holding required specification",
  },
  {
    id: "lowest",
    label: "Lowest Cost",
    meta: "Explore the lowest viable direct manufacturing cost",
  },
  { id: "custom", label: "Custom", meta: "Describe the change in your own words" },
] as const;

type Props = {
  open: boolean;
  variants: WorkVariant[];
  activeId: string;
  onClose: () => void;
  onCreate: (spec: VariantSpec) => void;
};

export function QuickAddVariantModal({ open, variants, activeId, onClose, onCreate }: Props) {
  const [mode, setMode] = useState<Mode>("choose");
  const [scenario, setScenario] = useState<(typeof SCENARIOS)[number]["id"]>("custom");
  const [prompt, setPrompt] = useState("");
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const active = variants.find((v) => v.id === activeId);
  const nextIndex = variants.filter((v) => v.kind === "variant").length + 1;
  const code = `V${nextIndex}`;

  useEffect(() => {
    if (!open) return;
    setMode("choose");
    setScenario("custom");
    setPrompt("");
    setName(`Custom ${nextIndex}`);
    setNameTouched(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (mode === "compose") {
      const t = window.setTimeout(() => textareaRef.current?.focus(), 20);
      return () => window.clearTimeout(t);
    }
  }, [mode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (mode === "compose") setMode("choose");
        else onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, mode, onClose]);

  if (!open) return null;

  const interpretation = interpretVariantPrompt(prompt);
  const isCustomScenario = scenario === "custom";
  const suggestedName = (): string => {
    if (!isCustomScenario)
      return SCENARIOS.find((s) => s.id === scenario)?.label ?? `Custom ${nextIndex}`;
    const words = prompt.trim().split(/\s+/).filter(Boolean).slice(0, 5).join(" ");
    return words ? words.replace(/^\w/, (c) => c.toUpperCase()) : `Custom ${nextIndex}`;
  };

  const duplicateNow = () => {
    if (!active) return;
    onCreate({
      name: `${active.name} copy`,
      code,
      kind: "variant",
      copyFrom: activeId,
      carry: { ...ALL_CARRY },
      refreshRates: true,
      openAfterCreate: true,
    });
  };

  const composeValid = isCustomScenario ? prompt.trim().length > 0 : true;

  const createCustom = () => {
    if (!composeValid) return;
    onCreate({
      name: (nameTouched ? name : suggestedName()).trim() || `Custom ${nextIndex}`,
      code,
      note: prompt.trim() || SCENARIOS.find((s) => s.id === scenario)?.meta,
      kind: "variant",
      copyFrom: activeId,
      carry: { ...ALL_CARRY },
      refreshRates: true,
      patch: interpretation.patch,
      openAfterCreate: true,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add variant"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/30 px-4"
    >
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative flex max-h-[86vh] w-[520px] max-w-full flex-col overflow-hidden rounded-xl border border-hairline bg-surface shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-hairline px-5 py-4">
          <div className="flex items-center gap-2">
            {mode === "compose" && (
              <button
                onClick={() => setMode("choose")}
                aria-label="Back"
                className="rounded-md p-1 text-ink-400 hover:bg-surface-alt hover:text-ink-900"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div>
              <div className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-500">
                Pricing workspace
              </div>
              <h2 className="text-[16px] font-semibold text-ink-900">
                {mode === "choose" ? "Create Variant" : "New variant details"}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-ink-400 hover:bg-surface-alt hover:text-ink-900"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {mode === "choose" ? (
          <div className="space-y-3 px-5 py-5">
            <p className="text-[12.5px] leading-relaxed text-ink-500">
              Create an alternative costing scenario based on the current{" "}
              <span className="font-medium text-ink-700">{active?.name ?? "variant"}</span>.
            </p>
            <button
              onClick={() => setMode("compose")}
              className="flex w-full items-start gap-3.5 rounded-xl border border-hairline px-4 py-4 text-left transition-colors hover:border-brand-700 hover:bg-brand-50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold-50 text-gold-700">
                <Sparkles className="h-4.5 w-4.5" />
              </span>
              <span>
                <span className="block text-[14px] font-medium text-ink-900">Create New</span>
                <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-500">
                  Start a new costing scenario — Premium, Value Engineered, Lowest Cost, or a custom
                  description matched against the configuration library.
                </span>
              </span>
            </button>

            <button
              onClick={duplicateNow}
              disabled={!active}
              className="flex w-full items-start gap-3.5 rounded-xl border border-hairline px-4 py-4 text-left transition-colors hover:border-brand-700 hover:bg-brand-50 disabled:opacity-40"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <Copy className="h-4.5 w-4.5" />
              </span>
              <span>
                <span className="block text-[14px] font-medium text-ink-900">
                  Duplicate Current Variant
                </span>
                <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-500">
                  Copies every configured field from{" "}
                  <span className="font-medium text-ink-700">{active?.name ?? "this variant"}</span>
                  , refreshed to current master rates. Opens immediately.
                </span>
              </span>
            </button>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div>
                <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink-500">
                  Scenario
                </span>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  {SCENARIOS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setScenario(s.id);
                        if (!nameTouched) setName(s.label);
                      }}
                      aria-pressed={scenario === s.id}
                      className={cn(
                        "rounded-lg border px-2.5 py-2 text-left transition-colors",
                        scenario === s.id
                          ? "border-brand-700 bg-brand-50"
                          : "border-hairline hover:bg-surface-alt",
                      )}
                    >
                      <span
                        className={cn(
                          "block text-[12.5px] font-medium",
                          scenario === s.id ? "text-brand-700" : "text-ink-900",
                        )}
                      >
                        {s.label}
                      </span>
                      <span className="block text-[10.5px] leading-snug text-ink-500">
                        {s.meta}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-ink-500">
                  A starting intent only — it never changes fabric, processes or rates by itself.
                </p>
              </div>

              <label className="block">
                <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink-500">
                  Describe the variant{!isCustomScenario && " (optional)"}
                </span>
                <textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  placeholder="e.g. Switch to pigment dyeing, use 350 GSM heavier cotton, pack in a gift box, and drop wastage to 5%"
                  className="mt-1 w-full resize-none rounded-md border border-hairline bg-surface px-2.5 py-2 text-[13px] leading-relaxed text-ink-900 outline-none placeholder:text-ink-300 focus:border-brand-700"
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink-500">
                  Variant name
                </span>
                <input
                  value={nameTouched ? name : suggestedName()}
                  onChange={(e) => {
                    setNameTouched(true);
                    setName(e.target.value);
                  }}
                  className="mt-1 w-full rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[13px] text-ink-900 outline-none focus:border-brand-700"
                />
              </label>

              <div>
                <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink-500">
                  {prompt.trim() ? "Matched changes" : "Matches appear as you type"}
                </span>
                <div className="mt-1.5 rounded-lg border border-hairline">
                  {interpretation.matches.length > 0 ? (
                    interpretation.matches.map((m, i) => (
                      <MatchRow key={m.cardId} m={m} first={i === 0} />
                    ))
                  ) : (
                    <p className="px-3 py-2.5 text-[12px] text-ink-500">
                      {prompt.trim()
                        ? "No matching fields yet — try naming a fabric, process, or packaging option that exists in the library."
                        : "Name a fabric, dyeing or printing method, packaging type, quantity, wastage % — anything already in the configuration library."}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <footer className="flex shrink-0 items-center gap-2 border-t border-hairline px-5 py-3">
              <button
                onClick={() => setMode("choose")}
                className="rounded-md border border-hairline px-3 py-2 text-[12.5px] text-ink-700 hover:bg-surface-alt"
              >
                Back
              </button>
              <div className="ml-auto">
                <button
                  onClick={createCustom}
                  disabled={!composeValid}
                  className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-3.5 py-2 text-[12.5px] font-medium text-white hover:bg-brand-800 disabled:opacity-40"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Create variant
                </button>
              </div>
            </footer>
          </div>
        )}
      </div>
    </div>
  );
}

function MatchRow({ m, first }: { m: VariantMatch; first: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 px-3 py-2 text-[12.5px]",
        !first && "border-t border-hairline",
      )}
    >
      <span className="text-ink-500">{m.cardLabel}</span>
      <span className="font-medium text-ink-900">{m.optionLabel}</span>
    </div>
  );
}
