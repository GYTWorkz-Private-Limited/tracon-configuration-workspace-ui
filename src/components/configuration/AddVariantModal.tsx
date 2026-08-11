// AddVariantModal — the two ways a new variant enters the workspace:
// duplicate what's already selected, or describe a custom costing scenario
// from scratch. Kept to one deliberate step past the initial choice.

import { useState } from "react";
import { Copy, Layers, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

const SCENARIO_LABELS: { label: string; description: string }[] = [
  {
    label: "Premium",
    description: "Use the highest quality materials and finishes available, cost is secondary to quality.",
  },
  {
    label: "Value Engineered",
    description: "Reduce overall cost while maintaining the required quality and specifications.",
  },
  {
    label: "Lowest Cost",
    description: "Optimise every component for the lowest landed cost the spec will still allow.",
  },
  {
    label: "High MOQ",
    description: "Price for a large order quantity, taking full advantage of setup and volume amortisation.",
  },
  {
    label: "Low MOQ",
    description: "Price for a small order quantity, where fixed setup costs dominate the per-piece cost.",
  },
  {
    label: "Quality Optimized",
    description: "Balance cost and quality, favouring specification upgrades with the best cost-to-benefit.",
  },
  {
    label: "Buyer Specific",
    description: "Match a specific buyer's stated preferences and prior approvals for this article.",
  },
  { label: "Custom", description: "" },
];

type Mode = "choose" | "duplicate" | "custom";

export function AddVariantModal({
  open,
  onClose,
  activeVariantName,
  onDuplicate,
  onCreateCustom,
}: {
  open: boolean;
  onClose: () => void;
  /** name of the variant currently selected — duplication starts from it */
  activeVariantName: string;
  onDuplicate: (name: string) => void;
  onCreateCustom: (name: string, description: string) => void;
}) {
  const [mode, setMode] = useState<Mode>("choose");
  const [duplicateName, setDuplicateName] = useState("");
  const [scenarioName, setScenarioName] = useState("");
  const [description, setDescription] = useState("");

  if (!open) return null;

  const reset = () => {
    setMode("choose");
    setDuplicateName("");
    setScenarioName("");
    setDescription("");
  };

  const close = () => {
    reset();
    onClose();
  };

  const enterDuplicate = () => {
    setDuplicateName(`${activeVariantName} copy`);
    setMode("duplicate");
  };

  const submitDuplicate = () => {
    const name = duplicateName.trim();
    if (!name) return;
    onDuplicate(name);
    reset();
  };

  const submitCustom = () => {
    const name = scenarioName.trim();
    if (!name || !description.trim()) return;
    onCreateCustom(name, description.trim());
    reset();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add variant"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4"
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-[min(520px,96vw)] flex-col overflow-hidden rounded-xl border border-hairline bg-surface shadow-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-hairline px-5 py-3.5">
          <div>
            <h2 className="flex items-center gap-2 text-[14px] font-semibold text-ink-900">
              <Layers className="h-4 w-4 text-brand-700" aria-hidden /> Add Variant
            </h2>
            <p className="mt-0.5 text-[12px] text-ink-500">
              A variant is a different way of making this article.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="rounded-md p-1.5 text-ink-500 hover:bg-surface-alt hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="px-5 py-4">
          {mode === "choose" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={enterDuplicate}
                className="flex flex-col items-start gap-2 rounded-lg border border-hairline bg-surface p-3.5 text-left transition-colors hover:border-brand-700 hover:bg-brand-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
              >
                <span className="rounded-md bg-ink-100 p-1.5 text-ink-700">
                  <Copy className="h-4 w-4" />
                </span>
                <span className="text-[13px] font-medium text-ink-900">
                  Duplicate Existing Selection
                </span>
                <span className="text-[11.5px] text-ink-500">
                  Copy "{activeVariantName}" as an independent variant you can modify separately.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMode("custom")}
                className="flex flex-col items-start gap-2 rounded-lg border border-hairline bg-surface p-3.5 text-left transition-colors hover:border-brand-700 hover:bg-brand-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
              >
                <span className="rounded-md bg-cfg-soft p-1.5 text-cfg-strong">
                  <Sparkles className="h-4 w-4" />
                </span>
                <span className="text-[13px] font-medium text-ink-900">Create Custom Scenario</span>
                <span className="text-[11.5px] text-ink-500">
                  Describe a new costing scenario from a free-text brief and a starting label.
                </span>
              </button>
            </div>
          )}

          {mode === "duplicate" && (
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-[11.5px] font-medium text-ink-700">
                  New variant name
                </span>
                <input
                  autoFocus
                  value={duplicateName}
                  onChange={(e) => setDuplicateName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitDuplicate()}
                  placeholder="e.g. Cotton Base copy"
                  className="w-full rounded-md border border-hairline bg-surface px-3 py-2 text-[13px] text-ink-900 outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-700/15"
                />
              </label>
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setMode("choose")}
                  className="text-[12.5px] text-ink-500 hover:text-ink-900"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={submitDuplicate}
                  disabled={!duplicateName.trim()}
                  className="rounded-md bg-brand-700 px-3.5 py-2 text-[12.5px] font-medium text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Create Variant
                </button>
              </div>
            </div>
          )}

          {mode === "custom" && (
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-[11.5px] font-medium text-ink-700">
                  Variant / Scenario Name
                </span>
                <input
                  autoFocus
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                  placeholder="e.g. Value Engineered"
                  className="w-full rounded-md border border-hairline bg-surface px-3 py-2 text-[13px] text-ink-900 outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-700/15"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[11.5px] font-medium text-ink-700">
                  Describe this scenario
                </span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe this scenario…"
                  rows={4}
                  className="w-full resize-none rounded-md border border-hairline bg-surface px-3 py-2 text-[13px] text-ink-900 outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-700/15"
                />
              </label>

              <div>
                <span className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-400">
                  Suggested scenarios
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {SCENARIO_LABELS.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => {
                        if (!scenarioName.trim()) setScenarioName(s.label);
                        if (s.description) setDescription(s.description);
                      }}
                      className="rounded-full border border-hairline bg-surface px-2.5 py-1 text-[11.5px] text-ink-600 hover:border-cfg hover:bg-cfg-soft hover:text-cfg-strong"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setMode("choose")}
                  className="text-[12.5px] text-ink-500 hover:text-ink-900"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={submitCustom}
                  disabled={!scenarioName.trim() || !description.trim()}
                  className={cn(
                    "rounded-md bg-brand-700 px-3.5 py-2 text-[12.5px] font-medium text-white hover:bg-brand-800",
                    "disabled:cursor-not-allowed disabled:opacity-40",
                  )}
                >
                  Create Variant
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
