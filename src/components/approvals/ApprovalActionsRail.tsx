import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, RotateCcw, Wand2, X, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  approveApproval,
  overrideAndApprove,
  sendBackApproval,
  type Approval,
  type ApprovalKitLine,
} from "@/lib/approvalsStore";

const OVERRIDE_FIELDS: {
  key: string;
  label: string;
  unit?: string;
  from: (a: Approval) => string;
}[] = [
  {
    key: "Selling Price",
    label: "Selling Price",
    unit: "$",
    from: (a) => `$${a.snapshot.sellingPrice.toFixed(2)}`,
  },
  {
    key: "Target Margin",
    label: "Target Margin",
    unit: "%",
    from: (a) => `${a.snapshot.margin.toFixed(1)}%`,
  },
  {
    key: "Final Margin",
    label: "Final Margin",
    unit: "%",
    from: (a) => `${a.snapshot.margin.toFixed(1)}%`,
  },
  { key: "MOQ / Order Quantity", label: "MOQ / Order Qty", from: (a) => a.snapshot.moq },
  { key: "Discount", label: "Discount", unit: "%", from: () => "0.0%" },
  { key: "Commercial Notes", label: "Commercial Notes", from: () => "—" },
];

/**
 * The same three levers, per kit member. Field keys are prefixed with the
 * member's name so each override lands in the shared audit trail as its own
 * line — original value, new value, reason, user, timestamp — instead of the
 * trail assuming one article.
 */
const KIT_LINE_FIELDS: {
  key: string;
  label: string;
  unit?: string;
  from: (l: ApprovalKitLine) => string;
}[] = [
  {
    key: "Selling Price",
    label: "Selling Price",
    unit: "$",
    from: (l) => `$${l.sellingPrice.toFixed(2)}`,
  },
  { key: "Margin", label: "Margin", unit: "%", from: (l) => `${l.margin.toFixed(1)}%` },
  { key: "MOQ / Order Quantity", label: "MOQ / Order Qty", from: (l) => l.moq },
];

export function ApprovalActionsRail({ approval }: { approval: Approval }) {
  const kitLines = approval.snapshot.kitItems ?? [];
  const [openLines, setOpenLines] = useState<Set<string>>(
    () => new Set(kitLines.map((l) => l.articleId)),
  );
  const [action, setAction] = useState<null | "approve" | "sendback" | "override">(null);
  const [comment, setComment] = useState("");
  const [reason, setReason] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});

  const decided = approval.status !== "pending";

  if (decided) {
    return (
      <div className="rounded-xl border border-hairline bg-surface p-4">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brand-700">
          Decision
        </div>
        {approval.status === "approved" ? (
          <div className="mt-3 rounded-md border border-brand-700/20 bg-brand-50/40 p-3">
            <div className="flex items-center gap-2 text-brand-700">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-[13px] font-semibold">Approved</span>
            </div>
            <div className="mt-1 text-[11.5px] text-ink-500">
              by {approval.decidedBy} · {new Date(approval.decidedAt!).toLocaleString()}
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50/60 p-3">
            <div className="flex items-center gap-2 text-red-700">
              <RotateCcw className="h-4 w-4" />
              <span className="text-[13px] font-semibold">Sent back for revision</span>
            </div>
            <div className="mt-1 text-[11.5px] text-ink-500">
              by {approval.decidedBy} · {new Date(approval.decidedAt!).toLocaleString()}
            </div>
            {approval.revisionComment && (
              <div className="mt-2 text-[12px] text-ink-900">"{approval.revisionComment}"</div>
            )}
          </div>
        )}
        {approval.overrides.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-ink-500">
              Overrides applied
            </div>
            {approval.overrides.map((o, i) => (
              <div
                key={i}
                className="rounded-md border border-hairline bg-surface p-2 text-[11.5px]"
              >
                <div className="font-medium text-ink-900">{o.field}</div>
                <div className="text-ink-500">
                  {o.from} → <span className="text-ink-900">{o.to}</span>
                </div>
                <div className="mt-0.5 text-[10.5px] italic text-ink-500">"{o.reason}"</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-hairline bg-surface p-4">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brand-700">
        Approval actions
      </div>
      <p className="mt-1.5 text-[11.5px] text-ink-500">
        Approve, send back with comments, or override commercial values before approving.
      </p>

      <div className="mt-3 space-y-2">
        <button
          onClick={() => setAction("approve")}
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-brand-700 px-3 py-2 text-[12.5px] font-medium text-white hover:bg-brand-800"
        >
          <Check className="h-3.5 w-3.5" /> Approve
        </button>
        <button
          onClick={() => setAction("sendback")}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-hairline bg-surface px-3 py-2 text-[12.5px] font-medium text-ink-900 hover:bg-surface-alt"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Send Back for Revision
        </button>
        <button
          onClick={() => setAction("override")}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-brand-700/30 bg-brand-50 px-3 py-2 text-[12.5px] font-medium text-brand-700 hover:bg-brand-100"
        >
          <Wand2 className="h-3.5 w-3.5" /> Override & Approve
        </button>
      </div>

      {/* Approve dialog */}
      {action === "approve" && (
        <ActionDialog title="Approve this costing" onClose={() => setAction(null)}>
          <p className="text-[12.5px] text-ink-700">
            Confirm approval of <span className="font-medium">{approval.snapshot.productName}</span>{" "}
            at selling price{" "}
            <span className="font-medium">${approval.snapshot.sellingPrice.toFixed(2)}</span> (
            {approval.snapshot.margin.toFixed(1)}% margin).
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setAction(null)}
              className="rounded-md border border-hairline bg-surface px-3 py-1.5 text-[12px] text-ink-700 hover:bg-surface-alt"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                approveApproval(approval.id);
                toast.success("Approved");
                setAction(null);
              }}
              className="inline-flex items-center gap-1 rounded-md bg-brand-700 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-brand-800"
            >
              <Check className="h-3 w-3" /> Confirm approval
            </button>
          </div>
        </ActionDialog>
      )}

      {/* Send back dialog */}
      {action === "sendback" && (
        <ActionDialog title="Send back for revision" onClose={() => setAction(null)}>
          <div className="text-[10.5px] uppercase tracking-wider text-ink-500">
            Revision comments (required)
          </div>
          <textarea
            autoFocus
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            placeholder="e.g. Margin too low — recalculate at 2500 MOQ and evaluate Panipat as secondary supplier."
            className="mt-1 w-full resize-none rounded-md border border-hairline bg-surface px-2.5 py-2 text-[12.5px] outline-none focus:border-brand-700"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {["Margin too low", "Supplier issue", "Recalculate MOQ", "Packaging needs review"].map(
              (s) => (
                <button
                  key={s}
                  onClick={() => setComment((c) => (c ? `${c}\n• ${s}` : `• ${s}`))}
                  className="rounded-full border border-hairline bg-surface px-2 py-0.5 text-[10.5px] text-ink-700 hover:border-brand-700/40 hover:bg-brand-50/60 hover:text-brand-700"
                >
                  + {s}
                </button>
              ),
            )}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setAction(null)}
              className="rounded-md border border-hairline bg-surface px-3 py-1.5 text-[12px] text-ink-700 hover:bg-surface-alt"
            >
              Cancel
            </button>
            <button
              disabled={!comment.trim()}
              onClick={() => {
                sendBackApproval(approval.id, comment.trim());
                toast.success("Sent back for revision");
                setAction(null);
              }}
              className="inline-flex items-center gap-1 rounded-md bg-red-700 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-red-800 disabled:opacity-40"
            >
              <RotateCcw className="h-3 w-3" /> Send back
            </button>
          </div>
        </ActionDialog>
      )}

      {/* Override dialog */}
      {action === "override" && (
        <ActionDialog title="Override & approve" onClose={() => setAction(null)}>
          <p className="text-[11.5px] text-ink-500">
            Set new commercial values. Only fields you change are recorded. A reason is required.
          </p>

          {/* A set is approved as one price built from several articles, so
              each member gets its own row block — same levers, own audit line. */}
          {kitLines.length > 0 && (
            <div className="mt-3 space-y-2">
              {kitLines.map((line) => {
                const openLine = openLines.has(line.articleId);
                return (
                  <div
                    key={line.articleId}
                    className="overflow-hidden rounded-md border border-hairline"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setOpenLines((prev) => {
                          const next = new Set(prev);
                          if (next.has(line.articleId)) next.delete(line.articleId);
                          else next.add(line.articleId);
                          return next;
                        })
                      }
                      aria-expanded={openLine}
                      className="flex w-full items-center gap-2 bg-surface-alt/60 px-2.5 py-1.5 text-left"
                    >
                      <ChevronDown
                        className={cn(
                          "h-3 w-3 text-ink-400 transition-transform",
                          !openLine && "-rotate-90",
                        )}
                        aria-hidden
                      />
                      <span className="text-[11.5px] font-semibold text-ink-900">{line.name}</span>
                      <span className="ml-auto text-[10.5px] tabular-nums text-ink-500">
                        ${line.sellingPrice.toFixed(2)} · {line.margin.toFixed(1)}% · {line.moq}
                      </span>
                    </button>
                    {openLine && (
                      <div className="space-y-2 px-2.5 py-2">
                        {KIT_LINE_FIELDS.map((f) => {
                          const key = `${line.name} · ${f.key}`;
                          return (
                            <div
                              key={key}
                              className="grid grid-cols-[110px_92px_1fr] items-center gap-2"
                            >
                              <div className="text-[11.5px] font-medium text-ink-900">
                                {f.label}
                              </div>
                              <div className="text-[11px] tabular-nums text-ink-500">
                                from {f.from(line)}
                              </div>
                              <input
                                value={values[key] ?? ""}
                                onChange={(e) =>
                                  setValues((v) => ({ ...v, [key]: e.target.value }))
                                }
                                placeholder={f.unit ? `New value ${f.unit}` : "New value"}
                                className="rounded-md border border-hairline bg-surface px-2 py-1 text-[12px] outline-none focus:border-brand-700"
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-500">
                Kit-level totals
              </div>
            </div>
          )}

          <div className="mt-3 space-y-2">
            {OVERRIDE_FIELDS.map((f) => (
              <div key={f.key} className="grid grid-cols-[120px_100px_1fr] items-center gap-2">
                <div className="text-[11.5px] font-medium text-ink-900">{f.label}</div>
                <div className="text-[11px] text-ink-500 tabular-nums">from {f.from(approval)}</div>
                <input
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  placeholder={f.unit ? `New value ${f.unit}` : "New value"}
                  className="rounded-md border border-hairline bg-surface px-2 py-1 text-[12px] outline-none focus:border-brand-700"
                />
              </div>
            ))}
          </div>
          <div className="mt-3">
            <div className="text-[10.5px] uppercase tracking-wider text-ink-500">
              Override reason (required)
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Why is this override justified?"
              className="mt-1 w-full resize-none rounded-md border border-hairline bg-surface px-2.5 py-2 text-[12.5px] outline-none focus:border-brand-700"
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setAction(null)}
              className="rounded-md border border-hairline bg-surface px-3 py-1.5 text-[12px] text-ink-700 hover:bg-surface-alt"
            >
              Cancel
            </button>
            <button
              disabled={!reason.trim() || Object.values(values).every((v) => !v.trim())}
              onClick={() => {
                const changes = [
                  ...kitLines.flatMap((line) =>
                    KIT_LINE_FIELDS.filter((f) =>
                      (values[`${line.name} · ${f.key}`] ?? "").trim(),
                    ).map((f) => ({
                      field: `${line.name} · ${f.key}`,
                      from: f.from(line),
                      to: values[`${line.name} · ${f.key}`].trim(),
                      reason: reason.trim(),
                    })),
                  ),
                  ...OVERRIDE_FIELDS.filter((f) => (values[f.key] ?? "").trim()).map((f) => ({
                    field: f.key,
                    from: f.from(approval),
                    to: values[f.key].trim(),
                    reason: reason.trim(),
                  })),
                ];
                if (changes.length === 0) {
                  toast.error("Change at least one field");
                  return;
                }
                overrideAndApprove(approval.id, changes);
                toast.success("Overridden & approved");
                setAction(null);
              }}
              className="inline-flex items-center gap-1 rounded-md bg-brand-700 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-brand-800 disabled:opacity-40"
            >
              <Wand2 className="h-3 w-3" /> Save & Approve
            </button>
          </div>
          <div className="mt-2 flex items-start gap-1 text-[10.5px] text-ink-500">
            <AlertCircle className="mt-0.5 h-2.5 w-2.5" />
            <span>
              Every override stores original value, new value, reason, user and timestamp.
            </span>
          </div>
        </ActionDialog>
      )}
    </div>
  );
}

function ActionDialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4 animate-fade-in">
      <div
        className={cn(
          "w-full max-w-[520px] rounded-2xl border border-hairline bg-surface p-5 shadow-[0_24px_60px_-20px_rgba(15,20,18,0.35)]",
        )}
      >
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
