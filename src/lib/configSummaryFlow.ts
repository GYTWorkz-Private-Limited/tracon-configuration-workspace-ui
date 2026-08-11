// Configuration summary rendered with the same workflow diagram as Costing review.
// Columns: Product details → Process cost → Process total → Supplier margin →
//          Commercial overheads → Grand total → Commercial pricing.

import type { FlowCardDef } from "@/components/config/CostingCanvas";
import type { CostSectionDef } from "@/lib/costingSheet";
import { OVERHEAD_RULES } from "@/lib/costingSheet";
import { SUMMARY_MODULE_CARDS, SUPPLIER_MARGIN_OH_PCT, inr } from "@/lib/fabricConfig";

export const CONFIG_SUMMARY_SECTIONS = [
  { id: "product", label: "Product details", note: "configured" },
  { id: "process", label: "Process cost", note: "per piece" },
  { id: "processTotal", label: "Process total" },
  { id: "margin", label: "Supplier margin OH" },
  { id: "overheads", label: "Commercial overheads" },
  { id: "grand", label: "Grand total" },
  { id: "pricing", label: "Commercial pricing" },
] as unknown as CostSectionDef[];

/** Commercial variables assumed for the configuration roll-up (same defaults as costing). */
const TARGET_MARGIN_PCT = 0.26;
const FX_RATE = 90;
const QUOTED_MOQ = 4_800;

const pct = (n: number) => `${(n * 100).toFixed((n * 100) % 1 === 0 ? 0 : 1)}%`;

const OVERHEAD_LINES: { id: string; label: string; rate: number }[] = [
  { id: "ovhOverhead", label: "Overhead", rate: OVERHEAD_RULES.overhead },
  { id: "ovhCnf", label: "C & F", rate: OVERHEAD_RULES.cnf },
  { id: "ovhEcgc", label: "ECGC + DOC + BC", rate: OVERHEAD_RULES.ecgcDocBc },
  { id: "ovhInsFrt", label: "INS + FRT(I)", rate: OVERHEAD_RULES.insFrt },
  { id: "ovhPaymentTerms", label: "Payment terms", rate: OVERHEAD_RULES.paymentTerms },
  { id: "ovhTesting", label: "Testing", rate: OVERHEAD_RULES.testing },
  { id: "ovhCertification", label: "Certification", rate: OVERHEAD_RULES.certification },
  { id: "ovhSafeguard", label: "Safeguard", rate: OVERHEAD_RULES.safeguard },
  { id: "ovhPli", label: "PLI", rate: OVERHEAD_RULES.pli },
  {
    id: "ovhProvPurchase",
    label: "Total provision purchase",
    rate: OVERHEAD_RULES.provisionPurchase,
  },
  { id: "ovhProvSale", label: "Total provision sale", rate: OVERHEAD_RULES.provisionSale },
  { id: "ovhDbk", label: "DBK", rate: OVERHEAD_RULES.dbk },
];

/** Overhead + pricing numbers derived from the configured process total. */
export function configSummaryCommercials(materialTotal: number, supplierMarginOh: number) {
  const lines = OVERHEAD_LINES.map((l) => ({ ...l, amount: materialTotal * l.rate }));
  const overheadTotal = lines.reduce((s, l) => s + l.amount, 0);
  const grandTotal = materialTotal + supplierMarginOh + overheadTotal;
  const spInr = grandTotal / (1 - TARGET_MARGIN_PCT);
  const spUsd = spInr / FX_RATE;
  return { lines, overheadTotal, grandTotal, spInr, spUsd };
}

export function buildConfigSummaryCards(args: {
  articleName: string;
  moduleAmount: (id: string) => number;
  materialTotal: number;
  supplierMarginOh: number;
  grandTotal: number;
  configuredModules: number;
  productRows: { label: string; value: string }[];
}): FlowCardDef[] {
  const {
    articleName,
    moduleAmount,
    materialTotal,
    supplierMarginOh,
    configuredModules,
    productRows,
  } = args;

  const { lines, overheadTotal, grandTotal, spInr, spUsd } = configSummaryCommercials(
    materialTotal,
    supplierMarginOh,
  );

  const share = (n: number) =>
    materialTotal > 0
      ? `${((n / materialTotal) * 100).toFixed(1)}% of process total`
      : "Not configured";

  const cards: FlowCardDef[] = [
    {
      id: "productDetails",
      section: "product",
      label: "Product details",
      value: articleName,
      rows: productRows,
    },
    ...SUMMARY_MODULE_CARDS.map((c) => {
      const amount = moduleAmount(c.summaryOf as string);
      return {
        id: c.id,
        section: "process",
        label: c.label,
        value: inr(amount),
        desc: share(amount),
      } satisfies FlowCardDef;
    }),
    {
      id: "sumTotal",
      section: "processTotal",
      label: "Process total",
      value: inr(materialTotal),
      desc: "Sum of all configuration modules",
      emphasis: "total",
      rows: SUMMARY_MODULE_CARDS.map((c) => ({
        label: c.label.replace(/ Total$/, ""),
        value: inr(moduleAmount(c.summaryOf as string)),
      })),
    },
    {
      id: "sumMarginOh",
      section: "margin",
      label: "Supplier margin OH",
      value: inr(supplierMarginOh),
      desc: `${Math.round(SUPPLIER_MARGIN_OH_PCT * 100)}% of process total`,
    },
    ...lines.map(
      (l) =>
        ({
          id: l.id,
          section: "overheads",
          label: l.label,
          value: inr(l.amount),
          desc: `${pct(l.rate)} of process total`,
        }) satisfies FlowCardDef,
    ),
    {
      id: "sumGrandTotal",
      section: "grand",
      label: "Grand total / pc",
      value: inr(grandTotal),
      emphasis: "grand",
      rows: [
        { label: "Process total", value: inr(materialTotal) },
        { label: "Supplier margin OH", value: inr(supplierMarginOh) },
        { label: "Commercial overheads", value: inr(overheadTotal) },
        {
          label: "Configured modules",
          value: `${configuredModules} / ${SUMMARY_MODULE_CARDS.length}`,
        },
      ],
    },
    {
      id: "priceInr",
      section: "pricing",
      label: "SP price (INR)",
      value: inr(spInr),
      desc: `Grand total ÷ (1 − ${pct(TARGET_MARGIN_PCT)})`,
    },
    {
      id: "priceUsd",
      section: "pricing",
      label: "Price (USD)",
      value: `$${spUsd.toFixed(2)}`,
      desc: `FX ₹${FX_RATE.toFixed(2)} / $`,
    },
    {
      id: "priceMargin",
      section: "pricing",
      label: "Margin %",
      value: pct(TARGET_MARGIN_PCT),
      desc: `${inr(spInr - grandTotal)} / pc`,
    },
    {
      id: "priceMoq",
      section: "pricing",
      label: "Quoted MOQ",
      value: `${QUOTED_MOQ.toLocaleString("en-IN")} pcs`,
      desc: `Order value $${(spUsd * QUOTED_MOQ).toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
    },
  ];

  return cards;
}
