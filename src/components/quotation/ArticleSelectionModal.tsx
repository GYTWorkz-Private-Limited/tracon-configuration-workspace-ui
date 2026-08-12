/**
 * "Which ready items do I actually want to quote?"
 *
 * The single selection surface in the workflow — used both by the Costing
 * Report's "Continue to Quotation" and by "Add Product" inside the Quotation
 * Workspace, so the rules never differ between the two entry points.
 *
 * Two things it deliberately does NOT do:
 *   • hide articles that are not ready — they stay listed, disabled, so the
 *     user can see they exist and understand why they cannot be picked;
 *   • merge products into a kit — a kit is only a kit when the user picks the
 *     kit that costing actually built.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Boxes, Check, Info, Lock, Package, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ARTICLE_STATUS_LABEL, type Article } from "@/lib/podsStore";
import { NOT_READY_LABEL, READY_LABEL, isReadyIn, useReadiness } from "@/lib/quotationReadiness";
import { RECOSTING_LABEL, recostRequestIn, useRecostRequests } from "@/lib/recostingStore";

export function ArticleSelectionModal({
  open,
  onClose,
  podId,
  articles,
  alreadyQuotedIds,
  onConfirm,
  title = "Select Items for Quotation",
  confirmLabel = "Add to Quotation",
  /** ids ticked when the modal opens — the article the user came in from */
  preselect,
}: {
  open: boolean;
  onClose: () => void;
  podId: string;
  articles: Article[];
  alreadyQuotedIds?: Set<string>;
  onConfirm: (ids: string[]) => void;
  title?: string;
  confirmLabel?: string;
  preselect?: string[];
}) {
  const readiness = useReadiness();
  const recosts = useRecostRequests();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const closeRef = useRef<HTMLButtonElement>(null);

  const rows = useMemo(
    () =>
      articles.map((a) => {
        const ready = isReadyIn(readiness, podId, a.id);
        const quoted = alreadyQuotedIds?.has(a.id) ?? false;
        const recost = recostRequestIn(recosts, podId, a.id);
        return { article: a, ready, quoted, recost, selectable: ready && !quoted };
      }),
    [articles, readiness, recosts, podId, alreadyQuotedIds],
  );

  // Opening fresh must not resurrect a stale tick, and the article the user
  // arrived from should already be selected when it is eligible.
  useEffect(() => {
    if (!open) return;
    const eligible = new Set(rows.filter((r) => r.selectable).map((r) => r.article.id));
    setPicked(new Set((preselect ?? []).filter((id) => eligible.has(id))));
    closeRef.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };

  const chosen = rows.filter((r) => picked.has(r.article.id));
  const eligibleCount = rows.filter((r) => r.selectable).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button className="absolute inset-0 bg-ink-900/40" aria-label="Close" onClick={onClose} />

      <div className="relative flex max-h-[86vh] w-full max-w-[720px] flex-col overflow-hidden rounded-xl border border-hairline bg-surface shadow-2xl">
        <header className="flex shrink-0 items-start gap-3 border-b border-hairline px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold text-ink-900">{title}</h2>
            <p className="mt-0.5 text-[12px] text-ink-500">
              Only articles marked{" "}
              <strong className="font-medium text-ink-700">{READY_LABEL}</strong> on their Costing
              Report can be quoted.
            </p>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close"
            className="ml-auto shrink-0 rounded-md p-1.5 text-ink-500 hover:bg-surface-alt hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {rows.length === 0 ? (
            <p className="py-12 text-center text-[13px] text-ink-500">
              This POD has no articles yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((row) => (
                <ArticleRow
                  key={row.article.id}
                  {...row}
                  checked={picked.has(row.article.id)}
                  onToggle={() => toggle(row.article.id)}
                />
              ))}
            </ul>
          )}

          {eligibleCount === 0 && rows.length > 0 && (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12px] text-amber-900">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              Nothing here is ready to quote yet. Open an article's Costing Report and choose{" "}
              <strong className="font-semibold">Mark as Ready for Quotation</strong> first.
            </p>
          )}
        </div>

        <footer className="shrink-0 border-t border-hairline bg-surface-alt/40 px-5 py-3.5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-medium text-ink-900">
                {chosen.length} item{chosen.length === 1 ? "" : "s"} selected
              </p>
              {chosen.length > 0 && (
                <ul className="mt-1 flex flex-wrap gap-x-1.5 gap-y-1">
                  {chosen.map((c) => (
                    <li
                      key={c.article.id}
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[11px] font-medium",
                        c.article.type === "kit"
                          ? "bg-[var(--color-cfg-soft)] text-[var(--color-cfg-strong)]"
                          : "bg-ink-100 text-ink-700",
                      )}
                    >
                      {c.article.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={onClose}
                className="rounded-md border border-hairline bg-surface px-3.5 py-2 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
              >
                Cancel
              </button>
              <button
                disabled={picked.size === 0}
                onClick={() => onConfirm(Array.from(picked))}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
              >
                {confirmLabel} <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Row
 * ------------------------------------------------------------------ */

function ArticleRow({
  article,
  ready,
  quoted,
  recost,
  selectable,
  checked,
  onToggle,
}: {
  article: Article;
  ready: boolean;
  quoted: boolean;
  /** a quotation is waiting on this article being re-costed */
  recost?: { reason: string; quotationId: string };
  selectable: boolean;
  checked: boolean;
  onToggle: () => void;
}) {
  const isKit = article.type === "kit";
  const members = article.kitItems ?? [];

  const body = (
    <>
      <input
        type="checkbox"
        checked={checked}
        disabled={!selectable}
        onChange={onToggle}
        aria-label={`Select ${article.name}`}
        className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-brand-700)] disabled:cursor-not-allowed"
      />

      {article.image ? (
        <img
          src={article.image}
          alt=""
          className={cn(
            // Dimmed, not desaturated: grayscale washes pale product shots out
            // until they read as a broken image.
            "h-11 w-11 shrink-0 rounded-md border border-hairline object-cover",
            !selectable && "opacity-60",
          )}
        />
      ) : (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-alt text-ink-400">
          {isKit ? <Boxes className="h-4 w-4" /> : <Package className="h-4 w-4" />}
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "text-[13px] font-semibold",
              selectable ? "text-ink-900" : "text-ink-500",
            )}
          >
            {isKit ? `Kit — ${article.name}` : article.name}
          </span>
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]",
              isKit
                ? "bg-[var(--color-cfg-strong)] text-white"
                : "border border-hairline bg-surface text-ink-600",
            )}
          >
            {isKit ? "Kit" : "Product"}
          </span>
          {isKit && members.length > 0 && (
            <span className="text-[11px] text-ink-500">
              {members.length} Product{members.length === 1 ? "" : "s"}
            </span>
          )}
        </span>

        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-ink-500">
          {article.size && <span>{article.size}</span>}
          <span aria-hidden>·</span>
          <span>MOQ {article.moq}</span>
          <span aria-hidden>·</span>
          <span>Costing: {ARTICLE_STATUS_LABEL[article.status]}</span>
        </span>

        {/* A kit says what is in it, so nobody feels they must also tick its
            members separately. */}
        {isKit && members.length > 0 && (
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {members.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center gap-1 rounded border border-hairline bg-surface-alt px-1.5 py-0.5 text-[10.5px] text-ink-600"
              >
                {m.image && (
                  <img src={m.image} alt="" className="h-3.5 w-3.5 rounded-sm object-cover" />
                )}
                {m.name}
                {m.qty > 1 && <span className="tabular-nums text-ink-400">×{m.qty}</span>}
              </span>
            ))}
          </span>
        )}
      </span>

      <span className="shrink-0 self-start text-right">
        <StatusPill ready={ready} quoted={quoted} />
        {/* Not ready is a fact; WHY it is not ready is what the user needs. */}
        {recost && (
          <span
            title={recost.reason}
            className="mt-1 block max-w-[170px] truncate text-[10.5px] font-medium text-amber-900"
          >
            {RECOSTING_LABEL} · {recost.quotationId}
          </span>
        )}
      </span>
    </>
  );

  const className = cn(
    "flex items-start gap-3 rounded-lg border px-3.5 py-3 transition-colors",
    checked
      ? "border-brand-600 bg-brand-50/40"
      : selectable
        ? "cursor-pointer border-hairline bg-surface hover:bg-surface-alt"
        : "border-hairline bg-surface-alt/40",
  );

  // A disabled row must not be a <label>: clicking it would otherwise read as
  // an affordance that silently does nothing.
  return (
    <li>
      {selectable ? (
        <label className={className}>{body}</label>
      ) : (
        <div className={className}>{body}</div>
      )}
    </li>
  );
}

function StatusPill({ ready, quoted }: { ready: boolean; quoted: boolean }) {
  if (quoted) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-[10.5px] font-medium text-ink-600">
        <Check className="h-3 w-3" aria-hidden /> Already on quotation
      </span>
    );
  }
  if (ready) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10.5px] font-semibold text-brand-700">
        <Check className="h-3 w-3" aria-hidden /> {READY_LABEL}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface px-2 py-0.5 text-[10.5px] font-medium text-ink-500"
      title="Mark this article ready on its Costing Report to quote it."
    >
      <Lock className="h-3 w-3" aria-hidden /> {NOT_READY_LABEL}
    </span>
  );
}
