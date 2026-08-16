/**
 * Step 3 — the last readable moment before the configurator opens.
 *
 * Everything chosen so far is restated in one place because this is where a
 * wrong turn is cheap to undo and expensive to discover later: a style seeds
 * the whole component table, and a template decides what the piece is finally
 * sold at. Both are shown with their provenance, and both remain one click
 * from being changed.
 */

import { ArrowLeft, Check, PencilRuler, Repeat } from "lucide-react";
import type { CostTemplate } from "@/lib/costTemplates";
import type { StyleDef } from "@/lib/styleMaster";
import { cn } from "@/lib/utils";
import { ProvenanceChip, type Provenance } from "./Provenance";
import { InheritancePreview } from "./StyleStep";

const pct = (n: number) => `${n}%`;
const inr = (n: number) => `₹${n % 1 === 0 ? n : n.toFixed(2)}`;

export function ConfirmStep({
  template,
  style,
  styleProvenance,
  builtManually,
  /** a set: its members carry the styles, so there is none to summarise here */
  omitStyle = false,
  saveToMaster,
  onSaveToMasterChange,
  onEditStyle,
  onChangeStyle,
}: {
  template: CostTemplate | undefined;
  /** the chosen master style, or the manual draft rendered as one */
  style: StyleDef | null;
  styleProvenance: Provenance;
  builtManually: boolean;
  omitStyle?: boolean;
  saveToMaster: boolean;
  onSaveToMasterChange: (v: boolean) => void;
  onEditStyle: () => void;
  onChangeStyle: () => void;
}) {
  return (
    <div className="space-y-3">
      {template && (
        <section className="rounded-lg border border-hairline bg-surface p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-[12.5px] font-semibold text-ink-900">Commercial baseline</h3>
            <span className="text-[12px] text-ink-600">{template.name}</span>
            <ProvenanceChip kind={template.kind === "buyer" ? "customer" : "master"} />
          </div>
          <p className="mt-1 text-[11.5px] text-ink-600 tabular-nums">
            Overheads {pct(template.overheadPct)} · Freight {pct(template.freightPct)} · Finance{" "}
            {pct(template.financePct)} · Testing {pct(template.testingPct)} · Special pack{" "}
            {inr(template.specialPackInr)}/pc
          </p>
        </section>
      )}

      {omitStyle ? (
        <p className="rounded-lg border border-hairline bg-surface-alt/40 px-3 py-3 text-[12px] text-ink-600">
          This is a set. Each member article chooses its own style inside the kit workspace, so
          there is no single style to fix here.
        </p>
      ) : (
        <section className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-[12.5px] font-semibold text-ink-900">Style summary</h3>
            <ProvenanceChip kind={styleProvenance} />
            <div className="ml-auto flex items-center gap-1.5">
              <SecondaryAction
                onClick={onEditStyle}
                icon={<PencilRuler className="h-3 w-3" aria-hidden />}
              >
                Edit Style
              </SecondaryAction>
              <SecondaryAction
                onClick={onChangeStyle}
                icon={<Repeat className="h-3 w-3" aria-hidden />}
              >
                Change Style
              </SecondaryAction>
            </div>
          </div>

          {style ? (
            <InheritancePreview style={style} />
          ) : (
            <p className="rounded-lg border border-hairline bg-surface-alt/40 px-3 py-4 text-[12px] text-ink-500">
              No style chosen yet.{" "}
              <button type="button" onClick={onChangeStyle} className="text-brand-700 underline">
                <ArrowLeft className="mr-1 inline h-3 w-3" aria-hidden />
                Go back and pick one
              </button>
            </p>
          )}
        </section>
      )}

      {!omitStyle && builtManually && style && (
        <section className="rounded-lg border border-hairline bg-surface p-3">
          {/* The second time this product is costed, nobody should type these
              parts again — but a one-off sample style clogging the master is a
              real cost too, so the choice is stated rather than assumed. */}
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={saveToMaster}
              onChange={(e) => onSaveToMasterChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brand-700)]"
            />
            <span className="min-w-0">
              <span className="block text-[12.5px] font-semibold text-ink-900">
                Save as Style Master
              </span>
              <span className="mt-0.5 block text-[11.5px] text-ink-500">
                {saveToMaster
                  ? `“${style.name}” will be added to the style master — the next order can select it instead of rebuilding it.`
                  : "This style will be used for this article only and will not appear in the style picker."}
              </span>
            </span>
          </label>
        </section>
      )}

      <p className="flex items-start gap-1.5 text-[11.5px] text-ink-500">
        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-700" aria-hidden />
        Continuing records both choices against this article and opens the Costing Configuration
        Workspace with the style&rsquo;s parts already seeded.
      </p>
    </div>
  );
}

function SecondaryAction({
  onClick,
  icon,
  children,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-hairline bg-surface px-2 py-1 text-[11.5px] font-medium text-ink-700",
        "hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
