/**
 * "What exactly are we sending back?"
 *
 * A buyer rarely questions "the Placemat". They question a way of building it —
 * the embroidered one, the 3,000-piece break — and the rest of the article is
 * still quotable. So the scope is chosen at the level the objection actually
 * lands: article, then configuration inside it.
 *
 * Everything starts ticked, because a rejection usually is about the whole
 * quotation and making the common case the laborious one is the wrong default.
 * Untick down to what really has to change.
 *
 * A kit is not expandable: its members are priced as one set, so it goes back
 * whole or not at all.
 */

import { useEffect, useMemo, useState } from "react";
import { Boxes, ChevronDown, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildsIn, scenariosIn, useCostingSelections } from "@/lib/costingSelectionStore";
import { buildById, scenarioById } from "@/lib/quotationPricing";
import type { QuoteItem, RejectSelection } from "@/lib/quoteDraftStore";

export function RejectDialog({
  quotationId,
  podId,
  items,
  /** items ticked when it opens — every one of them for "the whole quotation" */
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

  /** Article → its quotable configurations, named as the table names them. */
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
        // Anything already out is not offered again — it is not the user's
        // decision to make twice.
        item.lines
          .filter((l) => !l.rejected)
          .map((l) => ({
            lineId: l.id,
            label: `${scenarioById(scenarios, l.scenarioId).name} · ${buildById(builds, l.buildId).name}`,
          })),
      );
    }
    return map;
  }, [items, selections, podId]);

  // Everything under a ticked article starts ticked with it.
  const [picked, setPicked] = useState<Map<string, Set<string>>>(() => {
    const initial = new Map<string, Set<string>>();
    for (const id of preselect) {
      const item = items.find((i) => i.id === id);
      if (!item) continue;
      if (item.kind === "kit" ? item.rejected : (configsOf.get(id) ?? []).length === 0) continue;
      initial.set(id, new Set((configsOf.get(id) ?? []).map((c) => c.lineId)));
    }
    return initial;
  });
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  /** An article is still offerable while any of its configurations is in. */
  const available = items.filter((i) =>
    i.kind === "kit" ? !i.rejected : (configsOf.get(i.id) ?? []).length > 0,
  );
  const spent = (item: QuoteItem) => !available.includes(item);

  const toggleItem = (item: QuoteItem) => {
    const next = new Map(picked);
    if (next.has(item.id)) next.delete(item.id);
    else next.set(item.id, new Set((configsOf.get(item.id) ?? []).map((c) => c.lineId)));
    setPicked(next);
  };

  const toggleConfig = (item: QuoteItem, lineId: string) => {
    const next = new Map(picked);
    const set = new Set(next.get(item.id) ?? []);
    if (set.has(lineId)) set.delete(lineId);
    else set.add(lineId);
    // An article with nothing ticked inside it is not being sent back.
    if (set.size === 0) next.delete(item.id);
    else next.set(item.id, set);
    setPicked(next);
  };

  const selectAll = () => {
    if (picked.size === available.length) {
      setPicked(new Map());
      return;
    }
    const next = new Map<string, Set<string>>();
    for (const item of available) {
      next.set(item.id, new Set((configsOf.get(item.id) ?? []).map((c) => c.lineId)));
    }
    setPicked(next);
  };

  const totalConfigs = Array.from(picked.values()).reduce((n, s) => n + Math.max(s.size, 1), 0);
  const whole = picked.size === available.length && available.length > 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Reject for recosting"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
    >
      <button className="absolute inset-0 bg-ink-900/40" aria-label="Cancel" onClick={onClose} />

      <div className="relative flex max-h-[88vh] w-full max-w-[600px] flex-col overflow-hidden rounded-xl border border-hairline bg-surface shadow-2xl">
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
              {picked.size} of {available.length} article{available.length === 1 ? "" : "s"} ·{" "}
              {totalConfigs} configuration{totalConfigs === 1 ? "" : "s"}
              {whole && " — the whole quotation"}
            </span>
            {available.length > 1 && (
              <button
                type="button"
                onClick={selectAll}
                className="ml-auto rounded-md border border-hairline bg-surface px-2.5 py-1 text-[11.5px] font-medium text-ink-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
              >
                {picked.size === available.length ? "Clear selection" : "Select all"}
              </button>
            )}
          </div>

          <ul className="mt-2.5 space-y-1.5">
            {items.map((item) => {
              const configs = configsOf.get(item.id) ?? [];
              const chosen = picked.get(item.id);
              const on = chosen !== undefined;
              const already = spent(item);
              const expanded = open.has(item.id);
              const isKit = item.kind === "kit";

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
                          ? `${item.members.map((m) => m.name).join(" + ")} — priced as one set, goes back whole`
                          : `${chosen ? chosen.size : 0} of ${configs.length} configuration${configs.length === 1 ? "" : "s"} selected`}
                      </span>
                    </span>

                    {already && (
                      <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-amber-900">
                        Already out
                      </span>
                    )}

                    {/* Only a product has configurations to open. */}
                    {!isKit && configs.length > 1 && !already && (
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
                        aria-label={`Choose configurations of ${item.name}`}
                        className="shrink-0 rounded p-1 text-ink-400 hover:bg-surface-alt hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
                      >
                        <ChevronDown
                          className={cn("h-4 w-4 transition-transform", !expanded && "-rotate-90")}
                          aria-hidden
                        />
                      </button>
                    )}
                  </div>

                  {expanded && !isKit && (
                    <ul className="border-t border-hairline bg-surface/60 px-3 py-2">
                      {configs.map((cfg) => (
                        <li key={cfg.lineId}>
                          <label className="flex cursor-pointer items-center gap-2.5 py-1">
                            <input
                              type="checkbox"
                              checked={chosen?.has(cfg.lineId) ?? false}
                              onChange={() => toggleConfig(item, cfg.lineId)}
                              className="h-3.5 w-3.5 accent-[#8f2c22]"
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
                Array.from(picked, ([itemId, lineIds]) => ({
                  itemId,
                  lineIds: Array.from(lineIds),
                })),
                reason,
              )
            }
            className="rounded-md bg-[#8f2c22] px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-[#7a251c] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            Send {whole ? "all" : totalConfigs} back
          </button>
        </footer>
      </div>
    </div>
  );
}
