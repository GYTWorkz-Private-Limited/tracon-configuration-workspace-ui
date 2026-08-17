/**
 * Pre-costing setup — the three decisions that must exist BEFORE a costing
 * sheet does.
 *
 *   POD  →  Buyer Template  →  Style (use existing or customize)  →  Confirm  →  Costing
 *
 * These used to be two cards bolted onto screens the user had already landed
 * on, which let a sheet be opened — and filled in — before anybody said what
 * commercial structure it prices against or what the product actually is.
 * Doing it as a flow makes the order non-negotiable.
 *
 * It is ONE dialog, not three: the body changes per step while the header,
 * step indicator and footer hold still, so moving Back never feels like
 * re-entering a different tool. Nothing is written to any store until the last
 * Continue — a user who abandons half way leaves no partial state behind.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  setTemplateFor,
  templateById,
  useTemplateFor,
  TEMPLATES,
  type CostTemplate,
} from "@/lib/costTemplates";
import {
  saveCustomStyle,
  setStyleFor,
  styleById,
  useAllStyles,
  useStyleFor,
  type StyleDef,
} from "@/lib/styleMaster";

import { ProvenanceLegend, type Provenance } from "./Provenance";
import { TemplateStep } from "./TemplateStep";
import { StyleStep, type StylePath } from "./StyleStep";
import { StyleCustomizeDrawer } from "./StyleCustomizeDrawer";
import { ConfirmStep } from "./ConfirmStep";
import {
  ONE_TIME_PREFIX,
  draftFromStyle,
  draftIsValid,
  emptyDraft,
  isOneTimeStyle,
  toStyleDef,
  validateDraft,
  type StyleDraft,
} from "./styleDraft";

const STEPS = ["Template", "Style", "Confirm"] as const;

export function PreCostingSetup({
  open,
  podId,
  articleId,
  articleName,
  buyer,
  /**
   * The article cannot be costed without these answers, so the dialog is not
   * dismissible into an empty workspace — closing means leaving the article.
   */
  required = false,
  /**
   * A set has no style of its own — its members choose theirs inside the kit
   * workspace — so the flow collapses to Template → Confirm rather than asking
   * a question that has no true answer.
   */
  skipStyle = false,
  onClose,
  onComplete,
}: {
  open: boolean;
  podId: string;
  articleId: string;
  articleName?: string;
  buyer?: string;
  required?: boolean;
  skipStyle?: boolean;
  onClose: () => void;
  onComplete?: () => void;
}) {
  const existingTemplate = useTemplateFor(podId);
  const existingStyle = useStyleFor(podId, articleId);
  // A one-off build lives in the same store as saved masters (it is the only
  // thing that can seed the sheet), so the picker filters it out again here.
  const styles = useAllStyles().filter((s) => !isOneTimeStyle(s));

  const [step, setStep] = useState(0);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [path, setPath] = useState<StylePath>("select");
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  /** the master a customisation departed from — null means from scratch */
  const [baseStyleId, setBaseStyleId] = useState<string | null>(null);
  const [draft, setDraft] = useState<StyleDraft>(() => emptyDraft());
  const [saveToMaster, setSaveToMaster] = useState(true);
  const [showErrors, setShowErrors] = useState(false);
  /** the builder is a drawer over this dialog, so its openness lives here */
  const [customizeOpen, setCustomizeOpen] = useState(false);

  const closeRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Opening fresh must not inherit a previous run's answers, but it SHOULD
  // start from whatever the POD already knows — re-opening the flow to change
  // one thing should not make the user re-state the other.
  useEffect(() => {
    if (!open) return;
    setStep(0);
    setShowErrors(false);
    setTemplateId(
      existingTemplate?.id ??
        TEMPLATES.find((t) => t.kind === "buyer" && buyer && t.buyer === buyer)?.id ??
        TEMPLATES.find((t) => t.kind === "general")?.id ??
        null,
    );
    const prior = styleById(existingStyle);
    setPath("select");
    setSelectedStyleId(prior && !isOneTimeStyle(prior) ? prior.id : null);
    setBaseStyleId(null);
    setDraft(prior ? draftFromStyle(prior) : emptyDraft({ product: articleName ?? "" }));
    setSaveToMaster(true);
    setCustomizeOpen(false);
    closeRef.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Each step is a screenful of its own; carrying the previous step's scroll
  // position into it hides the top of the new question.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [step]);

  const stepLabels = skipStyle ? (["Template", "Confirm"] as const) : STEPS;
  const stage: "template" | "style" | "confirm" =
    step === 0 ? "template" : skipStyle || step === 2 ? "confirm" : "style";

  const errors = useMemo(() => validateDraft(draft), [draft]);
  /** the customise path — whether it started from a master or from nothing */
  const customised = path === "customize";

  /** The draft rendered as a real style, so preview and save share one shape. */
  const draftStyle: StyleDef | null = useMemo(() => {
    if (!customised) return null;
    const def = toStyleDef(draft);
    if (!def.name || def.parts.length === 0) return null;
    return { ...def, id: "draft", custom: true };
  }, [customised, draft]);

  const confirmedStyle = customised
    ? draftStyle
    : (styles.find((s) => s.id === selectedStyleId) ?? null);
  // A customised MASTER style is inherited-then-modified, not manual: the
  // parts, allowances and workmanship still came from the master, and saying
  // otherwise throws away the only reason to trust them.
  const styleProvenance: Provenance = !customised || baseStyleId ? "master" : "manual";
  const styleModified = customised && Boolean(baseStyleId);

  const template: CostTemplate | undefined = templateId ? templateById(templateId) : undefined;

  const canContinue =
    stage === "template"
      ? Boolean(templateId)
      : stage === "style"
        ? customised
          ? draftIsValid(errors)
          : Boolean(selectedStyleId)
        : skipStyle || Boolean(confirmedStyle);

  const goNext = () => {
    if (stage === "style" && customised && !draftIsValid(errors)) {
      // Errors stay hidden until the user actually tries to move on — a form
      // that turns red while it is still being filled in reads as broken. The
      // fields live in the drawer, so the errors are useless unless it is open.
      setShowErrors(true);
      setCustomizeOpen(true);
      return;
    }
    if (!canContinue) return;
    if (step < stepLabels.length - 1) {
      setStep(step + 1);
      return;
    }
    commit();
  };

  const commit = () => {
    if (!templateId) return;
    setTemplateFor(podId, templateId);

    if (skipStyle) {
      // nothing else to record — the kit's members carry their own styles
    } else if (customised) {
      if (!draftStyle) return;
      const saved = saveCustomStyle(
        toStyleDef(draft),
        saveToMaster ? "You" : `${ONE_TIME_PREFIX} · ${podId}`,
        !saveToMaster,
      );
      setStyleFor(podId, articleId, saved.id);
    } else if (selectedStyleId) {
      setStyleFor(podId, articleId, selectedStyleId);
    } else {
      return;
    }

    // Deliberately NOT onClose(): the two writes above are what close this
    // dialog, via the gate that opened it. Calling the cancel path here would
    // fire while the caller still sees "no choices recorded" and read as an
    // abandoned setup — which, on a required flow, means leaving the article.
    onComplete?.();
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Pre-costing setup"
      >
        <button
          className="absolute inset-0 bg-ink-900/40"
          aria-label={required ? "Leave this article" : "Close"}
          onClick={onClose}
        />

        <div className="relative flex max-h-[92vh] w-full max-w-[860px] flex-col overflow-hidden rounded-xl border border-hairline bg-surface shadow-2xl">
          <header className="shrink-0 border-b border-hairline px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0">
                <h2 className="text-[16px] font-semibold text-ink-900">Set up costing</h2>
                <p className="mt-0.5 text-[12px] text-ink-500">
                  {articleName ? (
                    <>
                      <span className="font-medium text-ink-700">{articleName}</span>
                      {" — "}
                    </>
                  ) : null}
                  the commercial baseline and the style are agreed here, before the configurator
                  opens.
                </p>
              </div>
              <button
                ref={closeRef}
                onClick={onClose}
                aria-label={required ? "Leave this article" : "Close"}
                className="ml-auto shrink-0 rounded-md p-1.5 text-ink-500 hover:bg-surface-alt hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <StepIndicator
              labels={stepLabels}
              step={step}
              onStepClick={(i) => i < step && setStep(i)}
            />
          </header>

          <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {stage === "template" && (
              <TemplateStep buyer={buyer} selectedId={templateId} onSelect={setTemplateId} />
            )}
            {stage === "style" && (
              <StyleStep
                styles={styles}
                articleName={articleName}
                path={path}
                onPathChange={(p) => {
                  setPath(p);
                  setShowErrors(false);
                  if (p === "select") setCustomizeOpen(false);
                }}
                selectedId={selectedStyleId}
                onSelect={setSelectedStyleId}
                onOpenCustomize={() => setCustomizeOpen(true)}
                customSummary={
                  draftStyle
                    ? {
                        name: draftStyle.name,
                        parts: draftStyle.parts.length,
                        fromMaster: Boolean(baseStyleId),
                      }
                    : null
                }
              />
            )}
            {stage === "confirm" && (
              <ConfirmStep
                template={template}
                style={confirmedStyle}
                styleProvenance={styleProvenance}
                styleModified={styleModified}
                builtManually={customised}
                omitStyle={skipStyle}
                saveToMaster={saveToMaster}
                onSaveToMasterChange={setSaveToMaster}
                /* Edit keeps the values; Change throws them away and returns to
                 the picker — two genuinely different intentions. */
                onEditStyle={() => {
                  if (!customised && confirmedStyle) {
                    // Editing a master is customising it — and it is inherited
                    // from that master, so the base is recorded, not discarded.
                    setDraft(draftFromStyle(confirmedStyle));
                    setBaseStyleId(confirmedStyle.id);
                    setPath("customize");
                  }
                  setStep(1);
                  setCustomizeOpen(true);
                }}
                onChangeStyle={() => {
                  setPath("select");
                  setStep(1);
                  setCustomizeOpen(false);
                }}
              />
            )}
          </div>

          <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-hairline bg-surface-alt/40 px-5 py-3.5">
            <ProvenanceLegend className="mr-auto" />
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-3.5 py-2 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            )}
            <button
              onClick={goNext}
              /* On the build path Continue stays live even when incomplete: the
               click is what reveals which fields are missing. */
              disabled={stage === "style" ? !customised && !selectedStyleId : !canContinue}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
            >
              {stage === "confirm" ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Continue to Costing
                </>
              ) : (
                <>
                  Continue <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </footer>
        </div>
      </div>

      {/* Mounted outside the dialog box so it overlays the whole flow rather
        than scrolling inside one step's body. */}
      <StyleCustomizeDrawer
        open={!skipStyle && customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        articleName={articleName}
        styles={styles}
        baseStyleId={baseStyleId}
        /* Choosing what to start from REPLACES the draft — that is the whole
         point of the affordance — so it is the one moment the typed values
         are allowed to be overwritten. */
        onStartFrom={(id) => {
          const base = id ? styles.find((s) => s.id === id) : undefined;
          setBaseStyleId(base?.id ?? null);
          setDraft(base ? draftFromStyle(base) : emptyDraft({ product: articleName ?? "" }));
          setShowErrors(false);
        }}
        draft={draft}
        onDraftChange={setDraft}
        errors={errors}
        showErrors={showErrors}
        onSave={() => {
          if (!draftIsValid(errors)) {
            setShowErrors(true);
            return false;
          }
          setPath("customize");
          setShowErrors(false);
          return true;
        }}
        saveToMaster={saveToMaster}
        onSaveToMasterChange={setSaveToMaster}
      />
    </>
  );
}

function StepIndicator({
  labels,
  step,
  onStepClick,
}: {
  labels: readonly string[];
  step: number;
  onStepClick: (i: number) => void;
}) {
  return (
    <ol className="mt-3 flex items-center gap-1.5">
      {labels.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <li key={label} className="flex items-center gap-1.5">
            {/* Only completed steps are clickable: jumping ahead would skip a
                decision the next step depends on. */}
            <button
              type="button"
              disabled={!done}
              onClick={() => onStepClick(i)}
              aria-current={active ? "step" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                active && "bg-brand-50 text-brand-700 ring-1 ring-brand-700/25",
                done && "text-ink-600 hover:bg-surface-alt",
                !active && !done && "text-ink-400",
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full text-[9.5px] font-semibold",
                  active
                    ? "bg-brand-700 text-white"
                    : done
                      ? "bg-ink-100 text-ink-700"
                      : "bg-ink-50 text-ink-400",
                )}
              >
                {done ? <Check className="h-2.5 w-2.5" aria-hidden /> : i + 1}
              </span>
              {label}
            </button>
            {i < STEPS.length - 1 && <span className="h-px w-4 bg-hairline" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
