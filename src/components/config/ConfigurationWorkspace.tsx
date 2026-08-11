// ConfigurationWorkspace — the hero AI-Native Costing Configurator screen.
// Three panes: Product Information · Cost graph + analysis · AI copilot.

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Plus,
  Sparkles,
  Wand2,
  X,
  Send,
  Zap,
  ChevronRight,
  GitCompareArrows,
  CheckCircle2,
  Ruler,
  History,

} from "lucide-react";
import { cn } from "@/lib/utils";
import { PodArticleTabs } from "@/components/layout/ArticleTabsBar";
import { WorkflowStepper } from "@/components/layout/WorkflowStepper";
import {
  computeCushion,
  DEFAULT_VARIANTS,
  SIZE_PRESETS,
  MOQ_PRESETS,
  QUALITY_PRESETS,
  type CushionInputs,
  type CushionVariant,
} from "@/lib/cushionCosting";
import { CostingCanvas } from "./CostingCanvas";
import { CostingExplainPanel } from "./CostingExplainPanel";
import { buildCostingSheet } from "@/lib/costingSheet";
import { CompareVariantsWorkspace } from "./CompareVariantsWorkspace";
import { NewVariantDrawer } from "./NewVariantDrawer";
import { CostingIntelligenceReport } from "./CostingIntelligenceReport";

import { RequestedChangesButton } from "./RequestedChangesButton";
import { RequestedChangesWorkspace } from "./RequestedChangesWorkspace";

import { ActionGroup, ModuleRevisionAction } from "@/components/changes/FlowActions";
import {
  MASTER_COMPONENTS,
  nodesForInputPatch,
  type MasterComponent,
} from "@/lib/componentLibrary";


type WorkspaceArticle = { id: string; name: string; size?: string; moq?: string };

type Props = {
  srfId: string;
  productName: string;
  buyer: string;
  targetPriceUsd?: number;
  onCancel?: () => void;
  onSwitchClassic?: () => void;
  initialReportOpen?: boolean;
  initialApprovalOpen?: boolean;
  podRef?: string;
  buyerRef?: string;
  statusLabel?: string;
  updatedAt?: string;
  articles?: WorkspaceArticle[];
  activeArticleId?: string;
  onSelectArticle?: (id: string) => void;
  navPodId?: string;
  navArticleId?: string;

};

type Msg =
  | { role: "user"; text: string }
  | { role: "ai"; text: string; chips?: string[]; proposal?: Proposal; options?: MasterComponent[] };

type Proposal = {
  summary: string;
  patch: Partial<CushionInputs>;
  affectedNodes: string[];
};

// ---------------- Process / domain knowledge base ----------------
// Answers "how / why / what if" questions about cushion construction that
// aren't tied to a single library component. Returns a Msg or null.
function answerKnowledge(
  t: string,
  inputs: CushionInputs,
  metrics: ReturnType<typeof computeCushion>,
): Msg | null {
  const has = (...ks: string[]) => ks.every((k) => t.includes(k));
  const any = (...ks: string[]) => ks.some((k) => t.includes(k));

  // Size → filling / fabric consumption
  if (any("filling", "insert", "backfilling", "back filling", "fibre", "fiber") && any("size", "16", "18", "20", "22", "24", "bigger", "larger", "increase")) {
    return {
      role: "ai",
      text:
        "Filling weight scales roughly with cushion volume. Rule of thumb for a hollow-conjugate polyfil insert at ~1300 g/m³ loft:\n" +
        "• 16\" × 16\" → 340–380 g\n" +
        "• 18\" × 18\" → 430–480 g\n" +
        "• 20\" × 20\" → 540–580 g\n" +
        "• 22\" × 22\" → 680–720 g\n" +
        "• 24\" × 24\" → 780–840 g\n" +
        `You're currently at ${inputs.fillingWeightG ?? 0} g. Going 18\" → 24\" adds ~350 g (roughly +₹63/pc at ₹180/kg) plus ~0.22 m more fabric per piece.`,
      chips: ["Apply 24\" filling (800 g)", "Show 22\" preset", "Impact on total ₹/pc?"],
    };
  }

  // GSM impact
  if (any("gsm", "weight of fabric", "heavier fabric", "lighter fabric") && any("what", "why", "how", "impact", "difference", "vs", "compare", "185", "200", "240", "350")) {
    return {
      role: "ai",
      text:
        `Greige rate scales linearly with GSM in our model (baseline 200 GSM). So:\n` +
        `• 185 GSM → ~7.5% lower greige cost, softer hand, more see-through — okay for prints, weak for solids.\n` +
        `• 240 GSM → +20% greige cost, better body, standard for premium retail.\n` +
        `• 350 GSM canvas → +75% greige cost, holds shape without insert, needs heavier stitch + longer needles.\n` +
        `Current fabric is ${inputs.fabricGsm ?? 200} GSM. Front ₹/m today = ${metrics.frontFabricPerM.toFixed(0)}.`,
      chips: ["Try 240 GSM", "Try 350 GSM canvas", "Why does GSM change price?"],
    };
  }

  // Shrinkage / waste
  if (any("shrink", "shrinkage", "waste", "wastage", "cut loss")) {
    return {
      role: "ai",
      text:
        `Cotton wovens shrink 4–7% after first wash; reactive-printed pieces shrink at the higher end. Cutting waste on cushion panels runs 4–6% (pattern rotation + selvedge). Together they compound: 5% × 5% ≈ +10.25% fabric. You're at shrink ${(inputs.shrinkage*100).toFixed(0)}% × waste ${(inputs.waste*100).toFixed(0)}%. Dropping waste to 3% (marker optimisation) saves ~₹${(metrics.fabricSubtotal*0.019).toFixed(1)}/pc.`,
      chips: ["Optimise waste to 3%", "Explain marker planning"],
    };
  }

  // Quilting comparison
  if (any("quilt", "quilting") && any("vs", "versus", "compare", "difference", "which", "better")) {
    return {
      role: "ai",
      text:
        "Quilting comparison:\n" +
        "• Heart quilting — decorative motif, higher SPI, ~₹225/pc, adds 18–22 min stitching time, needs template. Great for bedding, novelty cushions.\n" +
        "• Diamond quilting — geometric, faster machine run, ~₹180/pc, robust for high MOQ. Standard for hotel/retail.\n" +
        "• Channel/vertical — cheapest at ~₹120/pc, minimal wastage, but flatter look.\n" +
        "Rule of thumb: pick heart for lookbook items <2k pcs, diamond for volume orders >5k pcs.",
      chips: ["Apply heart quilting", "Apply diamond quilting"],
    };
  }

  // Embroidery density
  if (any("embroider", "embroidery") && any("density", "stitch", "spi", "how many", "why")) {
    return {
      role: "ai",
      text:
        `Embroidery cost tracks stitch count. Typical:\n` +
        `• Light logo (5–8k stitches) → ₹18–24/pc\n` +
        `• Medium motif (15–25k) → ₹40–55/pc\n` +
        `• Full-front (50k+) → ₹90–140/pc\n` +
        `You're at ₹${inputs.embroidery}/pc which maps to ~${Math.round(inputs.embroidery * 350)} stitches. Digitising setup (₹8–12k) is one-time and amortises across MOQ.`,
      chips: ["Reduce to logo-only", "Explain digitising cost"],
    };
  }

  // Dye methods
  if (any("dye", "dyeing", "reactive", "pigment", "vat")) {
    return {
      role: "ai",
      text:
        "Dye options:\n" +
        "• Reactive — best colour-fastness, ₹22–28/m, needs soft water, 30% higher effluent load.\n" +
        "• Pigment — cheapest (₹12–16/m), lower fastness, fine for décor cushions but fails wash-test at 40°C for retail.\n" +
        "• Vat — deepest shades on indigos, ₹35–45/m, slower cycle.\n" +
        `Currently solid dyeing = ₹${inputs.solidDyeing}/m (reactive-grade).`,
      chips: ["Switch to pigment", "Explain fastness ratings"],
    };
  }

  // Zipper / closure
  if (any("zipper", "zip", "closure", "envelope")) {
    return {
      role: "ai",
      text:
        "Closures for cushion covers:\n" +
        "• Concealed nylon zipper — cleanest look, ₹6–9/pc, standard for retail.\n" +
        "• Exposed metal zipper — statement finish, ₹18–24/pc, adds ~4 min stitching.\n" +
        "• Envelope back (no closure) — cheapest ₹0 hardware, needs 15–20% extra back fabric for overlap.\n" +
        "For orders under 1500 pcs the envelope back is usually most cost-effective.",
      chips: ["Try envelope back", "Try metal zipper"],
    };
  }

  // Care / labels / compliance
  if (any("care label", "gots", "oeko", "certification", "compliance")) {
    return {
      role: "ai",
      text:
        "Compliance & labels: GOTS certified cotton runs 12–18% premium on greige and needs traceable lot IDs. OEKO-TEX Standard 100 adds ~2% cost, mostly testing. Care label + country-of-origin + fibre content is mandatory for EU; sew-in vs heat-transfer changes trim cost by ₹1–2/pc.",
      chips: ["Switch to GOTS cotton", "Add OEKO-TEX testing"],
    };
  }

  // Packaging
  if (any("pack", "packag", "polybag", "carton", "kraft")) {
    return {
      role: "ai",
      text:
        `Packaging norms: individual polybag ₹2–3/pc, kraft sleeve ₹4–5/pc, gift-box ₹18–28/pc. Master carton (5-ply) fits 40 cushions at 18\", 25 at 24\" — carton cost ~₹90 = ₹2–4/pc. You're at ₹${inputs.packaging}/pc currently.`,
      chips: ["Reduce to polybag", "Upgrade to gift-box"],
    };
  }

  // MOQ economics
  if (any("moq", "quantity") && any("why", "impact", "economics", "how", "affect", "matter")) {
    return {
      role: "ai",
      text:
        `Setup (digitising, screens, sampling, PPM) is ~₹${inputs.setup.toLocaleString("en-IN")} regardless of order size. At MOQ ${inputs.qty.toLocaleString()} that's ₹${metrics.setupPc.toFixed(1)}/pc. Doubling MOQ halves setup/pc. Below 500 pcs setup can be 20%+ of total cost — that's why samples feel disproportionately expensive.`,
      chips: ["Try MOQ 5,000", "Try MOQ 500"],
    };
  }

  // Lead time / process flow
  if (any("lead time", "delivery", "timeline", "how long", "days to make")) {
    return {
      role: "ai",
      text:
        "Cushion cover lead time (post-approval): greige sourcing 5–7 days, dyeing/printing 7–10, cutting+stitching 8–12, quilting/embroidery +3–5, finish+pack 3–4, ex-factory buffer 3. Total 30–40 days for MOQ ≤5k. Add 7 days for GOTS lots (traceability paperwork).",
      chips: ["Compress to 25 days?", "Explain critical path"],
    };
  }

  return null;
}





export function ConfigurationWorkspace({
  srfId,
  productName,
  buyer,
  targetPriceUsd = 5.5,
  onCancel,
  onSwitchClassic,
  initialReportOpen = false,
  initialApprovalOpen = false,
  podRef,
  buyerRef,
  statusLabel,
  updatedAt,
  articles,
  activeArticleId,
  onSelectArticle,
  navPodId,
  navArticleId,
}: Props) {
  

  const [variants, setVariants] = useState<CushionVariant[]>(DEFAULT_VARIANTS);
  const [activeId, setActiveId] = useState<string>(DEFAULT_VARIANTS[0].id);
  const [highlighted, setHighlighted] = useState<string[]>([]);
  const [aiOpen, setAiOpen] = useState(false);
  const [nodeModalId, setNodeModalId] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [newVariantOpen, setNewVariantOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"variant" | "option">("variant");
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(initialReportOpen);
  const [changesOpen, setChangesOpen] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "ai",
      text: `Hi — I'm your costing copilot. Ask me anything: costs, configuration, or process knowledge — GSM impact, filling weights by size, shrinkage & waste, quilting techniques, dye methods, embroidery density, care labels, packaging, MOQ economics.`,
      chips: ["If size goes 18\"→24\", how much filling?", "185 vs 350 GSM — what changes?", "Heart vs diamond quilting?"],
    },
  ]);
  const [prompt, setPrompt] = useState("");

  const active = variants.find((v) => v.id === activeId)!;
  const metrics = useMemo(() => computeCushion(active.inputs), [active]);
  const sheet = useMemo(
    () =>
      buildCostingSheet(
        active.inputs,
        { productName, variantName: active.name },
        metrics,
      ),
    [active, productName, metrics],
  );
  const activeCostCard = sheet.cards.find((c) => c.id === nodeModalId) ?? null;

  useEffect(() => {
    if (!highlighted.length) return;
    const t = setTimeout(() => setHighlighted([]), 2600);
    return () => clearTimeout(t);
  }, [highlighted]);

  const patchActive = (patch: Partial<CushionInputs>, nodes: string[]) => {
    setVariants((prev) =>
      prev.map((v) => (v.id === activeId ? { ...v, inputs: { ...v.inputs, ...patch } } : v)),
    );
    setHighlighted(nodes);
  };

  const searchLibrary = (query: string): MasterComponent[] => {
    const q = query.toLowerCase();
    const tokens = q.split(/[^a-z0-9]+/).filter((t) => t.length > 2);
    const scored = MASTER_COMPONENTS.map((c) => {
      const hay = [
        c.name,
        c.meta ?? "",
        c.tab,
        c.category,
        ...c.attributes.map((a) => `${a.key} ${a.value}`),
        ...(c.contextTags ?? []),
      ]
        .join(" ")
        .toLowerCase();
      let score = 0;
      for (const t of tokens) if (hay.includes(t)) score += 1;
      // phrase boost
      if (hay.includes(q)) score += 3;
      return { c, score };
    })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, 4).map((s) => s.c);
  };

  const send = (raw?: string) => {
    const text = (raw ?? prompt).trim();
    if (!text) return;
    setPrompt("");
    setMsgs((m) => [...m, { role: "user", text }]);
    const t = text.toLowerCase();
    let reply: Msg;

    // 1) Direct intents (commercial + cost drivers)
    if (t.includes("reduce cost") || t.includes("cheaper") || (t.includes("below") && t.match(/\$?\d/))) {
      reply = {
        role: "ai",
        text: "I can drop the front fabric to a 155 GSM greige and lower embroidery density. Together that trims about 12% off total ₹/pc while keeping the buyer-visible spec.",
        proposal: {
          summary: "Greige ₹120→₹104/m · Embroidery ₹48→₹28/pc",
          patch: { greigeCotton: 104, embroidery: 28 },
          affectedNodes: ["greige", "front-per-m", "front-pc", "embroidery", "embroidery-pc", "fabric-sub", "making-sub", "overhead", "total", "quote"],
        },
      };
    } else if (t.includes("target") || t.includes("meet buyer") || t.match(/\$\s?5/)) {
      reply = {
        role: "ai",
        text: `Buyer target is $${targetPriceUsd.toFixed(2)}. Bumping MOQ to 5,000 and switching packaging to kraft-sleeve gets us within 3¢ of target while holding 22% margin.`,
        proposal: {
          summary: `Qty 2,000→5,000 · Packaging ₹5→₹4/pc`,
          patch: { qty: 5_000, packaging: 4 },
          affectedNodes: ["setup", "setup-pc", "packaging", "packaging-pc", "making-sub", "overhead", "total", "quote"],
        },
      };
    } else if (t.match(/moq|quantity|qty/) && t.match(/5[,\s]?000|5k/)) {
      reply = {
        role: "ai",
        text: "At MOQ 5,000 the setup amortises across more pieces — setup ₹/pc drops from ₹20 to ₹8 and everything else stays identical.",
        proposal: {
          summary: "MOQ 2,000 → 5,000",
          patch: { qty: 5_000 },
          affectedNodes: ["setup", "setup-pc", "making-sub", "overhead", "total", "quote"],
        },
      };
    } else if (t.includes("supplier") || t.includes("karur")) {
      reply = {
        role: "ai",
        text: "Karur Mills quotes ₹112/m for the same greige (96% on-time, 18 prior orders). Switching cuts total ₹/pc by roughly 3.4%.",
        proposal: {
          summary: "Greige supplier: default → Karur Mills",
          patch: { greigeCotton: 112 },
          affectedNodes: ["greige", "front-per-m", "back-per-m", "fabric-sub", "total", "quote"],
        },
      };
    } else if (t.includes("why") && t.includes("front")) {
      reply = {
        role: "ai",
        text: `The front is heaviest — reactive print adds ₹38/m on top of greige ₹120/m, then shrink 5% × waste 5% expands the fabric. Front alone is ~₹${metrics.frontPc.toFixed(0)}/pc (~${Math.round((metrics.frontPc / metrics.totalPc) * 100)}% of total).`,
        chips: ["Try greige −10%", `Try wider width 72"`, "Compare Variant B"],
      };
    } else if (answerKnowledge(t, active.inputs, metrics)) {
      reply = answerKnowledge(t, active.inputs, metrics)!;
    } else {
      // 2) Library-driven search — fabrics, processes, trims
      const matches = searchLibrary(text);
      const isFeasibility = /^(can|could|do you|is there|any|show|find|suggest|what about|how about)\b/.test(t) || t.includes("?");
      if (matches.length === 1) {
        const c = matches[0];
        reply = {
          role: "ai",
          text: `${isFeasibility ? "Yes — " : ""}I found ${c.name} in the ${c.tab.toLowerCase()} library. ${c.meta ?? ""} at ${c.price}. Apply it to ${active.name}?`,
          proposal: {
            summary: `${c.name} · ${c.price}`,
            patch: c.patch,
            affectedNodes: c.affectedNodes ?? [c.nodeId, "total", "quote"],
          },
        };
      } else if (matches.length > 1) {
        reply = {
          role: "ai",
          text: `${isFeasibility ? "Yes — a few options match. " : "Here are the closest matches from the library. "}Tap any to apply to ${active.name}.`,
          options: matches,
        };
      } else {
        reply = {
          role: "ai",
          text: "I couldn't find that in the component library. Try naming a fabric (cotton percale, poly micro), a process (heart quilting, garment wash, sublimation), a trim (nylon zipper, GOTS hang tag) — or ask me to reduce cost, meet target, or change MOQ.",
          chips: ["Heart quilting", "GOTS cotton", "Metal zipper", "Reduce cost 8%"],
        };
      }
    }
    setMsgs((m) => [...m, reply]);
  };

  return (
    <div className="flex h-screen w-full flex-col bg-canvas">
      {/* Header — same shell as Configuration */}
      <header className="shrink-0 border-b border-hairline bg-surface px-6 py-3 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Link
              to="/pods"
              aria-label="Back to costing list"
              title="Back to costing list"
              className="mt-1 rounded-md p-1 text-ink-500 hover:bg-surface-alt hover:text-ink-900"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-[20px] font-semibold tracking-tight text-ink-900">
                  {productName}
                </h1>
                <span
                  suppressHydrationWarning
                  className="text-[12px] font-medium uppercase tracking-[0.14em] text-ink-400"
                >
                  {podRef ?? srfId}
                </span>

                {statusLabel && (
                  <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-700">
                    {statusLabel}
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-ink-500">
                <span>
                  Buyer <span className="text-ink-900">{buyer}</span>
                </span>
                {buyerRef && (
                  <span>
                    Buyer Ref <span className="text-ink-900">{buyerRef}</span>
                  </span>
                )}
                {updatedAt && (
                  <span>
                    Last updated <span className="text-ink-900">{updatedAt}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Grouped actions — always right, secondary first, primary last */}
          <ActionGroup>
            <button
              onClick={() => setCompareOpen(true)}
              disabled={variants.length < 2}
              className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 py-2 text-[13px] text-ink-700 hover:bg-surface-alt disabled:opacity-40"
            >
              <GitCompareArrows className="h-4 w-4" /> Compare variants
            </button>

            <button
              onClick={() => setAiOpen((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-[13px] font-medium transition-colors",
                aiOpen
                  ? "border-brand-700 bg-brand-50 text-brand-700"
                  : "border-hairline bg-surface text-ink-700 hover:bg-surface-alt",
              )}
            >
              <Sparkles className="h-4 w-4" /> AI Copilot
            </button>
            <ModuleRevisionAction />
            <button
              onClick={() => setGenerateOpen(true)}
              title="Generate costing snapshot"
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-brand-800"
            >
              <CheckCircle2 className="h-4 w-4" /> Generate costing
            </button>
          </ActionGroup>

        </div>
      </header>

      <WorkflowStepper
        active="Costing"
        podId={navPodId}
        articleId={navArticleId}
        costingRef={srfId}
      />


      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* LEFT — control panel (pricing variants · commercial variables · live output) */}
        <aside className="hidden w-[288px] shrink-0 border-r border-hairline bg-white lg:flex lg:flex-col">
          <ControlPanel
            active={active}
            targetPriceUsd={targetPriceUsd}
            onPatch={(patch, nodes) => patchActive(patch, nodes)}
          />
        </aside>

        {/* CENTER — costing graph */}
        <main className="min-w-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 lg:px-5">
        {/* Variant / Option tabs — browser-style strip above the costing review */}
        <div className="flex shrink-0 items-stretch rounded-lg border border-hairline bg-surface-alt/50">
          <div className="flex items-stretch gap-0 overflow-x-auto rounded-l-lg px-0">

            {variants.map((v) => {
              const m = computeCushion(v.inputs);
              const isActive = v.id === activeId;
              const isEditing = editingId === v.id;
              const isOption = (v.entry ?? "variant") === "option";
              return (
                <div
                  key={v.id}
                  onClick={() => !isEditing && setActiveId(v.id)}
                  onDoubleClick={() => {
                    setEditingId(v.id);
                    setEditingName(v.name);
                  }}
                  role="tab"
                  aria-selected={isActive}
                  tabIndex={0}
                  title={isOption ? `Option of ${variants.find((p) => p.id === v.parentId)?.name ?? "variant"} · double-click to rename` : "Double-click to rename"}
                  className={cn(
                    "group relative inline-flex min-w-[150px] max-w-[240px] shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap border-r border-hairline px-3 py-2 text-[12.5px] transition-colors",
                    isActive
                      ? "bg-white text-ink-900"
                      : "text-ink-600 hover:bg-surface/70 hover:text-ink-900",
                  )}
                >
                  {isActive && (
                    <span className="absolute inset-x-0 top-0 h-[2px] bg-brand-600" aria-hidden />
                  )}
                  {isEditing ? (
                    <input
                      autoFocus
                      value={editingName}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => {
                        const name = editingName.trim() || v.name;
                        setVariants((prev) => prev.map((p) => (p.id === v.id ? { ...p, name } : p)));
                        setEditingId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="min-w-0 flex-1 bg-transparent text-[12.5px] font-medium text-ink-900 outline-none"
                    />
                  ) : (
                    <span className={cn("min-w-0 flex-1 truncate", isActive && "font-medium")}>
                      {v.name}
                    </span>
                  )}
                  <span
                    className={cn(
                      "shrink-0 text-[11px] tabular-nums",
                      isActive ? "text-ink-600" : "text-ink-400",
                    )}
                  >
                    ${m.suggestedQuoteUsd.toFixed(2)}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-1.5 py-[1px] text-[9.5px] font-semibold uppercase tracking-[0.04em]",
                      isOption
                        ? "bg-ink-100 text-ink-600"
                        : "bg-brand-50 text-brand-700",
                    )}
                  >
                    {isOption ? "Option" : "Variant"}
                  </span>
                  {variants.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setVariants((prev) => {
                          // Removing a variant also removes its options.
                          const next = prev.filter((p) => p.id !== v.id && p.parentId !== v.id);
                          if ((v.id === activeId || !next.some((p) => p.id === activeId)) && next.length)
                            setActiveId(next[0].id);
                          return next.length ? next : prev;
                        });
                      }}
                      title={isOption ? "Close option" : "Close variant"}
                      aria-label={`Close ${v.name}`}
                      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-ink-400 hover:bg-ink-100 hover:text-ink-900"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

            {/* + Add tab → dropdown (New Variant · New Option) */}
            <div className="relative shrink-0">

              <button
                onClick={() => setAddMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={addMenuOpen}
                className="inline-flex h-full shrink-0 items-center gap-1.5 border-r border-hairline px-3 py-2 text-[12.5px] font-medium text-ink-600 hover:bg-surface/70 hover:text-ink-900"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
              {addMenuOpen && (
                <>
                  <button
                    aria-label="Close menu"
                    onClick={() => setAddMenuOpen(false)}
                    className="fixed inset-0 z-10 cursor-default"
                  />
                  <div
                    role="menu"
                    className="absolute left-0 top-full z-20 mt-1 w-[188px] overflow-hidden rounded-md border border-hairline bg-white py-1 shadow-lg"
                  >
                    <button
                      role="menuitem"
                      onClick={() => {
                        setAddMenuOpen(false);
                        setDrawerMode("variant");
                        setNewVariantOpen(true);
                      }}
                      className="block w-full px-3 py-1.5 text-left text-[12.5px] text-ink-800 hover:bg-surface-alt"
                    >
                      New Variant
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => {
                        setAddMenuOpen(false);
                        setDrawerMode("option");
                        setNewVariantOpen(true);
                      }}
                      className="block w-full px-3 py-1.5 text-left text-[12.5px] text-ink-800 hover:bg-surface-alt"
                    >
                      New Option
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className="flex-1" />
        </div>





          <div className="flex items-center justify-between px-1">
            <div className="flex flex-col gap-0.5 text-[13px] font-medium text-ink-900">
              Costing review&nbsp;
              <span className="text-[11.5px] font-normal text-ink-500">
                {active.inputs.sizeInches && (
                  <>
                    <Ruler className="mr-1 inline h-3 w-3" />
                    {active.inputs.sizeInches}" × {active.inputs.sizeInches}"
                  </>
                )}
              </span>
            </div>
            <div className="text-[11.5px] text-ink-500">
              read only · click any card to see how it was calculated
            </div>
          </div>

          <div className="h-[calc(100vh-330px)] min-h-[520px] overflow-hidden rounded-xl border border-hairline">
            <CostingCanvas
              cards={sheet.cards}
              activeCardId={nodeModalId}
              onOpenCard={(id) => setNodeModalId(id)}
              pulse={highlighted}
            />
          </div>

        </main>


        {/* RIGHT — read-only costing explanation panel (same shell as Configuration) */}
        {activeCostCard && (
          <aside className="hidden w-[392px] shrink-0 overflow-hidden xl:block">
            <CostingExplainPanel
              card={activeCostCard}
              onClose={() => setNodeModalId(null)}
              navPodId={navPodId}
              navArticleId={navArticleId}
            />
          </aside>
        )}


        {/* RIGHT — AI copilot */}
        {aiOpen && !nodeModalId && (
          <aside className="hidden w-[340px] shrink-0 border-l border-hairline bg-white xl:block">
            <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white">

              <div className="flex items-center gap-2 border-b border-hairline px-3 py-2.5">
                <Sparkles className="h-4 w-4 text-brand-700" />
                <span className="text-[13px] font-medium text-ink-900">Costing copilot</span>
                <span className="ml-auto text-[11px] text-ink-500">on {active.name}</span>
                <button onClick={() => setAiOpen(false)} className="rounded-md p-1 text-ink-400 hover:text-ink-900">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
                {msgs.map((m, i) => (
                  <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[95%] rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed",
                        m.role === "user"
                          ? "bg-ink-900 text-white"
                          : "border border-hairline bg-white text-ink-900 shadow-sm",
                      )}
                    >
                      {m.text}
                      {m.role === "ai" && m.chips && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {m.chips.map((c) => (
                            <button
                              key={c}
                              onClick={() => send(c)}
                              className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface-alt px-2 py-0.5 text-[11px] text-ink-700 hover:bg-white"
                            >
                              <Wand2 className="h-3 w-3" /> {c}
                            </button>
                          ))}
                        </div>
                      )}
                      {m.role === "ai" && m.proposal && (
                        <ProposalCard
                          proposal={m.proposal}
                          onApply={() => {
                            patchActive(m.proposal!.patch, m.proposal!.affectedNodes);
                            setMsgs((prev) => [
                              ...prev,
                              { role: "ai", text: "Applied. The highlighted nodes just recomputed — check the graph." },
                            ]);
                          }}
                        />
                      )}
                      {m.role === "ai" && m.options && m.options.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {m.options.map((c) => (
                            <button
                              key={c.id}
                              onClick={() => {
                                patchActive(c.patch, c.affectedNodes ?? [c.nodeId, "total", "quote"]);
                                setMsgs((prev) => [
                                  ...prev,
                                  { role: "ai", text: `Applied ${c.name} to ${active.name}. Check the graph — highlighted nodes just recomputed.` },
                                ]);
                              }}
                              className="flex w-full items-start justify-between gap-2 rounded-lg border border-hairline bg-white px-2.5 py-1.5 text-left hover:border-ink-300 hover:bg-surface-alt"
                            >
                              <div className="min-w-0">
                                <div className="truncate text-[12px] font-medium text-ink-900">{c.name}</div>
                                {c.meta && <div className="truncate text-[10.5px] text-ink-500">{c.meta}</div>}
                              </div>
                              <div className="shrink-0 text-[11.5px] font-medium tabular-nums text-brand-700">{c.price}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-hairline p-2">
                <div className="flex items-center gap-1.5 rounded-lg border border-hairline bg-white px-2 py-1.5">
                  <input
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send()}
                    placeholder="Ask the copilot…"
                    className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-ink-400"
                  />
                  <button
                    onClick={() => send()}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-brand-700 text-white hover:bg-brand-800"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>




      {/* Variant comparison */}
      {compareOpen && (
        <CompareVariantsWorkspace
          variants={variants}
          activeId={activeId}
          productName={productName}
          targetPriceUsd={targetPriceUsd}
          onApplyVariant={(id) => setActiveId(id)}
          onClose={() => setCompareOpen(false)}
        />
      )}

      {/* New variant drawer */}
      <NewVariantDrawer
        open={newVariantOpen}
        onClose={() => setNewVariantOpen(false)}
        active={active}
        mode={drawerMode}
        parents={variants}
        onCreate={(v) => {
          setVariants((prev) => [...prev, v]);
          setActiveId(v.id);
          setNewVariantOpen(false);
        }}
      />

      {/* Requested changes workspace */}
      {changesOpen && (
        <RequestedChangesWorkspace
          productName={productName}
          podRef={podRef ?? srfId}
          buyer={buyer}
          buyerRef={buyerRef}
          updatedAt={updatedAt}
          variantName={active.name}
          summaryRows={[
            { label: "Size", value: active.inputs.sizeInches ? `${active.inputs.sizeInches}" × ${active.inputs.sizeInches}"` : "—" },
            { label: "MOQ", value: `${active.inputs.qty.toLocaleString()} pcs` },
            { label: "Quality", value: active.inputs.fabricGsm ? `${active.inputs.fabricGsm} GSM` : "—" },
            { label: "Quote / pc", value: `$${metrics.suggestedQuoteUsd.toFixed(2)}` },
            { label: "Margin", value: `${(metrics.quoteMarginPct * 100).toFixed(1)}%` },
            { label: "Target", value: `$${targetPriceUsd.toFixed(2)}` },
          ]}
          onClose={() => setChangesOpen(false)}
          navPodId={navPodId}
          navArticleId={navArticleId}
          costingRef={srfId}
        />
      )}

      {/* Generate costing — Costing Intelligence Report */}

      {generateOpen && (
        <CostingIntelligenceReport
          variants={variants}
          activeId={activeId}
          buyer={buyer}
          productName={productName}
          srfId={srfId}
          targetPriceUsd={targetPriceUsd}
          onClose={() => setGenerateOpen(false)}
          onPromote={(id) => setActiveId(id)}
          podRef={podRef}
          buyerRef={buyerRef}
          statusLabel={statusLabel}
          updatedAt={updatedAt}
          articles={articles}
          initialApprovalOpen={initialApprovalOpen}
          activeArticleId={activeArticleId}
          onSelectArticle={onSelectArticle}
          onApplySensitivity={(patch) => patchActive(patch, ["total", "quote", "fabric-sub", "making-sub"])}
          navPodId={navPodId}
          navArticleId={navArticleId}

        />
      )}
      {/* Bottom — article tabs */}
      <PodArticleTabs
        podId={navPodId}
        activeId={activeArticleId ?? navArticleId}
        stage="Costing"
      />
    </div>
  );
}

/* ---------------- Left control panel: Pricing variants · Commercial · Live output ---------------- */

function ControlPanel({
  active,
  targetPriceUsd,
  onPatch,
}: {
  active: CushionVariant;
  targetPriceUsd: number;
  onPatch: (patch: Partial<CushionInputs>, nodes: string[]) => void;
}) {
  const inputs = active.inputs;
  const m = computeCushion(inputs);
  const onTarget = m.suggestedQuoteUsd <= targetPriceUsd;
  const statusLabel = onTarget
    ? "On target"
    : m.suggestedQuoteUsd - targetPriceUsd > 0.5
      ? "Above target"
      : "Slightly above";

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Pricing variants — MOQ · Size · Quality */}
        <section className="border-b border-hairline px-3 py-3">
          <div className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-500">
            Pricing variants
          </div>
          <div className="mt-0.5 text-[11px] text-ink-400">
            applies to <span className="text-ink-700">{active.name}</span>
          </div>
          <div className="mt-2.5">
            <PricingVariantsBar active={active} onPatch={onPatch} />
          </div>
        </section>

        {/* Commercial variables */}
        <section className="px-3 py-3">
          <div className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-500">
            Commercial variables
          </div>
          <div className="mt-2 space-y-2 text-[12px]">
            <EditableRow
              label="FX rate"
              value={`₹${inputs.fxRate}/$`}
              options={["₹86", "₹88", "₹90", "₹92"]}
              onSelect={(v) => onPatch({ fxRate: Number(v.replace(/₹/, "")) }, ["fx", "quote"])}
            />
            <EditableRow
              label="Target margin"
              value={`${(inputs.targetMarginPct * 100).toFixed(0)}%`}
              options={["22%", "26%", "30%", "34%"]}
              onSelect={(v) =>
                onPatch({ targetMarginPct: Number(v.replace(/%/, "")) / 100 }, [
                  "target-margin",
                  "quote",
                ])
              }
            />
            <div className="flex items-center justify-between border-t border-hairline pt-2">
              <span className="text-ink-500">Buyer target</span>
              <span className="tabular-nums text-ink-900">${targetPriceUsd.toFixed(2)}</span>
            </div>
          </div>
        </section>
      </div>

      {/* Live output — pinned to the bottom */}
      <div className="shrink-0 border-t border-hairline bg-gradient-to-br from-emerald-50/60 to-white px-3 py-2.5">
        <div className="flex items-baseline justify-between">
          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-700">
            Live output
          </div>
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
              onTarget ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700",
            )}
          >
            {statusLabel}
          </span>
        </div>
        <div className="mt-1 grid grid-cols-3 gap-2">
          <MetricCell label="Total cost" value={`₹${m.totalPc.toFixed(0)}`} sub="/pc" />
          <MetricCell
            label="Selling"
            value={`$${m.suggestedQuoteUsd.toFixed(2)}`}
            sub={`tgt $${targetPriceUsd.toFixed(2)}`}
          />
          <MetricCell
            label="Margin"
            value={`${(m.quoteMarginPct * 100).toFixed(0)}%`}
            sub={m.quoteMarginPct >= inputs.targetMarginPct ? "on plan" : "below"}
          />
        </div>
      </div>
    </div>
  );
}

function MetricCell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[9.5px] font-medium uppercase tracking-wide text-ink-500">
        {label}
      </div>
      <div className="truncate text-[14px] font-semibold tabular-nums text-ink-900">{value}</div>
      {sub && <div className="truncate text-[10px] text-ink-400">{sub}</div>}
    </div>
  );
}

function EditableRow({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: string;
  options: string[];
  onSelect: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex items-center justify-between gap-2">
      <span className="text-ink-500">{label}</span>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-md border border-hairline bg-white px-2 py-0.5 text-[11.5px] tabular-nums text-ink-900 hover:border-ink-300"
      >
        {value}
        <ChevronRight className={cn("h-3 w-3 transition-transform", open && "rotate-90")} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 w-36 rounded-md border border-hairline bg-white p-1 shadow-lg">
          {options.map((o) => (
            <button
              key={o}
              onClick={() => {
                onSelect(o);
                setOpen(false);
              }}
              className="block w-full rounded-sm px-2 py-1 text-left text-[12px] hover:bg-surface-alt"
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Proposal card ---------------- */

function ProposalCard({ proposal, onApply }: { proposal: Proposal; onApply: () => void }) {
  return (
    <div className="mt-2 rounded-lg border border-brand-200 bg-brand-50/40 p-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-brand-700">
        <Zap className="h-3 w-3" /> Proposed change
      </div>
      <div className="mt-1 text-[12.5px] text-ink-900">{proposal.summary}</div>
      <button
        onClick={onApply}
        className="mt-2 inline-flex items-center gap-1 rounded-md bg-brand-700 px-2.5 py-1 text-[11.5px] font-medium text-white hover:bg-brand-800"
      >
        <Sparkles className="h-3 w-3" /> Apply to active variant
      </button>
    </div>
  );
}

/* ---------------- Pricing variants (MOQ · Size · Quality) ---------------- */

function PricingVariantsBar({
  active,
  onPatch,
}: {
  active: CushionVariant;
  onPatch: (patch: Partial<CushionInputs>, nodes: string[]) => void;
}) {
  const sizes = Object.keys(SIZE_PRESETS).map(Number);
  const qualities = Object.keys(QUALITY_PRESETS).map(Number);
  const moqNodes = ["setup-pc", "making-sub", "overhead", "total", "quote"];
  const sizeNodes = ["front-per-m", "back-per-m", "front-pc", "back-pc", "fabric-sub", "filling", "filling-pc", "total", "quote"];
  const qualityNodes = ["greige", "front-per-m", "back-per-m", "fabric-sub", "total", "quote"];
  return (
    <div>
      <div className="grid grid-cols-1 gap-2">

        <VariantAxis
          label="MOQ"
          defaultOpen
          hint="Volume tier — setup amortised"
          customUnit="pcs"
          customPlaceholder="e.g. 3,500"
          items={MOQ_PRESETS.map((q) => ({
            key: `moq-${q}`,
            label: `${q.toLocaleString()} pcs`,
            active: active.inputs.qty === q,
            onClick: () => onPatch({ qty: q }, moqNodes),
          }))}
          onCustom={(raw) => {
            const n = Number(raw.replace(/[^0-9]/g, ""));
            if (n > 0) onPatch({ qty: n }, moqNodes);
          }}
        />
        <VariantAxis
          label="Size"
          hint="Geometry + filling weight scale"
          customUnit={'"'}
          customPlaceholder="e.g. 22"
          items={sizes.map((s) => ({
            key: `size-${s}`,
            label: `${s}" × ${s}"`,
            active: active.inputs.sizeInches === s,
            onClick: () => onPatch(SIZE_PRESETS[s], sizeNodes),
          }))}
          onCustom={(raw) => {
            const s = Number(raw.replace(/[^0-9.]/g, ""));
            if (s > 0) {
              // Scale geometry proportionally from an 18" reference
              const scale = s / 18;
              onPatch(
                {
                  sizeInches: s,
                  frontMeters: +(0.5 * scale).toFixed(2),
                  backMeters: +(0.55 * scale).toFixed(2),
                  fillingWeightG: Math.round(450 * scale * scale),
                },
                sizeNodes,
              );
            }
          }}
        />
        <VariantAxis
          label="Quality"
          hint="Fabric weight (GSM)"
          customUnit="GSM"
          customPlaceholder="e.g. 275"
          items={qualities.map((g) => ({
            key: `gsm-${g}`,
            label: `${g} GSM`,
            active: (active.inputs.fabricGsm ?? 200) === g,
            onClick: () => onPatch({ fabricGsm: g }, qualityNodes),
          }))}
          onCustom={(raw) => {
            const g = Number(raw.replace(/[^0-9]/g, ""));
            if (g > 0) onPatch({ fabricGsm: g }, qualityNodes);
          }}
        />
      </div>
    </div>
  );
}

function VariantAxis({
  label,
  hint,
  items,
  onCustom,
  customUnit,
  customPlaceholder,
  defaultOpen = false,
}: {
  label: string;
  hint: string;
  items: { key: string; label: string; active: boolean; onClick: () => void }[];
  onCustom: (raw: string) => void;
  customUnit: string;
  customPlaceholder: string;
  defaultOpen?: boolean;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customVal, setCustomVal] = useState("");
  const [open, setOpen] = useState(defaultOpen);
  const currentLabel = items.find((i) => i.active)?.label ?? "Custom";
  return (
    <div className="rounded-xl border border-hairline bg-surface-alt/40 px-2.5 py-2">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left"
      >
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-ink-400 transition-transform",
            open && "rotate-90",
          )}
        />
        <span className="text-[11.5px] font-medium text-ink-900">{label}</span>
        <span className="ml-auto shrink-0 rounded-full bg-white px-1.5 py-0.5 text-[10.5px] font-medium tabular-nums text-brand-700">
          {currentLabel}
        </span>
      </button>
      {open && <div className="mt-1 pl-5 text-[10px] text-ink-400">{hint}</div>}
      <div className={cn("mt-1.5 flex flex-wrap gap-1 pl-5", !open && "hidden")}>

        {items.map((it) => (
          <button
            key={it.key}
            onClick={it.onClick}
            title={it.active ? "Current value" : `Set ${label} on active variant`}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] tabular-nums transition-colors",
              it.active
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-hairline bg-white text-ink-700 hover:border-ink-300",
            )}
          >
            {it.label}
          </button>
        ))}
        {!customOpen ? (
          <button
            onClick={() => setCustomOpen(true)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-hairline bg-white px-2 py-0.5 text-[11px] text-ink-600 hover:border-ink-300 hover:text-ink-900"
          >
            <Plus className="h-2.5 w-2.5" /> Custom
          </button>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (customVal.trim()) {
                onCustom(customVal);
                setCustomVal("");
                setCustomOpen(false);
              }
            }}
            className="inline-flex items-center gap-1 rounded-full border border-ink-900 bg-white pl-2 pr-0.5 py-0.5"
          >
            <input
              autoFocus
              value={customVal}
              onChange={(e) => setCustomVal(e.target.value)}
              placeholder={customPlaceholder}
              className="w-20 bg-transparent text-[11px] tabular-nums outline-none placeholder:text-ink-300"
            />
            <span className="text-[10px] text-ink-400">{customUnit}</span>
            <button
              type="submit"
              className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-ink-900 text-white hover:bg-ink-700"
              title="Apply"
            >
              <Plus className="h-2.5 w-2.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setCustomOpen(false);
                setCustomVal("");
              }}
              className="inline-flex h-4 w-4 items-center justify-center rounded-full text-ink-400 hover:text-ink-900"
              title="Cancel"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}


