import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  X,
  Sparkles,
  Plus,
  Copy,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  Send,
  Check,
  FileText,
  ClipboardCheck,
  MoreHorizontal,
  Wand2,
  Star,
  Download,
  Package,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Building2,
  Ship,
  Calendar,
  MapPin,
  User,
  Hash,
  Printer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PodArticleTabs } from "@/components/layout/ArticleTabsBar";
import { SRFS, IMG } from "@/lib/inquiries-data";
import {
  FIELDS,
  DEFAULT_SCENARIOS,
  PRESETS,
  computeMetrics,
  costRows,
  type Scenario,
  type FieldGroup,
  type Metrics,
} from "@/lib/scenariosStore";
import { SubmitApprovalModal } from "@/components/approvals/SubmitApprovalModal";
import { useRequestedChanges } from "@/lib/requestedChangesStore";
import { ModuleRevisionAction } from "@/components/changes/FlowActions";

/* ============================================================
   AI Commercial Workspace
   ============================================================ */

type TabKey = "config" | "cost" | "quote";
type Phase = "empty" | "analyzing" | "ready";

type Article = { id: string; name: string; size: string; image: string };

function articlesForSrf(
  srf: (typeof SRFS)[number],
  products?: { id: string; name: string; image?: string; size?: string }[],
): Article[] {
  if (products && products.length) {
    return products.map((p, i) => ({
      id: p.id,
      name: p.name,
      size: p.size ?? (i === 0 ? "100×150 cm | 600 GSM" : "As per spec"),
      image: p.image ?? srf.image,
    }));
  }
  return [
    { id: "bath", name: "Bath Towel", size: "100×150 cm | 600 GSM", image: srf.image },
    { id: "hand", name: "Hand Towel", size: "50×90 cm | 500 GSM", image: IMG.towel },
    { id: "face", name: "Face Towel", size: "30×30 cm | 400 GSM", image: IMG.towel },
  ];
}

const AI_PILLS = [
  { id: "gen3", label: "Generate 3 scenarios", icon: Sparkles, primary: true },
  { id: "gen1000", label: "Generate for 1,000 MOQ", icon: Package },
  { id: "lowcost", label: "Lowest cost path", icon: Wand2 },
  { id: "premium", label: "Premium finish concept", icon: Star },
  { id: "sustain", label: "Sustainable option (GOTS)", icon: Sparkles },
  { id: "fast", label: "Cut lead time 30%", icon: Wand2 },
];

export function AiWorkspace({
  srfId,
  navPodId,
  onCancel,
  onSwitchClassic,
  mode = "draft",
  autoOpenQuote = false,
  products,
}: {
  srfId: string;
  navPodId?: string;
  onCancel: () => void;
  onSwitchClassic: () => void;
  mode?: "draft" | "approved";
  autoOpenQuote?: boolean;
  products?: { id: string; name: string; image?: string; size?: string }[];
}) {
  const srf = SRFS.find((s) => s.id === srfId) ?? SRFS[0];
  const [articles, setArticles] = useState<Article[]>(() => articlesForSrf(srf, products));
  const [articleId, setArticleId] = useState(articles[0].id);
  const article = articles.find((a) => a.id === articleId) ?? articles[0];
  const [readOnly, setReadOnly] = useState(mode === "approved");

  // Always land directly on the scenario comparison workspace.
  const [phase, setPhase] = useState<Phase>("ready");
  const [scenarios, setScenarios] = useState<Scenario[]>(DEFAULT_SCENARIOS);
  const [activeId, setActiveId] = useState(
    DEFAULT_SCENARIOS.find((s) => s.recommended)?.id ?? "balanced",
  );
  const [tab, setTab] = useState<TabKey>("config");
  const [leftOpen, setLeftOpen] = useState(true);
  // Both panels open by default on landing.
  const [aiOpen, setAiOpen] = useState(true);
  const [quoteOpen, setQuoteOpen] = useState(autoOpenQuote);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [highlighted, setHighlighted] = useState<Record<string, string[]>>({});
  const [srfBannerOpen, setSrfBannerOpen] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [pendingPatchId, setPendingPatchId] = useState(0);
  const rc = useRequestedChanges();
  // Quotation unlocks only once the approval (incl. requested changes) is done.
  const quoteLocked = rc.submitted && !rc.approvalDone;
  const [hiddenGroups, setHiddenGroups] = useState<FieldGroup[]>([]);
  const hideGroup = (g: FieldGroup) =>
    setHiddenGroups((cur) => (cur.includes(g) ? cur : [...cur, g]));
  const restoreGroup = (g: FieldGroup) => setHiddenGroups((cur) => cur.filter((x) => x !== g));

  // Scenarios hidden from middle pane — still available on left panel to re-add.
  const [hiddenScenarioIds, setHiddenScenarioIds] = useState<string[]>([]);
  const hideScenario = (id: string) =>
    setHiddenScenarioIds((cur) => (cur.includes(id) ? cur : [...cur, id]));
  const restoreScenario = (id: string) =>
    setHiddenScenarioIds((cur) => cur.filter((x) => x !== id));

  // Track which scenarios were created by the user (vs seeded AI ones).
  // Only user-created scenarios can be deleted; AI-seeded ones can only be hidden.
  const seedIds = useMemo(() => new Set(DEFAULT_SCENARIOS.map((s) => s.id)), []);
  const [userCreatedIds, setUserCreatedIds] = useState<Set<string>>(() => new Set());
  const isUserCreated = (id: string) => userCreatedIds.has(id);
  const isSeed = (id: string) => seedIds.has(id);

  // Guided scenario creation state — step, collected answers.
  type CreateStep = "optimize" | "target" | "supplier" | "extra" | "summary" | null;
  const [createStep, setCreateStep] = useState<CreateStep>(null);
  const [createDraft, setCreateDraft] = useState<{
    optimize?: string;
    target?: string;
    supplier?: string;
  }>({});

  // Track most recent user intent for context-aware suggestion chips.
  const [lastIntent, setLastIntent] = useState<string>("");

  type PatchMsg = {
    id: number;
    fields: Record<string, string>;
    summary: string;
    applied: boolean;
  };

  type CreateSummaryMsg = {
    id: number;
    name: string;
    kind: Scenario["kind"];
    tagline: string;
    patch: Record<string, string>;
    bullets: string[];
    applied: boolean;
  };

  const [conversation, setConversation] = useState<
    Array<{
      role: "user" | "ai";
      text?: string;
      card?: any;
      chips?: Array<{ label: string; kind: Scenario["kind"] }>;
      quickReplies?: Array<{ label: string; value: string }>;
      patch?: PatchMsg;
      createSummary?: CreateSummaryMsg;
    }>
  >([]);

  // Seed a welcome message that explains the initial scenarios and why they were picked.
  useEffect(() => {
    setConversation((c) => {
      if (c.length > 0) return c;
      const bullets = scenarios.map((s) => {
        const m = computeMetrics(s.selection);
        const why =
          s.kind === "current"
            ? "Baseline — matches the buyer's POD spec exactly."
            : s.kind === "balanced"
              ? "Best margin/risk trade-off using this buyer's historical acceptance pattern."
              : s.kind === "lowest"
                ? "Cost-first — trims MOQ and non-essential accessories."
                : s.kind === "premium"
                  ? "Best-in-class finish — aligned with premium SKUs bought historically."
                  : s.kind === "value"
                    ? "Keeps buyer-visible features, trims hidden cost."
                    : s.tagline;
        return `${s.name} · $${m.totalCost.toFixed(2)} · ${m.margin}% margin — ${why}`;
      });
      return [
        {
          role: "ai",
          text: "Based on this POD, buyer history, and current supplier rates I've prepared these scenarios. Balanced is my recommended starting point.",
        },
        {
          role: "ai",
          text: bullets.map((b) => `• ${b}`).join("\n"),
        },
      ];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleScenarios = useMemo(
    () => scenarios.filter((s) => !hiddenScenarioIds.includes(s.id)),
    [scenarios, hiddenScenarioIds],
  );
  const hiddenScenarios = useMemo(
    () => scenarios.filter((s) => hiddenScenarioIds.includes(s.id)),
    [scenarios, hiddenScenarioIds],
  );
  const active =
    visibleScenarios.find((s) => s.id === activeId) ??
    scenarios.find((s) => s.id === activeId) ??
    visibleScenarios[0] ??
    scenarios[0];
  const activeMetrics = useMemo(() => (active ? computeMetrics(active.selection) : null), [active]);
  const currentSel =
    scenarios.find((s) => s.kind === "current")?.selection ?? scenarios[0]?.selection ?? {};

  const setField = (sid: string, fid: string, oid: string) => {
    setScenarios((cur) =>
      cur.map((s) => (s.id === sid ? { ...s, selection: { ...s.selection, [fid]: oid } } : s)),
    );
    setHasChanges(true);
    // Highlight the column briefly so users see which scenario updated.
    setHighlighted((h) => ({ ...h, [sid]: Array.from(new Set([...(h[sid] ?? []), fid])) }));
    window.setTimeout(() => {
      setHighlighted((h) => {
        const next = { ...h };
        next[sid] = (next[sid] ?? []).filter((x) => x !== fid);
        if (next[sid].length === 0) delete next[sid];
        return next;
      });
    }, 2200);
  };

  const addScenario = (kind: Scenario["kind"], nameOverride?: string, taglineOverride?: string) => {
    const preset = PRESETS.find((p) => p.id === kind);
    const base =
      DEFAULT_SCENARIOS.find((s) => s.kind === kind)?.selection ??
      active?.selection ??
      DEFAULT_SCENARIOS[0].selection;
    const id = `sc-${Date.now()}`;
    setScenarios((cur) => [
      ...cur,
      {
        id,
        name: nameOverride ?? preset?.name ?? "Custom",
        tagline: taglineOverride ?? preset?.tagline ?? "Custom scenario",
        kind,
        selection: { ...base },
      },
    ]);
    setUserCreatedIds((cur) => new Set(cur).add(id));
    setActiveId(id);
    return id;
  };
  const duplicateScenario = (id: string) => {
    const s = scenarios.find((x) => x.id === id);
    if (!s) return;
    const newId = `sc-${Date.now()}`;
    setScenarios((cur) => [
      ...cur,
      { ...s, id: newId, name: `${s.name} copy`, kind: "custom", recommended: false },
    ]);
    setUserCreatedIds((cur) => new Set(cur).add(newId));
    setActiveId(newId);
  };
  const renameScenario = (id: string, name: string) => {
    setScenarios((cur) => cur.map((s) => (s.id === id ? { ...s, name } : s)));
  };
  const deleteScenario = (id: string) => {
    if (!isUserCreated(id)) return; // seed scenarios can only be hidden
    if (typeof window !== "undefined") {
      const ok = window.confirm("Delete this scenario? This cannot be undone.");
      if (!ok) return;
    }
    setScenarios((cur) => cur.filter((x) => x.id !== id));
    setUserCreatedIds((cur) => {
      const n = new Set(cur);
      n.delete(id);
      return n;
    });
    if (activeId === id && scenarios.length > 1) {
      const fallback = scenarios.find((x) => x.id !== id);
      if (fallback) setActiveId(fallback.id);
    }
  };

  // Guided quick-reply handler for scenario creation.
  const pickQuickReply = (value: string, label: string) => {
    // Not in creation flow → treat like a normal chat message.
    if (!createStep) {
      send(value);
      return;
    }
    setConversation((c) => [...c, { role: "user", text: label }]);
    if (createStep === "optimize") {
      setCreateDraft((d) => ({ ...d, optimize: value }));
      setCreateStep("target");
      setConversation((c) => [
        ...c,
        {
          role: "ai",
          text: "Do you have a target price?",
          quickReplies: [
            { label: "Under $7.50", value: "Under $7.50" },
            { label: "Meet Buyer Target", value: "Meet buyer target ($8.50)" },
            { label: "Keep Current Price", value: "Keep current price" },
          ],
        },
      ]);
      return;
    }
    if (createStep === "target") {
      setCreateDraft((d) => ({ ...d, target: value }));
      setCreateStep("supplier");
      setConversation((c) => [
        ...c,
        {
          role: "ai",
          text: "Any supplier preference?",
          quickReplies: [
            { label: "Current Supplier", value: "Current supplier" },
            { label: "Best Rated Supplier", value: "Best rated supplier" },
            { label: "Lowest Cost Supplier", value: "Lowest cost supplier" },
          ],
        },
      ]);
      return;
    }
    if (createStep === "supplier") {
      setCreateDraft((d) => ({ ...d, supplier: value }));
      // Build a summary card — DO NOT apply yet. User applies from the card.
      const opt = (createDraft.optimize ?? "").toLowerCase();
      const tgt = (createDraft.target ?? "").toLowerCase();
      const kind: Scenario["kind"] = opt.includes("quality")
        ? "premium"
        : opt.includes("margin")
          ? "value"
          : "lowest";
      const nameParts = [
        opt.includes("quality") ? "Quality" : opt.includes("margin") ? "Margin" : "Cost",
        tgt.includes("7.50") ? "· <$7.50" : tgt.includes("buyer") ? "· Buyer Target" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const name = `Custom · ${nameParts}`;
      const supplier = value.toLowerCase().includes("lowest")
        ? "panipat"
        : value.toLowerCase().includes("best")
          ? "karur"
          : undefined;
      const patch: Record<string, string> = {};
      if (supplier) patch.supplier = supplier;
      if (opt.includes("cost") || tgt.includes("7.50")) {
        patch.front_fabric = "cotton_450";
        patch.packaging = "polybag";
        patch.moq = "2500";
      }
      if (opt.includes("quality")) {
        patch.front_fabric = "cotton_600";
        patch.certifications = "oekotex_bci";
      }
      const bullets = [
        `Optimize for: ${createDraft.optimize ?? "—"}`,
        `Target price: ${createDraft.target ?? "—"}`,
        `Supplier: ${value}`,
      ];
      const id = pendingPatchId + 1;
      setPendingPatchId(id);
      setCreateStep(null);
      setConversation((c) => [
        ...c,
        {
          role: "ai",
          text: "Here's the scenario I'd build from your answers. Review and click Apply to add it to the workspace.",
          createSummary: {
            id,
            name,
            kind,
            tagline: `Optimize · ${createDraft.optimize ?? ""}`.trim(),
            patch,
            bullets,
            applied: false,
          },
        },
      ]);
      return;
    }
  };

  const applyCreateSummary = (id: number) => {
    const msg = conversation.find((m) => m.createSummary?.id === id);
    if (!msg?.createSummary || msg.createSummary.applied) return;
    const cs = msg.createSummary;
    const newId = addScenario(cs.kind, cs.name, cs.tagline);
    if (Object.keys(cs.patch).length > 0) {
      setScenarios((cur) =>
        cur.map((s) => (s.id === newId ? { ...s, selection: { ...s.selection, ...cs.patch } } : s)),
      );
    }
    setConversation((c) =>
      c.map((m) =>
        m.createSummary?.id === id
          ? { ...m, createSummary: { ...m.createSummary, applied: true } }
          : m,
      ),
    );
  };

  const discardCreateSummary = (id: number) => {
    setConversation((c) => c.filter((m) => m.createSummary?.id !== id));
  };

  const pickCreateChip = (kind: Scenario["kind"], label: string) => {
    setConversation((c) => [
      ...c,
      { role: "user", text: label },
      {
        role: "ai",
        text: `Done — added "${label}" as a new column. Edit its name inline, or duplicate it to tweak variations.`,
      },
    ]);
    addScenario(kind, label);
  };

  const triggerGenerate = (pillId: string, label: string) => {
    if (phase === "analyzing") return;
    setConversation((c) => [
      ...c,
      { role: "user", text: label },
      { role: "ai", text: "Analyzing POD, historical quotations, and supplier options…" },
    ]);
    setPhase("analyzing");
    setTimeout(() => {
      let base = DEFAULT_SCENARIOS;
      let reason = "your POD, buyer history and current supplier rates";
      if (pillId === "gen1000") {
        base = DEFAULT_SCENARIOS.map((s) => ({
          ...s,
          selection: { ...s.selection, moq: "1000" },
        }));
        reason = "the 1,000-piece MOQ constraint and current fabric prices";
      } else if (pillId === "lowcost") {
        base = DEFAULT_SCENARIOS.filter((s) => ["current", "lowest", "value"].includes(s.kind));
        reason = "cost-first optimization across fabric, packaging and MOQ";
      } else if (pillId === "premium") {
        base = DEFAULT_SCENARIOS.filter((s) => ["current", "premium", "balanced"].includes(s.kind));
        reason = "premium finish, hand feel, and retail-ready packaging";
      }
      setScenarios(base);
      setActiveId(base.find((s) => s.recommended)?.id ?? base[0].id);
      setPhase("ready");
      setConversation((c) => [
        ...c,
        {
          role: "ai",
          text: `Here are ${base.length} scenarios based on ${reason}. Balanced is my recommendation — best margin-to-risk trade-off.`,
        },
      ]);
    }, 1400);
  };

  const pulseHighlight = (map: Record<string, string[]>) => {
    setHighlighted(map);
    window.setTimeout(() => setHighlighted({}), 2600);
  };

  const applyPatchAll = (patch: Record<string, string>) => {
    const fields = Object.keys(patch);
    setScenarios((cur) => {
      const map: Record<string, string[]> = {};
      cur.forEach((s) => (map[s.id] = fields));
      pulseHighlight(map);
      return cur.map((s) => ({ ...s, selection: { ...s.selection, ...patch } }));
    });
    setHasChanges(true);
  };

  const applyPatchToScenario = (sid: string, patch: Record<string, string>) => {
    const fields = Object.keys(patch);
    setScenarios((cur) => {
      pulseHighlight({ [sid]: fields });
      return cur.map((s) => (s.id === sid ? { ...s, selection: { ...s.selection, ...patch } } : s));
    });
    setHasChanges(true);
  };

  const proposeChange = (userText: string, summary: string, patch: Record<string, string>) => {
    const id = pendingPatchId + 1;
    setPendingPatchId(id);
    setConversation((c) => [
      ...c,
      { role: "user", text: userText },
      {
        role: "ai",
        text: summary,
        patch: { id, fields: patch, summary, applied: false },
      },
    ]);
  };

  const applyPendingPatch = (id: number, scope: "all" | "active" = "all") => {
    const msg = conversation.find((m) => m.patch?.id === id);
    if (!msg?.patch || msg.patch.applied) return;
    if (scope === "active" && active) {
      applyPatchToScenario(active.id, msg.patch.fields);
    } else {
      applyPatchAll(msg.patch.fields);
    }
    setConversation((c) =>
      c.map((m) => (m.patch?.id === id ? { ...m, patch: { ...m.patch, applied: true } } : m)),
    );
  };

  const discardPendingPatch = (id: number) => {
    setConversation((c) => c.filter((m) => m.patch?.id !== id));
  };

  const send = (t: string) => {
    if (!t.trim()) return;
    const q = t.toLowerCase();
    setLastIntent(q);

    // Intent routing — propose changes with an Apply step
    if (/quotation|quote/.test(q) && /generate|buyer|ready|send/.test(q)) {
      setConversation((c) => [
        ...c,
        { role: "user", text: t },
        {
          role: "ai",
          text: "Opening the quotation preview — pick the scenarios you want to include and I'll assemble a buyer-ready quote.",
        },
      ]);
      setTimeout(() => setQuoteOpen(true), 500);
      return;
    }
    if (/below\s*\$?7|under\s*\$?7|reduce.*cost|cheapest/.test(q)) {
      proposeChange(
        t,
        "To land under $7/pc I'd move to 450 GSM cotton, poly-bag packaging, drop the hang tag, and lift MOQ to 5,000. That trims ~$0.90/pc.",
        { front_fabric: "cotton_450", packaging: "polybag", hangtags: "none", moq: "5000" },
      );
      return;
    }
    if (/moq.*5[,.]?000|5k.*moq|5[,.]?000.*moq/.test(q)) {
      proposeChange(t, "Setting MOQ to 5,000 saves ~$0.32/pc but adds ~8 days lead time.", {
        moq: "5000",
      });
      return;
    }
    if (/organic|gots|zara/.test(q)) {
      proposeChange(
        t,
        "For Zara Home's sustainability scorecard I'd switch to a Cotton/Bamboo blend with GOTS certification. Cost impact +$0.23/pc, but win-probability lifts meaningfully.",
        { certifications: "gots", front_fabric: "cotton_blend" },
      );
      return;
    }
    if (/lead time|faster|delivery/.test(q)) {
      proposeChange(
        t,
        "Karur Mills at MOQ 1,000 with DDP door delivery cuts ~14 days of lead time. Cost impact +$0.43/pc.",
        { supplier: "karur", moq: "1000", transportation: "ddp" },
      );
      return;
    }
    if (/embroidery/.test(q)) {
      proposeChange(t, "Removing embroidery saves $0.22–0.42/pc depending on stitch count.", {
        embroidery: "none",
      });
      return;
    }
    if (/gsm|heavier|thicker/.test(q)) {
      proposeChange(t, "Moving to 600 GSM Cotton adds ~$0.40/pc but delivers premium hand-feel.", {
        gsm: "600",
        front_fabric: "cotton_600",
      });
      return;
    }
    if (/karur/.test(q)) {
      proposeChange(t, "Switching to Karur Mills — 96% on-time, 18 prior orders.", {
        supplier: "karur",
      });
      return;
    }
    if (/panipat/.test(q)) {
      proposeChange(
        t,
        "Switching to Panipat Textiles — cheaper by $0.22/pc, but longer lead time.",
        { supplier: "panipat" },
      );
      return;
    }
    if (/kraft.*pack|kraft\s*sleeve|kraft/.test(q)) {
      proposeChange(
        t,
        "Switching packaging to kraft sleeve — +$0.08/pc vs polybag, retail-friendly.",
        { packaging: "kraft_sleeve" },
      );
      return;
    }
    if (/supplier|vendor|mill/.test(q)) {
      proposeChange(
        t,
        "Erode Weaves is +$0.12/pc but 94% on-time with better GOTS traceability. Panipat is also available if cost is the priority.",
        { supplier: "erode" },
      );
      return;
    }
    if (/safest|safe|risk/.test(q)) {
      proposeChange(
        t,
        "The safest commercial path: Karur Mills · OEKO-TEX+BCI · MOQ 2,500 · kraft sleeve. Highest confidence (91%) and lowest supplier risk.",
        {
          supplier: "karur",
          certifications: "oekotex_bci",
          moq: "2500",
          packaging: "kraft_sleeve",
        },
      );
      return;
    }
    // fallback — no change proposed
    setConversation((c) => [
      ...c,
      { role: "user", text: t },
      {
        role: "ai",
        text: `Looking into "${t}". Try one of the suggested prompts below for a fully modeled answer.`,
      },
    ]);
  };

  // Dynamic suggestion chips — 2–3 max, adapting to most recent intent + selected scenario.
  const suggestedChips = useMemo(() => {
    const q = lastIntent;
    if (!q) {
      return [
        "Can we get below $7?",
        "Suggest another supplier.",
        "Generate a buyer-ready quotation.",
      ];
    }
    if (/cost|cheap|below|reduce/.test(q)) {
      return ["Optimize packaging", "Reduce MOQ impact", "Find cheaper supplier"];
    }
    if (/quality|premium|gsm|heavier/.test(q)) {
      return ["Increase GSM", "Suggest premium fabric", "Improve finish"];
    }
    if (/supplier|vendor|mill|karur|erode|panipat/.test(q)) {
      return ["Best rated supplier", "Fastest supplier", "Lowest cost supplier"];
    }
    if (/organic|gots|sustain|eco/.test(q)) {
      return ["Add GOTS certification", "Recycled packaging", "OEKO-TEX + BCI"];
    }
    if (/lead|delivery|faster/.test(q)) {
      return ["Cut lead time 30%", "DDP door delivery", "Reduce MOQ to 1,000"];
    }
    if (/embroidery|print|logo/.test(q)) {
      return ["Remove embroidery", "Switch to digital print", "Add woven label"];
    }
    if (/moq/.test(q)) {
      return ["Try MOQ 2,500", "Try MOQ 5,000", "Keep MOQ 1,000"];
    }
    return [
      "Generate a buyer-ready quotation.",
      "What's the safest option?",
      "Can I reduce lead time?",
    ];
  }, [lastIntent]);

  const approvalSnapshot = useMemo(() => {
    if (!active || !activeMetrics) return null;
    return {
      productName: srf.productName,
      productImage: srf.image,
      buyer: srf.buyer,
      articleId: srf.id,
      articleCode: srf.id.replace("SRF-", "ART-"),
      srfId: srf.id,
      moq: srf.moq,
      size: article.size,
      supplier: "Karur Mills",
      scenarioName: active.name,
      sellingPrice: activeMetrics.sellingPrice,
      cost: activeMetrics.totalCost,
      margin: activeMetrics.margin,
      targetPrice: 8.5,
      confidence: activeMetrics.confidence,
      commercialHealth: activeMetrics.health,
      configGroups: [],
      costRows: costRows(activeMetrics).map((r) => ({
        label: r.label,
        cost: r.value,
        color: r.color,
        pct: r.pct,
      })),
      aiSummary: {
        verdict: `${active.name}: ${activeMetrics.margin}% margin at $${activeMetrics.sellingPrice.toFixed(2)}.`,
        risks: ["Cotton yarn +4.8% MoM", "Buyer typically pushes 2% at PO"],
        confidence: activeMetrics.confidence,
        bestScenario: "Balanced",
        recommendations: ["Lock 90-day forward with Karur Mills"],
      },
      history: {
        similarProducts: 7,
        previousMargin: 19.8,
        winRate: activeMetrics.winProbability,
        similarBuyers: ["West Elm", "IKEA", "M&S"],
        historicalSupplier: "Karur Mills · 12 orders",
        avgLeadTime: "44 days",
      },
    };
  }, [srf, article, active, activeMetrics]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-canvas">
      {/* TOP BAR */}
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-hairline bg-surface px-4">
        <Link
          to="/pods"
          className="flex h-8 w-8 items-center justify-center rounded-md text-ink-500 hover:bg-surface-alt hover:text-ink-900"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex flex-col leading-tight">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold tracking-tight text-ink-900">
              {article.name}
            </span>
            {readOnly ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">
                <Check className="h-2.5 w-2.5" /> Costing approved
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-gold-50 px-1.5 py-0.5 text-[10px] font-medium text-gold-700">
                {mode === "approved" ? "Editing" : "Draft"}
              </span>
            )}
          </div>
          <div className="text-[11px] text-ink-500">
            {srf.id} · {srf.buyer}
          </div>
        </div>

        {/* Center segmented tabs - dark pill selected */}
        <div className="mx-auto">
          <div className="flex items-center gap-1 rounded-full border border-hairline bg-surface-alt/60 p-1">
            {(
              [
                { k: "config", label: "Configuration" },
                { k: "cost", label: "Cost Analysis" },
                { k: "quote", label: "Quote Preview" },
              ] as { k: TabKey; label: string }[]
            ).map((t) => (
              <button
                key={t.k}
                onClick={() => setTab(t.k)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-[12.5px] font-medium transition-all",
                  tab === t.k
                    ? "bg-ink-900 text-white shadow-sm"
                    : "text-ink-500 hover:text-ink-900",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onSwitchClassic}
            className="hidden text-[11px] text-ink-400 hover:text-ink-900 lg:inline"
          >
            Classic view
          </button>
          {mode === "approved" && readOnly ? (
            <>
              <ModuleRevisionAction compact />
              <button
                onClick={() => setReadOnly(false)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 text-[12px] font-medium text-ink-700 hover:bg-surface-alt"
                title="Unlock costing to make changes"
              >
                Edit
              </button>
              <button
                onClick={() => setQuoteOpen(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-ink-900 px-3 text-[12px] font-medium text-white hover:bg-ink-800"
              >
                <Send className="h-3.5 w-3.5" /> Send Quotation
              </button>
            </>
          ) : mode === "approved" ? (
            <>
              <ModuleRevisionAction compact />
              <button
                onClick={() => setReadOnly(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 text-[12px] font-medium text-ink-700 hover:bg-surface-alt"
              >
                Cancel edit
              </button>
              {hasChanges && (
                <button
                  onClick={() => setApprovalOpen(true)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-brand-700 px-3 text-[12px] font-medium text-white hover:bg-brand-800"
                  title="Costing was modified — re-submit for approval"
                >
                  <ClipboardCheck className="h-3.5 w-3.5" /> Re-submit for Approval
                </button>
              )}
              <button
                onClick={() => setQuoteOpen(true)}
                disabled={quoteLocked}
                title={
                  quoteLocked
                    ? "Complete the requested changes and approval first"
                    : "Generate quotation"
                }
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12px] font-medium text-white",
                  quoteLocked ? "cursor-not-allowed bg-ink-200" : "bg-ink-900 hover:bg-ink-800",
                )}
              >
                <FileText className="h-3.5 w-3.5" /> Send to Quotation
              </button>
            </>
          ) : (
            <>
              <ModuleRevisionAction compact />
              <button
                onClick={() => setQuoteOpen(true)}
                disabled={quoteLocked}
                title={
                  quoteLocked
                    ? "Complete the requested changes and approval first"
                    : "Generate quotation"
                }
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 text-[12px] font-medium text-ink-700 hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-40"
              >
                <FileText className="h-3.5 w-3.5" /> Send to Quotation
              </button>
              <button
                onClick={() => setApprovalOpen(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-brand-700 px-3 text-[12px] font-medium text-white hover:bg-brand-800"
              >
                <ClipboardCheck className="h-3.5 w-3.5" /> Submit for Approval
              </button>
            </>
          )}

          <button className="flex h-8 w-8 items-center justify-center rounded-md text-ink-500 hover:bg-surface-alt">
            <MoreHorizontal className="h-4 w-4" />
          </button>
          <button
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-500 hover:bg-surface-alt"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* BODY */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANEL */}
        <LeftPanel
          open={leftOpen}
          setOpen={setLeftOpen}
          srf={srf}
          article={article}
          scenarios={visibleScenarios}
          hiddenScenarios={hiddenScenarios}
          onRestoreScenario={restoreScenario}
          phase={phase}
          activeId={activeId}
          setActiveId={setActiveId}
          onDelete={deleteScenario}
          onDuplicate={duplicateScenario}
          hiddenGroups={hiddenGroups}
          onRestoreGroup={restoreGroup}
          isUserCreated={isUserCreated}
        />

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {mode === "approved" && readOnly && (
            <div className="flex items-center justify-between gap-3 border-b border-brand-100 bg-brand-50/60 px-5 py-2 text-[12px] text-brand-800">
              <div className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5" />
                <span className="font-medium">This costing is approved.</span>
                <span className="text-brand-700/80">Read-only — click Edit to make changes.</span>
              </div>
              <button
                onClick={() => setReadOnly(false)}
                className="inline-flex h-6 items-center rounded-md border border-brand-200 bg-surface px-2 text-[11px] font-medium text-brand-800 hover:bg-brand-100/60"
              >
                Edit
              </button>
            </div>
          )}
          {srfBannerOpen && !readOnly && (
            <SrfChangesBanner onDismiss={() => setSrfBannerOpen(false)} />
          )}
          <div className="flex-1 overflow-auto">
            <fieldset
              disabled={readOnly}
              className={cn(
                "contents",
                readOnly &&
                  "[&_button]:cursor-not-allowed [&_input]:cursor-not-allowed [&_select]:cursor-not-allowed",
              )}
            >
              {tab === "config" && (
                <ScenarioTable
                  srf={srf}
                  article={article}
                  scenarios={visibleScenarios}
                  currentSel={currentSel}
                  activeId={activeId}
                  setActiveId={setActiveId}
                  onChangeField={setField}
                  onDuplicate={duplicateScenario}
                  onDelete={deleteScenario}
                  onHide={hideScenario}
                  onRename={renameScenario}
                  highlighted={highlighted}
                  hiddenGroups={hiddenGroups}
                  onHideGroup={hideGroup}
                  isUserCreated={isUserCreated}
                />
              )}

              {tab === "cost" && (
                <CostAnalysisView
                  srf={srf}
                  article={article}
                  scenarios={visibleScenarios}
                  activeId={activeId}
                  setActiveId={setActiveId}
                />
              )}
              {tab === "quote" && active && (
                <QuotePreview
                  srf={srf}
                  article={article}
                  scenarios={visibleScenarios}
                  active={active}
                />
              )}
            </fieldset>
          </div>

          {/* BOTTOM ARTICLES BAR — shared across all modules */}
          <PodArticleTabs podId={navPodId} activeId={articleId} stage="Costing" />
        </main>

        {/* RIGHT — AI WORKSPACE */}
        <AiWorkspacePanel
          open={aiOpen}
          setOpen={setAiOpen}
          phase={phase}
          conversation={conversation}
          onSend={send}
          onPill={triggerGenerate}
          onCreateChip={pickCreateChip}
          onQuickReply={pickQuickReply}
          onApplyPatch={applyPendingPatch}
          onDiscardPatch={discardPendingPatch}
          onApplyCreateSummary={applyCreateSummary}
          onDiscardCreateSummary={discardCreateSummary}
          suggestedChips={suggestedChips}
          activeName={active?.name ?? ""}
        />
      </div>

      {quoteOpen && (
        <QuotationSheet
          onClose={() => setQuoteOpen(false)}
          srf={srf}
          scenarios={visibleScenarios}
        />
      )}
      {approvalSnapshot && (
        <SubmitApprovalModal
          open={approvalOpen}
          onClose={() => setApprovalOpen(false)}
          snapshot={approvalSnapshot}
        />
      )}
    </div>
  );
}

/* ============================================================
   EMPTY HERO
   ============================================================ */

function EmptyHero({
  pills,
  onPick,
}: {
  pills: typeof AI_PILLS;
  onPick: (id: string, label: string) => void;
}) {
  return (
    <div className="relative flex h-full min-h-[70vh] flex-col items-center justify-center overflow-hidden p-8">
      {/* gradient orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 blur-3xl"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, color-mix(in oklab, var(--brand-500) 45%, transparent), transparent 60%), radial-gradient(circle at 70% 70%, color-mix(in oklab, var(--gold-500) 35%, transparent), transparent 60%)",
          }}
        />
        <div
          className="absolute left-[15%] top-[20%] h-64 w-64 rounded-full opacity-40 blur-3xl"
          style={{ background: "color-mix(in oklab, var(--brand-500) 40%, transparent)" }}
        />
        <div
          className="absolute right-[10%] bottom-[15%] h-72 w-72 rounded-full opacity-40 blur-3xl"
          style={{ background: "color-mix(in oklab, var(--gold-500) 35%, transparent)" }}
        />
      </div>

      <div className="relative flex flex-col items-center">
        {/* orb */}
        <div className="relative mb-6 h-24 w-24">
          <div
            className="absolute inset-0 animate-pulse rounded-full"
            style={{
              background:
                "conic-gradient(from 180deg at 50% 50%, var(--brand-700), var(--brand-500), var(--gold-500), var(--brand-700))",
              filter: "blur(2px)",
            }}
          />
          <div className="absolute inset-2 rounded-full bg-surface shadow-inner" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-brand-700" />
          </div>
        </div>

        <div className="text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-700">
            AI Commercial Workspace
          </div>
          <h2 className="mt-2 text-[22px] font-semibold tracking-tight text-ink-900">
            What would you like to explore?
          </h2>
          <p className="mt-1 max-w-md text-[12.5px] text-ink-500">
            Pick a starting point and I&apos;ll analyze the POD, buyer history, supplier rates and
            propose scenarios.
          </p>
        </div>

        <div className="mt-6 flex max-w-2xl flex-wrap justify-center gap-2">
          {pills.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.id}
                onClick={() => onPick(p.id, p.label)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12.5px] font-medium shadow-sm transition-all",
                  p.primary
                    ? "border-brand-700/30 bg-gradient-to-br from-brand-700 to-brand-500 text-white hover:shadow-md"
                    : "border-hairline bg-surface text-ink-700 hover:border-brand-700/40 hover:text-brand-700",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AnalyzingSkeleton() {
  return (
    <div className="p-6">
      <div className="mb-4 flex items-center gap-2 text-[12px] text-brand-700">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-700" />
        </span>
        Analyzing POD, buyer history and supplier rates…
      </div>
      <div className="grid grid-cols-[200px_repeat(3,minmax(240px,1fr))] gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-[220px] animate-pulse rounded-lg bg-surface-alt/60" />
            {Array.from({ length: 8 }).map((_, j) => (
              <div key={j} className="h-6 animate-pulse rounded-md bg-surface-alt/40" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   LEFT PANEL
   ============================================================ */

function LeftPanel({
  open,
  setOpen,
  srf,
  article,
  scenarios,
  hiddenScenarios,
  onRestoreScenario,
  phase,
  activeId,
  setActiveId,
  onDelete,
  onDuplicate,
  hiddenGroups,
  onRestoreGroup,
  isUserCreated,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  srf: (typeof SRFS)[number];
  article: Article;
  scenarios: Scenario[];
  hiddenScenarios: Scenario[];
  onRestoreScenario: (id: string) => void;
  phase: Phase;
  activeId: string;
  setActiveId: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  hiddenGroups: FieldGroup[];
  onRestoreGroup: (g: FieldGroup) => void;
  isUserCreated: (id: string) => boolean;
}) {
  if (!open) {
    return (
      <aside className="flex w-9 shrink-0 flex-col items-center border-r border-hairline bg-surface py-3">
        <button
          onClick={() => setOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-ink-500 hover:bg-surface-alt hover:text-ink-900"
          aria-label="Open left panel"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
        <div className="mt-3 rotate-180 [writing-mode:vertical-rl] text-[10.5px] font-medium uppercase tracking-widest text-ink-500">
          Article · Scenarios
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-r border-hairline bg-surface">
      <div className="flex h-11 items-center gap-2 border-b border-hairline px-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
          Article
        </span>
        <button
          onClick={() => setOpen(false)}
          className="ml-auto flex h-6 w-6 items-center justify-center rounded text-ink-400 hover:text-ink-900"
          aria-label="Collapse"
        >
          <PanelLeftClose className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Article details */}
        <div className="border-b border-hairline p-3">
          <div className="mb-2 aspect-square w-full overflow-hidden rounded-lg bg-gradient-to-br from-surface-alt/60 to-surface">
            <img
              src={article.image}
              alt={article.name}
              className="h-full w-full object-contain mix-blend-multiply"
            />
          </div>
          <div className="text-[13px] font-semibold text-ink-900">{article.name}</div>
          <div className="mt-0.5 text-[11px] text-ink-500">{article.size}</div>
          <div className="mt-3 space-y-1 text-[11.5px]">
            <MetaRow label="Buyer" value={srf.buyer} />
            <MetaRow label="Composition" value="100% Cotton" />
            <MetaRow label="MOQ" value={`${srf.moq.toLocaleString?.() ?? srf.moq} pcs`} />
            <MetaRow label="Season" value={String(srf.season)} />
            <MetaRow label="Target" value="$8.50 FOB" />
          </div>
        </div>

        {/* Scenarios list */}
        <div className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
              Scenarios · {scenarios.length}
            </span>
          </div>

          {phase !== "ready" && (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-md bg-surface-alt/50" />
              ))}
            </div>
          )}

          {phase === "ready" && (
            <div className="space-y-1.5">
              {scenarios.map((s) => {
                const m = computeMetrics(s.selection);
                const isActive = s.id === activeId;
                return (
                  <div
                    key={s.id}
                    onClick={() => setActiveId(s.id)}
                    className={cn(
                      "group flex cursor-pointer items-start gap-2 rounded-md border px-2 py-1.5 transition-all",
                      isActive
                        ? "border-brand-700 bg-brand-50/40"
                        : "border-hairline bg-surface hover:bg-surface-alt/60",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                        s.recommended ? "bg-brand-700" : isActive ? "bg-brand-500" : "bg-ink-300",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="truncate text-[12px] font-medium text-ink-900">
                          {s.name}
                        </span>
                        {s.recommended && (
                          <Star className="h-2.5 w-2.5 fill-gold-500 text-gold-500" />
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[10.5px] text-ink-500">
                        <span className="num">${m.totalCost.toFixed(2)}</span>
                        <span>·</span>
                        <span className="num">{m.margin}% M</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicate(s.id);
                        }}
                        className="flex h-5 w-5 items-center justify-center rounded text-ink-400 hover:bg-surface hover:text-ink-900"
                        aria-label="Duplicate"
                        title="Duplicate scenario"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      {s.kind !== "current" && isUserCreated(s.id) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(s.id);
                          }}
                          className="flex h-5 w-5 items-center justify-center rounded text-ink-400 hover:bg-surface hover:text-red-600"
                          aria-label="Delete"
                          title="Delete scenario"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Hidden scenarios — add back to workspace */}
          {hiddenScenarios.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
                  Hidden scenarios · {hiddenScenarios.length}
                </span>
              </div>
              <div className="space-y-1">
                {hiddenScenarios.map((s) => {
                  const m = computeMetrics(s.selection);
                  return (
                    <button
                      key={s.id}
                      onClick={() => onRestoreScenario(s.id)}
                      className="flex w-full items-center gap-2 rounded-md border border-dashed border-hairline bg-surface-alt/40 px-2 py-1.5 text-left text-[11.5px] text-ink-700 hover:border-brand-700/40 hover:bg-brand-50/40 hover:text-brand-700"
                      title={`Add ${s.name} back`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-ink-900">{s.name}</div>
                        <div className="text-[10px] text-ink-500">
                          ${m.totalCost.toFixed(2)} · {m.margin}% M
                        </div>
                      </div>
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface text-brand-700 group-hover:border-brand-700/40">
                        <Plus className="h-3 w-3" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-500">{label}</span>
      <span className="text-ink-900">{value}</span>
    </div>
  );
}

/* ============================================================
   SCENARIO TABLE (Configuration tab)
   ============================================================ */

const GROUPS: FieldGroup[] = ["Fabric", "Making", "Accessories", "Commercial"];
const GROUP_LABEL: Record<FieldGroup, string> = {
  Fabric: "Materials",
  Making: "Making",
  Accessories: "Accessories",
  Commercial: "Commercial",
};

const COL_W = 240;
const LABEL_W = 200;

function ScenarioTable({
  scenarios,
  currentSel,
  activeId,
  setActiveId,
  onChangeField,
  onDuplicate,
  onDelete,
  onHide,
  onRename,
  highlighted,
  hiddenGroups,
  onHideGroup,
  isUserCreated,
}: {
  srf: (typeof SRFS)[number];
  article: Article;
  scenarios: Scenario[];
  currentSel: Record<string, string>;
  activeId: string;
  setActiveId: (id: string) => void;
  onChangeField: (sid: string, fid: string, oid: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onHide: (id: string) => void;
  onRename: (id: string, name: string) => void;
  highlighted?: Record<string, string[]>;
  hiddenGroups: FieldGroup[];
  onHideGroup: (g: FieldGroup) => void;
  isUserCreated: (id: string) => boolean;
}) {
  const cols = scenarios.length;
  const gridTemplate = `${LABEL_W}px repeat(${cols}, minmax(${COL_W}px, 1fr))`;
  const visibleGroups = GROUPS.filter((g) => !hiddenGroups.includes(g));

  return (
    <div className="min-w-max">
      {/* Sticky scenario headers */}
      <div
        className="sticky top-0 z-20 grid border-b border-hairline bg-surface"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        <div className="sticky left-0 z-10 flex items-end border-r border-hairline bg-surface p-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
            Compare
          </div>
        </div>

        {scenarios.map((s) => {
          const userMade = isUserCreated(s.id);
          return (
            <div key={s.id} className="border-r border-hairline last:border-r-0">
              <ScenarioHeader
                scenario={s}
                active={s.id === activeId}
                onClick={() => setActiveId(s.id)}
                onDuplicate={() => onDuplicate(s.id)}
                onHide={s.kind !== "current" ? () => onHide(s.id) : undefined}
                onDelete={s.kind !== "current" && userMade ? () => onDelete(s.id) : undefined}
                onRename={(name) => onRename(s.id, name)}
              />
            </div>
          );
        })}
      </div>

      {/* Grouped rows */}
      {visibleGroups.map((group) => {
        const groupFields = FIELDS.filter((f) => f.group === group);
        return (
          <div key={group}>
            <div
              className="grid border-b border-hairline bg-surface-alt/40"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              <div className="sticky left-0 z-10 flex items-center gap-1.5 border-r border-hairline bg-surface-alt/60 px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-500">
                <span>{GROUP_LABEL[group]}</span>
              </div>
              {scenarios.map((s) => (
                <div key={s.id} className="border-r border-hairline last:border-r-0" />
              ))}
            </div>

            {groupFields.map((field) => (
              <div
                key={field.id}
                className="grid border-b border-hairline/70 bg-surface hover:bg-surface-alt/20"
                style={{ gridTemplateColumns: gridTemplate }}
              >
                <div className="sticky left-0 z-10 flex items-center border-r border-hairline bg-surface px-3 py-2.5 text-[12px] text-ink-700">
                  {field.label}
                </div>
                {scenarios.map((s) => {
                  const val = s.selection[field.id];
                  const base = currentSel[field.id];
                  const changed = s.kind !== "current" && val !== base;
                  const isHighlighted = highlighted?.[s.id]?.includes(field.id) ?? false;
                  return (
                    <div key={s.id} className="border-r border-hairline last:border-r-0">
                      <ConfigCell
                        field={field}
                        value={val}
                        baseValue={base}
                        changed={changed}
                        highlight={isHighlighted}
                        onChange={(v) => onChangeField(s.id, field.id, v)}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        );
      })}

      <div style={{ height: 24 }} />
    </div>
  );
}

function ScenarioHeader({
  scenario,
  active,
  onClick,
  onDuplicate,
  onHide,
  onDelete,
  onRename,
}: {
  scenario: Scenario;
  active: boolean;
  onClick: () => void;
  onDuplicate: () => void;
  onHide?: () => void;
  onDelete?: () => void;
  onRename?: (name: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(scenario.name);
  useEffect(() => setNameDraft(scenario.name), [scenario.name]);
  const m = computeMetrics(scenario.selection);

  const perPiece = m.totalCost;
  const targetPrice = 8.5;
  const moqLabel =
    scenario.selection.moq === "5000"
      ? "5,000 pcs"
      : scenario.selection.moq === "2500"
        ? "2,500 pcs"
        : "1,000 pcs";
  const isPremium = scenario.kind === "premium";
  const healthChip = isPremium
    ? { bg: "bg-brand-50", text: "text-brand-700", label: "Premium" }
    : m.margin >= 20
      ? { bg: "bg-brand-50", text: "text-brand-700", label: "Good" }
      : m.margin >= 15
        ? { bg: "bg-gold-50", text: "text-gold-700", label: "Watch" }
        : { bg: "bg-red-50", text: "text-red-700", label: "At Risk" };

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative m-1.5 cursor-pointer rounded-lg border p-3 transition-all",
        active
          ? "border-brand-700 shadow-sm ring-1 ring-brand-700/10"
          : "border-transparent hover:border-hairline hover:bg-surface-alt/40",
      )}
    >
      <div className="flex items-center gap-1.5">
        {editing && onRename ? (
          <input
            autoFocus
            value={nameDraft}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => {
              const v = nameDraft.trim() || scenario.name;
              onRename(v);
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setNameDraft(scenario.name);
                setEditing(false);
              }
            }}
            className="min-w-0 flex-1 rounded border border-brand-700/40 bg-surface px-1 py-0.5 text-[13px] font-semibold text-ink-900 outline-none focus:border-brand-700"
          />
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onRename) setEditing(true);
            }}
            className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold text-ink-900 hover:text-brand-700"
            title={onRename ? "Click to rename" : undefined}
          >
            {scenario.name}
          </button>
        )}
        {scenario.recommended && <Star className="h-3 w-3 shrink-0 fill-gold-500 text-gold-500" />}
        <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            className="flex h-5 w-5 items-center justify-center rounded text-ink-400 hover:bg-surface hover:text-ink-900"
            title="Duplicate scenario"
          >
            <Copy className="h-3 w-3" />
          </button>
          {onHide && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onHide();
              }}
              className="flex h-5 w-5 items-center justify-center rounded text-ink-400 hover:bg-surface hover:text-ink-900"
              title="Hide scenario (still available in left panel)"
              aria-label="Hide scenario"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="flex h-5 w-5 items-center justify-center rounded text-ink-400 hover:bg-surface hover:text-red-600"
              title="Delete scenario"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {scenario.recommended ? (
        <span className="mt-1 inline-block rounded-sm bg-gradient-to-r from-brand-700 to-brand-500 px-1.5 py-px text-[9.5px] font-medium text-white">
          AI Recommended
        </span>
      ) : (
        <div className="mt-1 truncate text-[10.5px] text-ink-500">
          {scenario.kind === "current" ? "Baseline" : scenario.tagline}
        </div>
      )}

      {/* Product image — transparent, centered */}
      <div className="mt-2 flex h-24 items-center justify-center">
        <img
          src={IMG.towel}
          alt=""
          className="max-h-24 object-contain mix-blend-multiply"
          style={{
            filter:
              scenario.kind === "premium"
                ? "sepia(.25) saturate(1.15)"
                : scenario.kind === "lowest"
                  ? "grayscale(.35) brightness(1.03)"
                  : "none",
          }}
        />
      </div>

      {/* Big Total Cost + supporting stats */}
      <div className="mt-2 border-t border-hairline pt-2">
        <div className="text-[9px] font-semibold uppercase tracking-wider text-ink-400">
          Total Cost
        </div>
        <div className="mt-0.5 flex items-baseline gap-1">
          <span className="num text-[22px] font-semibold leading-none text-brand-700">
            ${m.totalCost.toFixed(2)}
          </span>
          <span className="text-[10px] text-ink-500">per piece</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
          <HeaderStat
            label="Margin"
            value={`${m.margin}%`}
            tone={m.margin >= 20 ? "good" : m.margin >= 12 ? "warn" : "bad"}
            strong
          />
          <HeaderStat label="Lead Time" value={`${m.leadTime}d`} strong />
          <HeaderStat label="Selling" value={`$${m.sellingPrice.toFixed(2)}`} />
          <HeaderStat label="Confidence" value={`${m.confidence}%`} />
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
            healthChip.bg,
            healthChip.text,
          )}
        >
          <span
            className={cn("h-1.5 w-1.5 rounded-full", healthChip.text.replace("text-", "bg-"))}
          />
          {healthChip.label}
        </span>
        <span className="num text-[10px] text-ink-500">MOQ {moqLabel}</span>
      </div>

      {/* Expandable summary — target and price positioning only */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setExpanded((v) => !v);
        }}
        className="mt-2 flex w-full items-center justify-between rounded-md border border-hairline bg-surface px-2 py-1 text-[10.5px] text-ink-500 hover:bg-surface-alt"
      >
        <span className="font-medium text-ink-700">
          {expanded ? "Hide" : "Show"} pricing detail
        </span>
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {expanded && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-2 space-y-2 rounded-md border border-hairline bg-surface p-2 text-[10.5px]"
        >
          <div className="grid grid-cols-3 gap-1">
            <MiniStat label="Target" value={`$${targetPrice.toFixed(2)}`} />
            <MiniStat label="Selling" value={`$${m.sellingPrice.toFixed(2)}`} />
            <MiniStat
              label="Margin"
              value={`${m.margin}%`}
              tone={m.margin >= 20 ? "good" : m.margin >= 12 ? "warn" : "bad"}
            />
            <MiniStat label="Per piece" value={`$${perPiece.toFixed(2)}`} />
            <MiniStat label="MOQ" value={moqLabel} />
            <MiniStat label="Confidence" value={`${m.confidence}%`} />
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "bad";
}) {
  return (
    <div className="rounded border border-hairline bg-surface-alt/40 px-1.5 py-1">
      <div className="text-[8.5px] uppercase tracking-wide text-ink-400">{label}</div>
      <div
        className={cn(
          "num text-[11px] font-semibold",
          tone === "good" && "text-brand-700",
          tone === "warn" && "text-gold-700",
          tone === "bad" && "text-red-700",
          !tone && "text-ink-900",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function HeaderStat({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "good" | "warn" | "bad";
}) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[9px] uppercase tracking-wide text-ink-400">{label}</div>
      <div
        className={cn(
          "num truncate text-[12px]",
          strong ? "font-semibold text-ink-900" : "font-medium text-ink-800",
          tone === "good" && "text-brand-700",
          tone === "warn" && "text-gold-700",
          tone === "bad" && "text-red-700",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function reasonForOption(fieldId: string, optionId: string, delta: number, note?: string): string {
  const key = `${fieldId}:${optionId}`;
  const map: Record<string, string> = {
    "front_fabric:cotton_500": "Standard weight — matches this buyer's accepted spec.",
    "front_fabric:cotton_600": "Premium hand-feel; used on their higher-margin SKUs.",
    "front_fabric:cotton_blend": "OEKO-TEX blend — lifts sustainability score.",
    "front_fabric:cotton_450": "Trims material cost with minimal buyer-visible change.",
    "supplier:karur": "96% on-time · 18 previous orders with this buyer.",
    "supplier:erode": "GOTS-traceable; slightly higher cost, 94% on-time.",
    "supplier:panipat": "Lowest quoted rate but longer lead time.",
    "moq:1000": "Fastest turn but higher per-piece cost.",
    "moq:2500": "Sweet spot — best margin at buyer's typical order size.",
    "moq:5000": "Volume discount unlocked at cost of 8 extra lead days.",
    "packaging:polybag": "Cheapest option — non retail-facing.",
    "packaging:kraft_sleeve": "Retail-friendly and modest cost bump.",
    "packaging:retail_ready": "Ready for shelf; premium buyers expect this.",
    "certifications:gots": "Required for buyer's sustainability scorecard.",
    "certifications:oekotex_bci": "Buyer's minimum sustainability bar.",
    "transportation:fob": "Buyer handles freight — cleanest quote.",
    "transportation:ddp": "Door delivery — shortens lead time, higher landed cost.",
  };
  if (map[key]) return map[key];
  if (note) return note;
  if (delta < -0.001) return `Trims ~$${Math.abs(delta).toFixed(2)}/pc vs baseline.`;
  if (delta > 0.001) return `Adds ~$${delta.toFixed(2)}/pc for a stronger spec.`;
  return "Matches the buyer's baseline spec.";
}

function ConfigCell({
  field,
  value,
  baseValue,
  changed,
  highlight,
  onChange,
}: {
  field: (typeof FIELDS)[number];
  value: string;
  baseValue: string;
  changed: boolean;
  highlight?: boolean;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const opt = field.options.find((o) => o.id === value) ?? field.options[0];
  const baseOpt = field.options.find((o) => o.id === baseValue) ?? field.options[0];
  const delta = opt.delta - baseOpt.delta;
  const reason = reasonForOption(field.id, opt.id, opt.delta, opt.note);
  const priceLabel =
    opt.delta === 0
      ? "Base"
      : opt.delta > 0
        ? `+$${opt.delta.toFixed(2)}`
        : `−$${Math.abs(opt.delta).toFixed(2)}`;

  return (
    <div
      className={cn(
        "group/cell relative flex flex-col justify-center px-3 py-2 transition-all",
        highlight &&
          "animate-pulse bg-gradient-to-r from-brand-50/80 via-gold-50/60 to-brand-50/40 ring-1 ring-brand-700/50",
      )}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-start justify-between gap-1.5 text-left text-[12.5px] outline-none",
          changed ? "text-brand-700 font-medium" : "text-ink-900",
        )}
      >
        <span className="flex items-start gap-1.5 min-w-0">
          {(changed || highlight) && (
            <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-brand-700" />
          )}
          <span className="truncate">{opt.label}</span>
        </span>
        <span
          className={cn(
            "num shrink-0 text-[11px]",
            opt.delta < 0 ? "text-brand-700" : opt.delta > 0 ? "text-gold-700" : "text-ink-500",
          )}
        >
          {priceLabel}
        </span>
      </button>

      {/* AI one-line reason for this selection */}
      <div className="mt-0.5 flex items-start gap-1 text-[10.5px] text-ink-500">
        <Sparkles className="mt-[2px] h-2.5 w-2.5 shrink-0 text-brand-700/70" />
        <span className="truncate" title={reason}>
          {reason}
        </span>
      </div>

      {changed && Math.abs(delta) > 0.001 && (
        <div className="mt-0.5 flex items-center gap-1 text-[10.5px]">
          {delta < 0 ? (
            <span className="text-brand-700">
              ↓ Saves ${Math.abs(delta).toFixed(2)}/pc vs baseline
            </span>
          ) : (
            <span className="text-gold-700">↑ Adds ${delta.toFixed(2)}/pc vs baseline</span>
          )}
        </div>
      )}

      {open && (
        <div className="absolute left-3 top-full z-40 mt-1 w-72 overflow-hidden rounded-lg border border-hairline bg-surface shadow-xl">
          {field.options.map((o) => {
            const oPrice =
              o.delta === 0
                ? "Base"
                : o.delta > 0
                  ? `+$${o.delta.toFixed(2)}`
                  : `−$${Math.abs(o.delta).toFixed(2)}`;
            const oReason = reasonForOption(field.id, o.id, o.delta, o.note);
            return (
              <button
                key={o.id}
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-start justify-between gap-2 px-2.5 py-1.5 text-left hover:bg-surface-alt",
                  o.id === value && "bg-brand-50/40",
                )}
              >
                <div className="min-w-0">
                  <div className="truncate text-[12px] text-ink-900">{o.label}</div>
                  <div className="truncate text-[10.5px] text-ink-500">{oReason}</div>
                </div>
                <div
                  className={cn(
                    "num shrink-0 text-[11px]",
                    o.delta < 0 ? "text-brand-700" : o.delta > 0 ? "text-gold-700" : "text-ink-500",
                  )}
                >
                  {oPrice}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   COST ANALYSIS VIEW — wider, with section separators
   ============================================================ */

function CostAnalysisView({
  scenarios,
  activeId,
  setActiveId,
}: {
  srf: (typeof SRFS)[number];
  article: Article;
  scenarios: Scenario[];
  activeId: string;
  setActiveId: (id: string) => void;
}) {
  const cols = scenarios.length;
  const COST_COL = 320;
  const COST_LABEL = 220;
  const gridTemplate = `${COST_LABEL}px repeat(${cols}, minmax(${COST_COL}px, 1fr))`;

  return (
    <div className="min-w-max">
      {/* Sticky headers */}
      <div
        className="sticky top-0 z-20 grid border-b-2 border-hairline bg-surface"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        <div className="sticky left-0 z-10 border-r-2 border-hairline bg-surface p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
            Cost Analysis
          </div>
          <div className="mt-1 text-[10.5px] text-ink-400">Per scenario comparison</div>
        </div>
        {scenarios.map((s) => (
          <div key={s.id} className="border-r-2 border-hairline last:border-r-0">
            <ScenarioHeader
              scenario={s}
              active={s.id === activeId}
              onClick={() => setActiveId(s.id)}
              onDuplicate={() => {}}
            />
          </div>
        ))}
      </div>

      {[
        {
          title: "Cost Composition",
          note: "Stacked share per scenario",
          render: (s: Scenario) => {
            const m = computeMetrics(s.selection);
            const rows = costRows(m);
            return (
              <div>
                <div className="flex h-7 w-full overflow-hidden rounded-md border border-hairline">
                  {rows.map((r) => (
                    <div
                      key={r.key}
                      className="transition-all hover:brightness-110"
                      style={{ width: `${r.pct}%`, backgroundColor: r.color }}
                      title={`${r.label}: $${r.value.toFixed(2)} (${r.pct}%)`}
                    />
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10.5px] text-ink-600">
                  {rows.map((r) => (
                    <div key={r.key} className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-sm"
                        style={{ background: r.color }}
                      />
                      <span className="flex-1 truncate">{r.label}</span>
                      <span className="num text-ink-900">${r.value.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          },
        },
        {
          title: "Top Cost Drivers",
          note: "Ranked contribution",
          render: (s: Scenario) => {
            const m = computeMetrics(s.selection);
            const top = costRows(m)
              .sort((a, b) => b.value - a.value)
              .slice(0, 3);
            return (
              <div className="space-y-1.5">
                {top.map((r, i) => (
                  <div key={r.key} className="flex items-center gap-2 text-[12px]">
                    <span className="text-ink-400">#{i + 1}</span>
                    <span className="h-2 w-2 rounded-sm" style={{ background: r.color }} />
                    <span className="flex-1 text-ink-800">{r.label}</span>
                    <span className="num text-ink-900">${r.value.toFixed(2)}</span>
                    <span className="num w-9 text-right text-ink-400">{r.pct}%</span>
                  </div>
                ))}
              </div>
            );
          },
        },
        {
          title: "Margin Waterfall",
          note: "Price − cost buckets = profit",
          render: (s: Scenario) => <MarginWaterfall m={computeMetrics(s.selection)} />,
        },
        {
          title: "Break-even Analysis",
          note: "Units where revenue covers cost",
          render: (s: Scenario) => {
            const m = computeMetrics(s.selection);
            const fixed = 4200;
            const beUnits = Math.round(fixed / Math.max(0.05, m.sellingPrice - m.totalCost));
            return (
              <div>
                <div className="text-[11px] text-ink-500">Break-even at</div>
                <div className="num text-[16px] font-semibold text-ink-900">
                  {beUnits.toLocaleString()} pcs
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-alt">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-700 to-brand-500"
                    style={{ width: `${Math.min(100, (2500 / beUnits) * 100)}%` }}
                  />
                </div>
                <div className="mt-1 text-[10.5px] text-ink-500">
                  MOQ 2,500 covers {Math.min(100, Math.round((2500 / beUnits) * 100))}%
                </div>
              </div>
            );
          },
        },
        {
          title: "Risk Summary",
          note: "Commercial risks by category",
          render: (s: Scenario) => {
            const m = computeMetrics(s.selection);
            const risks = [
              { l: "Supplier", v: s.selection.supplier === "panipat" ? "High" : "Low" },
              { l: "MOQ", v: s.selection.moq === "5000" ? "High" : "Medium" },
              { l: "Lead Time", v: m.leadTime > 45 ? "Medium" : "Low" },
              { l: "Margin", v: m.margin < 15 ? "High" : "Low" },
            ];
            return (
              <div className="space-y-1">
                {risks.map((r) => (
                  <div key={r.l} className="flex items-center justify-between text-[12px]">
                    <span className="text-ink-700">{r.l}</span>
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                        r.v === "High"
                          ? "bg-red-50 text-red-700"
                          : r.v === "Medium"
                            ? "bg-gold-50 text-gold-700"
                            : "bg-brand-50 text-brand-700",
                      )}
                    >
                      {r.v}
                    </span>
                  </div>
                ))}
              </div>
            );
          },
        },
      ].map((section) => (
        <section key={section.title} className="border-b-2 border-hairline">
          <div
            className="grid border-b border-hairline bg-surface-alt/50"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            <div className="sticky left-0 z-10 border-r-2 border-hairline bg-surface-alt/60 px-4 py-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-700">
                {section.title}
              </div>
              <div className="text-[10.5px] text-ink-400">{section.note}</div>
            </div>
            {scenarios.map((s) => (
              <div key={s.id} className="border-r-2 border-hairline last:border-r-0" />
            ))}
          </div>
          <div className="grid" style={{ gridTemplateColumns: gridTemplate }}>
            <div className="sticky left-0 z-10 border-r-2 border-hairline bg-surface px-4 py-4 text-[11.5px] text-ink-500">
              {section.title}
            </div>
            {scenarios.map((s) => (
              <div key={s.id} className="border-r-2 border-hairline p-4 last:border-r-0">
                {section.render(s)}
              </div>
            ))}
          </div>
        </section>
      ))}

      <div style={{ height: 24 }} />
    </div>
  );
}

function MarginWaterfall({ m }: { m: Metrics }) {
  const buckets = [
    { l: "Price", v: m.sellingPrice, c: "#0a7460" },
    { l: "Mat", v: -m.material, c: "#c7d3ce" },
    { l: "Make", v: -m.making, c: "#c7d3ce" },
    { l: "Pack", v: -m.packaging, c: "#c7d3ce" },
    { l: "Other", v: -(m.testing + m.transportation), c: "#c7d3ce" },
    { l: "Profit", v: m.profit, c: "#c69324" },
  ];
  const max = Math.max(...buckets.map((b) => Math.abs(b.v)));
  return (
    <div>
      <div className="flex items-end gap-1" style={{ height: 68 }}>
        {buckets.map((b) => (
          <div key={b.l} className="flex flex-1 flex-col items-center justify-end">
            <div
              className="w-full rounded-sm"
              style={{ height: `${(Math.abs(b.v) / max) * 62}px`, background: b.c }}
              title={`${b.l}: ${b.v.toFixed(2)}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1 text-[9.5px] text-ink-500">
        {buckets.map((b) => (
          <div key={b.l} className="flex-1 text-center">
            {b.l}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   QUOTE PREVIEW
   ============================================================ */

function QuotePreview({
  srf,
  article,
  scenarios,
  active,
}: {
  srf: (typeof SRFS)[number];
  article: Article;
  scenarios: Scenario[];
  active: Scenario;
}) {
  const [mode, setMode] = useState<"single" | "multi" | "combined">("multi");
  const options = mode === "single" ? [active] : scenarios.slice(0, 3);

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
            Quote Preview
          </div>
          <div className="mt-0.5 text-[16px] font-semibold text-ink-900">
            {srf.buyer} · {article.name}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-md border border-hairline bg-surface-alt/60 p-0.5 text-[11.5px]">
            {(["single", "multi", "combined"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setMode(k)}
                className={cn(
                  "rounded px-2 py-1 capitalize",
                  mode === k
                    ? "bg-surface text-ink-900 shadow-sm"
                    : "text-ink-500 hover:text-ink-900",
                )}
              >
                {k === "single" ? "Single" : k === "multi" ? "Multi (A/B/C)" : "Combined"}
              </button>
            ))}
          </div>
          <button className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 text-[12px] font-medium text-ink-700 hover:bg-surface-alt">
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
          <button className="inline-flex h-8 items-center gap-1.5 rounded-md bg-ink-900 px-3 text-[12px] font-medium text-white hover:bg-ink-800">
            <Download className="h-3.5 w-3.5" /> Export PDF
          </button>
        </div>
      </div>

      <ProposalDocument srf={srf} article={article} options={options} />
    </div>
  );
}

/* ============================================================
   PROPOSAL DOCUMENT — premium, customer-facing quotation
   ============================================================ */

function ProposalDocument({
  srf,
  article,
  options,
  articles,
}: {
  srf: (typeof SRFS)[number];
  article?: Article;
  options: Scenario[];
  articles?: { article: Article; options: Scenario[] }[];
}) {
  const today = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const validUntil = new Date(Date.now() + 30 * 86400_000).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const quoteRef = `TRC-${srf.id.replace(/[^0-9]/g, "")}-${new Date().getFullYear()}`;

  const groups = articles ?? (article ? [{ article, options }] : []);
  const flatCount = groups.reduce((n, g) => n + g.options.length, 0);
  let pageIndex = 0;

  return (
    <div className="space-y-6">
      {/* Cover / letterhead */}
      <ProposalHeader srf={srf} quoteRef={quoteRef} today={today} validUntil={validUntil} />

      {groups.map((g, gi) => (
        <div key={g.article.id} className="space-y-6">
          {groups.length > 1 && (
            <div className="flex items-center gap-3 pt-2">
              <div className="h-px flex-1 bg-hairline" />
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-500">
                Article {gi + 1} — {g.article.name}
              </div>
              <div className="h-px flex-1 bg-hairline" />
            </div>
          )}
          {g.options.map((s, i) => {
            pageIndex += 1;
            return (
              <ProposalOption
                key={g.article.id + s.id}
                srf={srf}
                article={g.article}
                scenario={s}
                letter={String.fromCharCode(65 + i)}
                pageIndex={pageIndex}
                totalPages={flatCount}
                quoteRef={quoteRef}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ProposalHeader({
  srf,
  quoteRef,
  today,
  validUntil,
}: {
  srf: (typeof SRFS)[number];
  quoteRef: string;
  today: string;
  validUntil: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-surface shadow-sm">
      <div className="flex items-start justify-between gap-6 border-b border-hairline bg-surface px-8 py-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-700 text-[15px] font-semibold tracking-tight text-white">
              T
            </div>
            <div>
              <div className="text-[15px] font-semibold tracking-tight text-ink-900">
                Tracon Textiles
              </div>
              <div className="text-[10.5px] uppercase tracking-[0.18em] text-ink-400">
                Home & Living
              </div>
            </div>
          </div>
          <div className="mt-5 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-brand-700">
            Commercial Proposal
          </div>
          <div className="mt-1 text-[26px] font-semibold leading-tight tracking-tight text-ink-900">
            Prepared for {srf.buyer}
          </div>
          <div className="mt-1 text-[12px] text-ink-500">
            {srf.season} · Collection Home Essentials
          </div>
        </div>
        <div className="grid w-[320px] shrink-0 grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
          <HeaderMeta label="Quotation Ref" value={quoteRef} />
          <HeaderMeta label="Buyer Ref" value={srf.id} />
          <HeaderMeta label="Inquiry Date" value={today} />
          <HeaderMeta label="Quotation Date" value={today} />
          <HeaderMeta label="Valid Until" value={validUntil} />
          <HeaderMeta label="Currency" value="USD" />
          <HeaderMeta label="Prepared By" value="Gautam Kitclu" />
          <HeaderMeta label="Attn." value="Sourcing Team" />
        </div>
      </div>
    </div>
  );
}

function HeaderMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.14em] text-ink-400">{label}</div>
      <div className="mt-0.5 truncate font-medium text-ink-900">{value}</div>
    </div>
  );
}

function ProposalOption({
  srf,
  article,
  scenario,
  letter,
  pageIndex,
  totalPages,
  quoteRef,
}: {
  srf: (typeof SRFS)[number];
  article: Article;
  scenario: Scenario;
  letter: string;
  pageIndex: number;
  totalPages: number;
  quoteRef: string;
}) {
  const m = computeMetrics(scenario.selection);
  const moqLabel =
    scenario.selection.moq === "5000"
      ? "5,000 pcs"
      : scenario.selection.moq === "2500"
        ? "2,500 pcs"
        : "1,000 pcs";
  const supplier =
    scenario.selection.supplier === "erode"
      ? "Erode Weaves"
      : scenario.selection.supplier === "panipat"
        ? "Panipat Textiles"
        : "Karur Mills";
  const incoterms =
    scenario.selection.transportation === "cif"
      ? "CIF Destination"
      : scenario.selection.transportation === "ddp"
        ? "DDP Door"
        : "FOB Nhava Sheva";
  const cert =
    scenario.selection.certifications === "gots"
      ? "GOTS Organic"
      : scenario.selection.certifications === "oekotex_bci"
        ? "OEKO-TEX · BCI"
        : "OEKO-TEX";

  const specs: [string, string][] = [
    ["Product", article.name],
    ["Article No.", `${article.id.toUpperCase()}-${scenario.id.toUpperCase()}`],
    ["Size", article.size.split("|")[0]?.trim() ?? article.size],
    ["GSM", article.size.split("|")[1]?.trim() ?? "500 GSM"],
    ["Composition", "100% Cotton, combed"],
    [
      "Construction",
      scenario.selection.construction === "jacquard"
        ? "Jacquard"
        : scenario.selection.construction === "terry"
          ? "Terry loop"
          : "Waffle weave",
    ],
    [
      "Front Fabric",
      FIELDS.find((f) => f.id === "front_fabric")!.options.find(
        (o) => o.id === scenario.selection.front_fabric,
      )?.label ?? "—",
    ],
    [
      "Back Fabric",
      FIELDS.find((f) => f.id === "back_fabric")!.options.find(
        (o) => o.id === scenario.selection.back_fabric,
      )?.label ?? "—",
    ],
    ["Colour", "Ivory / Buyer palette"],
    ["Dyeing", "Reactive, colour-fast"],
    [
      "Printing",
      FIELDS.find((f) => f.id === "printing")!.options.find(
        (o) => o.id === scenario.selection.printing,
      )?.label ?? "None",
    ],
    [
      "Embroidery",
      FIELDS.find((f) => f.id === "embroidery")!.options.find(
        (o) => o.id === scenario.selection.embroidery,
      )?.label ?? "None",
    ],
    [
      "Quilting",
      FIELDS.find((f) => f.id === "quilting")!.options.find(
        (o) => o.id === scenario.selection.quilting,
      )?.label ?? "None",
    ],
    [
      "Filling",
      FIELDS.find((f) => f.id === "filling")!.options.find(
        (o) => o.id === scenario.selection.filling,
      )?.label ?? "None",
    ],
    [
      "Edge Finish",
      FIELDS.find((f) => f.id === "piping")!.options.find((o) => o.id === scenario.selection.piping)
        ?.label ?? "—",
    ],
    [
      "Packaging",
      FIELDS.find((f) => f.id === "packaging")!.options.find(
        (o) => o.id === scenario.selection.packaging,
      )?.label ?? "—",
    ],
    [
      "Labels",
      FIELDS.find((f) => f.id === "labels")!.options.find((o) => o.id === scenario.selection.labels)
        ?.label ?? "—",
    ],
    [
      "Hang Tags",
      FIELDS.find((f) => f.id === "hangtags")!.options.find(
        (o) => o.id === scenario.selection.hangtags,
      )?.label ?? "None",
    ],
    ["Certifications", cert],
  ];

  const commercial: [string, string, typeof User][] = [
    ["Supplier", supplier, Building2],
    ["MOQ", moqLabel, Hash],
    ["Sampling Lead Time", "14 days", Calendar],
    ["Production Lead Time", `${m.leadTime} days`, Calendar],
    ["Loading Port", "Nhava Sheva, IN", Ship],
    ["Incoterms", incoterms, MapPin],
    ["Country of Origin", "India", MapPin],
    ["Currency", "USD", Hash],
    ["Unit", "per piece", Hash],
  ];

  const isRecommended = scenario.recommended;

  return (
    <article className="overflow-hidden rounded-2xl border border-hairline bg-surface shadow-sm print:break-before-page">
      {/* Option header */}
      <div className="flex items-center justify-between gap-4 border-b border-hairline bg-surface-alt/40 px-8 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-900 text-[12px] font-semibold text-white">
            {letter}
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500">
              Option {letter}
            </div>
            <div className="text-[16px] font-semibold text-ink-900">{scenario.name}</div>
          </div>
          {isRecommended && (
            <span className="inline-flex items-center gap-1 rounded-full border border-gold-700/30 bg-gold-50 px-2 py-0.5 text-[10.5px] font-medium text-gold-700">
              <Star className="h-3 w-3 fill-gold-500 text-gold-500" /> AI Recommended
            </span>
          )}
        </div>
        <div className="text-right text-[10.5px] uppercase tracking-[0.14em] text-ink-500">
          {scenario.tagline}
        </div>
      </div>

      {/* Hero: image + commercial summary */}
      <div className="grid grid-cols-1 gap-6 border-b border-hairline px-8 py-6 lg:grid-cols-[300px_1fr]">
        <div className="flex items-center justify-center rounded-xl bg-surface-alt/40 p-4">
          <img
            src={IMG.towel}
            alt={article.name}
            className="max-h-52 object-contain mix-blend-multiply"
          />
        </div>
        <div className="flex flex-col justify-between gap-4">
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-500">
              {srf.buyer} · {srf.season}
            </div>
            <h3 className="mt-1 text-[22px] font-semibold leading-tight tracking-tight text-ink-900">
              {article.name}
            </h3>
            <div className="mt-1 text-[12px] text-ink-500">
              Article {article.id.toUpperCase()}-{scenario.id.toUpperCase()} · Collection Home
              Essentials
            </div>
            <p className="mt-2 max-w-lg text-[12.5px] leading-relaxed text-ink-600">
              Premium {article.name.toLowerCase()} crafted from combed cotton with reactive dye
              finish. Manufactured to meet {srf.buyer}&rsquo;s quality standards for {srf.season}.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <SummaryCard label="FOB Price" value={`$${m.sellingPrice.toFixed(2)}`} accent />
            <SummaryCard label="MOQ" value={moqLabel} />
            <SummaryCard label="Lead Time" value={`${m.leadTime} days`} />
            <SummaryCard label="Payment" value="30/70" hint="Adv / BL" />
            <SummaryCard label="Validity" value="30 days" />
          </div>
        </div>
      </div>

      {/* Specifications */}
      <SectionTitle>Product Specifications</SectionTitle>
      <div className="grid grid-cols-1 gap-x-8 gap-y-0 px-8 pb-6 sm:grid-cols-2">
        {specs.map(([l, v]) => (
          <div
            key={l}
            className="flex items-baseline justify-between gap-3 border-b border-hairline/60 py-2 text-[12px]"
          >
            <span className="text-ink-500">{l}</span>
            <span className="text-right font-medium text-ink-900">{v}</span>
          </div>
        ))}
      </div>

      {/* Commercial Information */}
      <SectionTitle>Commercial Information</SectionTitle>
      <div className="grid grid-cols-1 gap-3 px-8 pb-6 sm:grid-cols-3">
        {commercial.map(([l, v, Icon]) => (
          <div
            key={l}
            className="flex items-start gap-2.5 rounded-lg border border-hairline bg-surface-alt/30 p-3"
          >
            <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-500" />
            <div className="min-w-0">
              <div className="text-[9.5px] font-semibold uppercase tracking-wider text-ink-500">
                {l}
              </div>
              <div className="mt-0.5 truncate text-[12.5px] font-medium text-ink-900">{v}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Commercial Notes */}
      <SectionTitle>Commercial Notes</SectionTitle>
      <ul className="space-y-1.5 px-8 pb-6 text-[12px] leading-relaxed text-ink-700">
        {[
          "Printing limited to 3 spot colours per artwork; complex gradients require digital sampling.",
          "All artwork, care labels and hang tags require written buyer approval prior to bulk production.",
          "Colour variation within ±5% of approved lab dip is considered commercially acceptable.",
          "Prices are indicative and subject to raw material (cotton, dyestuff) fluctuation at time of order confirmation.",
          "Third-party inspection (SGS / Intertek) at buyer's cost; pre-shipment AQL 2.5 as standard.",
        ].map((n) => (
          <li key={n} className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-400" />
            <span>{n}</span>
          </li>
        ))}
      </ul>

      {/* Terms */}
      <SectionTitle>Terms &amp; Conditions</SectionTitle>
      <div className="grid grid-cols-1 gap-4 px-8 pb-6 text-[12px] sm:grid-cols-2">
        {[
          ["Payment Terms", "30% advance against PI, 70% against copy of B/L."],
          ["Shipment", `Ex-factory within ${m.leadTime} days of PO & advance receipt.`],
          ["Validity", "30 days from date of quotation."],
          ["Quality Standards", "AATCC / ISO textile testing package. OEKO-TEX certified inputs."],
          [
            "Claims",
            "To be raised in writing within 15 days of receipt of goods, with photographic evidence.",
          ],
          ["Inspection", "Pre-shipment inspection permitted at buyer's cost, AQL 2.5."],
        ].map(([l, v]) => (
          <div key={l}>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
              {l}
            </div>
            <div className="mt-1 leading-relaxed text-ink-700">{v}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-4 border-t border-hairline bg-surface-alt/40 px-8 py-4 text-[11px] text-ink-500">
        <div>
          <div className="font-semibold text-ink-900">Tracon Textiles Pvt. Ltd.</div>
          <div>Plot 42, SIPCOT Industrial Complex, Karur, Tamil Nadu 639006, India</div>
          <div>+91 4324 456 200 · exports@tracontextiles.com</div>
        </div>
        <div className="text-right">
          <div>
            Prepared by <span className="font-medium text-ink-900">Gautam Kitclu</span>
          </div>
          <div>Quotation {quoteRef}</div>
          <div>
            Page {pageIndex} of {totalPages}
          </div>
        </div>
      </div>
    </article>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-8 pt-5 pb-3">
      <div className="flex items-center gap-3">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-500">
          {children}
        </div>
        <div className="h-px flex-1 bg-hairline" />
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-2.5",
        accent ? "border-ink-900 bg-ink-900 text-white" : "border-hairline bg-surface",
      )}
    >
      <div
        className={cn(
          "text-[9px] font-semibold uppercase tracking-[0.14em]",
          accent ? "text-white/60" : "text-ink-500",
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "num mt-1 text-[16px] font-semibold leading-none",
          accent ? "text-white" : "text-ink-900",
        )}
      >
        {value}
      </div>
      {hint && (
        <div className={cn("mt-0.5 text-[10px]", accent ? "text-white/60" : "text-ink-500")}>
          {hint}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   ARTICLES BAR — simple name chips with X
   ============================================================ */

function SrfChangesBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="flex items-start gap-3 border-b border-gold-500/30 bg-gradient-to-r from-gold-50/70 via-surface to-brand-50/30 px-4 py-2">
      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold-500/20 text-gold-700">
        <Sparkles className="h-3 w-3" />
      </div>
      <div className="flex-1 text-[11.5px] text-ink-700">
        <span className="font-semibold text-ink-900">POD updated by buyer.</span> MOQ revised{" "}
        <span className="font-medium">1,000 → 2,500 pcs</span>, packaging note added (kraft sleeve
        preferred), and testing scope expanded to full package.{" "}
        <button className="font-medium text-brand-700 underline-offset-2 hover:underline">
          Review impact
        </button>
      </div>
      <button
        onClick={onDismiss}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-400 hover:bg-surface hover:text-ink-900"
        aria-label="Dismiss"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

/* ============================================================
   RIGHT — AI WORKSPACE PANEL
   ============================================================ */

function AiWorkspacePanel({
  open,
  setOpen,
  phase,
  conversation,
  onSend,
  onPill,
  onCreateChip,
  onQuickReply,
  onApplyPatch,
  onDiscardPatch,
  onApplyCreateSummary,
  onDiscardCreateSummary,
  suggestedChips,
  activeName,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  phase: Phase;
  conversation: Array<{
    role: "user" | "ai";
    text?: string;
    card?: any;
    chips?: Array<{ label: string; kind: Scenario["kind"] }>;
    quickReplies?: Array<{ label: string; value: string }>;
    patch?: { id: number; fields: Record<string, string>; summary: string; applied: boolean };
    createSummary?: {
      id: number;
      name: string;
      kind: Scenario["kind"];
      tagline: string;
      patch: Record<string, string>;
      bullets: string[];
      applied: boolean;
    };
  }>;
  onSend: (t: string) => void;
  onPill: (id: string, label: string) => void;
  onCreateChip: (kind: Scenario["kind"], label: string) => void;
  onQuickReply: (value: string, label: string) => void;
  onApplyPatch: (id: number, scope?: "all" | "active") => void;
  onDiscardPatch: (id: number) => void;
  onApplyCreateSummary: (id: number) => void;
  onDiscardCreateSummary: (id: number) => void;
  suggestedChips: string[];
  activeName: string;
}) {
  const [input, setInput] = useState("");

  // auto-scroll to bottom on new message
  useEffect(() => {
    const el = document.getElementById("ai-scroll");
    if (el) el.scrollTop = el.scrollHeight;
  }, [conversation.length, phase]);

  if (!open) {
    return (
      <aside className="flex w-10 shrink-0 flex-col items-center border-l border-hairline bg-gradient-to-b from-brand-50/40 to-surface py-3">
        <button
          onClick={() => setOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-brand-700 to-brand-500 text-white shadow-sm"
          aria-label="Open AI Workspace"
        >
          <Sparkles className="h-3.5 w-3.5" />
        </button>
        <div className="mt-3 rotate-180 [writing-mode:vertical-rl] text-[10.5px] font-medium uppercase tracking-widest text-brand-700">
          AI Workspace
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="relative flex w-[340px] shrink-0 flex-col border-l border-brand-700/15 bg-gradient-to-b from-brand-50/40 via-surface to-surface"
      style={{
        backgroundImage:
          "radial-gradient(1200px 200px at 100% 0%, color-mix(in oklab, var(--brand-500) 10%, transparent), transparent 60%)",
      }}
    >
      <div className="flex h-11 items-center gap-2 border-b border-hairline/70 bg-surface/60 px-3 backdrop-blur">
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-brand-700 to-brand-500 text-white">
          <Sparkles className="h-3 w-3" />
        </div>
        <div className="text-[12.5px] font-semibold text-ink-900">AI Workspace</div>
        <button
          onClick={() => setOpen(false)}
          className="ml-auto flex h-6 w-6 items-center justify-center rounded text-ink-400 hover:text-ink-900"
          aria-label="Collapse"
        >
          <PanelRightClose className="h-3.5 w-3.5" />
        </button>
      </div>

      <div id="ai-scroll" className="flex-1 space-y-3 overflow-y-auto p-3">
        {conversation.length === 0 && (
          <div className="rounded-xl border border-brand-700/15 bg-surface/70 p-4 text-center shadow-sm">
            <div className="text-[12.5px] font-semibold text-ink-900">
              Ask me anything about this costing
            </div>
            <div className="mt-1 text-[11px] text-ink-500">
              Try one of the suggestions below to explore this costing.
            </div>
          </div>
        )}

        {conversation.map((msg, i) => {
          if (msg.role === "user") {
            return (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-ink-900 px-3 py-2 text-[12px] text-white shadow-sm">
                  <div className="text-[9px] font-semibold uppercase tracking-wider text-white/60">
                    You
                  </div>
                  <div className="mt-0.5 leading-snug">{msg.text}</div>
                </div>
              </div>
            );
          }
          if (msg.text) {
            const isAnalyzing = phase === "analyzing" && i === conversation.length - 1;
            return (
              <div key={i} className="flex justify-start">
                <div className="max-w-[90%] rounded-2xl rounded-bl-sm border border-hairline bg-surface px-3 py-2 text-[12px] shadow-sm">
                  <div className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-wider text-ink-500">
                    <Sparkles className="h-2.5 w-2.5 text-brand-700" /> AI Commercial Expert
                    {isAnalyzing && (
                      <span className="ml-auto flex gap-0.5">
                        <span className="h-1 w-1 animate-bounce rounded-full bg-ink-500 [animation-delay:0ms]" />
                        <span className="h-1 w-1 animate-bounce rounded-full bg-ink-500 [animation-delay:120ms]" />
                        <span className="h-1 w-1 animate-bounce rounded-full bg-ink-500 [animation-delay:240ms]" />
                      </span>
                    )}
                  </div>
                  <div className="mt-1 whitespace-pre-line leading-snug text-ink-800">
                    {msg.text}
                  </div>
                  {msg.chips && msg.chips.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {msg.chips.slice(0, 3).map((chip) => (
                        <button
                          key={chip.kind + chip.label}
                          onClick={() => onCreateChip(chip.kind, chip.label)}
                          className="inline-flex items-center gap-1 rounded-full border border-brand-700/30 bg-brand-50/40 px-2.5 py-1 text-[11px] font-medium text-brand-700 transition-all hover:-translate-y-px hover:border-brand-700 hover:bg-brand-50 hover:shadow-sm"
                        >
                          <Wand2 className="h-3 w-3" />
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {msg.quickReplies && msg.quickReplies.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {msg.quickReplies.slice(0, 3).map((r) => (
                        <button
                          key={r.value}
                          onClick={() => onQuickReply(r.value, r.label)}
                          className="inline-flex items-center gap-1 rounded-full border border-brand-700/30 bg-brand-50/40 px-2.5 py-1 text-[11px] font-medium text-brand-700 transition-all hover:-translate-y-px hover:border-brand-700 hover:bg-brand-50 hover:shadow-sm"
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {msg.patch && (
                    <div className="mt-2 rounded-lg border border-brand-700/25 bg-brand-50/30 p-2">
                      <div className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-wider text-brand-700">
                        Proposed change · {Object.keys(msg.patch.fields).length} field
                        {Object.keys(msg.patch.fields).length === 1 ? "" : "s"}
                      </div>
                      <ul className="mb-2 space-y-0.5 text-[11px] text-ink-700">
                        {Object.entries(msg.patch.fields).map(([fid, oid]) => {
                          const f = FIELDS.find((x) => x.id === fid);
                          const o = f?.options.find((x) => x.id === oid);
                          return (
                            <li key={fid} className="flex items-start gap-1.5">
                              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-brand-700" />
                              <span className="text-ink-500">{f?.label ?? fid}:</span>
                              <span className="font-medium text-ink-900">{o?.label ?? oid}</span>
                            </li>
                          );
                        })}
                      </ul>
                      {msg.patch.applied ? (
                        <div className="inline-flex items-center gap-1 rounded-md bg-brand-700/10 px-2 py-1 text-[11px] font-medium text-brand-700">
                          <Check className="h-3 w-3" /> Applied
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {activeName && (
                            <button
                              onClick={() => onApplyPatch(msg.patch!.id, "active")}
                              className="inline-flex items-center gap-1 rounded-md bg-brand-700 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-brand-800"
                              title={`Apply only to ${activeName}`}
                            >
                              <Check className="h-3 w-3" /> Apply to {activeName}
                            </button>
                          )}
                          <button
                            onClick={() => onApplyPatch(msg.patch!.id, "all")}
                            className="inline-flex items-center gap-1 rounded-md border border-brand-700/40 bg-surface px-2.5 py-1 text-[11px] font-medium text-brand-700 hover:bg-brand-50"
                          >
                            Apply to all
                          </button>
                          <button
                            onClick={() => onDiscardPatch(msg.patch!.id)}
                            className="rounded-md px-2 py-1 text-[11px] text-ink-500 hover:bg-surface hover:text-ink-900"
                          >
                            Discard
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {msg.createSummary && (
                    <div className="mt-2 rounded-lg border border-brand-700/25 bg-gradient-to-br from-brand-50/60 to-surface p-2.5">
                      <div className="mb-1 flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-wider text-brand-700">
                        <Sparkles className="h-3 w-3" /> New scenario summary
                      </div>
                      <div className="text-[13px] font-semibold text-ink-900">
                        {msg.createSummary.name}
                      </div>
                      <ul className="mt-1.5 space-y-0.5 text-[11px] text-ink-700">
                        {msg.createSummary.bullets.map((b) => (
                          <li key={b} className="flex items-start gap-1.5">
                            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-brand-700" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                      {Object.keys(msg.createSummary.patch).length > 0 && (
                        <div className="mt-2 border-t border-hairline pt-1.5">
                          <div className="mb-1 text-[9.5px] font-semibold uppercase tracking-wider text-ink-500">
                            Config overrides
                          </div>
                          <ul className="space-y-0.5 text-[11px] text-ink-700">
                            {Object.entries(msg.createSummary.patch).map(([fid, oid]) => {
                              const f = FIELDS.find((x) => x.id === fid);
                              const o = f?.options.find((x) => x.id === oid);
                              return (
                                <li key={fid} className="flex items-start gap-1.5">
                                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-brand-700" />
                                  <span className="text-ink-500">{f?.label ?? fid}:</span>
                                  <span className="font-medium text-ink-900">
                                    {o?.label ?? oid}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                      <div className="mt-2 flex items-center gap-1.5">
                        {msg.createSummary.applied ? (
                          <div className="inline-flex items-center gap-1 rounded-md bg-brand-700/10 px-2 py-1 text-[11px] font-medium text-brand-700">
                            <Check className="h-3 w-3" /> Added to workspace
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => onApplyCreateSummary(msg.createSummary!.id)}
                              className="inline-flex items-center gap-1 rounded-md bg-brand-700 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-brand-800"
                            >
                              <Check className="h-3 w-3" /> Apply — add to workspace
                            </button>
                            <button
                              onClick={() => onDiscardCreateSummary(msg.createSummary!.id)}
                              className="rounded-md px-2 py-1 text-[11px] text-ink-500 hover:bg-surface hover:text-ink-900"
                            >
                              Discard
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          }

          if (msg.card) {
            return (
              <div
                key={i}
                className="overflow-hidden rounded-xl border border-brand-700/20 bg-surface/80 shadow-sm backdrop-blur"
              >
                <div className="border-b border-hairline bg-gradient-to-br from-brand-50/70 to-surface/60 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-700">
                    New Scenario Created
                  </div>
                  <div className="mt-0.5 text-[13.5px] font-semibold text-ink-900">
                    {msg.card.title}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 border-b border-hairline px-3 py-2 text-[11px]">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-ink-400">Cost</div>
                    <div className="num text-[14px] font-semibold text-ink-900">
                      {msg.card.cost}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wide text-ink-400">Savings</div>
                    <div className="num text-[14px] font-semibold text-brand-700">
                      {msg.card.savings}
                    </div>
                  </div>
                </div>
                <div className="px-3 py-2 text-[11.5px]">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                    Key Changes
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {msg.card.changes.map((c: string) => (
                      <li key={c} className="flex items-start gap-1.5 text-ink-700">
                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-brand-700" /> {c}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex items-center gap-1 border-t border-hairline bg-surface-alt/40 px-2 py-1.5">
                  <button className="inline-flex items-center gap-1 rounded-md bg-brand-700 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-brand-800">
                    <Check className="h-3 w-3" /> Apply
                  </button>
                  <button className="rounded-md px-2 py-1 text-[11px] text-ink-500 hover:bg-surface hover:text-ink-900">
                    Compare
                  </button>
                </div>
              </div>
            );
          }
          return null;
        })}

        {suggestedChips.length > 0 && (
          <div className="space-y-2 pt-2">
            <div className="text-[9.5px] font-semibold uppercase tracking-wider text-ink-400">
              Suggested
            </div>
            <div className="flex flex-wrap gap-1.5">
              {suggestedChips.slice(0, 3).map((p) => (
                <button
                  key={p}
                  onClick={() => onSend(p)}
                  className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-700 transition-all hover:-translate-y-px hover:border-ink-900/40 hover:shadow-sm"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-hairline/70 bg-surface/70 p-2 backdrop-blur">
        <div className="flex items-center gap-2 rounded-lg border border-brand-700/20 bg-surface px-2 py-1.5 focus-within:border-brand-700">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onSend(input);
                setInput("");
              }
            }}
            placeholder={
              phase === "empty" ? "Describe what you want to explore…" : "Ask AI anything…"
            }
            className="flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-ink-400"
          />
          <button
            onClick={() => {
              onSend(input);
              setInput("");
            }}
            className="flex h-6 w-6 items-center justify-center rounded bg-brand-700 text-white hover:bg-brand-800"
          >
            <Send className="h-3 w-3" />
          </button>
        </div>
      </div>
    </aside>
  );
}

/* ============================================================
   QUOTATION SHEET (full-screen overlay)
   ============================================================ */

function QuotationSheet({
  onClose,
  srf,
  scenarios,
}: {
  onClose: () => void;
  srf: (typeof SRFS)[number];
  scenarios: Scenario[];
}) {
  const all = scenarios.slice(0, 4);
  const defaultId = all.find((s) => s.recommended)?.id ?? all[0]?.id ?? "";
  // Multi-select: user chooses which scenarios go into the quotation.
  const [pickedIds, setPickedIds] = useState<string[]>(() => (defaultId ? [defaultId] : []));
  const togglePicked = (id: string) =>
    setPickedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const options = all.filter((s) => pickedIds.includes(s.id));
  const heroArticle: Article = {
    id: "bath",
    name: "Bath Towel",
    size: srf.image ? "100×150 cm | 600 GSM" : "—",
    image: srf.image,
  };
  const [sent, setSent] = useState(false);
  const canSend = pickedIds.length > 0 && !sent;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-hairline bg-surface px-6">
        <FileText className="h-4 w-4 text-ink-700" />
        <div className="text-[14px] font-medium text-ink-900">Quotation · {srf.id}</div>
        <div className="ml-auto flex items-center gap-2">
          <button className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 text-[12px] font-medium text-ink-700 hover:bg-surface-alt">
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
          <button className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 text-[12px] font-medium text-ink-700 hover:bg-surface-alt">
            <Download className="h-3.5 w-3.5" /> Download PDF
          </button>
          <button
            onClick={() => {
              if (!canSend) return;
              setSent(true);
              window.setTimeout(() => {
                setSent(false);
                onClose();
              }, 1500);
            }}
            disabled={!canSend}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12px] font-medium text-white",
              sent
                ? "bg-brand-700"
                : canSend
                  ? "bg-brand-700 hover:bg-brand-800"
                  : "cursor-not-allowed bg-ink-300",
            )}
          >
            {sent ? (
              <>
                <Check className="h-3.5 w-3.5" /> Sent to buyer
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" /> Send to Buyer
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-500 hover:bg-surface-alt"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Scenario picker — multi-select */}
      <div className="border-b border-hairline bg-surface px-6 py-3">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
            Include scenarios
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {all.map((s) => {
              const on = pickedIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => togglePicked(s.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                    on
                      ? "border-brand-700/50 bg-brand-50 text-brand-800"
                      : "border-hairline bg-surface text-ink-600 hover:border-brand-700/30 hover:text-brand-700",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-3.5 w-3.5 items-center justify-center rounded-sm border",
                      on ? "border-brand-700 bg-brand-700 text-white" : "border-ink-300",
                    )}
                  >
                    {on && <Check className="h-2.5 w-2.5" />}
                  </span>
                  {s.name}
                  {s.recommended && (
                    <span className="rounded-full bg-gold-50 px-1 py-0.5 text-[9.5px] text-gold-700">
                      Recommended
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="ml-auto text-[11px] text-ink-400">
            {pickedIds.length === 0
              ? "Pick at least one scenario to include."
              : pickedIds.length === 1
                ? "Buyer sees a single clean offer."
                : `Buyer sees ${pickedIds.length} scenarios side-by-side.`}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-canvas p-8">
        <div className="mx-auto max-w-6xl">
          {options.length === 0 ? (
            <div className="rounded-xl border border-dashed border-hairline bg-surface p-10 text-center text-[13px] text-ink-500">
              Select one or more scenarios above to generate the quotation.
            </div>
          ) : (
            <ProposalDocument srf={srf} article={heroArticle} options={options} />
          )}
        </div>
      </div>
    </div>
  );
}
