/**
 * Approval — the step after Quotation.
 *
 * Left (70%): the SAME quotation the Quotation Workspace built, rendered
 * read-only — every product and kit, its scenario/variant/option, MOQ, direct
 * cost, commercial costs, final cost, selling price, margin and quoted value.
 * Nothing here is re-priced or re-typed; it comes from `quotationView`, the
 * same read every other quotation surface uses.
 *
 * Right (30%): reviewer assignment — who approves, submit, status. The
 * mechanics mirror the existing costing sign-off flow (same team shape, same
 * submit-then-track pattern) so approval reads as one consistent idea used
 * at two stages of the workflow, not two unrelated ones.
 */

import { Boxes, Check, Clock, MessageSquareWarning, Package, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Pod } from "@/lib/podsStore";
import { WorkflowStepper } from "@/components/layout/WorkflowStepper";
import { inr, usd } from "@/lib/commercialProvisions";
import { totalsOf, type ViewedItem } from "@/lib/quotationView";
import {
  REVIEW_TEAMS,
  allTeamsAssigned,
  assignedPeople,
  submitQuotationForApproval,
  toggleReviewer,
  useQuotationApproval,
  type ReviewStatus,
} from "@/lib/quotationApprovalStore";
import { ConfigChips } from "./ConfigChips";
import { KitComposition } from "./QuoteItemCard";

export function QuotationApprovalWorkspace({
  pod,
  articleId,
  costingRef,
  views,
  onClose,
}: {
  pod: Pod;
  articleId: string;
  costingRef?: string;
  views: ViewedItem[];
  onClose: () => void;
}) {
  const approval = useQuotationApproval(pod.id);
  const totals = totalsOf(views);
  const people = assignedPeople(approval);
  const approvedCount = people.filter((k) => approval.reviewStatus[k] === "approved").length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas">
      <header className="shrink-0 border-b border-hairline bg-surface px-6 py-3 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button
              onClick={onClose}
              aria-label="Back to quotation"
              className="mt-1 rounded-md p-1 text-ink-500 hover:bg-surface-alt hover:text-ink-900"
            >
              <X className="h-4 w-4" />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-[20px] font-semibold tracking-tight text-ink-900">
                  Quotation Approval
                </h1>
                <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-ink-400">
                  {pod.id}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    approval.submitted ? "bg-amber-50 text-amber-700" : "bg-ink-100 text-ink-700",
                  )}
                >
                  {approval.submitted ? "In approval" : "Draft"}
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-ink-500">
                <span>
                  Buyer <span className="text-ink-900">{pod.buyer}</span>
                </span>
                <span>
                  Buyer Ref <span className="text-ink-900">{pod.buyerRef}</span>
                </span>
                <span>
                  Total value{" "}
                  <span className="font-semibold text-ink-900">{usd(totals.orderValueUsd, 0)}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <WorkflowStepper
        active="Approval"
        podId={pod.id}
        articleId={articleId}
        costingRef={costingRef}
        onStepClick={(step) => {
          // Stay put on Approval; closing on Quotation is enough since it's
          // the same page underneath. Configuration & Costing / Costing
          // Report are real routes — let their Link navigate normally.
          if (step === "Approval") return true;
          if (step === "Quotation") {
            onClose();
            return true;
          }
          return false;
        }}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* LEFT — the quotation, read-only */}
        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1000px] space-y-4 px-6 py-6 lg:px-8">
            <div className="flex items-center gap-2">
              <h2 className="text-[13px] font-semibold text-ink-900">Quotation under review</h2>
              <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] text-ink-600">
                read only
              </span>
            </div>

            {views.length === 0 ? (
              <p className="rounded-lg border border-dashed border-ink-200 bg-surface px-4 py-8 text-center text-[13px] text-ink-500">
                This quotation has no items.
              </p>
            ) : (
              views.map((v) => <ApprovalItem key={v.item.id} view={v} />)
            )}
          </div>
        </div>

        {/* RIGHT — reviewers */}
        <aside className="flex w-[340px] shrink-0 flex-col border-l border-hairline bg-surface">
          <div className="shrink-0 border-b border-hairline px-4 py-3">
            <h2 className="text-[13px] font-semibold text-ink-900">Approvers</h2>
            <p className="mt-0.5 text-[11.5px] text-ink-500">
              {approval.submitted
                ? `${approvedCount}/${people.length} approved`
                : "Assign at least one reviewer per team"}
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            <div className="space-y-4">
              {REVIEW_TEAMS.map((team) => (
                <div key={team.id}>
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-[12px] font-semibold text-ink-900">{team.label}</h3>
                    <span className="text-[10.5px] text-ink-400">{team.note}</span>
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {team.members.map((person) => {
                      const key = `${team.id}:${person}`;
                      const checked = (approval.assign[team.id] ?? []).includes(person);
                      const status = approval.reviewStatus[key];
                      return (
                        <li key={person} className="flex items-center gap-2">
                          <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-surface-alt">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={approval.submitted}
                              onChange={() => toggleReviewer(pod.id, team.id, person)}
                              className="h-3.5 w-3.5 accent-[var(--color-brand-700)] disabled:cursor-not-allowed"
                            />
                            <span className="text-[12.5px] text-ink-700">{person}</span>
                          </label>
                          {approval.submitted && checked && <StatusPill status={status} />}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="shrink-0 border-t border-hairline p-4">
            {!approval.submitted ? (
              <button
                type="button"
                disabled={!allTeamsAssigned(approval) || views.length === 0}
                onClick={() => submitQuotationForApproval(pod.id)}
                className="flex w-full items-center justify-center gap-1.5 rounded-md bg-brand-700 px-3.5 py-2.5 text-[13px] font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-ink-200"
                title={
                  allTeamsAssigned(approval)
                    ? "Send this quotation for approval"
                    : "Assign at least one reviewer per team"
                }
              >
                <Send className="h-4 w-4" /> Send for Approval
              </button>
            ) : (
              <p className="text-center text-[11.5px] text-ink-500">
                Sent {new Date(approval.submittedAt ?? Date.now()).toLocaleString("en-GB")}
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status?: ReviewStatus }) {
  if (status === "approved")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">
        <Check className="h-2.5 w-2.5" aria-hidden /> Approved
      </span>
    );
  if (status === "changes")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
        <MessageSquareWarning className="h-2.5 w-2.5" aria-hidden /> Changes
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-500">
      <Clock className="h-2.5 w-2.5" aria-hidden /> Pending
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Left column — one item, in full
 * ------------------------------------------------------------------ */

function ApprovalItem({ view }: { view: ViewedItem }) {
  return view.kind === "kit" ? <ApprovalKit view={view} /> : <ApprovalProduct view={view} />;
}

function ApprovalProduct({ view }: { view: Extract<ViewedItem, { kind: "product" }> }) {
  const { item, priced } = view;
  const c = priced.commercial;
  return (
    <article className="overflow-hidden rounded-xl border border-hairline bg-surface">
      <header className="flex flex-wrap items-start gap-3 px-4 py-3">
        {item.image ? (
          <img
            src={item.image}
            alt=""
            className="h-11 w-11 shrink-0 rounded-lg border border-hairline object-cover"
          />
        ) : (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-hairline bg-surface-alt text-ink-400">
            <Package className="h-4 w-4" aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[14px] font-semibold text-ink-900">{item.name}</h3>
            <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-600">
              Product
            </span>
          </div>
          <ConfigChips
            className="mt-1"
            scenario={priced.scenario}
            build={priced.build}
            size={item.size ?? priced.sizeLabel}
            moq={priced.moq}
          />
        </div>
      </header>

      <StatStrip
        cells={[
          { label: "Direct cost", value: `${inr(priced.directCostInr)} / pc` },
          {
            label: "Commercial costs",
            value: `${inr(c.totalPurchaseInr + c.totalSaleInr)} / pc`,
          },
          { label: "Final cost", value: `${inr(c.finalCostInr)} / pc` },
          { label: "Selling price", value: `${usd(c.sellingUsd)} / pc`, strong: true },
          { label: "Margin", value: `${c.marginPct.toFixed(1)}%` },
          { label: "Quoted value", value: usd(priced.orderValueUsd, 0), strong: true },
        ]}
      />
    </article>
  );
}

function ApprovalKit({ view }: { view: Extract<ViewedItem, { kind: "kit" }> }) {
  const { item, priced } = view;
  const c = priced.commercial;
  return (
    <article className="overflow-hidden rounded-xl border-2 border-[var(--color-cfg)] bg-surface">
      <header className="flex flex-wrap items-center gap-2 bg-[var(--color-cfg-soft)] px-4 py-2.5">
        <Boxes className="h-4 w-4 text-[var(--color-cfg-strong)]" aria-hidden />
        <h3 className="text-[14px] font-semibold text-ink-900">KIT — {item.name}</h3>
        <span className="rounded bg-[var(--color-cfg-strong)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-white">
          Kit
        </span>
        <span className="text-[11.5px] text-ink-500">
          {priced.members.length} article{priced.members.length === 1 ? "" : "s"} per set
        </span>
      </header>

      <ul className="divide-y divide-hairline border-b border-hairline">
        {priced.members.map((m) => (
          <li key={m.articleId} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
            {m.image && (
              <img
                src={m.image}
                alt=""
                className="h-8 w-8 shrink-0 rounded border border-hairline object-cover"
              />
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-semibold text-ink-900">{m.name}</span>
              <ConfigChips
                className="mt-1"
                scenario={m.scenario}
                build={m.build}
                size={m.sizeLabel}
                moq={m.moq}
              />
            </span>
            <span className="shrink-0 text-right text-[12px] tabular-nums text-ink-700">
              {inr(m.directCostInr)} / pc
            </span>
          </li>
        ))}
      </ul>

      <KitComposition kit={priced} />

      <StatStrip
        cells={[
          { label: "Combined direct cost", value: `${inr(priced.setDirectCostInr)} / set` },
          { label: "Final cost", value: `${inr(c.finalCostInr)} / set` },
          { label: "Selling price", value: `${usd(c.sellingUsd)} / set`, strong: true },
          { label: "Margin", value: `${c.marginPct.toFixed(1)}%` },
          { label: "Quoted", value: `${priced.sets.toLocaleString("en-IN")} sets` },
          { label: "Quoted value", value: usd(priced.orderValueUsd, 0), strong: true },
        ]}
      />
    </article>
  );
}

function StatStrip({ cells }: { cells: { label: string; value: string; strong?: boolean }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-px border-t border-hairline bg-hairline sm:grid-cols-3 lg:grid-cols-6">
      {cells.map((c) => (
        <div key={c.label} className="bg-surface px-3 py-2.5">
          <dt className="text-[9.5px] font-medium uppercase tracking-[0.08em] text-ink-500">
            {c.label}
          </dt>
          <dd
            className={cn(
              "mt-0.5 tabular-nums",
              c.strong ? "text-[13px] font-semibold text-ink-900" : "text-[11.5px] text-ink-700",
            )}
          >
            {c.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
