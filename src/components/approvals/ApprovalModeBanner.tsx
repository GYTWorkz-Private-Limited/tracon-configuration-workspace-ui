import { useState } from "react";
import { toast } from "sonner";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ShieldCheck,
  Check,
  RotateCcw,
  Ban,
  Pencil,
  X,
  History,
  ChevronDown,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  approveApproval,
  podRefFor,
  rejectApproval,
  sendBackApproval,
  useApproval,
  type Approval,
} from "@/lib/approvalsStore";
import { ApprovalStatusBadge, PriorityChip } from "./ApprovalStatusBadge";

type Mode = "review" | "edit";

export function ApprovalModeBanner({
  approvalId,
  mode,
}: {
  approvalId: string;
  mode: Mode;
}) {
  const approval = useApproval(approvalId);
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<null | "approve" | "sendback" | "reject">(null);
  const [comment, setComment] = useState("");
  const [showVersions, setShowVersions] = useState(false);

  if (!approval) return null;

  const decided = approval.status !== "pending";
  const editing = mode === "edit" && !decided;

  const toReview = () =>
    navigate({
      to: "/costing/$id",
      params: { id: approval.snapshot.srfId },
      search: { mode: "approved" as const, approvalId },
    });

  const toEdit = () =>
    navigate({
      to: "/costing/$id",
      params: { id: approval.snapshot.srfId },
      search: { mode: "edit" as const, approvalId },
    });

  return (
    <>
      <div
        className={cn(
          "sticky top-0 z-40 border-b backdrop-blur",
          editing
            ? "border-gold-200 bg-gold-50/90"
            : decided
              ? "border-hairline bg-surface/95"
              : "border-brand-700/25 bg-brand-50/85",
        )}
      >
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-2.5 lg:px-6">
          <Link
            to="/quotations"
            className="inline-flex items-center gap-1 text-[11px] text-ink-500 hover:text-ink-900"
          >
            ← Quotations
          </Link>

          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] ring-1",
                editing
                  ? "bg-gold-100 text-gold-700 ring-gold-200"
                  : "bg-brand-700 text-white ring-brand-700",
              )}
            >
              <ShieldCheck className="h-3 w-3" />
              {editing ? "Approval mode · Editing" : "Approval mode"}
            </span>
            <ApprovalStatusBadge status={approval.status} />
            <PriorityChip priority={approval.priority} />
          </div>

          <div className="min-w-0 flex-1 truncate text-[12px] text-ink-700">
            <span className="font-medium text-ink-900">{approval.snapshot.productName}</span>
            <span className="mx-1.5 text-ink-400">·</span>
            {approval.snapshot.articleCode}
            <span className="mx-1.5 text-ink-400">·</span>
            POD {podRefFor(approval.snapshot)}
            <span className="mx-1.5 text-ink-400">·</span>
            Buyer <span className="text-ink-900">{approval.snapshot.buyer}</span>
            <span className="mx-1.5 text-ink-400">·</span>
            by {approval.submittedBy} · {new Date(approval.submittedAt).toLocaleDateString()}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowVersions((v) => !v)}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-hairline bg-surface px-2 text-[11.5px] text-ink-700 hover:bg-surface-alt"
            >
              <History className="h-3 w-3" />v{approval.versions?.length ?? 1}
              <ChevronDown className={cn("h-3 w-3 transition-transform", showVersions && "rotate-180")} />
            </button>

            {decided ? (
              <span className="text-[11px] text-ink-500">
                Decided by {approval.decidedBy} · {new Date(approval.decidedAt!).toLocaleString()}
              </span>
            ) : editing ? (
              <>
                <button
                  onClick={toReview}
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-hairline bg-surface px-2.5 text-[11.5px] font-medium text-ink-700 hover:bg-surface-alt"
                >
                  <X className="h-3 w-3" /> Cancel edits
                </button>
                <button
                  onClick={() => setDialog("approve")}
                  className="inline-flex h-7 items-center gap-1 rounded-md bg-brand-700 px-2.5 text-[11.5px] font-medium text-white hover:bg-brand-800"
                >
                  <Check className="h-3 w-3" /> Save & Approve
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setDialog("reject")}
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-hairline bg-surface px-2.5 text-[11.5px] font-medium text-ink-700 hover:bg-red-50 hover:text-red-700"
                >
                  <Ban className="h-3 w-3" /> Reject
                </button>
                <button
                  onClick={() => setDialog("sendback")}
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-hairline bg-surface px-2.5 text-[11.5px] font-medium text-ink-900 hover:bg-surface-alt"
                >
                  <RotateCcw className="h-3 w-3" /> Send Back
                </button>
                <button
                  onClick={toEdit}
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-brand-700/40 bg-brand-50 px-2.5 text-[11.5px] font-medium text-brand-700 hover:bg-brand-100"
                >
                  <Pencil className="h-3 w-3" /> Edit & Approve
                </button>
                <button
                  onClick={() => setDialog("approve")}
                  className="inline-flex h-7 items-center gap-1 rounded-md bg-brand-700 px-2.5 text-[11.5px] font-medium text-white hover:bg-brand-800"
                >
                  <Check className="h-3 w-3" /> Approve
                </button>
              </>
            )}
          </div>
        </div>

        {showVersions && (
          <div className="mx-auto max-w-[1600px] border-t border-hairline bg-surface px-4 py-2 lg:px-6">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-500">
              Version history
            </div>
            <ul className="mt-1.5 space-y-1">
              {(approval.versions ?? []).map((v, i, arr) => {
                const isFinal =
                  approval.status === "approved" && i === arr.length - 1;
                return (
                  <li key={v.id} className="flex items-center gap-2 text-[11.5px]">
                    <span className="w-10 text-ink-400 tabular-nums">{v.id}</span>
                    <span className="text-ink-900">{v.label}</span>
                    {v.editedBeforeApproval && (
                      <span className="rounded-full bg-gold-50 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-gold-700 ring-1 ring-gold-200">
                        Edited before approval
                      </span>
                    )}
                    {isFinal && (
                      <span className="rounded-full bg-brand-700 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-white">
                        Approved version
                      </span>
                    )}
                    <span className="ml-auto text-ink-500">
                      {v.by} · {new Date(v.at).toLocaleString()}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {approval.status === "sent_back" && approval.revisionComment && (
          <div className="mx-auto max-w-[1600px] border-t border-red-200 bg-red-50/70 px-4 py-2 text-[12px] text-red-900 lg:px-6">
            <span className="mr-1.5 inline-flex items-center gap-1 font-semibold">
              <AlertCircle className="h-3 w-3" /> Revision requested:
            </span>
            {approval.revisionComment}
          </div>
        )}
        {approval.status === "rejected" && approval.rejectReason && (
          <div className="mx-auto max-w-[1600px] border-t border-hairline bg-ink-900/5 px-4 py-2 text-[12px] text-ink-900 lg:px-6">
            <span className="mr-1.5 inline-flex items-center gap-1 font-semibold">
              <Ban className="h-3 w-3" /> Rejected:
            </span>
            {approval.rejectReason}
          </div>
        )}
      </div>

      {dialog === "approve" && (
        <Dialog title={editing ? "Save edits & approve" : "Approve this costing"} onClose={() => setDialog(null)}>
          <p className="text-[12.5px] text-ink-700">
            Confirm approval of <span className="font-medium">{approval.snapshot.productName}</span>{" "}
            (POD {podRefFor(approval.snapshot)}) for {approval.snapshot.buyer}.
            {editing && (
              <span className="mt-2 block rounded-md bg-gold-50 p-2 text-[11.5px] text-gold-700 ring-1 ring-gold-200">
                This will be saved as an <b>edited-before-approval</b> version.
              </span>
            )}
          </p>
          <DialogActions
            onCancel={() => setDialog(null)}
            confirmLabel="Confirm approval"
            confirmIcon={<Check className="h-3 w-3" />}
            confirmTone="brand"
            onConfirm={() => {
              approveApproval(approval.id);
              toast.success("Approved");
              setDialog(null);
              navigate({ to: "/quotations" });
            }}
          />
        </Dialog>
      )}

      {dialog === "sendback" && (
        <Dialog title="Send back for revision" onClose={() => setDialog(null)}>
          <div className="text-[10.5px] uppercase tracking-wider text-ink-500">
            Comments (required) — explain what needs to change
          </div>
          <textarea
            autoFocus
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={5}
            placeholder="e.g. Scenario 2 margin too low. Please recost at 2500 MOQ, evaluate Panipat as secondary supplier, and revisit packaging."
            className="mt-1 w-full resize-none rounded-md border border-hairline bg-surface px-2.5 py-2 text-[12.5px] outline-none focus:border-brand-700"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              "Margin too low",
              "Wrong scenario selected",
              "Recalculate MOQ",
              "Supplier change needed",
              "Missing certifications",
            ].map((s) => (
              <button
                key={s}
                onClick={() => setComment((c) => (c ? `${c}\n• ${s}` : `• ${s}`))}
                className="rounded-full border border-hairline bg-surface px-2 py-0.5 text-[10.5px] text-ink-700 hover:border-brand-700/40 hover:bg-brand-50/60 hover:text-brand-700"
              >
                + {s}
              </button>
            ))}
          </div>
          <DialogActions
            onCancel={() => setDialog(null)}
            confirmLabel="Send back"
            confirmIcon={<RotateCcw className="h-3 w-3" />}
            confirmTone="danger"
            confirmDisabled={comment.trim().length < 12}
            onConfirm={() => {
              sendBackApproval(approval.id, comment.trim());
              toast.success("Sent back for revision");
              setDialog(null);
              navigate({ to: "/quotations" });
            }}
          />
        </Dialog>
      )}

      {dialog === "reject" && (
        <Dialog title="Reject this costing" onClose={() => setDialog(null)}>
          <p className="text-[11.5px] text-ink-500">
            Rejection is terminal — the creator will need to submit a new costing. For minor fixes, use{" "}
            <b>Send Back</b> instead.
          </p>
          <div className="mt-3 text-[10.5px] uppercase tracking-wider text-ink-500">
            Reason (required)
          </div>
          <textarea
            autoFocus
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            placeholder="Why is this being rejected?"
            className="mt-1 w-full resize-none rounded-md border border-hairline bg-surface px-2.5 py-2 text-[12.5px] outline-none focus:border-brand-700"
          />
          <DialogActions
            onCancel={() => setDialog(null)}
            confirmLabel="Reject"
            confirmIcon={<Ban className="h-3 w-3" />}
            confirmTone="danger"
            confirmDisabled={comment.trim().length < 8}
            onConfirm={() => {
              rejectApproval(approval.id, comment.trim());
              toast.success("Rejected");
              setDialog(null);
              navigate({ to: "/quotations" });
            }}
          />
        </Dialog>
      )}
    </>
  );
}

function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink-900/40 p-4">
      <div className="w-full max-w-[520px] rounded-2xl border border-hairline bg-surface p-5 shadow-[0_24px_60px_-20px_rgba(15,20,18,0.35)]">
        <div className="mb-3 flex items-center gap-2">
          <div className="text-[14px] font-semibold text-ink-900">{title}</div>
          <button
            onClick={onClose}
            className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-500 hover:bg-surface-alt hover:text-ink-900"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DialogActions({
  onCancel,
  onConfirm,
  confirmLabel,
  confirmIcon,
  confirmDisabled,
  confirmTone,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirmIcon: React.ReactNode;
  confirmDisabled?: boolean;
  confirmTone: "brand" | "danger";
}) {
  return (
    <div className="mt-4 flex justify-end gap-2">
      <button
        onClick={onCancel}
        className="rounded-md border border-hairline bg-surface px-3 py-1.5 text-[12px] text-ink-700 hover:bg-surface-alt"
      >
        Cancel
      </button>
      <button
        disabled={confirmDisabled}
        onClick={onConfirm}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-40",
          confirmTone === "brand" ? "bg-brand-700 hover:bg-brand-800" : "bg-red-700 hover:bg-red-800",
        )}
      >
        {confirmIcon}
        {confirmLabel}
      </button>
    </div>
  );
}

// Helper used by CostStudio to know whether to render the banner.
export function useApprovalBanner(approvalId?: string): Approval | undefined {
  return useApproval(approvalId ?? "");
}
