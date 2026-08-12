/**
 * "What exactly are we sending back?"
 *
 * A quotation can carry three quite different things at once — a product, a
 * second product, a kit that draws on both — and a buyer's push-back rarely
 * lands on all of them. So the question is asked before anything moves, at the
 * level the objection actually has: the whole quotation, one article on it, one
 * configuration inside that article, or one member of a kit.
 *
 * Everything starts ticked, on every item, because the common case IS the whole
 * quotation and making the common case the laborious one is the wrong default.
 * The article you opened this from is expanded so narrowing is one click away.
 *
 * A kit's PRICING always goes back whole — its members are costed as one set —
 * but the ask that reaches Costing names only the member articles selected, so
 * "re-cost the Runner inside the kit" is a thing you can say.
 */

import { useEffect, useMemo, useState } from "react";
import { Boxes, ChevronDown, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildsIn, scenariosIn, useCostingSelections } from "@/lib/costingSelectionStore";
import { buildById, scenarioById } from "@/lib/quotationPricing";
import type { QuoteItem, RejectSelection } from "@/lib/quoteDraftStore";

/** One tickable thing inside an item: a configuration, or a kit member. */
type Child = { id: string; label: string; sub?: string };

export function RejectDialog({
  quotationId,
  podId,
  items,
  /** the article the user opened this from — expanded, so narrowing is quick */
  preselect,
  onClose,
  onConfirm,
}: {
  quotationId: string;
  podId: string;
  items: QuoteItem[];
  preselect: string[];
  onClose: () => void;
  onConfirm: (selection: RejectSelection, reason: string) => void;
}) {
  const selections = useCostingSelections();

  /**
   * Item → what can be ticked inside it. Configurations for a product, member
   * articles for a kit. Anything already out is left off: it is not the user's
   * decision to make twice.
   */
  const childrenOf = useMemo(() => {
    const map = new Map<string, Child[]>();
    for (const item of items) {
      if (item.kind === "kit") {
        map.set(
          item.id,
          item.members.map((m) => ({
            id: m.articleId,
            label: m.name,
            sub: m.unitsPerSet && m.unitsPerSet > 1 ? `×${m.unitsPerSet} per set` : undefined,
          })),
        );
        continue;
      }
      const scenarios = scenariosIn(selections, podId, item.articleId);
      const builds = buildsIn(selections, podId, item.articleId);
      map.set(
        item.id,
        item.lines
          .filter((l) => !l.rejected)
          .map((l) => ({
            id: l.id,
            label: scenarioById(scenarios, l.scenarioId).name,
            sub: buildById(builds, l.buildId).name,
          })),
      );
    }
    return map;
  }, [items, selections, podId]);

  /** An item is still offerable while it has anything left to send back. */
  const available = items.filter((i) =>
    i.kind === "kit" ? !i.rejected : (childrenOf.get(i.id) ?? []).length > 0,
  );
  const spent = (item: QuoteItem) => !available.includes(item);

  const allOf = (item: QuoteItem) => new Set((childrenOf.get(item.id) ?? []).map((c) => c.id));

  // The whole quotation, ticked, is the default — narrowing is the exception.
  const [picked, setPicked] = useState<Map<string, Set<string>>>(() => {
    const initial = new Map<string, Set<string>>();
    for (const item of items) {
      if (item.kind === "kit" ? item.rejected : (childrenOf.get(item.id) ?? []).length === 0)
        continue;
      initial.set(item.id, allOf(item));
    }
    return initial;
  });
  const [open, setOpen] = useState<Set<string>>(() => new Set(preselect));
  const [reason, setReason] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggleItem = (item: QuoteItem) => {
    const next = new Map(picked);
    if (next.has(item.id)) next.delete(item.id);
    else next.set(item.id, allOf(item));
    setPicked(next);
  };

  const toggleChild = (item: QuoteItem, childId: string) => {
    const next = new Map(picked);
    const set = new Set(next.get(item.id) ?? []);
    if (set.has(childId)) set.delete(childId);
    else set.add(childId);
    // An item with nothing ticked inside it is not being sent back.
    if (set.size === 0) next.delete(item.id);
    else next.set(item.id, set);
    setPicked(next);
  };

  const allPicked = picked.size === available.length;
  const selectAll = () => {
    if (allPicked) {
      setPicked(new Map());
      return;
    }
    setPicked(new Map(available.map((item) => [item.id, allOf(item)])));
  };

  const totalChildren = Array.from(picked.values()).reduce((n, s) => n + s.size, 0);
  const whole =
    allPicked && available.every((i) => (picked.get(i.id)?.size ?? 0) === allOf(i).size);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Reject for recosting"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
    >
      <button className="absolute inset-0 bg-ink-900/40" aria-label="Cancel" onClick={onClose} />

      <div className="relative flex max-h-[88vh] w-full max-w-[620px] flex-col overflow-hidden rounded-xl border border-hairline bg-surface shadow-2xl">
        <header className="shrink-0 border-b border-hairline px-5 py-4">
          <h2 className="text-[16px] font-semibold text-ink-900">Reject for recosting</h2>
          <p className="mt-0.5 text-[12px] text-ink-500">
            Everything selected stays on {quotationId}, frozen, and goes back to Costing as a status
            with your reason. {quotationId} cannot be sent until it returns.
          </p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-ink-500">
              What is going back
            </h3>
            <span className="text-[12px] text-ink-500">
              {whole ? (
                <span className="font-medium text-ink-700">The whole quotation</span>
              ) : (
                <>
                  {picked.size} of {available.length} item{available.length === 1 ? "" : "s"} ·{" "}
                  {totalChildren} selected
                </>
              )}
            </span>
            {available.length > 1 && (
              <button
                type="button"
                onClick={selectAll}
                className="ml-auto rounded-md border border-hairline bg-surface px-2.5 py-1 text-[11.5px] font-medium text-ink-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
              >
                {allPicked ? "Clear selection" : "Select all"}
              </button>
            )}
          </div>

          <ul className="mt-2.5 space-y-1.5">
            {items.map((item) => {
              const children = childrenOf.get(item.id) ?? [];
              const chosen = picked.get(item.id);
              const on = chosen !== undefined;
              const already = spent(item);
              const expanded = open.has(item.id);
              const isKit = item.kind === "kit";
              const partial = on && chosen.size < children.length;

              return (
                <li
                  key={item.id}
                  className={cn(
                    "overflow-hidden rounded-lg border transition-colors",
                    on ? "border-[#8f2c22]/50 bg-[#8f2c22]/5" : "border-hairline bg-surface",
                    already && "opacity-60",
                  )}
                >
                  <div className="flex items-center gap-2.5 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={on}
                      // Some-but-not-all reads as neither ticked nor empty.
                      ref={(el) => {
                        if (el) el.indeterminate = Boolean(partial);
                      }}
                      disabled={already}
                      onChange={() => toggleItem(item)}
                      aria-label={`Send ${item.name} back`}
                      className="h-4 w-4 accent-[#8f2c22] disabled:cursor-not-allowed"
                    />
                    {isKit ? (
                      <Boxes className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
                    ) : (
                      <Package className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] font-medium text-ink-900">
                        {isKit ? `Kit — ${item.name}` : item.name}
                      </span>
                      <span className="block text-[11px] text-ink-500">
                        {isKit
                          ? `${chosen ? chosen.size : 0} of ${children.length} article${children.length === 1 ? "" : "s"} to re-cost — the set is priced together, so its price goes back whole`
                          : `${chosen ? chosen.size : 0} of ${children.length} configuration${children.length === 1 ? "" : "s"} selected`}
                      </span>
                    </span>

                    {already && (
                      <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-amber-900">
                        Already out
                      </span>
                    )}

                    {/* Anything with more than one thing inside it opens up. */}
                    {children.length > 1 && !already && (
                      <button
                        type="button"
                        onClick={() =>
                          setOpen((prev) => {
                            const next = new Set(prev);
                            if (next.has(item.id)) next.delete(item.id);
                            else next.add(item.id);
                            return next;
                          })
                        }
                        aria-expanded={expanded}
                        aria-label={`Choose what goes back from ${item.name}`}
                        className="shrink-0 rounded p-1 text-ink-400 hover:bg-surface-alt hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
                      >
                        <ChevronDown
                          className={cn("h-4 w-4 transition-transform", !expanded && "-rotate-90")}
                          aria-hidden
                        />
                      </button>
                    )}
                  </div>

                  {expanded && (
                    <ul className="border-t border-hairline bg-surface/60 px-3 py-2">
                      {children.map((c) => (
                        <li key={c.id}>
                          <label className="flex cursor-pointer items-center gap-2.5 py-1">
                            <input
                              type="checkbox"
                              checked={chosen?.has(c.id) ?? false}
                              onChange={() => toggleChild(item, c.id)}
                              className="h-3.5 w-3.5 accent-[#8f2c22]"
                            />
                            <span className="text-[12px] text-ink-700">{c.label}</span>
                            {c.sub && <span className="text-[11px] text-ink-500">· {c.sub}</span>}
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>

          <label
            htmlFor="reject-reason"
            className="mt-4 block text-[11.5px] font-medium text-ink-700"
          >
            Reason
          </label>
          <textarea
            id="reject-reason"
            rows={3}
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What has to change before this can be quoted?"
            className="mt-1 w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-[12.5px] text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
          />
          <p className="mt-1 text-[11px] text-ink-500">
            The same reason goes to everything selected above.
          </p>
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-hairline bg-surface-alt/40 px-5 py-3.5">
          <button
            onClick={onClose}
            className="rounded-md border border-hairline bg-surface px-3.5 py-2 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            Cancel
          </button>
          <button
            disabled={picked.size === 0 || !reason.trim()}
            onClick={() =>
              onConfirm(
                Array.from(picked, ([itemId, ids]) => {
                  const item = items.find((i) => i.id === itemId);
                  // A kit's members are articles, not lines: its whole set of
                  // lines freezes, and the selection only steers the ask.
                  return item?.kind === "kit"
                    ? { itemId, lineIds: item.lines.map((l) => l.id), articleIds: Array.from(ids) }
                    : { itemId, lineIds: Array.from(ids) };
                }),
                reason,
              )
            }
            className="rounded-md bg-[#8f2c22] px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-[#7a251c] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            {whole ? "Send the whole quotation back" : `Send ${totalChildren} back`}
          </button>
        </footer>
      </div>
    </div>
  );
}
