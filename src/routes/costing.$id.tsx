import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Layers,
  Scissors,
  Package,
  FlaskConical,
  Truck,
  Wand2,
  Info,
  TrendingDown,
  TrendingUp,
  Clock,
  Building2,
  History,
  MessageSquare,
  ChevronRight,
  Zap,
  BadgeCheck,
  X,
  Plus,
  Copy,
  Eye,
  MoreHorizontal,
  Check,
  GitBranch,
  Rocket,
  FileText,
  ImageIcon,
} from "lucide-react";
import { SRFS, INQUIRIES, IMG } from "@/lib/inquiries-data";
import { podIdForSrf, usePod } from "@/lib/podsStore";
const podRefOf = (srfId: string) => podIdForSrf(srfId) || srfId.replace(/^SRF-/, "POD-");
import { cn } from "@/lib/utils";
import { ConfigWorkspace } from "@/components/studio/ConfigWorkspace";
import { AiWorkspace } from "@/components/costing/AiWorkspace";
import { ConfigurationWorkspace } from "@/components/config/ConfigurationWorkspace";
import { ApprovalModeBanner } from "@/components/approvals/ApprovalModeBanner";


export const Route = createFileRoute("/costing/$id")({
  validateSearch: (
    s: Record<string, unknown>,
  ): {
    mode?: "approved" | "edit";
    quote?: boolean;
    approvalId?: string;
    report?: boolean;
    approval?: boolean;
    podId?: string;
    sel?: string;
    articleId?: string;
  } => ({
    mode: s.mode === "approved" ? ("approved" as const) : s.mode === "edit" ? ("edit" as const) : undefined,
    quote: s.quote === "1" || s.quote === true ? true : undefined,
    approvalId: typeof s.approvalId === "string" ? s.approvalId : undefined,
    report: s.report === "1" || s.report === true ? true : undefined,
    approval: s.approval === "1" || s.approval === true ? true : undefined,
    podId: typeof s.podId === "string" ? s.podId : undefined,
    sel: typeof s.sel === "string" ? s.sel : undefined,
    articleId: typeof s.articleId === "string" ? s.articleId : undefined,
  }),

  loader: ({ params }) => {
    const srf = SRFS.find((s) => s.id === params.id);
    if (!srf) throw notFound();
    const inquiry = INQUIRIES.find((i) => i.id === srf.inquiryId);
    return { srf, inquiry };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `Cost Studio · ${loaderData.srf.productName} · Tracon`
          : "Cost Studio · Tracon",
      },
      {
        name: "description",
        content:
          "Configure textile products, explore commercial scenarios and see live impact on cost, margin and lead time.",
      },
    ],
  }),
  component: CostStudio,
  notFoundComponent: () => (
    <div className="p-10 text-sm text-ink-500">POD not found.</div>
  ),
});


/* ============================================================
   TYPES + OPTION DATA
   ============================================================ */

type OptionCard = {
  id: string;
  label: string;
  meta?: string;
  cost: number;
  swatch?: string;
  badge?: string;
  lead?: number;
  quality?: "A" | "A+" | "B" | "B+";
  note?: string;
};

type Choice = {
  id: string;
  title: string;
  hint?: string;
  options: OptionCard[];
};

type Stage = {
  key: string;
  label: string;
  icon: typeof Layers;
  choices: Choice[];
};

const STAGES: Stage[] = [
  {
    key: "material",
    label: "Material",
    icon: Layers,
    choices: [
      {
        id: "front_fabric",
        title: "Front fabric",
        hint: "Face of the product — visible to the customer.",
        options: [
          { id: "cotton_500", label: "100% Cotton — 500 GSM", meta: "Zero-twist · combed", cost: 2.15, swatch: "#EDE6D3", badge: "Preferred", lead: 21, quality: "A" },
          { id: "cotton_600", label: "100% Cotton — 600 GSM", meta: "Premium hand feel", cost: 2.55, swatch: "#E6DEC8", lead: 24, quality: "A+" },
          { id: "cotton_blend", label: "Cotton / Bamboo 60/40", meta: "Eco blend", cost: 2.32, swatch: "#DDD6BF", lead: 26, quality: "A", note: "OEKO-TEX certified" },
        ],
      },
      {
        id: "supplier",
        title: "Supplier",
        hint: "Who spins & weaves the base cloth.",
        options: [
          { id: "sup_b", label: "Supplier B — Karur", meta: "18 previous orders · 96% on-time", cost: 0, badge: "AI pick", lead: 18, quality: "A" },
          { id: "sup_a", label: "Supplier A — Erode", meta: "12 previous orders · 92% on-time", cost: 0.18, lead: 22, quality: "A" },
          { id: "sup_c", label: "Supplier C — Panipat", meta: "New — sample approved", cost: -0.22, lead: 27, quality: "B+", note: "Longer lead time, first order" },
        ],
      },
      {
        id: "construction",
        title: "Construction",
        options: [
          { id: "waffle", label: "Waffle weave", meta: "Dobby border", cost: 0.35, badge: "Preferred" },
          { id: "terry", label: "Terry loop", meta: "Classic soft hand", cost: 0.25 },
          { id: "jacquard", label: "Jacquard", meta: "Premium finish", cost: 0.55 },
        ],
      },
      {
        id: "width",
        title: "Fabric width",
        options: [
          { id: "w150", label: "150 cm", meta: "Standard loom", cost: 0.0, badge: "Preferred" },
          { id: "w180", label: "180 cm", meta: "Wider — less seam waste", cost: 0.08 },
          { id: "w220", label: "220 cm", meta: "Widest available", cost: 0.14 },
        ],
      },
    ],
  },
  {
    key: "making",
    label: "Making",
    icon: Scissors,
    choices: [
      {
        id: "printing",
        title: "Printing",
        options: [
          { id: "none", label: "None", meta: "Solid dye only", cost: 0 },
          { id: "digital", label: "Digital print", meta: "1-color logo", cost: 0.18, badge: "AI pick" },
          { id: "screen", label: "Screen print", meta: "Up to 3 colors", cost: 0.28 },
        ],
      },
      {
        id: "embroidery",
        title: "Embroidery",
        options: [
          { id: "no_emb", label: "No embroidery", cost: 0, badge: "Preferred" },
          { id: "logo_emb", label: "Logo embroidery", meta: "≤ 3,000 stitches", cost: 0.22 },
          { id: "premium_emb", label: "Premium embroidery", meta: "≤ 8,000 stitches", cost: 0.48 },
        ],
      },
      {
        id: "labels",
        title: "Labels",
        options: [
          { id: "woven", label: "Woven label", meta: "Buyer artwork", cost: 0.06, badge: "Preferred" },
          { id: "printed", label: "Printed satin", cost: 0.03 },
          { id: "leather", label: "Leather patch", meta: "Premium finish", cost: 0.24 },
        ],
      },
      {
        id: "stitching",
        title: "Stitching & finishing",
        options: [
          { id: "std_stitch", label: "Standard stitching", cost: 0.42, badge: "Preferred" },
          { id: "double_stitch", label: "Double-needle stitching", meta: "Extra durability", cost: 0.55 },
        ],
      },
    ],
  },
  {
    key: "packaging",
    label: "Packaging",
    icon: Package,
    choices: [
      {
        id: "pack_type",
        title: "Packaging type",
        options: [
          { id: "polybag", label: "Polybag", meta: "Recyclable LDPE", cost: 0.06, badge: "AI pick" },
          { id: "kraft", label: "Kraft sleeve", meta: "Retail-ready", cost: 0.14 },
          { id: "gift_box", label: "Gift box", meta: "Premium presentation", cost: 0.42 },
        ],
      },
      {
        id: "inner_pack",
        title: "Inner pack",
        options: [
          { id: "1pc", label: "1 pc / bag", cost: 0.02, badge: "Preferred" },
          { id: "5pc", label: "5 pcs / bag", cost: 0.01 },
        ],
      },
      {
        id: "outer",
        title: "Outer carton",
        options: [
          { id: "5ply", label: "5-ply carton", meta: "Standard export", cost: 0.09, badge: "Preferred" },
          { id: "7ply", label: "7-ply carton", meta: "Heavy duty", cost: 0.14 },
        ],
      },
      {
        id: "tags",
        title: "Tags & accessories",
        options: [
          { id: "hangtag", label: "Hangtag + string", cost: 0.05, badge: "Preferred" },
          { id: "none_tag", label: "No hangtag", cost: 0 },
        ],
      },
    ],
  },
  {
    key: "testing",
    label: "Testing",
    icon: FlaskConical,
    choices: [
      {
        id: "testing",
        title: "Third-party testing",
        options: [
          { id: "std_test", label: "Standard package", meta: "Colorfastness, shrinkage", cost: 0.11, badge: "Preferred" },
          { id: "full_test", label: "Full package", meta: "+ pilling, absorbency", cost: 0.19 },
        ],
      },
      {
        id: "certifications",
        title: "Certifications",
        options: [
          { id: "oekotex", label: "OEKO-TEX Standard 100", cost: 0.04, badge: "Buyer requires" },
          { id: "gots", label: "GOTS organic", cost: 0.09 },
          { id: "none_cert", label: "None", cost: 0 },
        ],
      },
    ],
  },
  {
    key: "transport",
    label: "Transport",
    icon: Truck,
    choices: [
      {
        id: "freight",
        title: "Freight terms",
        options: [
          { id: "fob", label: "FOB Chennai", meta: "Buyer arranges shipping", cost: 0, badge: "Preferred" },
          { id: "cif", label: "CIF London", meta: "Sea freight + insurance", cost: 0.34 },
          { id: "ddp", label: "DDP door delivery", meta: "All duties included", cost: 0.61 },
        ],
      },
    ],
  },
];

const CHOICES_INDEX: Record<string, { stage: Stage; choice: Choice }> = {};
for (const s of STAGES) for (const c of s.choices) CHOICES_INDEX[c.id] = { stage: s, choice: c };

/* ============================================================
   ARTICLES — an SRF may contain multiple products
   ============================================================ */

type Article = {
  id: string;
  articleNo: string;
  name: string;
  category: string;
  image: string;
  moq: string;
  buyer: string;
  status: "Spec ready" | "In design" | "Draft";
  reference?: string;
};

function articlesForSrf(srf: (typeof SRFS)[number]): Article[] {
  const primary: Article = {
    id: `${srf.id}-A1`,
    articleNo: `${srf.id.replace("SRF-", "ART-")}·01`,
    name: srf.productName,
    category: srf.category,
    image: srf.image,
    moq: srf.moq,
    buyer: srf.buyer,
    status: "Spec ready",
    reference: IMG.bedding,
  };
  const siblings: Article[] = [
    {
      id: `${srf.id}-A2`,
      articleNo: `${srf.id.replace("SRF-", "ART-")}·02`,
      name: `${srf.category === "Bath Towel" ? "Guest Towel" : "Companion Piece"} — ${srf.buyer}`,
      category: srf.category === "Bath Towel" ? "Guest Towel" : srf.category,
      image: IMG.throw,
      moq: srf.moq,
      buyer: srf.buyer,
      status: "In design",
    },
    {
      id: `${srf.id}-A3`,
      articleNo: `${srf.id.replace("SRF-", "ART-")}·03`,
      name: `Cushion Cover 45cm — ${srf.buyer}`,
      category: "Cushion Cover",
      image: IMG.cushion,
      moq: "1,000 pcs",
      buyer: srf.buyer,
      status: "Draft",
    },
    {
      id: `${srf.id}-A4`,
      articleNo: `${srf.id.replace("SRF-", "ART-")}·04`,
      name: `Pillow Case Standard — ${srf.buyer}`,
      category: "Pillow Case",
      image: IMG.bedding,
      moq: "2,000 pcs",
      buyer: srf.buyer,
      status: "Draft",
    },
  ];
  return [primary, ...siblings];
}

/* ============================================================
   SCENARIOS
   ============================================================ */

type SelectionMap = Record<string, string>;

type Scenario = {
  id: string;
  name: string;
  tag?: string;
  selections: SelectionMap;
  history: EvolutionEntry[];
};

type EvolutionEntry = {
  id: number;
  who: string;
  when: string;
  choiceTitle: string;
  fromLabel: string;
  toLabel: string;
  costDelta: number;
  leadDelta: number;
};

function defaultSelections(): SelectionMap {
  const map: SelectionMap = {};
  for (const s of STAGES) {
    for (const c of s.choices) {
      const preferred =
        c.options.find((o) => o.badge === "AI pick") ??
        c.options.find((o) => o.badge === "Preferred") ??
        c.options[0];
      map[c.id] = preferred.id;
    }
  }
  return map;
}

function emptySelections(): SelectionMap {
  const map: SelectionMap = {};
  for (const s of STAGES) for (const c of s.choices) map[c.id] = "";
  return map;
}

function applyPreset(preset: string): SelectionMap {
  const base = defaultSelections();
  if (preset === "Value Engineered") {
    base.front_fabric = "cotton_500";
    base.supplier = "sup_c";
    base.printing = "digital";
    base.pack_type = "polybag";
  } else if (preset === "Premium") {
    base.front_fabric = "cotton_600";
    base.construction = "jacquard";
    base.stitching = "double_stitch";
    base.pack_type = "gift_box";
    base.labels = "leather";
  } else if (preset === "Margin Optimized") {
    base.supplier = "sup_b";
    base.printing = "none";
    base.embroidery = "no_emb";
    base.pack_type = "polybag";
    base.tags = "none_tag";
  } else if (preset === "Lowest Cost") {
    base.front_fabric = "cotton_500";
    base.supplier = "sup_c";
    base.construction = "terry";
    base.printing = "none";
    base.embroidery = "no_emb";
    base.labels = "printed";
    base.pack_type = "polybag";
    base.tags = "none_tag";
    base.testing = "std_test";
    base.certifications = "none_cert";
  }
  return base;
}

/* ============================================================
   MAIN COMPONENT
   ============================================================ */

type Phase = "setup" | "studio";
type StartMode = "spec" | "manual" | null;
type StudioView = "ai" | "classic" | "configurator";

function CostStudio() {
  const { srf, inquiry } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const backToPods = () => navigate({ to: "/pods" });
  const articles = useMemo(() => articlesForSrf(srf), [srf]);

  // Products carried forward from the Configuration step (POD + selected articles).
  const carriedPod = usePod(search.podId ?? "");
  const carriedArticles = useMemo(() => {
    if (!carriedPod) return [];
    const ids = search.sel ? search.sel.split(",").filter(Boolean) : carriedPod.articles.map((a) => a.id);
    return carriedPod.articles.filter((a) => ids.includes(a.id));
  }, [carriedPod, search.sel]);
  const [carriedActiveId, setCarriedActiveId] = useState<string | undefined>(search.articleId);
  const carriedActive =
    carriedArticles.find((a) => a.id === (carriedActiveId ?? search.articleId)) ?? carriedArticles[0];



  // Cost Studio setup phase removed — Start Costing goes straight to the configuration workspace.
  const [phase, setPhase] = useState<Phase>("studio");
  const [studioView, setStudioView] = useState<StudioView>(() => {
    if (typeof window === "undefined") return "configurator";
    const v = new URLSearchParams(window.location.search).get("view");
    if (v === "classic") return "classic";
    if (v === "ai") return "ai";
    return "configurator";
  });
  void setPhase;

  const [articleId, setArticleId] = useState<string>(articles[0].id);
  const [selectedArticleIds, setSelectedArticleIds] = useState<string[]>([articles[0].id]);
  const [startMode, setStartMode] = useState<StartMode>(null);

  const [scenarios, setScenarios] = useState<Scenario[]>(() => [
    { id: "sc-1", name: "Current", tag: "From spec", selections: defaultSelections(), history: [] },
  ]);
  const [activeScenarioId, setActiveScenarioId] = useState<string>("sc-1");
  const [activeChoiceId, setActiveChoiceId] = useState<string>("front_fabric");
  const [explainOpen, setExplainOpen] = useState<string | null>(null);
  const [lastChange, setLastChange] = useState<EvolutionEntry | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("build");
  const historyIdRef = useRef(1);


  const article = articles.find((a) => a.id === articleId)!;
  const target = useMemo(() => parseTargetPrice(srf.targetPrice), [srf.targetPrice]);

  // Enter studio with initial scenario
  const enterStudio = (mode: StartMode) => {
    if (!mode) return;
    const first: Scenario = {
      id: "sc-1",
      name: "Current",
      tag: mode === "spec" ? "From spec" : "Blank",
      selections: mode === "spec" ? defaultSelections() : emptySelections(),
      history: [],
    };
    setScenarios([first]);
    setActiveScenarioId(first.id);
    setStartMode(mode);
    setPhase("studio");
  };


  const active = scenarios.find((s) => s.id === activeScenarioId)!;
  const sel = active.selections;

  const updateScenario = (patch: Partial<Scenario>) => {
    setScenarios((list) => list.map((s) => (s.id === active.id ? { ...s, ...patch } : s)));
  };

  const handleChange = (_stageKey: string, choice: Choice, optionId: string) => {
    if (sel[choice.id] === optionId) return;
    const from = choice.options.find((o) => o.id === sel[choice.id]);
    const to = choice.options.find((o) => o.id === optionId);
    if (!to) return;
    const nextSel = { ...sel, [choice.id]: optionId };
    const entry: EvolutionEntry = {
      id: historyIdRef.current++,
      who: "Gautam K.",
      when: "just now",
      choiceTitle: choice.title,
      fromLabel: from?.label ?? "—",
      toLabel: to.label,
      costDelta: to.cost - (from?.cost ?? 0),
      leadDelta: (to.lead ?? 0) - (from?.lead ?? 0),
    };
    updateScenario({ selections: nextSel, history: [entry, ...active.history].slice(0, 20) });
    setLastChange(entry);
    setActiveChoiceId(choice.id);
  };

  const applyPresetToActive = (preset: string) => {
    updateScenario({ selections: applyPreset(preset) });
    const entry: EvolutionEntry = {
      id: historyIdRef.current++,
      who: "AI Copilot",
      when: "just now",
      choiceTitle: `Applied "${preset}" preset`,
      fromLabel: "Previous mix",
      toLabel: preset,
      costDelta: 0,
      leadDelta: 0,
    };
    updateScenario({ selections: applyPreset(preset), history: [entry, ...active.history] });
    setLastChange(entry);
  };

  const duplicateScenario = () => {
    const n = scenarios.length + 1;
    const copy: Scenario = {
      id: `sc-${n}`,
      name: `Scenario ${n}`,
      tag: "Duplicate",
      selections: { ...active.selections },
      history: [],
    };
    setScenarios([...scenarios, copy]);
    setActiveScenarioId(copy.id);
  };

  const newScenarioFromPreset = (preset: string) => {
    const n = scenarios.length + 1;
    const copy: Scenario = {
      id: `sc-${n}`,
      name: preset,
      tag: "AI preset",
      selections: applyPreset(preset),
      history: [],
    };
    setScenarios([...scenarios, copy]);
    setActiveScenarioId(copy.id);
  };

  const removeScenario = (id: string) => {
    if (scenarios.length === 1) return;
    const rest = scenarios.filter((s) => s.id !== id);
    setScenarios(rest);
    if (activeScenarioId === id) setActiveScenarioId(rest[0].id);
  };

  // Aggregates
  const stageTotals = useMemo(() => {
    const m: Record<string, { cost: number; picks: number; total: number; leadMax: number }> = {};
    for (const s of STAGES) {
      let cost = 0;
      let leadMax = 0;
      let picks = 0;
      for (const c of s.choices) {
        const chosen = c.options.find((o) => o.id === sel[c.id]);
        if (chosen) {
          cost += chosen.cost;
          picks += 1;
          leadMax = Math.max(leadMax, chosen.lead ?? 0);
        }
      }
      m[s.key] = { cost, picks, total: s.choices.length, leadMax };
    }
    return m;
  }, [sel]);

  const currentCost = Object.values(stageTotals).reduce((a, b) => a + b.cost, 0);
  const targetMarginPct = 22;
  const desiredCost = target.value * (1 - targetMarginPct / 100);
  const remainingBudget = target.value - currentCost;
  const actualMarginPct = target.value > 0 ? ((target.value - currentCost) / target.value) * 100 : 0;
  const readiness = computeReadiness(stageTotals, actualMarginPct);
  const confidence = 61 + Math.round(readiness / 3);
  const totalLead = Math.max(...Object.values(stageTotals).map((s) => s.leadMax), 0);

  const costMix = useMemo(() => {
    const total = Math.max(currentCost, 0.0001);
    return STAGES.map((s) => ({
      key: s.key,
      label: s.label,
      pct: Math.round((stageTotals[s.key].cost / total) * 100),
      cost: stageTotals[s.key].cost,
    })).sort((a, b) => b.pct - a.pct);
  }, [stageTotals, currentCost]);

  // Comparison metrics for each scenario
  const scenarioMetrics = useMemo(() => {
    return scenarios.map((s) => {
      let cost = 0;
      let leadMax = 0;
      for (const st of STAGES) {
        for (const c of st.choices) {
          const chosen = c.options.find((o) => o.id === s.selections[c.id]);
          if (chosen) {
            cost += chosen.cost;
            leadMax = Math.max(leadMax, chosen.lead ?? 0);
          }
        }
      }
      const margin = target.value > 0 ? ((target.value - cost) / target.value) * 100 : 0;
      return { id: s.id, cost, margin, lead: leadMax };
    });
  }, [scenarios, target.value]);

  const activeStageKey = CHOICES_INDEX[activeChoiceId]?.stage.key ?? STAGES[0].key;
  const activeStage = STAGES.find((s) => s.key === activeStageKey)!;
  const activeStageIndex = STAGES.findIndex((s) => s.key === activeStageKey);

  if (phase === "setup") {
    return (
      <SetupWorkspace
        srf={srf}
        inquiry={inquiry}
        articles={articles}
        articleId={articleId}
        setArticleId={setArticleId}
        setSelectedArticleIds={setSelectedArticleIds}
        onStart={enterStudio}
      />
    );
  }

  const selectedProducts = articles
    .filter((a) => selectedArticleIds.includes(a.id))
    .map((a) => ({ id: a.id, name: a.name, image: a.image }));
  const firstProduct = selectedProducts.length
    ? selectedProducts
    : [{ id: articles[0].id, name: articles[0].name, image: articles[0].image }];

  const banner = search.approvalId ? (
    <ApprovalModeBanner
      approvalId={search.approvalId}
      mode={search.mode === "edit" ? "edit" : "review"}
    />
  ) : null;
  const effectiveMode =
    search.approvalId && search.mode !== "edit" ? ("approved" as const) : search.mode === "approved" ? ("approved" as const) : "draft";

  if (studioView === "configurator") {
    return (
      <>
        {banner}
        <ConfigurationWorkspace
          navPodId={search.podId ?? carriedPod?.id}
          navArticleId={carriedActive?.id ?? search.articleId}
          srfId={srf.id}
          podRef={carriedPod?.id ?? podRefOf(srf.id)}
          productName={carriedActive?.name ?? article.name}
          buyer={carriedPod?.buyer ?? srf.buyer}
          buyerRef={carriedPod?.buyerRef ?? undefined}
          statusLabel={effectiveMode === "approved" ? "Costing approved" : "Costing in progress"}
          targetPriceUsd={target.value || 5.5}
          articles={
            carriedArticles.length
              ? carriedArticles.map((a) => ({ id: a.id, name: a.name, moq: a.moq, size: a.size }))
              : firstProduct.map((p) => {
                  const a = articles.find((x) => x.id === p.id);
                  return { id: p.id, name: p.name, moq: a?.moq, size: a?.category };
                })
          }
          activeArticleId={carriedArticles.length ? (carriedActiveId ?? carriedArticles[0].id) : articleId}
          onSelectArticle={(id) =>
            carriedArticles.length ? setCarriedActiveId(id) : setArticleId(id)
          }
          onCancel={backToPods}
          initialReportOpen={search.report === true || search.approval === true}
          initialApprovalOpen={search.approval === true}
        />

      </>
    );
  }

  if (studioView === "ai") {
    return (
      <>
        {banner}
        <AiWorkspace
          srfId={srf.id}
          navPodId={search.podId ?? carriedPod?.id}
          onCancel={backToPods}
          onSwitchClassic={() => setStudioView("classic")}
          mode={effectiveMode === "approved" ? "approved" : "draft"}
          autoOpenQuote={search.quote === true}
          products={firstProduct}
        />
      </>
    );
  }

  return (
    <>
      {banner}
      <ConfigWorkspace srfId={srf.id} products={firstProduct} onCancel={backToPods} />
    </>
  );
}


/* ============================================================
   SETUP WORKSPACE — pick products from the SRF
   ============================================================ */



function SetupWorkspace({
  srf,
  inquiry,
  articles,
  articleId,
  setArticleId,
  setSelectedArticleIds,
  onStart,
}: {
  srf: (typeof SRFS)[number];
  inquiry: (typeof INQUIRIES)[number] | undefined;
  articles: Article[];
  articleId: string;
  setArticleId: (id: string) => void;
  setSelectedArticleIds: (ids: string[]) => void;
  onStart: (mode: StartMode) => void;
}) {
  // SRF product selection state
  const [query, setQuery] = useState("");
  const aiPair = useMemo(() => articles.slice(0, 2).map((a) => a.id), [articles]);
  const [selected, setSelected] = useState<Set<string>>(new Set([articles[0].id]));
  const filteredArticles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter((a) =>
      [a.name, a.articleNo, a.category, a.buyer].some((v) => v.toLowerCase().includes(q)),
    );
  }, [articles, query]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const selectAll = () => setSelected(new Set(articles.map((a) => a.id)));
  const clearAll = () => setSelected(new Set());
  const acceptAiPair = () => setSelected(new Set(aiPair));

  const createFromSrf = () => {
    const ids = Array.from(selected);
    const chosen = articles.filter((a) => selected.has(a.id));
    const first = chosen[0] ?? articles[0];
    setArticleId(first.id);
    setSelectedArticleIds(ids.length ? ids : [first.id]);
    onStart("spec");
  };

  return (
    <div className="min-h-screen bg-surface-alt/40">
      {/* Top bar — matches Create SRF layout */}
      <header className="sticky top-0 z-40 border-b border-hairline bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1280px] items-center gap-4 px-6 py-3">
          <div className="flex items-center gap-2 text-[12px] text-ink-500">
            <Link to="/pods" className="inline-flex items-center gap-1 hover:text-ink-900">
              <ArrowLeft className="h-3 w-3" /> PODs
            </Link>
            <span className="text-ink-300">·</span>
            <Link to="/pods" className="hover:text-ink-900">
              {podRefOf(srf.id)}
            </Link>
            <span className="text-ink-300">·</span>
            <span className="text-ink-900">Start Costing</span>
          </div>
          <Link
            to="/pods"
           
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-500 hover:bg-surface-alt hover:text-ink-900"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1280px] px-6 py-8 pb-32">
        <div className="mb-6 max-w-2xl">
          <div className="mb-1.5 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-brand-700">
            <Sparkles className="h-3 w-3" /> Cost Studio
          </div>
          <h1 className="text-[30px] leading-[1.1] tracking-[-0.015em] text-ink-900">
            Select products to cost
          </h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-500">
            Pick one or more articles from this POD. Each product opens as its own tab in the
            Costing Workspace so you can configure and compare them side-by-side.
          </p>
        </div>

        {/* SRF details banner */}
        <div className="overflow-hidden rounded-2xl border border-hairline bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline bg-surface-alt/60 px-5 py-4">
            <div className="min-w-0 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-700 text-white">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10.5px] uppercase tracking-[0.14em] text-ink-400">Costing POD</div>
                <div className="text-[16px] font-medium tracking-tight text-ink-900">
                  {podRefOf(srf.id)} <span className="text-ink-400">·</span> <span className="text-ink-600">{srf.buyer}</span>
                </div>
                <div className="mt-0.5 text-[11.5px] text-ink-500">
                  Season {srf.season} · Created 15 May 2025
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-md border border-hairline bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-700">
                {articles.length} Articles
              </span>
              <span className="rounded-md border border-hairline bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-700">
                Samples · In Progress
              </span>
              <span className="rounded-md bg-gold-50 px-2.5 py-1 text-[11px] font-medium text-gold-700 border border-gold-100">
                Costing · Pending
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-hairline sm:grid-cols-3 lg:grid-cols-6">
            {[
              { k: "Enquiry receipt", v: "15 May 2025", tone: "ink" as const },
              { k: "POD started on", v: "15 May 2025", tone: "ink" as const },
              { k: "Costing expected", v: "20 May 2025", tone: "gold" as const },
              { k: "SPC date", v: "28 May 2025", tone: "rose" as const, warn: true },
              { k: "CSK / Prepared by", v: "PDL · CSK", tone: "ink" as const },
              { k: "Linked order", v: "— Awaiting", tone: "muted" as const },
            ].map((d) => (
              <div key={d.k} className="px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-ink-400">{d.k}</div>
                <div
                  className={cn(
                    "mt-1 inline-flex items-center gap-1 text-[13px] font-medium tabular-nums",
                    d.tone === "ink" && "text-ink-900",
                    d.tone === "gold" && "text-gold-700",
                    d.tone === "rose" && "text-rose-600",
                    d.tone === "muted" && "text-ink-400",
                  )}
                >
                  {d.v}
                  {d.warn && <AlertTriangle className="h-3.5 w-3.5" />}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-hairline bg-surface-alt/30 px-4 py-3">
            {inquiry && (
              <Link
                to="/pods"
               
                className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 py-1.5 text-[12px] font-medium text-ink-700 hover:bg-surface-alt"
              >
                <FileText className="h-3.5 w-3.5" /> View linked inquiry {inquiry.id}
              </Link>
            )}
            <Link
              to="/pods"
             
              className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 py-1.5 text-[12px] font-medium text-ink-700 hover:bg-surface-alt"
            >
              <Eye className="h-3.5 w-3.5" /> Open POD details
            </Link>
            <div className="ml-auto inline-flex items-center gap-1 text-[11.5px] text-brand-700">
              <BadgeCheck className="h-3.5 w-3.5" /> Ready for Costing
            </div>
          </div>
        </div>

        <div className="mt-8 mb-3 flex items-baseline justify-between gap-3">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.14em] text-ink-400">Step 2</div>
            <h2 className="text-[18px] font-medium tracking-tight text-ink-900">
              Select articles from this POD to add in costing
            </h2>
          </div>
          <div className="text-[12px] text-ink-500">{articles.length} articles</div>
        </div>

        {/* AI recommendation */}
        {aiPair.length === 2 && (
          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-brand-700/30 bg-brand-50/40 p-4 sm:flex-row sm:items-center">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-700 text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex-1 text-[13px] text-ink-700">
              <span className="font-medium text-ink-900">AI recommendation.</span>{" "}
              {articles[0].name} and {articles[1].name} share ~82% of components. Costing them
              together removes duplicate work.
            </div>
            <button
              onClick={acceptAiPair}
              className="inline-flex items-center gap-1.5 rounded-md border border-brand-700 bg-white px-3 py-1.5 text-[12px] font-medium text-brand-700 hover:bg-brand-50"
            >
              Accept recommendation
            </button>
          </div>
        )}

        {/* Search + select controls */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products by name, article, category…"
              className="h-10 w-full rounded-lg border border-hairline bg-surface px-3.5 text-[13px] text-ink-900 placeholder:text-ink-400 focus:border-brand-700 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 text-[12px] text-ink-500">
            <button
              onClick={selectAll}
              className="rounded-md border border-hairline bg-surface px-2.5 py-1.5 hover:bg-surface-alt"
            >
              Select all
            </button>
            <button
              onClick={clearAll}
              className="rounded-md border border-hairline bg-surface px-2.5 py-1.5 hover:bg-surface-alt"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Product cards */}
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredArticles.map((a) => {
            const isSel = selected.has(a.id);
            return (
              <button
                key={a.id}
                onClick={() => toggle(a.id)}
                className={cn(
                  "group relative flex flex-col overflow-hidden rounded-2xl border bg-surface text-left transition-all",
                  isSel
                    ? "border-brand-700 shadow-[0_2px_24px_-10px_rgba(5,96,77,0.35)] ring-2 ring-brand-700/10"
                    : "border-hairline hover:border-ink-200 hover:shadow-sm",
                )}
              >
                <div className="relative h-44 shrink-0 bg-surface-alt">
                  <img src={a.image} alt={a.name} className="h-full w-full object-cover" />
                  <div className="absolute left-3 top-3 rounded-full bg-white/85 px-2 py-0.5 text-[10.5px] font-medium text-ink-700 backdrop-blur">
                    {a.articleNo}
                  </div>
                  <span
                    className={cn(
                      "absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-md border transition-all",
                      isSel
                        ? "border-brand-700 bg-brand-700 text-white"
                        : "border-hairline bg-white/90 text-transparent group-hover:text-ink-300",
                    )}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="text-[10.5px] uppercase tracking-[0.12em] text-ink-400">
                    {a.category}
                  </div>
                  <div className="text-[14px] font-medium leading-snug text-ink-900">{a.name}</div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Chip>100% Cotton</Chip>
                    <Chip>Printed</Chip>
                  </div>
                  <div className="mt-auto space-y-1.5 border-t border-hairline pt-2.5 text-[11.5px] text-ink-500">
                    <div className="flex items-center justify-between">
                      <span>MOQ</span>
                      <span className="text-ink-700 tabular-nums">{a.moq}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Status</span>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                          a.status === "Spec ready" && "bg-brand-50 text-brand-700",
                          a.status === "In design" && "bg-gold-50 text-gold-700",
                          a.status === "Draft" && "bg-surface-alt text-ink-500",
                        )}
                      >
                        {a.status}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
          {filteredArticles.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-hairline p-8 text-center text-[13px] text-ink-500">
              No products match "{query}".
            </div>
          )}
        </div>

        {/* Sticky footer summary */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-surface/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1280px] items-center gap-4 px-6 py-3">
            <div className="text-[13px] text-ink-900">
              {selected.size > 0 ? (
                <>
                  <span className="font-medium">
                    {selected.size} product{selected.size > 1 ? "s" : ""} selected
                  </span>
                  <span className="ml-2 text-ink-500">
                    {articles
                      .filter((a) => selected.has(a.id))
                      .map((a) => a.name)
                      .join(" · ")}
                  </span>
                </>
              ) : (
                <span className="text-ink-500">Select at least one product to continue</span>
              )}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Link
                to="/pods"
               
                className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-3.5 py-2 text-[13px] font-medium text-ink-700 hover:bg-surface-alt"
              >
                Cancel
              </Link>
              <button
                onClick={createFromSrf}
                disabled={selected.size === 0}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-4 py-2 text-[13px] font-medium text-white shadow-sm",
                  selected.size === 0
                    ? "bg-ink-300 cursor-not-allowed"
                    : "bg-brand-700 hover:bg-brand-800",
                )}
              >
                <Rocket className="h-3.5 w-3.5" /> Create Costing Workspace <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-surface-alt px-2 py-0.5 text-[10.5px] text-ink-600">
      {children}
    </span>
  );
}



/* ============================================================
   STUDIO TOP BAR
   ============================================================ */

function StudioTopBar({
  srf,
  article,
  readiness,
  onBackToSetup,
}: {
  srf: (typeof SRFS)[number];
  article: Article;
  readiness: number;
  onBackToSetup: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1440px] items-center gap-4 px-6 py-3">
        <Link
          to="/pods"
         
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-500 hover:bg-surface-alt hover:text-ink-900"
          aria-label="Back to POD"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2 text-[12px] text-ink-500">
          <Link to="/pods" className="hover:text-ink-900">PODs</Link>
          <ChevronRight className="h-3 w-3 text-ink-300" />
          <Link to="/pods" className="hover:text-ink-900">{podRefOf(srf.id)}</Link>
          <ChevronRight className="h-3 w-3 text-ink-300" />
          <button onClick={onBackToSetup} className="hover:text-ink-900">Costing</button>
          <ChevronRight className="h-3 w-3 text-ink-300" />
          <span className="text-ink-900">{article.name}</span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden items-center gap-2 sm:flex">
            <span className="text-[11px] uppercase tracking-[0.12em] text-ink-400">Readiness</span>
            <div className="h-1.5 w-28 overflow-hidden rounded-full bg-surface-alt">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  readiness >= 80 ? "bg-brand-700" : readiness >= 50 ? "bg-gold-500" : "bg-ink-300",
                )}
                style={{ width: `${readiness}%` }}
              />
            </div>
            <span className="text-[11px] tabular-nums text-ink-500">{readiness}%</span>
          </div>
          <button className="rounded-md border border-hairline bg-surface px-3 py-1.5 text-[12.5px] text-ink-700 hover:bg-surface-alt">
            Save draft
          </button>
          <button
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[12.5px] font-medium text-white shadow-sm",
              readiness >= 70 ? "bg-brand-700 hover:bg-brand-800" : "bg-ink-300 cursor-not-allowed",
            )}
            disabled={readiness < 70}
          >
            <Rocket className="h-3.5 w-3.5" /> Prepare quotation
          </button>
        </div>
      </div>
    </header>
  );
}

/* ============================================================
   SCENARIO TABS
   ============================================================ */

function ScenarioTabs({
  scenarios,
  metrics,
  activeId,
  onSelect,
  onDuplicate,
  onNewFromPreset,
  onRemove,
  currency,
}: {
  scenarios: Scenario[];
  metrics: { id: string; cost: number; margin: number; lead: number }[];
  activeId: string;
  onSelect: (id: string) => void;
  onDuplicate: () => void;
  onNewFromPreset: (preset: string) => void;
  onRemove: (id: string) => void;
  currency: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-hairline pb-3">
      <div className="flex items-center gap-1 text-[11px] uppercase tracking-[0.12em] text-ink-400">
        <GitBranch className="h-3 w-3" /> Scenarios
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {scenarios.map((s) => {
          const m = metrics.find((x) => x.id === s.id)!;
          const isActive = s.id === activeId;
          return (
            <div key={s.id} className="group relative">
              <button
                onClick={() => onSelect(s.id)}
                className={cn(
                  "flex items-center gap-2 rounded-full border py-1 pl-2.5 pr-1 text-[12px] transition-colors",
                  isActive
                    ? "border-brand-700 bg-brand-700 text-white shadow-sm"
                    : "border-hairline bg-surface text-ink-700 hover:bg-surface-alt",
                )}
              >
                <span className="font-medium">{s.name}</span>
                <span className={cn("tabular-nums text-[11px]", isActive ? "text-white/80" : "text-ink-500")}>
                  {currency}{m.cost.toFixed(2)} · {m.margin.toFixed(0)}% · {m.lead}d
                </span>
                {scenarios.length > 1 && (
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); onRemove(s.id); }}
                    className={cn(
                      "ml-1 flex h-4 w-4 items-center justify-center rounded-full",
                      isActive ? "bg-white/15 hover:bg-white/25" : "bg-transparent opacity-0 group-hover:opacity-100 hover:bg-ink-100",
                    )}
                  >
                    <X className="h-2.5 w-2.5" />
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <button
        onClick={onDuplicate}
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-hairline bg-surface px-2.5 py-1 text-[12px] text-ink-600 hover:border-ink-300 hover:text-ink-900"
      >
        <Copy className="h-3 w-3" /> Duplicate
      </button>
      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-hairline bg-surface px-2.5 py-1 text-[12px] text-ink-600 hover:border-ink-300 hover:text-ink-900"
        >
          <Plus className="h-3 w-3" /> New scenario
        </button>
        {menuOpen && (
          <div
            className="absolute left-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-lg border border-hairline bg-surface shadow-lg"
            onMouseLeave={() => setMenuOpen(false)}
          >
            {["Premium", "Lowest Cost", "Value Engineered", "Margin Optimized"].map((p) => (
              <button
                key={p}
                onClick={() => { onNewFromPreset(p); setMenuOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] text-ink-700 hover:bg-surface-alt"
              >
                <Sparkles className="h-3 w-3 text-brand-700" /> {p}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="ml-auto flex items-center gap-1 text-[11px] text-ink-500">
        <Eye className="h-3 w-3" /> Compare across scenarios anytime — nothing overwrites the original.
      </div>
    </div>
  );
}

/* ============================================================
   LEFT — ARTICLE CONTEXT + STAGE NAV
   ============================================================ */

function ArticleContext({
  article,
  inquiry,
  target,
  targetMarginPct,
}: {
  article: Article;
  inquiry: (typeof INQUIRIES)[number] | undefined;
  target: { value: number; currencySymbol: string; label: string };
  targetMarginPct: number;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-surface">
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-alt">
        <img src={article.image} alt={article.name} className="h-full w-full object-cover" />
        <div className="absolute left-3 top-3 rounded-full bg-white/85 px-2 py-0.5 text-[10.5px] font-medium text-ink-700 backdrop-blur">
          {article.articleNo}
        </div>
      </div>
      <div className="space-y-3 p-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.12em] text-ink-400">{article.category}</div>
          <h2 className="mt-1 text-[15px] font-medium leading-snug text-ink-900">{article.name}</h2>
          <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-ink-500">
            <Building2 className="h-3 w-3" /> {article.buyer}
            {inquiry && (
              <>
                <span className="text-ink-300">·</span>
                <Link to="/pods" className="hover:text-ink-900">{inquiry.id}</Link>
              </>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-hairline pt-3 text-[12px]">
          <MetaKV k="Target" v={target.label} strong />
          <MetaKV k="Margin" v={`${targetMarginPct}%`} />
          <MetaKV k="MOQ" v={article.moq} />
          <MetaKV k="Status" v={article.status} />
        </div>
      </div>
    </div>
  );
}

function MetaKV({ k, v, strong = false }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] uppercase tracking-[0.1em] text-ink-400">{k}</div>
      <div className={cn("truncate", strong ? "text-ink-900 font-medium" : "text-ink-700")}>{v}</div>
    </div>
  );
}

function StageNav({
  stages,
  active,
  onChange,
  stageTotals,
  currency,
  selections,
}: {
  stages: Stage[];
  active: string;
  onChange: (choiceId: string) => void;
  stageTotals: Record<string, { cost: number; picks: number; total: number }>;
  currency: string;
  selections: SelectionMap;
}) {
  const activeStageKey = CHOICES_INDEX[active]?.stage.key;
  return (
    <nav className="rounded-2xl border border-hairline bg-surface p-2">
      <ul className="flex flex-col gap-0.5">
        {stages.map((s, i) => {
          const t = stageTotals[s.key];
          const done = t.picks === t.total;
          const isActive = activeStageKey === s.key;
          return (
            <li key={s.key}>
              <button
                onClick={() => onChange(s.choices[0].id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-[12.5px] transition-colors",
                  isActive ? "bg-ink-900 text-white" : "text-ink-700 hover:bg-surface-alt",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] tabular-nums",
                    isActive
                      ? "border-white/30 bg-white/10 text-white"
                      : done
                        ? "border-brand-100 bg-brand-50 text-brand-700"
                        : "border-hairline bg-surface text-ink-500",
                  )}
                >
                  {done ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
                </span>
                <s.icon className={cn("h-3.5 w-3.5", isActive ? "opacity-90" : "opacity-70")} />
                <span className="flex-1 truncate">{s.label}</span>
                <span className={cn("text-[11px] tabular-nums", isActive ? "text-white/80" : "text-ink-500")}>
                  {currency}{t.cost.toFixed(2)}
                </span>
              </button>
              {isActive && (
                <ul className="ml-9 mt-1 space-y-0.5 border-l border-hairline pl-2">
                  {s.choices.map((c) => {
                    const chosen = selections[c.id];
                    const isCurrent = c.id === active;
                    return (
                      <li key={c.id}>
                        <button
                          onClick={() => onChange(c.id)}
                          className={cn(
                            "flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[11.5px]",
                            isCurrent ? "text-ink-900 font-medium" : "text-ink-500 hover:text-ink-900",
                          )}
                        >
                          <span className={cn("h-1 w-1 rounded-full", chosen ? "bg-brand-700" : "bg-ink-300")} />
                          {c.title}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* ============================================================
   PRODUCT PREVIEW — a lightweight digital twin
   ============================================================ */

function ProductPreview({
  article,
  selections,
  currency,
  cost,
}: {
  article: Article;
  selections: SelectionMap;
  currency: string;
  cost: number;
}) {
  const fabric = CHOICES_INDEX["front_fabric"]?.choice.options.find((o) => o.id === selections["front_fabric"]);
  const construction = CHOICES_INDEX["construction"]?.choice.options.find((o) => o.id === selections["construction"]);
  const printing = selections["printing"];
  const embroidery = selections["embroidery"];
  const labels = selections["labels"];
  const pack = selections["pack_type"];
  const width = CHOICES_INDEX["width"]?.choice.options.find((o) => o.id === selections["width"]);

  // Live tint from fabric swatch
  const tint = fabric?.swatch ?? "#EDE6D3";

  return (
    <section className="overflow-hidden rounded-2xl border border-hairline bg-gradient-to-br from-surface via-surface to-surface-alt/40">
      <div className="grid gap-0 lg:grid-cols-[1.15fr_1fr]">
        {/* Preview canvas */}
        <div className="relative aspect-[4/3] overflow-hidden bg-[radial-gradient(ellipse_at_center,_theme(colors.white),_theme(colors.slate.100))]">
          <img
            src={article.image}
            alt={article.name}
            className="absolute inset-0 h-full w-full object-cover transition-all duration-500"
            style={{ filter: "saturate(0.9) contrast(0.95)" }}
          />
          {/* Fabric tint overlay */}
          <div
            className="absolute inset-0 mix-blend-multiply transition-opacity duration-500"
            style={{ backgroundColor: tint, opacity: 0.35 }}
          />
          {/* Construction texture hint */}
          {construction && (
            <div
              className="absolute inset-0 opacity-30 mix-blend-overlay"
              style={{
                backgroundImage:
                  construction.id === "waffle"
                    ? "repeating-linear-gradient(45deg, rgba(255,255,255,0.4) 0 2px, transparent 2px 8px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.4) 0 2px, transparent 2px 8px)"
                    : construction.id === "terry"
                      ? "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.5) 1px, transparent 1.5px)"
                      : "repeating-linear-gradient(0deg, rgba(255,255,255,0.35) 0 1px, transparent 1px 4px)",
                backgroundSize: construction.id === "terry" ? "6px 6px" : "auto",
              }}
            />
          )}
          {/* Print overlay */}
          {printing && printing !== "none" && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md bg-white/85 px-3 py-1 text-[11px] font-medium tracking-wide text-ink-900 shadow-md">
              {printing === "digital" ? "◆ DIGITAL PRINT" : "▲ SCREEN PRINT"}
            </div>
          )}
          {/* Embroidery marker */}
          {embroidery && embroidery !== "no_emb" && (
            <div className="absolute bottom-6 right-6 flex h-9 w-9 items-center justify-center rounded-full border-2 border-dashed border-brand-700 bg-white/70 text-[9px] font-medium uppercase text-brand-700">
              EMB
            </div>
          )}
          {/* Label marker */}
          {labels && (
            <div className="absolute right-5 top-5 rounded-sm border border-ink-200 bg-white/90 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-ink-700 shadow-sm">
              {labels === "leather" ? "Leather" : labels === "printed" ? "Satin" : "Woven"}
            </div>
          )}
          {/* Packaging chip */}
          {pack && (
            <div className="absolute left-5 bottom-5 flex items-center gap-1.5 rounded-full bg-white/90 px-2 py-1 text-[10.5px] font-medium text-ink-700 shadow-sm backdrop-blur">
              <Package className="h-3 w-3 text-brand-700" />
              {pack === "polybag" ? "Polybag" : pack === "kraft" ? "Kraft sleeve" : "Gift box"}
            </div>
          )}
          {/* Width ruler */}
          {width && (
            <div className="absolute right-5 bottom-5 rounded-full bg-ink-900/80 px-2 py-0.5 text-[10px] font-medium tabular-nums text-white">
              ← {width.label} →
            </div>
          )}
        </div>

        {/* Live decisions summary */}
        <div className="flex flex-col justify-between gap-4 p-5">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-brand-700">
              <Sparkles className="h-3 w-3" /> Live product preview
            </div>
            <h3 className="mt-1.5 text-[18px] font-medium tracking-tight text-ink-900">
              {article.name}
            </h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-500">
              The preview updates as you change fabric, print, embroidery, labels, packaging and size. Think of it as a
              simplified digital twin — the merchandiser sees what they are configuring, not just what it costs.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11.5px]">
            <PreviewChip label="Fabric" value={fabric?.label ?? "—"} swatch={fabric?.swatch} />
            <PreviewChip label="Construction" value={construction?.label ?? "—"} />
            <PreviewChip label="Print" value={printing === "none" ? "None" : printing === "digital" ? "Digital" : printing === "screen" ? "Screen" : "—"} />
            <PreviewChip label="Embroidery" value={embroidery === "no_emb" ? "None" : embroidery === "logo_emb" ? "Logo" : embroidery === "premium_emb" ? "Premium" : "—"} />
            <PreviewChip label="Labels" value={labels === "woven" ? "Woven" : labels === "printed" ? "Printed" : labels === "leather" ? "Leather" : "—"} />
            <PreviewChip label="Packaging" value={pack === "polybag" ? "Polybag" : pack === "kraft" ? "Kraft" : pack === "gift_box" ? "Gift box" : "—"} />
          </div>
          <div className="flex items-baseline justify-between rounded-xl bg-ink-900 px-4 py-3 text-white">
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-white/60">Live cost / pc</div>
              <div className="mt-0.5 text-[22px] font-medium leading-none tabular-nums">
                {currency}{cost.toFixed(2)}
              </div>
            </div>
            <div className="text-right text-[11px] text-white/70">
              Recalculated in <br />
              <span className="font-medium text-white">real-time</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PreviewChip({ label, value, swatch }: { label: string; value: string; swatch?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-hairline bg-surface px-2.5 py-2">
      {swatch ? (
        <span className="h-4 w-4 shrink-0 rounded border border-hairline" style={{ background: swatch }} />
      ) : (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-700" />
      )}
      <div className="min-w-0">
        <div className="text-[9.5px] uppercase tracking-[0.1em] text-ink-400">{label}</div>
        <div className="truncate text-[12px] text-ink-900">{value}</div>
      </div>
    </div>
  );
}

/* ============================================================
   STAGE CARDS + CHOICE ROW (kept)
   ============================================================ */

function StageCard({
  stage,
  selections,
  onChange,
  totals,
  currency,
  onExplain,
  activeChoiceId,
  onFocusChoice,
}: {
  stage: Stage;
  selections: SelectionMap;
  onChange: (stageKey: string, choice: Choice, optionId: string) => void;
  totals: { cost: number; picks: number; total: number };
  currency: string;
  onExplain: (choiceId: string) => void;
  activeChoiceId: string;
  onFocusChoice: (cid: string) => void;
}) {
  const Icon = stage.icon;
  const stageActive = stage.choices.some((c) => c.id === activeChoiceId);
  return (
    <section
      id={`stage-${stage.key}`}
      className={cn(
        "rounded-2xl border bg-surface p-5 transition-shadow",
        stageActive ? "border-brand-100 shadow-[0_2px_24px_-12px_rgba(5,96,77,0.18)]" : "border-hairline",
      )}
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-medium tracking-tight text-ink-900">{stage.label}</h3>
            <span className="rounded-full bg-surface-alt px-1.5 py-0.5 text-[10.5px] text-ink-500">
              {totals.picks}/{totals.total}
            </span>
          </div>
          <p className="text-[11.5px] text-ink-500">
            {totals.picks === totals.total ? "All decisions made" : "Choose the remaining options"}
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10.5px] uppercase tracking-[0.1em] text-ink-400">Subtotal</div>
          <div className="text-[15px] font-medium tabular-nums text-ink-900">
            {currency}{totals.cost.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {stage.choices.map((choice) => (
          <ChoiceRow
            key={choice.id}
            choice={choice}
            selectedId={selections[choice.id]}
            onSelect={(id) => onChange(stage.key, choice, id)}
            currency={currency}
            onExplain={() => onExplain(choice.id)}
            active={choice.id === activeChoiceId}
            onFocus={() => onFocusChoice(choice.id)}
          />
        ))}
      </div>
    </section>
  );
}

function ChoiceRow({
  choice,
  selectedId,
  onSelect,
  currency,
  onExplain,
  active,
  onFocus,
}: {
  choice: Choice;
  selectedId: string;
  onSelect: (id: string) => void;
  currency: string;
  onExplain: () => void;
  active: boolean;
  onFocus: () => void;
}) {
  return (
    <div
      id={`choice-${choice.id}`}
      onMouseEnter={onFocus}
      onClick={onFocus}
      className={cn(
        "rounded-xl p-2 -mx-2 transition-colors",
        active && "bg-brand-50/40 ring-1 ring-brand-100",
      )}
    >
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div>
          <div className="text-[13px] font-medium text-ink-900">{choice.title}</div>
          {choice.hint && <div className="text-[11.5px] text-ink-500">{choice.hint}</div>}
        </div>
        <button onClick={onExplain} className="inline-flex items-center gap-1 text-[11px] text-ink-500 hover:text-ink-900">
          <Info className="h-3 w-3" /> Explain
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {choice.options.map((opt) => {
          const activeOpt = opt.id === selectedId;
          return (
            <button
              key={opt.id}
              onClick={() => onSelect(opt.id)}
              className={cn(
                "group relative flex flex-col gap-2 rounded-xl border p-3 text-left transition-all",
                activeOpt
                  ? "border-brand-700 bg-surface shadow-[0_2px_16px_-8px_rgba(5,96,77,0.35)]"
                  : "border-hairline bg-surface hover:border-ink-200 hover:bg-surface-alt/50",
              )}
            >
              <div className="flex items-start gap-2.5">
                {opt.swatch ? (
                  <span className="mt-0.5 h-6 w-6 shrink-0 rounded-md border border-hairline" style={{ background: opt.swatch }} />
                ) : (
                  <span
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                      activeOpt ? "border-brand-700 bg-brand-700 text-white" : "border-ink-200 bg-surface",
                    )}
                  >
                    {activeOpt && <CheckCircle2 className="h-3 w-3" />}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-medium leading-snug text-ink-900">{opt.label}</div>
                  {opt.meta && <div className="mt-0.5 truncate text-[11px] text-ink-500">{opt.meta}</div>}
                </div>
                <div className="text-right text-[12px] tabular-nums text-ink-700">
                  {opt.cost === 0 ? (
                    <span className="text-ink-400">incl.</span>
                  ) : (
                    <span>{opt.cost < 0 ? "−" : "+"}{currency}{Math.abs(opt.cost).toFixed(2)}</span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {opt.badge && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wide",
                      opt.badge === "AI pick" ? "bg-gold-100 text-gold-700" : "bg-brand-50 text-brand-700",
                    )}
                  >
                    {opt.badge === "AI pick" ? <Sparkles className="h-2.5 w-2.5" /> : <BadgeCheck className="h-2.5 w-2.5" />}
                    {opt.badge}
                  </span>
                )}
                {opt.lead != null && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-alt px-1.5 py-0.5 text-[10px] text-ink-500">
                    <Clock className="h-2.5 w-2.5" /> {opt.lead}d
                  </span>
                )}
                {opt.quality && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-alt px-1.5 py-0.5 text-[10px] text-ink-500">
                    <ShieldCheck className="h-2.5 w-2.5" /> {opt.quality}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   VALUE ENGINEERING PRESETS
   ============================================================ */

const PRESETS = [
  { key: "Standard", tag: "Balanced", desc: "Our default mix — proven track record." },
  { key: "Premium", tag: "Higher quality", desc: "Best materials, longer lead time." },
  { key: "Value Engineered", tag: "Cost saving", desc: "AI-optimized without hurting quality." },
  { key: "Margin Optimized", tag: "Best margin", desc: "Squeeze every point of profitability." },
] as const;

function ValueEngineering({ onApply }: { onApply: (preset: string) => void }) {
  return (
    <section className="rounded-2xl border border-hairline bg-gradient-to-br from-brand-50/60 to-transparent p-5">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700 text-white">
          <Wand2 className="h-4 w-4" />
        </div>
        <div>
          <div className="text-[15px] font-medium text-ink-900">Apply an AI preset to this scenario</div>
          <p className="text-[12px] text-ink-500">Batch-updates the current scenario. Duplicate first if you want to keep the original.</p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => onApply(p.key)}
            className="group flex flex-col gap-1 rounded-xl border border-hairline bg-surface p-3 text-left transition-all hover:border-brand-700 hover:shadow-[0_2px_16px_-8px_rgba(5,96,77,0.25)]"
          >
            <div className="text-[10.5px] uppercase tracking-[0.1em] text-brand-700">{p.tag}</div>
            <div className="text-[13px] font-medium text-ink-900">{p.key}</div>
            <div className="text-[11.5px] leading-snug text-ink-500">{p.desc}</div>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ============================================================
   RIGHT PANEL — LIVE INTELLIGENCE
   ============================================================ */

function CostIntelligence({
  target,
  currentCost,
  desiredCost,
  remainingBudget,
  actualMarginPct,
  targetMarginPct,
  confidence,
  totalLead,
}: {
  target: { value: number; currencySymbol: string; label: string };
  currentCost: number;
  desiredCost: number;
  remainingBudget: number;
  actualMarginPct: number;
  targetMarginPct: number;
  confidence: number;
  totalLead: number;
}) {
  const overBudget = remainingBudget < 0;
  const pctOfTarget = target.value > 0 ? Math.min(100, (currentCost / target.value) * 100) : 0;
  return (
    <div className="rounded-2xl border border-hairline bg-surface p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.12em] text-ink-400">Live cost</div>
          <div className="mt-0.5 text-[26px] font-medium leading-none tabular-nums text-ink-900">
            {target.currencySymbol}{currentCost.toFixed(2)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10.5px] uppercase tracking-[0.12em] text-ink-400">Target</div>
          <div className="mt-0.5 text-[15px] tabular-nums text-ink-700">{target.label}</div>
        </div>
      </div>

      <div className="relative h-2 overflow-hidden rounded-full bg-surface-alt">
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full transition-all", overBudget ? "bg-danger" : "bg-brand-700")}
          style={{ width: `${pctOfTarget}%` }}
        />
        {target.value > 0 && (
          <div
            className="absolute inset-y-0 w-0.5 bg-ink-900"
            style={{ left: `${(desiredCost / target.value) * 100}%` }}
            title={`Target cost @ ${targetMarginPct}% margin`}
          />
        )}
      </div>
      <div className="mt-1 flex justify-between text-[10.5px] text-ink-400">
        <span>0</span>
        <span>Ideal · {target.currencySymbol}{desiredCost.toFixed(2)}</span>
        <span>{target.label}</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Metric label="Margin" value={`${actualMarginPct.toFixed(1)}%`} hint={`Target ${targetMarginPct}%`} tone={actualMarginPct >= targetMarginPct ? "good" : actualMarginPct >= targetMarginPct - 5 ? "warn" : "bad"} />
        <Metric label="Budget left" value={`${target.currencySymbol}${remainingBudget.toFixed(2)}`} hint={overBudget ? "Over target" : "Room to move"} tone={overBudget ? "bad" : "good"} />
        <Metric label="Confidence" value={`${confidence}%`} hint={confidence >= 85 ? "High" : confidence >= 70 ? "Moderate" : "Needs data"} tone={confidence >= 85 ? "good" : confidence >= 70 ? "warn" : "bad"} />
        <Metric label="Lead time" value={`${totalLead} d`} hint="Longest supplier" tone={totalLead <= 25 ? "good" : totalLead <= 30 ? "warn" : "bad"} />
      </div>
    </div>
  );
}

function Metric({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: "good" | "warn" | "bad" }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface-alt/40 p-2.5">
      <div className="text-[10.5px] uppercase tracking-[0.1em] text-ink-400">{label}</div>
      <div className={cn("mt-0.5 text-[15px] font-medium tabular-nums", tone === "good" && "text-brand-700", tone === "warn" && "text-gold-700", tone === "bad" && "text-danger")}>
        {value}
      </div>
      <div className="text-[10.5px] text-ink-500">{hint}</div>
    </div>
  );
}

/* ============================================================
   CONTEXTUAL COPILOT — changes with the choice being edited
   ============================================================ */

function ContextualCopilot({
  activeChoiceId,
  selections,
  currency,
  onApply,
}: {
  activeChoiceId: string;
  selections: SelectionMap;
  currency: string;
  onApply: (choiceId: string, optionId: string) => void;
}) {
  const entry = CHOICES_INDEX[activeChoiceId];
  if (!entry) return null;
  const { choice, stage } = entry;
  const chosen = choice.options.find((o) => o.id === selections[activeChoiceId]);

  const content = getCopilotContent(choice.id, chosen?.id);

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-100 bg-surface">
      <div className="flex items-center gap-2 border-b border-brand-100 bg-brand-50/60 px-4 py-2.5">
        <Sparkles className="h-3.5 w-3.5 text-brand-700" />
        <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-brand-700">
          Copilot · {stage.label} / {choice.title}
        </div>
      </div>
      <div className="space-y-3 p-4">
        <p className="text-[12.5px] leading-relaxed text-ink-700">{content.headline}</p>

        {content.compare && (
          <div className="space-y-1.5">
            <div className="text-[10.5px] uppercase tracking-[0.1em] text-ink-400">Comparison</div>
            {choice.options.map((o) => {
              const active = o.id === selections[activeChoiceId];
              return (
                <div
                  key={o.id}
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-2.5 py-2 text-[11.5px]",
                    active ? "border-brand-700 bg-brand-50/40" : "border-hairline bg-surface",
                  )}
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-ink-900">{o.label}</div>
                    {o.meta && <div className="truncate text-[10.5px] text-ink-500">{o.meta}</div>}
                  </div>
                  <div className="ml-3 shrink-0 text-right">
                    <div className="tabular-nums text-ink-700">
                      {o.cost === 0 ? "incl." : `${o.cost < 0 ? "−" : "+"}${currency}${Math.abs(o.cost).toFixed(2)}`}
                    </div>
                    <div className="text-[10px] text-ink-500">{o.lead ? `${o.lead}d` : "—"} · {o.quality ?? "—"}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {content.recommendations.length > 0 && (
          <div className="space-y-2">
            <div className="text-[10.5px] uppercase tracking-[0.1em] text-ink-400">AI recommendation</div>
            {content.recommendations.map((r, i) => (
              <div key={i} className="rounded-lg border border-hairline p-2.5">
                <div className="text-[12px] font-medium text-ink-900">{r.title}</div>
                <div className="mt-0.5 text-[11.5px] leading-snug text-ink-500">{r.reason}</div>
                {r.applyOption && r.applyOption !== selections[choice.id] && (
                  <button
                    onClick={() => onApply(choice.id, r.applyOption!)}
                    className="mt-1.5 text-[11.5px] font-medium text-brand-700 hover:underline"
                  >
                    Apply recommendation →
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {content.risks.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[10.5px] uppercase tracking-[0.1em] text-ink-400">Risks</div>
            {content.risks.map((r, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg bg-gold-50/50 px-2.5 py-2 text-[11.5px]">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-gold-700" />
                <span className="text-ink-700">{r}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type CopilotContent = {
  headline: string;
  compare: boolean;
  recommendations: { title: string; reason: string; applyOption?: string }[];
  risks: string[];
};

function getCopilotContent(choiceId: string, _chosenId: string | undefined): CopilotContent {
  switch (choiceId) {
    case "front_fabric":
      return {
        headline:
          "500 GSM has cleared M&S QC on the last 6 waffle programs. Moving to 600 GSM adds hand-feel but 3 extra shipping days.",
        compare: true,
        recommendations: [
          {
            title: "Stay at 500 GSM combed",
            reason: "Buyer accepted 500 GSM on 6/6 recent orders. Delta at 600 GSM = +$0.40/pc with no buyer benefit.",
            applyOption: "cotton_500",
          },
        ],
        risks: ["Cotton index moved +2.1% this week — lock supplier rates within 5 days."],
      };
    case "supplier":
      return {
        headline:
          "Supplier B — Karur has produced 18 similar orders for this buyer with 96% on-time and 24.6% average margin.",
        compare: true,
        recommendations: [
          {
            title: "Use Supplier B — Karur",
            reason: "Historically achieved 3.1% higher margins on this construction. Fastest lead time in the pool.",
            applyOption: "sup_b",
          },
        ],
        risks: [
          "Supplier C is new for this construction — allow +5 days for approval sample.",
        ],
      };
    case "construction":
      return {
        headline: "Waffle is your default for this buyer. Jacquard changes the loom and adds 4 days.",
        compare: true,
        recommendations: [
          { title: "Keep waffle", reason: "Matches AW26 tech pack and existing loom capacity.", applyOption: "waffle" },
        ],
        risks: [],
      };
    case "printing":
      return {
        headline:
          "At this MOQ, digital printing is ~7% cheaper than screen with equivalent buyer acceptance.",
        compare: true,
        recommendations: [
          { title: "Switch to digital", reason: "Break-even vs screen is at 4,800 pcs — you are below that.", applyOption: "digital" },
        ],
        risks: ["Screen print requires 3-week color approval cycle."],
      };
    case "embroidery":
      return {
        headline: "Buyer has not requested embroidery on this article — recommend keeping it off.",
        compare: true,
        recommendations: [
          { title: "Skip embroidery", reason: "Removes $0.22–$0.48/pc with no impact on buyer QC.", applyOption: "no_emb" },
        ],
        risks: [],
      };
    case "labels":
      return {
        headline: "Woven label is buyer standard. Leather adds premium feel but +$0.18/pc.",
        compare: true,
        recommendations: [
          { title: "Use woven label", reason: "Matches buyer artwork on file. Lowest cost with brand compliance.", applyOption: "woven" },
        ],
        risks: [],
      };
    case "pack_type":
      return {
        headline:
          "Polybag has been accepted on the last 6 orders for this buyer. Kraft/gift box only if buyer confirms retail-ready need.",
        compare: true,
        recommendations: [
          { title: "Keep polybag", reason: "No packaging upgrade requested. Saves $0.08–$0.36/pc.", applyOption: "polybag" },
        ],
        risks: ["Gift box adds 6 days of sourcing lead time from Panipat."],
      };
    default:
      return {
        headline: "Every option below shows cost, lead-time and quality impact. Choose based on buyer expectations.",
        compare: true,
        recommendations: [],
        risks: [],
      };
  }
}

/* ============================================================
   COST STORY
   ============================================================ */

function CostStory({ mix, currency }: { mix: { key: string; label: string; pct: number; cost: number }[]; currency: string }) {
  const top = mix[0];
  return (
    <div className="rounded-2xl border border-gold-100 bg-gold-50/50 p-4">
      <div className="mb-2 flex items-center gap-2">
        <History className="h-3.5 w-3.5 text-gold-700" />
        <div className="text-[12px] font-medium uppercase tracking-[0.1em] text-gold-700">Cost story</div>
      </div>
      <p className="text-[12.5px] leading-relaxed text-ink-700">
        <span className="font-medium text-ink-900">{top?.label ?? "Material"}</span> is where the money is going —{" "}
        <span className="font-medium">{top?.pct ?? 0}%</span> of total cost. Biggest lever right now is the supplier
        pick.
      </p>
      <div className="mt-3 space-y-1.5">
        {mix.slice(0, 5).map((row) => (
          <div key={row.key} className="text-[11px]">
            <div className="flex justify-between text-ink-600">
              <span>{row.label}</span>
              <span className="tabular-nums">{currency}{row.cost.toFixed(2)} · {row.pct}%</span>
            </div>
            <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-brand-700" style={{ width: `${row.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   HISTORICAL INTELLIGENCE + EVOLUTION LOG
   ============================================================ */

function HistoricalIntel() {
  return (
    <div className="rounded-2xl border border-hairline bg-surface p-4">
      <div className="mb-2 flex items-center gap-2">
        <History className="h-3.5 w-3.5 text-brand-700" />
        <div className="text-[12px] font-medium uppercase tracking-[0.1em] text-ink-500">Historical intelligence</div>
      </div>
      <p className="text-[12px] text-ink-500">
        We've manufactured <span className="font-medium text-ink-900">18 similar products</span> for this buyer over the last 3 years.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11.5px]">
        <StatTile label="Winning quote rate" value="72%" />
        <StatTile label="Avg. margin achieved" value="24.6%" />
        <StatTile label="Top supplier" value="Supplier B" />
        <StatTile label="Avg. lead time" value="26 d" />
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface-alt/40 p-2">
      <div className="text-[10px] uppercase tracking-[0.1em] text-ink-400">{label}</div>
      <div className="mt-0.5 text-[13px] font-medium text-ink-900">{value}</div>
    </div>
  );
}

function EvolutionLog({ entries }: { entries: EvolutionEntry[] }) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface p-4">
      <div className="mb-2 flex items-center gap-2">
        <MessageSquare className="h-3.5 w-3.5 text-ink-500" />
        <div className="text-[12px] font-medium uppercase tracking-[0.1em] text-ink-500">Product evolution</div>
      </div>
      {entries.length === 0 ? (
        <p className="text-[11.5px] text-ink-500">
          Every change you make gets logged here so the team can see how the product got to its final shape.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {entries.slice(0, 8).map((e) => (
            <li key={e.id} className="border-l-2 border-hairline pl-3">
              <div className="text-[12px] font-medium text-ink-900">{e.choiceTitle}</div>
              <div className="text-[11px] text-ink-500">
                {e.fromLabel} → {e.toLabel}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[10.5px] text-ink-400">
                <span>{e.who} · {e.when}</span>
                {e.costDelta !== 0 && (
                  <span className={cn("tabular-nums", e.costDelta < 0 ? "text-brand-700" : "text-gold-700")}>
                    {e.costDelta < 0 ? "▼" : "▲"} {Math.abs(e.costDelta).toFixed(2)}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ============================================================
   EXPLAIN COST MODAL
   ============================================================ */

function ExplainCostModal({
  choiceId,
  selections,
  currency,
  onClose,
}: {
  choiceId: string;
  selections: SelectionMap;
  currency: string;
  onClose: () => void;
}) {
  const choice = CHOICES_INDEX[choiceId]?.choice;
  if (!choice) return null;
  const chosen = choice.options.find((o) => o.id === selections[choiceId]);
  if (!chosen) return null;

  const rows = [
    { k: "Raw material", v: Math.max(0.01, chosen.cost * 0.55) },
    { k: "Processing", v: Math.max(0.01, chosen.cost * 0.2) },
    { k: "Labor", v: Math.max(0.01, chosen.cost * 0.15) },
    { k: "Waste allowance", v: Math.max(0.01, chosen.cost * 0.1) },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-hairline bg-surface p-5 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.12em] text-ink-400">Explain my cost</div>
            <div className="mt-0.5 text-[15px] font-medium text-ink-900">{choice.title}</div>
            <div className="text-[12px] text-ink-500">{chosen.label}</div>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-900" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="rounded-xl border border-hairline bg-surface-alt/40 p-3">
          <ul className="space-y-1.5">
            {rows.map((r) => (
              <li key={r.k} className="flex items-center justify-between text-[12px]">
                <span className="text-ink-600">{r.k}</span>
                <span className="tabular-nums text-ink-900">{currency}{r.v.toFixed(2)}</span>
              </li>
            ))}
            <li className="mt-1 flex items-center justify-between border-t border-hairline pt-1.5 text-[12.5px] font-medium">
              <span className="text-ink-900">Total contribution</span>
              <span className="tabular-nums text-ink-900">{currency}{chosen.cost.toFixed(2)}</span>
            </li>
          </ul>
        </div>
        <p className="mt-3 text-[11.5px] leading-relaxed text-ink-500">
          Costs shown are per finished piece and include a standard waste allowance based on historical production runs.
        </p>
      </div>
    </div>
  );
}

/* ============================================================
   HELPERS
   ============================================================ */

function ImpactChip({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  return (
    <span
      className={cn(
        "ml-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium",
        positive ? "bg-brand-50 text-brand-700" : "bg-gold-50 text-gold-700",
      )}
    >
      {positive ? <TrendingDown className="h-2.5 w-2.5" /> : <TrendingUp className="h-2.5 w-2.5" />}
      {label} {value}
    </span>
  );
}

function fmtSignedMoney(v: number, currency: string) {
  const sign = v < 0 ? "−" : "+";
  return `${sign}${currency}${Math.abs(v).toFixed(2)}`;
}

function parseTargetPrice(input: string): { value: number; currencySymbol: string; label: string } {
  const symbol = input.match(/[£$€₹]/)?.[0] ?? "$";
  const num = parseFloat(input.replace(/[^\d.]/g, "")) || 0;
  return { value: num, currencySymbol: symbol, label: input };
}

function computeReadiness(
  totals: Record<string, { picks: number; total: number }>,
  marginPct: number,
): number {
  const totalPicks = Object.values(totals).reduce((a, b) => a + b.picks, 0);
  const totalNeeded = Object.values(totals).reduce((a, b) => a + b.total, 0);
  const configPct = (totalPicks / Math.max(totalNeeded, 1)) * 70;
  const marginPctScore = Math.min(30, Math.max(0, marginPct));
  return Math.round(configPct + marginPctScore);
}

/* ============================================================
   WORKSPACE TABS
   ============================================================ */

type WorkspaceTab = "build" | "flow" | "compare" | "analytics" | "history";

const WORKSPACE_TABS: { key: WorkspaceTab; label: string; hint: string }[] = [
  { key: "build", label: "Build", hint: "Configure the product" },
  { key: "flow", label: "Cost Flow", hint: "How the money adds up" },
  { key: "compare", label: "Compare", hint: "Scenarios side by side" },
  { key: "analytics", label: "Analytics", hint: "Commercial intelligence" },
  { key: "history", label: "History", hint: "Every decision, logged" },
];

function WorkspaceTabs({
  active,
  onChange,
}: {
  active: WorkspaceTab;
  onChange: (t: WorkspaceTab) => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-1 rounded-xl border border-hairline bg-surface p-1">
      {WORKSPACE_TABS.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={cn(
              "flex-1 min-w-[110px] rounded-lg px-3 py-2 text-left transition-all",
              isActive
                ? "bg-ink-900 text-white shadow-sm"
                : "text-ink-600 hover:bg-surface-alt hover:text-ink-900",
            )}
          >
            <div className="text-[12.5px] font-medium leading-tight">{t.label}</div>
            <div className={cn("mt-0.5 text-[10.5px] leading-tight", isActive ? "text-white/70" : "text-ink-400")}>
              {t.hint}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================
   COST JOURNEY — persistent live timeline
   ============================================================ */

function CostJourney({
  stages,
  stageTotals,
  currentCost,
  target,
  activeStageKey,
  onJump,
}: {
  stages: Stage[];
  stageTotals: Record<string, { cost: number; picks: number; total: number }>;
  currentCost: number;
  target: { value: number; currencySymbol: string; label: string };
  activeStageKey: string;
  onJump: (stageKey: string) => void;
}) {
  const cur = target.currencySymbol;
  const overBudget = currentCost > target.value && target.value > 0;
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-hairline bg-gradient-to-r from-surface via-surface to-surface-alt/40">
      <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="text-[10.5px] uppercase tracking-[0.12em] text-brand-700">Cost journey</div>
          <span className="text-[11px] text-ink-500">Live — updates as you decide.</span>
        </div>
        <div className="flex items-baseline gap-2 text-[12px] text-ink-500">
          Target
          <span className="tabular-nums text-ink-900">{target.label}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-stretch gap-1 p-3 sm:flex-nowrap">
        {stages.map((s, i) => {
          const t = stageTotals[s.key];
          const isActive = s.key === activeStageKey;
          const done = t.picks === t.total;
          const Icon = s.icon;
          return (
            <div key={s.key} className="flex flex-1 items-stretch min-w-[130px]">
              <button
                onClick={() => onJump(s.key)}
                className={cn(
                  "group flex-1 rounded-lg border px-3 py-2 text-left transition-all",
                  isActive
                    ? "border-brand-700 bg-brand-50/50 shadow-[0_2px_16px_-10px_rgba(5,96,77,0.4)]"
                    : "border-transparent hover:border-hairline hover:bg-surface-alt/60",
                )}
              >
                <div className="flex items-center gap-1.5">
                  <Icon className={cn("h-3 w-3", isActive ? "text-brand-700" : "text-ink-500")} />
                  <span className="text-[11px] font-medium text-ink-700">{s.label}</span>
                  {done && <CheckCircle2 className="ml-auto h-3 w-3 text-brand-700" />}
                </div>
                <div className="mt-1 text-[15px] font-medium tabular-nums text-ink-900">
                  {i === 0 ? `${cur}${t.cost.toFixed(2)}` : `+${cur}${t.cost.toFixed(2)}`}
                </div>
                <div className="text-[10px] text-ink-400 tabular-nums">
                  {t.picks}/{t.total} decisions
                </div>
              </button>
              {i < stages.length - 1 && (
                <div className="hidden items-center px-0.5 text-ink-300 sm:flex">
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          );
        })}
        <div className="flex items-center">
          <div className={cn(
            "ml-1 min-w-[130px] rounded-lg px-3 py-2 text-white shadow-sm",
            overBudget ? "bg-danger" : "bg-ink-900",
          )}>
            <div className="text-[10px] uppercase tracking-[0.12em] text-white/60">Final cost</div>
            <div className="mt-1 text-[17px] font-medium tabular-nums leading-none">
              {cur}{currentCost.toFixed(2)}
            </div>
            <div className="mt-0.5 text-[10px] text-white/70">
              {overBudget ? "Over target" : `${cur}${Math.max(0, target.value - currentCost).toFixed(2)} left`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   AMBIENT AI STRIP — one contextual nudge, dismissible feel
   ============================================================ */

function AmbientAiStrip({
  activeChoiceId,
  selections,
  onApply,
}: {
  activeChoiceId: string;
  selections: SelectionMap;
  onApply: (choiceId: string, optionId: string) => void;
}) {
  const entry = CHOICES_INDEX[activeChoiceId];
  if (!entry) return null;
  const content = getCopilotContent(entry.choice.id, selections[entry.choice.id]);
  const rec = content.recommendations.find((r) => r.applyOption && r.applyOption !== selections[entry.choice.id]);
  if (!rec) return null;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-brand-100 bg-gradient-to-r from-brand-50/70 to-transparent px-4 py-2.5">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white">
        <Sparkles className="h-3 w-3" />
      </div>
      <div className="flex-1 text-[12.5px] text-ink-700">
        <span className="font-medium text-ink-900">AI:</span> {rec.reason}
      </div>
      <button
        onClick={() => rec.applyOption && onApply(entry.choice.id, rec.applyOption)}
        className="shrink-0 rounded-md border border-brand-700 bg-white px-2.5 py-1 text-[11.5px] font-medium text-brand-700 hover:bg-brand-50"
      >
        Apply
      </button>
    </div>
  );
}

/* ============================================================
   STAGE WORKSPACE — focused, progressive decision builder
   ============================================================ */

function StageWorkspace({
  stage,
  stageIndex,
  totalStages,
  selections,
  onChange,
  totals,
  currency,
  onExplain,
  activeChoiceId,
  onFocusChoice,
  onPrev,
  onNext,
}: {
  stage: Stage;
  stageIndex: number;
  totalStages: number;
  selections: SelectionMap;
  onChange: (stageKey: string, choice: Choice, optionId: string) => void;
  totals: { cost: number; picks: number; total: number };
  currency: string;
  onExplain: (choiceId: string) => void;
  activeChoiceId: string;
  onFocusChoice: (cid: string) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const Icon = stage.icon;
  return (
    <section className="rounded-2xl border border-hairline bg-surface p-5">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-700 text-white shadow-sm">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="flex-1">
          <div className="text-[10.5px] uppercase tracking-[0.12em] text-brand-700">
            Stage {stageIndex + 1} of {totalStages}
          </div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-[20px] font-medium tracking-tight text-ink-900">{stage.label}</h2>
            <span className="text-[11.5px] text-ink-500">
              {totals.picks}/{totals.total} decisions made
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10.5px] uppercase tracking-[0.1em] text-ink-400">Stage subtotal</div>
          <div className="text-[18px] font-medium tabular-nums text-ink-900">
            {currency}{totals.cost.toFixed(2)}
          </div>
        </div>
      </div>

      {/* progressive decisions */}
      <div className="space-y-6">
        {stage.choices.map((choice, i) => {
          const prev = stage.choices.slice(0, i);
          const locked = prev.some((p) => !selections[p.id]);
          const previousChoice = prev[prev.length - 1];
          return (
            <div key={choice.id} className="relative">
              {i > 0 && (
                <div className="absolute -top-3.5 left-4 flex h-3 items-center text-ink-300">
                  <div className="h-3 w-px bg-ink-200" />
                </div>
              )}
              {locked ? (
                <div className="flex items-center gap-3 rounded-xl border border-dashed border-hairline bg-surface-alt/40 px-4 py-3 text-[12px] text-ink-500">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface text-ink-400 tabular-nums text-[11px]">
                    {i + 1}
                  </span>
                  <span className="flex-1">
                    <span className="font-medium text-ink-700">{choice.title}</span> unlocks after you pick{" "}
                    <span className="text-ink-900">{previousChoice?.title}</span>.
                  </span>
                </div>
              ) : (
                <div className="flex items-baseline gap-2 pl-1">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-50 text-[10.5px] font-medium tabular-nums text-brand-700">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <ChoiceRow
                      choice={choice}
                      selectedId={selections[choice.id]}
                      onSelect={(id) => onChange(stage.key, choice, id)}
                      currency={currency}
                      onExplain={() => onExplain(choice.id)}
                      active={choice.id === activeChoiceId}
                      onFocus={() => onFocusChoice(choice.id)}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* stage stepper */}
      <div className="mt-6 flex items-center justify-between border-t border-hairline pt-4">
        <button
          onClick={onPrev}
          disabled={stageIndex === 0}
          className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 py-1.5 text-[12.5px] text-ink-700 hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Previous stage
        </button>
        <div className="hidden gap-1 sm:flex">
          {Array.from({ length: totalStages }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1 w-6 rounded-full",
                i < stageIndex ? "bg-brand-700" : i === stageIndex ? "bg-brand-700/60" : "bg-ink-200",
              )}
            />
          ))}
        </div>
        <button
          onClick={onNext}
          disabled={stageIndex === totalStages - 1}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-3.5 py-1.5 text-[12.5px] font-medium text-white shadow-sm hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-ink-300"
        >
          Next stage <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  );
}

/* ============================================================
   DEPENDENCY MAP — visualise what a change affects downstream
   ============================================================ */

const DEPENDENCIES: Record<string, string[]> = {
  front_fabric: ["construction", "printing", "supplier"],
  supplier: ["construction"],
  construction: ["printing", "embroidery"],
  printing: ["labels", "pack_type"],
  embroidery: ["pack_type"],
  labels: ["pack_type"],
  pack_type: ["inner_pack", "outer"],
  inner_pack: ["outer"],
};

function DependencyMap({
  activeChoiceId,
  selections,
  onJump,
}: {
  activeChoiceId: string;
  selections: SelectionMap;
  onJump: (choiceId: string) => void;
}) {
  const affects = DEPENDENCIES[activeChoiceId] ?? [];
  const entry = CHOICES_INDEX[activeChoiceId];
  if (!entry) return null;
  return (
    <section className="rounded-2xl border border-hairline bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <GitBranch className="h-3.5 w-3.5 text-brand-700" />
        <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-brand-700">
          Dependency map
        </div>
        <span className="text-[11.5px] text-ink-500">
          What changes if you edit <span className="text-ink-900">{entry.choice.title}</span>?
        </span>
      </div>
      {affects.length === 0 ? (
        <div className="text-[12px] text-ink-500">
          This decision doesn't cascade to other choices.
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-brand-700 bg-brand-50/60 px-2.5 py-1.5 text-[12px] font-medium text-brand-700">
            {entry.choice.title}
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-ink-400" />
          {affects.map((cid) => {
            const c = CHOICES_INDEX[cid]?.choice;
            if (!c) return null;
            const hasPick = !!selections[cid];
            return (
              <button
                key={cid}
                onClick={() => onJump(cid)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-[12px] text-ink-700 hover:border-brand-700 hover:text-brand-700"
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", hasPick ? "bg-brand-700" : "bg-ink-300")} />
                {c.title}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ============================================================
   COST FLOW VIEW — sankey-lite waterfall
   ============================================================ */

function CostFlowView({
  stages,
  selections,
  stageTotals,
  currentCost,
  currency,
  onJump,
}: {
  stages: Stage[];
  selections: SelectionMap;
  stageTotals: Record<string, { cost: number; picks: number; total: number }>;
  currentCost: number;
  currency: string;
  onJump: (choiceId: string) => void;
}) {
  const max = Math.max(currentCost, 0.01);
  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-hairline bg-surface p-5">
        <div className="mb-1 text-[10.5px] uppercase tracking-[0.12em] text-brand-700">Cost flow</div>
        <h2 className="text-[18px] font-medium tracking-tight text-ink-900">
          How every decision builds the final cost
        </h2>
        <p className="mt-1 text-[12.5px] text-ink-500">
          Click any node to jump to that decision in the Build tab.
        </p>
      </div>

      <div className="space-y-3">
        {stages.map((s) => {
          const st = stageTotals[s.key];
          const Icon = s.icon;
          return (
            <div key={s.key} className="rounded-2xl border border-hairline bg-surface p-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="text-[13.5px] font-medium text-ink-900">{s.label}</div>
                  <div className="text-[11px] text-ink-500">Contributes {((st.cost / max) * 100).toFixed(1)}% of total</div>
                </div>
                <div className="text-[15px] font-medium tabular-nums text-ink-900">
                  {currency}{st.cost.toFixed(2)}
                </div>
              </div>
              <div className="space-y-2">
                {s.choices.map((c) => {
                  const opt = c.options.find((o) => o.id === selections[c.id]);
                  const width = opt ? Math.max(4, (opt.cost / max) * 100) : 0;
                  return (
                    <button
                      key={c.id}
                      onClick={() => onJump(c.id)}
                      className="group flex w-full items-center gap-3 text-left"
                    >
                      <div className="w-32 shrink-0 text-[11.5px] text-ink-600 group-hover:text-brand-700 truncate">
                        {c.title}
                      </div>
                      <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-surface-alt">
                        {opt && (
                          <div
                            className="absolute inset-y-0 left-0 rounded-md bg-gradient-to-r from-brand-700 to-brand-600 transition-all group-hover:from-brand-800"
                            style={{ width: `${width}%` }}
                          />
                        )}
                        <div className="absolute inset-0 flex items-center px-2 text-[11px] text-white mix-blend-difference">
                          {opt?.label ?? "Not selected"}
                        </div>
                      </div>
                      <div className="w-16 shrink-0 text-right text-[11.5px] tabular-nums text-ink-700">
                        {opt ? `${opt.cost < 0 ? "−" : ""}${currency}${Math.abs(opt.cost).toFixed(2)}` : "—"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-ink-900 px-5 py-4 text-white">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.14em] text-white/60">Final cost / piece</div>
          <div className="mt-0.5 text-[26px] font-medium tabular-nums leading-none">
            {currency}{currentCost.toFixed(2)}
          </div>
        </div>
        <div className="text-right text-[11.5px] text-white/70 max-w-[280px]">
          Every option you selected — and skipped — flows into this number in real time.
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   COMPARISON VIEW — scenarios side by side
   ============================================================ */

function ComparisonView({
  scenarios,
  metrics,
  target,
  activeId,
  onNewFromPreset,
}: {
  scenarios: Scenario[];
  metrics: { id: string; cost: number; margin: number; lead: number }[];
  target: { value: number; currencySymbol: string; label: string };
  activeId: string;
  onNewFromPreset: (preset: string) => void;
}) {
  const cur = target.currencySymbol;
  const base = metrics.find((m) => m.id === activeId) ?? metrics[0];
  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-hairline bg-surface p-5">
        <div className="mb-1 text-[10.5px] uppercase tracking-[0.12em] text-brand-700">Compare</div>
        <h2 className="text-[18px] font-medium tracking-tight text-ink-900">
          Scenarios side by side
        </h2>
        <p className="mt-1 text-[12.5px] text-ink-500">
          Every scenario preserves the full configuration. Adding a new one never overwrites the current work.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {["Premium", "Lowest Cost", "Value Engineered", "Margin Optimized"].map((p) => (
            <button
              key={p}
              onClick={() => onNewFromPreset(p)}
              className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-hairline bg-surface px-3 py-1 text-[12px] text-ink-600 hover:border-brand-700 hover:text-brand-700"
            >
              <Plus className="h-3 w-3" /> {p}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-hairline bg-surface">
        <div className="grid grid-cols-[160px_repeat(auto-fit,minmax(180px,1fr))]">
          <div className="border-b border-r border-hairline bg-surface-alt/40 px-4 py-3 text-[11px] uppercase tracking-[0.1em] text-ink-500">
            Metric
          </div>
          {scenarios.map((s) => (
            <div
              key={s.id}
              className={cn(
                "border-b border-hairline px-4 py-3",
                s.id === activeId && "bg-brand-50/40",
              )}
            >
              <div className="text-[12.5px] font-medium text-ink-900">{s.name}</div>
              {s.tag && <div className="text-[10.5px] text-ink-500">{s.tag}</div>}
            </div>
          ))}

          {[
            { key: "cost", label: "Total cost", fmt: (v: number) => `${cur}${v.toFixed(2)}`, better: "lower" as const },
            { key: "margin", label: "Margin", fmt: (v: number) => `${v.toFixed(1)}%`, better: "higher" as const },
            { key: "lead", label: "Lead time", fmt: (v: number) => `${v} d`, better: "lower" as const },
          ].map((row) => (
            <>
              <div key={`${row.key}-h`} className="border-r border-hairline bg-surface-alt/20 px-4 py-3 text-[12px] text-ink-600">
                {row.label}
              </div>
              {scenarios.map((s) => {
                const m = metrics.find((x) => x.id === s.id)!;
                const v = (m as any)[row.key] as number;
                const bv = (base as any)[row.key] as number;
                const delta = v - bv;
                const good = row.better === "lower" ? delta < 0 : delta > 0;
                const bad = row.better === "lower" ? delta > 0 : delta < 0;
                return (
                  <div key={`${s.id}-${row.key}`} className={cn("px-4 py-3", s.id === activeId && "bg-brand-50/40")}>
                    <div className="text-[14px] font-medium tabular-nums text-ink-900">{row.fmt(v)}</div>
                    {s.id !== activeId && delta !== 0 && (
                      <div
                        className={cn(
                          "text-[11px] tabular-nums",
                          good && "text-brand-700",
                          bad && "text-danger",
                        )}
                      >
                        {delta > 0 ? "+" : ""}
                        {row.key === "margin" ? `${delta.toFixed(1)}%` : row.key === "lead" ? `${delta}d` : `${cur}${Math.abs(delta).toFixed(2)}`}
                        {" "}
                        {good ? "better" : "worse"}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   ANALYTICS VIEW — commercial intelligence dashboard
   ============================================================ */

function AnalyticsView({
  stages,
  stageTotals,
  mix,
  currentCost,
  target,
  actualMarginPct,
  targetMarginPct,
}: {
  stages: Stage[];
  stageTotals: Record<string, { cost: number; picks: number; total: number }>;
  mix: { key: string; label: string; pct: number; cost: number }[];
  currentCost: number;
  target: { value: number; currencySymbol: string; label: string };
  actualMarginPct: number;
  targetMarginPct: number;
}) {
  const cur = target.currencySymbol;
  const marginDelta = actualMarginPct - targetMarginPct;
  return (
    <section className="grid gap-4 md:grid-cols-2">
      {/* Waterfall */}
      <div className="rounded-2xl border border-hairline bg-surface p-5 md:col-span-2">
        <div className="mb-1 text-[10.5px] uppercase tracking-[0.12em] text-brand-700">Waterfall</div>
        <h3 className="text-[16px] font-medium tracking-tight text-ink-900">Target → Final cost</h3>
        <div className="mt-5 flex items-end gap-2 h-40">
          <WaterBar label="Target" value={target.value} total={target.value} color="bg-ink-200" text={`${cur}${target.value.toFixed(2)}`} />
          {stages.map((s) => (
            <WaterBar
              key={s.key}
              label={s.label}
              value={stageTotals[s.key].cost}
              total={target.value}
              color="bg-brand-700"
              text={`${cur}${stageTotals[s.key].cost.toFixed(2)}`}
            />
          ))}
          <WaterBar
            label="Final"
            value={currentCost}
            total={target.value}
            color={currentCost > target.value ? "bg-danger" : "bg-ink-900"}
            text={`${cur}${currentCost.toFixed(2)}`}
          />
        </div>
      </div>

      {/* Pareto */}
      <div className="rounded-2xl border border-hairline bg-surface p-5">
        <div className="mb-1 text-[10.5px] uppercase tracking-[0.12em] text-brand-700">Pareto</div>
        <h3 className="text-[15px] font-medium text-ink-900">Where the money is</h3>
        <p className="mt-1 text-[11.5px] text-ink-500">Focus optimisation on the top 20% by spend.</p>
        <div className="mt-4 space-y-2">
          {mix.slice(0, 6).map((row) => (
            <div key={row.key} className="text-[11.5px]">
              <div className="flex justify-between text-ink-600">
                <span>{row.label}</span>
                <span className="tabular-nums">{cur}{row.cost.toFixed(2)} · {row.pct}%</span>
              </div>
              <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-surface-alt">
                <div className="h-full rounded-full bg-brand-700" style={{ width: `${row.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Margin */}
      <div className="rounded-2xl border border-hairline bg-surface p-5">
        <div className="mb-1 text-[10.5px] uppercase tracking-[0.12em] text-brand-700">Margin</div>
        <h3 className="text-[15px] font-medium text-ink-900">Target vs actual</h3>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.1em] text-ink-400">Target</div>
            <div className="text-[22px] font-medium tabular-nums text-ink-900">{targetMarginPct}%</div>
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.1em] text-ink-400">Actual</div>
            <div className={cn(
              "text-[22px] font-medium tabular-nums",
              actualMarginPct >= targetMarginPct ? "text-brand-700" : "text-danger",
            )}>
              {actualMarginPct.toFixed(1)}%
            </div>
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-hairline bg-surface-alt/40 p-3 text-[12px]">
          {marginDelta >= 0 ? (
            <span><span className="font-medium text-brand-700">+{marginDelta.toFixed(1)}%</span> above buyer target — you have room to negotiate or invest in quality.</span>
          ) : (
            <span><span className="font-medium text-danger">{marginDelta.toFixed(1)}%</span> below buyer target — the copilot has cost-out ideas in the Build tab.</span>
          )}
        </div>
      </div>
    </section>
  );
}

function WaterBar({
  label,
  value,
  total,
  color,
  text,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  text: string;
}) {
  const h = Math.max(6, Math.min(100, (value / Math.max(total, 0.01)) * 100));
  return (
    <div className="flex flex-1 flex-col items-center gap-1">
      <div className="flex h-full w-full items-end">
        <div className={cn("w-full rounded-t-md transition-all", color)} style={{ height: `${h}%` }} />
      </div>
      <div className="text-[10px] tabular-nums text-ink-700">{text}</div>
      <div className="text-[10px] text-ink-500 truncate max-w-full">{label}</div>
    </div>
  );
}

/* ============================================================
   HISTORY VIEW — full evolution timeline
   ============================================================ */

function HistoryView({ entries }: { entries: EvolutionEntry[] }) {
  return (
    <section className="rounded-2xl border border-hairline bg-surface p-5">
      <div className="mb-1 text-[10.5px] uppercase tracking-[0.12em] text-brand-700">History</div>
      <h2 className="text-[18px] font-medium tracking-tight text-ink-900">Every decision, logged</h2>
      <p className="mt-1 text-[12.5px] text-ink-500">
        See how the product evolved — restore, compare, or explain any change to the buyer.
      </p>

      {entries.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-hairline p-8 text-center text-[12.5px] text-ink-500">
          No changes yet. Start configuring in the Build tab and every decision will appear here.
        </div>
      ) : (
        <ol className="mt-6 space-y-4">
          {entries.map((e) => (
            <li key={e.id} className="relative pl-6">
              <span className="absolute left-0 top-1 flex h-4 w-4 items-center justify-center rounded-full border border-brand-100 bg-brand-50 text-brand-700">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-700" />
              </span>
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <div className="text-[13.5px] font-medium text-ink-900">{e.choiceTitle}</div>
                  <div className="text-[12px] text-ink-500">
                    {e.fromLabel} <ArrowRight className="mx-1 inline h-3 w-3 text-ink-300" /> {e.toLabel}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-ink-500 shrink-0">
                  {e.costDelta !== 0 && (
                    <span className={cn("tabular-nums", e.costDelta < 0 ? "text-brand-700" : "text-gold-700")}>
                      {e.costDelta < 0 ? "▼" : "▲"} {Math.abs(e.costDelta).toFixed(2)}
                    </span>
                  )}
                  {e.leadDelta !== 0 && (
                    <span className={cn("tabular-nums", e.leadDelta < 0 ? "text-brand-700" : "text-gold-700")}>
                      {e.leadDelta > 0 ? "+" : ""}{e.leadDelta}d
                    </span>
                  )}
                  <span>· {e.who} · {e.when}</span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// Silence unused warnings for stable imports kept for future extension
void useEffect;
void FileText;
void ImageIcon;
void MoreHorizontal;
void ArrowUpRight;
