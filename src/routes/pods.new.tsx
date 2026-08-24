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
  ChevronDown,
  ChevronRight,
  Package,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ArticleLibraryDrawer } from "@/components/articles/ArticleLibraryDrawer";
import { AddKitDrawer } from "@/components/articles/AddKitDrawer";
import { cn } from "@/lib/utils";
import { addKit, addLibraryArticles, createPod, type KitItem } from "@/lib/podsStore";
import { TEMPLATES, setTemplateFor } from "@/lib/costTemplates";
import { saveCustomStyle, setStyleFor, useAllStyles, type StyleDef } from "@/lib/styleMaster";
import { TemplateStep } from "@/components/precosting/TemplateStep";
import { StyleStep, type StylePath } from "@/components/precosting/StyleStep";
import { StyleCustomizeDrawer } from "@/components/precosting/StyleCustomizeDrawer";
import {
  ONE_TIME_PREFIX,
  draftFromStyle,
  draftIsValid,
  emptyDraft,
  toStyleDef,
  validateDraft,
  type StyleDraft,
} from "@/components/precosting/styleDraft";
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
 * One article's answer to "how does this build start?", held in exactly the
 * shape `StyleStep` drives — the wizard owns the state so Back never loses a
 * half-typed style, and nothing reaches the style master until the commit.
 *
 * `saveToMaster` defaults OFF: a style typed for one order is one-time until
 * the user says otherwise, so the shared master does not silently accumulate
 * every wizard run.
 */
type ArticleStyleState = {
  path: StylePath;
  selectedId: string | null;
  /** the master a customisation departed from — null means from scratch */
  baseStyleId: string | null;
  draft: StyleDraft;
  saveToMaster: boolean;
};

/**
 * A kit member's style lives in the same map as a standalone article's, under
 * a key that survives re-renders. A set is not one style — each member is its
 * own product with its own parts — so the wizard asks per member here rather
 * than deferring the whole set to the workspace.
 */
export const memberKey = (kitName: string, memberId: string) => `${kitName}::${memberId}`;

const emptyArticleStyle = (articleName: string): ArticleStyleState => ({
  path: "select",
  selectedId: null,
  baseStyleId: null,
  draft: emptyDraft({ product: articleName }),
  saveToMaster: false,
});

const articleStyleValid = (s: ArticleStyleState) =>
  s.path === "select" ? Boolean(s.selectedId) : draftIsValid(validateDraft(s.draft));

function NewPod() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  /* ---- step 1 — same fields the flat form carried ---- */
  const [buyerRef, setBuyerRef] = useState("");
  const [buyer, setBuyer] = useState("");
  const [preparedBy, setPreparedBy] = useState("Gautam Kitclu");

  /* ---- step 2 — captured on the POD now so quotation never re-asks ---- */
  const [templateId, setTemplateId] = useState<string | null>(null);

  /* ---- step 3 ---- */
  const [articles, setArticles] = useState<LibraryArticle[]>([]);
  const [kits, setKits] = useState<PendingKit[]>([]);
  const [libOpen, setLibOpen] = useState(false);
  const [kitOpen, setKitOpen] = useState(false);

  /* ---- step 4 — keyed by the library row id, stable while the wizard lives ---- */
  const [styles, setStyles] = useState<Record<string, ArticleStyleState>>({});
  const [openArticle, setOpenArticle] = useState<string | null>(null);
  const [showStyleErrors, setShowStyleErrors] = useState(false);
  /**
   * Which article's style is being customised. The builder is a drawer over
   * this page rather than an expanding form: a kit with four articles must
   * stay readable while one of them is being built.
   */
  const [customising, setCustomising] = useState<{ id: string; name: string } | null>(null);
  const [drawerErrors, setDrawerErrors] = useState(false);

  // `useAllStyles` already withholds one-time builds, so the picker offers the
  // shared master only — the same list the pre-costing dialog offers.
  const styleMaster = useAllStyles();

  const buyerMatch = useMemo(
    () =>
      TEMPLATES.find(
        (t) => t.kind === "buyer" && t.buyer?.toLowerCase() === buyer.trim().toLowerCase(),
      ),
    [buyer],
  );

  const stepOk = [
    buyer.trim().length > 0 && preparedBy.trim().length > 0,
    Boolean(templateId),
    articles.length + kits.length > 0,
    articles.every((a) => {
      const s = styles[a.id];
      return Boolean(s && articleStyleValid(s));
    }) &&
      kits.every((k) =>
        k.items.every((it) => {
          const s = styles[memberKey(k.name, it.id)];
          return Boolean(s && articleStyleValid(s));
        }),
      ),
  ];

  const styleFor = (a: LibraryArticle) => styles[a.id] ?? emptyArticleStyle(a.name);

  /** Open the builder for one article, switching that article to the custom path. */
  const openCustomize = (articleId: string, articleName: string) => {
    setStyleState(articleId, { path: "customize" }, articleName);
    setDrawerErrors(false);
    setCustomising({ id: articleId, name: articleName });
  };

  const setStyleState = (id: string, patch: Partial<ArticleStyleState>, name: string) =>
    setStyles((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? emptyArticleStyle(name)), ...patch },
    }));

  const addArticles = (arts: LibraryArticle[]) =>
    setArticles((prev) => [...prev, ...arts.filter((a) => !prev.some((p) => p.id === a.id))]);

  // Edits made in the step-3 table live on the wizard's copy of the article —
  // the commit in `finish` reads these same objects, so a corrected MOQ or
  // size is what the POD is created with.
  const updateArticle = (id: string, patch: Partial<LibraryArticle>) =>
    setArticles((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  // The kit's name keys its members' style state (`memberKey`), so only the
  // MOQ is editable here — renaming would orphan any styles already chosen.
  const updateKitMoq = (name: string, moq: string) =>
    setKits((prev) => prev.map((k) => (k.name === name ? { ...k, moq } : k)));

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
    setTemplateFor(pod.id, templateId ?? DEFAULT_TEMPLATE_ID);
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
      if (choice.path === "select") {
        if (choice.selectedId) setStyleFor(pod.id, art.id, choice.selectedId);
        return;
      }
      // A build the user did not promote still has to exist — it is the only
      // thing that can seed the sheet's parts — so it is saved one-time and
      // stays out of the next order's picker.
      const saved = saveCustomStyle(
        toStyleDef(choice.draft),
        choice.saveToMaster ? "You" : `${ONE_TIME_PREFIX} · ${pod.id}`,
        !choice.saveToMaster,
      );
      setStyleFor(pod.id, art.id, saved.id);
    });
    const createdKits = kits.map((k) => {
      const kit = addKit(pod.id, k);
      // A kit's members carry the ids they were built with, so the style
      // recorded against each member here is the one its sheet opens with.
      for (const it of k.items) {
        const choice = styles[memberKey(k.name, it.id)];
        if (!choice) continue;
        if (choice.path === "select") {
          if (choice.selectedId) setStyleFor(pod.id, it.id, choice.selectedId);
          continue;
        }
        const saved = saveCustomStyle(
          toStyleDef(choice.draft),
          choice.saveToMaster ? "You" : `${ONE_TIME_PREFIX} · ${pod.id}`,
          !choice.saveToMaster,
        );
        setStyleFor(pod.id, it.id, saved.id);
      }
      return kit;
    });
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
    if (step === 3 && !stepOk[3]) {
      // A form that turns red while it is still being filled in reads as
      // broken — the click to continue is what asks for the verdict.
      setShowStyleErrors(true);
      const firstBad = articles.find((a) => !articleStyleValid(styleFor(a)));
      if (firstBad) setOpenArticle(firstBad.id);
      return;
    }
    if (!stepOk[step]) return;
    if (step === STEPS.length - 1) finish();
    else {
      // TemplateStep is a controlled list with no default of its own; entering
      // the step with nothing selected would leave Next dead for a decision
      // the buyer has already made.
      if (step === 0 && !templateId) setTemplateId(buyerMatch?.id ?? DEFAULT_TEMPLATE_ID);
      if (step === 2) setOpenArticle((cur) => cur ?? articles[0]?.id ?? null);
      setStep(step + 1);
    }
  };

  return (
    <AppShell>
      {/* Full width, not a column down the middle. This is an enterprise
          costing intake: a template list wants to sit beside its provisions,
          and a kit wants its articles laid out — both of which a 860px column
          turns into scrolling. The cap is generous rather than absent so text
          lines never run to an unreadable length on a very wide monitor. */}
      <div className="mx-auto w-full max-w-[1600px]">
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

        <div className="mt-3 rounded-lg border border-hairline bg-surface p-5 lg:p-6">
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
            <div>
              <h2 className="text-[14px] font-semibold text-ink-900">
                Which cost structure prices this order?
              </h2>
              <p className="mb-3 mt-0.5 text-[12px] text-ink-500">
                The template pins overheads, freight, finance, testing and special packing for every
                costing under this POD — and the Quotation stage uses it without asking again.
              </p>
              <TemplateStep
                buyer={buyer.trim() || undefined}
                selectedId={templateId}
                onSelect={setTemplateId}
              />
            </div>
          )}
          {step === 2 && (
            <StepArticles
              articles={articles}
              kits={kits}
              onAddProduct={() => setLibOpen(true)}
              onCreateKit={() => setKitOpen(true)}
              onRemoveArticle={removeArticle}
              onRemoveKit={(name) => setKits((prev) => prev.filter((k) => k.name !== name))}
              onUpdateArticle={updateArticle}
              onUpdateKitMoq={updateKitMoq}
            />
          )}
          {step === 3 && (
            <StepStyles
              articles={articles}
              kits={kits}
              styleMaster={styleMaster}
              stateFor={styleFor}
              styles={styles}
              onPatch={setStyleState}
              openId={openArticle}
              onToggle={(id) => setOpenArticle((cur) => (cur === id ? null : id))}
              onCustomize={openCustomize}
              showErrors={showStyleErrors}
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
              /* On the style step Continue stays live even when incomplete:
                 the click is what reveals which article is unfinished. */
              disabled={step !== 3 && !stepOk[step]}
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
      {/* One drawer, driven by whichever article is being customised — the
          page behind it keeps every other article in view. */}
      {customising && (
        <StyleCustomizeDrawer
          open
          onClose={() => setCustomising(null)}
          articleName={customising.name}
          styles={styleMaster}
          baseStyleId={styles[customising.id]?.baseStyleId ?? null}
          onStartFrom={(id) => {
            const base = id ? styleMaster.find((m) => m.id === id) : undefined;
            setStyleState(
              customising.id,
              {
                baseStyleId: base?.id ?? null,
                // Choosing what to start from REPLACES the draft — that is the
                // whole point of the affordance.
                draft: base ? draftFromStyle(base) : emptyDraft({ product: customising.name }),
              },
              customising.name,
            );
          }}
          draft={styles[customising.id]?.draft ?? emptyDraft({ product: customising.name })}
          onDraftChange={(draft) => setStyleState(customising.id, { draft }, customising.name)}
          errors={validateDraft(styles[customising.id]?.draft ?? emptyDraft())}
          showErrors={drawerErrors}
          onSave={() => {
            const draft = styles[customising.id]?.draft ?? emptyDraft();
            if (!draftIsValid(validateDraft(draft))) {
              setDrawerErrors(true);
              return false;
            }
            setCustomising(null);
            return true;
          }}
          saveToMaster={styles[customising.id]?.saveToMaster ?? false}
          onSaveToMasterChange={(saveToMaster) =>
            setStyleState(customising.id, { saveToMaster }, customising.name)
          }
        />
      )}

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
/* Step 3 — Articles / Products / Kit                                  */
/* ================================================================== */

function StepArticles({
  articles,
  kits,
  onAddProduct,
  onCreateKit,
  onRemoveArticle,
  onRemoveKit,
  onUpdateArticle,
  onUpdateKitMoq,
}: {
  articles: LibraryArticle[];
  kits: PendingKit[];
  onAddProduct: () => void;
  onCreateKit: () => void;
  onRemoveArticle: (id: string) => void;
  onRemoveKit: (name: string) => void;
  onUpdateArticle: (id: string, patch: Partial<LibraryArticle>) => void;
  onUpdateKitMoq: (name: string, moq: string) => void;
}) {
  const empty = articles.length + kits.length === 0;
  // Which row is inline-editing, and which kits are open. `kit:` prefixes keep
  // a kit named like an article id from colliding in the same string space.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpand = (name: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

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
        /* The same table the POD detail page uses for its articles, so the
           order reads identically before and after it is created — and each
           row can be corrected in place before anything is committed. */
        <div className="mt-4 overflow-hidden rounded-lg border border-hairline">
          <table className="w-full text-[13px]">
            <thead className="border-b border-hairline bg-surface-alt/40 text-[11px] uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Product</th>
                <th className="px-4 py-2.5 text-left font-medium">Type</th>
                <th className="px-4 py-2.5 text-left font-medium">Size</th>
                <th className="px-4 py-2.5 text-left font-medium">MOQ</th>
                <th className="w-24 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {articles.map((a) =>
                editingId === a.id ? (
                  <WizardArticleEditRow
                    key={a.id}
                    article={a}
                    onSave={(patch) => {
                      onUpdateArticle(a.id, patch);
                      setEditingId(null);
                    }}
                    onClose={() => setEditingId(null)}
                  />
                ) : (
                  <tr key={a.id} className="border-b border-hairline hover:bg-surface-alt/40">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="w-[22px]" />
                        <img src={a.image} alt="" className="h-8 w-8 rounded object-cover" />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-ink-900">{a.name}</div>
                          <div className="truncate text-[11px] text-ink-400">{a.articleNo}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                        <Package className="h-3 w-3" /> Article
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-ink-700">{a.size}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-ink-700">{a.moq}</td>
                    <td className="px-4 py-2.5">
                      <RowActions
                        name={a.name}
                        onEdit={() => setEditingId(a.id)}
                        onDelete={() => onRemoveArticle(a.id)}
                      />
                    </td>
                  </tr>
                ),
              )}

              {/* A kit is one row of the order; its members live behind the
                  chevron so ten sets stay ten rows until one is opened. */}
              {kits.map((k) => {
                const rowKey = `kit:${k.name}`;
                const isOpen = expanded.has(k.name);
                return editingId === rowKey ? (
                  <WizardKitEditRow
                    key={rowKey}
                    kit={k}
                    onSave={(moq) => {
                      onUpdateKitMoq(k.name, moq);
                      setEditingId(null);
                    }}
                    onClose={() => setEditingId(null)}
                  />
                ) : (
                  <KitRows
                    key={rowKey}
                    kit={k}
                    isOpen={isOpen}
                    onExpand={() => toggleExpand(k.name)}
                    onEdit={() => setEditingId(rowKey)}
                    onDelete={() => onRemoveKit(k.name)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** A kit's table row plus, when open, one nested row per member article. */
function KitRows({
  kit,
  isOpen,
  onExpand,
  onEdit,
  onDelete,
}: {
  kit: PendingKit;
  isOpen: boolean;
  onExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <tr
        className={cn(
          "border-b border-hairline hover:bg-surface-alt/40",
          isOpen && "bg-surface-alt/30",
        )}
      >
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-3">
            <button
              onClick={onExpand}
              className="rounded p-1 text-ink-500 hover:bg-surface-alt hover:text-ink-900"
              aria-expanded={isOpen}
              aria-label={isOpen ? `Collapse ${kit.name}` : `Expand ${kit.name}`}
            >
              <ChevronRight
                className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-90")}
              />
            </button>
            <span className="flex h-8 w-8 items-center justify-center rounded bg-[var(--color-cfg-soft)] text-[var(--color-cfg-strong)]">
              <Boxes className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="truncate font-medium text-ink-900">{kit.name}</div>
              <div className="text-[11px] text-ink-400">
                {kit.items.length} article{kit.items.length === 1 ? "" : "s"}
              </div>
            </div>
          </div>
        </td>
        <td className="px-4 py-2.5">
          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
            <Boxes className="h-3 w-3" /> Kit
          </span>
        </td>
        <td className="whitespace-nowrap px-4 py-2.5 text-ink-400">—</td>
        <td className="whitespace-nowrap px-4 py-2.5 text-ink-700">{kit.moq}</td>
        <td className="px-4 py-2.5">
          <RowActions name={kit.name} onEdit={onEdit} onDelete={onDelete} />
        </td>
      </tr>

      {isOpen &&
        kit.items.map((it, i, arr) => (
          <tr
            key={it.id}
            className={cn("bg-surface-alt/25", i === arr.length - 1 && "border-b border-hairline")}
          >
            <td className="py-2 pl-4 pr-4">
              <div className="flex items-stretch gap-3 pl-[10px]">
                <span className="relative block w-4 shrink-0" aria-hidden>
                  <span
                    className={cn(
                      "absolute left-0 top-0 w-px bg-ink-200",
                      i === arr.length - 1 ? "h-1/2" : "h-full",
                    )}
                  />
                  <span className="absolute left-0 top-1/2 block h-px w-4 bg-ink-200" />
                </span>
                {it.image ? (
                  <img src={it.image} alt="" className="h-7 w-7 self-center rounded object-cover" />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center self-center rounded bg-ink-100 text-ink-400">
                    <Package className="h-3.5 w-3.5" />
                  </div>
                )}
                <div className="min-w-0 self-center">
                  <div className="truncate text-[12.5px] font-medium text-ink-800">{it.name}</div>
                  <div className="text-[11px] text-ink-400">
                    ×{it.qty} per set{it.optional ? " · Optional" : ""}
                  </div>
                </div>
              </div>
            </td>
            <td className="whitespace-nowrap px-4 py-2 text-[11px] text-ink-400">Kit item</td>
            <td className="whitespace-nowrap px-4 py-2 text-[12px] text-ink-600">
              {it.size ?? "—"}
            </td>
            <td className="whitespace-nowrap px-4 py-2 text-[12px] text-ink-600">
              {it.moq ?? "—"}
            </td>
            <td className="px-4 py-2" />
          </tr>
        ))}
    </>
  );
}

function RowActions({
  name,
  onEdit,
  onDelete,
}: {
  name: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${name}`}
        className="rounded p-1.5 text-ink-500 hover:bg-surface-alt hover:text-ink-900"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Remove ${name}`}
        className="rounded p-1.5 text-ink-400 hover:bg-danger-50 hover:text-danger-600"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** The POD page's inline edit row, carried over: name, size and MOQ in place. */
function WizardArticleEditRow({
  article,
  onSave,
  onClose,
}: {
  article: LibraryArticle;
  onSave: (patch: Partial<LibraryArticle>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ name: article.name, size: article.size, moq: article.moq });
  const save = () =>
    onSave({
      name: form.name.trim() || article.name,
      size: form.size.trim(),
      moq: form.moq.trim(),
    });
  return (
    <tr className="border-b border-hairline bg-amber-50/30">
      <td className="px-4 py-2">
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          aria-label="Product name"
          className="w-full rounded-md border border-hairline bg-surface px-2 py-1.5 text-[13px]"
        />
      </td>
      <td className="px-4 py-2 text-[11px] text-ink-400">Article</td>
      <td className="px-4 py-2">
        <input
          value={form.size}
          onChange={(e) => setForm({ ...form, size: e.target.value })}
          aria-label="Size"
          className="w-full rounded-md border border-hairline bg-surface px-2 py-1.5 text-[13px]"
        />
      </td>
      <td className="px-4 py-2">
        <input
          value={form.moq}
          onChange={(e) => setForm({ ...form, moq: e.target.value })}
          aria-label="MOQ"
          className="w-full rounded-md border border-hairline bg-surface px-2 py-1.5 text-[13px]"
        />
      </td>
      <td className="px-4 py-2">
        <EditRowActions onSave={save} onCancel={onClose} />
      </td>
    </tr>
  );
}

function WizardKitEditRow({
  kit,
  onSave,
  onClose,
}: {
  kit: PendingKit;
  onSave: (moq: string) => void;
  onClose: () => void;
}) {
  const [moq, setMoq] = useState(kit.moq);
  return (
    <tr className="border-b border-hairline bg-amber-50/30">
      <td className="px-4 py-2">
        {/* The name keys each member's style state, so it is not editable here. */}
        <span className="pl-[22px] font-medium text-ink-900">{kit.name}</span>
      </td>
      <td className="px-4 py-2 text-[11px] text-ink-400">Kit</td>
      <td className="px-4 py-2 text-ink-400">—</td>
      <td className="px-4 py-2">
        <input
          value={moq}
          onChange={(e) => setMoq(e.target.value)}
          aria-label="Kit MOQ"
          className="w-full rounded-md border border-hairline bg-surface px-2 py-1.5 text-[13px]"
        />
      </td>
      <td className="px-4 py-2">
        <EditRowActions onSave={() => onSave(moq.trim())} onCancel={onClose} />
      </td>
    </tr>
  );
}

function EditRowActions({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        onClick={onSave}
        className="rounded p-1.5 text-emerald-700 hover:bg-emerald-50"
        aria-label="Save"
      >
        <Check className="h-4 w-4" />
      </button>
      <button
        onClick={onCancel}
        className="rounded p-1.5 text-ink-500 hover:bg-surface-alt"
        aria-label="Cancel"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ================================================================== */
/* Step 4 — Style Configuration                                        */
/* ================================================================== */

function StepStyles({
  articles,
  kits,
  styleMaster,
  stateFor,
  styles,
  onPatch,
  openId,
  onToggle,
  onCustomize,
  showErrors,
}: {
  articles: LibraryArticle[];
  kits: PendingKit[];
  styleMaster: StyleDef[];
  stateFor: (a: LibraryArticle) => ArticleStyleState;
  /** every style answer, so a kit can count how many of its members are done */
  styles: Record<string, ArticleStyleState>;
  onPatch: (id: string, patch: Partial<ArticleStyleState>, name: string) => void;
  openId: string | null;
  onToggle: (id: string) => void;
  /** open the customise drawer for one article */
  onCustomize: (articleId: string, articleName: string) => void;
  showErrors: boolean;
}) {
  return (
    <div>
      <h2 className="text-[14px] font-semibold text-ink-900">How does each build start?</h2>
      <p className="mt-0.5 text-[12px] text-ink-500">
        Pull parts and cut sizes from the Style Master, or customise them — this seeds each
        article&rsquo;s Configuration table.
      </p>

      {articles.length === 0 && (
        <p className="mt-4 rounded-lg border border-dashed border-hairline px-4 py-6 text-center text-[13px] text-ink-500">
          No standalone articles — every article in this POD belongs to a kit, and each one takes
          its style below.
        </p>
      )}

      {/* One article open at a time: each style is a full screen of decisions,
          and four of them side by side is a form nobody finishes. */}
      <ul className="mt-4 space-y-2">
        {articles.map((a) => (
          <StyleRow
            key={a.id}
            rowKey={a.id}
            name={a.name}
            meta={[a.articleNo, a.size].filter(Boolean).join(" · ")}
            image={a.image}
            state={stateFor(a)}
            styleMaster={styleMaster}
            open={openId === a.id}
            onToggle={() => onToggle(a.id)}
            onPatch={onPatch}
            onCustomize={onCustomize}
            showErrors={showErrors}
          />
        ))}

        {/* A kit is not one style. It is a container of articles, each of
            which is its own product with its own parts — so the set gets a
            grouped block and every member inside it answers for itself. The
            header counts them so the whole kit can be scanned at a glance. */}
        {kits.map((k) => {
          const done = k.items.filter((it) => {
            const st = styles[memberKey(k.name, it.id)];
            return st && articleStyleValid(st);
          }).length;
          const allDone = done === k.items.length;
          return (
            <li
              key={k.name}
              className="overflow-hidden rounded-lg border border-[var(--color-cfg)] bg-surface"
            >
              <div className="flex items-center gap-3 border-b border-hairline bg-[var(--color-cfg-soft)]/40 px-3.5 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-[var(--color-cfg-soft)] text-[var(--color-cfg-strong)]">
                  <Boxes className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] font-semibold text-ink-900">
                      {k.name}
                    </span>
                    <span className="rounded-full bg-[var(--color-cfg-strong)] px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-white">
                      Kit
                    </span>
                  </div>
                  <div className="text-[11.5px] text-ink-500">
                    {k.items.length} article{k.items.length === 1 ? "" : "s"} · each takes its own
                    style
                  </div>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums",
                    allDone ? "bg-brand-50 text-brand-700" : "bg-ink-100 text-ink-500",
                  )}
                >
                  {done} of {k.items.length} configured
                </span>
              </div>

              <ul className="divide-y divide-hairline">
                {k.items.map((it) => {
                  const key = memberKey(k.name, it.id);
                  return (
                    <StyleRow
                      key={key}
                      rowKey={key}
                      name={it.name}
                      meta={[it.size, it.moq && `MOQ ${it.moq}`].filter(Boolean).join(" · ")}
                      image={it.image}
                      state={styles[key] ?? emptyArticleStyle(it.name)}
                      styleMaster={styleMaster}
                      open={openId === key}
                      onToggle={() => onToggle(key)}
                      onPatch={onPatch}
                      onCustomize={onCustomize}
                      showErrors={showErrors}
                      nested
                    />
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * One article's style answer — the same row whether the article stands alone
 * or sits inside a kit. A set's member is not a lesser thing than a
 * standalone article: it has its own parts and its own consumption, so it
 * gets the same control rather than a summarised stand-in.
 */
function StyleRow({
  rowKey,
  name,
  meta,
  image,
  state,
  styleMaster,
  open,
  onToggle,
  onPatch,
  onCustomize,
  showErrors,
  nested,
}: {
  rowKey: string;
  name: string;
  meta?: string;
  image?: string;
  state: ArticleStyleState;
  styleMaster: StyleDef[];
  open: boolean;
  onToggle: () => void;
  onPatch: (id: string, patch: Partial<ArticleStyleState>, name: string) => void;
  onCustomize: (articleId: string, articleName: string) => void;
  showErrors: boolean;
  /** inside a kit — the container already draws the border */
  nested?: boolean;
}) {
  const ok = articleStyleValid(state);
  const chosen = styleMaster.find((m) => m.id === state.selectedId);
  const status =
    state.path === "select"
      ? (chosen?.name ?? "Not set")
      : ok
        ? `Custom style${state.draft.name.trim() ? ` — ${state.draft.name.trim()}` : ""}`
        : "Not set";

  const Wrapper = nested ? "li" : "li";
  return (
    <Wrapper
      className={cn(
        "overflow-hidden bg-surface",
        nested ? "" : "rounded-lg border border-hairline",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-700"
      >
        {image ? (
          <img src={image} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-ink-100 text-ink-500">
            <Package className="h-4 w-4" aria-hidden />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-ink-900">{name}</span>
          {meta && <span className="block truncate text-[11.5px] text-ink-500">{meta}</span>}
        </span>
        {/* Configured or not, said the same way on every row, so a kit can be
            read down its column without decoding three different treatments. */}
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
            ok
              ? "bg-brand-50 text-brand-700"
              : showErrors
                ? "bg-danger-50 text-danger-600"
                : "bg-ink-100 text-ink-500",
          )}
        >
          {ok ? <Check className="h-3 w-3" strokeWidth={3} aria-hidden /> : null}
          {status}
        </span>
        <ChevronDown
          aria-hidden
          className={cn("h-4 w-4 shrink-0 text-ink-400 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="border-t border-hairline px-3.5 py-3">
          <StyleStep
            styles={styleMaster}
            articleName={name}
            path={state.path}
            onPathChange={(path) => {
              onPatch(rowKey, { path }, name);
              if (path === "customize") onCustomize(rowKey, name);
            }}
            selectedId={state.selectedId}
            onSelect={(id) => onPatch(rowKey, { selectedId: id }, name)}
            onOpenCustomize={() => onCustomize(rowKey, name)}
            customSummary={
              state.path === "customize" && state.draft.name.trim()
                ? {
                    name: state.draft.name.trim(),
                    parts: state.draft.parts.length,
                    fromMaster: Boolean(state.baseStyleId),
                  }
                : null
            }
          />
        </div>
      )}
    </Wrapper>
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
