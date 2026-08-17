/**
 * The working sheet — the quotation the way Tracon reads it first.
 *
 * The Excel this mirrors opens on a compact grid of every line with its cost,
 * price and margin, and the detail sits behind each row. This component is
 * that grid, and the row expands in place to show the full build-up: a
 * commercial review is a comparison between lines, so the reviewer must never
 * lose the other rows in order to interrogate one of them.
 *
 * It owns no pricing. Every figure is read off the same `ViewedItem`s the rest
 * of the workspace renders, so the sheet, the drill-down and the totals cannot
 * disagree.
 */

import { useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Columns3,
  Filter,
  MessageSquare,
  MoreVertical,
  Search,
  Table2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { inr, pct, usd } from "@/lib/commercialProvisions";
import { inrShort } from "@/lib/fabricRequirement";
import type { CostRollup } from "@/lib/costingModel";
import type { ViewedItem } from "@/lib/quotationView";
import { REVIEW_LABEL, reviewStatusOf, type ReviewStatus } from "@/lib/quotationReview";
import { calloutsFor, type Callout } from "@/lib/quotationCallouts";
import type { Pod } from "@/lib/podsStore";
import { CostBuildUp } from "./CostBuildUp";

/* ------------------------------------------------------------------ *
 * Rows
 * ------------------------------------------------------------------ */

type Row = {
  id: string;
  view: ViewedItem;
  /** "A1 · D1" — the sheet's own article/design reference */
  ref: string;
  product: string;
  size: string;
  composition: string;
  gsm: string;
  qty: number;
  qtyLabel: string;
  materialUsd: number;
  totalCostUsd: number;
  sellingUsd: number;
  marginInr: number;
  marginPct: number;
  status: ReviewStatus;
  callouts: Callout[];
};

/** The fabric the costing actually priced, read off the resolved components. */
const compositionOf = (rollup: CostRollup): string | undefined =>
  rollup.components.find((c) => c.material?.master?.composition)?.material?.master?.composition;

const certificationOf = (rollup: CostRollup): string | undefined =>
  rollup.components.find((c) => c.material?.master?.certification)?.material?.master?.certification;

const uniq = (xs: (string | undefined)[]) =>
  Array.from(new Set(xs.filter((x): x is string => Boolean(x))));

function toRow(v: ViewedItem, pod: Pod | undefined): Row {
  const c = v.priced.commercial;
  const article = pod?.articles.find((a) => a.id === v.item.articleId);
  const ref =
    [article?.articleNo, article?.designNo].filter(Boolean).join(" · ") || v.item.articleId;

  const articleIds =
    v.kind === "kit" ? v.priced.members.map((m) => m.articleId) : [v.item.articleId];
  const callouts = articleIds.flatMap((id) => calloutsFor(pod, id));

  const common = {
    id: v.item.id,
    view: v,
    ref,
    totalCostUsd: c.finalCostUsd,
    sellingUsd: c.sellingUsd,
    marginInr: c.marginInr,
    marginPct: c.marginPct,
    status: reviewStatusOf(v),
    callouts,
  };

  if (v.kind === "kit") {
    const comps = uniq(v.priced.members.map((m) => compositionOf(m.rollup)));
    const cert = uniq(v.priced.members.map((m) => certificationOf(m.rollup)));
    return {
      ...common,
      product: `Kit — ${v.item.name}`,
      size: v.item.size ?? `Set of ${v.priced.members.length}`,
      composition: [comps.join(" / ") || "—", cert.join(" / ")].filter(Boolean).join(" · "),
      gsm: uniq(v.priced.members.map((m) => `${m.gsm}`)).join(" / "),
      qty: v.priced.sets,
      qtyLabel: `${v.priced.sets.toLocaleString("en-IN")} sets`,
      // A kit has no single roll-up; its material cost per set is each member's
      // raw material × its units — the same sum the set price stacks.
      materialUsd:
        Math.round(
          (v.priced.members.reduce((t, m) => t + m.rollup.rawMaterial * m.unitsPerSet, 0) /
            v.priced.fxRate) *
            100,
        ) / 100,
    };
  }

  const cert = certificationOf(v.priced.rollup);
  return {
    ...common,
    product: v.item.name,
    size: v.item.size ?? v.priced.sizeLabel,
    composition: [compositionOf(v.priced.rollup) ?? "—", cert].filter(Boolean).join(" · "),
    gsm: `${v.priced.gsm}`,
    qty: v.priced.moq,
    qtyLabel: `${v.priced.moq.toLocaleString("en-IN")} pcs`,
    materialUsd: Math.round((v.priced.rollup.rawMaterial / v.priced.fxRate) * 100) / 100,
  };
}

/* ------------------------------------------------------------------ *
 * Optional columns
 * ------------------------------------------------------------------ */

const OPTIONAL_COLUMNS = [
  { key: "size", label: "Size" },
  { key: "composition", label: "Composition" },
  { key: "gsm", label: "GSM" },
  { key: "material", label: "Material Cost" },
] as const;

type OptionalColumn = (typeof OPTIONAL_COLUMNS)[number]["key"];

const ALL_STATUSES: ReviewStatus[] = ["review", "overridden", "ready", "rejected"];

/* ------------------------------------------------------------------ *
 * The sheet
 * ------------------------------------------------------------------ */

export function WorkingSheet({
  views,
  pod,
  quotationId,
  readOnly,
  onOverride,
  onReject,
  onOpenContext,
}: {
  views: ViewedItem[];
  pod: Pod | undefined;
  quotationId: string;
  readOnly: boolean;
  onOverride: (itemId: string) => void;
  onReject: (itemId: string) => void;
  onOpenContext?: (articleId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<Set<ReviewStatus>>(new Set());
  const [hidden, setHidden] = useState<Set<OptionalColumn>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [panel, setPanel] = useState<"filters" | "columns" | null>(null);

  const rows = useMemo(() => views.map((v) => toRow(v, pod)), [views, pod]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statuses.size > 0 && !statuses.has(r.status)) return false;
      if (!q) return true;
      return [r.ref, r.product, r.size, r.composition, r.gsm].join(" ").toLowerCase().includes(q);
    });
  }, [rows, query, statuses]);

  const shows = (c: OptionalColumn) => !hidden.has(c);

  // Totals follow what is on screen: a filtered sheet whose total still counted
  // the hidden rows would be quietly lying about the selection.
  const totals = visible.reduce(
    (t, r) => ({
      qty: t.qty + r.qty,
      material: t.material + r.materialUsd * r.qty,
      cost: t.cost + r.totalCostUsd * r.qty,
      selling: t.selling + r.sellingUsd * r.qty,
      marginInr: t.marginInr + r.marginInr,
    }),
    { qty: 0, material: 0, cost: 0, selling: 0, marginInr: 0 },
  );
  const blendedMarginPct =
    totals.selling > 0
      ? Math.round(((totals.selling - totals.cost) / totals.selling) * 1000) / 10
      : 0;

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const colCount =
    9 +
    [shows("size"), shows("composition"), shows("gsm"), shows("material")].filter(Boolean).length;

  return (
    <section
      aria-label="Quotation summary working sheet"
      className="mb-4 overflow-hidden rounded-xl border border-hairline bg-surface"
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-hairline bg-surface-alt px-4 py-2.5">
        <Table2 className="h-3.5 w-3.5 text-ink-500" aria-hidden />
        <h2 className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-ink-700">
          Quotation summary · {quotationId}
        </h2>
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10.5px] font-semibold tabular-nums text-brand-700">
          {visible.length} {visible.length === 1 ? "line" : "lines"}
          {visible.length !== rows.length && ` of ${rows.length}`}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="relative">
            <span className="sr-only">Search the working sheet</span>
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search article, product, size, composition…"
              className="w-[248px] rounded-md border border-hairline bg-surface py-1.5 pl-8 pr-2.5 text-[12px] text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
            />
          </label>

          <ToolbarPopover
            open={panel === "filters"}
            onToggle={() => setPanel((p) => (p === "filters" ? null : "filters"))}
            label="Filters"
            icon={<Filter className="h-3.5 w-3.5" aria-hidden />}
            badge={statuses.size || undefined}
          >
            <fieldset>
              <legend className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-500">
                Status
              </legend>
              {ALL_STATUSES.map((s) => (
                <label key={s} className="flex cursor-pointer items-center gap-2 py-1 text-[12px]">
                  <input
                    type="checkbox"
                    checked={statuses.has(s)}
                    onChange={() =>
                      setStatuses((prev) => {
                        const next = new Set(prev);
                        if (next.has(s)) next.delete(s);
                        else next.add(s);
                        return next;
                      })
                    }
                    className="h-3.5 w-3.5 accent-[var(--color-brand-700)]"
                  />
                  {REVIEW_LABEL[s]}
                  <span className="ml-auto tabular-nums text-ink-400">
                    {rows.filter((r) => r.status === s).length}
                  </span>
                </label>
              ))}
            </fieldset>
            {statuses.size > 0 && (
              <button
                type="button"
                onClick={() => setStatuses(new Set())}
                className="mt-2 w-full rounded border border-hairline px-2 py-1 text-[11.5px] text-ink-600 hover:bg-surface-alt"
              >
                Clear filters
              </button>
            )}
          </ToolbarPopover>

          <ToolbarPopover
            open={panel === "columns"}
            onToggle={() => setPanel((p) => (p === "columns" ? null : "columns"))}
            label="Columns"
            icon={<Columns3 className="h-3.5 w-3.5" aria-hidden />}
          >
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-500">
              Optional columns
            </p>
            {OPTIONAL_COLUMNS.map((c) => (
              <label
                key={c.key}
                className="flex cursor-pointer items-center gap-2 py-1 text-[12px]"
              >
                <input
                  type="checkbox"
                  checked={shows(c.key)}
                  onChange={() =>
                    setHidden((prev) => {
                      const next = new Set(prev);
                      if (next.has(c.key)) next.delete(c.key);
                      else next.add(c.key);
                      return next;
                    })
                  }
                  className="h-3.5 w-3.5 accent-[var(--color-brand-700)]"
                />
                {c.label}
              </label>
            ))}
          </ToolbarPopover>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-hairline bg-surface-alt/60 text-[10px] uppercase tracking-[0.1em] text-ink-500">
              <th scope="col" className="w-8 px-2 py-2">
                <span className="sr-only">Expand</span>
              </th>
              <th scope="col" className="w-8 px-1 py-2 text-right font-medium">
                Sr.
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Article #
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Product
              </th>
              {shows("size") && (
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Size
                </th>
              )}
              {shows("composition") && (
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Composition
                </th>
              )}
              {shows("gsm") && (
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  GSM
                </th>
              )}
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Quoted MOQ
              </th>
              {shows("material") && (
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Material Cost
                </th>
              )}
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Total Cost
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Selling Price
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Margin ₹
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Margin %
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Status
              </th>
              <th scope="col" className="px-2 py-2 text-center font-medium">
                Call-outs
              </th>
              <th scope="col" className="w-10 px-2 py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {visible.length === 0 && (
              <tr>
                <td
                  colSpan={colCount}
                  className="px-4 py-10 text-center text-[12.5px] text-ink-500"
                >
                  No lines match this search or filter.
                </td>
              </tr>
            )}

            {visible.map((r, i) => {
              const open = expanded.has(r.id);
              return (
                <SheetRow
                  key={r.id}
                  row={r}
                  index={i}
                  open={open}
                  colCount={colCount}
                  shows={shows}
                  pod={pod}
                  readOnly={readOnly}
                  onToggle={() => toggleExpanded(r.id)}
                  onOverride={() => onOverride(r.id)}
                  onReject={() => onReject(r.id)}
                  onOpenContext={onOpenContext}
                />
              );
            })}
          </tbody>

          <tfoot>
            <tr className="border-t-2 border-ink-200 bg-surface-alt/70 font-semibold text-ink-900">
              <td className="px-2 py-2.5" />
              <td
                className="px-3 py-2.5"
                colSpan={
                  3 + [shows("size"), shows("composition"), shows("gsm")].filter(Boolean).length
                }
              >
                Total ({visible.length} {visible.length === 1 ? "line" : "lines"})
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {totals.qty.toLocaleString("en-IN")}
              </td>
              {shows("material") && (
                <td className="px-3 py-2.5 text-right tabular-nums">{usd(totals.material, 0)}</td>
              )}
              <td className="px-3 py-2.5 text-right tabular-nums">{usd(totals.cost, 0)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{usd(totals.selling, 0)}</td>
              <td
                className={cn(
                  "px-3 py-2.5 text-right tabular-nums",
                  totals.marginInr < 0 && "text-[var(--color-risk)]",
                )}
              >
                {inrShort(totals.marginInr)}
              </td>
              <td
                className={cn(
                  "px-3 py-2.5 text-right tabular-nums",
                  blendedMarginPct < 0 && "text-[var(--color-risk)]",
                )}
              >
                {pct(blendedMarginPct, 2)}
              </td>
              <td className="px-3 py-2.5" colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="border-t border-hairline px-4 py-2 text-[10.5px] text-ink-400">
        Kits are quoted per set — their money columns read per set. Open a row for the full cost
        build-up. Totals follow the rows currently shown.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * One row, and its drill-down
 * ------------------------------------------------------------------ */

function SheetRow({
  row,
  index,
  open,
  colCount,
  shows,
  pod,
  readOnly,
  onToggle,
  onOverride,
  onReject,
  onOpenContext,
}: {
  row: Row;
  index: number;
  open: boolean;
  colCount: number;
  shows: (c: OptionalColumn) => boolean;
  pod: Pod | undefined;
  readOnly: boolean;
  onToggle: () => void;
  onOverride: () => void;
  onReject: () => void;
  onOpenContext?: (articleId: string) => void;
}) {
  const negative = row.marginPct < 0;
  const article = pod?.articles.find((a) => a.id === row.view.item.articleId);

  return (
    <>
      <tr
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        tabIndex={0}
        aria-expanded={open}
        title={open ? "Hide the cost build-up" : "Show the cost build-up"}
        className={cn(
          "cursor-pointer border-b transition-colors focus-visible:outline-none",
          open
            ? // An open row is the HEAD of its detail block, not another row in
              // the list: it keeps the accent bar and loses the bottom rule, so
              // the row and the panel below read as one object.
              "border-transparent bg-brand-50 shadow-[inset_3px_0_0_0_var(--color-brand-700)]"
            : "border-hairline hover:bg-surface-alt/60 focus-visible:bg-surface-alt/60",
        )}
      >
        <td className="px-2 py-2.5">
          <ChevronDown
            aria-hidden
            className={cn("h-4 w-4 text-ink-500 transition-transform", !open && "-rotate-90")}
          />
        </td>
        <td className="px-1 py-2.5 text-right tabular-nums text-ink-400">{index + 1}</td>
        <td className="px-3 py-2.5 font-medium text-ink-900">{row.ref}</td>
        <td className="px-3 py-2.5 text-ink-900">{row.product}</td>
        {shows("size") && <td className="px-3 py-2.5 text-ink-700">{row.size}</td>}
        {shows("composition") && (
          <td className="px-3 py-2.5 text-ink-700">
            <span className="line-clamp-2">{row.composition}</span>
          </td>
        )}
        {shows("gsm") && (
          <td className="px-3 py-2.5 text-right tabular-nums text-ink-700">{row.gsm}</td>
        )}
        <td className="px-3 py-2.5 text-right tabular-nums text-ink-700">{row.qtyLabel}</td>
        {shows("material") && (
          <td className="px-3 py-2.5 text-right tabular-nums text-ink-700">
            {usd(row.materialUsd)}
          </td>
        )}
        <td className="px-3 py-2.5 text-right tabular-nums text-ink-700">
          {usd(row.totalCostUsd)}
        </td>
        <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-ink-900">
          {usd(row.sellingUsd)}
        </td>
        <td
          className={cn(
            "px-3 py-2.5 text-right tabular-nums",
            negative ? "text-[var(--color-risk)]" : "text-ink-700",
          )}
        >
          {inr(row.marginInr)}
        </td>
        <td
          className={cn(
            "px-3 py-2.5 text-right font-semibold tabular-nums",
            negative ? "text-[var(--color-risk)]" : "text-ink-900",
          )}
        >
          {pct(row.marginPct, 2)}
        </td>
        <td className="px-3 py-2.5">
          <StatusPill status={row.status} />
        </td>
        <td className="px-2 py-2.5 text-center">
          {row.callouts.length > 0 && (
            <span
              title={row.callouts.map((c) => c.text).join("\n\n")}
              className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface px-1.5 py-0.5 text-[10.5px] font-medium tabular-nums text-ink-600"
            >
              <MessageSquare className="h-3 w-3" aria-hidden />
              {row.callouts.length}
            </span>
          )}
        </td>
        <td className="px-2 py-2.5">
          <RowActions
            readOnly={readOnly}
            open={open}
            onReview={onToggle}
            onOverride={onOverride}
            onReject={onReject}
          />
        </td>
      </tr>

      {open && (
        // Inset and framed so the detail reads as a panel belonging to the row
        // above it, rather than as more table. Without the inset the build-up
        // ran edge to edge and the sheet became one undifferentiated block.
        <tr className="border-b border-hairline">
          <td
            colSpan={colCount}
            className="bg-brand-50 p-0 shadow-[inset_3px_0_0_0_var(--color-brand-700)]"
          >
            <div className="px-3 pb-3">
              <div className="overflow-hidden rounded-lg border border-hairline bg-surface">
                <header className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-hairline bg-surface-alt px-4 py-2">
                  <h4 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-700">
                    {row.product}
                  </h4>
                  <span className="text-[11px] text-ink-500">
                    {row.ref} · {row.size} · {row.qtyLabel}
                  </span>
                  <button
                    type="button"
                    onClick={onToggle}
                    className="ml-auto rounded px-2 py-0.5 text-[11px] font-medium text-ink-500 hover:bg-surface hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
                  >
                    Collapse
                  </button>
                </header>
                <CostBuildUp
                  view={row.view}
                  article={article}
                  callouts={row.callouts}
                  onOpenContext={onOpenContext}
                />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function StatusPill({ status }: { status: ReviewStatus }) {
  const tone: Record<ReviewStatus, string> = {
    review: "border-gold-500/40 bg-gold-50 text-gold-700",
    overridden: "border-brand-600/30 bg-brand-50 text-brand-700",
    ready: "border-hairline bg-surface-alt text-ink-600",
    rejected: "border-[var(--color-risk)]/30 bg-[var(--color-risk-soft)] text-[var(--color-risk)]",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-[10.5px] font-semibold",
        tone[status],
      )}
    >
      {REVIEW_LABEL[status]}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Row-level decision menu
 * ------------------------------------------------------------------ */

/**
 * Review · Override · Reject, on the row.
 *
 * The same three decisions the quotation-level bar offers, because the reviewer
 * reaches them from either direction: "this line is the problem" and "this
 * quotation is the problem" are both real, and neither should force a detour
 * through the other.
 */
function RowActions({
  readOnly,
  open,
  onReview,
  onOverride,
  onReject,
}: {
  readOnly: boolean;
  open: boolean;
  onReview: () => void;
  onOverride: () => void;
  onReject: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      className="relative"
      onClick={(e) => e.stopPropagation()}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setMenuOpen(false);
      }}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Line actions"
        onClick={() => setMenuOpen((o) => !o)}
        className="rounded-md p-1 text-ink-500 hover:bg-surface-alt hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-lg border border-hairline bg-surface py-1 shadow-lg"
        >
          <MenuItem
            onClick={() => {
              setMenuOpen(false);
              onReview();
            }}
          >
            {open ? "Hide build-up" : "Review build-up"}
          </MenuItem>
          <MenuItem
            disabled={readOnly}
            onClick={() => {
              setMenuOpen(false);
              onOverride();
            }}
          >
            Override…
          </MenuItem>
          <MenuItem
            disabled={readOnly}
            danger
            onClick={() => {
              setMenuOpen(false);
              onReject();
            }}
          >
            Reject…
          </MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "block w-full px-3 py-1.5 text-left text-[12.5px] hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:bg-surface-alt",
        danger ? "text-[var(--color-risk)]" : "text-ink-700",
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Toolbar popovers
 * ------------------------------------------------------------------ */

function ToolbarPopover({
  open,
  onToggle,
  label,
  icon,
  badge,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (open && !e.currentTarget.contains(e.relatedTarget as Node | null)) onToggle();
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
          open
            ? "border-brand-700 bg-brand-50 text-brand-800"
            : "border-hairline bg-surface text-ink-700 hover:bg-surface-alt",
        )}
      >
        {icon}
        {label}
        {badge !== undefined && (
          <span className="rounded-full bg-brand-700 px-1.5 text-[10px] font-semibold tabular-nums text-white">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-lg border border-hairline bg-surface p-3 shadow-lg">
          {children}
        </div>
      )}
    </div>
  );
}
