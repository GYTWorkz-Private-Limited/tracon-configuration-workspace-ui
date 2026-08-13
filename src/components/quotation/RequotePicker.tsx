/**
 * "The buyer accepted, then came back."
 *
 * A requote is a new commercial cycle, not an edit of the document the buyer
 * agreed to. Two questions stand between the click and the work, asked in
 * order because the second only makes sense once the first is answered:
 *
 *   1. WHICH articles are being requoted? The rest stay on the sent version,
 *      untouched — that is the whole point of asking.
 *   2. WHERE does the change happen? Re-engineering the article is
 *      Configuration's job; moving the commercial position is the
 *      Quotation's. They are different amounts of work for different people,
 *      and deciding it here, once, is what stops the next person guessing how
 *      much of the costing they are allowed to touch.
 *
 * The sent quotation stays exactly as it was sent, whatever is chosen here.
 */

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  ChevronDown,
  FileText,
  Package,
  Settings2,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usd } from "@/lib/commercialProvisions";
import { buildsIn, scenariosIn, useCostingSelections } from "@/lib/costingSelectionStore";
import { buildById, scenarioById } from "@/lib/quotationPricing";
import type { QuoteItem } from "@/lib/quoteDraftStore";

/** Where the selected articles are reworked. */
export type RequoteDestination = "configuration" | "quotation" | "team";

export function RequotePicker({
  quotationId,
  podId,
  items,
  priceOf,
  /** the sent version the selected articles currently stand on */
  versionNo,
  statusLabel,
  onClose,
  onConfirm,
}: {
  quotationId: string;
  podId: string;
  items: QuoteItem[];
  /** current quoted price of an item, for orientation while choosing */
  priceOf: (itemId: string) => number;
  versionNo?: number;
  statusLabel?: string;
  onClose: () => void;
  onConfirm: (
    picks: { itemId: string; lineIds: string[] }[],
    destination: RequoteDestination,
  ) => void;
}) {
  const selections = useCostingSelections();

  /**
   * Article → its configured variants, named as the quotation table names
   * them, so "pull only the embroidered build forward" is a thing that can be
   * said here. Kits are not expandable: priced as one set, they travel whole.
   */
  const configsOf = useMemo(() => {
    const map = new Map<string, { lineId: string; label: string }[]>();
    for (const item of items) {
      if (item.kind === "kit") {
        map.set(item.id, []);
        continue;
      }
      const scenarios = scenariosIn(selections, podId, item.articleId);
      const builds = buildsIn(selections, podId, item.articleId);
      map.set(
        item.id,
        item.lines.map((l) => ({
          lineId: l.id,
          label: `${scenarioById(scenarios, l.scenarioId).name} · ${buildById(builds, l.buildId).name}`,
        })),
      );
    }
    return map;
  }, [items, selections, podId]);

  const allLinesOf = (item: QuoteItem) =>
    new Set((configsOf.get(item.id) ?? []).map((c) => c.lineId));

  /** item id → the line ids coming forward; a kit maps to an empty set. */
  const [picked, setPicked] = useState<Map<string, Set<string>>>(new Map());
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<1 | 2>(1);
  const [destination, setDestination] = useState<RequoteDestination | null>(null);

  const allOn = picked.size === items.length && items.length > 0;

  const toggle = (item: QuoteItem) => {
    const next = new Map(picked);
    if (next.has(item.id)) next.delete(item.id);
    else next.set(item.id, allLinesOf(item));
    setPicked(next);
  };

  const toggleLine = (item: QuoteItem, lineId: string) => {
    const next = new Map(picked);
    const set = new Set(next.get(item.id) ?? []);
    if (set.has(lineId)) set.delete(lineId);
    else set.add(lineId);
    // An article with no configuration selected is not coming forward.
    if (set.size === 0) next.delete(item.id);
    else next.set(item.id, set);
    setPicked(next);
  };

  const chosen = items.filter((i) => picked.has(i.id));
  const left = items.filter((i) => !picked.has(i.id));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas">
      <header className="shrink-0 border-b border-hairline bg-surface px-6 py-3 lg:px-8">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-3">
          <div className="min-w-0">
            <div className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-500">
              {quotationId}
              {versionNo ? ` · V${versionNo}` : ""}
              {statusLabel ? ` · ${statusLabel}` : ""}
            </div>
            <h1 className="text-[19px] font-semibold tracking-tight text-ink-900">
              {step === 1 ? "Requote — select articles" : "Where would you like to make changes?"}
            </h1>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto rounded-md border border-hairline bg-surface p-2 text-ink-500 hover:bg-surface-alt hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1100px] px-6 py-5 lg:px-8">
          {step === 1 ? (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <p className="min-w-0 flex-1 text-[12.5px] text-ink-500">
                  {quotationId} stays exactly as it was sent. Only the articles selected here move
                  to the new version — the rest remain on{" "}
                  <strong className="font-medium text-ink-700">
                    V{versionNo ?? 1}
                    {statusLabel ? ` (${statusLabel.toLowerCase()})` : ""}
                  </strong>
                  .
                </p>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setPicked(
                        allOn ? new Map() : new Map(items.map((i) => [i.id, allLinesOf(i)])),
                      )
                    }
                    className="shrink-0 rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[11.5px] font-medium text-ink-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
                  >
                    {allOn ? "Clear selection" : `Select all ${items.length}`}
                  </button>
                )}
              </div>

              <ul className="space-y-2">
                {items.map((item) => {
                  const configs = configsOf.get(item.id) ?? [];
                  const lines = picked.get(item.id);
                  const on = lines !== undefined;
                  const partial = on && configs.length > 0 && lines.size < configs.length;
                  const expanded = open.has(item.id);
                  return (
                    <li
                      key={item.id}
                      className={cn(
                        "overflow-hidden rounded-xl border transition-colors",
                        on ? "border-brand-600 bg-brand-50/40" : "border-hairline bg-surface",
                      )}
                    >
                      <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={on}
                          ref={(el) => {
                            if (el) el.indeterminate = partial;
                          }}
                          onChange={() => toggle(item)}
                          aria-label={`Requote ${item.name}`}
                          className="h-4 w-4 accent-[var(--color-brand-700)]"
                        />
                        {item.image ? (
                          <img
                            src={item.image}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-md border border-hairline object-cover"
                          />
                        ) : (
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-alt text-ink-400">
                            {item.kind === "kit" ? (
                              <Boxes className="h-4 w-4" />
                            ) : (
                              <Package className="h-4 w-4" />
                            )}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-semibold text-ink-900">
                            {item.kind === "kit" ? `Kit — ${item.name}` : item.name}
                          </span>
                          <span className="block text-[11.5px] text-ink-500">
                            {item.srfRef} · quoted at {usd(priceOf(item.id))}
                            {item.kind === "kit"
                              ? " · priced as one set, travels whole"
                              : configs.length > 1
                                ? ` · ${on ? lines.size : 0} of ${configs.length} configurations`
                                : ""}
                          </span>
                        </span>
                        {/* Where this article stands today — the thing the
                            requote will move it off. */}
                        <span className="shrink-0 rounded-full bg-ink-100 px-2 py-0.5 text-[10.5px] font-medium text-ink-600">
                          {quotationId} · V{versionNo ?? 1}
                          {statusLabel ? ` · ${statusLabel}` : ""}
                        </span>
                        {/* Only a product has variants to open. */}
                        {item.kind === "product" && configs.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setOpen((prev) => {
                                const next = new Set(prev);
                                if (next.has(item.id)) next.delete(item.id);
                                else next.add(item.id);
                                return next;
                              });
                            }}
                            aria-expanded={expanded}
                            aria-label={`Choose which variants of ${item.name} come forward`}
                            className="shrink-0 rounded p-1 text-ink-400 hover:bg-surface-alt hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
                          >
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 transition-transform",
                                !expanded && "-rotate-90",
                              )}
                              aria-hidden
                            />
                          </button>
                        )}
                      </label>

                      {expanded && item.kind === "product" && (
                        <ul className="border-t border-hairline bg-surface/60 px-4 py-2 pl-11">
                          {configs.map((cfg) => (
                            <li key={cfg.lineId}>
                              <label className="flex cursor-pointer items-center gap-2.5 py-1">
                                <input
                                  type="checkbox"
                                  checked={lines?.has(cfg.lineId) ?? false}
                                  onChange={() => toggleLine(item, cfg.lineId)}
                                  className="h-3.5 w-3.5 accent-[var(--color-brand-700)]"
                                />
                                <span className="text-[12px] text-ink-700">{cfg.label}</span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <>
              <p className="mb-1 text-[12.5px] text-ink-500">
                Applies to{" "}
                <strong className="font-medium text-ink-700">
                  {chosen.map((i) => i.name).join(", ")}
                </strong>
                {left.length > 0 && (
                  <>
                    {" — "}
                    {left.map((i) => i.name).join(", ")} {left.length === 1 ? "stays" : "stay"} on V
                    {versionNo ?? 1}.
                  </>
                )}
              </p>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <DestinationCard
                  active={destination === "configuration"}
                  onSelect={() => setDestination("configuration")}
                  icon={<Settings2 className="h-4.5 w-4.5" aria-hidden />}
                  title="Edit Configuration"
                  description="Modify materials, components, processes, consumption, MOQ, variants and scenarios. Starts from the costing again — hand-set cost and price are dropped, and the new quotation is generated once the costing is re-done."
                  path="Configuration → Costing Report → Quotation"
                />
                <DestinationCard
                  active={destination === "quotation"}
                  onSelect={() => setDestination("quotation")}
                  icon={<FileText className="h-4.5 w-4.5" aria-hidden />}
                  title="Edit Quotation"
                  description="Modify the quoted commercial values — selected scenario, MOQ, margin, selling price. The costing underneath stays as it stands; only the commercial position moves."
                  path="Straight to the new quotation"
                />
                <DestinationCard
                  active={destination === "team"}
                  onSelect={() => setDestination("team")}
                  icon={<Users className="h-4.5 w-4.5" aria-hidden />}
                  title="Send to Costing Team"
                  description="Hand the selected articles to the costing team's queue. They move to Recosting and nothing else happens now — the team re-costs, marks them ready, and the new quotation is raised from there."
                  path="Costing team queue · status Recosting"
                />
              </div>

              <p className="mt-4 rounded-lg bg-surface-alt/60 px-3.5 py-2.5 text-[12px] text-ink-500">
                Either way, V{versionNo ?? 1} and its approval history stay intact — the revised
                quotation is a new version and goes for approval on its own.
              </p>
            </>
          )}
        </div>
      </div>

      <footer className="shrink-0 border-t border-hairline bg-surface px-6 py-3 lg:px-8">
        <div className="mx-auto flex max-w-[1100px] items-center gap-3">
          <span className="text-[12.5px] text-ink-500">
            {picked.size} of {items.length} article{items.length === 1 ? "" : "s"} selected
            {step === 2 && destination && (
              <>
                {" · "}
                {destination === "configuration"
                  ? "editing the configuration"
                  : "editing the quotation"}
              </>
            )}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {step === 2 ? (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-3.5 py-2 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-hairline bg-surface px-3.5 py-2 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt"
              >
                Cancel
              </button>
            )}
            {step === 1 ? (
              <button
                type="button"
                disabled={picked.size === 0}
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continue to Requote <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={!destination}
                onClick={() =>
                  destination &&
                  onConfirm(
                    Array.from(picked, ([itemId, lineIds]) => ({
                      itemId,
                      lineIds: Array.from(lineIds),
                    })),
                    destination,
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {destination === "configuration"
                  ? "Open Configuration"
                  : destination === "quotation"
                    ? "Open Quotation"
                    : destination === "team"
                      ? "Send to Costing Team"
                      : "Create Requote"}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

function DestinationCard({
  active,
  onSelect,
  icon,
  title,
  description,
  path,
}: {
  active: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  path: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
        active
          ? "border-brand-600 bg-brand-50/40"
          : "border-hairline bg-surface hover:bg-surface-alt",
      )}
    >
      <span className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-md border",
            active
              ? "border-brand-600 bg-brand-50 text-brand-700"
              : "border-hairline bg-surface-alt text-ink-600",
          )}
        >
          {icon}
        </span>
        <span className="text-[14px] font-semibold text-ink-900">{title}</span>
      </span>
      <span className="text-[12px] leading-relaxed text-ink-600">{description}</span>
      <span className="mt-auto text-[11px] font-medium uppercase tracking-[0.08em] text-ink-400">
        {path}
      </span>
    </button>
  );
}
