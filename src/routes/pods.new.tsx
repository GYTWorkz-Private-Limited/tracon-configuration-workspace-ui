/**
 * New Costing — a four-step intake, not a form.
 *
 * The flat form captured a POD header and dumped the user on the detail page
 * to figure out the rest. But the decisions that shape every costing under an
 * order — which template prices it, which articles belong to it, which style
 * seeds each build — were being made late, screen by screen, where each one
 * is easy to skip. The stepper front-loads them in the agreed sequence
 * (POD → Template → Articles → Style) and only then opens Configuration.
 *
 * Nothing exists until the final step commits: the POD, its template mapping,
 * its articles and each article's style choice are all written in one act, so
 * abandoning the wizard halfway leaves no half-made POD on the dashboard.
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  Check,
  ChevronRight,
  Layers,
  LayoutTemplate,
  Package,
  PencilRuler,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ArticleLibraryDrawer } from "@/components/articles/ArticleLibraryDrawer";
import { AddKitDrawer } from "@/components/articles/AddKitDrawer";
import { cn } from "@/lib/utils";
import { addKit, addLibraryArticles, createPod, type KitItem } from "@/lib/podsStore";
import { TEMPLATES, setTemplateFor, type CostTemplate } from "@/lib/costTemplates";
import { MANUAL_STYLE_ID, STYLE_MASTER, setStyleFor } from "@/lib/styleMaster";
import type { LibraryArticle } from "@/lib/articleLibrary";

export const Route = createFileRoute("/pods/new")({
  head: () => ({
    meta: [
      { title: "New Costing POD · Tracon" },
      {
        name: "description",
        content: "Create a costing POD step by step — basics, template, articles, styles.",
      },
    ],
  }),
  component: NewPod,
});

const STEPS = ["POD Basics", "Buyer Template", "Articles & Kits", "Style Configuration"] as const;

const DEFAULT_TEMPLATE_ID = "TPL-STD-EXPORT";

type PendingKit = {
  name: string;
  buyer: string;
  collection: string;
  moq: string;
  currency: string;
  items: KitItem[];
};

/**
 * "existing" alone is not a finished answer — it needs a styleId; "manual" is
 * complete by itself. Kept separate from the styleMaster store because these
 * are wizard drafts: nothing is persisted until the final commit.
 */
type StyleChoice = { mode: "existing" | "manual"; styleId?: string };

function NewPod() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  /* ---- step 1 — same fields the flat form carried ---- */
  const [buyerRef, setBuyerRef] = useState("");
  const [buyer, setBuyer] = useState("");
  const [preparedBy, setPreparedBy] = useState("Gautam Kitclu");

  /* ---- step 2 — captured on the POD now so quotation never re-asks ---- */
  const [templateMode, setTemplateMode] = useState<"default" | "buyer" | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);

  /* ---- step 3 ---- */
  const [articles, setArticles] = useState<LibraryArticle[]>([]);
  const [kits, setKits] = useState<PendingKit[]>([]);
  const [libOpen, setLibOpen] = useState(false);
  const [kitOpen, setKitOpen] = useState(false);

  /* ---- step 4 — keyed by the library row id, stable while the wizard lives ---- */
  const [styles, setStyles] = useState<Record<string, StyleChoice>>({});

  const buyerMatch = useMemo(
    () =>
      TEMPLATES.find(
        (t) => t.kind === "buyer" && t.buyer?.toLowerCase() === buyer.trim().toLowerCase(),
      ),
    [buyer],
  );

  const stepOk = [
    buyer.trim().length > 0 && preparedBy.trim().length > 0,
    templateMode === "default" || (templateMode === "buyer" && Boolean(templateId)),
    articles.length + kits.length > 0,
    articles.every((a) => {
      const c = styles[a.id];
      return Boolean(c && (c.mode === "manual" || c.styleId));
    }),
  ];

  const addArticles = (arts: LibraryArticle[]) =>
    setArticles((prev) => [...prev, ...arts.filter((a) => !prev.some((p) => p.id === a.id))]);

  const removeArticle = (id: string) => {
    setArticles((prev) => prev.filter((a) => a.id !== id));
    // The style row for a removed article must not survive to block (or
    // silently satisfy) Step 4.
    setStyles((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const chooseStyleMode = (id: string, mode: StyleChoice["mode"]) =>
    setStyles((prev) => ({
      ...prev,
      [id]: mode === "manual" ? { mode } : { mode, styleId: prev[id]?.styleId },
    }));

  const pickStyle = (id: string, styleId: string) =>
    setStyles((prev) => ({ ...prev, [id]: { mode: "existing", styleId } }));

  /**
   * The one write of the whole wizard. Order matters: the POD must exist
   * before articles can join it, and the created article ids (minted by the
   * store, not the wizard) are what the style choices attach to —
   * `addLibraryArticles` preserves input order, which is what makes the
   * index-wise mapping below sound.
   */
  const finish = () => {
    if (!stepOk.every(Boolean)) return;
    const pod = createPod(
      {
        buyer: buyer.trim(),
        buyerRef: buyerRef.trim() || "—",
        preparedBy: preparedBy.trim(),
      },
      { seedDefaultArticles: false },
    );
    setTemplateFor(
      pod.id,
      templateMode === "buyer" && templateId ? templateId : DEFAULT_TEMPLATE_ID,
    );
    const created = addLibraryArticles(
      pod.id,
      articles.map((a) => ({
        name: a.name,
        description: `${a.articleNo} · ${a.buyerRef}`,
        size: a.size,
        moq: a.moq,
        style: a.style,
        image: a.image,
        libraryId: a.id,
        category: a.category,
        collection: a.collection,
        season: a.season,
        articleNo: a.articleNo,
        supplier: a.supplier,
        composition: a.composition,
        construction: a.construction,
        colour: a.colour,
        techPackRef: a.techPackRef,
        techPackVersion: a.version,
      })),
    );
    created.forEach((art, i) => {
      const choice = styles[articles[i].id];
      if (!choice) return;
      setStyleFor(
        pod.id,
        art.id,
        choice.mode === "manual" ? MANUAL_STYLE_ID : (choice.styleId ?? MANUAL_STYLE_ID),
      );
    });
    const createdKits = kits.map((k) => addKit(pod.id, k));
    // Land in Configuration for the first thing added — the styles chosen
    // above seed its part table on arrival. A kit-only POD lands in the kit
    // workspace the same route serves.
    const first = created[0] ?? createdKits[0];
    if (first) {
      navigate({
        to: "/config/$podId/$articleId",
        params: { podId: pod.id, articleId: first.id },
        search: { sel: undefined },
      });
    } else {
      navigate({ to: "/pods/$id", params: { id: pod.id } });
    }
  };

  const next = () => {
    if (!stepOk[step]) return;
    if (step === STEPS.length - 1) finish();
    else setStep(step + 1);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[860px]">
        <Link
          to="/pods"
          className="inline-flex items-center gap-1 text-[12px] text-ink-500 hover:text-ink-900"
        >
          <ArrowLeft className="h-3 w-3" /> Back to dashboard
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-700 text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight text-ink-900">
              New Costing POD
            </h1>
            <p className="text-[12px] text-ink-500">
              Four steps — basics, template, articles, styles — then straight into Configuration.
            </p>
          </div>
        </div>

        <WizardSteps current={step} onJump={setStep} />

        <div className="mt-3 rounded-lg border border-hairline bg-surface p-6">
          {step === 0 && (
            <StepBasics
              buyerRef={buyerRef}
              setBuyerRef={setBuyerRef}
              buyer={buyer}
              setBuyer={setBuyer}
              preparedBy={preparedBy}
              setPreparedBy={setPreparedBy}
            />
          )}
          {step === 1 && (
            <StepTemplate
              buyer={buyer}
              buyerMatch={buyerMatch}
              mode={templateMode}
              templateId={templateId}
              onDefault={() => setTemplateMode("default")}
              onBuyer={() => {
                setTemplateMode("buyer");
                // The buyer already told us which structure applies — offering
                // a blank list anyway would just be a chance to pick wrong.
                if (buyerMatch) setTemplateId((cur) => cur ?? buyerMatch.id);
              }}
              onPick={setTemplateId}
            />
          )}
          {step === 2 && (
            <StepArticles
              articles={articles}
              kits={kits}
              onAddProduct={() => setLibOpen(true)}
              onCreateKit={() => setKitOpen(true)}
              onRemoveArticle={removeArticle}
              onRemoveKit={(name) => setKits((prev) => prev.filter((k) => k.name !== name))}
            />
          )}
          {step === 3 && (
            <StepStyles
              articles={articles}
              kits={kits}
              choices={styles}
              onMode={chooseStyleMode}
              onPick={pickStyle}
            />
          )}

          <div className="mt-6 flex items-center justify-between gap-2 border-t border-hairline pt-4">
            {step === 0 ? (
              <Link
                to="/pods"
                className="rounded-md px-3 py-2 text-[13px] text-ink-500 hover:text-ink-900"
              >
                Cancel
              </Link>
            ) : (
              <button
                onClick={() => setStep(step - 1)}
                className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-3 py-2 text-[13px] text-ink-700 hover:bg-surface-alt"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            )}
            <button
              onClick={next}
              disabled={!stepOk[step]}
              className="inline-flex items-center gap-1.5 rounded-md bg-ink-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {step === STEPS.length - 1 ? "Create POD & start costing" : "Next"}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <ArticleLibraryDrawer
        open={libOpen}
        onClose={() => setLibOpen(false)}
        defaultBuyer={buyer.trim() || undefined}
        onSubmit={addArticles}
      />
      <AddKitDrawer
        open={kitOpen}
        onClose={() => setKitOpen(false)}
        defaultBuyer={buyer.trim() || undefined}
        onCreate={(kit) => setKits((prev) => [...prev, kit])}
      />
    </AppShell>
  );
}

/* ================================================================== */
/* Step indicator — same pill language as the WorkflowStepper band     */
/* ================================================================== */

function WizardSteps({ current, onJump }: { current: number; onJump: (i: number) => void }) {
  return (
    <div className="mt-5 flex items-center gap-1 overflow-x-auto rounded-lg border border-hairline bg-surface px-3 py-2.5">
      {STEPS.map((label, i) => {
        const isActive = i === current;
        const isDone = i < current;
        const inner = (
          <div
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] transition-colors",
              isActive
                ? "bg-ink-900 font-medium text-white"
                : isDone
                  ? "bg-brand-50 text-brand-700 hover:bg-brand-100 hover:text-brand-800"
                  : "text-ink-400",
            )}
          >
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold tabular-nums",
                isActive
                  ? "bg-white/20 text-white"
                  : isDone
                    ? "bg-brand-700 text-white"
                    : "bg-ink-100 text-ink-500",
              )}
            >
              {isDone ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : i + 1}
            </span>
            {label}
          </div>
        );
        return (
          <div key={label} className="flex items-center gap-1">
            {/* Only completed steps navigate — jumping forward would skip the
                gate the Next button enforces. */}
            {isDone ? (
              <button
                onClick={() => onJump(i)}
                title={`Back to ${label}`}
                className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30"
              >
                {inner}
              </button>
            ) : (
              inner
            )}
            {i < STEPS.length - 1 && (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-300" aria-hidden />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ================================================================== */
/* Step 1 — POD Basics                                                 */
/* ================================================================== */

function StepBasics({
  buyerRef,
  setBuyerRef,
  buyer,
  setBuyer,
  preparedBy,
  setPreparedBy,
}: {
  buyerRef: string;
  setBuyerRef: (v: string) => void;
  buyer: string;
  setBuyer: (v: string) => void;
  preparedBy: string;
  setPreparedBy: (v: string) => void;
}) {
  return (
    <div className="space-y-5">
      <Field label="POD Reference ID" hint="Auto-generated after creation">
        <input
          disabled
          value="Auto-generated"
          className="w-full rounded-md border border-hairline bg-surface-alt px-3 py-2 text-[13px] text-ink-400"
        />
      </Field>
      <Field label="Buyer Reference ID">
        <input
          value={buyerRef}
          onChange={(e) => setBuyerRef(e.target.value)}
          placeholder="e.g. ZH-AW26-CUSH-01"
          className="w-full rounded-md border border-hairline bg-surface px-3 py-2 text-[13px] text-ink-900 focus:border-brand-500 focus:outline-none"
        />
      </Field>
      <Field label="Buyer" required>
        <input
          value={buyer}
          onChange={(e) => setBuyer(e.target.value)}
          placeholder="e.g. Zara Home"
          className="w-full rounded-md border border-hairline bg-surface px-3 py-2 text-[13px] text-ink-900 focus:border-brand-500 focus:outline-none"
        />
      </Field>
      <Field label="Prepared By" required>
        <input
          value={preparedBy}
          onChange={(e) => setPreparedBy(e.target.value)}
          className="w-full rounded-md border border-hairline bg-surface px-3 py-2 text-[13px] text-ink-900 focus:border-brand-500 focus:outline-none"
        />
      </Field>
    </div>
  );
}

/* ================================================================== */
/* Step 2 — Buyer Template                                             */
/* ================================================================== */

function StepTemplate({
  buyer,
  buyerMatch,
  mode,
  templateId,
  onDefault,
  onBuyer,
  onPick,
}: {
  buyer: string;
  buyerMatch: CostTemplate | undefined;
  mode: "default" | "buyer" | null;
  templateId: string | null;
  onDefault: () => void;
  onBuyer: () => void;
  onPick: (id: string) => void;
}) {
  const std = TEMPLATES.find((t) => t.id === DEFAULT_TEMPLATE_ID);
  const buyerTemplates = TEMPLATES.filter((t) => t.kind === "buyer");
  return (
    <div>
      <h2 className="text-[14px] font-semibold text-ink-900">
        Which cost structure prices this order?
      </h2>
      <p className="mt-0.5 text-[12px] text-ink-500">
        The template pins overheads, freight, finance, testing and special packing for every costing
        under this POD — and the Quotation stage uses it without asking again.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <TemplateModeCard
          selected={mode === "default"}
          icon={<LayoutTemplate className="h-4 w-4" />}
          title="Use Default Template"
          desc={
            std
              ? `${std.name} — OH ${std.overheadPct}% · testing ${std.testingPct}% · house structure for buyers without agreed terms.`
              : "House default structure."
          }
          onClick={onDefault}
        />
        <TemplateModeCard
          selected={mode === "buyer"}
          icon={<Layers className="h-4 w-4" />}
          title="Select Buyer Template"
          desc={
            buyerMatch
              ? `${buyerMatch.name} has an agreed structure on file — pre-selected below.`
              : buyer.trim()
                ? `No structure on file for ${buyer.trim()} — pick from the buyer template list.`
                : "Pick the buyer's agreed structure from the template list."
          }
          onClick={onBuyer}
        />
      </div>

      {mode === "buyer" && (
        <ul className="mt-4 divide-y divide-hairline overflow-hidden rounded-lg border border-hairline">
          {buyerTemplates.map((t) => {
            const on = templateId === t.id;
            return (
              <li key={t.id}>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-3 px-3.5 py-3 transition-colors",
                    on ? "bg-brand-50/40" : "bg-surface hover:bg-surface-alt",
                  )}
                >
                  <input
                    type="radio"
                    name="buyer-template"
                    checked={on}
                    onChange={() => onPick(t.id)}
                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-brand-700)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-ink-900">
                      {t.name}
                      {buyerMatch?.id === t.id && (
                        <span className="rounded-full bg-brand-700 px-1.5 py-0.5 text-[10px] font-medium text-white">
                          Matches buyer
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-ink-500">{t.description}</span>
                    <span className="mt-1 block text-[11.5px] tabular-nums text-ink-600">
                      OH {t.overheadPct}% · freight {t.freightPct}% · finance {t.financePct}% ·
                      testing {t.testingPct}%
                      {t.specialPackInr > 0 && ` · pack ₹${t.specialPackInr}/pc`}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TemplateModeCard({
  selected,
  icon,
  title,
  desc,
  onClick,
}: {
  selected: boolean;
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex h-full flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors",
        selected
          ? "border-brand-600 bg-brand-50/40 ring-1 ring-brand-600"
          : "border-hairline bg-surface hover:bg-surface-alt",
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-md",
          selected ? "bg-brand-700 text-white" : "bg-ink-100 text-ink-700",
        )}
      >
        {icon}
      </span>
      <span className="text-[13px] font-semibold text-ink-900">{title}</span>
      <span className="text-[12px] leading-relaxed text-ink-500">{desc}</span>
    </button>
  );
}

/* ================================================================== */
/* Step 3 — Articles / Products / Kit                                  */
/* ================================================================== */

function StepArticles({
  articles,
  kits,
  onAddProduct,
  onCreateKit,
  onRemoveArticle,
  onRemoveKit,
}: {
  articles: LibraryArticle[];
  kits: PendingKit[];
  onAddProduct: () => void;
  onCreateKit: () => void;
  onRemoveArticle: (id: string) => void;
  onRemoveKit: (name: string) => void;
}) {
  const empty = articles.length + kits.length === 0;
  return (
    <div>
      <h2 className="text-[14px] font-semibold text-ink-900">What belongs to this POD?</h2>
      <p className="mt-0.5 text-[12px] text-ink-500">
        Add every article, product and kit on this order — at least one is needed before styles are
        configured.
      </p>

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={onAddProduct}
          className="inline-flex items-center gap-1.5 rounded-md bg-ink-900 px-3 py-2 text-[13px] font-medium text-white hover:bg-ink-700"
        >
          <Plus className="h-4 w-4" /> Add Product
        </button>
        <button
          onClick={onCreateKit}
          className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-3 py-2 text-[13px] font-medium text-ink-700 hover:bg-surface-alt"
        >
          <Boxes className="h-4 w-4" /> Create Kit
        </button>
      </div>

      {empty ? (
        <div className="mt-4 flex flex-col items-center rounded-lg border border-dashed border-hairline py-10 text-center">
          <Package className="h-5 w-5 text-ink-400" />
          <p className="mt-2 text-[13px] text-ink-500">
            Nothing added yet — pull articles from the library or build a kit.
          </p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-hairline overflow-hidden rounded-lg border border-hairline">
          {articles.map((a) => (
            <li key={a.id} className="flex items-center gap-3 bg-surface px-3.5 py-2.5">
              <img src={a.image} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-ink-900">{a.name}</div>
                <div className="text-[11.5px] text-ink-500">
                  {a.articleNo} · {a.size} · MOQ {a.moq}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemoveArticle(a.id)}
                aria-label={`Remove ${a.name}`}
                className="rounded p-1.5 text-ink-400 hover:bg-surface-alt hover:text-danger-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
          {kits.map((k) => (
            <li key={k.name} className="flex items-center gap-3 bg-surface px-3.5 py-2.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-ink-100 text-ink-600">
                <Boxes className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-ink-900">{k.name}</div>
                <div className="text-[11.5px] text-ink-500">
                  Kit · {k.items.length} article{k.items.length === 1 ? "" : "s"} · MOQ {k.moq}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemoveKit(k.name)}
                aria-label={`Remove ${k.name}`}
                className="rounded p-1.5 text-ink-400 hover:bg-surface-alt hover:text-danger-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ================================================================== */
/* Step 4 — Style Configuration                                        */
/* ================================================================== */

function StepStyles({
  articles,
  kits,
  choices,
  onMode,
  onPick,
}: {
  articles: LibraryArticle[];
  kits: PendingKit[];
  choices: Record<string, StyleChoice>;
  onMode: (id: string, mode: StyleChoice["mode"]) => void;
  onPick: (id: string, styleId: string) => void;
}) {
  return (
    <div>
      <h2 className="text-[14px] font-semibold text-ink-900">How does each build start?</h2>
      <p className="mt-0.5 text-[12px] text-ink-500">
        Pull parts and cut sizes from the Style Master, or define them manually — this seeds each
        article&rsquo;s Configuration table.
      </p>

      {articles.length === 0 && (
        <p className="mt-4 rounded-lg border border-dashed border-hairline px-4 py-6 text-center text-[13px] text-ink-500">
          No standalone articles to style — kit members choose their styles inside the kit
          workspace.
        </p>
      )}

      <ul className="mt-4 space-y-3">
        {articles.map((a) => {
          const c = choices[a.id];
          const chosenStyle = c?.styleId ? STYLE_MASTER.find((s) => s.id === c.styleId) : undefined;
          return (
            <li key={a.id} className="rounded-lg border border-hairline bg-surface p-3.5">
              <div className="flex items-center gap-3">
                <img src={a.image} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-ink-900">{a.name}</div>
                  <div className="text-[11.5px] text-ink-500">
                    {a.articleNo} · {a.size}
                  </div>
                </div>
                <div className="inline-flex shrink-0 rounded-lg border border-hairline bg-surface p-0.5">
                  <button
                    type="button"
                    onClick={() => onMode(a.id, "existing")}
                    aria-pressed={c?.mode === "existing"}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors",
                      c?.mode === "existing"
                        ? "bg-ink-900 text-white"
                        : "text-ink-600 hover:text-ink-900",
                    )}
                  >
                    <Layers className="h-3.5 w-3.5" /> Use Existing Style
                  </button>
                  <button
                    type="button"
                    onClick={() => onMode(a.id, "manual")}
                    aria-pressed={c?.mode === "manual"}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors",
                      c?.mode === "manual"
                        ? "bg-ink-900 text-white"
                        : "text-ink-600 hover:text-ink-900",
                    )}
                  >
                    <PencilRuler className="h-3.5 w-3.5" /> Create New Style
                  </button>
                </div>
              </div>

              {c?.mode === "existing" && (
                <div className="mt-3 border-t border-hairline pt-3">
                  <select
                    value={c.styleId ?? ""}
                    onChange={(e) => e.target.value && onPick(a.id, e.target.value)}
                    aria-label={`Style for ${a.name}`}
                    className={cn(
                      "w-full rounded-md border px-2.5 py-2 text-[13px] focus:outline-none",
                      c.styleId
                        ? "border-hairline bg-surface text-ink-900"
                        : "border-amber-300 bg-amber-50/40 text-amber-800",
                    )}
                  >
                    <option value="">Select a style from the Style Master…</option>
                    {STYLE_MASTER.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — {s.category} · {s.parts.length} parts
                      </option>
                    ))}
                  </select>
                  {chosenStyle && (
                    <p className="mt-2 flex flex-wrap gap-1">
                      {chosenStyle.parts.map((part) => (
                        <span
                          key={part.name}
                          className="rounded-full border border-hairline bg-surface-alt/60 px-2 py-0.5 text-[10.5px] text-ink-600"
                        >
                          {part.name} · {part.consumption}m
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              )}
              {c?.mode === "manual" && (
                <p className="mt-3 border-t border-hairline pt-3 text-[12px] text-ink-500">
                  Parts will be defined one at a time in the Configuration table — &ldquo;Add
                  another body part&rdquo; keeps offering the next one.
                </p>
              )}
            </li>
          );
        })}
        {kits.map((k) => (
          <li
            key={k.name}
            className="flex items-center gap-3 rounded-lg border border-hairline bg-surface-alt/40 px-3.5 py-2.5"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-ink-100 text-ink-600">
              <Boxes className="h-4 w-4" />
            </span>
            <p className="text-[12px] text-ink-500">
              <span className="font-medium text-ink-900">{k.name}</span> — a set&rsquo;s members
              choose styles inside the kit workspace, article by article.
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ================================================================== */

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-[12px] font-medium text-ink-900">
          {label}
          {required && <span className="ml-1 text-danger-600">*</span>}
        </span>
        {hint && <span className="text-[11px] text-ink-400">{hint}</span>}
      </div>
      {children}
    </label>
  );
}
