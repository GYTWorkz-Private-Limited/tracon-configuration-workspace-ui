// VariantComparisonTable — shared comparison body used by both the full-screen
// Compare Variants workspace and the Costing Report "Variant comparison" tab.
// Two modes: Compare MOQ (same config, different quantities) and Compare
// Scenarios (saved costing scenarios). Values come from buildCostingSheet, so
// they match the Costing workspace exactly.

import { useMemo, useState } from "react";
import { ChevronDown, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { computeCushion, buildMoqVariant, type CushionVariant } from "@/lib/cushionCosting";
import { buildCostingSheet, inr, type CostingNums } from "@/lib/costingSheet";

type Row = {
  label: string;
  text: (n: CostingNums, v: CushionVariant) => string;
  num?: (n: CostingNums, v: CushionVariant) => number;
  best?: "low" | "high";
  strong?: boolean;
  /** sub-group heading rendered above this row */
  group?: string;
};

type Section = { id: string; label: string; rows: Row[] };

const SECTIONS: Section[] = [
  {
    id: "product",
    label: "Product details",
    rows: [
      { label: "Product", text: () => "—" },
      {
        label: "Size",
        text: (_n, v) => (v.inputs.sizeInches ? `${v.inputs.sizeInches}" × ${v.inputs.sizeInches}"` : "—"),
      },
      { label: "MOQ", text: (n) => `${n.qty.toLocaleString("en-IN")} pcs`, num: (n) => n.qty },
      { label: "Supplier", text: () => "Aarav Textiles (in-house)" },
      { label: "Quality", text: (_n, v) => `${v.inputs.fabricGsm ?? 200} GSM cotton` },
      { label: "Variant", text: (_n, v) => v.name },
    ],
  },
  {
    id: "material",
    label: "Material cost",
    rows: [
      { label: "Fabric cost", text: (n) => inr(n.fabric), num: (n) => n.fabric, best: "low" },
      { label: "Printing cost", text: (n) => inr(n.printing), num: (n) => n.printing, best: "low" },
      { label: "Embroidery cost", text: (n) => inr(n.embroidery), num: (n) => n.embroidery, best: "low" },
      { label: "Washing cost", text: (n) => inr(n.washing), num: (n) => n.washing },
      {
        label: "Manufacturing cost",
        text: (n) => inr(n.manufacturing),
        num: (n) => n.manufacturing,
        best: "low",
      },
      { label: "Accessories cost", text: (n) => inr(n.accessories), num: (n) => n.accessories, best: "low" },
      {
        label: "Packaging cost",
        text: (n) => inr(n.packagingMaterial),
        num: (n) => n.packagingMaterial,
        best: "low",
      },
      {
        label: "Material total",
        text: (n) => inr(n.materialTotal),
        num: (n) => n.materialTotal,
        best: "low",
        strong: true,
      },
    ],
  },
];

const MOQ_STEPS = [500, 1000, 2000, 5000];

type Mode = "moq" | "scenario";

type Props = {
  variants: CushionVariant[];
  activeId: string;
  productName: string;
  targetPriceUsd?: number;
  /** sticky offset for the summary card row (px) */
  stickyTop?: number;
  className?: string;
  defaultMode?: Mode;
};

export function VariantComparisonTable({
  variants,
  activeId,
  productName,
  stickyTop = 0,
  className,
  defaultMode = "moq",
}: Props) {
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    product: true,
    material: true,
  });
  const [selectedId, setSelectedId] = useState(activeId);

  // MOQ mode — same configuration as the active variant, only qty changes.
  const moqVariants = useMemo<CushionVariant[]>(() => {
    const base = variants.find((v) => v.id === activeId) ?? variants[0];
    if (!base) return [];
    return MOQ_STEPS.map((qty) => {
      const v = buildMoqVariant(base.inputs, qty);
      return {
        ...v,
        id: `moq-${qty}`,
        name: `${qty.toLocaleString("en-IN")} pcs`,
        tagline: `${base.name} configuration · setup amortised over ${qty.toLocaleString("en-IN")} pcs`,
      };
    });
  }, [variants, activeId]);

  const columns = mode === "moq" ? moqVariants : variants;

  const rows = useMemo(
    () =>
      columns.map((v) => {
        const m = computeCushion(v.inputs);
        const sheet = buildCostingSheet(v.inputs, { productName, variantName: v.name }, m);
        return { v, m, n: sheet.nums };
      }),
    [columns, productName],
  );

  if (rows.length === 0) return null;

  const cheapestId = rows.reduce((b, r) => (r.n.materialTotal < b.n.materialTotal ? r : b), rows[0]).v.id;

  const gridCols = `minmax(228px, 260px) repeat(${columns.length}, minmax(190px, 1fr))`;

  return (
    <div className={cn("min-w-max", className)}>
      {/* Mode switch */}
      <div
        className="sticky z-30 flex items-center gap-3 border-b border-hairline bg-canvas/95 px-5 py-3 backdrop-blur"
        style={{ top: stickyTop }}
      >
        <div className="inline-flex rounded-lg border border-hairline bg-surface p-0.5">
          {(
            [
              { id: "moq" as Mode, label: "Compare MOQ" },
              { id: "scenario" as Mode, label: "Compare scenarios" },
            ]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setMode(t.id)}
              className={cn(
                "rounded-md px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
                mode === t.id ? "bg-ink-900 text-white" : "text-ink-600 hover:text-ink-900",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className="text-[11.5px] text-ink-500">
          {mode === "moq"
            ? "Identical configuration — only order quantity changes."
            : "Each column is a saved costing scenario with its own configuration."}
        </span>
      </div>

      {/* Summary cards */}
      <div
        className="sticky z-20 grid items-stretch gap-3 border-b border-hairline bg-canvas/95 px-5 py-4 backdrop-blur"
        style={{ gridTemplateColumns: gridCols, top: stickyTop + 49 }}
      >
        <div className="flex items-end pb-1 text-[11px] uppercase tracking-[0.14em] text-ink-400">
          {mode === "moq" ? "MOQ summary" : "Scenario summary"}
        </div>
        {rows.map(({ v, n }) => {
          const isSel = v.id === selectedId;
          return (
            <button
              key={v.id}
              onClick={() => setSelectedId(v.id)}
              className={cn(
                "rounded-xl border bg-white p-3.5 text-left transition-all",
                isSel
                  ? "border-brand-600 shadow-[0_0_0_2px_rgba(12,176,160,0.22)]"
                  : "border-hairline hover:border-brand-600/50",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-[13.5px] font-semibold text-ink-900">{v.name}</div>
                <div className="text-right">
                  <div className="text-[20px] font-semibold leading-none tabular-nums text-ink-900">
                    {inr(n.materialTotal)}
                  </div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-ink-400">
                    {mode === "moq" ? "est. cost / piece" : "cost / piece"}
                  </div>
                </div>
              </div>

              <dl className="mt-2.5 grid grid-cols-2 gap-1.5 border-t border-hairline pt-2.5 text-[11px]">
                <Meta label="MOQ" value={n.qty.toLocaleString("en-IN")} />
                <Meta label="Size" value={v.inputs.sizeInches ? `${v.inputs.sizeInches}"` : "—"} />
              </dl>

              {mode === "scenario" && (
                <div className="mt-2 text-[11px] leading-relaxed text-ink-500">
                  {v.tagline ??
                    `${v.inputs.embroidery > 0 ? "Embroidered" : "Plain"} · print ₹${v.inputs.reactivePrint}/m`}
                </div>
              )}

              <div className="mt-2.5 flex flex-wrap gap-1">
                {mode === "scenario" && v.id === activeId && <Badge tone="ink">Active</Badge>}
                {v.id === cheapestId && (
                  <Badge tone="green" icon={<Trophy className="h-3 w-3" />}>Cheapest</Badge>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Grouped sections */}
      <div className="space-y-3 px-5 py-4">
        {SECTIONS.map((s) => {
          const open = openSections[s.id];
          return (
            <section key={s.id} className="overflow-hidden rounded-xl border border-hairline bg-white">
              <button
                onClick={() => setOpenSections((p) => ({ ...p, [s.id]: !p[s.id] }))}
                className="sticky left-0 flex w-full items-center gap-2 bg-surface-alt/50 px-4 py-2.5 text-left hover:bg-surface-alt"
              >
                <ChevronDown
                  className={cn("h-3.5 w-3.5 text-ink-400 transition-transform", !open && "-rotate-90")}
                />
                <span className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-ink-600">
                  {s.label}
                </span>
                <span className="text-[11px] text-ink-400">{s.rows.length} fields</span>
              </button>

              {open && (
                <div>
                  {s.rows.map((row, ri) => {
                    const nums = row.num ? rows.map((r) => row.num!(r.n, r.v)) : null;
                    const texts = rows.map((r) => row.text(r.n, r.v));
                    const identical = texts.every((t) => t === texts[0]);
                    const bestVal =
                      nums && row.best
                        ? row.best === "low"
                          ? Math.min(...nums)
                          : Math.max(...nums)
                        : null;

                    return (
                      <div key={row.label}>
                        {row.group && (
                          <div
                            className={cn(
                              "sticky left-0 bg-surface-alt/30 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-400",
                              "border-t border-hairline",
                            )}
                          >
                            {row.group}
                          </div>
                        )}
                        <div
                          className={cn("grid items-stretch", (ri > 0 || row.group) && "border-t border-hairline")}
                          style={{ gridTemplateColumns: gridCols }}
                        >
                          <div className="sticky left-0 z-10 flex items-center gap-2 border-r border-hairline bg-white px-4 py-2.5 text-[12.5px] text-ink-600">
                            {row.label}
                          </div>
                          {rows.map((r, i) => {
                            const isBest =
                              bestVal !== null && nums !== null && !identical && nums[i] === bestVal;
                            const isDifferent = !identical;
                            return (
                              <div
                                key={r.v.id}
                                className={cn(
                                  "flex items-center border-r border-hairline px-4 py-2.5 text-[12.5px] tabular-nums last:border-r-0",
                                  row.strong ? "font-semibold text-ink-900" : "text-ink-800",
                                  r.v.id === selectedId && "bg-brand-50/40",
                                  isDifferent && !isBest && "text-ink-900",
                                  identical && "text-ink-500",
                                )}
                              >
                                <span
                                  className={cn(
                                    isBest &&
                                      "rounded-md bg-brand-50 px-1.5 py-0.5 font-semibold text-brand-700",
                                  )}
                                >
                                  {row.label === "Product" ? productName : texts[i]}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}

      </div>

      {/* Sticky direct cost footer */}
      <div
        className="sticky bottom-0 z-30 grid items-stretch gap-3 border-t border-hairline bg-white/95 px-5 py-3 backdrop-blur"
        style={{ gridTemplateColumns: gridCols }}
      >
        <div className="flex flex-col justify-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
            Direct cost
          </div>
          <div className="text-[10.5px] text-ink-400">Raw material + process + packaging, per piece</div>
        </div>
        {rows.map(({ v, n }) => (
          <div
            key={v.id}
            className={cn(
              "rounded-lg border px-3 py-2",
              v.id === cheapestId ? "border-brand-600 bg-brand-50/50" : "border-hairline bg-surface",
            )}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[17px] font-semibold tabular-nums text-ink-900">
                {inr(n.materialTotal)}
              </span>
            </div>
            <div className="mt-0.5 flex items-center justify-between text-[10.5px] tabular-nums text-ink-500">
              <span>MOQ {n.qty.toLocaleString("en-IN")}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[9.5px] uppercase tracking-[0.1em] text-ink-400">{label}</dt>
      <dd className="tabular-nums text-ink-900">{value}</dd>
    </div>
  );
}

function Badge({
  children,
  tone,
  icon,
}: {
  children: React.ReactNode;
  tone: "green" | "brand" | "ink";
  icon?: React.ReactNode;
}) {
  const style =
    tone === "green"
      ? "bg-brand-50 text-brand-700 border-brand-600/30"
      : tone === "brand"
        ? "bg-brand-700 text-white border-brand-700"
        : "bg-ink-900 text-white border-ink-900";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
        style,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
