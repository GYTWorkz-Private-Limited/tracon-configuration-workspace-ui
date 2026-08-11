// NewVariantDrawer — overlay drawer to create a new variant with 4 methods:
// Blank · Duplicate · Template · Ask AI.

import { useEffect, useState } from "react";
import { X, FilePlus2, Copy, LayoutTemplate, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_INPUTS,
  SIZE_PRESETS,
  type CushionInputs,
  type CushionVariant,
} from "@/lib/cushionCosting";

type Method = "blank" | "duplicate" | "template" | "ai";

type TemplateKey =
  | "balanced"
  | "lowest-cost"
  | "premium"
  | "value-engineered"
  | "sustainable"
  | "fast-delivery";

const TEMPLATES: { key: TemplateKey; name: string; tagline: string; patch: Partial<CushionInputs> }[] = [
  { key: "balanced", name: "Balanced", tagline: "Neutral commercial baseline", patch: {} },
  {
    key: "lowest-cost",
    name: "Lowest Cost",
    tagline: "Trim embroidery · leaner trims",
    patch: { embroidery: 0, trimsLabels: 6, packaging: 4, targetMarginPct: 0.22 },
  },
  {
    key: "premium",
    name: "Premium",
    tagline: "Better cotton · richer finish",
    patch: {
      greigeCotton: 165,
      reactivePrint: 52,
      embroidery: 78,
      fabricGsm: 240,
      targetMarginPct: 0.3,
    },
  },
  {
    key: "value-engineered",
    name: "Value Engineered",
    tagline: "Optimised inputs · same look",
    patch: { reactivePrint: 34, trimsLabels: 6, packaging: 4, waste: 0.04 },
  },
  {
    key: "sustainable",
    name: "Sustainable",
    tagline: "Organic cotton · low-impact dye",
    patch: { greigeCotton: 155, solidDyeing: 28, targetMarginPct: 0.27 },
  },
  {
    key: "fast-delivery",
    name: "Fast Delivery",
    tagline: "Smaller MOQ · quicker turnaround",
    patch: { qty: 1_000, setup: 45_000 },
  },
];

type Props = {
  open: boolean;
  onClose: () => void;
  active: CushionVariant;
  onCreate: (variant: CushionVariant) => void;
  /** "variant" = new costing version · "option" = child of a variant. */
  mode?: "variant" | "option";
  /** Candidate parent variants for the Create Option flow. */
  parents?: CushionVariant[];
};

const OPTION_TYPES = [
  "MOQ",
  "Commercial",
  "Packaging",
  "Testing",
  "Certification",
  "Custom",
] as const;
type OptType = (typeof OPTION_TYPES)[number];

const PACKAGING_OPTIONS: { label: string; rate: number }[] = [
  { label: "Standard poly bag", rate: 4 },
  { label: "Printed inner box", rate: 9 },
  { label: "Gift box + hang tag", rate: 16 },
];
const TESTING_PROFILES: { label: string; rate: number }[] = [
  { label: "Basic (shrinkage + colour fastness)", rate: 3 },
  { label: "Standard retail pack", rate: 7 },
  { label: "Full buyer protocol", rate: 12 },
];
const CERT_OPTIONS: { label: string; rate: number }[] = [
  { label: "OEKO-TEX Standard 100", rate: 5 },
  { label: "GOTS Organic", rate: 11 },
  { label: "BCI Cotton", rate: 3 },
];

export function NewVariantDrawer({ open, onClose, active, onCreate, mode = "variant", parents = [] }: Props) {
  const [method, setMethod] = useState<Method>("blank");

  // Blank state
  const [name, setName] = useState("");
  const [size, setSize] = useState<number>(active.inputs.sizeInches ?? 18);
  const [moq, setMoq] = useState<number>(active.inputs.qty);
  const [gsm, setGsm] = useState<number>(active.inputs.fabricGsm ?? 200);
  const [fx, setFx] = useState<number>(active.inputs.fxRate);
  const [margin, setMargin] = useState<number>(Math.round(active.inputs.targetMarginPct * 100));
  const [buyerTarget, setBuyerTarget] = useState<string>("");

  // Duplicate
  const [dupName, setDupName] = useState("");

  // Template
  const [tplName, setTplName] = useState("");
  const [tplKey, setTplKey] = useState<TemplateKey>("balanced");

  // AI
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Option flow
  const variantParents = parents.filter((p) => (p.entry ?? "variant") === "variant");
  const [parentId, setParentId] = useState<string>(active.parentId ?? active.id);
  const [optName, setOptName] = useState("");
  const [optType, setOptType] = useState<OptType>("MOQ");
  const [optPackaging, setOptPackaging] = useState<string>(PACKAGING_OPTIONS[0].label);
  const [optTesting, setOptTesting] = useState<string>(TESTING_PROFILES[0].label);
  const [optCert, setOptCert] = useState<string>(CERT_OPTIONS[0].label);
  const [optNote, setOptNote] = useState("");

  useEffect(() => {
    if (!open) return;
    // Reset on open
    setMethod("blank");
    setName("");
    setSize(active.inputs.sizeInches ?? 18);
    setMoq(active.inputs.qty);
    setGsm(active.inputs.fabricGsm ?? 200);
    setFx(active.inputs.fxRate);
    setMargin(Math.round(active.inputs.targetMarginPct * 100));
    setBuyerTarget("");
    setDupName(`${active.name} · copy`);
    setTplName("");
    setTplKey("balanced");
    setAiPrompt("");
    setAiLoading(false);
    setParentId(active.parentId ?? active.id);
    setOptName("");
    setOptType("MOQ");
    setOptNote("");
  }, [open, active]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;


  const makeId = (prefix: string) => `v-${prefix}-${Date.now()}`;

  const submitBlank = () => {
    const preset = SIZE_PRESETS[size] ?? {};
    // Blank = zero out all cost rates. The user configures each node manually
    // in the workspace. Keep commercial (FX/margin/qty), size, and GSM.
    const zeroInputs: CushionInputs = {
      ...DEFAULT_INPUTS,
      greigeCotton: 0,
      reactivePrint: 0,
      solidDyeing: 0,
      finishTransport: 0,
      cutting: 0,
      stitching: 0,
      embroidery: 0,
      trimsLabels: 0,
      packaging: 0,
      setup: 0,
      fillingWeightG: 0,
      ...preset,
      sizeInches: size,
      qty: moq,
      fabricGsm: gsm,
      fxRate: fx,
      targetMarginPct: margin / 100,
    };
    onCreate({
      id: makeId("blank"),
      name: name.trim() || `Variant ${Date.now().toString().slice(-4)}`,
      tagline: buyerTarget ? `Buyer target · $${buyerTarget}` : "Blank · configure manually",
      kind: "custom",
      inputs: zeroInputs,
    });
  };

  const submitDuplicate = () => {
    onCreate({
      id: makeId("dup"),
      name: dupName.trim() || `${active.name} · copy`,
      tagline: `Duplicated from ${active.name}`,
      kind: "custom",
      inputs: { ...active.inputs },
    });
  };

  const submitTemplate = () => {
    const t = TEMPLATES.find((x) => x.key === tplKey)!;
    onCreate({
      id: makeId(tplKey),
      name: tplName.trim() || t.name,
      tagline: t.tagline,
      kind: "custom",
      inputs: { ...DEFAULT_INPUTS, ...t.patch },
    });
  };

  const submitAi = async () => {
    setAiLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    // Sample: infer margin from prompt, otherwise premium-ish
    const wantsPremium = /premium|luxury|better/i.test(aiPrompt);
    const marginMatch = aiPrompt.match(/(\d{1,2})\s*%/);
    const patch: Partial<CushionInputs> = wantsPremium
      ? { greigeCotton: 165, embroidery: 78, fabricGsm: 240 }
      : {};
    if (marginMatch) patch.targetMarginPct = Number(marginMatch[1]) / 100;
    onCreate({
      id: makeId("ai"),
      name: "AI variant",
      tagline: aiPrompt.slice(0, 60) || "Generated by AI",
      kind: "custom",
      inputs: { ...DEFAULT_INPUTS, ...patch },
    });
    setAiLoading(false);
  };

  const parent = variantParents.find((p) => p.id === parentId) ?? active;

  const submitOption = () => {
    const overrides: Partial<CushionInputs> = {};
    let detail = "";
    if (optType === "MOQ") {
      overrides.qty = moq;
      detail = `MOQ ${moq.toLocaleString()} pcs`;
    } else if (optType === "Commercial") {
      overrides.targetMarginPct = margin / 100;
      overrides.fxRate = fx;
      detail = `Margin ${margin}% · FX ₹${fx}${buyerTarget ? ` · target $${buyerTarget}` : ""}`;
    } else if (optType === "Packaging") {
      const o = PACKAGING_OPTIONS.find((x) => x.label === optPackaging)!;
      overrides.packaging = o.rate;
      detail = o.label;
    } else if (optType === "Testing") {
      const o = TESTING_PROFILES.find((x) => x.label === optTesting)!;
      overrides.trimsLabels = (parent.inputs.trimsLabels ?? 0) + o.rate;
      detail = o.label;
    } else if (optType === "Certification") {
      const o = CERT_OPTIONS.find((x) => x.label === optCert)!;
      overrides.trimsLabels = (parent.inputs.trimsLabels ?? 0) + o.rate;
      detail = o.label;
    } else {
      detail = optNote || "Custom option";
    }

    onCreate({
      id: makeId("opt"),
      name: optName.trim() || `${optType} option`,
      tagline: `${parent.name} · ${detail}`,
      kind: "custom",
      entry: "option",
      parentId: parent.id,
      optionType: optType,
      overrides,
      // Options inherit everything from the parent and only differ on overrides.
      inputs: { ...parent.inputs, ...overrides },
    });
  };

  const methods: { key: Method; label: string; icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
    { key: "blank", label: "Create blank", icon: FilePlus2, desc: "Start fresh · commercials only" },
    { key: "duplicate", label: "Duplicate current", icon: Copy, desc: `Copy of ${active.name}` },
    { key: "template", label: "Start from template", icon: LayoutTemplate, desc: "Balanced · Premium · Value…" },
    { key: "ai", label: "Ask AI", icon: Sparkles, desc: "Describe the variant you want" },
  ];

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink-950/40 backdrop-blur-[2px] animate-in fade-in duration-150"
      />
      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={mode === "option" ? "Create option" : "Create variant"}
        className="absolute right-0 top-0 flex h-full w-full max-w-[560px] flex-col border-l border-line-200 bg-white shadow-2xl animate-in slide-in-from-right duration-200"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-line-200 px-5 py-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
              {mode === "option" ? "New option" : "New variant"}
            </div>
            <h2 className="mt-0.5 text-[16px] font-semibold text-ink-900">
              {mode === "option" ? "Create Option" : "Create Variant"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-ink-500 hover:bg-surface-alt hover:text-ink-900"
            aria-label="Close drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Method picker — variants only; options always start from a parent */}
        <div
          className={cn(
            "grid shrink-0 grid-cols-2 gap-2 border-b border-line-200 px-5 py-4",
            mode === "option" && "hidden",
          )}
        >
          {methods.map((m) => {
            const Icon = m.icon;
            const active = method === m.key;
            return (
              <button
                key={m.key}
                onClick={() => setMethod(m.key)}
                className={cn(
                  "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-left transition",
                  active
                    ? "border-brand-600 bg-brand-50 text-ink-900 ring-1 ring-brand-600/20"
                    : "border-line-200 bg-white text-ink-800 hover:border-ink-300",
                )}
              >
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", active ? "text-brand-700" : "text-ink-600")} />
                <div>
                  <div className="text-[13px] font-semibold leading-tight">{m.label}</div>
                  <div className={cn("mt-0.5 text-[11px]", active ? "text-brand-700" : "text-ink-500")}>{m.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {mode === "option" ? (
            <div className="space-y-4">
              <Field label="Parent variant">
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="w-full rounded-md border border-line-200 bg-white px-3 py-2 text-[13px] text-ink-900 outline-none focus:border-ink-400"
                >
                  {variantParents.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Option name">
                <input
                  autoFocus
                  value={optName}
                  onChange={(e) => setOptName(e.target.value)}
                  placeholder="e.g. MOQ 5,000"
                  className="w-full rounded-md border border-line-200 bg-white px-3 py-2 text-[13px] text-ink-900 outline-none focus:border-ink-400"
                />
              </Field>
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500">Option type</div>
                <div className="flex flex-wrap gap-1.5">
                  {OPTION_TYPES.map((t) => {
                    const on = optType === t;
                    return (
                      <button
                        key={t}
                        onClick={() => setOptType(t)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-[12px] font-medium transition",
                          on
                            ? "border-brand-600 bg-brand-50 text-brand-700 ring-1 ring-brand-600/20"
                            : "border-line-200 bg-white text-ink-700 hover:border-ink-300",
                        )}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Only the fields relevant to the selected option type */}
              {optType === "MOQ" && (
                <Field label="MOQ (pieces)">
                  <input
                    type="number"
                    value={moq}
                    onChange={(e) => setMoq(Number(e.target.value) || 0)}
                    className="w-full rounded-md border border-line-200 bg-white px-3 py-2 text-[13px] text-ink-900 outline-none focus:border-ink-400"
                  />
                </Field>
              )}
              {optType === "Commercial" && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Target Margin (%)">
                    <input
                      type="number"
                      value={margin}
                      onChange={(e) => setMargin(Number(e.target.value) || 0)}
                      className="w-full rounded-md border border-line-200 bg-white px-3 py-2 text-[13px] text-ink-900 outline-none focus:border-ink-400"
                    />
                  </Field>
                  <Field label="FX Rate (₹ / $)">
                    <input
                      type="number"
                      value={fx}
                      onChange={(e) => setFx(Number(e.target.value) || 0)}
                      className="w-full rounded-md border border-line-200 bg-white px-3 py-2 text-[13px] text-ink-900 outline-none focus:border-ink-400"
                    />
                  </Field>
                  <Field label="Buyer target ($/pc)" optional>
                    <input
                      type="number"
                      value={buyerTarget}
                      onChange={(e) => setBuyerTarget(e.target.value)}
                      placeholder="Optional"
                      className="w-full rounded-md border border-line-200 bg-white px-3 py-2 text-[13px] text-ink-900 outline-none focus:border-ink-400"
                    />
                  </Field>
                </div>
              )}
              {optType === "Packaging" && (
                <Field label="Packaging type">
                  <select
                    value={optPackaging}
                    onChange={(e) => setOptPackaging(e.target.value)}
                    className="w-full rounded-md border border-line-200 bg-white px-3 py-2 text-[13px] text-ink-900 outline-none focus:border-ink-400"
                  >
                    {PACKAGING_OPTIONS.map((o) => (
                      <option key={o.label} value={o.label}>{o.label} · ₹{o.rate}/pc</option>
                    ))}
                  </select>
                </Field>
              )}
              {optType === "Testing" && (
                <Field label="Testing profile">
                  <select
                    value={optTesting}
                    onChange={(e) => setOptTesting(e.target.value)}
                    className="w-full rounded-md border border-line-200 bg-white px-3 py-2 text-[13px] text-ink-900 outline-none focus:border-ink-400"
                  >
                    {TESTING_PROFILES.map((o) => (
                      <option key={o.label} value={o.label}>{o.label} · ₹{o.rate}/pc</option>
                    ))}
                  </select>
                </Field>
              )}
              {optType === "Certification" && (
                <Field label="Certification type">
                  <select
                    value={optCert}
                    onChange={(e) => setOptCert(e.target.value)}
                    className="w-full rounded-md border border-line-200 bg-white px-3 py-2 text-[13px] text-ink-900 outline-none focus:border-ink-400"
                  >
                    {CERT_OPTIONS.map((o) => (
                      <option key={o.label} value={o.label}>{o.label} · ₹{o.rate}/pc</option>
                    ))}
                  </select>
                </Field>
              )}
              {optType === "Custom" && (
                <Field label="What differs?">
                  <textarea
                    rows={3}
                    value={optNote}
                    onChange={(e) => setOptNote(e.target.value)}
                    placeholder="e.g. Alternate embroidery placement"
                    className="w-full resize-none rounded-md border border-line-200 bg-white px-3 py-2 text-[13px] text-ink-900 outline-none focus:border-ink-400"
                  />
                </Field>
              )}

              <p className="text-[11px] text-ink-500">
                An option inherits everything from <span className="font-medium text-ink-700">{parent.name}</span> and
                stores only the values you change here.
              </p>
            </div>
          ) : null}

          {mode !== "option" && method === "blank" && (
            <div className="space-y-4">
              <Field label="Variant name">
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Zara SS26 · Value"
                  className="w-full rounded-md border border-line-200 bg-white px-3 py-2 text-[13px] text-ink-900 outline-none focus:border-ink-400"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Size (inches)">
                  <select
                    value={size}
                    onChange={(e) => setSize(Number(e.target.value))}
                    className="w-full rounded-md border border-line-200 bg-white px-3 py-2 text-[13px] text-ink-900 outline-none focus:border-ink-400"
                  >
                    {[16, 18, 20, 24].map((s) => (
                      <option key={s} value={s}>{s}" × {s}"</option>
                    ))}
                  </select>
                </Field>
                <Field label="MOQ (pieces)">
                  <input
                    type="number"
                    value={moq}
                    onChange={(e) => setMoq(Number(e.target.value) || 0)}
                    className="w-full rounded-md border border-line-200 bg-white px-3 py-2 text-[13px] text-ink-900 outline-none focus:border-ink-400"
                  />
                </Field>
                <Field label="Quality (GSM)">
                  <select
                    value={gsm}
                    onChange={(e) => setGsm(Number(e.target.value))}
                    className="w-full rounded-md border border-line-200 bg-white px-3 py-2 text-[13px] text-ink-900 outline-none focus:border-ink-400"
                  >
                    {[185, 200, 240, 350].map((g) => (
                      <option key={g} value={g}>{g} GSM</option>
                    ))}
                  </select>
                </Field>
                <Field label="FX Rate (₹ / $)">
                  <input
                    type="number"
                    value={fx}
                    onChange={(e) => setFx(Number(e.target.value) || 0)}
                    className="w-full rounded-md border border-line-200 bg-white px-3 py-2 text-[13px] text-ink-900 outline-none focus:border-ink-400"
                  />
                </Field>
                <Field label="Target Margin (%)">
                  <input
                    type="number"
                    value={margin}
                    onChange={(e) => setMargin(Number(e.target.value) || 0)}
                    className="w-full rounded-md border border-line-200 bg-white px-3 py-2 text-[13px] text-ink-900 outline-none focus:border-ink-400"
                  />
                </Field>
                <Field label="Buyer target ($/pc)" optional>
                  <input
                    type="number"
                    value={buyerTarget}
                    onChange={(e) => setBuyerTarget(e.target.value)}
                    placeholder="Optional"
                    className="w-full rounded-md border border-line-200 bg-white px-3 py-2 text-[13px] text-ink-900 outline-none focus:border-ink-400"
                  />
                </Field>
              </div>
              <p className="text-[11px] text-ink-500">
                Fabric, process, trims and packaging can be set inside the configurator after creation.
              </p>
            </div>
          )}

          {mode !== "option" && method === "duplicate" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-line-200 bg-surface-alt px-3 py-2.5">
                <div className="text-[11px] uppercase tracking-wider text-ink-500">Source variant</div>
                <div className="mt-0.5 text-[13px] font-semibold text-ink-900">{active.name}</div>
                <div className="text-[11px] text-ink-500">{active.tagline}</div>
              </div>
              <Field label="New variant name">
                <input
                  autoFocus
                  value={dupName}
                  onChange={(e) => setDupName(e.target.value)}
                  className="w-full rounded-md border border-line-200 bg-white px-3 py-2 text-[13px] text-ink-900 outline-none focus:border-ink-400"
                />
              </Field>
              <p className="text-[11px] text-ink-500">
                All configuration will be copied. You can tweak the new variant independently.
              </p>
            </div>
          )}

          {mode !== "option" && method === "template" && (
            <div className="space-y-4">
              <Field label="Variant name">
                <input
                  autoFocus
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                  placeholder="Leave blank to use template name"
                  className="w-full rounded-md border border-line-200 bg-white px-3 py-2 text-[13px] text-ink-900 outline-none focus:border-ink-400"
                />
              </Field>
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500">Template</div>
                <div className="grid grid-cols-2 gap-2">
                  {TEMPLATES.map((t) => {
                    const on = tplKey === t.key;
                    return (
                      <button
                        key={t.key}
                        onClick={() => setTplKey(t.key)}
                        className={cn(
                          "rounded-lg border px-3 py-2.5 text-left transition",
                          on
                            ? "border-brand-600 bg-brand-50 text-ink-900 ring-1 ring-brand-600/20"
                            : "border-line-200 bg-white text-ink-800 hover:border-ink-300",
                        )}
                      >
                        <div className="text-[13px] font-semibold">{t.name}</div>
                        <div className={cn("mt-0.5 text-[11px]", on ? "text-brand-700" : "text-ink-500")}>
                          {t.tagline}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {mode !== "option" && method === "ai" && (
            <div className="space-y-4">
              <Field label="Describe the variant">
                <textarea
                  autoFocus
                  rows={5}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder='e.g. "Create a premium version with lower MOQ and 25% margin."'
                  className="w-full resize-none rounded-md border border-line-200 bg-white px-3 py-2 text-[13px] text-ink-900 outline-none focus:border-ink-400"
                />
              </Field>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Reach 30% Margin",
                  "Reduce Selling Price",
                  "Match Buyer Target",
                  "Lowest Cost",
                  "Highest Profit",
                  "Premium version with 25% margin",
                  "Lower MOQ · faster delivery",
                  "Value engineered under $5",
                ].map((s) => (

                  <button
                    key={s}
                    onClick={() => setAiPrompt(s)}
                    className="rounded-full border border-line-200 bg-white px-2.5 py-1 text-[11px] text-ink-700 hover:border-ink-300"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line-200 bg-white px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-md px-3 py-2 text-[13px] font-medium text-ink-700 hover:bg-surface-alt"
          >
            Cancel
          </button>
          {mode === "option" && (
            <button
              onClick={submitOption}
              className="rounded-md bg-brand-700 px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-brand-800"
            >
              Create option
            </button>
          )}
          {mode !== "option" && method === "blank" && (
            <button
              onClick={submitBlank}
              className="rounded-md bg-brand-700 px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-brand-800"
            >
              Create variant
            </button>
          )}
          {mode !== "option" && method === "duplicate" && (
            <button
              onClick={submitDuplicate}
              className="rounded-md bg-brand-700 px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-brand-800"
            >
              Duplicate
            </button>
          )}
          {mode !== "option" && method === "template" && (
            <button
              onClick={submitTemplate}
              className="rounded-md bg-brand-700 px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-brand-800"
            >
              Create variant
            </button>
          )}
          {mode !== "option" && method === "ai" && (
            <button
              onClick={submitAi}
              disabled={aiLoading || !aiPrompt.trim()}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-brand-800 disabled:opacity-60"
            >
              {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {aiLoading ? "Generating…" : "Generate variant"}
            </button>
          )}
        </footer>
      </aside>
    </div>
  );
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
        {label}
        {optional && <span className="text-[10px] font-normal normal-case tracking-normal text-ink-400">optional</span>}
      </div>
      {children}
    </label>
  );
}
