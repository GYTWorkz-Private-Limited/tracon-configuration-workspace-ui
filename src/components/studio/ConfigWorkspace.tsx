import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { SubmitApprovalModal } from "@/components/approvals/SubmitApprovalModal";
import { costingStatusForArticle, type ApprovalSnapshot } from "@/lib/approvalsStore";
import {
  X,
  Plus,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  GitCompare,
  BarChart3,
  Layers,
  Sparkles,
  RotateCw,
  Maximize2,
  ImageIcon,
  Wand2,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  Check,
  Cpu,
  Palette,
  Tag,
  Grid3x3,
  Lightbulb,
  AlertCircle,
  MessageSquare,
  PanelRightClose,
  PanelLeftClose,
  Edit3,
  ArrowRight,
  Send,
  Package,
  Search,
  Clock,
  Target,
  ShieldCheck,
  Truck,
  Factory,
  Activity,
  Zap,
  DollarSign,
  Percent,
  Award,
  Minus,
} from "lucide-react";

import { cn } from "@/lib/utils";


/* ============================================================
   COMPONENT LIBRARY (data)
   ============================================================ */

type Component = {
  id: string;
  name: string;
  supplier: string;
  spec: string;
  cost: number;
  swatch: string;
  category: LibCategory;
};

type LibCategory =
  | "Front Fabric"
  | "Back Fabric"
  | "Filling"
  | "Quilting"
  | "Piping"
  | "Printing"
  | "Embroidery"
  | "Appliqué"
  | "Zipper"
  | "Label"
  | "Hang Tag"
  | "Trim";

const LIBRARY: Component[] = [
  { id: "ff-cotton-500", name: "Cotton 500 GSM", supplier: "Karur Mills", spec: "100% Cotton · Zero-twist", cost: 2.15, swatch: "#EDE6D3", category: "Front Fabric" },
  { id: "ff-cotton-600", name: "Cotton 600 GSM", supplier: "Karur Mills", spec: "Premium hand feel", cost: 2.55, swatch: "#E6DEC8", category: "Front Fabric" },
  { id: "ff-linen", name: "Linen Chambray", supplier: "Erode Weaves", spec: "220 GSM · Slub yarn", cost: 3.1, swatch: "#D9CFB4", category: "Front Fabric" },
  { id: "ff-jacquard", name: "Jacquard Ivory", supplier: "Panipat Textiles", spec: "Damask pattern", cost: 3.4, swatch: "#F0EADB", category: "Front Fabric" },
  { id: "bf-percale", name: "Percale 200 TC", supplier: "Karur Mills", spec: "Smooth backing", cost: 1.8, swatch: "#F5F1E8", category: "Back Fabric" },
  { id: "bf-sateen", name: "Sateen 300 TC", supplier: "Erode Weaves", spec: "Lustrous finish", cost: 2.2, swatch: "#EEE7D2", category: "Back Fabric" },
  { id: "bf-flannel", name: "Brushed Flannel", supplier: "Panipat Textiles", spec: "Warm handle", cost: 2.05, swatch: "#E4DAC5", category: "Back Fabric" },
  { id: "fill-poly-200", name: "Hollow-fiber 200 GSM", supplier: "AAA Fibers", spec: "Siliconized poly", cost: 0.9, swatch: "#F8F5EE", category: "Filling" },
  { id: "fill-down-90", name: "Down 90/10", supplier: "Nordic Down", spec: "700 fill power", cost: 4.2, swatch: "#F1EBDA", category: "Filling" },
  { id: "q-box", name: "Box quilting 10cm", supplier: "In-house", spec: "Grid stitch", cost: 0.28, swatch: "#EEE7D6", category: "Quilting" },
  { id: "q-diamond", name: "Diamond quilting", supplier: "In-house", spec: "Angular stitch", cost: 0.34, swatch: "#E8E0CC", category: "Quilting" },
  { id: "q-channel", name: "Channel quilting", supplier: "In-house", spec: "Vertical lines", cost: 0.24, swatch: "#F2ECDA", category: "Quilting" },
  { id: "p-corded-cream", name: "Corded piping — Cream", supplier: "Trims Co", spec: "3mm cord", cost: 0.18, swatch: "#EDE3C6", category: "Piping" },
  { id: "p-flat-brown", name: "Flat binding — Walnut", supplier: "Trims Co", spec: "12mm binding", cost: 0.14, swatch: "#8C6A45", category: "Piping" },
  { id: "pr-digital", name: "Digital 1-color", supplier: "PrintLab", spec: "Reactive dye", cost: 0.18, swatch: "#0B3B32", category: "Printing" },
  { id: "pr-screen", name: "Screen 3-color", supplier: "PrintLab", spec: "Pigment", cost: 0.28, swatch: "#8B1E1E", category: "Printing" },
  { id: "em-none", name: "None", supplier: "—", spec: "No embroidery", cost: 0, swatch: "#F1EEE6", category: "Embroidery" },
  { id: "em-logo", name: "Logo embroidery", supplier: "Chennai Stitch", spec: "≤ 3,000 stitches", cost: 0.22, swatch: "#B08D3E", category: "Embroidery" },
  { id: "em-premium", name: "Premium embroidery", supplier: "Chennai Stitch", spec: "≤ 8,000 stitches", cost: 0.48, swatch: "#8A6F2C", category: "Embroidery" },
  { id: "ap-none", name: "None", supplier: "—", spec: "No appliqué", cost: 0, swatch: "#F1EEE6", category: "Appliqué" },
  { id: "ap-corner", name: "Corner appliqué", supplier: "Chennai Stitch", spec: "Cotton patch", cost: 0.34, swatch: "#D8C48A", category: "Appliqué" },
  { id: "z-none", name: "None", supplier: "—", spec: "Envelope closure", cost: 0, swatch: "#F1EEE6", category: "Zipper" },
  { id: "z-ykk-50", name: "YKK #5 · 50cm", supplier: "YKK", spec: "Coil zipper", cost: 0.12, swatch: "#C4B58C", category: "Zipper" },
  { id: "z-invisible", name: "Invisible zipper", supplier: "YKK", spec: "Concealed", cost: 0.16, swatch: "#B8A87F", category: "Zipper" },
  { id: "lb-woven", name: "Woven label", supplier: "LabelPro", spec: "Buyer artwork", cost: 0.06, swatch: "#EDE6D3", category: "Label" },
  { id: "lb-leather", name: "Leather patch", supplier: "LabelPro", spec: "Premium", cost: 0.24, swatch: "#7A5230", category: "Label" },
  { id: "ht-kraft", name: "Kraft hang tag", supplier: "Trims Co", spec: "Recycled", cost: 0.05, swatch: "#C9AF7C", category: "Hang Tag" },
  { id: "ht-none", name: "None", supplier: "—", spec: "No hang tag", cost: 0, swatch: "#F1EEE6", category: "Hang Tag" },
  { id: "tr-cord", name: "Cotton cord trim", supplier: "Trims Co", spec: "5mm", cost: 0.08, swatch: "#D6C8A6", category: "Trim" },
  { id: "tr-none", name: "None", supplier: "—", spec: "No trim", cost: 0, swatch: "#F1EEE6", category: "Trim" },
];

type ConfigKey =
  | "frontFabric"
  | "backFabric"
  | "filling"
  | "quilting"
  | "piping"
  | "printing"
  | "embroidery"
  | "applique"
  | "zipper"
  | "label"
  | "hangTag"
  | "trim";

const CONFIG_MAP: { key: ConfigKey; label: string; category: LibCategory }[] = [
  { key: "frontFabric", label: "Front Fabric", category: "Front Fabric" },
  { key: "backFabric", label: "Back Fabric", category: "Back Fabric" },
  { key: "filling", label: "Filling", category: "Filling" },
  { key: "quilting", label: "Quilting Pattern", category: "Quilting" },
  { key: "piping", label: "Piping / Edge", category: "Piping" },
  { key: "printing", label: "Printing", category: "Printing" },
  { key: "embroidery", label: "Embroidery", category: "Embroidery" },
  { key: "applique", label: "Appliqué", category: "Appliqué" },
  { key: "zipper", label: "Zipper", category: "Zipper" },
  { key: "label", label: "Labels", category: "Label" },
  { key: "hangTag", label: "Hang Tags", category: "Hang Tag" },
  { key: "trim", label: "Trims", category: "Trim" },
];

type SectionKey = "fabrics" | "construction" | "decoration" | "trims";
const SECTIONS: { key: SectionKey; label: string; icon: typeof Layers; keys: ConfigKey[] }[] = [
  { key: "fabrics", label: "Fabrics", icon: Layers, keys: ["frontFabric", "backFabric"] },
  { key: "construction", label: "Construction", icon: Cpu, keys: ["filling", "quilting", "piping"] },
  { key: "decoration", label: "Decoration", icon: Palette, keys: ["printing", "embroidery", "applique"] },
  { key: "trims", label: "Accessories & Trims", icon: Tag, keys: ["zipper", "label", "hangTag", "trim"] },
];

type Selection = Partial<Record<ConfigKey, string>>;

/** Coming from the SRF request — pre-selected & badged as "SRF request" */
const SRF_DEFAULTS: Selection = {
  frontFabric: "ff-cotton-500",
  backFabric: "bf-percale",
  filling: "fill-poly-200",
  quilting: "q-box",
  piping: "p-corded-cream",
  printing: "pr-digital",
  embroidery: "em-logo",
  applique: "ap-none",
  zipper: "z-ykk-50",
  label: "lb-woven",
  hangTag: "ht-kraft",
  trim: "tr-none",
};

/** Options AI recommends per key — used to render the "AI" glyph and the "why" note */
const AI_RECOMMENDED: Partial<Record<ConfigKey, { id: string; why: string }>> = {
  frontFabric: { id: "ff-cotton-600", why: "+0.9% margin · same hand feel, higher perceived value" },
  backFabric: { id: "bf-sateen", why: "+0.6% margin · buyer historically upgrades sateen backing" },
  filling: { id: "fill-poly-200", why: "Best cost/loft ratio for MOQ · matches POD spec" },
  quilting: { id: "q-diamond", why: "+$0.14 perceived value · low tooling delta" },
  printing: { id: "pr-digital", why: "Faster sampling · lower waste at this MOQ" },
  embroidery: { id: "em-logo", why: "Meets buyer branding minimum without over-stitching" },
  zipper: { id: "z-ykk-50", why: "Approved supplier · avoids QA re-audit" },
  label: { id: "lb-leather", why: "+2.1% margin · lifts price point vs woven label" },
};

const DEFAULT_SELECTION: Selection = { ...SRF_DEFAULTS };


type Article = { id: string; name: string; image?: string };
type Scenario = {
  id: string;
  name: string;
  tag?: "default" | "ai" | "template";
  selection: Selection;
  leftSelection: Record<string, string>;
};

// SEED_SCENARIOS and SCENARIO_TEMPLATES are defined below LEFT_DEFAULTS
// (they need the LeftSelection defaults to exist first).


/* ============================================================
   LEFT PANEL — Commercial Variables data
   ============================================================ */
type LeftVarKey =
  | "moq"
  | "size"
  | "packaging"
  | "gsm"
  | "yarnCount"
  | "certification"
  | "transportation"
  | "testing"
  | "buyerDiscount"
  | "supplier";

type LeftOption = { id: string; label: string };
type LeftVar = {
  key: LeftVarKey;
  label: string;
  options: LeftOption[];
  defaultId: string;
  aiId?: string;
  aiSummary?: { profit: string; margin: string; accept: string; conf: string };
  deltaBadge?: string;
};

const LEFT_VARIABLES: LeftVar[] = [
  {
    key: "moq",
    label: "MOQ",
    options: [
      { id: "50", label: "50 pcs" },
      { id: "100", label: "100 pcs" },
      { id: "200", label: "200 pcs" },
      { id: "500", label: "500 pcs" },
    ],
    defaultId: "50",
    aiId: "500",
    aiSummary: { profit: "+$326.88", margin: "+0.4pt", accept: "70%", conf: "80%" },
    deltaBadge: "+$326.88",
  },
  {
    key: "size",
    label: "Size",
    options: [
      { id: "twin", label: "Twin · 66\" x 86\"" },
      { id: "queen", label: "Full / Queen · 90\" x 90\"" },
      { id: "king", label: "King · 108\" x 90\"" },
      { id: "calking", label: "Cal King · 108\" x 102\"" },
    ],
    defaultId: "twin",
    aiId: "twin",
  },
  {
    key: "packaging",
    label: "Packaging",
    options: [
      { id: "pvc-insert-hangtag", label: "PVC bag + insert card + hangtag" },
      { id: "pvc-hangtag", label: "PVC bag + hangtag" },
      { id: "poly-sticker", label: "Poly bag + sticker" },
    ],
    defaultId: "pvc-insert-hangtag",
    aiId: "pvc-hangtag",
    aiSummary: { profit: "+-$2.52", margin: "+0.0pt", accept: "66%", conf: "80%" },
    deltaBadge: "+-$2.52",
  },
  {
    key: "gsm",
    label: "GSM",
    options: [
      { id: "180", label: "180 GSM · Comforter shell" },
      { id: "115", label: "115 GSM · Sheeting" },
      { id: "110", label: "110 GSM · Quilt shell" },
    ],
    defaultId: "180",
    aiId: "180",
  },
  {
    key: "yarnCount",
    label: "Yarn Count",
    options: [
      { id: "40x40", label: "40s x 40s" },
      { id: "30x30", label: "30s x 30s" },
      { id: "stf75", label: "STF 75 H (staple flax)" },
    ],
    defaultId: "40x40",
    aiId: "40x40",
  },
  {
    key: "certification",
    label: "Certification",
    options: [
      { id: "oeko-bci", label: "OEKO-TEX + BCI Cotton" },
      { id: "oeko", label: "OEKO-TEX only" },
      { id: "oeko-bci-gots", label: "OEKO + BCI + GOTS" },
    ],
    defaultId: "oeko-bci",
    aiId: "oeko-bci",
  },
  {
    key: "transportation",
    label: "Transportation",
    options: [
      { id: "sea-fcl", label: "Sea · FCL 40HQ" },
      { id: "sea-lcl", label: "Sea · LCL" },
      { id: "air", label: "Air freight" },
    ],
    defaultId: "sea-fcl",
    aiId: "sea-fcl",
  },
  {
    key: "testing",
    label: "Testing",
    options: [
      { id: "basic", label: "Basic · fibre + wash · $0.20" },
      { id: "standard", label: "Standard · + colour fastness · $0.45" },
      { id: "extensive", label: "Extensive · full REACH suite · $0.90" },
    ],
    defaultId: "standard",
    aiId: "standard",
  },
  {
    key: "buyerDiscount",
    label: "Buyer Discount",
    options: [
      { id: "-10", label: "-10% off target" },
      { id: "-15", label: "-15% off target" },
      { id: "-20", label: "-20% off target" },
    ],
    defaultId: "-10",
    aiId: "-15",
    aiSummary: { profit: "+-$1.80", margin: "+0.0pt", accept: "76%", conf: "80%" },
    deltaBadge: "+-$1.80",
  },
  {
    key: "supplier",
    label: "Supplier",
    options: [
      { id: "karur", label: "Karur Mills · India" },
      { id: "panipat", label: "Panipat Textiles · India" },
      { id: "erode", label: "Erode Weaves · India" },
    ],
    defaultId: "karur",
    aiId: "karur",
  },
];

type LeftSelection = Record<LeftVarKey, string>;
const LEFT_DEFAULTS: LeftSelection = Object.fromEntries(
  LEFT_VARIABLES.map((v) => [v.key, v.defaultId]),
) as LeftSelection;

/* ---------- Scenarios: 4 defaults + template library ---------- */
const SEED_SCENARIOS: Scenario[] = [
  {
    id: "current",
    name: "Current",
    tag: "default",
    selection: { ...DEFAULT_SELECTION },
    leftSelection: { ...LEFT_DEFAULTS },
  },
  {
    id: "lowest",
    name: "Lowest Cost",
    tag: "ai",
    selection: {
      ...DEFAULT_SELECTION,
      frontFabric: "ff-cotton-500",
      printing: "pr-digital",
      embroidery: "em-none",
      label: "lb-woven",
      hangTag: "ht-none",
      quilting: "q-box",
      applique: "ap-none",
    },
    leftSelection: {
      ...LEFT_DEFAULTS,
      moq: "500",
      packaging: "poly-sticker",
      testing: "basic",
      certification: "oeko",
      transportation: "sea-fcl",
      buyerDiscount: "-15",
    },
  },
  {
    id: "value",
    name: "Value Engineered",
    tag: "ai",
    selection: {
      ...DEFAULT_SELECTION,
      backFabric: "bf-percale",
      printing: "pr-digital",
      zipper: "z-ykk-50",
      hangTag: "ht-kraft",
    },
    leftSelection: {
      ...LEFT_DEFAULTS,
      moq: "200",
      packaging: "pvc-hangtag",
      testing: "standard",
      buyerDiscount: "-10",
    },
  },
  {
    id: "moq",
    name: "Highest MOQ",
    tag: "ai",
    selection: { ...DEFAULT_SELECTION },
    leftSelection: {
      ...LEFT_DEFAULTS,
      moq: "500",
      packaging: "pvc-hangtag",
      transportation: "sea-fcl",
      buyerDiscount: "-15",
    },
  },
];

type ScenarioTemplate = {
  id: string;
  name: string;
  description: string;
  build: (base: Scenario) => Omit<Scenario, "id">;
};

const SCENARIO_TEMPLATES: ScenarioTemplate[] = [
  {
    id: "tpl-lowest",
    name: "Lowest Cost",
    description: "Strip to the cheapest compliant components",
    build: () => ({
      name: "Lowest Cost (copy)",
      tag: "template",
      selection: {
        ...DEFAULT_SELECTION,
        frontFabric: "ff-cotton-500",
        printing: "pr-digital",
        embroidery: "em-none",
        label: "lb-woven",
        hangTag: "ht-none",
        applique: "ap-none",
      },
      leftSelection: {
        ...LEFT_DEFAULTS,
        moq: "500",
        packaging: "poly-sticker",
        testing: "basic",
        certification: "oeko",
        buyerDiscount: "-15",
      },
    }),
  },
  {
    id: "tpl-premium",
    name: "Premium",
    description: "Elevate materials and finish for premium tiers",
    build: () => ({
      name: "Premium",
      tag: "template",
      selection: {
        ...DEFAULT_SELECTION,
        frontFabric: "ff-jacquard",
        quilting: "q-diamond",
        label: "lb-leather",
        embroidery: "em-premium",
        hangTag: "ht-kraft",
      },
      leftSelection: {
        ...LEFT_DEFAULTS,
        packaging: "pvc-insert-hangtag",
        certification: "oeko-bci-gots",
        testing: "extensive",
      },
    }),
  },
  {
    id: "tpl-highmargin",
    name: "Highest Margin",
    description: "Optimise for margin without sacrificing acceptance",
    build: () => ({
      name: "Highest Margin",
      tag: "template",
      selection: {
        ...DEFAULT_SELECTION,
        backFabric: "bf-percale",
        printing: "pr-digital",
        embroidery: "em-logo",
        label: "lb-woven",
      },
      leftSelection: {
        ...LEFT_DEFAULTS,
        moq: "500",
        packaging: "poly-sticker",
        testing: "standard",
        buyerDiscount: "-10",
      },
    }),
  },
  {
    id: "tpl-fastest",
    name: "Fastest Delivery",
    description: "Air freight, lower MOQ, ready-approved trims",
    build: () => ({
      name: "Fastest Delivery",
      tag: "template",
      selection: { ...DEFAULT_SELECTION },
      leftSelection: {
        ...LEFT_DEFAULTS,
        moq: "200",
        transportation: "air",
        testing: "standard",
      },
    }),
  },
  {
    id: "tpl-sustainable",
    name: "Sustainable Materials",
    description: "Organic, certified fibres and eco packaging",
    build: () => ({
      name: "Sustainable Materials",
      tag: "template",
      selection: {
        ...DEFAULT_SELECTION,
        frontFabric: "ff-cotton-500",
        printing: "pr-digital",
        hangTag: "ht-kraft",
      },
      leftSelection: {
        ...LEFT_DEFAULTS,
        packaging: "poly-sticker",
        certification: "oeko-bci-gots",
        testing: "extensive",
      },
    }),
  },
  {
    id: "tpl-buyer",
    name: "Buyer Preferred",
    description: "Mirror the buyer's historical purchase profile",
    build: (base) => ({
      name: "Buyer Preferred",
      tag: "template",
      selection: { ...base.selection },
      leftSelection: { ...base.leftSelection, packaging: "pvc-insert-hangtag" },
    }),
  },
  {
    id: "tpl-new",
    name: "Create New Scenario",
    description: "Start from current configuration",
    build: (base) => ({
      name: "New Scenario",
      tag: "template",
      selection: { ...base.selection },
      leftSelection: { ...base.leftSelection },
    }),
  },
];

/* ---------- Cost helper: full landed cost per piece ---------- */
function computeTotalCost(sel: Selection, left: Record<string, string>): number {
  const pick = (id?: string) => LIBRARY.find((c) => c.id === id)?.cost ?? 0;
  const material =
    pick(sel.frontFabric) +
    pick(sel.backFabric) +
    pick(sel.filling) +
    pick(sel.quilting) +
    pick(sel.piping);
  const making =
    pick(sel.printing) +
    pick(sel.embroidery) +
    pick(sel.applique) +
    pick(sel.zipper) +
    pick(sel.label) +
    pick(sel.hangTag) +
    pick(sel.trim);
  const packaging = PACKAGING_COST[left.packaging] ?? 0;
  const testing = TESTING_COST[left.testing] ?? 0;
  const cert = CERT_COST[left.certification] ?? 0;
  const transport = TRANSPORT_COST[left.transportation] ?? 0;
  const subtotal = material + making + packaging + testing + cert + transport;
  const overheads = subtotal * 0.4 + 0.15; // matches AnalysisCenter
  return subtotal + overheads;
}


/* ============================================================
   MAIN
   ============================================================ */

export function ConfigWorkspace({
  srfId,
  products,
  onCancel,
}: {
  srfId: string;
  products: Article[];
  onCancel: () => void;
}) {
  const [tabs, setTabs] = useState<Article[]>(products);
  const [activeArticleId, setActiveArticleId] = useState<string>(products[0]?.id ?? "");
  const [view, setView] = useState<"config" | "analysis">("config");
  const [compareOpen, setCompareOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);


  // Per-article scenario state
  const [scenariosByArticle, setScenariosByArticle] = useState<Record<string, Scenario[]>>(() =>
    Object.fromEntries(products.map((p) => [p.id, SEED_SCENARIOS.map((s) => ({ ...s, selection: { ...s.selection } }))])),
  );
  const [activeScenarioIdByArticle, setActiveScenarioIdByArticle] = useState<Record<string, string>>(() =>
    Object.fromEntries(products.map((p) => [p.id, "current"])),
  );

  const scenarios = scenariosByArticle[activeArticleId] ?? SEED_SCENARIOS;
  const activeScenarioId = activeScenarioIdByArticle[activeArticleId] ?? "current";
  const activeScenario = scenarios.find((s) => s.id === activeScenarioId) ?? scenarios[0];
  const sel = activeScenario.selection;
  const leftSel = (activeScenario.leftSelection ?? LEFT_DEFAULTS) as LeftSelection;

  const setActiveScenario = (id: string) =>
    setActiveScenarioIdByArticle((all) => ({ ...all, [activeArticleId]: id }));

  const setSel = (next: Selection) =>
    setScenariosByArticle((all) => ({
      ...all,
      [activeArticleId]: (all[activeArticleId] ?? scenarios).map((s) =>
        s.id === activeScenarioId ? { ...s, selection: next } : s,
      ),
    }));

  const setLeftSelForScenario = (next: LeftSelection) =>
    setScenariosByArticle((all) => ({
      ...all,
      [activeArticleId]: (all[activeArticleId] ?? scenarios).map((s) =>
        s.id === activeScenarioId ? { ...s, leftSelection: next } : s,
      ),
    }));

  const closeTab = (id: string) => {
    if (tabs.length === 1) return;
    const next = tabs.filter((t) => t.id !== id);
    setTabs(next);
    if (activeArticleId === id) setActiveArticleId(next[0].id);
  };

  const [lastChangedKey, setLastChangedKey] = useState<ConfigKey | null>(null);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  const gridCols = cn(
    leftCollapsed && rightCollapsed && "grid-cols-[44px_minmax(0,1fr)_44px]",
    leftCollapsed && !rightCollapsed && "grid-cols-[44px_minmax(0,1fr)_360px]",
    !leftCollapsed && rightCollapsed && "grid-cols-[360px_minmax(0,1fr)_44px]",
    !leftCollapsed && !rightCollapsed && "grid-cols-[360px_minmax(0,1fr)_360px]",
  );

  const applySel = (k: ConfigKey, id: string) => {
    setSel({ ...sel, [k]: id });
    setLastChangedKey(k);
  };

  const applyLeftSel = (k: LeftVarKey, id: string) => {
    setLeftSelForScenario({ ...leftSel, [k]: id });
  };


  return (
    <div className="flex h-screen w-full flex-col bg-canvas text-ink-900">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-hairline bg-surface px-4">
        <button
          onClick={onCancel}
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[12.5px] text-ink-500 hover:bg-surface-alt hover:text-ink-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <div className="flex items-center gap-1.5 text-[12px] text-ink-500">
          <Link to="/pods" className="hover:text-ink-900">PODs</Link>
          <span className="text-ink-300">/</span>
          <Link to="/pods" className="hover:text-ink-900">{srfId}</Link>
          <span className="text-ink-300">/</span>
          <span className="text-ink-900">Costing Workspace</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {(() => {
            const status = costingStatusForArticle(activeArticleId);
            if (status === "approved") {
              return (
                <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-brand-50 px-3 text-[12px] font-medium text-brand-700 ring-1 ring-brand-700/20">
                  <Check className="h-3.5 w-3.5" /> Approved
                </span>
              );
            }
            if (status === "pending_approval") {
              return (
                <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-gold-50 px-3 text-[12px] font-medium text-gold-700 ring-1 ring-gold-200">
                  <AlertCircle className="h-3.5 w-3.5" /> Pending Approval
                </span>
              );
            }
            return null;
          })()}
          <button
            onClick={() => setCompareOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 text-[12px] font-medium text-ink-700 hover:bg-surface-alt hover:text-ink-900"
          >
            <GitCompare className="h-3.5 w-3.5" /> Compare
          </button>
          <button
            onClick={() => setSubmitOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-brand-700 px-3 text-[12px] font-medium text-white hover:bg-brand-800"
          >
            <Send className="h-3.5 w-3.5" /> Send for Approval
          </button>
        </div>

      </header>

      {/* Article "browser tabs" */}
      <div className="flex h-10 shrink-0 items-end gap-1 border-b border-hairline bg-ink-100/70 px-3 pt-1.5">
        {tabs.map((t) => {
          const isActive = t.id === activeArticleId;
          return (
            <button
              key={t.id}
              onClick={() => setActiveArticleId(t.id)}
              className={cn(
                "group relative flex h-8 max-w-[220px] items-center gap-2 rounded-t-md border px-3 text-[12.5px] transition-colors",
                isActive
                  ? "-mb-px border-hairline border-b-canvas bg-canvas font-medium text-ink-900 shadow-[0_-1px_0_0_rgba(15,20,18,0.04)]"
                  : "border-transparent bg-ink-100 text-ink-500 hover:bg-surface-alt hover:text-ink-900",
              )}
            >
              <ImageIcon className={cn("h-3 w-3", isActive ? "text-brand-700" : "text-ink-400")} />
              <span className="truncate">{t.name}</span>
              {tabs.length > 1 && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(t.id);
                  }}
                  className="inline-flex h-4 w-4 items-center justify-center rounded text-ink-400 hover:bg-ink-200 hover:text-ink-900"
                >
                  <X className="h-3 w-3" />
                </span>
              )}
            </button>
          );
        })}
        <button
          className="ml-1 inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] text-ink-500 hover:bg-surface hover:text-ink-900"
          title="Add another article to this costing"
        >
          <Plus className="h-3.5 w-3.5" /> Add article
        </button>
      </div>

      {/* Body */}
      <div className="relative flex-1 min-h-0">
        {/* Floating pill tabs */}
        <FloatingPillTabs view={view} onChange={setView} />

        <div className={cn("grid h-full min-h-0", gridCols)}>
          {/* LEFT PANEL — always same */}
          <aside className="flex h-full min-h-0 flex-col border-r border-hairline bg-surface">
            {leftCollapsed ? (
              <button
                onClick={() => setLeftCollapsed(false)}
                title="Expand configuration"
                className="mx-auto mt-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-500 hover:bg-surface-alt hover:text-ink-900"
              >
                <PanelLeftClose className="h-3.5 w-3.5 rotate-180" />
              </button>
            ) : (
              <div key={`left-${activeScenarioId}`} className="flex h-full min-h-0 animate-fade-in flex-col">
                <LeftConfigPanel
                  selection={leftSel}
                  onChange={applyLeftSel}
                  onCollapse={() => setLeftCollapsed(true)}
                  componentSelection={sel}
                  onApplyComponent={applySel}
                />
              </div>
            )}
          </aside>

          {/* CENTER */}
          <main className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-canvas">
            <div key={`center-${view}-${activeScenarioId}`} className="flex h-full min-h-0 flex-1 animate-fade-in flex-col">
              {view === "config" ? (
                <ConfigCenter
                  selection={sel}
                  leftSelection={leftSel}
                  onApply={applySel}
                  article={tabs.find((t) => t.id === activeArticleId) ?? tabs[0]}
                />
              ) : (
                <AnalysisCenter
                  selection={sel}
                  leftSelection={leftSel}
                  article={tabs.find((t) => t.id === activeArticleId) ?? tabs[0]}
                />
              )}
            </div>
          </main>

          {/* RIGHT PANEL — always same */}
          <aside className="flex h-full min-h-0 flex-col border-l border-hairline bg-surface">
            <RightOverviewPanel
              selection={sel}
              leftSelection={leftSel}
              scenarios={scenarios}
              activeScenarioId={activeScenarioId}
              onSelectScenario={setActiveScenario}
              onCompare={() => setCompareOpen(true)}
              article={tabs.find((t) => t.id === activeArticleId) ?? tabs[0]}
              lastChangedKey={lastChangedKey}
              onApplyRecommendation={applySel}
              srfId={srfId}
              collapsed={rightCollapsed}
              setCollapsed={setRightCollapsed}
            />

          </aside>
        </div>
      </div>

      {compareOpen && (
        <CompareOverlay
          scenarios={scenarios}
          activeId={activeScenarioId}
          onPick={(id) => {
            setActiveScenario(id);
            setCompareOpen(false);
          }}
          onClose={() => setCompareOpen(false)}
        />
      )}

      {submitOpen && (
        <SubmitApprovalModal
          open={submitOpen}
          onClose={() => setSubmitOpen(false)}
          snapshot={buildApprovalSnapshot({
            article: tabs.find((t) => t.id === activeArticleId) ?? tabs[0],
            srfId,
            sel,
            leftSel,
            scenarioName: activeScenario.name,
          })}
        />
      )}
    </div>
  );
}

/* ============================================================
   Build ApprovalSnapshot from active scenario
   ============================================================ */
function buildApprovalSnapshot({
  article,
  srfId,
  sel,
  leftSel,
  scenarioName,
}: {
  article: Article;
  srfId: string;
  sel: Selection;
  leftSel: LeftSelection;
  scenarioName: string;
}): ApprovalSnapshot {
  const front = LIBRARY.find((c) => c.id === sel.frontFabric);
  const back = LIBRARY.find((c) => c.id === sel.backFabric);
  const printing = LIBRARY.find((c) => c.id === sel.printing);
  const embroidery = LIBRARY.find((c) => c.id === sel.embroidery);
  const filling = LIBRARY.find((c) => c.id === sel.filling);
  const quilting = LIBRARY.find((c) => c.id === sel.quilting);
  const piping = LIBRARY.find((c) => c.id === sel.piping);
  const zipper = LIBRARY.find((c) => c.id === sel.zipper);
  const label = LIBRARY.find((c) => c.id === sel.label);
  const hangTag = LIBRARY.find((c) => c.id === sel.hangTag);

  const material =
    (front?.cost ?? 0) + (back?.cost ?? 0) + (filling?.cost ?? 0) + (quilting?.cost ?? 0) + (piping?.cost ?? 0);
  const making =
    (printing?.cost ?? 0) + (embroidery?.cost ?? 0) + (zipper?.cost ?? 0) + (label?.cost ?? 0) + (hangTag?.cost ?? 0);
  const packaging = PACKAGING_COST[leftSel.packaging] ?? 0;
  const testing = TESTING_COST[leftSel.testing] ?? 0;
  const cert = CERT_COST[leftSel.certification] ?? 0;
  const transport = TRANSPORT_COST[leftSel.transportation] ?? 0;
  const subtotal = material + making + packaging + testing + cert + transport;
  const overheads = subtotal * 0.4 + 0.15;
  const total = subtotal + overheads;
  const target = 8.5;
  const disc = Number(leftSel.buyerDiscount) / 100;
  const sellingPrice = target * (1 + disc);
  const margin = sellingPrice > 0 ? ((sellingPrice - total) / sellingPrice) * 100 : 0;

  const moqLabel =
    LEFT_VARIABLES.find((v) => v.key === "moq")!.options.find((o) => o.id === leftSel.moq)?.label ?? "—";
  const sizeLabel =
    LEFT_VARIABLES.find((v) => v.key === "size")!.options.find((o) => o.id === leftSel.size)?.label ?? "—";
  const packagingLabel =
    LEFT_VARIABLES.find((v) => v.key === "packaging")!.options.find((o) => o.id === leftSel.packaging)?.label ?? "—";
  const certLabel =
    LEFT_VARIABLES.find((v) => v.key === "certification")!.options.find((o) => o.id === leftSel.certification)?.label ?? "—";
  const transportLabel =
    LEFT_VARIABLES.find((v) => v.key === "transportation")!.options.find((o) => o.id === leftSel.transportation)?.label ?? "—";
  const gsmLabel =
    LEFT_VARIABLES.find((v) => v.key === "gsm")?.options.find((o) => o.id === leftSel.gsm)?.label ?? "—";
  const supplier = front?.supplier ?? "Karur Mills";

  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0);

  return {
    productName: article.name,
    productImage: article.image,
    buyer: "H&M Home",
    articleId: article.id,
    articleCode: article.id.toUpperCase(),
    srfId,
    moq: moqLabel,
    size: sizeLabel,
    supplier,
    scenarioName,
    sellingPrice,
    cost: total,
    margin,
    targetPrice: target,
    confidence: 86,
    commercialHealth: margin >= 20 ? "Strong" : margin >= 10 ? "Watch" : "At Risk",
    configGroups: [
      {
        label: "Material",
        items: [
          { label: "Front Fabric", value: front?.name ?? "—", cost: front ? `$${front.cost.toFixed(2)}` : undefined },
          { label: "Back Fabric", value: back?.name ?? "—", cost: back ? `$${back.cost.toFixed(2)}` : undefined },
          { label: "GSM", value: gsmLabel },
          { label: "Supplier", value: supplier },
        ],
      },
      {
        label: "Making",
        items: [
          { label: "Printing", value: printing?.name ?? "—", cost: printing ? `$${printing.cost.toFixed(2)}` : undefined },
          { label: "Embroidery", value: embroidery?.name ?? "—", cost: embroidery ? `$${embroidery.cost.toFixed(2)}` : undefined },
          { label: "Quilting", value: quilting?.name ?? "—", cost: quilting ? `$${quilting.cost.toFixed(2)}` : undefined },
          { label: "Filling", value: filling?.name ?? "—", cost: filling ? `$${filling.cost.toFixed(2)}` : undefined },
        ],
      },
      {
        label: "Commercial",
        items: [
          { label: "MOQ", value: moqLabel },
          { label: "Packaging", value: packagingLabel },
          { label: "Certification", value: certLabel },
          { label: "Transportation", value: transportLabel },
        ],
      },
    ],
    costRows: [
      { label: "Material", cost: material, pct: pct(material), color: "#05604d" },
      { label: "Making", cost: making, pct: pct(making), color: "#2d8f7a" },
      { label: "Packaging", cost: packaging, pct: pct(packaging), color: "#c69324" },
      { label: "Testing", cost: testing, pct: pct(testing), color: "#7A5230" },
      { label: "Certification", cost: cert, pct: pct(cert), color: "#a58b3f" },
      { label: "Transportation", cost: transport, pct: pct(transport), color: "#4d5651" },
      { label: "Overheads & Margin", cost: overheads, pct: pct(overheads), color: "#0a7460" },
    ],
    aiSummary: {
      verdict:
        margin >= 20
          ? `Commercially viable at ${margin.toFixed(1)}% margin. Cost stack looks stable — recommend proceeding with buyer.`
          : `Margin of ${margin.toFixed(1)}% is below plan. Consider fabric swap or MOQ change before submitting.`,
      risks: [
        "Cotton yarn +4.8% MoM could shave 1.2 pt margin",
        "Buyer historically pushes 2% discount at PO",
      ],
      confidence: 86,
      bestScenario: "Value Engineered — captures +2.8 pt margin, same lead time",
      recommendations: [
        "Lock 90-day forward with Karur Mills to hedge yarn",
        "Trial value-tier packaging on 2.5k MOQ tier",
        "Qualify secondary front-fabric supplier",
      ],
    },
    history: {
      similarProducts: 7,
      previousMargin: 19.8,
      winRate: 71,
      similarBuyers: ["West Elm", "IKEA", "Marks & Spencer"],
      historicalSupplier: `${supplier} · 12 orders`,
      avgLeadTime: "44 days",
    },
  };
}





/* ============================================================
   FLOATING PILL TABS
   ============================================================ */
function FloatingPillTabs({ view, onChange }: { view: "config" | "analysis"; onChange: (v: "config" | "analysis") => void }) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-hairline bg-surface/95 p-1 shadow-[0_6px_24px_-10px_rgba(15,20,18,0.18)] backdrop-blur">
        <PillBtn active={view === "config"} onClick={() => onChange("config")} icon={Layers}>
          Configuration
        </PillBtn>
        <PillBtn active={view === "analysis"} onClick={() => onChange("analysis")} icon={BarChart3}>
          Cost Analysis
        </PillBtn>
      </div>
    </div>
  );
}

function PillBtn({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Layers;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-all",
        active
          ? "bg-ink-900 text-white shadow-sm"
          : "text-ink-500 hover:bg-surface-alt hover:text-ink-900",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

/* ============================================================
   LEFT PANEL — unified Component Library
   Three groups: Materials · Making · Commercial Variables
   Every card follows the same expand/collapse pattern.
   ============================================================ */

const MATERIALS_KEYS: ConfigKey[] = ["frontFabric", "backFabric"];
const MAKING_KEYS: ConfigKey[] = [
  "printing",
  "embroidery",
  "filling",
  "quilting",
  "piping",
  "applique",
  "zipper",
  "label",
  "hangTag",
];

const CONFIG_LABEL: Record<ConfigKey, string> = {
  frontFabric: "Front Fabric",
  backFabric: "Back Fabric",
  filling: "Filling",
  quilting: "Quilting Pattern",
  piping: "Piping / Edge",
  printing: "Printing",
  embroidery: "Embroidery",
  applique: "Appliqué",
  zipper: "Zipper",
  label: "Label",
  hangTag: "Hang Tag",
  trim: "Trim",
};

const CONFIG_CATEGORY: Record<ConfigKey, LibCategory> = {
  frontFabric: "Front Fabric",
  backFabric: "Back Fabric",
  filling: "Filling",
  quilting: "Quilting",
  piping: "Piping",
  printing: "Printing",
  embroidery: "Embroidery",
  applique: "Appliqué",
  zipper: "Zipper",
  label: "Label",
  hangTag: "Hang Tag",
  trim: "Trim",
};

function LeftConfigPanel({
  selection,
  onChange,
  onCollapse,
  componentSelection,
  onApplyComponent,
}: {
  selection: LeftSelection;
  onChange: (k: LeftVarKey, id: string) => void;
  onCollapse: () => void;
  componentSelection: Selection;
  onApplyComponent: (k: ConfigKey, id: string) => void;
}) {
  const [openKey, setOpenKey] = useState<string | null>("frontFabric");
  const toggle = (k: string) => setOpenKey(openKey === k ? null : k);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-hairline px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-alt">
          <Package className="h-3.5 w-3.5 text-ink-700" />
        </div>
        <span className="text-[13px] font-medium text-ink-900">Component Library</span>
        <button
          onClick={onCollapse}
          title="Collapse"
          className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded text-ink-400 hover:bg-surface-alt hover:text-ink-900"
        >
          <PanelLeftClose className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <GroupHeader>Materials</GroupHeader>
        <div className="space-y-2">
          {MATERIALS_KEYS.map((k) => (
            <UnifiedComponentCard
              key={k}
              configKey={k}
              open={openKey === k}
              onToggle={() => toggle(k)}
              selectedId={componentSelection[k] ?? ""}
              onSelect={(id) => onApplyComponent(k, id)}
            />
          ))}
        </div>

        <GroupHeader className="mt-5">Making</GroupHeader>
        <div className="space-y-2">
          {MAKING_KEYS.map((k) => (
            <UnifiedComponentCard
              key={k}
              configKey={k}
              open={openKey === k}
              onToggle={() => toggle(k)}
              selectedId={componentSelection[k] ?? ""}
              onSelect={(id) => onApplyComponent(k, id)}
            />
          ))}
        </div>

        <GroupHeader className="mt-5">Commercial Variables</GroupHeader>
        <div className="space-y-2">
          {LEFT_VARIABLES.map((v) => (
            <UnifiedVariableCard
              key={v.key}
              variable={v}
              selectedId={selection[v.key]}
              open={openKey === v.key}
              onToggle={() => toggle(v.key)}
              onChange={(id) => onChange(v.key, id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function GroupHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "mb-2 px-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-400",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ---------- One shared card shell used by every entry ---------- */
function UnifiedCardShell({
  swatch,
  title,
  selectedLabel,
  metaRight,
  aiBadge,
  open,
  onToggle,
  children,
}: {
  swatch?: string;
  title: string;
  selectedLabel: string;
  metaRight?: React.ReactNode;
  aiBadge?: boolean;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-hairline bg-surface transition-shadow hover:shadow-sm">
      <button onClick={onToggle} className="flex w-full items-start gap-2.5 px-3.5 py-3 text-left">
        <div
          className={cn(
            "mt-0.5 h-8 w-8 shrink-0 rounded-md border border-hairline",
            !swatch && "bg-surface-alt",
          )}
          style={swatch ? { background: swatch } : undefined}
        />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-ink-900">{title}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-ink-500">
            <span className="truncate">{selectedLabel || "—"}</span>
            {metaRight && <span className="tabular-nums text-ink-400">{metaRight}</span>}
          </div>
        </div>
        {aiBadge && (
          <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md bg-brand-50 px-2 text-[11px] font-semibold text-brand-700">
            <Sparkles className="h-3 w-3" /> AI
          </span>
        )}
        <ChevronDown
          className={cn(
            "mt-1 h-3.5 w-3.5 shrink-0 text-ink-400 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && <div className="border-t border-hairline p-2.5">{children}</div>}
    </div>
  );
}

/* ---------- Row used inside every expanded card ---------- */
function UnifiedOptionRow({
  swatch,
  name,
  meta,
  isSelected,
  isAI,
  isSRF,
  onClick,
}: {
  swatch?: string;
  name: string;
  meta?: string;
  isSelected: boolean;
  isAI?: boolean;
  isSRF?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg border p-2 text-left transition-colors",
        isSelected
          ? "border-brand-700 bg-brand-50/60"
          : "border-hairline bg-surface hover:border-ink-200",
      )}
    >
      <div
        className={cn(
          "h-7 w-7 shrink-0 rounded-md border border-hairline",
          !swatch && "bg-surface-alt",
        )}
        style={swatch ? { background: swatch } : undefined}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="truncate text-[12px] font-medium text-ink-900">{name}</span>
          {isAI && <Sparkles className="h-2.5 w-2.5 shrink-0 text-brand-700" />}
        </div>
        {meta && (
          <div className="flex items-center gap-1.5 text-[10.5px] text-ink-500">
            <span className="truncate">{meta}</span>
            {isSRF && (
              <span className="rounded bg-ink-100 px-1 text-[9px] font-semibold uppercase tracking-wider text-ink-700">
                POD
              </span>
            )}
          </div>
        )}
      </div>
      {isSelected && (
        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white">
          <Check className="h-2.5 w-2.5" />
        </span>
      )}
    </button>
  );
}

/* ---------- Card variants ---------- */
function UnifiedComponentCard({
  configKey,
  open,
  onToggle,
  selectedId,
  onSelect,
}: {
  configKey: ConfigKey;
  open: boolean;
  onToggle: () => void;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const label = CONFIG_LABEL[configKey];
  const options = LIBRARY.filter((c) => c.category === CONFIG_CATEGORY[configKey]);
  const selected = options.find((o) => o.id === selectedId);
  const aiRec = AI_RECOMMENDED[configKey];
  const srfId = SRF_DEFAULTS[configKey];
  const aiPicked = !!aiRec && aiRec.id === selectedId;

  return (
    <UnifiedCardShell
      swatch={selected?.swatch}
      title={label}
      selectedLabel={selected?.name ?? "—"}
      metaRight={selected ? `· $${selected.cost.toFixed(2)}` : undefined}
      aiBadge={aiPicked}
      open={open}
      onToggle={onToggle}
    >
      <div className="space-y-1.5">
        {options.map((opt) => (
          <UnifiedOptionRow
            key={opt.id}
            swatch={opt.swatch}
            name={opt.name}
            meta={`$${opt.cost.toFixed(2)} · ${opt.supplier}`}
            isSelected={opt.id === selectedId}
            isAI={aiRec?.id === opt.id}
            isSRF={srfId === opt.id}
            onClick={() => onSelect(opt.id)}
          />
        ))}
      </div>
      {aiRec && aiRec.id !== selectedId && (
        <AIRecommendationNote
          title={options.find((o) => o.id === aiRec.id)?.name ?? "AI pick"}
          why={aiRec.why}
        />
      )}
    </UnifiedCardShell>
  );
}

function UnifiedVariableCard({
  variable,
  selectedId,
  open,
  onToggle,
  onChange,
}: {
  variable: LeftVar;
  selectedId: string;
  open: boolean;
  onToggle: () => void;
  onChange: (id: string) => void;
}) {
  const selected = variable.options.find((o) => o.id === selectedId);
  const aiPicked = !!variable.aiId && variable.aiId === selectedId;
  const aiDivergent = !!variable.aiId && variable.aiId !== selectedId;

  return (
    <UnifiedCardShell
      title={variable.label}
      selectedLabel={selected?.label ?? "—"}
      metaRight={variable.deltaBadge && !aiPicked ? variable.deltaBadge : undefined}
      aiBadge={aiPicked}
      open={open}
      onToggle={onToggle}
    >
      <div className="space-y-1.5">
        {variable.options.map((opt) => (
          <UnifiedOptionRow
            key={opt.id}
            name={opt.label}
            isSelected={opt.id === selectedId}
            isAI={variable.aiId === opt.id}
            onClick={() => onChange(opt.id)}
          />
        ))}
      </div>
      {aiDivergent && (
        <AIRecommendationNote
          title={variable.options.find((o) => o.id === variable.aiId)?.label ?? "AI pick"}
          summary={variable.aiSummary}
        />
      )}
    </UnifiedCardShell>
  );
}

/* ---------- Shared AI recommendation note ---------- */
function AIRecommendationNote({
  title,
  why,
  summary,
}: {
  title: string;
  why?: string;
  summary?: { profit: string; margin: string; accept: string; conf: string };
}) {
  return (
    <div className="mt-2.5 rounded-lg border border-brand-100 bg-brand-50/60 p-2.5">
      <div className="flex items-center gap-1.5 text-[11.5px] text-brand-800">
        <Sparkles className="h-3 w-3" />
        <span>
          AI suggests <span className="font-semibold">{title}</span>
        </span>
      </div>
      {why && <div className="mt-1 text-[11px] text-ink-500">{why}</div>}
      {summary && (
        <>
          <div className="mt-2 grid grid-cols-4 gap-2 text-[10px] uppercase tracking-wider text-ink-500">
            <div>Profit</div>
            <div>Margin</div>
            <div>Accept</div>
            <div>Conf</div>
          </div>
          <div className="mt-0.5 grid grid-cols-4 gap-2 text-[12px] font-semibold text-ink-900">
            <div className="text-brand-700">{summary.profit}</div>
            <div className="text-brand-700">{summary.margin}</div>
            <div>{summary.accept}</div>
            <div>{summary.conf}</div>
          </div>
        </>
      )}
    </div>
  );
}

/* ============================================================
   CENTER — Commercial cost buckets (accordion ribbons)
   ============================================================ */
type BucketKey =
  | "material"
  | "making"
  | "packaging"
  | "testing"
  | "certification"
  | "transportation"
  | "overheads";

const PACKAGING_COST: Record<string, number> = {
  "pvc-insert-hangtag": 0.42,
  "pvc-hangtag": 0.3,
  "poly-sticker": 0.18,
};
const CERT_COST: Record<string, number> = {
  "oeko-bci": 0.35,
  oeko: 0.15,
  "oeko-bci-gots": 0.62,
};
const TRANSPORT_COST: Record<string, number> = {
  "sea-fcl": 0.28,
  "sea-lcl": 0.45,
  air: 1.2,
};
const TESTING_OPTIONS = [
  { id: "basic", label: "Basic (fibre + wash)", cost: 0.2 },
  { id: "standard", label: "Standard (+ colour fastness)", cost: 0.45 },
  { id: "extensive", label: "Extensive (full REACH suite)", cost: 0.9 },
];

const TESTING_COST: Record<string, number> = {
  basic: 0.2,
  standard: 0.45,
  extensive: 0.9,
};

function ConfigCenter({
  selection,
  leftSelection,
  article,
}: {
  selection: Selection;
  leftSelection: LeftSelection;
  onApply: (k: ConfigKey, id: string) => void;
  article: Article;
}) {
  const frontFabric = LIBRARY.find((c) => c.id === selection.frontFabric);
  const backFabric = LIBRARY.find((c) => c.id === selection.backFabric);
  const printing = LIBRARY.find((c) => c.id === selection.printing);
  const embroidery = LIBRARY.find((c) => c.id === selection.embroidery);

  const costMaterial = (frontFabric?.cost ?? 0) + (backFabric?.cost ?? 0);
  const costMaking = (printing?.cost ?? 0) + (embroidery?.cost ?? 0);
  const costPackaging = PACKAGING_COST[leftSelection.packaging] ?? 0;
  const costTesting = TESTING_COST[leftSelection.testing] ?? 0;
  const costCert = CERT_COST[leftSelection.certification] ?? 0;
  const costTransport = TRANSPORT_COST[leftSelection.transportation] ?? 0;

  const subtotal = costMaterial + costMaking + costPackaging + costTesting + costCert + costTransport;
  const overheadPct = 0.12;
  const commissionPct = 0.03;
  const marginPct = 0.25;
  const misc = 0.15;
  const overhead = subtotal * overheadPct;
  const commission = subtotal * commissionPct;
  const commercialMargin = subtotal * marginPct;
  const costOverheads = overhead + commission + commercialMargin + misc;

  const totalCost = subtotal + costOverheads;
  const impactOf = (cost: number, baseline: number) => ((baseline - cost) / 8.5) * 100;

  const packagingLabel =
    LEFT_VARIABLES.find((v) => v.key === "packaging")!.options.find((o) => o.id === leftSelection.packaging)?.label ??
    "—";
  const testingLabel =
    LEFT_VARIABLES.find((v) => v.key === "testing")!.options.find((o) => o.id === leftSelection.testing)?.label ?? "—";
  const certLabel =
    LEFT_VARIABLES.find((v) => v.key === "certification")!.options.find((o) => o.id === leftSelection.certification)
      ?.label ?? "—";
  const transportLabel =
    LEFT_VARIABLES.find((v) => v.key === "transportation")!.options.find(
      (o) => o.id === leftSelection.transportation,
    )?.label ?? "—";

  const moqLabel =
    LEFT_VARIABLES.find((v) => v.key === "moq")!.options.find((o) => o.id === leftSelection.moq)?.label ?? "—";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1080px] space-y-3 px-6 pb-10 pt-16">
          {/* Hero product preview — takes most of the pane */}
          <ProductImagePreview
            article={article}
            frontFabric={frontFabric}
            backFabric={backFabric}
            printing={printing}
            embroidery={embroidery}
            leftSelection={leftSelection}
            selection={selection}
          />

          {/* Material Cost — read-only summary of selected fabrics */}
          <ReadOnlyBucket
            label="Material Cost"
            cost={costMaterial}
            pctOfTotal={totalCost > 0 ? (costMaterial / totalCost) * 100 : 0}
            impactPct={impactOf(costMaterial, 4.35)}
          >
            <div className="space-y-2">
              <SelectedLine label="Front Fabric" name={frontFabric?.name} sub={frontFabric?.supplier} cost={frontFabric?.cost} swatch={frontFabric?.swatch} />
              <SelectedLine label="Back Fabric" name={backFabric?.name} sub={backFabric?.supplier} cost={backFabric?.cost} swatch={backFabric?.swatch} />
            </div>
          </ReadOnlyBucket>

          {/* MAKING COST — read only */}
          <ReadOnlyBucket
            label="Making Cost"
            cost={costMaking}
            pctOfTotal={totalCost > 0 ? (costMaking / totalCost) * 100 : 0}
            impactPct={impactOf(costMaking, 1.42)}
          >
            <div className="space-y-2">
              <SelectedLine label="Printing" name={printing?.name} sub={printing?.supplier} cost={printing?.cost} swatch={printing?.swatch} />
              <SelectedLine label="Embroidery" name={embroidery?.name} sub={embroidery?.supplier} cost={embroidery?.cost} swatch={embroidery?.swatch} />
            </div>
          </ReadOnlyBucket>

          {/* No-expand rows */}
          <InlineBucket
            label="Packaging Cost"
            selectedValue={packagingLabel}
            cost={costPackaging}
            pctOfTotal={totalCost > 0 ? (costPackaging / totalCost) * 100 : 0}
            impactPct={impactOf(costPackaging, 0.42)}
          />
          <InlineBucket
            label="Testing Cost"
            selectedValue={testingLabel}
            cost={costTesting}
            pctOfTotal={totalCost > 0 ? (costTesting / totalCost) * 100 : 0}
            impactPct={impactOf(costTesting, 0.45)}
          />
          <InlineBucket
            label="Certification Cost"
            selectedValue={certLabel}
            cost={costCert}
            pctOfTotal={totalCost > 0 ? (costCert / totalCost) * 100 : 0}
            impactPct={impactOf(costCert, 0.35)}
          />
          <InlineBucket
            label="Transportation Cost"
            selectedValue={transportLabel}
            cost={costTransport}
            pctOfTotal={totalCost > 0 ? (costTransport / totalCost) * 100 : 0}
            impactPct={impactOf(costTransport, 0.28)}
          />

          {/* Overheads always visible */}
          <ReadOnlyBucket
            label="Overheads & Margin"
            cost={costOverheads}
            pctOfTotal={totalCost > 0 ? (costOverheads / totalCost) * 100 : 0}
            impactPct={0}
            defaultOpen
          >
            <div className="grid grid-cols-2 gap-2.5">
              <OverheadTile label="Overheads" pct={overheadPct * 100} value={overhead} />
              <OverheadTile label="Commission" pct={commissionPct * 100} value={commission} />
              <OverheadTile label="Commercial Margin" pct={marginPct * 100} value={commercialMargin} />
              <OverheadTile label="Miscellaneous" value={misc} />
            </div>
          </ReadOnlyBucket>
        </div>
      </div>
    </div>
  );
}

function ReadOnlyBucket({
  label,
  cost,
  pctOfTotal,
  impactPct,
  defaultOpen = true,
  children,
}: {
  label: string;
  cost: number;
  pctOfTotal: number;
  impactPct: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <span className="text-[13px] font-semibold text-ink-900">{label}</span>
        </div>
        <div className="flex items-center gap-4 text-[12px] tabular-nums text-ink-700">
          <span className="font-semibold text-ink-900">${cost.toFixed(2)}</span>
          <span className="text-ink-500">{pctOfTotal.toFixed(0)}%</span>
          <MarginPill pct={impactPct} />
        </div>
      </div>
      {defaultOpen && (
        <div className="border-t border-hairline bg-surface-alt/20 p-4">{children}</div>
      )}
    </div>
  );
}

function InlineBucket({
  label,
  selectedValue,
  cost,
  pctOfTotal,
  impactPct,
}: {
  label: string;
  selectedValue: string;
  cost: number;
  pctOfTotal: number;
  impactPct: number;
}) {
  return (
    <div className="rounded-xl border border-hairline bg-surface px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-ink-900">{label}</div>
          <div className="mt-0.5 truncate text-[12px] text-ink-500">{selectedValue}</div>
        </div>
        <div className="flex items-center gap-4 text-[12px] tabular-nums text-ink-700">
          <span className="font-semibold text-ink-900">${cost.toFixed(2)}</span>
          <span className="text-ink-500">{pctOfTotal.toFixed(0)}%</span>
          <MarginPill pct={impactPct} />
        </div>
      </div>
    </div>
  );
}

function SelectedLine({
  label,
  name,
  sub,
  cost,
  swatch,
}: {
  label: string;
  name?: string;
  sub?: string;
  cost?: number;
  swatch?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-hairline bg-surface p-2.5">
      <div
        className="h-9 w-9 shrink-0 rounded-md border border-hairline"
        style={{ background: swatch ?? "#F1EEE6" }}
      />
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] uppercase tracking-wider text-ink-500">{label}</div>
        <div className="mt-0.5 truncate text-[12.5px] font-medium text-ink-900">{name ?? "—"}</div>
        {sub && <div className="truncate text-[11px] text-ink-500">{sub}</div>}
      </div>
      <div className="tabular-nums text-[12.5px] font-semibold text-ink-900">
        ${(cost ?? 0).toFixed(2)}
      </div>
    </div>
  );
}

/* ============================================================
   INTERACTIVE PRODUCT PREVIEW — CAD-style configurator
   Front/Back faces render independently. Every left-panel and
   component change re-renders the SVG in real time.
   ============================================================ */

type ProductKind = "towel" | "cushion" | "throw" | "bedding" | "pillow";

function detectProductKind(name: string): ProductKind {
  const n = name.toLowerCase();
  if (n.includes("cushion")) return "cushion";
  if (n.includes("throw") || n.includes("blanket")) return "throw";
  if (n.includes("pillow")) return "pillow";
  if (n.includes("bedding") || n.includes("sateen") || n.includes("percale") || n.includes("sheet") || n.includes("duvet")) return "bedding";
  return "towel";
}

/** Aspect ratio (w/h) of the product silhouette for the given kind. */
function kindAspect(kind: ProductKind): number {
  switch (kind) {
    case "towel": return 0.62;   // tall folded stack-ish
    case "cushion": return 1;    // square
    case "pillow": return 1.55;  // wide rectangle
    case "throw": return 1.25;   // wide-ish
    case "bedding": return 1.35; // wide flat
  }
}

function ProductImagePreview({
  article,
  frontFabric,
  backFabric,
  printing,
  embroidery,
  leftSelection,
  selection,
}: {
  article: Article;
  frontFabric?: Component;
  backFabric?: Component;
  printing?: Component;
  embroidery?: Component;
  leftSelection: LeftSelection;
  selection: Selection;
}) {
  const [face, setFace] = useState<"front" | "back">("front");
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const kind = detectProductKind(article.name ?? "");
  const aspect = kindAspect(kind);
  const activeFabric = face === "front" ? frontFabric : backFabric;
  const tint = activeFabric?.swatch ?? "#EDE6D3";

  const quilting = LIBRARY.find((c) => c.id === selection.quilting);
  const piping = LIBRARY.find((c) => c.id === selection.piping);
  const zipper = LIBRARY.find((c) => c.id === selection.zipper);
  const label = LIBRARY.find((c) => c.id === selection.label);
  const filling = LIBRARY.find((c) => c.id === selection.filling);
  const applique = LIBRARY.find((c) => c.id === selection.applique);
  const hangTag = LIBRARY.find((c) => c.id === selection.hangTag);
  const trim = LIBRARY.find((c) => c.id === selection.trim);

  const labelFor = (k: LeftVarKey) =>
    LEFT_VARIABLES.find((v) => v.key === k)!.options.find((o) => o.id === leftSelection[k])?.label ?? "—";

  // Weave density derived from GSM — heavier fabric = tighter grid
  const gsm = Number(leftSelection.gsm) || 180;
  const weaveStep = Math.max(14, Math.min(30, 34 - gsm / 20));
  // Yarn count → weave stroke width (finer count = thinner threads)
  const yarnStroke =
    leftSelection.yarnCount === "40x40" ? 0.6 : leftSelection.yarnCount === "30x30" ? 1.0 : 1.3;
  // Filling loft — heavier fill = puffier body shadow
  const fillingLoft = filling?.id === "fill-down-90" ? 1 : filling?.id === "fill-poly-200" ? 0.6 : 0;
  // Size influences aspect visually (king wider than twin)
  const sizeScale =
    leftSelection.size === "king"
      ? 1.08
      : leftSelection.size === "calking"
      ? 1.12
      : leftSelection.size === "queen"
      ? 1.02
      : 0.96;

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.6, Math.min(2.4, z + (e.deltaY < 0 ? 0.08 : -0.08))));
  };
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    setPan({
      x: dragRef.current.px + (e.clientX - dragRef.current.x),
      y: dragRef.current.py + (e.clientY - dragRef.current.y),
    });
  };
  const onUp = () => { dragRef.current = null; };
  const reset = () => { setRotation(0); setZoom(1); setPan({ x: 0, y: 0 }); };

  const packagingKind = leftSelection.packaging;
  const certKind = leftSelection.certification;
  const sizeLabel = labelFor("size").split("·")[0]?.trim() ?? "";

  return (
    <section className="overflow-hidden rounded-2xl border border-hairline bg-surface">
      <div
        className="relative aspect-[16/11] w-full overflow-hidden select-none bg-surface"
        onWheel={onWheel}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      >
        {/* Floor shadow — grows with filling loft */}
        <div
          className="pointer-events-none absolute left-1/2 bottom-[9%] -translate-x-1/2 rounded-[50%] blur-2xl"
          style={{
            height: `${24 + fillingLoft * 10}px`,
            width: `${46 + fillingLoft * 6}%`,
            background: `rgba(15,20,18,${0.14 + fillingLoft * 0.06})`,
          }}
        />

        {/* Interactive product stage */}
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center transition-transform duration-200 ease-out"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom * sizeScale})`,
          }}
        >
          <ProductSilhouette
            kind={kind}
            aspect={aspect}
            face={face}
            tint={tint}
            weaveStep={weaveStep}
            yarnStroke={yarnStroke}
            quiltingId={quilting?.id}
            pipingSwatch={piping?.swatch}
            zipperOn={!!zipper && zipper.id !== "z-none"}
            embroideryLabel={embroidery?.name}
            printingLabel={printing?.name}
            labelText={label?.name}
            appliqueSwatch={applique && applique.id !== "ap-none" ? applique.swatch : undefined}
            hangTagSwatch={hangTag && hangTag.id !== "ht-none" ? hangTag.swatch : undefined}
            trimSwatch={trim && trim.id !== "tr-none" ? trim.swatch : undefined}
            fillingLoft={fillingLoft}
            packagingKind={packagingKind}
            certKind={certKind}
            sizeLabel={sizeLabel}
          />
        </div>


        {/* Live preview status pill */}
        <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-surface/95 px-3 py-1 text-[11px] text-ink-700 shadow-sm backdrop-blur">
          Live preview · <span className="font-medium text-ink-900">{face} face</span>
        </div>

        {/* Rotate / reset controls — top right */}
        <div className="absolute right-4 top-4 z-10 flex flex-col items-center gap-1.5">
          <PreviewIconButton title="Rotate" onClick={() => setRotation((r) => r + 15)}>
            <RotateCw className="h-3.5 w-3.5" />
          </PreviewIconButton>
          <PreviewIconButton title="Reset view" onClick={reset}>
            <Maximize2 className="h-3.5 w-3.5" />
          </PreviewIconButton>
        </div>

        {/* Front / Back toggle pill */}
        <div className="absolute left-1/2 bottom-4 z-10 -translate-x-1/2">
          <div className="flex items-center gap-0.5 rounded-full border border-hairline bg-surface/95 p-1 shadow-[0_6px_24px_-10px_rgba(15,20,18,0.18)] backdrop-blur">
            <button
              onClick={() => setFace("front")}
              className={cn(
                "rounded-full px-3.5 py-1 text-[11.5px] font-medium transition-all",
                face === "front" ? "bg-ink-900 text-white" : "text-ink-500 hover:text-ink-900",
              )}
            >
              Front
            </button>
            <button
              onClick={() => setFace("back")}
              className={cn(
                "rounded-full px-3.5 py-1 text-[11.5px] font-medium transition-all",
                face === "back" ? "bg-ink-900 text-white" : "text-ink-500 hover:text-ink-900",
              )}
            >
              Back
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}


function PreviewIconButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-hairline bg-surface/95 text-ink-600 shadow-sm backdrop-blur hover:text-ink-900"
    >
      {children}
    </button>
  );
}

/** SVG silhouette that responds to every configuration change. */
function ProductSilhouette({
  kind,
  aspect,
  face,
  tint,
  weaveStep,
  yarnStroke,
  quiltingId,
  pipingSwatch,
  zipperOn,
  embroideryLabel,
  printingLabel,
  labelText,
  appliqueSwatch,
  hangTagSwatch,
  trimSwatch,
  fillingLoft,
  packagingKind,
  certKind,
  sizeLabel,
}: {
  kind: ProductKind;
  aspect: number;
  face: "front" | "back";
  tint: string;
  weaveStep: number;
  yarnStroke: number;
  quiltingId?: string;
  pipingSwatch?: string;
  zipperOn: boolean;
  embroideryLabel?: string;
  printingLabel?: string;
  labelText?: string;
  appliqueSwatch?: string;
  hangTagSwatch?: string;
  trimSwatch?: string;
  fillingLoft: number;
  packagingKind: string;
  certKind: string;
  sizeLabel: string;
}) {

  // Fixed viewBox height, width derived from aspect.
  const H = 520;
  const W = Math.round(H * aspect);
  const radius = kind === "cushion" || kind === "throw" ? 18 : kind === "towel" ? 22 : 14;
  const inset = 14;
  const bodyX = inset;
  const bodyY = inset;
  const bodyW = W - inset * 2;
  const bodyH = H - inset * 2;

  const gridId = `weave-${face}`;
  const shadeId = `shade-${face}`;
  const quiltId = `quilt-${quiltingId ?? "none"}-${face}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-[78%] w-auto"
      style={{ maxWidth: "78%" }}
    >
      <defs>
        <linearGradient id={shadeId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
          <stop offset="60%" stopColor="rgba(255,255,255,0)" />
          <stop offset="100%" stopColor="rgba(15,20,18,0.10)" />
        </linearGradient>
        <pattern id={gridId} x="0" y="0" width={weaveStep} height={weaveStep} patternUnits="userSpaceOnUse">
          <path
            d={`M ${weaveStep} 0 L 0 0 0 ${weaveStep}`}
            fill="none"
            stroke="rgba(15,20,18,0.16)"
            strokeWidth={yarnStroke}
            strokeDasharray="2 3"
          />
        </pattern>

        {quiltingId === "q-diamond" && (
          <pattern id={quiltId} x="0" y="0" width="46" height="46" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="46" height="46" fill="none" />
            <path d="M0 23 H46 M23 0 V46" stroke="rgba(15,20,18,0.22)" strokeWidth="0.9" />
          </pattern>
        )}
        {quiltingId === "q-box" && (
          <pattern id={quiltId} x="0" y="0" width="52" height="52" patternUnits="userSpaceOnUse">
            <path d={`M0 0 H52 M0 0 V52`} stroke="rgba(15,20,18,0.22)" strokeWidth="0.9" />
          </pattern>
        )}
        {quiltingId === "q-channel" && (
          <pattern id={quiltId} x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M15 0 V30" stroke="rgba(15,20,18,0.22)" strokeWidth="0.9" />
          </pattern>
        )}
      </defs>

      {/* Product body */}
      <rect
        x={bodyX}
        y={bodyY}
        width={bodyW}
        height={bodyH}
        rx={radius}
        ry={radius}
        fill={tint}
        stroke="rgba(15,20,18,0.14)"
        strokeWidth="1"
      />
      {/* Weave grid */}
      <rect
        x={bodyX}
        y={bodyY}
        width={bodyW}
        height={bodyH}
        rx={radius}
        ry={radius}
        fill={`url(#${gridId})`}
      />
      {/* Quilting overlay */}
      {quiltingId && quiltingId !== "q-none" && (
        <rect
          x={bodyX}
          y={bodyY}
          width={bodyW}
          height={bodyH}
          rx={radius}
          ry={radius}
          fill={`url(#${quiltId})`}
          opacity={0.85}
        />
      )}
      {/* Shading */}
      <rect
        x={bodyX}
        y={bodyY}
        width={bodyW}
        height={bodyH}
        rx={radius}
        ry={radius}
        fill={`url(#${shadeId})`}
      />

      {/* Piping — bottom bar */}
      {pipingSwatch && (
        <rect
          x={bodyX + 8}
          y={bodyY + bodyH - 14}
          width={bodyW - 16}
          height={4}
          rx={2}
          fill={pipingSwatch}
          stroke="rgba(15,20,18,0.18)"
          strokeWidth="0.6"
        />
      )}

      {/* Zipper — side dashed line + pull */}
      {zipperOn && (
        <g>
          <line
            x1={bodyX + bodyW - 6}
            y1={bodyY + 18}
            x2={bodyX + bodyW - 6}
            y2={bodyY + bodyH - 18}
            stroke="rgba(15,20,18,0.55)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <circle cx={bodyX + bodyW - 6} cy={bodyY + 22} r="4" fill="#0f1412" />
        </g>
      )}

      {/* Embroidery — LOGO circle (front only) */}
      {face === "front" && embroideryLabel && embroideryLabel.toLowerCase() !== "none" && (
        <g>
          <circle
            cx={bodyX + bodyW - 46}
            cy={bodyY + 52}
            r={26}
            fill="#a58b3f"
            stroke="rgba(15,20,18,0.18)"
          />
          <text
            x={bodyX + bodyW - 46}
            y={bodyY + 56}
            textAnchor="middle"
            fontSize="10"
            fontWeight="600"
            fill="#fff"
            letterSpacing="1"
          >
            LOGO
          </text>
        </g>
      )}

      {/* Print marker — center */}
      {face === "front" && printingLabel && printingLabel.toLowerCase() !== "none" && (
        <g>
          <rect
            x={bodyX + bodyW / 2 - 44}
            y={bodyY + bodyH / 2 - 12}
            width={88}
            height={24}
            rx={6}
            fill="rgba(255,255,255,0.9)"
            stroke="rgba(15,20,18,0.18)"
          />
          <text
            x={bodyX + bodyW / 2}
            y={bodyY + bodyH / 2 + 4}
            textAnchor="middle"
            fontSize="10"
            fontWeight="600"
            fill="#0f1412"
            letterSpacing="0.5"
          >
            PRINT PLACEMENT
          </text>
        </g>
      )}

      {/* Label — stitched tag on the left seam (back face) */}
      {face === "back" && labelText && (
        <g>
          <rect
            x={bodyX + 10}
            y={bodyY + bodyH / 2 - 14}
            width={40}
            height={28}
            rx={3}
            fill="#f7f2e6"
            stroke="rgba(15,20,18,0.35)"
          />
          <text
            x={bodyX + 30}
            y={bodyY + bodyH / 2 + 2}
            textAnchor="middle"
            fontSize="7"
            fontWeight="600"
            fill="#0f1412"
          >
            LABEL
          </text>
        </g>
      )}

      {/* Appliqué — corner patch on front */}
      {face === "front" && appliqueSwatch && (
        <g>
          <rect
            x={bodyX + 24}
            y={bodyY + bodyH - 88}
            width={64}
            height={64}
            rx={8}
            fill={appliqueSwatch}
            stroke="rgba(15,20,18,0.28)"
            strokeDasharray="3 2"
          />
        </g>
      )}

      {/* Trim — cord along the bottom */}
      {trimSwatch && (
        <line
          x1={bodyX + 12}
          y1={bodyY + bodyH - 22}
          x2={bodyX + bodyW - 12}
          y2={bodyY + bodyH - 22}
          stroke={trimSwatch}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      )}

      {/* Hang tag — attached at top-right corner */}
      {hangTagSwatch && (
        <g>
          <line
            x1={bodyX + bodyW - 30}
            y1={bodyY + 2}
            x2={bodyX + bodyW - 30}
            y2={bodyY + 24}
            stroke="rgba(15,20,18,0.55)"
            strokeWidth="1"
          />
          <rect
            x={bodyX + bodyW - 44}
            y={bodyY + 22}
            width={28}
            height={22}
            rx={2}
            fill={hangTagSwatch}
            stroke="rgba(15,20,18,0.35)"
          />
          <circle cx={bodyX + bodyW - 30} cy={bodyY + 27} r={1.6} fill="#0f1412" />
        </g>
      )}

      {/* Certification badge — small chip near bottom-left */}
      {certKind && (
        <g>
          <rect
            x={bodyX + 18}
            y={bodyY + bodyH - 40}
            width={
              certKind === "oeko-bci-gots" ? 88 : certKind === "oeko-bci" ? 74 : 54
            }
            height={16}
            rx={8}
            fill="rgba(255,255,255,0.94)"
            stroke="rgba(15,20,18,0.25)"
          />
          <text
            x={bodyX + 26}
            y={bodyY + bodyH - 29}
            fontSize="8"
            fontWeight="700"
            fill="#0f1412"
            letterSpacing="0.6"
          >
            {certKind === "oeko-bci-gots"
              ? "OEKO · BCI · GOTS"
              : certKind === "oeko-bci"
              ? "OEKO · BCI"
              : "OEKO"}
          </text>
        </g>
      )}

      {/* Size caption — top-left ribbon */}
      {sizeLabel && (
        <g>
          <rect
            x={bodyX + 12}
            y={bodyY + 12}
            width={sizeLabel.length * 6 + 14}
            height={16}
            rx={8}
            fill="rgba(15,20,18,0.72)"
          />
          <text
            x={bodyX + 19}
            y={bodyY + 23}
            fontSize="8.5"
            fontWeight="600"
            fill="#fff"
            letterSpacing="0.5"
          >
            {sizeLabel.toUpperCase()}
          </text>
        </g>
      )}

      {/* Packaging wrap — dashed outline hinting the pack */}
      {packagingKind && packagingKind !== "pvc-insert-hangtag" && (
        <rect
          x={bodyX - 6}
          y={bodyY - 6}
          width={bodyW + 12}
          height={bodyH + 12}
          rx={radius + 4}
          fill="none"
          stroke={
            packagingKind === "poly-sticker" ? "rgba(15,20,18,0.30)" : "rgba(15,20,18,0.20)"
          }
          strokeWidth="1"
          strokeDasharray={packagingKind === "poly-sticker" ? "2 4" : "5 3"}
        />
      )}

      {/* Filling loft — subtle inner glow to hint puffiness */}
      {fillingLoft > 0 && (
        <rect
          x={bodyX + 4}
          y={bodyY + 4}
          width={bodyW - 8}
          height={bodyH - 8}
          rx={radius - 2}
          fill="none"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth={fillingLoft * 3.5}
          opacity={0.6}
        />
      )}
    </svg>

  );
}

function PreviewChip({ label, value, swatch }: { label: string; value: string; swatch?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-hairline bg-surface/95 px-2.5 py-1.5 text-[11px] shadow-sm backdrop-blur">
      {swatch && (
        <span className="h-3.5 w-3.5 shrink-0 rounded border border-hairline" style={{ background: swatch }} />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[9.5px] uppercase tracking-wider text-ink-400">{label}</div>
        <div className="truncate text-[11.5px] font-medium text-ink-900">{value}</div>
      </div>
    </div>
  );
}






function MarginPill({ pct }: { pct: number }) {
  if (Math.abs(pct) < 0.05) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-surface-alt px-2 py-0.5 text-[11px] font-medium text-ink-500">
        ±0.0%
      </span>
    );
  }
  const positive = pct > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors",
        positive ? "bg-brand-50 text-brand-700" : "bg-red-50 text-red-700",
      )}
    >
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {positive ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}

function FabricRow({
  title,
  selectedId,
  options,
  onSelect,
  aiId,
  srfId,
}: {
  title: string;
  selectedId: string;
  options: Component[];
  onSelect: (id: string) => void;
  aiId?: string;
  srfId?: string;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] uppercase tracking-wider text-ink-500">{title}</div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {options.map((opt) => {
          const selected = selectedId === opt.id;
          const ai = aiId === opt.id;
          const srf = srfId === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onSelect(opt.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg border p-2 text-left transition-colors",
                selected
                  ? "border-brand-700 bg-brand-50/60"
                  : "border-hairline bg-surface hover:border-ink-200",
              )}
            >
              <div
                className="h-8 w-8 shrink-0 rounded-md border border-hairline"
                style={{ background: opt.swatch }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="truncate text-[12px] font-medium text-ink-900">{opt.name}</span>
                  {ai && <Sparkles className="h-2.5 w-2.5 shrink-0 text-brand-700" />}
                </div>
                <div className="flex items-center gap-1.5 text-[10.5px] text-ink-500">
                  <span className="tabular-nums">${opt.cost.toFixed(2)}</span>
                  {srf && (
                    <span className="rounded bg-ink-100 px-1 text-[9px] font-semibold uppercase tracking-wider text-ink-700">
                      POD
                    </span>
                  )}
                </div>
              </div>
              {selected && (
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-brand-700 text-white">
                  <Check className="h-2.5 w-2.5" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SimpleRow({
  title,
  value,
  onChange,
  options,
}: {
  title: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] uppercase tracking-wider text-ink-500">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const on = opt.id === value;
          return (
            <button
              key={opt.id}
              onClick={() => onChange(opt.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
                on
                  ? "border-brand-700 bg-brand-700 text-white"
                  : "border-hairline bg-surface text-ink-700 hover:bg-surface-alt",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SummaryRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface p-3">
      <div className="text-[10.5px] uppercase tracking-wider text-ink-500">{label}</div>
      <div className="mt-0.5 text-[13px] font-medium text-ink-900">{value}</div>
      {hint && <div className="mt-1 text-[11px] text-ink-400">{hint}</div>}
    </div>
  );
}

function OverheadTile({
  label,
  pct,
  value,
}: {
  label: string;
  pct?: number;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-hairline bg-surface p-3">
      <div className="text-[10.5px] uppercase tracking-wider text-ink-500">{label}</div>
      <div className="mt-1 flex items-baseline justify-between">
        <span className="tabular-nums text-[15px] font-semibold text-ink-900">
          ${value.toFixed(2)}
        </span>
        {pct !== undefined && <span className="text-[11px] text-ink-500">{pct.toFixed(0)}%</span>}
      </div>
    </div>
  );
}

function SellingPriceCard({
  totalCost,
  target,
  sellingPrice,
  margin,
  moqLabel,
  breakdown,
}: {
  totalCost: number;
  target: number;
  sellingPrice: number;
  margin: number;
  moqLabel: string;
  breakdown: {
    material: number;
    making: number;
    packaging: number;
    testing: number;
    cert: number;
    transport: number;
    overheads: number;
    total: number;
  };
}) {
  const [open, setOpen] = useState(false);
  const marginGood = margin >= 20;
  const rows: [string, number][] = [
    ["Material", breakdown.material],
    ["Making", breakdown.making],
    ["Packaging", breakdown.packaging],
    ["Testing", breakdown.testing],
    ["Certification", breakdown.cert],
    ["Transportation", breakdown.transport],
    ["Overheads & Margin", breakdown.overheads],
  ];
  return (
    <div className="rounded-lg border border-hairline bg-surface">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 px-4 pb-3 pt-4 text-left"
      >
        <div className="min-w-0">
          <div className="text-[10.5px] uppercase tracking-[0.14em] text-ink-500">Total Cost</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="tabular-nums text-[30px] font-medium leading-none tracking-tight text-brand-700">
              ${totalCost.toFixed(2)}
            </span>
            <span className="text-[11.5px] text-ink-500">per piece</span>
          </div>
        </div>
        <ChevronDown className={cn("mt-1 h-4 w-4 text-ink-400 transition-transform", open && "rotate-180")} />
      </button>

      <div className="grid grid-cols-3 gap-px border-t border-hairline bg-hairline/60 text-[11px]">
        <SpCell label="Target" value={`$${target.toFixed(2)}`} />
        <SpCell label="Selling" value={`$${sellingPrice.toFixed(2)}`} />
        <SpCell
          label="Margin"
          value={`${margin.toFixed(1)}%`}
          tone={marginGood ? "good" : "bad"}
        />
        <SpCell label="Per Piece" value={`$${totalCost.toFixed(2)}`} />
        <SpCell label="MOQ" value={moqLabel} />
        <SpCell label="" value="" />
      </div>

      {open && (
        <div className="border-t border-hairline p-3">
          <div className="mb-2 text-[10.5px] uppercase tracking-[0.14em] text-ink-500">Cost breakdown</div>
          <div className="space-y-1.5">
            {rows.map(([label, value]) => {
              const pct = totalCost > 0 ? (value / totalCost) * 100 : 0;
              return (
                <div key={label} className="space-y-0.5">
                  <div className="flex items-center justify-between text-[12px] text-ink-700">
                    <span>{label}</span>
                    <span className="tabular-nums text-ink-900">${value.toFixed(2)}</span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-surface-alt">
                    <div
                      className="h-full rounded-full bg-brand-700/70"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SpCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="bg-surface px-3 py-2">
      <div className="text-[9.5px] uppercase tracking-[0.14em] text-ink-500">{label}</div>
      <div
        className={cn(
          "mt-0.5 text-[12.5px] font-semibold tabular-nums text-ink-900",
          tone === "good" && "text-emerald-600",
          tone === "bad" && "text-red-600",
        )}
      >
        {value || "\u00A0"}
      </div>
    </div>
  );
}

function SellingPriceRibbon({
  totalCost,
  discount,
  moqLabel,
}: {
  totalCost: number;
  discount: string;
  moqLabel: string;
}) {
  const target = 8.5;
  const disc = Number(discount) / 100;
  const sellingPrice = target * (1 + disc);
  const margin = sellingPrice > 0 ? ((sellingPrice - totalCost) / sellingPrice) * 100 : 0;
  const marginGood = margin >= 20;

  return (
    <div className="shrink-0 border-t border-hairline bg-ink-900 px-6 py-3 text-white">
      <div className="mx-auto flex max-w-[1080px] items-center gap-6 text-[12px]">
        <RibbonCell label="Target" value={`$${target.toFixed(2)}`} />
        <RibbonDivider />
        <RibbonCell label="Current" value={`$${sellingPrice.toFixed(2)}`} highlight />
        <RibbonDivider />
        <RibbonCell
          label="Margin"
          value={`${margin.toFixed(1)}%`}
          tone={marginGood ? "good" : "bad"}
        />
        <RibbonDivider />
        <RibbonCell label="Per Piece" value={`$${totalCost.toFixed(2)}`} />
        <RibbonDivider />
        <RibbonCell label="MOQ" value={moqLabel} />
      </div>
    </div>
  );
}

function RibbonDivider() {
  return <span className="h-6 w-px bg-white/15" />;
}

function RibbonCell({
  label,
  value,
  highlight,
  tone,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  tone?: "good" | "bad";
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <span className="text-[10px] uppercase tracking-[0.14em] text-white/50">{label}</span>
      <span
        className={cn(
          "mt-0.5 text-[16px] font-semibold tabular-nums leading-none",
          highlight && "text-white",
          tone === "good" && "text-emerald-300",
          tone === "bad" && "text-red-300",
          !highlight && !tone && "text-white",
        )}
      >
        {value}
      </span>
    </div>
  );
}



/* ---------- Product Details (compact + expand) ---------- */
function ProductDetails({
  article,
  srfId,
  leftSelection,
  currentScenarioName,
}: {
  article: Article;
  srfId: string;
  leftSelection: LeftSelection;
  currentScenarioName: string;
}) {
  const name = article.name.toLowerCase();
  const inferred = useMemo(() => {
    if (name.includes("towel")) {
      return { type: article.name, buyer: "H&M Home", quality: "500 GSM · Zero-twist", certification: "OEKO-TEX", composition: "100% Cotton", color: "Sand", leadTime: "12 weeks", shipWindow: "18.04.2026" };
    }
    if (name.includes("throw")) {
      return { type: article.name, buyer: "West Elm", quality: "320 GSM · Herringbone", certification: "OEKO-TEX", composition: "60% Cotton / 40% Linen", color: "Natural", leadTime: "14 weeks", shipWindow: "15.06.2026" };
    }
    if (name.includes("bedding") || name.includes("sateen") || name.includes("percale")) {
      return { type: article.name, buyer: "IKEA", quality: "200 TC Percale", certification: "GOTS", composition: "100% Organic Cotton", color: "Ivory", leadTime: "14 weeks", shipWindow: "17.12.2025" };
    }
    if (name.includes("scarf")) {
      return { type: article.name, buyer: "Uniqlo", quality: "Silk-blend · Digital print", certification: "OEKO-TEX", composition: "70% Silk / 30% Viscose", color: "Signature print", leadTime: "10 weeks", shipWindow: "22.04.2026" };
    }
    if (name.includes("curtain")) {
      return { type: article.name, buyer: "John Lewis", quality: "3-layer blackout", certification: "BS 5867", composition: "100% Polyester", color: "Charcoal", leadTime: "16 weeks", shipWindow: "10.07.2026" };
    }
    return { type: article.name, buyer: "West Elm", quality: "A · Premium", certification: "OEKO-TEX", composition: "100% Cotton", color: "Ivory", leadTime: "14 weeks", shipWindow: "20.05.2026" };
  }, [article.name, name]);

  const moqLabel =
    LEFT_VARIABLES.find((v) => v.key === "moq")!.options.find((o) => o.id === leftSelection.moq)?.label ?? "—";
  const sizeLabel =
    LEFT_VARIABLES.find((v) => v.key === "size")!.options.find((o) => o.id === leftSelection.size)?.label ?? "—";

  const [expanded, setExpanded] = useState(false);

  const compact: [string, string][] = [
    ["Product", inferred.type],
    ["Buyer", inferred.buyer],
    ["Article", srfId],
    ["MOQ", moqLabel],
    ["Size", sizeLabel],
    ["Scenario", currentScenarioName],
  ];
  const extra: [string, string][] = [
    ["Quality", inferred.quality],
    ["Composition", inferred.composition],
    ["Certification", inferred.certification],
    ["Base colour", inferred.color],
    ["Lead time", inferred.leadTime],
    ["Ship window", inferred.shipWindow],
  ];

  return (
    <div className="rounded-lg border border-hairline bg-surface">
      <div className="flex items-center justify-between px-3 pb-1.5 pt-2">
        <div className="text-[10.5px] uppercase tracking-[0.14em] text-ink-500">Product Details</div>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="inline-flex items-center gap-1 text-[11px] text-ink-500 hover:text-ink-900"
        >
          {expanded ? "Show less" : "Show more"}
          <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
        </button>
      </div>
      {compact.map(([label, value], i) => (
        <div
          key={label}
          className={cn(
            "flex items-center justify-between gap-3 px-3 py-1.5 text-[12px]",
            "border-t border-hairline",
            i === 0 && "border-t-0",
          )}
        >
          <span className="shrink-0 text-ink-500">{label}</span>
          <span className="min-w-0 flex-1 truncate text-right font-medium text-ink-900">{value}</span>
        </div>
      ))}
      {expanded &&
        extra.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-3 border-t border-hairline px-3 py-1.5 text-[12px]"
          >
            <span className="shrink-0 text-ink-500">{label}</span>
            <span className="min-w-0 flex-1 truncate text-right font-medium text-ink-900">{value}</span>
          </div>
        ))}
    </div>
  );
}


/* ---------- AI Guidance (contextual to last change) ---------- */
type GuidanceCopy = {
  title: string;
  commercial: string;
  cost: string;
  leadTime: string;
  quality: string;
  alternatives: string;
};

const GUIDANCE_BY_KEY: Partial<Record<ConfigKey | LeftVarKey, Record<string, GuidanceCopy>>> = {
  printing: {
    "pr-digital": {
      title: "Digital printing",
      commercial: "Great for short-run and multi-colour artwork; buyer perceives premium finish.",
      cost: "-$0.08 / pc vs rotary at this MOQ; setup cost is minimal.",
      leadTime: "Sampling in 4–6 days; no screen engraving.",
      quality: "Sharp registration, but colour fastness slightly lower on darks — validate wash test.",
      alternatives: "Rotary screen for 5k+ pcs; sublimation for full-coverage prints.",
    },
    "pr-rotary": {
      title: "Rotary screen printing",
      commercial: "Best economics at high MOQ, mature technique buyers trust.",
      cost: "+$0.14 setup / pc under 3k MOQ; -$0.09 / pc at 10k+.",
      leadTime: "Add 5–7 days for screen engraving on new artwork.",
      quality: "Excellent colour fastness and hand-feel.",
      alternatives: "Digital for short runs and complex artwork; discharge for softer dark grounds.",
    },
  },
  embroidery: {
    "em-logo": {
      title: "Logo embroidery",
      commercial: "Meets buyer branding minimum; universally accepted.",
      cost: "+$0.18 / pc; predictable across MOQ tiers.",
      leadTime: "Adds 2–3 days for tape-out and first stitch approval.",
      quality: "Colour-fast, dimensional feel — protect wash care for darks.",
      alternatives: "Woven label for lower cost; leather patch for premium tiers.",
    },
    "em-premium": {
      title: "Premium embroidery",
      commercial: "Elevates perceived value for premium SKUs.",
      cost: "+$0.42 / pc; contribution margin holds if selling price moves +5%.",
      leadTime: "Adds 3–5 days for multi-head programming.",
      quality: "Rich texture; watch for pucker on fine fabrics.",
      alternatives: "Applique + logo embroidery combo; leather patch.",
    },
  },
  frontFabric: {
    "ff-cotton-500": {
      title: "Cotton 500 GSM front",
      commercial: "Value tier that keeps hand-feel closest to premium.",
      cost: "-$0.34 / pc vs 600 GSM at same MOQ.",
      leadTime: "No lead-time impact — mill is on approved list.",
      quality: "Slightly lower loft; pair with quilted top for perceived weight.",
      alternatives: "Cotton 600 GSM for premium tiers; jacquard for hero pieces.",
    },
    "ff-jacquard": {
      title: "Jacquard front",
      commercial: "Signature hero fabric — supports storytelling for launch.",
      cost: "+$0.72 / pc; requires MOQ ≥ 500 for mill acceptance.",
      leadTime: "Add 7–10 days for weave sampling.",
      quality: "Dimensional weave, best presented on premium bundle.",
      alternatives: "Cotton 600 GSM w/ jacquard-look print; sateen with embroidery.",
    },
  },
};

const GUIDANCE_BY_LEFT: Partial<Record<LeftVarKey, Record<string, GuidanceCopy>>> = {
  packaging: {
    "poly-sticker": {
      title: "Poly bag + sticker",
      commercial: "Right for value tiers; retailer accepts poly for basics.",
      cost: "-$0.24 / pc vs PVC + hangtag; strongest lever below premium.",
      leadTime: "No change — off-shelf packaging.",
      quality: "Presentation is minimal; not suited to hero SKUs.",
      alternatives: "PVC + hangtag for mid-tier; PVC + insert + hangtag for premium.",
    },
    "pvc-insert-hangtag": {
      title: "PVC + insert + hangtag",
      commercial: "Premium retail-ready presentation.",
      cost: "+$0.42 / pc, +$0.24 / pc vs poly.",
      leadTime: "Adds 3–4 days for insert-card printing.",
      quality: "High shelf appeal; recommended for launch tier.",
      alternatives: "PVC + hangtag saves $0.12 / pc without losing hangtag.",
    },
  },
  certification: {
    "oeko-bci-gots": {
      title: "OEKO + BCI + GOTS",
      commercial: "Enables sustainability storytelling; aspirational for buyer.",
      cost: "+$0.27 / pc vs OEKO-only; drags margin ~3.1 pt.",
      leadTime: "Cert paperwork adds 5–7 days at PI stage.",
      quality: "Traceable organic supply; strongest with matching packaging.",
      alternatives: "Keep OEKO + BCI today, re-introduce GOTS on private-label SKUs.",
    },
  },
  transportation: {
    air: {
      title: "Air freight",
      commercial: "Protects launch windows; use only for critical SKUs.",
      cost: "+$0.92 / pc vs sea FCL.",
      leadTime: "Ship-to-DC in 5–7 days vs 28–32 by sea.",
      quality: "No product impact — freight only.",
      alternatives: "Split shipment: 70% sea FCL + 30% air top-up.",
    },
  },
};

function AIGuidance({
  selection,
  leftSelection,
  lastChangedKey,
}: {
  selection: Selection;
  leftSelection: LeftSelection;
  lastChangedKey: ConfigKey | null;
}) {
  // Look up copy for the last-changed item; fall back to a sensible default.
  const key = (lastChangedKey ?? "printing") as ConfigKey;
  const chosenId =
    (selection as Record<string, string | undefined>)[key] ??
    leftSelection[key as unknown as LeftVarKey];
  const copy =
    (chosenId && GUIDANCE_BY_KEY[key]?.[chosenId]) ||
    (chosenId && GUIDANCE_BY_LEFT[key as unknown as LeftVarKey]?.[chosenId]) ||
    {
      title: CONFIG_MAP.find((c) => c.key === key)?.label ?? "Selection",
      commercial: "Balanced pick that aligns with the buyer's historical acceptance.",
      cost: "No material cost impact vs the AI baseline for this MOQ.",
      leadTime: "No lead-time impact expected.",
      quality: "Meets buyer quality bar; no known defects reported this season.",
      alternatives: "Consider the AI recommendation for +margin, or trial a template above.",
    };

  const rows: [string, string, typeof Layers][] = [
    ["Commercial impact", copy.commercial, TrendingUp],
    ["Cost impact", copy.cost, DollarSign],
    ["Lead-time impact", copy.leadTime, Clock],
    ["Quality", copy.quality, ShieldCheck],
    ["Alternatives", copy.alternatives, Sparkles],
  ];

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.14em] text-ink-500">
          <Lightbulb className="h-3 w-3 text-brand-700" /> AI Guidance
        </div>
        <span className="text-[10.5px] text-ink-400">
          {lastChangedKey ? "on last change" : "current pick"}
        </span>
      </div>
      <div className="rounded-md border border-hairline bg-surface p-3">
        <div className="text-[13px] font-semibold text-ink-900">{copy.title}</div>
        <div className="mt-2 space-y-1.5">
          {rows.map(([label, body, Icon]) => (
            <div key={label} className="flex items-start gap-2">
              <span className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded bg-brand-50 text-brand-700">
                <Icon className="h-2.5 w-2.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-400">
                  {label}
                </div>
                <div className="text-[11.5px] leading-snug text-ink-700">{body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


/* ---------- AI Best Pick card ---------- */
function AIBestPickCard({
  scenarios,
  activeScenarioId,
  onSwitch,
}: {
  scenarios: Scenario[];
  activeScenarioId: string;
  onSwitch: (id: string) => void;
}) {
  const target = 8.5;
  const scored = scenarios.map((s) => {
    const total = computeTotalCost(s.selection, s.leftSelection);
    const disc = Number(s.leftSelection.buyerDiscount) / 100;
    const price = target * (1 + disc);
    const marginPct = price > 0 ? ((price - total) / price) * 100 : 0;
    return { s, total, price, marginPct };
  });
  const best = [...scored].sort((a, b) => b.marginPct - a.marginPct)[0];
  const active = scored.find((x) => x.s.id === activeScenarioId) ?? scored[0];
  const savings = active.total - best.total;
  const isActive = best.s.id === active.s.id;

  const rationale = (() => {
    if (best.s.id === "lowest") return "Strips cost across materials, testing and packaging while retaining OEKO acceptance.";
    if (best.s.id === "value") return "Value-engineered backing and trims recover margin without visible downgrade.";
    if (best.s.id === "moq") return "Highest MOQ amortises setup and buyer holds price — highest contribution.";
    if (best.s.name.toLowerCase().includes("premium")) return "Premium tier lifts selling price faster than cost — margin expands.";
    return "Best blend of commercial acceptance and contribution margin across your active scenarios.";
  })();

  return (
    <div className="relative overflow-hidden rounded-lg border border-brand-700/30 bg-gradient-to-br from-brand-50/70 to-surface p-3.5">
      <div className="mb-2 flex items-center gap-1.5">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-brand-700 text-white">
          <Sparkles className="h-3 w-3" />
        </span>
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brand-700">
          AI Best Pick
        </div>
        <span className="ml-auto rounded-full bg-brand-700/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-brand-700">
          Confidence 86%
        </span>
      </div>
      <div className="text-[15px] font-semibold text-ink-900">{best.s.name}</div>
      <p className="mt-1 text-[11.5px] leading-snug text-ink-700">{rationale}</p>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <div className="rounded-md border border-hairline bg-surface px-2.5 py-1.5">
          <div className="text-[9.5px] uppercase tracking-wider text-ink-400">Expected margin</div>
          <div className="text-[13px] font-semibold tabular-nums text-brand-700">
            {best.marginPct.toFixed(1)}%
          </div>
        </div>
        <div className="rounded-md border border-hairline bg-surface px-2.5 py-1.5">
          <div className="text-[9.5px] uppercase tracking-wider text-ink-400">Est. savings</div>
          <div
            className={cn(
              "text-[13px] font-semibold tabular-nums",
              savings >= 0 ? "text-brand-700" : "text-red-700",
            )}
          >
            {savings >= 0 ? "+" : "−"}${Math.abs(savings).toFixed(2)} / pc
          </div>
        </div>
      </div>
      <button
        onClick={() => onSwitch(best.s.id)}
        disabled={isActive}
        className={cn(
          "mt-3 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md text-[12px] font-semibold transition-colors",
          isActive
            ? "cursor-default bg-surface-alt text-ink-500"
            : "bg-brand-700 text-white hover:bg-brand-800",
        )}
      >
        {isActive ? (
          <>
            <Check className="h-3.5 w-3.5" /> Currently active
          </>
        ) : (
          <>
            <Zap className="h-3.5 w-3.5" /> Switch to Recommended Scenario
          </>
        )}
      </button>
    </div>
  );
}



/* ============================================================
   CENTER — Cost Analysis Workspace
   Modern commercial-intelligence view. Analytical, not editable.
   ============================================================ */

type CostRow = {
  key: BucketKey;
  label: string;
  cost: number;
  color: string;
  icon: typeof Layers;
  desc: string;
};

function AnalysisCenter({
  selection,
  leftSelection,
  article,
}: {
  selection: Selection;
  leftSelection: LeftSelection;
  article: Article;
}) {
  const front = LIBRARY.find((c) => c.id === selection.frontFabric);
  const back = LIBRARY.find((c) => c.id === selection.backFabric);
  const printing = LIBRARY.find((c) => c.id === selection.printing);
  const embroidery = LIBRARY.find((c) => c.id === selection.embroidery);
  const filling = LIBRARY.find((c) => c.id === selection.filling);
  const quilting = LIBRARY.find((c) => c.id === selection.quilting);
  const piping = LIBRARY.find((c) => c.id === selection.piping);
  const zipper = LIBRARY.find((c) => c.id === selection.zipper);
  const label = LIBRARY.find((c) => c.id === selection.label);
  const hangTag = LIBRARY.find((c) => c.id === selection.hangTag);

  const material =
    (front?.cost ?? 0) + (back?.cost ?? 0) + (filling?.cost ?? 0) + (quilting?.cost ?? 0) + (piping?.cost ?? 0);
  const making =
    (printing?.cost ?? 0) + (embroidery?.cost ?? 0) + (zipper?.cost ?? 0) + (label?.cost ?? 0) + (hangTag?.cost ?? 0);
  const packaging = PACKAGING_COST[leftSelection.packaging] ?? 0;
  const testing = TESTING_COST[leftSelection.testing] ?? 0;
  const cert = CERT_COST[leftSelection.certification] ?? 0;
  const transport = TRANSPORT_COST[leftSelection.transportation] ?? 0;
  const subtotal = material + making + packaging + testing + cert + transport;
  const overheads = subtotal * 0.4 + 0.15;
  const total = subtotal + overheads;

  const target = 8.5;
  const disc = Number(leftSelection.buyerDiscount) / 100;
  const sellingPrice = target * (1 + disc);
  const marginPct = sellingPrice > 0 ? ((sellingPrice - total) / sellingPrice) * 100 : 0;
  const budgetRemaining = target - total;

  const rows: CostRow[] = [
    { key: "material", label: "Material", cost: material, color: "#05604d", icon: Layers, desc: "Fabrics, filling, quilting, piping" },
    { key: "making", label: "Making", cost: making, color: "#2d8f7a", icon: Cpu, desc: "Printing, embroidery, closures, labels" },
    { key: "packaging", label: "Packaging", cost: packaging, color: "#c69324", icon: Package, desc: "Retail-ready presentation" },
    { key: "testing", label: "Testing", cost: testing, color: "#7A5230", icon: ShieldCheck, desc: "Wash, colour fastness, REACH suite" },
    { key: "certification", label: "Certification", cost: cert, color: "#a58b3f", icon: Award, desc: "OEKO-TEX, BCI, GOTS" },
    { key: "transportation", label: "Transportation", cost: transport, color: "#4d5651", icon: Truck, desc: "Freight from origin to buyer DC" },
    { key: "overheads", label: "Overheads & Margin", cost: overheads, color: "#0a7460", icon: Percent, desc: "Overheads, commission, commercial margin" },
  ];

  const moqOptions = [500, 1000, 2500, 5000, 10000];
  const [moqSel, setMoqSel] = useState<number>(1000);
  const [openBucket, setOpenBucket] = useState<BucketKey | null>("material");
  const [openStage, setOpenStage] = useState<string | null>("raw");
  const bucketRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Rich meta used by tooltip
  const bucketMeta: Record<BucketKey, { historical: number; driver: string; largest: string }> = {
    material: { historical: material * 0.96, driver: "Cotton yarn (+4.8% MoM)", largest: front?.name ?? "Front Fabric" },
    making: { historical: making * 1.02, driver: "Digital printing setup", largest: printing?.name ?? "Printing" },
    packaging: { historical: packaging * 1.05, driver: "PVC + insert combo", largest: "Retail-ready pack" },
    testing: { historical: testing * 0.98, driver: "REACH suite frequency", largest: "Full wash suite" },
    certification: { historical: cert * 1.0, driver: "GOTS annual audit", largest: leftSelection.certification },
    transportation: { historical: transport * 0.94, driver: "Ocean freight rates", largest: leftSelection.transportation },
    overheads: { historical: overheads * 0.99, driver: "Commercial margin 25%", largest: "Margin block" },
  };

  const scrollToBucket = (key: BucketKey) => {
    setOpenBucket(key);
    requestAnimationFrame(() => {
      bucketRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="w-full space-y-6 px-6 pb-16 pt-16 xl:px-10">
          {/* ---------- 1) Commercial Summary ---------- */}
          <section>
            <SectionHeading
              eyebrow="Commercial Summary"
              title={`${article.name} · commercial snapshot`}
              hint="Signals that tell the pricing story at a glance."
            />
            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <KpiTile label="Total Cost" value={`$${total.toFixed(2)}`} sub="/ piece" tone="neutral" />
              <KpiTile label="Selling Price" value={`$${sellingPrice.toFixed(2)}`} sub={`Discount ${disc >= 0 ? "+" : ""}${(disc * 100).toFixed(0)}%`} tone="brand" />
              <KpiTile label="Target Price" value={`$${target.toFixed(2)}`} sub="Buyer target" tone="neutral" />
              <KpiTile label="Margin" value={`${marginPct.toFixed(1)}%`} sub={marginPct >= 20 ? "Healthy" : "Below plan"} tone={marginPct >= 20 ? "success" : "danger"} />
              <KpiTile label="Budget Remaining" value={`$${budgetRemaining.toFixed(2)}`} sub={budgetRemaining >= 0 ? "Within target" : "Over target"} tone={budgetRemaining >= 0 ? "success" : "danger"} icon={DollarSign} />
              <KpiTile label="Lead Time" value="42 days" sub="Sample → ship" tone="neutral" icon={Clock} />
              <KpiTile label="Confidence" value="86%" sub="High" tone="brand" icon={Activity} />
              <KpiTile label="Commercial Health" value={marginPct >= 20 ? "Strong" : marginPct >= 10 ? "Watch" : "At Risk"} sub={`${rows.filter((r) => r.cost > 0).length} cost drivers`} tone={marginPct >= 20 ? "success" : marginPct >= 10 ? "warning" : "danger"} icon={ShieldCheck} />
            </div>
          </section>

          {/* ---------- 5) Cost Contribution (interactive) ---------- */}
          <section className="rounded-2xl border border-hairline bg-surface p-5">
            <SectionHeading
              eyebrow="Cost Contribution"
              title={`Where the $${total.toFixed(2)} comes from`}
              hint="Hover a segment for details. Click to jump to that category below."
              inline
            />
            <ContributionRibbon
              rows={rows}
              total={total}
              meta={bucketMeta}
              onSelect={(k) => scrollToBucket(k)}
            />
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-4">
              {rows.map((r) => (
                <button
                  key={r.key}
                  onClick={() => scrollToBucket(r.key)}
                  className="flex items-center gap-2 text-left text-[11.5px] hover:text-brand-700"
                >
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: r.color }} />
                  <span className="flex-1 truncate text-ink-700">{r.label}</span>
                  <span className="tabular-nums font-medium text-ink-900">
                    {total > 0 ? ((r.cost / total) * 100).toFixed(1) : "0.0"}%
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* ---------- 2) Cost Breakdown ---------- */}
          <section>
            <SectionHeading
              eyebrow="Cost Breakdown"
              title="Category-level analysis"
              hint="Expand any category to see suppliers, rates and drivers."
            />
            <div className="mt-3 space-y-2">
              {rows.map((r) => (
                <div
                  key={r.key}
                  ref={(el) => { bucketRefs.current[r.key] = el; }}
                  className={cn(
                    "scroll-mt-20 rounded-xl transition-shadow",
                    openBucket === r.key && "ring-2 ring-brand-700/25",
                  )}
                >
                  <BreakdownRow
                    row={r}
                    total={total}
                    open={openBucket === r.key}
                    onToggle={() => setOpenBucket(openBucket === r.key ? null : r.key)}
                    details={
                      <BucketDetails
                        row={r}
                        front={front}
                        back={back}
                        printing={printing}
                        embroidery={embroidery}
                        filling={filling}
                        quilting={quilting}
                        piping={piping}
                        zipper={zipper}
                        label={label}
                        hangTag={hangTag}
                        leftSelection={leftSelection}
                      />
                    }
                  />
                </div>
              ))}
            </div>
          </section>


          {/* ---------- 3) Manufacturing Journey ---------- */}
          <section className="rounded-2xl border border-hairline bg-surface p-5">
            <SectionHeading
              eyebrow="Manufacturing Journey"
              title="How this cost is assembled"
              hint="Each stage adds cost and risk. Click a stage for details."
              inline
            />
            <JourneyFlow
              stages={buildJourney(front, back, printing, embroidery, transport, material)}
              openId={openStage}
              onOpen={setOpenStage}
            />
          </section>

          {/* ---------- Break-even Analysis ---------- */}
          <section className="rounded-2xl border border-hairline bg-surface p-5">
            <SectionHeading
              eyebrow="Break-even Analysis"
              title="How MOQ shifts profitability"
              hint="Larger runs amortise setup, testing and freight-per-piece. Hover the chart for details."
              inline
            />
            <BreakEvenChart
              baseCost={total}
              basePrice={sellingPrice}
              options={moqOptions}
              selected={moqSel}
              onSelect={setMoqSel}
            />
          </section>
        </div>
      </div>
    </div>
  );
}

/* ---------- Section heading ---------- */
function SectionHeading({
  eyebrow,
  title,
  hint,
  inline,
}: {
  eyebrow: string;
  title: string;
  hint?: string;
  inline?: boolean;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-4", !inline && "px-1")}>
      <div>
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-brand-700">
          {eyebrow}
        </div>
        <div className="mt-1 text-[17px] font-semibold tracking-tight text-ink-900">{title}</div>
      </div>
      {hint && <div className="max-w-[360px] text-right text-[11.5px] text-ink-500">{hint}</div>}
    </div>
  );
}

/* ---------- KPI Tile ---------- */
function KpiTile({
  label,
  value,
  sub,
  tone = "neutral",
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "brand" | "success" | "warning" | "danger";
  icon?: typeof Layers;
}) {
  const toneCls = {
    neutral: "bg-surface",
    brand: "bg-brand-50/60",
    success: "bg-brand-50/60",
    warning: "bg-gold-50",
    danger: "bg-red-50",
  }[tone];
  const subCls = {
    neutral: "text-ink-500",
    brand: "text-brand-700",
    success: "text-brand-700",
    warning: "text-gold-700",
    danger: "text-red-700",
  }[tone];
  return (
    <div className={cn("rounded-xl border border-hairline p-3", toneCls)}>
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3 text-ink-400" />}
        <span className="text-[10.5px] uppercase tracking-wider text-ink-500">{label}</span>
      </div>
      <div className="mt-1.5 text-[20px] font-semibold tracking-tight tabular-nums text-ink-900">
        {value}
      </div>
      {sub && <div className={cn("mt-0.5 text-[11px] font-medium", subCls)}>{sub}</div>}
    </div>
  );
}

/* ---------- Contribution Ribbon (stacked bar) ---------- */
function ContributionRibbon({
  rows,
  total,
  meta,
  onSelect,
}: {
  rows: CostRow[];
  total: number;
  meta?: Record<string, { historical: number; driver: string; largest: string }>;
  onSelect?: (k: BucketKey) => void;
}) {
  const nonZero = rows.filter((r) => r.cost > 0);
  const [hovered, setHovered] = useState<BucketKey | null>(null);
  const hoveredRow = nonZero.find((r) => r.key === hovered) ?? null;
  const hMeta = hovered && meta ? meta[hovered] : null;
  const pctOf = (r: CostRow) => (total > 0 ? (r.cost / total) * 100 : 0);
  const trend = hoveredRow && hMeta ? ((hoveredRow.cost - hMeta.historical) / (hMeta.historical || 1)) * 100 : 0;

  return (
    <div className="relative mt-4">
      <div className="flex h-11 w-full overflow-hidden rounded-lg border border-hairline">
        {nonZero.map((r, i) => {
          const pct = pctOf(r);
          const isHover = hovered === r.key;
          return (
            <button
              key={r.key}
              onMouseEnter={() => setHovered(r.key)}
              onMouseLeave={() => setHovered((h) => (h === r.key ? null : h))}
              onClick={() => onSelect?.(r.key)}
              className={cn(
                "group relative flex items-center justify-center transition-all",
                i > 0 && "border-l border-surface",
                isHover && "brightness-110",
              )}
              style={{ width: `${pct}%`, background: r.color }}
            >
              {pct > 8 && (
                <span className="pointer-events-none text-[10.5px] font-semibold uppercase tracking-wider text-white/95">
                  {pct.toFixed(0)}%
                </span>
              )}
              {isHover && (
                <span className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-white/70" />
              )}
            </button>
          );
        })}
      </div>

      {/* Rich tooltip */}
      {hoveredRow && (
        <div className="pointer-events-none absolute left-0 right-0 top-full z-20 mt-2 flex justify-center animate-fade-in">
          <div className="w-[320px] rounded-xl border border-hairline bg-surface p-3 shadow-[0_16px_48px_-16px_rgba(15,20,18,0.28)]">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm" style={{ background: hoveredRow.color }} />
              <span className="text-[12.5px] font-semibold text-ink-900">{hoveredRow.label}</span>
              <span className="ml-auto rounded-full bg-surface-alt px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-ink-700">
                {pctOf(hoveredRow).toFixed(1)}%
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-md bg-surface-alt/60 p-2">
                <div className="text-[9.5px] uppercase tracking-wider text-ink-500">Cost</div>
                <div className="text-[13px] font-semibold tabular-nums text-ink-900">${hoveredRow.cost.toFixed(2)}</div>
              </div>
              <div className="rounded-md bg-surface-alt/60 p-2">
                <div className="text-[9.5px] uppercase tracking-wider text-ink-500">Margin impact</div>
                <div className="text-[13px] font-semibold tabular-nums text-red-700">
                  -{(pctOf(hoveredRow) / 4).toFixed(1)} pt
                </div>
              </div>
            </div>
            {hMeta && (
              <div className="mt-2 space-y-1 text-[11px]">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-ink-500">Largest contributor</span>
                  <span className="text-right font-medium text-ink-900">{hMeta.largest}</span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-ink-500">Primary driver</span>
                  <span className="text-right text-ink-900">{hMeta.driver}</span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-ink-500">Historical avg</span>
                  <span className="text-right font-medium tabular-nums text-ink-900">
                    ${hMeta.historical.toFixed(2)}{" "}
                    <span className={cn("ml-1 text-[10px]", trend >= 0 ? "text-red-700" : "text-brand-700")}>
                      {trend >= 0 ? "+" : ""}{trend.toFixed(1)}%
                    </span>
                  </span>
                </div>
              </div>
            )}
            <div className="mt-2 border-t border-hairline pt-1.5 text-[10.5px] text-ink-500">
              Click to jump to details ↓
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ---------- Breakdown Row ---------- */
function BreakdownRow({
  row,
  total,
  open,
  onToggle,
  details,
}: {
  row: CostRow;
  total: number;
  open: boolean;
  onToggle: () => void;
  details: React.ReactNode;
}) {
  const pct = total > 0 ? (row.cost / total) * 100 : 0;
  const marginImpact = -(pct / 4); // synthetic per-category margin drag illustration
  const Icon = row.icon;
  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-md"
          style={{ background: `${row.color}18`, color: row.color }}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-ink-900">{row.label}</div>
          <div className="mt-0.5 truncate text-[11.5px] text-ink-500">{row.desc}</div>
        </div>
        <div className="hidden items-center gap-6 text-[12px] tabular-nums sm:flex">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-ink-400">Cost</div>
            <div className="font-semibold text-ink-900">${row.cost.toFixed(2)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-ink-400">Share</div>
            <div className="font-semibold text-ink-900">{pct.toFixed(1)}%</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-ink-400">Margin impact</div>
            <MarginPill pct={marginImpact} />
          </div>
        </div>
        <ChevronDown
          className={cn("h-3.5 w-3.5 shrink-0 text-ink-400 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="border-t border-hairline bg-surface-alt/30 px-4 py-4">{details}</div>
      )}
    </div>
  );
}

/* ---------- Per-bucket detail body ---------- */
function BucketDetails({
  row,
  front,
  back,
  printing,
  embroidery,
  filling,
  quilting,
  piping,
  zipper,
  label,
  hangTag,
  leftSelection,
}: {
  row: CostRow;
  front?: Component;
  back?: Component;
  printing?: Component;
  embroidery?: Component;
  filling?: Component;
  quilting?: Component;
  piping?: Component;
  zipper?: Component;
  label?: Component;
  hangTag?: Component;
  leftSelection: LeftSelection;
}) {
  const items: DetailItem[] = [];
  if (row.key === "material") {
    if (front) items.push(materialItem("Front fabric", front, `${leftSelection.gsm} GSM · ${leftSelection.yarnCount}`, "0.42 kg / pc"));
    if (back) items.push(materialItem("Back fabric", back, `${leftSelection.gsm} GSM`, "0.38 kg / pc"));
    if (filling) items.push(materialItem("Filling", filling, filling.spec, "0.28 kg / pc"));
    if (quilting) items.push(materialItem("Quilting", quilting, quilting.spec, "—"));
    if (piping) items.push(materialItem("Piping / edge", piping, piping.spec, "—"));
  } else if (row.key === "making") {
    if (printing) items.push(makingItem("Printing", printing, "Digital reactive · 2 stations"));
    if (embroidery) items.push(makingItem("Embroidery", embroidery, "In-house · Chennai"));
    if (zipper) items.push(makingItem("Zipper", zipper, "Sew-in · YKK approved"));
    if (label) items.push(makingItem("Label", label, "Ultrasonic cut"));
    if (hangTag) items.push(makingItem("Hang tag", hangTag, "Attached at pack-out"));
  } else if (row.key === "packaging") {
    items.push({
      title: "Retail-ready packaging",
      supplier: "In-house · Karur",
      unitRate: `$${row.cost.toFixed(2)} / pc`,
      spec: LEFT_VARIABLES.find((v) => v.key === "packaging")!.options.find((o) => o.id === leftSelection.packaging)?.label ?? "—",
      source: "Standard rate card",
      updated: "2 days ago",
      current: row.cost,
      historical: 0.36,
      trend: row.cost >= 0.36 ? "up" : "down",
    });
  } else if (row.key === "testing") {
    items.push({
      title: "Third-party lab",
      supplier: "Intertek Chennai",
      unitRate: `$${row.cost.toFixed(2)} / pc`,
      spec: LEFT_VARIABLES.find((v) => v.key === "testing")!.options.find((o) => o.id === leftSelection.testing)?.label ?? "—",
      source: "Buyer-approved lab list",
      updated: "This week",
      current: row.cost,
      historical: 0.4,
      trend: row.cost >= 0.4 ? "up" : "down",
    });
  } else if (row.key === "certification") {
    items.push({
      title: "Certification bundle",
      supplier: "OEKO-TEX consortium",
      unitRate: `$${row.cost.toFixed(2)} / pc`,
      spec: LEFT_VARIABLES.find((v) => v.key === "certification")!.options.find((o) => o.id === leftSelection.certification)?.label ?? "—",
      source: "Annual license amortised",
      updated: "Jan 2026",
      current: row.cost,
      historical: 0.3,
      trend: row.cost >= 0.3 ? "up" : "down",
      alerts: row.cost > 0.5 ? ["GOTS surcharge active"] : undefined,
    });
  } else if (row.key === "transportation") {
    items.push({
      title: "Ocean freight",
      supplier: "Maersk · Nhava Sheva → LA",
      unitRate: `$${row.cost.toFixed(2)} / pc`,
      spec: LEFT_VARIABLES.find((v) => v.key === "transportation")!.options.find((o) => o.id === leftSelection.transportation)?.label ?? "—",
      source: "Broker quote (weekly)",
      updated: "Yesterday",
      current: row.cost,
      historical: 0.24,
      trend: row.cost >= 0.24 ? "up" : "down",
      alerts: row.cost > 0.3 ? ["Rates rising 16% YoY"] : undefined,
    });
  } else if (row.key === "overheads") {
    items.push({
      title: "Overheads, commission & commercial margin",
      supplier: "Internal",
      unitRate: `$${row.cost.toFixed(2)} / pc`,
      spec: "12% overheads · 3% commission · 25% margin · $0.15 misc",
      source: "Company standard",
      updated: "Locked policy",
      current: row.cost,
      historical: row.cost,
      trend: "flat",
    });
  }

  if (items.length === 0) {
    return <div className="text-[12px] text-ink-500">No line items in this category.</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {items.map((it, i) => (
        <DetailCard key={i} item={it} accent={row.color} />
      ))}
    </div>
  );
}

type DetailItem = {
  title: string;
  supplier: string;
  unitRate: string;
  spec: string;
  source: string;
  updated: string;
  current: number;
  historical: number;
  trend: "up" | "down" | "flat";
  alerts?: string[];
  consumption?: string;
  certifications?: string[];
};

function materialItem(title: string, c: Component, spec: string, consumption: string): DetailItem {
  return {
    title,
    supplier: c.supplier,
    unitRate: `$${c.cost.toFixed(2)} / pc`,
    spec: `${c.name} · ${spec}`,
    source: "Approved mill rate",
    updated: "3 days ago",
    current: c.cost,
    historical: c.cost * 0.96,
    trend: "up",
    consumption,
    certifications: ["OEKO-TEX", "BCI"],
  };
}
function makingItem(title: string, c: Component, process: string): DetailItem {
  return {
    title,
    supplier: c.supplier,
    unitRate: `$${c.cost.toFixed(2)} / pc`,
    spec: `${c.name}`,
    source: process,
    updated: "This week",
    current: c.cost,
    historical: c.cost,
    trend: "flat",
  };
}

function DetailCard({ item, accent }: { item: DetailItem; accent: string }) {
  const trendIcon =
    item.trend === "up" ? <TrendingUp className="h-3 w-3" /> :
    item.trend === "down" ? <TrendingDown className="h-3 w-3" /> :
    <Minus className="h-3 w-3" />;
  const trendClass =
    item.trend === "up" ? "text-red-700" :
    item.trend === "down" ? "text-brand-700" : "text-ink-500";
  const delta = item.historical > 0 ? ((item.current - item.historical) / item.historical) * 100 : 0;
  return (
    <div className="rounded-xl border border-hairline bg-surface p-3.5">
      <div className="flex items-start gap-2">
        <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: accent }} />
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-semibold text-ink-900">{item.title}</div>
          <div className="mt-0.5 truncate text-[11px] text-ink-500">{item.spec}</div>
        </div>
        <div className="text-right tabular-nums">
          <div className="text-[13px] font-semibold text-ink-900">{item.unitRate}</div>
          <div className={cn("mt-0.5 inline-flex items-center gap-1 text-[10.5px] font-semibold", trendClass)}>
            {trendIcon}
            {delta === 0 ? "flat" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`}
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
        <MetaLine label="Supplier" value={item.supplier} />
        <MetaLine label="Source" value={item.source} />
        {item.consumption && <MetaLine label="Consumption" value={item.consumption} />}
        <MetaLine label="Last updated" value={item.updated} />
        <MetaLine label="Historical avg" value={`$${item.historical.toFixed(2)}`} />
        {item.certifications && <MetaLine label="Certifications" value={item.certifications.join(" · ")} />}
      </div>
      {item.alerts && item.alerts.length > 0 && (
        <div className="mt-3 flex items-center gap-1.5 rounded-md bg-gold-50 px-2 py-1.5 text-[11px] text-gold-700">
          <AlertCircle className="h-3 w-3" />
          {item.alerts.join(" · ")}
        </div>
      )}
    </div>
  );
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[9.5px] uppercase tracking-wider text-ink-400">{label}</span>
      <span className="truncate text-[11.5px] text-ink-700">{value}</span>
    </div>
  );
}

/* ---------- Manufacturing Journey ---------- */
type JourneyStage = {
  id: string;
  name: string;
  supplier: string;
  cost: number;
  status: "ok" | "watch" | "risk";
  detail: string;
  icon: typeof Layers;
};
function buildJourney(
  front?: Component,
  back?: Component,
  printing?: Component,
  embroidery?: Component,
  transportCost = 0,
  materialCost = 0,
): JourneyStage[] {
  return [
    { id: "raw", name: "Raw material", supplier: front?.supplier ?? "—", cost: (front?.cost ?? 0) + (back?.cost ?? 0), status: "ok", detail: "Yarn sourced and greige woven.", icon: Layers },
    { id: "dye", name: "Dyeing", supplier: "In-house · Karur", cost: 0.35, status: "watch", detail: "Reactive dye, shade approved by buyer.", icon: Palette },
    { id: "print", name: "Printing", supplier: printing?.supplier ?? "—", cost: printing?.cost ?? 0, status: "ok", detail: printing?.name ?? "No print", icon: ImageIcon },
    { id: "embr", name: "Embroidery / trim", supplier: embroidery?.supplier ?? "—", cost: embroidery?.cost ?? 0, status: "ok", detail: embroidery?.name ?? "None", icon: Sparkles },
    { id: "finish", name: "Finishing", supplier: "Chennai finishing line", cost: 0.28, status: "ok", detail: "Wash, calendar, inspection.", icon: Wand2 },
    { id: "logistics", name: "Transportation", supplier: "Maersk · Ocean FCL", cost: transportCost, status: transportCost > 0.4 ? "risk" : "watch", detail: "Origin → LA DC.", icon: Truck },
    { id: "final", name: "Landed cost", supplier: "Merch total", cost: materialCost, status: "ok", detail: "Final material cost per piece.", icon: Factory },
  ];
}
function JourneyFlow({
  stages,
  openId,
  onOpen,
}: {
  stages: JourneyStage[];
  openId: string | null;
  onOpen: (id: string | null) => void;
}) {
  const active = stages.find((s) => s.id === openId);
  return (
    <div className="mt-4">
      <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
        {stages.map((s, i) => {
          const isOpen = s.id === openId;
          const Icon = s.icon;
          const dotCls =
            s.status === "risk" ? "bg-red-500" : s.status === "watch" ? "bg-gold-500" : "bg-brand-600";
          return (
            <div key={s.id} className="flex items-center">
              <button
                onClick={() => onOpen(isOpen ? null : s.id)}
                className={cn(
                  "group flex min-w-[128px] flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors",
                  isOpen ? "border-brand-700 bg-brand-50/50" : "border-hairline bg-surface hover:border-ink-200",
                )}
              >
                <div className="flex w-full items-center gap-1.5">
                  <span className={cn("h-1.5 w-1.5 rounded-full", dotCls)} />
                  <Icon className="h-3 w-3 text-ink-400" />
                  <span className="text-[10.5px] uppercase tracking-wider text-ink-500">
                    Stage {i + 1}
                  </span>
                </div>
                <div className="text-[12.5px] font-semibold text-ink-900">{s.name}</div>
                <div className="truncate text-[10.5px] text-ink-500">{s.supplier}</div>
                <div className="mt-0.5 text-[11.5px] font-semibold tabular-nums text-ink-900">
                  ${s.cost.toFixed(2)}
                </div>
              </button>
              {i < stages.length - 1 && (
                <ArrowRight className="mx-0.5 h-3.5 w-3.5 shrink-0 text-ink-300" />
              )}
            </div>
          );
        })}
      </div>
      {active && (
        <div className="mt-4 rounded-lg border border-hairline bg-surface-alt/30 p-3.5">
          <div className="flex items-center gap-2">
            <active.icon className="h-3.5 w-3.5 text-brand-700" />
            <span className="text-[12.5px] font-semibold text-ink-900">{active.name}</span>
            <span className="text-[11px] text-ink-500">· {active.supplier}</span>
            <span className="ml-auto text-[12px] font-semibold tabular-nums text-ink-900">
              ${active.cost.toFixed(2)}
            </span>
          </div>
          <p className="mt-1.5 text-[12px] text-ink-500">{active.detail}</p>
        </div>
      )}
    </div>
  );
}

/* ---------- Input Intelligence card ---------- */
function InputCard({
  label,
  current,
  unit,
  prevAvg,
  sixMo,
  twelveMo,
  trend,
  delta,
  impact,
  spark,
  quotes,
}: {
  label: string;
  current: number;
  unit: string;
  prevAvg: number;
  sixMo: number;
  twelveMo: number;
  trend: "up" | "down";
  delta: string;
  impact: string;
  spark: number[];
  quotes: { name: string; value: number; note?: string }[];
}) {
  const w = 220;
  const h = 44;
  const min = Math.min(...spark);
  const max = Math.max(...spark);
  const path = spark
    .map((v, i) => {
      const x = (i / (spark.length - 1)) * w;
      const y = h - ((v - min) / Math.max(0.0001, max - min)) * h;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const trendIsUp = trend === "up";
  return (
    <div className="rounded-xl border border-hairline bg-surface p-3.5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-semibold text-ink-900">{label}</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-[20px] font-semibold tabular-nums text-ink-900">
              {current.toFixed(2)}
            </span>
            <span className="text-[10.5px] text-ink-500">{unit}</span>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
            trendIsUp ? "bg-red-50 text-red-700" : "bg-brand-50 text-brand-700",
          )}
        >
          {trendIsUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {delta}
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-11 w-full">
        <path
          d={`${path} L ${w} ${h} L 0 ${h} Z`}
          fill={trendIsUp ? "rgba(184,58,46,0.08)" : "rgba(5,96,77,0.08)"}
        />
        <path d={path} fill="none" stroke={trendIsUp ? "#b83a2e" : "#05604d"} strokeWidth="1.4" />
      </svg>
      <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10.5px]">
        <StatMini label="Prev avg" value={prevAvg.toFixed(2)} />
        <StatMini label="6-mo" value={sixMo.toFixed(2)} />
        <StatMini label="12-mo" value={twelveMo.toFixed(2)} />
      </div>
      <div className="mt-3 border-t border-hairline pt-2.5">
        <div className="text-[10px] uppercase tracking-wider text-ink-400">Vendor quotes</div>
        <div className="mt-1 space-y-1">
          {quotes.map((q) => (
            <div key={q.name} className="flex items-center gap-2 text-[11.5px]">
              <span className="flex-1 truncate text-ink-700">{q.name}</span>
              {q.note && (
                <span className="rounded bg-ink-100 px-1 text-[9px] uppercase tracking-wider text-ink-500">
                  {q.note}
                </span>
              )}
              <span className="tabular-nums font-semibold text-ink-900">{q.value.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-lg bg-surface-alt/60 px-2.5 py-1.5">
        <span className="text-[10.5px] uppercase tracking-wider text-ink-500">Commercial impact</span>
        <span className={cn("text-[12px] font-semibold tabular-nums", trendIsUp ? "text-red-700" : "text-brand-700")}>
          {impact}
        </span>
      </div>
    </div>
  );
}
function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-surface-alt/70 px-2 py-1">
      <div className="text-[9.5px] uppercase tracking-wider text-ink-400">{label}</div>
      <div className="text-[12px] font-semibold tabular-nums text-ink-900">{value}</div>
    </div>
  );
}

/* ---------- Break-even chart (interactive) ----------
   Cost model: cost/pc = variableCost + fixedSetup/moq
     - variableCost = ~62% of the current landed cost (materials, direct labour, freight per pc)
     - fixedSetup   = $2,400 (patterning, sampling, lab dips, testing suite, cert amortisation)
   Price model: buyer expects small tier concessions at 2.5k / 5k / 10k.
*/
function BreakEvenChart({
  baseCost,
  basePrice,
  options,
  selected,
  onSelect,
}: {
  baseCost: number;
  basePrice: number;
  options: number[];
  selected: number;
  onSelect: (v: number) => void;
}) {
  const variableCost = baseCost * 0.62;
  const fixedSetup = 2400;
  const costAt = (moq: number) => variableCost + fixedSetup / moq;
  const priceAt = (moq: number) => {
    const disc = moq >= 10000 ? 0.08 : moq >= 5000 ? 0.05 : moq >= 2500 ? 0.025 : 0;
    return basePrice * (1 - disc);
  };

  // Dense curve for the chart itself
  const minMoq = 250;
  const maxMoq = Math.max(10000, ...options);
  const curve = useMemo(() => {
    const N = 120;
    const arr: { moq: number; cost: number; price: number }[] = [];
    // log-spaced sampling so the low-MOQ curve reads clearly
    const lo = Math.log(minMoq);
    const hi = Math.log(maxMoq);
    for (let i = 0; i < N; i++) {
      const m = Math.round(Math.exp(lo + (hi - lo) * (i / (N - 1))));
      arr.push({ moq: m, cost: costAt(m), price: priceAt(m) });
    }
    return arr;
  }, [variableCost, basePrice, minMoq, maxMoq]);

  // Break-even MOQ (analytical: price(moq) = variableCost + fixedSetup / moq)
  // Assume price flat within a tier; solve moq = fixedSetup / (price - variableCost).
  const beMoq = useMemo(() => {
    const p0 = priceAt(1000);
    if (p0 - variableCost <= 0) return null;
    const m = Math.ceil(fixedSetup / (p0 - variableCost));
    return m;
  }, [variableCost, basePrice]);

  // Best commercial MOQ across the pill options (highest total contribution profit)
  const best = useMemo(() => {
    return [...options]
      .map((m) => ({ moq: m, margin: priceAt(m) - costAt(m), profit: (priceAt(m) - costAt(m)) * m }))
      .sort((a, b) => b.profit - a.profit)[0];
  }, [options, variableCost, basePrice]);

  const cur = { moq: selected, cost: costAt(selected), price: priceAt(selected) };
  const first = { moq: options[0], cost: costAt(options[0]), price: priceAt(options[0]) };
  const curMargin = cur.price - cur.cost;
  const firstMargin = first.price - first.cost;

  return (
    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {options.map((m) => {
            const active = m === selected;
            return (
              <button
                key={m}
                onClick={() => onSelect(m)}
                className={cn(
                  "rounded-full border px-3 py-1 text-[11.5px] font-medium transition-colors",
                  active
                    ? "border-brand-700 bg-brand-700 text-white"
                    : "border-hairline bg-surface text-ink-700 hover:bg-surface-alt",
                )}
              >
                {m.toLocaleString()} pcs
              </button>
            );
          })}
        </div>
        <BreakEvenSVG
          curve={curve}
          options={options}
          selectedMoq={selected}
          onSelect={onSelect}
          breakEvenMoq={beMoq}
        />
      </div>
      <div className="flex flex-col gap-2">
        <div className="rounded-xl border border-hairline bg-brand-50/50 p-3.5">
          <div className="text-[10.5px] uppercase tracking-wider text-brand-700">Selected MOQ</div>
          <div className="mt-1 text-[22px] font-semibold tabular-nums text-ink-900">
            {selected.toLocaleString()} <span className="text-[12px] font-normal text-ink-500">pcs</span>
          </div>
          <div className="mt-3 space-y-1.5">
            <MiniStat label="Selling Price" value={`$${cur.price.toFixed(2)}`} />
            <MiniStat label="Cost / piece" value={`$${cur.cost.toFixed(2)}`} />
            <MiniStat label="Margin / piece" value={`$${curMargin.toFixed(2)}`} tone={curMargin > 0 ? "success" : "danger"} />
            <MiniStat label="Order profit" value={`$${(curMargin * selected).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} tone={curMargin > 0 ? "success" : "danger"} />
            <MiniStat
              label={`Δ vs ${options[0].toLocaleString()} MOQ`}
              value={`${curMargin - firstMargin >= 0 ? "+" : ""}$${(curMargin - firstMargin).toFixed(2)}`}
              tone={curMargin - firstMargin >= 0 ? "success" : "danger"}
            />
          </div>
        </div>
        <div className="rounded-xl border border-hairline bg-surface p-3">
          <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-ink-500">
            <Target className="h-3 w-3" /> Break-even MOQ
          </div>
          <div className="mt-1 text-[13px] font-semibold text-ink-900">
            {beMoq ? `${beMoq.toLocaleString()} pcs` : "Above tested range"}
          </div>
          <div className="text-[11px] text-ink-500">Where setup amortises fully</div>
        </div>
        <div className="rounded-xl border border-hairline bg-surface p-3">
          <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-ink-500">
            <Zap className="h-3 w-3" /> Best commercial MOQ
          </div>
          <div className="mt-1 text-[13px] font-semibold text-ink-900">{best.moq.toLocaleString()} pcs</div>
          <div className="text-[11px] text-ink-500">
            ${best.margin.toFixed(2)} / pc · ${best.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })} order profit
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "danger";
}) {
  const toneCls = tone === "success" ? "text-brand-700" : tone === "danger" ? "text-red-700" : "text-ink-900";
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[11px] text-ink-500">{label}</span>
      <span className={cn("text-[13px] font-semibold tabular-nums", toneCls)}>{value}</span>
    </div>
  );
}

function BreakEvenSVG({
  curve,
  options,
  selectedMoq,
  onSelect,
  breakEvenMoq,
}: {
  curve: { moq: number; cost: number; price: number }[];
  options: number[];
  selectedMoq: number;
  onSelect: (v: number) => void;
  breakEvenMoq: number | null;
}) {
  const W = 620;
  const H = 260;
  const pad = { l: 44, r: 16, t: 14, b: 34 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;

  const moqs = curve.map((d) => d.moq);
  const logMin = Math.log(moqs[0]);
  const logMax = Math.log(moqs[moqs.length - 1]);
  const values = curve.flatMap((d) => [d.cost, d.price]);
  const yMin = Math.min(...values) * 0.9;
  const yMax = Math.max(...values) * 1.08;

  const xOf = (moq: number) =>
    pad.l + ((Math.log(moq) - logMin) / (logMax - logMin)) * innerW;
  const yOf = (v: number) =>
    pad.t + innerH - ((v - yMin) / Math.max(0.0001, yMax - yMin)) * innerH;

  const priceLine = curve.map((d, i) => `${i === 0 ? "M" : "L"} ${xOf(d.moq)} ${yOf(d.price)}`).join(" ");
  const costLine = curve.map((d, i) => `${i === 0 ? "M" : "L"} ${xOf(d.moq)} ${yOf(d.cost)}`).join(" ");

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    if (px < pad.l || px > W - pad.r) {
      setHoverIdx(null);
      return;
    }
    // find nearest curve index
    let bestI = 0;
    let bestD = Infinity;
    for (let i = 0; i < curve.length; i++) {
      const d = Math.abs(xOf(curve[i].moq) - px);
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    }
    setHoverIdx(bestI);
  };

  const hover = hoverIdx != null ? curve[hoverIdx] : null;

  // gridline MOQs for x-axis labels
  const xTicks = [250, 500, 1000, 2500, 5000, 10000].filter((m) => m >= moqs[0] && m <= moqs[moqs.length - 1]);

  return (
    <div className="rounded-xl border border-hairline bg-surface p-3">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="h-[260px] w-full cursor-crosshair"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* Y grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const yv = yMin + (yMax - yMin) * (1 - t);
          const yy = pad.t + innerH * t;
          return (
            <g key={t}>
              <line x1={pad.l} y1={yy} x2={W - pad.r} y2={yy} stroke="rgba(15,20,18,0.06)" />
              <text x={pad.l - 6} y={yy + 3} textAnchor="end" fontSize="9" fill="#6b736e">
                ${yv.toFixed(2)}
              </text>
            </g>
          );
        })}
        {/* X ticks */}
        {xTicks.map((m) => (
          <g key={m}>
            <line x1={xOf(m)} y1={pad.t + innerH} x2={xOf(m)} y2={pad.t + innerH + 4} stroke="#c9cfcc" />
            <text x={xOf(m)} y={H - 18} textAnchor="middle" fontSize="10" fill="#6b736e">
              {m >= 1000 ? `${m / 1000}k` : m}
            </text>
          </g>
        ))}
        <text x={pad.l + innerW / 2} y={H - 4} textAnchor="middle" fontSize="9.5" fill="#9aa39e">
          MOQ (pieces, log scale)
        </text>
        {/* Margin gap area */}
        <path
          d={`${curve.map((d, i) => `${i === 0 ? "M" : "L"} ${xOf(d.moq)} ${yOf(d.price)}`).join(" ")} ${curve
            .slice()
            .reverse()
            .map((d) => `L ${xOf(d.moq)} ${yOf(d.cost)}`)
            .join(" ")} Z`}
          fill="rgba(5,96,77,0.10)"
        />
        {/* Cost curve */}
        <path d={costLine} fill="none" stroke="#b83a2e" strokeWidth="1.8" />
        {/* Price curve */}
        <path d={priceLine} fill="none" stroke="#05604d" strokeWidth="1.8" />

        {/* Break-even marker */}
        {breakEvenMoq && breakEvenMoq >= moqs[0] && breakEvenMoq <= moqs[moqs.length - 1] && (
          <g>
            <line
              x1={xOf(breakEvenMoq)}
              y1={pad.t}
              x2={xOf(breakEvenMoq)}
              y2={pad.t + innerH}
              stroke="#c69324"
              strokeDasharray="2 3"
              strokeWidth="1"
            />
            <text
              x={xOf(breakEvenMoq)}
              y={pad.t - 3}
              textAnchor="middle"
              fontSize="9.5"
              fill="#8a6a1e"
              fontWeight={600}
            >
              Break-even · {breakEvenMoq.toLocaleString()}
            </text>
          </g>
        )}

        {/* Selectable MOQ option markers */}
        {options.map((m) => {
          const active = m === selectedMoq;
          const p = curve.reduce((a, b) => (Math.abs(b.moq - m) < Math.abs(a.moq - m) ? b : a));
          return (
            <g key={m} onClick={() => onSelect(m)} className="cursor-pointer">
              <circle cx={xOf(m)} cy={yOf(p.cost)} r={active ? 4.5 : 3} fill="#b83a2e" stroke="#fff" strokeWidth={active ? 1.5 : 0.5} />
              <circle cx={xOf(m)} cy={yOf(p.price)} r={active ? 4.5 : 3} fill="#05604d" stroke="#fff" strokeWidth={active ? 1.5 : 0.5} />
            </g>
          );
        })}

        {/* Selected vertical */}
        <line
          x1={xOf(selectedMoq)}
          y1={pad.t}
          x2={xOf(selectedMoq)}
          y2={pad.t + innerH}
          stroke="rgba(5,96,77,0.30)"
          strokeDasharray="3 3"
        />

        {/* Hover overlay */}
        {hover && (
          <g pointerEvents="none">
            <line x1={xOf(hover.moq)} y1={pad.t} x2={xOf(hover.moq)} y2={pad.t + innerH} stroke="rgba(15,20,18,0.35)" strokeWidth="1" />
            <circle cx={xOf(hover.moq)} cy={yOf(hover.cost)} r={3.5} fill="#b83a2e" stroke="#fff" strokeWidth={1.2} />
            <circle cx={xOf(hover.moq)} cy={yOf(hover.price)} r={3.5} fill="#05604d" stroke="#fff" strokeWidth={1.2} />
            {(() => {
              const margin = hover.price - hover.cost;
              const profit = margin * hover.moq;
              const tw = 168;
              const th = 78;
              let tx = xOf(hover.moq) + 10;
              if (tx + tw > W - pad.r) tx = xOf(hover.moq) - tw - 10;
              const ty = pad.t + 6;
              return (
                <g>
                  <rect x={tx} y={ty} width={tw} height={th} rx={6} fill="#0f1416" opacity={0.94} />
                  <text x={tx + 10} y={ty + 15} fontSize="10.5" fill="#e8ece9" fontWeight={600}>
                    MOQ {hover.moq.toLocaleString()} pcs
                  </text>
                  <text x={tx + 10} y={ty + 31} fontSize="10" fill="#f3e6b7">
                    Selling  ${hover.price.toFixed(2)}
                  </text>
                  <text x={tx + 10} y={ty + 45} fontSize="10" fill="#f5b8ae">
                    Cost/pc  ${hover.cost.toFixed(2)}
                  </text>
                  <text x={tx + 10} y={ty + 59} fontSize="10" fill={margin >= 0 ? "#9be0c8" : "#f5b8ae"}>
                    Margin  ${margin.toFixed(2)} / pc
                  </text>
                  <text x={tx + 10} y={ty + 72} fontSize="10" fill="#cfd3d1">
                    Order profit  ${profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </text>
                </g>
              );
            })()}
          </g>
        )}
      </svg>
      <div className="mt-1 flex items-center justify-center gap-4 text-[10.5px] text-ink-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-3 rounded-sm" style={{ background: "#05604d" }} /> Selling price
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-3 rounded-sm" style={{ background: "#b83a2e" }} /> Cost / piece
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm" style={{ background: "rgba(5,96,77,0.20)" }} /> Margin gap
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm" style={{ background: "#c69324" }} /> Break-even
        </span>
      </div>
    </div>
  );
}


/* ---------- Insight card ---------- */
function InsightCard({
  tone,
  icon: Icon,
  category,
  title,
  body,
  impact,
}: {
  tone: "brand" | "success" | "warning" | "risk";
  icon: typeof Layers;
  category: string;
  title: string;
  body: string;
  impact: string;
}) {
  const toneMap = {
    brand: { bar: "#0a7460", chip: "bg-brand-50 text-brand-700" },
    success: { bar: "#05604d", chip: "bg-brand-50 text-brand-700" },
    warning: { bar: "#c69324", chip: "bg-gold-50 text-gold-700" },
    risk: { bar: "#b83a2e", chip: "bg-red-50 text-red-700" },
  }[tone];
  return (
    <div className="relative overflow-hidden rounded-xl border border-hairline bg-surface p-3.5">
      <span className="absolute left-0 top-0 h-full w-1" style={{ background: toneMap.bar }} />
      <div className="flex items-start gap-2 pl-2">
        <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md" style={{ background: `${toneMap.bar}18`, color: toneMap.bar }}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-400">
            {category}
          </div>
          <div className="mt-0.5 text-[13px] font-semibold text-ink-900">{title}</div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-500">{body}</p>
        </div>
      </div>
      <div className="mt-2.5 flex justify-end pl-2">
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", toneMap.chip)}>
          {impact}
        </span>
      </div>
    </div>
  );
}


/* ============================================================
   RIGHT PANEL — matches the "Overview / Total Cost / Enquiry / Scenarios" mock
   ============================================================ */
type RightView = "overview" | "insights" | "risks" | "chat";

function RightOverviewPanel({
  selection,
  leftSelection,
  scenarios,
  activeScenarioId,
  onSelectScenario,
  onCompare,
  article,
  lastChangedKey,
  onApplyRecommendation,
  srfId,
  collapsed,
  setCollapsed,
}: {
  selection: Selection;
  leftSelection: LeftSelection;
  scenarios: Scenario[];
  activeScenarioId: string;
  onSelectScenario: (id: string) => void;
  onCompare: () => void;
  article: Article;
  lastChangedKey: ConfigKey | null;
  onApplyRecommendation: (k: ConfigKey, id: string) => void;
  srfId: string;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}) {


  const [view, setView] = useState<RightView>("overview");

  const breakdown = useMemo(() => {
    const front = LIBRARY.find((c) => c.id === selection.frontFabric);
    const back = LIBRARY.find((c) => c.id === selection.backFabric);
    const printing = LIBRARY.find((c) => c.id === selection.printing);
    const embroidery = LIBRARY.find((c) => c.id === selection.embroidery);
    const material = (front?.cost ?? 0) + (back?.cost ?? 0);
    const making = (printing?.cost ?? 0) + (embroidery?.cost ?? 0);
    const packaging = PACKAGING_COST[leftSelection.packaging] ?? 0;
    const testing = TESTING_COST[leftSelection.testing] ?? 0;
    const cert = CERT_COST[leftSelection.certification] ?? 0;
    const transport = TRANSPORT_COST[leftSelection.transportation] ?? 0;
    const subtotal = material + making + packaging + testing + cert + transport;
    const overheads = subtotal * 0.12 + subtotal * 0.03 + subtotal * 0.25 + 0.15;
    const total = subtotal + overheads;
    return { material, making, packaging, testing, cert, transport, overheads, total };
  }, [selection, leftSelection]);
  const totalCost = breakdown.total;
  const moqLabel =
    LEFT_VARIABLES.find((v) => v.key === "moq")!.options.find((o) => o.id === leftSelection.moq)?.label ?? "—";
  const target = 8.5;
  const disc = Number(leftSelection.buyerDiscount) / 100;
  const sellingPrice = target * (1 + disc);
  const margin = sellingPrice > 0 ? ((sellingPrice - totalCost) / sellingPrice) * 100 : 0;


  return (
    <div className="flex h-full min-h-0">
      {/* Panel body */}
      {!collapsed && (
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto">
          {view === "overview" && (
            <>
              {/* Header */}
              <div className="flex items-center gap-2 border-b border-hairline px-4 py-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-alt">
                  <Grid3x3 className="h-3.5 w-3.5 text-ink-700" />
                </div>
                <span className="text-[13px] font-medium text-ink-900">Overview</span>
                <button
                  onClick={() => setCollapsed(true)}
                  className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded text-ink-400 hover:bg-surface-alt hover:text-ink-900"
                >
                  <PanelRightClose className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Total Cost + Selling Price */}
              <div className="border-b border-hairline p-4">
                <div key={`price-${activeScenarioId}-${totalCost.toFixed(2)}`} className="animate-fade-in">
                  <SellingPriceCard
                    totalCost={totalCost}
                    target={target}
                    sellingPrice={sellingPrice}
                    margin={margin}
                    moqLabel={moqLabel}
                    breakdown={breakdown}
                  />
                </div>
              </div>

              {/* Product Details — compact w/ expand */}
              <div className="border-b border-hairline p-4">
                <div key={`pd-${activeScenarioId}`} className="animate-fade-in">
                  <ProductDetails
                    article={article}
                    srfId={srfId}
                    leftSelection={leftSelection}
                    currentScenarioName={scenarios.find((s) => s.id === activeScenarioId)?.name ?? "Current"}
                  />
                </div>
              </div>


              {/* Scenarios */}
              <div className="border-b border-hairline p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[10.5px] uppercase tracking-[0.14em] text-ink-500">Scenarios</div>
                  <button
                    onClick={onCompare}
                    className="inline-flex items-center gap-1 text-[11.5px] text-ink-700 hover:text-brand-700"
                  >
                    <GitCompare className="h-3 w-3" /> Compare
                  </button>
                </div>
                <div className="space-y-1.5">
                  {scenarios.map((s) => {
                    const active = s.id === activeScenarioId;
                    return (
                      <button
                        key={s.id}
                        onClick={() => onSelectScenario(s.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors",
                          active
                            ? "border-brand-700/50 bg-brand-50/60"
                            : "border-hairline bg-surface hover:bg-surface-alt/60",
                        )}
                      >
                        <span className={cn("h-2 w-2 rounded-full", active ? "bg-brand-700" : "bg-ink-200")} />
                        <span className="flex-1 truncate text-[12.5px] font-medium text-ink-900">{s.name}</span>
                        {active ? (
                          <span className="rounded-sm bg-brand-100 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-brand-700">
                            ACTIVE
                          </span>
                        ) : (
                          (s.tag === "ai" || s.tag === "template") && <Sparkles className="h-3 w-3 text-brand-700" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* AI Guidance — contextual */}
              <div className="border-b border-hairline p-4">
                <AIGuidance
                  selection={selection}
                  leftSelection={leftSelection}
                  lastChangedKey={lastChangedKey}
                />
              </div>

              {/* AI Best Pick */}
              <div className="p-4">
                <AIBestPickCard
                  scenarios={scenarios}
                  activeScenarioId={activeScenarioId}
                  onSwitch={onSelectScenario}
                />
              </div>

            </>
          )}

          {view === "insights" && (
            <RecommendationsView
              selection={selection}
              onApply={(k, id) => onApplyRecommendation(k, id)}
            />
          )}
          {view === "risks" && <RisksView selection={selection} />}
          {view === "chat" && <ChatView />}


        </div>
      )}

      {/* Icon rail */}
      <div className="flex w-11 shrink-0 flex-col items-center gap-1 border-l border-hairline bg-surface py-3">
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="mb-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-500 hover:bg-surface-alt hover:text-ink-900"
            title="Expand"
          >
            <PanelRightClose className="h-3.5 w-3.5 rotate-180" />
          </button>
        )}
        <RailBtn active={view === "overview"} onClick={() => { setView("overview"); setCollapsed(false); }} icon={Grid3x3} label="Overview" />
        <RailBtn active={view === "insights"} onClick={() => { setView("insights"); setCollapsed(false); }} icon={Lightbulb} label="Insights" />
        <RailBtn active={view === "risks"} onClick={() => { setView("risks"); setCollapsed(false); }} icon={AlertCircle} label="Risks" />
        <RailBtn active={view === "chat"} onClick={() => { setView("chat"); setCollapsed(false); }} icon={MessageSquare} label="Chat" />
      </div>
    </div>
  );
}

function RailBtn({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Grid3x3;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors",
        active ? "bg-brand-50 text-brand-700 ring-1 ring-brand-700/20" : "text-ink-500 hover:bg-surface-alt hover:text-ink-900",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

/* ============================================================
   COMPARE OVERLAY
   ============================================================ */
function CompareOverlay({
  scenarios,
  activeId,
  onPick,
  onClose,
}: {
  scenarios: Scenario[];
  activeId: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const rest = scenarios.filter((s) => s.id !== activeId);
    return [activeId, ...rest.slice(0, 2).map((s) => s.id)].slice(0, 3);
  });
  const toggle = (id: string) =>
    setSelectedIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < 4 ? [...cur, id] : cur,
    );

  const cols = selectedIds
    .map((id) => scenarios.find((s) => s.id === id))
    .filter(Boolean) as Scenario[];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas">
      {/* Page header — mimics a real page, not a modal */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-hairline bg-surface px-6">
        <button
          onClick={onClose}
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[12.5px] text-ink-500 hover:bg-surface-alt hover:text-ink-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to workspace
        </button>
        <span className="text-ink-300">/</span>
        <div className="flex items-center gap-2">
          <GitCompare className="h-4 w-4 text-ink-700" />
          <div className="text-[14px] font-medium text-ink-900">Compare Scenarios</div>
          <span className="text-[12px] text-ink-500">· {cols.length} selected</span>
        </div>
        <button
          onClick={onClose}
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline bg-surface px-2.5 text-[12px] font-medium text-ink-700 hover:bg-surface-alt"
        >
          <X className="h-3.5 w-3.5" /> Close
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-8 py-8">
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-ink-500">Compare</div>
            <h1 className="mt-1 text-[22px] font-medium tracking-tight text-ink-900">Scenario side-by-side</h1>
            <p className="mt-1 text-[13px] text-ink-500">Pick up to 4 scenarios to line up their cost, deltas and component picks. Promote any scenario to become the active configuration.</p>
          </div>


        {/* Scenario chooser */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-hairline px-5 py-2.5">
          <span className="mr-1 text-[11px] uppercase tracking-[0.14em] text-ink-400">Include</span>
          {scenarios.map((s) => {
            const on = selectedIds.includes(s.id);
            return (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] font-medium",
                  on ? "border-brand-700 bg-brand-50 text-brand-700" : "border-hairline bg-surface text-ink-500 hover:text-ink-900",
                )}
              >
                {on && <Check className="h-3 w-3" />}
                {s.name}
              </button>
            );
          })}
        </div>

        {/* Comparison table */}
        <div className="flex-1 overflow-auto">
          <div
            className="grid min-w-full"
            style={{ gridTemplateColumns: `220px repeat(${cols.length}, minmax(200px, 1fr))` }}
          >
            {/* Header row */}
            <div className="sticky top-0 z-10 border-b border-hairline bg-surface px-4 py-3 text-[11px] uppercase tracking-[0.12em] text-ink-500" />
            {cols.map((s) => (
              <div key={s.id} className="sticky top-0 z-10 border-b border-l border-hairline bg-[#EEF6F1] px-4 py-3">
                <div className="text-[13px] font-medium text-ink-900">{s.name}</div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="tabular-nums text-[13px] font-medium text-brand-700">
                    ${sumCost(s.selection).toFixed(2)}
                  </span>
                  <span className="text-[10.5px] text-ink-500">/ pc</span>
                </div>
              </div>
            ))}

            {/* Metric rows */}
            {(
              [
                ["Total cost", (s: Scenario) => `$${sumCost(s.selection).toFixed(2)}`],
                ["Cost delta vs Current", (s: Scenario, base: Scenario) => {
                  const d = sumCost(s.selection) - sumCost(base.selection);
                  return `${d >= 0 ? "+" : "−"}$${Math.abs(d).toFixed(2)}`;
                }],
                ["Margin (target $8.50)", (s: Scenario) => `${(((8.5 - sumCost(s.selection)) / 8.5) * 100).toFixed(1)}%`],
              ] as [string, (s: Scenario, base: Scenario) => string][]
            ).map(([label, fn]) => (
              <RowGroup key={label} label={label}>
                {cols.map((s) => (
                  <div key={s.id} className="border-b border-l border-hairline bg-[#F4FAF6] px-4 py-2.5 text-[12.5px] font-medium tabular-nums text-ink-900">
                    {fn(s, scenarios.find((x) => x.id === "current") ?? scenarios[0])}
                  </div>
                ))}
              </RowGroup>
            ))}

            {/* Component-level rows */}
            {CONFIG_MAP.map((cfg) => (
              <RowGroup key={cfg.key} label={cfg.label}>
                {cols.map((s) => {
                  const comp = LIBRARY.find((c) => c.id === s.selection[cfg.key]);
                  return (
                    <div key={s.id} className="flex items-center gap-2 border-b border-l border-hairline bg-[#F4FAF6] px-4 py-2 text-[12px]">
                      <div className="h-4 w-4 shrink-0 rounded border border-hairline" style={{ background: comp?.swatch ?? "#F1EEE6" }} />
                      <div className="min-w-0 flex-1 truncate text-ink-900">{comp?.name ?? <span className="text-ink-400">—</span>}</div>
                      <span className="tabular-nums text-[11px] text-ink-500">${(comp?.cost ?? 0).toFixed(2)}</span>
                    </div>
                  );
                })}
              </RowGroup>
            ))}


            {/* Promote row */}
            <div className="border-t border-hairline bg-surface-alt/40 px-4 py-3 text-[11.5px] font-medium text-ink-500">
              Promote to active
            </div>
            {cols.map((s) => (
              <div key={s.id} className="border-l border-t border-hairline bg-surface-alt/40 px-4 py-3">
                <button
                  onClick={() => onPick(s.id)}
                  className={cn(
                    "inline-flex w-full items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                    s.id === activeId
                      ? "border border-hairline bg-surface text-ink-500"
                      : "bg-brand-700 text-white hover:bg-brand-800",
                  )}
                  disabled={s.id === activeId}
                >
                  {s.id === activeId ? "Current active" : <><ArrowRight className="h-3 w-3" /> Make active</>}
                </button>
              </div>
            ))}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}


function RowGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <div className="border-b border-hairline bg-surface px-4 py-2.5 text-[11.5px] font-medium text-ink-500">{label}</div>
      {/* children take remaining columns */}
      {children}
    </>
  );
}

/* ============================================================
   HELPERS
   ============================================================ */
function sumCost(sel: Selection): number {
  return Object.values(sel).reduce((sum, id) => {
    const c = LIBRARY.find((x) => x.id === id);
    return sum + (c?.cost ?? 0);
  }, 0);
}

/* ============================================================
   RIGHT-PANEL VIEWS — Recommendations · Risks · Chat
   (Rebuilt in the previous UI's spirit, self-contained.)
   ============================================================ */

function RecommendationsView({
  selection,
  onApply,
}: {
  selection: Selection;
  onApply: (k: ConfigKey, id: string) => void;
}) {
  const recs = (Object.keys(AI_RECOMMENDED) as ConfigKey[])
    .map((k) => {
      const ai = AI_RECOMMENDED[k]!;
      const meta = CONFIG_MAP.find((c) => c.key === k)!;
      const current = LIBRARY.find((c) => c.id === selection[k]);
      const target = LIBRARY.find((c) => c.id === ai.id);
      const delta = (target?.cost ?? 0) - (current?.cost ?? 0);
      const applied = selection[k] === ai.id;
      return { k, meta, ai, current, target, delta, applied };
    })
    .filter((r) => r.target);

  // Group into categories
  const CATEGORY_FOR: Record<ConfigKey, "materials" | "making" | "trims" | "general"> = {
    frontFabric: "materials",
    backFabric: "materials",
    filling: "materials",
    quilting: "making",
    piping: "making",
    printing: "making",
    embroidery: "making",
    applique: "making",
    zipper: "trims",
    label: "trims",
    hangTag: "trims",
    trim: "trims",
  };
  const GROUPS: { id: "materials" | "making" | "trims" | "general"; label: string; icon: typeof Layers }[] = [
    { id: "materials", label: "Materials", icon: Layers },
    { id: "making", label: "Making", icon: Cpu },
    { id: "trims", label: "Trims & Labels", icon: Tag },
    { id: "general", label: "General & Transport", icon: Truck },
  ];
  const grouped = GROUPS.map((g) => ({
    ...g,
    items: recs.filter((r) => CATEGORY_FOR[r.k] === g.id),
  })).filter((g) => g.items.length > 0);

  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(GROUPS.map((g, i) => [g.id, i === 0])),
  );

  const pending = recs.filter((r) => !r.applied).length;

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-50">
          <Lightbulb className="h-3.5 w-3.5 text-brand-700" />
        </div>
        <div>
          <div className="text-[13px] font-medium text-ink-900">AI Recommendations</div>
          <div className="text-[10.5px] text-ink-500">{pending} pending · grouped by area</div>
        </div>
      </div>
      <div className="space-y-2">
        {grouped.map((g) => {
          const isOpen = open[g.id];
          const groupPending = g.items.filter((r) => !r.applied).length;
          const GIcon = g.icon;
          return (
            <div key={g.id} className="overflow-hidden rounded-lg border border-hairline bg-surface">
              <button
                onClick={() => setOpen((o) => ({ ...o, [g.id]: !isOpen }))}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-surface-alt/40"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-brand-50 text-brand-700">
                  <GIcon className="h-3 w-3" />
                </span>
                <span className="flex-1 text-[12.5px] font-medium text-ink-900">{g.label}</span>
                <span className="rounded-full bg-surface-alt px-1.5 py-0.5 text-[10px] font-semibold text-ink-500">
                  {groupPending} / {g.items.length}
                </span>
                <ChevronDown className={cn("h-3.5 w-3.5 text-ink-400 transition-transform", isOpen && "rotate-180")} />
              </button>
              {isOpen && (
                <div className="animate-fade-in space-y-2 border-t border-hairline p-2.5">
                  {g.items.map((r) => (
                    <div
                      key={r.k}
                      className={cn(
                        "rounded-lg border p-2.5",
                        r.applied ? "border-brand-700/40 bg-brand-50/40" : "border-hairline bg-surface",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border border-hairline" style={{ background: r.target?.swatch }} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] uppercase tracking-[0.1em] text-ink-400">{r.meta.label}</span>
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-brand-50 to-brand-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-brand-700 ring-1 ring-brand-700/10">
                              <Sparkles className="h-2 w-2" /> AI
                            </span>
                          </div>
                          <div className="mt-0.5 text-[12px] font-medium text-ink-900">
                            Switch to <span className="text-brand-700">{r.target?.name}</span>
                          </div>
                          <div className="mt-0.5 text-[10.5px] text-ink-500">
                            From {r.current?.name ?? "—"} · {r.target?.supplier}
                          </div>
                          <div className="mt-1.5 text-[11px] leading-snug text-ink-700">{r.ai.why}</div>
                        </div>
                        <div className="text-right">
                          <div className={cn("inline-flex items-center gap-0.5 text-[11px] tabular-nums", r.delta <= 0 ? "text-success" : "text-ink-700")}>
                            {r.delta === 0 ? "—" : r.delta > 0 ? <><TrendingUp className="h-2.5 w-2.5" />+${r.delta.toFixed(2)}</> : <><TrendingDown className="h-2.5 w-2.5" />−${Math.abs(r.delta).toFixed(2)}</>}
                          </div>
                          <div className="text-[10px] text-ink-400">per pc</div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-end">
                        {r.applied ? (
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-brand-700">
                            <Check className="h-3 w-3" /> Applied
                          </span>
                        ) : (
                          <button
                            onClick={() => onApply(r.k, r.ai.id)}
                            className="inline-flex h-6.5 items-center gap-1 rounded-md bg-brand-700 px-2 py-1 text-[11px] font-medium text-white hover:bg-brand-800"
                          >
                            <Wand2 className="h-3 w-3" /> Apply
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RisksView({ selection }: { selection: Selection }) {
  const totalCost = sumCost(selection);
  type Risk = {
    level: "high" | "med" | "low";
    category: string;
    title: string;
    body: string;
    impact: string;
    recommendation: string;
  };
  // Trimmed — 4 focused risks
  const risks: Risk[] = [
    {
      level: totalCost > 8 ? "high" : "med",
      category: "Margin",
      title: "Margin sensitivity vs target $8.50",
      body: `Landed cost $${totalCost.toFixed(2)} leaves ${(((8.5 - totalCost) / 8.5) * 100).toFixed(1)}% margin — buyer historically pushes 2% at PO.`,
      impact: "-2.0 pt",
      recommendation: "Lock front-fabric price for the season or move backing to Percale 200TC to recover ~1.8 pt.",
    },
    {
      level: "high",
      category: "Material",
      title: "Cotton yarn up 4.8% in 30 days",
      body: "Front fabric is 49% of material cost. Continued trend adds ~$0.08/pc by next PO.",
      impact: "+$0.08 / pc",
      recommendation: "Lock 90-day forward with Karur Mills at $2.85/kg; qualify Panipat as secondary.",
    },
    {
      level: "med",
      category: "Lead time",
      title: "Sea freight window tightening",
      body: "Nhava Sheva booking pressure adds 5–7 days on FCL sailings over the next 4 weeks.",
      impact: "+7 days",
      recommendation: "Split shipment 70% FCL sea + 30% LCL to protect the launch window.",
    },
    {
      level: "low",
      category: "Packaging",
      title: "Value-tier packaging opportunity",
      body: "Poly + sticker preserves shelf presentation for value SKUs vs current PVC + insert.",
      impact: "-$0.24 / pc",
      recommendation: "Trial value-tier pack on 2.5k MOQ; keep premium pack on 10k tier.",
    },
  ];

  const GROUPS: { id: Risk["level"]; label: string; tone: string }[] = [
    { id: "high", label: "High priority", tone: "text-red-700 bg-red-50 ring-red-200" },
    { id: "med", label: "Medium", tone: "text-gold-700 bg-gold-50 ring-gold-200" },
    { id: "low", label: "Low", tone: "text-ink-700 bg-surface-alt ring-hairline" },
  ];
  const [open, setOpen] = useState<Record<string, boolean>>({ high: true, med: true, low: false });

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-alt">
          <ShieldAlert className="h-3.5 w-3.5 text-ink-700" />
        </div>
        <div>
          <div className="text-[13px] font-medium text-ink-900">Risks</div>
          <div className="text-[10.5px] text-ink-500">
            {risks.length} flagged · {risks.filter((r) => r.level === "high").length} high priority
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {GROUPS.map((g) => {
          const items = risks.filter((r) => r.level === g.id);
          if (items.length === 0) return null;
          const isOpen = open[g.id];
          return (
            <div key={g.id} className="overflow-hidden rounded-lg border border-hairline bg-surface">
              <button
                onClick={() => setOpen((o) => ({ ...o, [g.id]: !isOpen }))}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-surface-alt/40"
              >
                <span className={cn("inline-flex h-5 items-center rounded-full px-1.5 text-[9.5px] font-semibold uppercase tracking-wider ring-1", g.tone)}>
                  {g.label}
                </span>
                <span className="ml-auto rounded-full bg-surface-alt px-1.5 py-0.5 text-[10px] font-semibold text-ink-500">
                  {items.length}
                </span>
                <ChevronDown className={cn("h-3.5 w-3.5 text-ink-400 transition-transform", isOpen && "rotate-180")} />
              </button>
              {isOpen && (
                <div className="animate-fade-in space-y-2 border-t border-hairline p-2.5">
                  {items.map((r, i) => (
                    <div key={i} className="rounded-md border border-hairline bg-surface p-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-400">
                          {r.category}
                        </span>
                        <span className="ml-auto rounded-full bg-surface-alt px-2 py-0.5 text-[10.5px] font-semibold tabular-nums text-ink-700">
                          {r.impact}
                        </span>
                      </div>
                      <div className="mt-1 text-[12px] font-medium text-ink-900">{r.title}</div>
                      <p className="mt-1 text-[11px] leading-relaxed text-ink-700">{r.body}</p>
                      <div className="mt-2 rounded-md border border-brand-700/20 bg-gradient-to-r from-brand-50/60 to-brand-50/20 px-2 py-1.5">
                        <div className="flex items-center gap-1 text-[9.5px] uppercase tracking-wider text-brand-700">
                          <Lightbulb className="h-2.5 w-2.5" /> Recommendation
                        </div>
                        <div className="mt-0.5 text-[11px] text-ink-900">{r.recommendation}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}



function ChatView() {
  const [messages, setMessages] = useState<{ from: "ai" | "you"; text: string }[]>([
    { from: "ai", text: "Hi — I'm your commercial co-pilot. Ask about trade-offs, sensitivities or alternate scenarios for this quote." },
  ]);
  const [input, setInput] = useState("");
  const send = () => {
    if (!input.trim()) return;
    setMessages((m) => [
      ...m,
      { from: "you", text: input.trim() },
      { from: "ai", text: "Thinking through the lever combinations…" },
    ]);
    setInput("");
  };
  const suggestions = [
    "Why is margin below plan?",
    "What if MOQ = 5000?",
    "Cheapest fabric swap",
    "Compare current vs Lowest Cost",
  ];
  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
      <div className="border-b border-hairline bg-gradient-to-b from-brand-50/40 to-transparent px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="relative h-9 w-9">
            {/* animated orb */}
            <div className="absolute inset-[-3px] rounded-full bg-gradient-to-tr from-brand-500/40 via-brand-700/30 to-transparent blur-md animate-pulse" />
            <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_180deg_at_50%_50%,#0a7460_0%,#2d8f7a_25%,#c69324_50%,#05604d_75%,#0a7460_100%)]" />
            <div className="absolute inset-[2px] rounded-full bg-gradient-to-br from-ink-900 via-brand-900 to-brand-700" />
            <div className="absolute inset-[3px] rounded-full bg-gradient-to-tr from-white/50 via-white/10 to-transparent" />
            <div className="absolute inset-0 rounded-full ring-1 ring-white/20" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-semibold text-ink-900">Tracon AI</span>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-brand-50 to-brand-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-brand-700 ring-1 ring-brand-700/10">
                <Sparkles className="h-2 w-2" /> Live
              </span>
            </div>
            <div className="mt-0.5 text-[10.5px] text-ink-500">Commercial reasoning · scenario-aware</div>
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[88%] rounded-2xl px-3 py-2 text-[12.5px] leading-snug animate-fade-in",
              m.from === "ai"
                ? "border border-hairline bg-surface text-ink-900"
                : "ml-auto bg-gradient-to-br from-brand-700 to-brand-800 text-white",
            )}
          >
            {m.text}
          </div>
        ))}
      </div>
      <div className="border-t border-hairline p-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => setInput(s)}
              className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface px-2 py-0.5 text-[10.5px] text-ink-700 hover:border-brand-700/40 hover:bg-brand-50/60 hover:text-brand-700"
            >
              <Sparkles className="h-2.5 w-2.5 text-brand-700" />
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-hairline bg-surface px-3 py-2 focus-within:border-brand-700 focus-within:ring-1 focus-within:ring-brand-700/20">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask Tracon AI…"
            className="flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-ink-400"
          />
          <button
            onClick={send}
            title="Send"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-700 to-brand-800 text-white hover:opacity-90"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

