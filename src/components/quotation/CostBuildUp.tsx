/**
 * The full cost build-up for one quoted line, opened underneath its row.
 *
 * This is the Price Working Sheet's detail band, in the order the sheet reads
 * it: what the fabric costs, what the piece costs to make, what the commercial
 * stack adds, what it therefore sells for, and what margin that leaves. A
 * reviewer who wants to argue with a margin has to be able to see the ladder
 * that produced it without leaving the row they are arguing about — which is
 * why this expands in place rather than navigating anywhere.
 *
 * It computes nothing. Every figure is read off the `ViewedItem` the summary
 * row above was built from, so the row and its drill-down cannot disagree.
 */

import { ExternalLink, MessageSquare, Scissors } from "lucide-react";

import { cn } from "@/lib/utils";
import { inr, pct, usd, type CommercialResult } from "@/lib/commercialProvisions";
import { finalOf, type CostRollup, type ResolvedComponent } from "@/lib/costingModel";
import type { ViewedItem } from "@/lib/quotationView";
import { CALLOUT_SOURCE_LABEL, type Callout } from "@/lib/quotationCallouts";
import type { Article } from "@/lib/podsStore";

/* ------------------------------------------------------------------ *
 * Reading the fabric off the costing
 * ------------------------------------------------------------------ */

/** The component that actually carries the base fabric, if the model has one. */
const fabricComponentOf = (rollup: CostRollup): ResolvedComponent | undefined =>
  rollup.components.find((c) => c.material?.master?.materialType === "Fabric") ??
  rollup.components.find((c) => c.material?.master?.width !== undefined);

type FabricFacts = {
  name: string;
  greigeWidth?: number;
  finishedWidth?: number;
  ratePerMetre: number;
  rateUnit: string;
  consumptionPerPiece: number;
  costPerPiece: number;
  composition?: string;
  construction?: string;
  gsm?: number;
  supplier?: string;
};

/**
 * Rate units arrive already phrased as a rate — "per metre" — which reads
 * wrong wherever the unit is being used as a plain noun ("0.687 per metre per
 * piece"). This strips the preposition back off for those positions.
 */
const unitNoun = (rateUnit: string) => rateUnit.replace(/^per\s+/i, "");

function fabricFactsOf(rollup: CostRollup): FabricFacts | undefined {
  const c = fabricComponentOf(rollup);
  if (!c?.material) return undefined;
  const m = c.material.master;
  return {
    name: c.material.name,
    // The roll arrives at one width and finishes narrower; the sheet quotes
    // both because the finished width is what the layout is planned against.
    greigeWidth: m?.width,
    finishedWidth: m?.costingWidth ?? m?.width,
    ratePerMetre: finalOf(c.material.rate),
    rateUnit: c.material.rateUnit,
    consumptionPerPiece: c.consumptionPerPiece,
    costPerPiece: c.materialCost,
    composition: m?.composition,
    construction: m?.construction,
    gsm: m?.gsm,
    supplier: m?.supplier,
  };
}

/* ------------------------------------------------------------------ *
 * The panel
 * ------------------------------------------------------------------ */

export function CostBuildUp({
  view,
  article,
  callouts,
  onOpenContext,
}: {
  view: ViewedItem;
  article?: Article;
  callouts: Callout[];
  /** open the costing that produced a call-out */
  onOpenContext?: (articleId: string) => void;
}) {
  const isKit = view.kind === "kit";
  const commercial = view.priced.commercial;
  const unit = isKit ? "set" : "pc";

  // A kit has no single roll-up: each member is costed on its own and the set
  // is what the commercial stack loads. So the material band lists members.
  const rollups: { label: string; rollup: CostRollup; unitsPerSet?: number }[] = isKit
    ? view.priced.members.map((m) => ({
        label: m.name,
        rollup: m.rollup,
        unitsPerSet: m.unitsPerSet,
      }))
    : [{ label: view.item.name, rollup: view.priced.rollup }];

  return (
    <div className="border-t border-hairline bg-surface-alt/40 px-4 py-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)_minmax(0,0.9fr)]">
        <FabricBand rollups={rollups} isKit={isKit} />
        <CostLadder
          rollups={rollups}
          commercial={commercial}
          unit={unit}
          directCostInr={isKit ? view.priced.setDirectCostInr : view.priced.directCostInr}
        />
        <PriceBand view={view} commercial={commercial} unit={unit} />
      </div>

      <ContextBand
        view={view}
        article={article}
        callouts={callouts}
        onOpenContext={onOpenContext}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Fabric
 * ------------------------------------------------------------------ */

function FabricBand({
  rollups,
  isKit,
}: {
  rollups: { label: string; rollup: CostRollup; unitsPerSet?: number }[];
  isKit: boolean;
}) {
  return (
    <Panel title="Fabric cost" icon={<Scissors className="h-3.5 w-3.5" aria-hidden />}>
      <div className="space-y-3">
        {rollups.map(({ label, rollup, unitsPerSet }) => {
          const f = fabricFactsOf(rollup);
          if (!f) {
            return (
              <p key={label} className="text-[11.5px] text-ink-400">
                {isKit ? `${label} — ` : ""}no fabric component on this costing.
              </p>
            );
          }
          return (
            <div key={label}>
              {isKit && (
                <p className="mb-1 text-[11px] font-semibold text-ink-700">
                  {label}
                  {unitsPerSet && unitsPerSet > 1 && (
                    <span className="ml-1 font-normal text-ink-400">× {unitsPerSet} per set</span>
                  )}
                </p>
              )}
              <p className="text-[12px] font-medium text-ink-900">{f.name}</p>
              <dl className="mt-1.5 grid grid-cols-3 gap-px overflow-hidden rounded border border-hairline bg-hairline">
                <Fact label="Greige width" value={f.greigeWidth ? `${f.greigeWidth}"` : "—"} />
                <Fact
                  label="Finished width"
                  value={f.finishedWidth ? `${f.finishedWidth}"` : "—"}
                />
                <Fact label={`Cost ${f.rateUnit}`} value={inr(f.ratePerMetre)} />
              </dl>
              <p className="mt-1.5 text-[11px] text-ink-500">
                {f.consumptionPerPiece.toFixed(3)} {unitNoun(f.rateUnit)} per piece ={" "}
                <span className="font-medium text-ink-800">{inr(f.costPerPiece)}</span>
              </p>
              {(f.composition || f.construction || f.gsm) && (
                <p className="mt-0.5 text-[11px] text-ink-400">
                  {[f.composition, f.construction, f.gsm ? `${f.gsm} GSM` : undefined]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * The ladder — direct cost, then the commercial stack
 * ------------------------------------------------------------------ */

function CostLadder({
  rollups,
  commercial,
  unit,
  directCostInr,
}: {
  rollups: { label: string; rollup: CostRollup; unitsPerSet?: number }[];
  commercial: CommercialResult;
  unit: string;
  directCostInr: number;
}) {
  // Direct cost categories, summed across a kit's members at their set counts —
  // the same arithmetic that produced the set direct cost.
  const cat = (pick: (r: CostRollup) => number) =>
    Math.round(rollups.reduce((t, r) => t + pick(r.rollup) * (r.unitsPerSet ?? 1), 0) * 100) / 100;

  const dbk = commercial.saleLines.find((l) => l.id === "dbk");
  const saleWithoutDbk = Math.round((commercial.totalSaleInr - (dbk?.amountInr ?? 0)) * 100) / 100;

  return (
    <Panel title={`Cost build-up · ₹ per ${unit}`}>
      <table className="w-full border-collapse text-[12px]">
        <tbody>
          <Row label="Raw material" value={cat((r) => r.rawMaterial)} />
          <Row label="Process" value={cat((r) => r.process)} />
          <Row label="Accessories / trims" value={cat((r) => r.accessories)} />
          <Row label="Packaging" value={cat((r) => r.packaging)} muted="special packing" />
          <Row label="Testing" value={cat((r) => r.testing)} />
          <Row label="Direct cost" value={directCostInr} subtotal />

          <Row label="Overhead cost" value={commercial.commercialOverheadsInr} />
          <Row label="Supplier margin" value={commercial.supplierMarginsInr} />
          <Row label="Other indirect costs" value={commercial.otherIndirectInr} />
          <Row
            label="Provision on purchase"
            value={commercial.totalPurchaseInr}
            muted={pct(commercial.totalPurchasePct)}
            subtotal
          />

          <Row
            label="Provision on sale"
            value={saleWithoutDbk}
            muted={pct(Math.round((commercial.totalSalePct - (dbk?.pct ?? 0)) * 100) / 100)}
          />
          {dbk && (
            // A drawback is money coming back, so it reads as a credit rather
            // than as a smaller cost — that is how the sheet states it.
            <Row label="DBK — duty drawback" value={dbk.amountInr} credit muted={pct(dbk.pct)} />
          )}

          <Row
            label={commercial.finalCostEdited ? "Final cost — fixed by hand" : "Final cost"}
            value={commercial.finalCostInr}
            total
          />
          {commercial.finalCostEdited && (
            <Row label="Calculated final cost" value={commercial.calculatedFinalCostInr} struck />
          )}
        </tbody>
      </table>

      <p className="mt-2 text-[10.5px] leading-snug text-ink-400">
        Provisions are quoted as a percentage of direct cost. Direct cost comes from Configuration
        &amp; Costing and is never changed here.
      </p>
    </Panel>
  );
}

function Row({
  label,
  value,
  muted,
  subtotal,
  total,
  credit,
  struck,
}: {
  label: string;
  value: number;
  muted?: string;
  subtotal?: boolean;
  total?: boolean;
  credit?: boolean;
  struck?: boolean;
}) {
  return (
    <tr
      className={cn(
        "border-b border-hairline/70 last:border-b-0",
        subtotal && "bg-surface-alt/70",
        total && "bg-brand-50",
      )}
    >
      <th
        scope="row"
        className={cn(
          "py-1.5 pr-2 text-left font-normal text-ink-700",
          (subtotal || total) && "font-semibold text-ink-900",
          struck && "text-ink-400",
        )}
      >
        {label}
        {muted && <span className="ml-1.5 text-[10.5px] text-ink-400">{muted}</span>}
      </th>
      <td
        className={cn(
          "py-1.5 text-right tabular-nums text-ink-800",
          (subtotal || total) && "font-semibold text-ink-900",
          total && "text-[13px]",
          credit && "text-brand-700",
          struck && "text-ink-400 line-through",
        )}
      >
        {inr(value)}
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ *
 * Price and margin
 * ------------------------------------------------------------------ */

function PriceBand({
  view,
  commercial,
  unit,
}: {
  view: ViewedItem;
  commercial: CommercialResult;
  unit: string;
}) {
  const qty = view.kind === "kit" ? view.priced.sets : view.priced.moq;
  const negative = commercial.marginInr < 0;

  return (
    <Panel title={`Selling price & margin · per ${unit}`}>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded border border-hairline bg-hairline">
        <Fact label="Selling price ₹" value={inr(commercial.sellingInr)} strong />
        <Fact label="Selling price $" value={usd(commercial.sellingUsd)} strong />
        <Fact
          label="Margin ₹"
          value={inr(commercial.marginInr)}
          strong
          tone={negative ? "risk" : "success"}
        />
        <Fact
          label="Margin %"
          value={pct(commercial.marginPct, 2)}
          strong
          tone={negative ? "risk" : "success"}
        />
      </dl>

      {commercial.sellingPriceEdited && (
        <p className="mt-2 rounded border border-gold-500/40 bg-gold-50 px-2.5 py-1.5 text-[11px] text-ink-700">
          Selling price fixed by hand — margin is what it leaves against the final cost. The
          calculated price was{" "}
          <span className="font-semibold tabular-nums">{usd(commercial.calculatedSellingUsd)}</span>
          .
        </p>
      )}

      <dl className="mt-2 space-y-1 text-[11.5px]">
        <Line label={`Quoted ${view.kind === "kit" ? "sets" : "MOQ"}`}>
          {qty.toLocaleString("en-IN")} {view.kind === "kit" ? "sets" : "pcs"}
        </Line>
        <Line label="Exchange rate">{inr(commercial.fxRate)} / USD</Line>
        <Line label="Buyer target">{usd(commercial.buyerTargetUsd)}</Line>
        <Line label="Order value">{usd(view.priced.orderValueUsd, 0)}</Line>
      </dl>
    </Panel>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-ink-500">{label}</dt>
      <dd className="tabular-nums text-ink-800">{children}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Description, comments, remarks
 * ------------------------------------------------------------------ */

function ContextBand({
  view,
  article,
  callouts,
  onOpenContext,
}: {
  view: ViewedItem;
  article?: Article;
  callouts: Callout[];
  onOpenContext?: (articleId: string) => void;
}) {
  const facts = [
    { label: "Description", value: article?.description ?? view.item.name },
    { label: "Count / construction", value: article?.construction },
    { label: "Composition", value: article?.composition },
    { label: "Supplier", value: article?.supplier },
    { label: "Colour", value: article?.colour },
    { label: "Style", value: article?.style },
  ].filter((f) => Boolean(f.value));

  if (facts.length === 0 && callouts.length === 0) return null;

  return (
    <div className="mt-4 grid gap-4 border-t border-hairline pt-3.5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      {facts.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-3">
          {facts.map((f) => (
            <div key={f.label}>
              <dt className="text-[10px] font-medium uppercase tracking-[0.1em] text-ink-500">
                {f.label}
              </dt>
              <dd className="mt-0.5 text-[12px] leading-snug text-ink-800">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {callouts.length > 0 && (
        <div>
          <h4 className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-ink-500">
            <MessageSquare className="h-3 w-3" aria-hidden /> Costing comments
          </h4>
          <ul className="mt-1.5 space-y-1.5">
            {callouts.map((c) => (
              <li
                key={c.id}
                className="rounded border border-hairline bg-surface px-2.5 py-2 text-[11.5px] leading-snug text-ink-700"
              >
                <span className="mr-1.5 rounded bg-surface-alt px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.06em] text-ink-500">
                  {CALLOUT_SOURCE_LABEL[c.source]}
                </span>
                {c.text}
                {onOpenContext && (
                  <button
                    type="button"
                    onClick={() => onOpenContext(c.articleId)}
                    className="ml-1.5 inline-flex items-center gap-1 align-baseline text-[11px] font-medium text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
                  >
                    Open costing <ExternalLink className="h-3 w-3" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Shared shells
 * ------------------------------------------------------------------ */

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-hairline bg-surface px-3.5 py-3">
      <h3 className="mb-2 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-600">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function Fact({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "risk" | "success";
}) {
  return (
    <div className="bg-surface px-2.5 py-1.5">
      <dt className="text-[9.5px] font-medium uppercase tracking-[0.08em] text-ink-500">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 tabular-nums",
          strong ? "text-[13px] font-semibold" : "text-[12px]",
          tone === "risk"
            ? "text-[var(--color-risk)]"
            : tone === "success"
              ? "text-brand-700"
              : "text-ink-900",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
