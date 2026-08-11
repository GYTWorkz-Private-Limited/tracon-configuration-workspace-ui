/**
 * The cost network graph model.
 *
 * Lanes run left to right: Material → Components → Process → Trims →
 * Packaging → Direct Cost. Every node cost is read from the same functions the
 * forms use, so the diagram can never disagree with the roll-up.
 */

import { computeConfig, inr, type ConfigState } from "./fabricConfig";
import { componentCost, deriveMainComponent, rollupPhases, type PhaseId } from "./configTree";
import { deriveRoute } from "./costingRoute";
import type { SpineCtx, SpineSectionId } from "./costingSpine";

const toNum = (s?: string) => {
  const n = parseFloat((s ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export type NodeKind = "material" | "component" | "process" | "trim" | "packaging" | "rollup";

export type CostNode = {
  id: string;
  label: string;
  kind: NodeKind;
  lane: number;
  row: number;
  spec: string;
  qtyRate?: string;
  loss?: string;
  cost: number;
  share: number;
  active: boolean;
  inactiveReason?: string;
  driver?: boolean;
  incomplete?: boolean;
  jump?: { phase: PhaseId; group: string };
};

export type CostEdge = {
  from: string;
  to: string;
  kind: NodeKind;
  cumulative: number;
  qty?: number;
};
export type CostLane = { index: number; label: string; section: SpineSectionId };
export type CostGraph = { nodes: CostNode[]; edges: CostEdge[]; lanes: CostLane[]; total: number };

export const COST_LANES: CostLane[] = [
  { index: 0, label: "Material", section: "material" },
  { index: 1, label: "Components", section: "components" },
  { index: 2, label: "Process", section: "process" },
  { index: 3, label: "Trims", section: "trims" },
  { index: 4, label: "Packaging", section: "packaging" },
  { index: 5, label: "Direct Cost", section: "rollup" },
];

/** process group id → the derived route step that gates it */
const PROCESS_STEP_GROUP: { step: string; group: string }[] = [
  { step: "yarnPrep", group: "yarnPrep" },
  { step: "dyeing", group: "dyeing" },
  { step: "weaving", group: "weaving" },
  { step: "printing", group: "printing" },
  { step: "embroidery", group: "embroidery" },
  { step: "washing", group: "washing" },
  { step: "finishing", group: "finishing" },
  { step: "cutting", group: "cutting" },
  { step: "stitching", group: "stitching" },
  { step: "hemming", group: "hemming" },
];

export function buildCostGraph(state: ConfigState, ctx: SpineCtx): CostGraph {
  const roll = rollupPhases(state, ctx);
  const total = roll.directTotal;
  const groupAmount = (phase: PhaseId, group: string) =>
    roll.phases.find((p) => p.id === phase)?.groups.find((g) => g.id === group)?.amount ?? 0;

  const route = deriveRoute(state);
  const main = deriveMainComponent(state);
  const metrics = computeConfig(state);

  const nodes: CostNode[] = [];
  const push = (n: Omit<CostNode, "share">) =>
    nodes.push({ ...n, share: total > 0 ? n.cost / total : 0 });

  /* lane 0 — material (the derived main body) */
  const mainCost = componentCost(main);
  push({
    id: "mat.main",
    label: main.name,
    kind: "material",
    lane: 0,
    row: 0,
    spec: main.spec,
    qtyRate: `${main.consumption.toFixed(3)} m at ${inr(main.rate)} per m`,
    loss: toNum(state.wastage?.value) > 0 ? `Loss ${state.wastage?.value}%` : undefined,
    cost: mainCost,
    active: true,
    incomplete: mainCost <= 0,
    jump: { phase: "raw", group: "fabric" },
  });

  /* lane 1 — components */
  let row = 0;
  for (const extra of ctx.fabricExtras) {
    push({
      id: `cmp.${extra.id}`,
      label: extra.name,
      kind: "component",
      lane: 1,
      row: row++,
      spec: extra.spec,
      qtyRate: `${extra.consumption.toFixed(3)} m at ${inr(extra.rate)} per m`,
      loss: extra.wastage > 0 ? `Loss ${extra.wastage}%` : undefined,
      cost: componentCost(extra),
      active: true,
      jump: { phase: "raw", group: "fabric" },
    });
  }
  /* lane 2 — process, ordered by the derived route */
  row = 0;
  for (const link of PROCESS_STEP_GROUP) {
    const step = route.steps.find((s) => s.id === link.step);
    if (!step) continue;
    const amount = step.active ? groupAmount("process", link.group) : 0;
    push({
      id: `pr.${link.group}`,
      label: step.label,
      kind: "process",
      lane: 2,
      row: row++,
      spec: processSpec(state, link.group),
      cost: amount,
      active: step.active,
      inactiveReason: step.active ? undefined : step.reason,
      incomplete: step.active && amount <= 0,
      jump: { phase: "process", group: link.group },
    });
  }
  for (const g of ["special", "compliance"] as const) {
    const amount = groupAmount("process", g);
    push({
      id: `pr.${g}`,
      label: g === "special" ? "Special Processes" : "Testing & Certification",
      kind: "process",
      lane: 2,
      row: row++,
      spec: g === "special" ? "Hand work and tub wash" : "Buyer test panel and certification",
      cost: amount,
      active: true,
      incomplete: amount <= 0,
      jump: { phase: "process", group: g },
    });
  }

  /* lane 3 — trims */
  const trims = groupAmount("raw", "trims");
  push({
    id: "trim.all",
    label: "Trims & Accessories",
    kind: "trim",
    lane: 3,
    row: 0,
    spec: "Closures, hardware and board",
    cost: trims,
    active: true,
    incomplete: trims <= 0,
    jump: { phase: "raw", group: "trims" },
  });

  /* lane 4 — packaging */
  row = 0;
  for (const g of ["labels", "standard", "carton"] as const) {
    const amount = groupAmount("packaging", g);
    push({
      id: `pkg.${g}`,
      label: g === "labels" ? "Labels" : g === "standard" ? "Standard Packaging" : "Carton Packing",
      kind: "packaging",
      lane: 4,
      row: row++,
      spec: packagingSpec(state, g),
      cost: amount,
      active: true,
      incomplete: amount <= 0,
      jump: { phase: "packaging", group: g },
    });
  }

  /* lane 5 — direct cost */
  push({
    id: "direct",
    label: "Direct Cost",
    kind: "rollup",
    lane: 5,
    row: 0,
    spec: `${route.label} · ${metrics.requiredMeter.toFixed(3)} m per piece`,
    qtyRate: `${inr(total)} per piece`,
    cost: total,
    active: true,
    jump: { phase: "direct", group: "" },
  });

  /* top-3 cost drivers */
  const ranked = [...nodes]
    .filter((n) => n.kind !== "rollup" && n.cost > 0)
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 3)
    .map((n) => n.id);
  const marked = nodes.map((n) => (ranked.includes(n.id) ? { ...n, driver: true } : n));

  /* cumulative running cost per lane */
  const laneCost = COST_LANES.map((l) =>
    marked.filter((n) => n.lane === l.index && n.kind !== "rollup").reduce((t, n) => t + n.cost, 0),
  );
  const cumulative = laneCost.map((_, i) => laneCost.slice(0, i + 1).reduce((t, v) => t + v, 0));

  const edges: CostEdge[] = [];
  for (let lane = 0; lane < COST_LANES.length - 1; lane += 1) {
    const from = marked.filter((n) => n.lane === lane);
    const to = marked.filter((n) => n.lane === lane + 1);
    if (!from.length || !to.length) continue;
    const target = to[0];
    for (const n of from) {
      edges.push({
        from: n.id,
        to: target.id,
        kind: n.kind,
        cumulative: cumulative[lane + 1],
        qty: n.kind === "material" || n.kind === "component" ? main.consumption : undefined,
      });
    }
  }

  return { nodes: marked, edges, lanes: COST_LANES, total };
}

const processSpec = (state: ConfigState, group: string): string => {
  const parts: Record<string, (string | undefined)[]> = {
    yarnPrep: [state.twisting?.value && `Twisting ${state.twisting.value}`, state.count?.value],
    dyeing: [state.dyeing?.value, state.pantone?.value, state.colour?.value],
    weaving: [state.weaving?.value, state.reedPick?.value],
    printing: [state.printTech?.value, state.printVendor?.value, state.printInk?.value],
    embroidery: [state.embType?.value, state.embDots?.value && `${state.embDots.value} dots`],
    washing: [state.washType?.value, state.washRecipe?.value],
    finishing: [state.specialProcess?.value, state.transport?.value && "Transport"],
    cutting: [
      state.cutWidth?.value && `${state.cutWidth.value} × ${state.cutLength?.value ?? "?"} in`,
    ],
    stitching: [state.unitType?.value, state.sizeSpec?.value],
    hemming: [state.mfgHemming?.value && `${inr(toNum(state.mfgHemming.value))} per piece`],
  };
  const spec = (parts[group] ?? []).filter(Boolean).join(" · ");
  return spec || "Not configured";
};

const packagingSpec = (state: ConfigState, group: string): string => {
  if (group === "labels")
    return (
      [state.pkgBarcode?.value, state.pkgHangTag?.value].filter(Boolean).join(" · ") ||
      "Not configured"
    );
  if (group === "carton") return state.pkgCarton?.value || "Not configured";
  return (
    [state.pkgType?.value, state.pkgPolyBag?.value, state.pkgInner?.value]
      .filter(Boolean)
      .join(" · ") || "Not configured"
  );
};
