// Calculation + business-rule explanations for the Configuration drawers.
// Mirrors what the Costing workspace side panel shows, so the same math is
// visible while configuring. Pure derivation — never mutates state.

import {
  ALL_CARDS,
  computeConfig,
  inr,
  moduleLabelForCard,
  SUPPLIER_MARGIN_OH_PCT,
  type CardDef,
  type ConfigState,
} from "./fabricConfig";

export type ExplainRow = { label: string; value: string };
export type CardExplain = {
  summary: string;
  rows: ExplainRow[];
  rule?: string;
  source?: string;
};

const num = (s?: string) => {
  const n = parseFloat((s ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const unitLabel = (card: CardDef) =>
  card.unit === "perM"
    ? "₹ / metre"
    : card.unit === "perPc"
      ? "₹ / piece"
      : card.unit === "perDot"
        ? "₹ / dot"
        : card.unit === "perKg"
          ? "₹ / kg"
          : "";

/** Explanation for one editable / readonly configuration card. */
export function explainConfigCard(
  cardId: string,
  state: ConfigState,
  moduleCards?: CardDef[],
): CardExplain {
  const card = ALL_CARDS.find((c) => c.id === cardId);
  const moduleLabel = moduleLabelForCard(cardId);
  const cards = moduleCards ?? ALL_CARDS;
  const m = computeConfig(state, cards);
  const current = state[cardId];
  const unit = card ? unitLabel(card) : "";

  const rows: ExplainRow[] = [];
  const source = `Configuration · ${moduleLabel}`;

  // ---- fabric-style per-metre chain ----
  if (card?.unit === "perM") {
    rows.push(
      { label: "Selected rate", value: current?.rate ? `${inr(current.rate)} / m` : "—" },
      { label: "Fabric rate (all inputs)", value: `${inr(m.fabricPerM)} / m` },
      { label: "Consumption", value: `${m.requiredMeter.toFixed(3)} m / pc` },
      { label: "Cost / piece", value: inr(m.costPerPiece) },
    );
    return {
      summary:
        "Every per-metre input in this module adds into the fabric rate. The rate is then multiplied by the consumption per piece to give this module's cost per piece.",
      rows,
      rule: "Cost / pc = Σ (per-metre rates) × consumption. Consumption = cut length ÷ 39.37 × (1 + shrinkage %) × (1 + wastage %).",
      source,
    };
  }

  // ---- embroidery ----
  if (cards.some((c) => c.id === "embDots")) {
    const dots = num(state.embDots?.value);
    const perDot =
      num(state.embPerDot?.value) + (state.embSupplier?.rate ?? 0) + (state.embType?.rate ?? 0);
    const w = num(state.embWastage?.value);
    rows.push(
      { label: "Dots per piece", value: dots ? String(dots) : "—" },
      { label: "Per dot (supplier + type + rate)", value: `${inr(perDot)} / dot` },
      { label: "Wastage", value: `${w}%` },
      { label: "Cost / piece", value: inr(m.costPerPiece) },
    );
    return {
      summary:
        "Embroidery is costed per dot. Supplier and embroidery type rates are added to the base per-dot cost, multiplied by the dot count, then wastage is applied.",
      rows,
      rule: "Cost / pc = dots × (per-dot + supplier rate + type rate) × (1 + wastage %).",
      source,
    };
  }

  // ---- washing ----
  if (cards.some((c) => c.id === "washPerKg")) {
    const perKg =
      num(state.washPerKg?.value) +
      (state.washSupplier?.rate ?? 0) +
      (state.washType?.rate ?? 0) +
      (state.washRecipe?.rate ?? 0);
    const wt = num(state.washWeightPerPcs?.value);
    rows.push(
      { label: "Per kg (supplier + type + recipe + rate)", value: `${inr(perKg)} / kg` },
      { label: "Weight per piece", value: wt ? `${wt} kg` : "—" },
      { label: "Cost / piece", value: inr(m.costPerPiece) },
    );
    return {
      summary:
        "Washing is costed per kilogram. Supplier, wash type and recipe rates add into the per-kg cost, which is multiplied by the garment weight per piece.",
      rows,
      rule: "Cost / pc = (per-kg + supplier + type + recipe) × weight per piece.",
      source,
    };
  }

  // ---- manufacturing ----
  if (cards.some((c) => c.id === "mfgCutting")) {
    rows.push(
      { label: "Cutting", value: inr(num(state.mfgCutting?.value)) },
      { label: "Stitching", value: inr(num(state.mfgStitching?.value)) },
      { label: "Module cost / piece", value: inr(m.costPerPiece) },
    );
    return {
      summary:
        "Manufacturing is a straight per-piece build-up. Cutting and stitching are mandatory; every other configured line adds on top.",
      rows,
      rule: "Cost / pc = cutting + stitching (+ any other configured per-piece operations).",
      source,
    };
  }

  // ---- accessories (free-text ₹/pc lines) ----
  if (cards.some((c) => c.id === "accZipper")) {
    rows.push(
      { label: "This line", value: current ? inr(num(current.value)) : "—" },
      { label: "Accessories total / piece", value: inr(m.costPerPiece) },
    );
    return {
      summary:
        "Each accessory is entered as a per-piece cost. The module total is the sum of every accessory line configured.",
      rows,
      rule: "Accessories / pc = Σ (configured accessory costs). Supplier and notes are reference only and carry no cost.",
      source,
    };
  }

  // ---- option-rate modules: packaging / testing / certification ----
  if (card?.unit === "perPc" || card?.kind === "options") {
    rows.push(
      { label: "Selected option", value: current?.value ?? "—" },
      {
        label: "Rate applied",
        value: current?.rate !== undefined ? `${inr(current.rate)} / pc` : "No cost impact",
      },
      { label: "Module total / piece", value: inr(m.costPerPiece) },
    );
    return {
      summary:
        "Each option carries its own per-piece rate. Selecting an option replaces the previous rate and the module total is the sum of all selected per-piece rates.",
      rows,
      rule: "Module / pc = Σ (selected option rates). Options priced at ₹0.00 are specification-only and do not change the total.",
      source,
    };
  }

  // ---- generic numeric / text driver ----
  rows.push(
    { label: "Current value", value: current?.value ?? "—" },
    ...(unit ? [{ label: "Unit", value: unit }] : []),
    { label: "Module total / piece", value: inr(m.costPerPiece) },
  );
  return {
    summary:
      "This input is a driver — it does not carry a rate of its own but changes the calculated cost of the module it belongs to.",
    rows,
    rule: "Changing a driver recalculates the module cost per piece, the material total and the grand total immediately.",
    source,
  };
}

/** Explanation for a Configuration Summary card. */
export function explainSummaryCard(
  cardId: string,
  label: string,
  values: {
    materialTotal: number;
    supplierMarginOh: number;
    grandTotal: number;
    moduleAmount?: number;
  },
): CardExplain {
  if (cardId === "sumMarginOh") {
    return {
      summary:
        "Supplier margin & overhead is a fixed percentage applied to the material total of every configured module.",
      rows: [
        { label: "Basis · material total", value: inr(values.materialTotal) },
        { label: "Rate applied", value: `${SUPPLIER_MARGIN_OH_PCT * 100}%` },
        { label: "Calculated amount", value: inr(values.supplierMarginOh) },
      ],
      rule: `Supplier margin OH = material total × ${SUPPLIER_MARGIN_OH_PCT * 100}%. The rate is set by commercial policy and is not editable per article.`,
      source: "Configuration · Summary",
    };
  }

  if (cardId === "sumTotal") {
    return {
      summary:
        "Material total is the sum of the cost per piece of every configuration module — Fabric through Certification.",
      rows: [{ label: "Material total / pc", value: inr(values.materialTotal) }],
      rule: "Material total = Σ (module cost / pc). Each module rolls up independently, so an unconfigured module contributes ₹0.00.",
      source: "Configuration · Summary",
    };
  }

  if (cardId === "sumGrandTotal" || cardId === "sumFinalMaterial") {
    return {
      summary:
        "Grand total is the fully loaded material cost per piece carried into the Costing workspace.",
      rows: [
        { label: "Material total", value: inr(values.materialTotal) },
        {
          label: `+ Supplier margin OH (${SUPPLIER_MARGIN_OH_PCT * 100}%)`,
          value: inr(values.supplierMarginOh),
        },
        { label: "= Grand total / pc", value: inr(values.grandTotal) },
      ],
      rule: "Grand total = material total + supplier margin OH. Commercial overheads and pricing are applied later, in Costing.",
      source: "Configuration · Summary",
    };
  }

  return {
    summary: `${label} mirrors the cost per piece calculated inside the ${label.replace(" Total", "")} module.`,
    rows: [
      { label: `${label} / pc`, value: inr(values.moduleAmount ?? 0) },
      {
        label: "Share of material total",
        value:
          values.materialTotal > 0
            ? `${(((values.moduleAmount ?? 0) / values.materialTotal) * 100).toFixed(1)}%`
            : "—",
      },
      { label: "Material total", value: inr(values.materialTotal) },
    ],
    rule: "Summary cards are read-only mirrors. Edit the module to change this value — the summary and grand total update automatically.",
    source: "Configuration · Summary",
  };
}
