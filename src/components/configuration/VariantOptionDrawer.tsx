// VariantOptionDrawer — the "Add Option" right-side drawer.
//
// An Option is an alternative value for one specific configurable parameter
// within the currently selected Variant. The user is never asked which
// Variant they're working on — it's whichever one is active — so this drawer
// opens straight into "pick a parameter" and shows the owning Variant as
// read-only context.

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { inr, type CardDef, type CardOption, type ConfigState } from "@/lib/fabricConfig";
import { PHASES, rollupPhases } from "@/lib/configTree";
import type { SpineCtx } from "@/lib/costingSpine";
import type { WorkVariant } from "./VariantTabs";

export type VariantSpec = {
  name: string;
  code: string;
  note?: string;
  kind: "variant" | "option";
  parentId?: string;
  copyFrom: string | "blank" | { template: string };
  carry?: {
    fabric: boolean;
    components: boolean;
    processes: boolean;
    consumption: boolean;
    trims: boolean;
    packaging: boolean;
  };
  refreshRates?: boolean;
  /** Applied on top of the seeded state last — the option's own field change,
   *  or the natural-language "create custom with AI" matcher's patch. */
  patch?: ConfigState;
  openAfterCreate: boolean;
};

/** The parameter catalog, grouped exactly as the costing team groups it.
 *  Built from the same PHASES/groups the rest of the workspace reads from —
 *  never a hand-maintained duplicate list, so an option can never offer a
 *  parameter the workspace itself doesn't have. */
const cardsOf = (phaseId: (typeof PHASES)[number]["id"], groupIds?: string[]): CardDef[] => {
  const phase = PHASES.find((p) => p.id === phaseId);
  if (!phase) return [];
  const groups = groupIds ? phase.groups.filter((g) => groupIds.includes(g.id)) : phase.groups;
  return groups.flatMap((g) => g.cards).filter((c) => c.kind !== "readonly");
};

const PARAMETER_GROUPS: { label: string; cards: CardDef[] }[] = [
  {
    label: "Material & Components",
    cards: cardsOf("raw", ["fabric", "yarn"]),
  },
  {
    label: "Process",
    cards: cardsOf(
      "process",
      PHASES.find((p) => p.id === "process")
        ?.groups.filter((g) => g.id !== "consumption")
        .map((g) => g.id),
    ),
  },
  { label: "Consumption", cards: cardsOf("process", ["consumption"]) },
  {
    label: "Order / Quantity",
    cards: cardsOf("input", ["drivers"]).filter((c) =>
      ["orderQty", "moq", "quotedMoq"].includes(c.id),
    ),
  },
  { label: "Accessories & Trims", cards: cardsOf("raw", ["trims"]) },
  { label: "Packaging", cards: cardsOf("packaging") },
].filter((g) => g.cards.length > 0);

const ALL_PARAM_CARDS: CardDef[] = PARAMETER_GROUPS.flatMap((g) => g.cards);

type Draft = { value: string; optionId?: string; rate?: number };

type Props = {
  open: boolean;
  variants: WorkVariant[];
  activeId: string;
  state: ConfigState;
  ctx: SpineCtx;
  onClose: () => void;
  onCreate: (spec: VariantSpec) => void;
};

export function VariantOptionDrawer({
  open,
  variants,
  activeId,
  state,
  ctx,
  onClose,
  onCreate,
}: Props) {
  const active = variants.find((v) => v.id === activeId);
  const existingOptions = variants.filter((v) => v.kind === "option" && v.parentId === activeId);

  const [query, setQuery] = useState("");
  const [cardId, setCardId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setCardId(null);
    setDraft(null);
    setName("");
    setNameTouched(false);
    setDirty(false);
    setConfirmDiscard(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dirty]);

  const card = ALL_PARAM_CARDS.find((c) => c.id === cardId) ?? null;
  const currentTotal = useMemo(() => rollupPhases(state, ctx).directTotal, [state, ctx]);
  const patchedState: ConfigState | null = useMemo(
    () => (card && draft ? { ...state, [card.id]: draft } : null),
    [card, draft, state],
  );
  const nextTotal = useMemo(
    () => (patchedState ? rollupPhases(patchedState, ctx).directTotal : null),
    [patchedState, ctx],
  );
  const impact = nextTotal !== null ? nextTotal - currentTotal : null;

  if (!open) return null;

  const requestClose = () => {
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  };

  const pickCard = (c: CardDef) => {
    setCardId(c.id);
    const current = state[c.id];
    const startOption =
      c.options?.find((o) => o.id === current?.optionId) ??
      c.options?.find((o) => o.recommended) ??
      c.options?.[0];
    if (c.kind === "options" && startOption) {
      setDraft({ value: startOption.label, optionId: startOption.id, rate: startOption.rate });
      setName(`${c.label} — ${startOption.label}`);
    } else {
      setDraft({ value: current?.value ?? "" });
      setName(`${c.label} — new value`);
    }
    setNameTouched(false);
    setDirty(true);
  };

  const pickOption = (opt: CardOption) => {
    if (!card) return;
    setDraft({ value: opt.label, optionId: opt.id, rate: opt.rate });
    if (!nameTouched) setName(`${card.label} — ${opt.label}`);
  };

  const valid = Boolean(card && draft && (draft.value ?? "").trim().length > 0 && name.trim());

  const create = () => {
    if (!card || !draft || !valid) return;
    onCreate({
      name: name.trim(),
      code: `O${existingOptions.length + 1}`,
      kind: "option",
      parentId: activeId,
      copyFrom: activeId,
      patch: { [card.id]: draft },
      openAfterCreate: true,
    });
  };

  return (
    <>
      <aside
        role="dialog"
        aria-label="Create option"
        className="fixed right-0 top-0 z-40 flex h-full w-[440px] max-w-[92vw] flex-col border-l border-hairline bg-surface shadow-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-hairline px-5 py-4">
          <div className="min-w-0">
            <div className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-500">
              Create Option
            </div>
            <h2 className="mt-0.5 flex items-center gap-1.5 text-[15px] font-semibold text-ink-900">
              Variant:
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[12.5px] font-medium text-brand-700">
                {active?.name ?? "—"}
              </span>
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-500">
              An option is an alternative value for one parameter inside this variant. It never
              changes the parent variant.
            </p>
          </div>
          <button
            onClick={requestClose}
            aria-label="Close"
            className="rounded-md p-1 text-ink-400 hover:bg-surface-alt hover:text-ink-900"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <section className="space-y-2.5">
            <div className="flex items-baseline gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[10.5px] font-semibold tabular-nums text-brand-700">
                1
              </span>
              <h3 className="text-[12.5px] font-semibold text-ink-900">Select parameter</h3>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search fabric, process, packaging, MOQ…"
                className="w-full rounded-md border border-hairline bg-surface py-1.5 pl-8 pr-2.5 text-[13px] text-ink-900 outline-none placeholder:text-ink-300 focus:border-brand-700"
              />
            </div>
            <div className="max-h-[240px] overflow-y-auto rounded-lg border border-hairline">
              {PARAMETER_GROUPS.map((g) => {
                const matches = g.cards.filter((c) =>
                  c.label.toLowerCase().includes(query.toLowerCase()),
                );
                if (!matches.length) return null;
                return (
                  <div key={g.label}>
                    <div className="border-t border-hairline bg-surface-alt px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-500 first:border-t-0">
                      {g.label}
                    </div>
                    {matches.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => pickCard(c)}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[12.5px] hover:bg-surface-alt",
                          cardId === c.id && "bg-brand-50 text-brand-700",
                        )}
                      >
                        <span>{c.label}</span>
                        {cardId === c.id && <Check className="h-3.5 w-3.5 shrink-0" />}
                      </button>
                    ))}
                  </div>
                );
              })}
              {PARAMETER_GROUPS.every(
                (g) => !g.cards.some((c) => c.label.toLowerCase().includes(query.toLowerCase())),
              ) && (
                <p className="px-3 py-4 text-center text-[12px] text-ink-500">
                  No matching parameter.
                </p>
              )}
            </div>
          </section>

          {card && draft && (
            <section className="mt-6 space-y-2.5">
              <div className="flex items-baseline gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[10.5px] font-semibold tabular-nums text-brand-700">
                  2
                </span>
                <h3 className="text-[12.5px] font-semibold text-ink-900">{card.label} value</h3>
              </div>
              <div className="pl-7">
                {card.kind === "options" ? (
                  <div className="flex flex-wrap gap-1.5">
                    {(card.options ?? []).map((o) => {
                      const isCurrent = state[card.id]?.optionId === o.id;
                      const isSelected = draft.optionId === o.id;
                      return (
                        <button
                          key={o.id}
                          onClick={() => pickOption(o)}
                          aria-pressed={isSelected}
                          className={cn(
                            "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
                            isSelected
                              ? "border-brand-700 bg-brand-700 text-white"
                              : "border-hairline bg-surface text-ink-700 hover:bg-surface-alt",
                          )}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                          {o.label}
                          {isCurrent && !isSelected && (
                            <span className="text-[10px] uppercase tracking-[0.06em] text-ink-400">
                              current
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <input
                    value={draft.value}
                    onChange={(e) => {
                      setDraft({ value: e.target.value });
                      setDirty(true);
                    }}
                    className="w-full rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[13px] text-ink-900 outline-none focus:border-brand-700"
                  />
                )}

                <label className="mt-3 block">
                  <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink-500">
                    Option name
                  </span>
                  <input
                    value={name}
                    onChange={(e) => {
                      setNameTouched(true);
                      setName(e.target.value);
                      setDirty(true);
                    }}
                    className="mt-1 w-full rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[13px] text-ink-900 outline-none focus:border-brand-700"
                  />
                </label>
              </div>
            </section>
          )}

          <section className="mt-6 space-y-2">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink-500">
              Live cost impact
            </h3>
            {nextTotal !== null && impact !== null ? (
              <div className="rounded-lg border border-hairline bg-surface-alt p-3">
                <div className="flex items-center gap-2 text-[12px] text-ink-600">
                  <span className="tabular-nums">
                    Current variant cost <b className="text-ink-900">{inr(currentTotal)} / pc</b>
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-ink-400" />
                  <span className="tabular-nums">
                    Option cost <b className="text-ink-900">{inr(nextTotal)} / pc</b>
                  </span>
                </div>
                <div
                  className={cn(
                    "mt-2 text-[15px] font-semibold tabular-nums",
                    impact <= 0 ? "text-opportunity" : "text-risk",
                  )}
                >
                  Impact: {impact <= 0 ? "" : "+"}
                  {inr(impact)} / pc
                </div>
              </div>
            ) : (
              <p className="text-[12px] text-ink-500">Select a parameter to see the cost impact.</p>
            )}
          </section>

          {existingOptions.length > 0 && (
            <section className="mt-6 space-y-1.5">
              <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink-500">
                Existing options on this variant
              </h3>
              <ul className="space-y-1">
                {existingOptions.map((o) => (
                  <li
                    key={o.id}
                    className="rounded-md border border-hairline px-2.5 py-1.5 text-[12px] text-ink-700"
                  >
                    {o.name}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <footer className="flex shrink-0 items-center gap-2 border-t border-hairline px-5 py-3">
          <button
            onClick={requestClose}
            className="rounded-md border border-hairline px-3 py-2 text-[12.5px] text-ink-700 hover:bg-surface-alt"
          >
            Cancel
          </button>
          <button
            onClick={create}
            disabled={!valid}
            className="ml-auto rounded-md bg-brand-700 px-3.5 py-2 text-[12.5px] font-medium text-white hover:bg-brand-800 disabled:opacity-40"
          >
            Create Option
          </button>
        </footer>
      </aside>

      {confirmDiscard && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Discard unsaved changes"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/30 px-4"
        >
          <div className="w-[380px] max-w-full rounded-xl border border-hairline bg-surface p-5 shadow-2xl">
            <h3 className="text-[14px] font-semibold text-ink-900">Discard unsaved changes?</h3>
            <p className="mt-1.5 text-[12.5px] text-ink-500">Your changes have not been saved.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDiscard(false)}
                className="rounded-md border border-hairline px-3 py-2 text-[12.5px] text-ink-700 hover:bg-surface-alt"
              >
                Keep Editing
              </button>
              <button
                onClick={() => {
                  setConfirmDiscard(false);
                  onClose();
                }}
                className="rounded-md bg-danger px-3.5 py-2 text-[12.5px] font-medium text-white hover:opacity-90"
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
