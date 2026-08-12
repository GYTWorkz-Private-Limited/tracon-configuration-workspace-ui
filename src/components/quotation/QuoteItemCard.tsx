// One quoted thing: a single product, or a kit of several.
//
// The two are deliberately NOT the same card. A product is one article with
// one or more costing positions on it. A kit is a set — its members each keep
// their own scenario, variant, option, MOQ and costs, and the price the buyer
// sees is a single combined position computed once for the set, not two
// unrelated quotes sitting next to each other.

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Boxes, ChevronDown, Package, Settings2, Trash2, Undo2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { inr, usd } from "@/lib/commercialProvisions";
import {
  buildById,
  categoryTotals,
  parseMoq,
  parseSize,
  priceKit,
  priceLine,
  scenarioById,
  type PricedKit,
} from "@/lib/quotationPricing";
import {
  addScenario,
  buildsIn,
  scenariosIn,
  useArticleSelection,
  useCostingSelections,
  type BuildRef,
} from "@/lib/costingSelectionStore";
import {
  addLine,
  addVariantRows,
  removeItem,
  removeLine,
  setItemFinalCost,
  setItemSellingPrice,
  setLineBuild,
  clearRejection,
  rejectSelection,
  setLineFinalCost,
  setLineSellingPrice,
  setQuotedLine,
  toggleCollapsed,
  updateLine,
  type QuoteItem,
} from "@/lib/quoteDraftStore";
import { logQuotationEvent } from "@/lib/quotationHistory";
import { OverrideDialog, type RowOverride } from "./OverrideDialog";
import { RejectDialog } from "./RejectDialog";
import { CommercialBreakdown } from "./CommercialBreakdown";
import { QuoteSummary } from "./QuoteSummary";
import { QuoteLinesTable, type QuoteRow } from "./QuoteLinesTable";
import { AddConfigurationMenu } from "./AddConfigurationMenu";

export function QuoteItemCard({
  podId,
  quotationId,
  item,
  index,
  readOnly = false,
  showSummary = true,
  siblings = [],
}: {
  /** the POD the article is costed in — where scenarios and variants come from */
  podId: string;
  /** the quotation this card belongs to — where the commercial edits are saved */
  quotationId: string;
  item: QuoteItem;
  index: number;
  /**
   * A version that has been sent is the record of what the buyer received, so
   * it is shown in full and changed nowhere. Editing resumes when the next
   * version is opened.
   */
  readOnly?: boolean;
  /**
   * A multi-article quotation is sent as ONE position, so it carries one
   * combined summary at the end instead of a summary under every article.
   */
  showSummary?: boolean;
  /**
   * Everything on the quotation. A rejection is usually about the quotation
   * rather than the card it started from, so the card has to be able to offer
   * the others.
   */
  siblings?: QuoteItem[];
}) {
  const shared = { podId, quotationId, item, index, readOnly, showSummary, siblings };
  return item.kind === "kit" ? <KitCard {...shared} /> : <ProductCard {...shared} />;
}

type CardProps = {
  podId: string;
  quotationId: string;
  item: QuoteItem;
  index: number;
  readOnly: boolean;
  showSummary: boolean;
  siblings: QuoteItem[];
};

/* ------------------------------------------------------------------ *
 * Variants and options
 * ------------------------------------------------------------------ */

/**
 * The variant a row is really on.
 *
 * A row can be sitting on an option, and an option belongs to a variant — so
 * the row's variant is the option's parent, not the build itself. This is what
 * lets the row keep showing its sibling options after one has been picked.
 */
function variantOf(builds: BuildRef[], build: BuildRef): BuildRef {
  if (build.kind === "variant") return build;
  return builds.find((b) => b.id === build.parentId) ?? build;
}

/** The options branching off one variant. */
function optionsOf(builds: BuildRef[], variantId: string): BuildRef[] {
  return builds.filter((b) => b.kind === "option" && b.parentId === variantId);
}

/**
 * Apply per-row overrides through the SAME store actions the table cells use.
 *
 * One place, so a figure changed in the dialog and the same figure changed
 * inline can never take different paths into the quotation.
 */
function applyOverrides(quotationId: string, item: QuoteItem, overrides: RowOverride[]) {
  const isKit = item.kind === "kit";

  for (const o of overrides) {
    if (o.moq !== undefined) updateLine(quotationId, item.id, o.lineId, { moqOverride: o.moq });
    if (o.marginPct !== undefined) {
      updateLine(quotationId, item.id, o.lineId, { targetMarginPct: o.marginPct });
    }

    const price = o.clearSelling ? undefined : o.sellingUsd;
    if (o.clearSelling || o.sellingUsd !== undefined) {
      if (isKit) setItemSellingPrice(quotationId, item.id, price);
      else setLineSellingPrice(quotationId, item.id, o.lineId, price);
    }
  }
}

/* ================================================================== *
 * Single product
 * ================================================================== */

function ProductCard({
  podId,
  quotationId,
  item,
  index,
  readOnly,
  showSummary,
  siblings,
}: CardProps) {
  const { scenarios, builds } = useArticleSelection(podId, item.articleId);

  const rows: QuoteRow[] = useMemo(
    () =>
      item.lines.map((l) => {
        const build = buildById(builds, l.buildId);
        return {
          lineId: l.id,
          priced: priceLine({
            srfRef: item.srfRef,
            scenario: scenarioById(scenarios, l.scenarioId),
            build,
            defaults: { size: parseSize(item.size), moq: parseMoq(item.moq) },
            rates: item.rates,
            targetMarginPct: l.targetMarginPct ?? item.targetMarginPct,
            moqOverride: l.moqOverride,
            finalCostOverrideInr: l.finalCostOverrideInr,
            sellingPriceOverrideUsd: l.sellingPriceOverrideUsd,
          }),
          parentBuild: build.parentId ? builds.find((b) => b.id === build.parentId) : undefined,
          variant: variantOf(builds, build),
          options: optionsOf(builds, variantOf(builds, build).id),
          moqOverridden: l.moqOverride !== undefined,
          rejected: Boolean(l.rejected),
        };
      }),
    [item, scenarios, builds],
  );

  /**
   * Variants Configuration has published that no row covers yet.
   *
   * A row sitting on an OPTION already covers its parent variant, which is why
   * this compares by variant rather than by build id.
   */
  const uncoveredVariantIds = useMemo(() => {
    const covered = new Set(
      item.lines.map((l) => variantOf(builds, buildById(builds, l.buildId)).id),
    );
    return builds.filter((b) => b.kind === "variant" && !covered.has(b.id)).map((b) => b.id);
  }, [builds, item.lines]);

  // Configuration keeps publishing after a quotation is opened, so the rows
  // follow it. A sent version is a record and never moves.
  const uncoveredKey = uncoveredVariantIds.join(",");
  useEffect(() => {
    if (readOnly || !uncoveredKey) return;
    addVariantRows(quotationId, item.id, uncoveredKey.split(","));
  }, [quotationId, item.id, uncoveredKey, readOnly]);

  const quotedId = item.quotedLineId ?? rows[0]?.lineId;
  const quoted = rows.find((r) => r.lineId === quotedId) ?? rows[0];
  const usedKeys = new Set(item.lines.map((l) => `${l.scenarioId}::${l.buildId}`));
  const [overriding, setOverriding] = useState(false);

  if (!quoted) return null;

  return (
    <article className="overflow-hidden rounded-xl border border-hairline bg-surface shadow-sm">
      <CardHeader
        podId={podId}
        quotationId={quotationId}
        item={item}
        index={index}
        kindLabel="Product"
        kindIcon={<Package className="h-3.5 w-3.5" aria-hidden />}
        subtitle={`${item.size ?? quoted.priced.sizeLabel} · ${quoted.priced.gsm} GSM · ${item.srfRef}`}
        headline={usd(quoted.priced.commercial.sellingUsd)}
        headlineNote="/ pc"
        readOnly={readOnly}
        onOverride={() => setOverriding(true)}
        siblings={siblings.length > 0 ? siblings : [item]}
      />

      {overriding && (
        <OverrideDialog
          articleName={item.name}
          rows={rows}
          initialLineId={quoted.lineId}
          isKit={false}
          onClose={() => setOverriding(false)}
          onSave={(overrides) => {
            applyOverrides(quotationId, item, overrides);
            setOverriding(false);
          }}
        />
      )}

      <div className="border-t border-hairline">
        <QuoteLinesTable
          rows={rows}
          quotedLineId={quotedId}
          onQuote={(lineId) => setQuotedLine(quotationId, item.id, lineId)}
          readOnly={readOnly}
          onRemove={
            rows.length > 1 && !readOnly
              ? (lineId) => removeLine(quotationId, item.id, lineId)
              : undefined
          }
          onMargin={(lineId, marginPct) =>
            updateLine(quotationId, item.id, lineId, { targetMarginPct: marginPct })
          }
          onMoq={(lineId, moq) => updateLine(quotationId, item.id, lineId, { moqOverride: moq })}
          onResetMoq={(lineId) =>
            updateLine(quotationId, item.id, lineId, { moqOverride: undefined })
          }
          onBuild={(lineId, buildId) => setLineBuild(quotationId, item.id, lineId, buildId)}
          onSellingPrice={(lineId, v) => setLineSellingPrice(quotationId, item.id, lineId, v)}
          // A scoped rejection freezes only the rows that went back; the
          // article's other configurations are still quotable. The table only
          // greys out wholesale when nothing on it is left to price.
          frozen={item.lines.every((l) => Boolean(l.rejected))}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-hairline bg-surface-alt/40 px-4 py-2.5">
        <p className="min-w-0 flex-1 text-[11.5px] text-ink-500">
          Costs are pulled live from Configuration & Costing — only the commercial decisions are
          held here.
        </p>
        {!readOnly && (
          <AddConfigurationMenu
            scenarios={scenarios}
            builds={builds}
            usedKeys={usedKeys}
            onAdd={(input) => addLine(quotationId, item.id, input)}
            onCreateScenario={(s) => addScenario(podId, item.articleId, s)}
          />
        )}
      </div>

      <div className="space-y-3 border-t border-hairline bg-canvas p-4">
        <CommercialBreakdown result={quoted.priced.commercial} />
        {showSummary && (
          <QuoteSummary
            variant="product"
            result={quoted.priced.commercial}
            quantity={quoted.priced.moq}
            quantityLabel={`${quoted.priced.moq.toLocaleString("en-IN")} pcs`}
            orderValueUsd={quoted.priced.orderValueUsd}
            onSaveFinalCost={
              readOnly ? undefined : (v) => setLineFinalCost(quotationId, item.id, quoted.lineId, v)
            }
            onSaveSellingPrice={
              readOnly
                ? undefined
                : (v) => setLineSellingPrice(quotationId, item.id, quoted.lineId, v)
            }
          />
        )}
      </div>
    </article>
  );
}

/* ================================================================== *
 * Kit / bundle
 * ================================================================== */

function KitCard({ podId, quotationId, item, index, readOnly, showSummary, siblings }: CardProps) {
  // Subscribed once for the whole kit — every member reads off this snapshot,
  // so adding a scenario in Configuration re-prices the set immediately.
  const selections = useCostingSelections();

  const kit: PricedKit = useMemo(
    () =>
      priceKit(
        item.members.map((m) => {
          const scenarios = scenariosIn(selections, podId, m.articleId);
          const builds = buildsIn(selections, podId, m.articleId);
          return {
            srfRef: m.srfRef,
            scenario: scenarioById(scenarios, m.line.scenarioId),
            build: buildById(builds, m.line.buildId),
            defaults: { size: parseSize(m.size), moq: parseMoq(m.moq) },
            rates: item.rates,
            targetMarginPct: m.line.targetMarginPct,
            moqOverride: m.line.moqOverride,
            finalCostOverrideInr: m.line.finalCostOverrideInr,
            sellingPriceOverrideUsd: m.line.sellingPriceOverrideUsd,
            unitsPerSet: m.unitsPerSet,
            name: m.name,
            articleId: m.articleId,
            image: m.image,
          };
        }),
        {
          rates: item.rates,
          targetMarginPct: item.targetMarginPct,
          sets: item.sets,
          finalCostOverrideInr: item.finalCostOverrideInr,
          sellingPriceOverrideUsd: item.sellingPriceOverrideUsd,
        },
      ),
    [podId, item, selections],
  );

  const rows: QuoteRow[] = item.members.map((m, i) => {
    const builds = buildsIn(selections, podId, m.articleId);
    const build = buildById(builds, m.line.buildId);
    return {
      lineId: m.line.id,
      priced: kit.members[i],
      parentBuild: build.parentId ? builds.find((b) => b.id === build.parentId) : undefined,
      variant: variantOf(builds, build),
      options: optionsOf(builds, variantOf(builds, build).id),
      moqOverridden: m.line.moqOverride !== undefined,
      leading: { name: m.name, image: m.image, size: m.size, unitsPerSet: m.unitsPerSet },
    };
  });

  const collapsed = item.collapsed;
  const [overriding, setOverriding] = useState(false);

  return (
    <article className="overflow-hidden rounded-xl border-2 border-[var(--color-cfg)] bg-surface shadow-sm">
      <CardHeader
        podId={podId}
        quotationId={quotationId}
        item={item}
        index={index}
        kindLabel="Kit"
        kindIcon={<Boxes className="h-3.5 w-3.5" aria-hidden />}
        subtitle={`${item.members.map((m) => m.name).join(" + ")} · ${item.members.length} article${item.members.length === 1 ? "" : "s"} per set`}
        headline={usd(kit.commercial.sellingUsd)}
        headlineNote="/ set"
        readOnly={readOnly}
        onOverride={() => setOverriding(true)}
        siblings={siblings.length > 0 ? siblings : [item]}
        onToggle={() => toggleCollapsed(quotationId, item.id)}
        collapsed={collapsed}
      />

      {overriding && (
        <OverrideDialog
          articleName={item.name}
          // A kit is one commercial position, so the set's own figures are what
          // can be overridden — not each member's.
          rows={[
            {
              lineId: rows[0]?.lineId ?? item.id,
              priced: {
                ...kit.members[0],
                commercial: kit.commercial,
                moq: kit.sets,
              } as QuoteRow["priced"],
            },
          ]}
          initialLineId={rows[0]?.lineId ?? item.id}
          isKit
          onClose={() => setOverriding(false)}
          onSave={(result) => {
            applyOverrides(quotationId, item, result);
            setOverriding(false);
          }}
        />
      )}

      {collapsed ? (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-hairline bg-surface-alt/40 px-4 py-3 text-[12px]">
          <Fact label="Combined direct cost / set" value={inr(kit.setDirectCostInr)} />
          <Fact label="Final cost / set" value={inr(kit.commercial.finalCostInr)} />
          <Fact label="Selling price / set" value={usd(kit.commercial.sellingUsd)} strong />
          <Fact label="Margin" value={`${kit.commercial.marginPct.toFixed(1)}%`} />
          <Fact label="Quoted" value={`${kit.sets.toLocaleString("en-IN")} sets`} />
          <Fact label="Order value" value={usd(kit.orderValueUsd, 0)} strong />
        </div>
      ) : (
        <>
          <div className="border-t border-hairline">
            <QuoteLinesTable
              rows={rows}
              readOnly={readOnly}
              showQuoteColumn={false}
              identityHeader="Article in this set"
              onMargin={(lineId, marginPct) =>
                updateLine(quotationId, item.id, lineId, { targetMarginPct: marginPct })
              }
              onMoq={(lineId, moq) =>
                updateLine(quotationId, item.id, lineId, { moqOverride: moq })
              }
              onResetMoq={(lineId) =>
                updateLine(quotationId, item.id, lineId, { moqOverride: undefined })
              }
              onBuild={(lineId, buildId) => setLineBuild(quotationId, item.id, lineId, buildId)}
              onSellingPrice={(lineId, v) => setLineSellingPrice(quotationId, item.id, lineId, v)}
              frozen={item.lines.every((l) => Boolean(l.rejected))}
            />
          </div>

          <KitComposition kit={kit} />

          <div className="space-y-3 border-t border-hairline bg-canvas p-4">
            <CommercialBreakdown
              result={kit.commercial}
              title="Kit Commercial Overheads & Provisions"
              caption="Applied once to the set — not twice to two separate quotes."
            />
            {showSummary && (
              <QuoteSummary
                variant="kit"
                result={kit.commercial}
                quantity={kit.sets}
                quantityLabel={`${kit.sets.toLocaleString("en-IN")} sets`}
                orderValueUsd={kit.orderValueUsd}
                onSaveFinalCost={
                  readOnly ? undefined : (v) => setItemFinalCost(quotationId, item.id, v)
                }
                onSaveSellingPrice={
                  readOnly ? undefined : (v) => setItemSellingPrice(quotationId, item.id, v)
                }
              />
            )}
          </div>
        </>
      )}
    </article>
  );
}

/**
 * Where the set's direct cost comes from — each member's contribution, per set,
 * summed to the figure the commercial stack is applied to.
 *
 * Exported so the Approval report can show the same build-up without
 * recomputing it — the approver has to see exactly what the preparer saw.
 */
export function KitComposition({ kit }: { kit: PricedKit }) {
  return (
    <div className="border-t border-hairline bg-surface-alt/30 px-4 py-3">
      <h4 className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-500">
        Kit direct cost build-up
      </h4>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[640px] text-[12px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.1em] text-ink-400">
              <th scope="col" className="py-1 text-left font-medium">
                Article
              </th>
              {categoryTotals(kit.members[0]?.rollup ?? emptyRollup).map((c) => (
                <th key={c.key} scope="col" className="px-2 py-1 text-right font-medium">
                  {c.label}
                </th>
              ))}
              <th scope="col" className="px-2 py-1 text-right font-medium">
                / pc
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                / set
              </th>
            </tr>
          </thead>
          <tbody>
            {kit.members.map((m) => (
              <tr key={m.articleId} className="border-t border-hairline/70">
                <th scope="row" className="py-1.5 text-left font-medium text-ink-900">
                  {m.name}
                  {m.unitsPerSet > 1 && (
                    <span className="ml-1.5 text-[10.5px] font-normal tabular-nums text-ink-500">
                      ×{m.unitsPerSet}
                    </span>
                  )}
                </th>
                {categoryTotals(m.rollup).map((c) => (
                  <td key={c.key} className="px-2 py-1.5 text-right tabular-nums text-ink-600">
                    {inr(c.amount)}
                  </td>
                ))}
                <td className="px-2 py-1.5 text-right tabular-nums text-ink-700">
                  {inr(m.directCostInr)}
                </td>
                <td className="py-1.5 text-right font-medium tabular-nums text-ink-900">
                  {inr(m.directCostInr * m.unitsPerSet)}
                </td>
              </tr>
            ))}
            <tr className="border-t border-ink-200">
              <th scope="row" className="py-2 text-left text-[11.5px] font-semibold text-ink-900">
                Kit direct cost / set
              </th>
              <td colSpan={6} />
              <td className="py-2 text-right text-[13px] font-semibold tabular-nums text-ink-900">
                {inr(kit.setDirectCostInr)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

const emptyRollup = {
  rawMaterial: 0,
  process: 0,
  accessories: 0,
  packaging: 0,
  testing: 0,
  directCost: 0,
  components: [],
};

/* ================================================================== *
 * Shared chrome
 * ================================================================== */

function CardHeader({
  podId,
  quotationId,
  item,
  index,
  kindLabel,
  kindIcon,
  subtitle,
  headline,
  headlineNote,
  onToggle,
  collapsed,
  readOnly,
  onOverride,
  siblings,
}: {
  podId: string;
  quotationId: string;
  item: QuoteItem;
  index: number;
  kindLabel: string;
  kindIcon: React.ReactNode;
  subtitle: string;
  headline: string;
  headlineNote: string;
  onToggle?: () => void;
  collapsed?: boolean;
  readOnly?: boolean;
  /** open the article's override dialog */
  onOverride: () => void;
  /** every item on the quotation, so a rejection can name its own scope */
  siblings: QuoteItem[];
}) {
  const isKit = item.kind === "kit";
  // A scoped rejection leaves the rest of the article quotable, so the article's
  // own controls only retire once there is nothing left on it to price.
  const allOut = item.lines.every((l) => Boolean(l.rejected));
  const [rejecting, setRejecting] = useState(false);

  return (
    <header
      className={cn(
        "flex flex-wrap items-start gap-3 px-4 py-3",
        isKit ? "bg-[var(--color-cfg-soft)]" : "bg-surface",
      )}
    >
      {onToggle && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Expand ${item.name}` : `Collapse ${item.name}`}
          className="mt-1 rounded p-1 text-ink-500 hover:bg-surface hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
        >
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", collapsed && "-rotate-90")}
            aria-hidden
          />
        </button>
      )}

      {item.image ? (
        <img
          src={item.image}
          alt=""
          className="h-11 w-11 shrink-0 rounded-lg border border-hairline object-cover"
        />
      ) : (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-hairline bg-surface text-ink-400">
          {kindIcon}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-400">
            {kindLabel} {index + 1}
          </span>
          <h3 className="text-[15px] font-semibold text-ink-900">
            {isKit ? `KIT — ${item.name}` : item.name}
          </h3>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]",
              isKit ? "bg-[var(--color-cfg-strong)] text-white" : "bg-ink-100 text-ink-600",
            )}
          >
            {kindIcon}
            {kindLabel}
          </span>
          {item.rejected && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-amber-900">
              Sent back for recosting
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[11.5px] text-ink-500">{subtitle}</p>

        {/* Sent back for recosting: the line stays visible and stays on the
            quotation — what changed is that it can no longer be priced, and
            the quotation cannot go out while it is like this. */}
        {item.rejected && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Link
              to="/config/$podId/$articleId"
              params={{ podId, articleId: item.articleId }}
              search={{ sel: undefined }}
              className="inline-flex items-center gap-1 text-[11.5px] font-medium text-brand-700 hover:underline"
            >
              View in Costing <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
            <span className="text-[11.5px] text-ink-500">{item.rejected.reason}</span>
            {!readOnly && (
              <button
                type="button"
                onClick={() => clearRejection(quotationId, item.id)}
                className="inline-flex items-center gap-1 rounded border border-hairline bg-surface px-1.5 py-0.5 text-[11px] font-medium text-ink-600 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
              >
                <Undo2 className="h-3 w-3" aria-hidden /> Undo
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-start gap-3">
        <div className="text-right">
          <div className="text-[10px] font-medium uppercase tracking-[0.1em] text-ink-500">
            Quoted price
          </div>
          <div className="text-[19px] font-semibold tabular-nums text-ink-900">{headline}</div>
          <div className="text-[10.5px] text-ink-400">{headlineNote}</div>
        </div>
        <div className="flex flex-col gap-1">
          {/* Re-costing is a real move at this stage: the buyer has pushed
              back and the article has to be built differently. It goes back to
              Configuration — the quotation never re-costs anything itself —
              and says so in the audit before it leaves. */}
          <Link
            to="/config/$podId/$articleId"
            params={{ podId, articleId: item.articleId }}
            search={{ sel: undefined }}
            onClick={() =>
              logQuotationEvent(
                podId,
                "recost_requested",
                `${item.name} sent back to Configuration & Costing to be re-costed`,
              )
            }
            title="Re-cost this article in Configuration & Costing"
            className="inline-flex items-center gap-1 rounded border border-hairline bg-surface px-1.5 py-1 text-[10.5px] font-medium text-ink-600 hover:bg-surface-alt hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Re-cost
          </Link>
          {!readOnly && !allOut && (
            <button
              type="button"
              onClick={onOverride}
              title="Override this article's quoted figures"
              className="rounded border border-hairline bg-surface px-1.5 py-1 text-[10.5px] font-medium text-ink-600 hover:bg-surface-alt hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
            >
              Override
            </button>
          )}
          {!readOnly && !allOut && (
            <button
              type="button"
              onClick={() => setRejecting(true)}
              className="rounded px-1.5 py-1 text-[10.5px] font-medium text-[#8f2c22] hover:bg-[#8f2c22]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
            >
              Reject
            </button>
          )}
          <button
            type="button"
            hidden={readOnly}
            onClick={() => removeItem(quotationId, item.id)}
            aria-label={`Remove ${item.name} from this quotation`}
            className="rounded p-1.5 text-ink-300 hover:bg-surface-alt hover:text-[#8f2c22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Rejecting asks what is going back before anything moves — most
          push-back is on the quotation, not on the one card that was clicked. */}
      {rejecting && (
        <RejectDialog
          quotationId={quotationId}
          podId={podId}
          items={siblings}
          preselect={[item.id]}
          onClose={() => setRejecting(false)}
          onConfirm={(selection, reason) => {
            rejectSelection(quotationId, selection, reason);
            setRejecting(false);
          }}
        />
      )}
    </header>
  );
}

function Fact({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <span>
      <span className="block text-[10px] font-medium uppercase tracking-[0.1em] text-ink-500">
        {label}
      </span>
      <span
        className={cn(
          "block tabular-nums",
          strong ? "text-[14px] font-semibold text-ink-900" : "text-[13px] text-ink-700",
        )}
      >
        {value}
      </span>
    </span>
  );
}
