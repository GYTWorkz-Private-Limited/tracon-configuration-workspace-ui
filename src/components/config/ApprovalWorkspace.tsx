// ApprovalWorkspace — the "Send for approval" step.
// Left (70%): a read-only Approval Report consolidating Product, Configuration,
// Costing and Scenario data. Right (30%): Approval workflow — assign reviewers
// before submission, track progress after.

import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  History,
  MessageSquareWarning,
  Plus,
  Send,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PodArticleTabs } from "@/components/layout/ArticleTabsBar";
import { markSubmittedForApproval, useRequestedChanges } from "@/lib/requestedChangesStore";

import { WorkflowStepper } from "@/components/layout/WorkflowStepper";
import {
  ActionGroup,
  RequestedChangesAction,
  RevisionHistoryAction,
  WorkingCopyChip,
  useActionHost,
} from "@/components/changes/FlowActions";

import { computeCushion, type CushionVariant, type CushionMetrics } from "@/lib/cushionCosting";
import { buildCostingSheet, inr } from "@/lib/costingSheet";

type Entry = { variant: CushionVariant; metrics: CushionMetrics };

type Article = { id: string; name: string; size?: string; moq?: string };

type Props = {
  variants: CushionVariant[];
  activeId: string;
  buyer: string;
  productName: string;
  srfId: string;
  targetPriceUsd: number;
  onClose: () => void;
  podRef?: string;
  buyerRef?: string;
  statusLabel?: string;
  updatedAt?: string;
  articles?: Article[];
  activeArticleId?: string;
  onSelectArticle?: (id: string) => void;
  navPodId?: string;
  navArticleId?: string;
};

/* ------------------------------- reviewers ------------------------------- */

type Team = { id: string; label: string; note: string; members: string[] };

const TEAMS: Team[] = [
  {
    id: "assistant",
    label: "Costing Assistant",
    note: "Validates configuration & rates",
    members: ["Anita R.", "Vikram S.", "Deepa N."],
  },
  {
    id: "manager",
    label: "Costing Manager",
    note: "Signs off cost build-up",
    members: ["Meera K.", "Rohit P."],
  },
  {
    id: "merch",
    label: "Merchandiser",
    note: "Confirms buyer expectations",
    members: ["Sana V.", "Karthik R."],
  },
  {
    id: "management",
    label: "Management",
    note: "Final commercial approval",
    members: ["Anil D.", "Gautam K."],
  },
];

type ReviewStatus = "pending" | "approved" | "changes";

type ChangeRequest = {
  id: string;
  reviewer: string;
  stage: "Product" | "Configuration" | "Costing";
  section: string;
  field: string;
  comment: string;
  at: string;
  status: "Open" | "Resolved";
};

const DEMO_CHANGES: ChangeRequest[] = [
  {
    id: "cr-1",
    reviewer: "Meera K.",
    stage: "Configuration",
    section: "Fabric",
    field: "Fabric wastage %",
    comment:
      "5% wastage looks high for this construction — please re-check with the mill and revise to 3%.",
    at: "Today, 10:42",
    status: "Open",
  },
  {
    id: "cr-2",
    reviewer: "Sana V.",
    stage: "Costing",
    section: "Commercial pricing",
    field: "Target margin",
    comment: "Buyer target is tight. Confirm whether we can hold this margin at the quoted MOQ.",
    at: "Today, 11:05",
    status: "Open",
  },
];

/* -------------------------------- component ------------------------------- */

export function ApprovalWorkspace({
  variants,
  activeId,
  buyer,
  productName,
  srfId,
  targetPriceUsd,
  onClose,
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
  const entries: Entry[] = useMemo(
    () => variants.map((v) => ({ variant: v, metrics: computeCushion(v.inputs) })),
    [variants],
  );
  const active = entries.find((e) => e.variant.id === activeId) ?? entries[0];

  const sheet = useMemo(
    () =>
      buildCostingSheet(active.variant.inputs, {
        productName,
        variantName: active.variant.name,
      }),
    [active, productName],
  );

  const [assign, setAssign] = useState<Record<string, string[]>>({
    assistant: ["Anita R."],
    manager: ["Meera K."],
    merch: [],
    management: [],
  });
  const [submitted, setSubmitted] = useState(false);
  /** keyed by `${teamId}:${person}` — status is per user, not per team */
  const [reviewStatusRaw, setReviewStatus] = useState<Record<string, ReviewStatus>>({});
  const [changes, setChanges] = useState<ChangeRequest[]>([]);
  const [rail, setRail] = useState<null | "copilot" | "changes" | "revisions">(null);

  const allAssigned = TEAMS.every((t) => (assign[t.id]?.length ?? 0) > 0);
  const openChanges = changes.filter((c) => c.status === "Open");
  const people = TEAMS.flatMap((t) => (assign[t.id] ?? []).map((n) => `${t.id}:${n}`));

  const submit = () => {
    setSubmitted(true);
    markSubmittedForApproval();
    const next: Record<string, ReviewStatus> = Object.fromEntries(
      people.map((k) => [k, "pending" as ReviewStatus]),
    );
    // demo: assistants approve, first manager requests changes
    for (const k of people) {
      if (k.startsWith("assistant:")) next[k] = "approved";
      if (k.startsWith("manager:")) next[k] = "changes";
    }
    setReviewStatus(next);
    setChanges(DEMO_CHANGES);
    toast.success("Sent for approval — reviewers notified");
  };

  // Once the resubmitted revision is approved (demo), every reviewer shows approved.
  const rc = useRequestedChanges();
  const reviewStatus: Record<string, ReviewStatus> = rc.approvalDone
    ? Object.fromEntries(people.map((k) => [k, "approved" as ReviewStatus]))
    : reviewStatusRaw;
  const approvedCount = people.filter((k) => reviewStatus[k] === "approved").length;
  const totalReviewers = people.length;
  useActionHost();

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas">
      {/* Header — same shell as Product / Configuration / Costing */}
      <header className="shrink-0 border-b border-hairline bg-surface px-6 py-3 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button
              onClick={onClose}
              aria-label="Back to costing report"
              className="mt-1 rounded-md p-1 text-ink-500 hover:bg-surface-alt hover:text-ink-900"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
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
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    submitted ? "bg-amber-50 text-amber-700" : "bg-ink-100 text-ink-700",
                  )}
                >
                  {submitted ? "In approval" : (statusLabel ?? "Ready for approval")}
                </span>
                <WorkingCopyChip />
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

          {/* Grouped actions — always right; secondary first, primary last. */}
          <ActionGroup>
            <button
              onClick={() => setRail(rail === "copilot" ? null : "copilot")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-[13px] font-medium transition-colors",
                rail === "copilot"
                  ? "border-brand-700 bg-brand-50 text-brand-700"
                  : "border-hairline bg-surface text-ink-700 hover:bg-surface-alt",
              )}
            >
              <Sparkles className="h-4 w-4" /> AI Copilot
            </button>
            {submitted && <RequestedChangesAction />}
            {submitted && <RevisionHistoryAction />}
            {!submitted ? (
              <button
                onClick={submit}
                disabled={!allAssigned}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-[13px] font-medium text-white transition-colors",
                  allAssigned ? "bg-brand-700 hover:bg-brand-800" : "cursor-not-allowed bg-ink-200",
                )}
                title={allAssigned ? "Ready for quotation" : "Assign at least one reviewer per team"}
              >
                <Send className="h-4 w-4" /> Ready for quotation
              </button>
            ) : rc.approvalDone && navPodId && navArticleId ? (
              <Link
                to="/quotation/$podId/$articleId"
                params={{ podId: navPodId, articleId: navArticleId }}
                search={{ sel: undefined }}

                replace
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-brand-800"
                title="Generate quotation"
              >
                <FileText className="h-4 w-4" /> Generate Quotation
              </Link>
            ) : null}
          </ActionGroup>
        </div>
      </header>

      <WorkflowStepper
        active="Approval"
        podId={navPodId}
        articleId={navArticleId}
        costingRef={srfId}
        onStepClick={(step) => {
          if (step === "Approval") return true;
          // leaving the approval overlay in every case
          onClose();
          return step === "Costing Report";
        }}
      />

      {/* Body */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* LEFT 70% — approval report */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[1000px] px-6 py-6 lg:px-8">
              <div className="rounded-xl border border-hairline bg-surface px-5 py-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] lg:px-7 lg:py-6">
                <div className="mb-5 flex items-center gap-2 border-b border-hairline pb-4">
                  <h2 className="text-[16px] font-semibold text-ink-900">Approval report</h2>
                  <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] text-ink-600">
                    read only
                  </span>
                </div>

                <ReportSection
                  title="Scenario summary"
                  subtitle={`${entries.length} pricing scenarios created during costing`}
                >
                  <div className="overflow-hidden rounded-lg border border-hairline bg-surface">
                    <table className="w-full text-[12.5px]">
                      <thead className="border-b border-hairline bg-surface-alt text-[11px] uppercase tracking-wide text-ink-500">
                        <tr>
                          <th className="px-4 py-2.5 text-left font-medium">Scenario</th>
                          <th className="px-4 py-2.5 text-right font-medium">Material cost</th>
                          <th className="px-4 py-2.5 text-right font-medium">Grand total</th>
                          <th className="px-4 py-2.5 text-left font-medium">Key variables</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((e) => {
                          const s = buildCostingSheet(e.variant.inputs, {
                            productName,
                            variantName: e.variant.name,
                          });
                          const isActive = e.variant.id === active.variant.id;
                          return (
                            <tr
                              key={e.variant.id}
                              className={cn(
                                "border-b border-hairline last:border-0",
                                isActive && "bg-brand-50/50",
                              )}
                            >
                              <td className="px-4 py-2.5">
                                <span className="font-medium text-ink-900">{e.variant.name}</span>
                                {isActive && (
                                  <span className="ml-2 rounded-full bg-brand-700 px-1.5 py-0.5 text-[10px] font-medium text-white">
                                    submitted
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-ink-700">
                                {inr(s.nums.materialTotal)}
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-ink-700">
                                {inr(s.grandTotal)}
                              </td>
                              <td className="px-4 py-2.5 text-ink-500">
                                {e.variant.inputs.qty.toLocaleString("en-IN")} pcs ·{" "}
                                {e.variant.inputs.fabricGsm ?? 200} GSM · FX ₹
                                {e.variant.inputs.fxRate.toFixed(1)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </ReportSection>

                <ReportSection title="Product details">
                  <KvTable
                    rows={[
                      ["Buyer", buyer],
                      ["Buyer reference", buyerRef ?? "—"],
                      ["POD reference", podRef ?? srfId],
                      ["Product", productName],
                      ["Article", activeArticleId ?? "—"],
                      ["Description", `${productName} · ${active.variant.name} build`],
                      [
                        "Size",
                        active.variant.inputs.sizeInches
                          ? `${active.variant.inputs.sizeInches}" × ${active.variant.inputs.sizeInches}"`
                          : "—",
                      ],
                      ["MOQ", `${active.variant.inputs.qty.toLocaleString("en-IN")} pcs`],
                      ["Quality", `${active.variant.inputs.fabricGsm ?? 200} GSM cotton`],
                      ["Colour", "Natural / buyer standard"],
                      ["Variant", active.variant.name],
                    ]}
                  />
                </ReportSection>

                <ReportSection
                  title="Configuration details"
                  subtitle="as configured in the Configuration step"
                >
                  <div className="grid gap-4">
                    {configGroups(active, sheet.nums).map((g) => (
                      <ModuleTable key={g.label} label={g.label} total={g.total} rows={g.rows} />
                    ))}
                  </div>
                </ReportSection>

                <ReportSection title="Costing details">
                  <div className="grid gap-4">
                    <ModuleTable
                      label="Material cost"
                      total={inr(sheet.nums.materialTotal)}
                      totalLabel="Material total"
                      rows={[
                        ["Fabric cost", inr(sheet.nums.fabric)],
                        ["Printing cost", inr(sheet.nums.printing)],
                        ["Embroidery cost", inr(sheet.nums.embroidery)],
                        ["Washing cost", inr(sheet.nums.washing)],
                        ["Manufacturing cost", inr(sheet.nums.manufacturing)],
                        ["Accessories cost", inr(sheet.nums.accessories)],
                        ["Packaging cost", inr(sheet.nums.packagingMaterial)],
                      ]}
                    />
                  </div>
                </ReportSection>
              </div>
            </div>
          </div>

          {/* FIXED — final summary */}
          <div className="shrink-0 border-t border-hairline bg-surface-alt/60 px-6 py-4 lg:px-8">
            <div className="mx-auto max-w-[1000px]">
              <div className="mb-2 flex items-baseline gap-2">
                <span className="text-[12.5px] font-semibold text-ink-900">Final summary</span>
                <span className="text-[11px] text-ink-500">
                  the consolidated figure reviewers approve
                </span>
              </div>
              <div className="rounded-lg border border-hairline bg-ink-900 p-4 text-white">
                <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  <Final label="Product cost" value={inr(sheet.nums.materialTotal)} />
                  <Final label="Grand total" value={inr(sheet.grandTotal)} />
                  <Final label="FX rate" value={`₹${active.variant.inputs.fxRate.toFixed(2)} / $`} />
                  <Final label="Margin %" value={`${(sheet.marginPct * 100).toFixed(1)}%`} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/10 pt-2.5 text-[11.5px] text-white/70">
                  <span>
                    Current status{" "}
                    <span className="text-white">
                      {submitted ? "Pending approval" : "Ready for approval"}
                    </span>
                  </span>
                  <span>
                    Buyer target <span className="text-white">${targetPriceUsd.toFixed(2)}</span>
                  </span>
                  <span>
                    Quoted MOQ{" "}
                    <span className="text-white">
                      {active.variant.inputs.qty.toLocaleString("en-IN")} pcs
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT 30% — approval workflow */}
        <aside className="hidden w-[30%] min-w-[320px] max-w-[430px] shrink-0 overflow-y-auto border-l border-hairline bg-surface lg:block">
          <div className="border-b border-hairline px-5 py-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-ink-500" />
              <div className="text-[13.5px] font-semibold text-ink-900">
                {submitted ? "Approval workflow" : "Approval setup"}
              </div>
            </div>
            <p className="mt-0.5 text-[11.5px] text-ink-500">
              {submitted
                ? "Reviewer assignments are locked while the approval is in progress."
                : "Add reviewers to each milestone to enable Send for approval."}
            </p>
            {submitted && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-[11.5px] text-ink-500">
                  <span>Approval progress</span>
                  <span className="tabular-nums">
                    {approvedCount}/{totalReviewers}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="h-full rounded-full bg-brand-700 transition-all"
                    style={{
                      width: `${(totalReviewers ? approvedCount / totalReviewers : 0) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="px-5 py-4">
            {TEAMS.map((t, i) => (
              <MilestoneCard
                key={t.id}
                team={t}
                index={i}
                last={i === TEAMS.length - 1}
                selected={assign[t.id] ?? []}
                locked={submitted}
                statuses={reviewStatus}
                onToggle={(name: string) =>
                  setAssign((cur) => {
                    const list = cur[t.id] ?? [];
                    return {
                      ...cur,
                      [t.id]: list.includes(name)
                        ? list.filter((x) => x !== name)
                        : [...list, name],
                    };
                  })
                }
              />
            ))}
          </div>
        </aside>

        {/* Extra rails */}
        {rail === "changes" && (
          <ChangesPanel
            changes={changes}
            navPodId={navPodId}
            navArticleId={navArticleId}
            costingRef={srfId}
            onResolve={(id) =>
              setChanges((cur) => cur.map((c) => (c.id === id ? { ...c, status: "Resolved" } : c)))
            }
            onClose={() => setRail(null)}
          />
        )}
        {rail === "revisions" && (
          <RevisionsPanel productName={productName} onClose={() => setRail(null)} />
        )}
        {rail === "copilot" && (
          <CopilotRail
            sheet={sheet}
            targetPriceUsd={targetPriceUsd}
            variantName={active.variant.name}
            onClose={() => setRail(null)}
          />
        )}
      </div>

      {/* Bottom — shared article tabs */}
      <PodArticleTabs
        podId={navPodId}
        activeId={activeArticleId ?? navArticleId}
        stage="Approval"
      />
    </div>
  );
}

/* --------------------------------- pieces -------------------------------- */

function ReportSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="mb-6">
      <button
        onClick={() => setOpen((v) => !v)}
        className="mb-2.5 flex w-full items-center gap-2 text-left"
      >
        <ChevronRight
          className={cn("h-4 w-4 text-ink-400 transition-transform", open && "rotate-90")}
        />
        <h3 className="text-[13.5px] font-semibold uppercase tracking-[0.1em] text-ink-900">
          {title}
        </h3>
        {subtitle && <span className="text-[11.5px] text-ink-500">· {subtitle}</span>}
      </button>
      {open && children}
    </section>
  );
}

function KvTable({ rows }: { rows: [string, string][] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-surface">
      <table className="w-full text-[12.5px]">
        <tbody>
          {rows.map(([k, v], i) => (
            <tr key={k} className={cn(i % 2 === 1 && "bg-surface-alt/40")}>
              <td className="w-[45%] border-b border-hairline px-4 py-2 text-ink-500 last:border-0">
                {k}
              </td>
              <td className="border-b border-hairline px-4 py-2 font-medium text-ink-900">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ModuleTable({
  label,
  rows,
  total,
  totalLabel,
}: {
  label: string;
  rows: [string, string][];
  total?: string;
  totalLabel?: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-surface">
      <div className="border-b border-hairline bg-surface-alt px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-700">
        {label}
      </div>
      <table className="w-full text-[12.5px]">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-b border-hairline last:border-0">
              <td className="w-[58%] px-4 py-1.5 text-ink-500">{k}</td>
              <td className="px-4 py-1.5 text-right tabular-nums text-ink-900">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {total && (
        <div className="flex items-center justify-between border-t border-hairline bg-brand-50/50 px-4 py-2">
          <span className="text-[12px] font-medium text-ink-700">
            {totalLabel ?? `${label} total`}
          </span>
          <span className="tabular-nums text-[13px] font-semibold text-brand-800">{total}</span>
        </div>
      )}
    </div>
  );
}

function Final({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/50">
        {label}
      </div>
      <div className="mt-1 text-[20px] font-semibold tabular-nums leading-tight">{value}</div>
    </div>
  );
}

function personBadge(status?: ReviewStatus) {
  if (status === "approved") return { text: "Approved", cls: "bg-brand-50 text-brand-700" };
  if (status === "changes") return { text: "Changes requested", cls: "bg-red-50 text-red-700" };
  if (status === "pending") return { text: "Pending", cls: "bg-amber-50 text-amber-700" };
  return null;
}

/** One milestone in the vertical approval chain. Status lives on each person. */
function MilestoneCard({
  team,
  index,
  last,
  selected,
  locked,
  statuses,
  onToggle,
}: {
  team: Team;
  index: number;
  last: boolean;
  selected: string[];
  locked: boolean;
  statuses: Record<string, ReviewStatus>;
  onToggle: (name: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const available = team.members.filter((m) => !selected.includes(m));
  const done =
    selected.length > 0 && selected.every((n) => statuses[`${team.id}:${n}`] === "approved");
  const blocked = selected.some((n) => statuses[`${team.id}:${n}`] === "changes");

  return (
    <div className="relative pb-5 pl-9 last:pb-0">
      {/* milestone rail */}
      {!last && (
        <span className="absolute left-[13px] top-7 bottom-0 w-px bg-ink-200" aria-hidden />
      )}
      <span
        className={cn(
          "absolute left-0 top-1 flex h-[27px] w-[27px] items-center justify-center rounded-full border text-[11px] font-semibold tabular-nums",
          done
            ? "border-brand-700 bg-brand-700 text-white"
            : blocked
              ? "border-red-300 bg-red-50 text-red-700"
              : "border-hairline bg-surface text-ink-500",
        )}
      >
        {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
      </span>

      <div
        className={cn(
          "rounded-lg border bg-surface p-3.5",
          done ? "border-brand-200" : blocked ? "border-red-200" : "border-hairline",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[13px] font-semibold text-ink-900">{team.label}</div>
            <div className="text-[11.5px] text-ink-500">{team.note}</div>
          </div>
          {!locked && available.length > 0 && (
            <button
              onClick={() => setAdding((v) => !v)}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-hairline bg-surface px-2 py-1 text-[11.5px] font-medium text-ink-700 hover:bg-surface-alt"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          )}
        </div>

        {/* assigned people — one below another, status per user */}
        <div className="mt-2.5 divide-y divide-hairline border-t border-hairline">
          {selected.length === 0 && (
            <div className="py-2 text-[11.5px] text-ink-400">No reviewer assigned yet</div>
          )}
          {selected.map((name) => {
            const badge = personBadge(statuses[`${team.id}:${name}`]);
            return (
              <div key={name} className="flex items-center justify-between gap-2 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[10.5px] font-semibold text-ink-700">
                    {name
                      .split(" ")
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                  <span className="truncate text-[12.5px] text-ink-900">{name}</span>
                </div>
                {badge ? (
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-medium",
                      badge.cls,
                    )}
                  >
                    {badge.text}
                  </span>
                ) : (
                  <button
                    onClick={() => onToggle(name)}
                    className="shrink-0 rounded p-1 text-ink-400 hover:bg-surface-alt hover:text-ink-900"
                    aria-label={`Remove ${name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {adding && !locked && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {available.map((name) => (
              <button
                key={name}
                onClick={() => {
                  onToggle(name);
                  setAdding(false);
                }}
                className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface px-2.5 py-1 text-[12px] text-ink-600 hover:bg-surface-alt"
              >
                <Plus className="h-3 w-3" /> {name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RailShell({
  title,
  icon,
  onClose,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <aside className="hidden w-[360px] shrink-0 overflow-y-auto border-l border-hairline bg-white xl:block">
      <div className="sticky top-0 flex items-center gap-2 border-b border-hairline bg-white px-4 py-3">
        {icon}
        <div className="text-[13.5px] font-semibold text-ink-900">{title}</div>
        <button
          onClick={onClose}
          className="ml-auto rounded p-1 text-ink-400 hover:bg-surface-alt hover:text-ink-900"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="px-4 py-4">{children}</div>
    </aside>
  );
}

function ChangesPanel({
  changes,
  navPodId,
  navArticleId,
  costingRef,
  onResolve,
  onClose,
}: {
  changes: ChangeRequest[];
  navPodId?: string;
  navArticleId?: string;
  costingRef: string;
  onResolve: (id: string) => void;
  onClose: () => void;
}) {
  const linkFor = (stage: ChangeRequest["stage"]) => {
    if (!navPodId || !navArticleId) return null;
    if (stage === "Product")
      return {
        to: "/product/$podId/$articleId",
        params: { podId: navPodId, articleId: navArticleId },
      } as const;
    if (stage === "Configuration")
      return {
        to: "/config/$podId/$articleId",
        params: { podId: navPodId, articleId: navArticleId },
      } as const;
    return {
      to: "/costing/$id",
      params: { id: costingRef },
      search: { podId: navPodId, articleId: navArticleId },
    } as const;
  };

  return (
    <RailShell
      title={`Changes requested (${changes.filter((c) => c.status === "Open").length})`}
      icon={<MessageSquareWarning className="h-4 w-4 text-red-600" />}
      onClose={onClose}
    >
      <div className="space-y-3">
        {changes.map((c) => {
          const link = linkFor(c.stage);
          return (
            <div
              key={c.id}
              className={cn(
                "rounded-lg border p-3",
                c.status === "Open" ? "border-red-200 bg-red-50/40" : "border-hairline bg-surface",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] font-semibold text-ink-900">{c.reviewer}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10.5px] font-medium",
                    c.status === "Open" ? "bg-red-100 text-red-700" : "bg-brand-50 text-brand-700",
                  )}
                >
                  {c.status}
                </span>
              </div>
              <div className="mt-1 text-[11.5px] text-ink-500">
                {c.stage} · {c.section} · <span className="text-ink-900">{c.field}</span>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-700">{c.comment}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[11px] text-ink-400">{c.at}</span>
                <div className="ml-auto flex items-center gap-1.5">
                  {c.status === "Open" && (
                    <button
                      onClick={() => onResolve(c.id)}
                      className="rounded border border-hairline bg-surface px-2 py-1 text-[11.5px] text-ink-600 hover:bg-surface-alt"
                    >
                      Mark resolved
                    </button>
                  )}
                  {link && (
                    <Link
                      {...link}
                      className="inline-flex items-center gap-1 rounded bg-ink-900 px-2 py-1 text-[11.5px] font-medium text-white hover:bg-ink-800"
                    >
                      Go to field <ChevronRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </RailShell>
  );
}

function RevisionsPanel({ productName, onClose }: { productName: string; onClose: () => void }) {
  const [version, setVersion] = useState("v1");
  const timeline = [
    {
      user: "Gautam K.",
      at: "Today, 09:20",
      stage: "Approval",
      field: "Submitted for approval",
      from: "—",
      to: "v1",
      reason: "Initial submission",
    },
    {
      user: "Gautam K.",
      at: "Yesterday, 18:04",
      stage: "Costing",
      field: "Target margin",
      from: "24.0%",
      to: "26.0%",
      reason: "Aligned to buyer target price",
    },
    {
      user: "Anita R.",
      at: "Yesterday, 16:41",
      stage: "Configuration",
      field: "Fabric GSM",
      from: "180",
      to: "200",
      reason: "Buyer hand-feel requirement",
    },
  ];
  return (
    <RailShell
      title="Revision history"
      icon={<History className="h-4 w-4 text-ink-600" />}
      onClose={onClose}
    >
      <select
        value={version}
        onChange={(e) => setVersion(e.target.value)}
        className="mb-3 w-full rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[12.5px] text-ink-900"
      >
        <option value="v1">v1 · Current submission</option>
      </select>
      <div className="mb-2 text-[11.5px] text-ink-500">{productName} · read-only activity</div>
      <ol className="space-y-3">
        {timeline.map((t, i) => (
          <li key={i} className="relative border-l border-hairline pl-4">
            <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-700" />
            <div className="text-[12.5px] font-medium text-ink-900">{t.field}</div>
            <div className="text-[11.5px] text-ink-500">
              {t.stage} · {t.user} · {t.at}
            </div>
            <div className="mt-1 text-[12px] text-ink-700">
              <span className="text-ink-400 line-through">{t.from}</span> →{" "}
              <span className="font-medium">{t.to}</span>
            </div>
            <div className="text-[11.5px] italic text-ink-500">{t.reason}</div>
          </li>
        ))}
      </ol>
    </RailShell>
  );
}

function CopilotRail({
  sheet,
  targetPriceUsd,
  variantName,
  onClose,
}: {
  sheet: ReturnType<typeof buildCostingSheet>;
  targetPriceUsd: number;
  variantName: string;
  onClose: () => void;
}) {
  const gap = sheet.spUsd - targetPriceUsd;
  const notes = [
    {
      q: "What is being approved?",
      a: `${variantName} at $${sheet.spUsd.toFixed(2)} / pc, ${(sheet.marginPct * 100).toFixed(1)}% margin, grand total ${inr(sheet.grandTotal)}.`,
    },
    {
      q: "Where does the cost sit?",
      a: `Material ${inr(sheet.nums.materialTotal)} (${((sheet.nums.materialTotal / sheet.grandTotal) * 100).toFixed(0)}% of grand total), overheads ${inr(sheet.overheadTotal)}.`,
    },
    {
      q: "Commercial read",
      a:
        gap <= 0
          ? `Quote is $${Math.abs(gap).toFixed(2)} under the buyer target — safe to approve.`
          : `Quote is $${gap.toFixed(2)} above the buyer target — expect a margin question from Management.`,
    },
  ];
  return (
    <RailShell
      title="AI Copilot"
      icon={<Sparkles className="h-4 w-4 text-brand-700" />}
      onClose={onClose}
    >
      <div className="space-y-3">
        {notes.map((n) => (
          <div key={n.q} className="rounded-lg border border-hairline bg-surface p-3">
            <div className="text-[12.5px] font-medium text-ink-900">{n.q}</div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-600">{n.a}</p>
          </div>
        ))}
        <div className="flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50/60 p-3 text-[12px] text-brand-800">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Copilot only explains the submitted report. Nothing here is editable during approval.
        </div>
      </div>
    </RailShell>
  );
}

/* --------------------------- configuration data --------------------------- */

function configGroups(entry: Entry, nums: ReturnType<typeof buildCostingSheet>["nums"]) {
  const i = entry.variant.inputs;
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  return [
    {
      label: "Fabric",
      total: inr(nums.fabric),
      rows: [
        ["Supplier", "Aarav Textiles (in-house)"],
        ["Fabric quality", `${i.fabricGsm ?? 200} GSM cotton`],
        ["Fabric type", "Woven — greige cotton"],
        ["Construction", "60 × 60 / 92 × 88"],
        ["GSM", String(i.fabricGsm ?? 200)],
        ["Width", "58 inch"],
        ["Colour", "Natural / buyer standard"],
        ["Composition", "100% cotton"],
        ["Shrinkage", pct(i.shrinkage)],
        ["Wastage", pct(i.waste)],
        ["Consumption", `${(i.frontMeters + i.backMeters).toFixed(2)} m / pc`],
        ["Greige rate", `${inr(i.greigeCotton)} / m`],
      ] as [string, string][],
    },
    {
      label: "Printing",
      total: inr(nums.printing),
      rows: [
        ["Supplier", "Sri Print House"],
        ["Method", "Reactive screen print"],
        ["Type", "Front panel placement"],
        ["Screen count", "4"],
        ["Printing cost", `${inr(i.reactivePrint)} / m`],
        ["Screen cost", inr(0)],
        ["Print consumption", `${i.frontMeters.toFixed(2)} m / pc`],
      ] as [string, string][],
    },
    {
      label: "Embroidery",
      total: inr(nums.embroidery),
      rows: [
        ["Supplier", i.embroidery > 0 ? "Zari Works" : "Not configured"],
        ["Dots / motifs", i.embroidery > 0 ? "1 motif" : "—"],
        ["Per dot cost", inr(i.embroidery)],
        ["Wastage", pct(i.waste)],
        ["Embroidery cost", `${inr(i.embroidery)} / pc`],
      ] as [string, string][],
    },
    {
      label: "Washing",
      total: inr(nums.washing),
      rows: [
        ["Supplier", "Not configured"],
        ["Wash type", "—"],
        ["Rate per kg", inr(0)],
        ["Weight per pc", "—"],
      ] as [string, string][],
    },
    {
      label: "Manufacturing",
      total: inr(nums.manufacturing),
      rows: [
        ["Supplier", "In-house unit 2"],
        ["Cutting cost", `${inr(i.cutting)} / pc`],
        ["Stitching cost", `${inr(i.stitching)} / pc`],
        ["Setup cost", `${inr(i.setup)} amortised`],
        ["Amortised over", `${i.qty.toLocaleString("en-IN")} pcs`],
      ] as [string, string][],
    },
    {
      label: "Accessories",
      total: inr(nums.accessories),
      rows: [
        ["Trims & labels", `${inr(i.trimsLabels)} / pc`],
        ["Packaging", `${inr(i.packaging)} / pc`],
        [
          "Filling",
          i.fillingWeightG ? `${i.fillingWeightG} g @ ${inr(i.fillingRatePerKg ?? 0)} / kg` : "—",
        ],
        ["Other accessories", inr(0)],
      ] as [string, string][],
    },
  ];
}
