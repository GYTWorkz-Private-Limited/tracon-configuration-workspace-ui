import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  X,
  Send,
  Save,
  Paperclip,
  Calendar,
  User,
  Mail,
  Sparkles,
  Upload,
} from "lucide-react";
import {
  podRefFor,
  submitApproval,
  type ApprovalSnapshot,
  type ApprovalPriority,
  type ApprovalAttachment,
} from "@/lib/approvalsStore";
import {
  ProductSummary,
  ConfigurationSummary,
  CostSummary,
  AISummary,
  HistoricalComparison,
  AttachmentsList,
} from "./ApprovalSummary";

const APPROVERS = ["Meera K.", "Rohit P.", "Anil D.", "Sana V.", "Karthik R."];

export function SubmitApprovalModal({
  open,
  onClose,
  snapshot,
}: {
  open: boolean;
  onClose: () => void;
  snapshot: ApprovalSnapshot;
}) {
  const navigate = useNavigate();
  const [approvers, setApprovers] = useState<string[]>(["Meera K."]);
  const [cc, setCc] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<ApprovalPriority>("normal");
  const [dueDate, setDueDate] = useState("");
  const [attachments, setAttachments] = useState<ApprovalAttachment[]>([]);

  if (!open) return null;

  const toggleApprover = (name: string) => {
    setApprovers((cur) => (cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name]));
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const items: ApprovalAttachment[] = files.map((f) => ({
      id: `at-${Date.now()}-${f.name}`,
      name: f.name,
      kind: f.name.split(".").pop() ?? "file",
      size: `${(f.size / 1024).toFixed(0)} KB`,
    }));
    setAttachments((cur) => [...cur, ...items]);
    e.target.value = "";
  };

  const send = () => {
    if (approvers.length === 0) {
      toast.error("Please select at least one approver");
      return;
    }
    const created = submitApproval({
      priority,
      submittedBy: "Gautam Kitclu",
      approvers,
      cc: cc.split(",").map((s) => s.trim()).filter(Boolean),
      notes,
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      snapshot,
      attachments,
    });
    toast.success(`Sent for costing sign-off — ${created.id}`);
    onClose();
    navigate({ to: "/quotations" });
  };

  const saveDraft = () => {
    toast.success("Draft saved");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-hairline bg-surface px-6">
        <button
          onClick={onClose}
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[12.5px] text-ink-500 hover:bg-surface-alt hover:text-ink-900"
        >
          <X className="h-3.5 w-3.5" /> Cancel
        </button>
        <span className="text-ink-300">/</span>
        <div className="flex items-center gap-2">
          <Send className="h-4 w-4 text-ink-700" />
          <div className="text-[14px] font-medium text-ink-900">Submit for Approval</div>
          <span className="text-[12px] text-ink-500">
            · {snapshot.productName} · POD {podRefFor(snapshot)}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={saveDraft}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt"
          >
            <Save className="h-3.5 w-3.5" /> Save Draft
          </button>
          <button
            onClick={send}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-700 px-3.5 text-[12.5px] font-medium text-white hover:bg-brand-800"
          >
            <Send className="h-3.5 w-3.5" /> Send for Approval
          </button>
        </div>
      </div>

      {/* Body — 2 columns */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-6 p-6 lg:grid-cols-[380px_1fr]">
          {/* LEFT — Approval Info form */}
          <div className="space-y-4">
            <div className="rounded-xl border border-hairline bg-surface p-4">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brand-700">
                Approval Information
              </div>
              <div className="mt-3 space-y-3">
                <Field label="Approvers" icon={User}>
                  <select
                    value=""
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v && !approvers.includes(v)) setApprovers((cur) => [...cur, v]);
                    }}
                    className="w-full rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[12.5px] outline-none focus:border-brand-700"
                  >
                    <option value="">Select approver…</option>
                    {APPROVERS.filter((a) => !approvers.includes(a)).map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                  {approvers.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {approvers.map((a) => (
                        <li
                          key={a}
                          className="flex items-center gap-2 rounded-md border border-hairline bg-surface-alt/50 px-2 py-1.5"
                        >
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-brand-700 to-brand-500 text-[9px] font-medium text-white">
                            {a
                              .split(" ")
                              .map((p) => p[0])
                              .join("")
                              .slice(0, 2)}
                          </span>
                          <span className="flex-1 text-[12.5px] text-ink-900">{a}</span>
                          <button
                            onClick={() => toggleApprover(a)}
                            className="rounded p-0.5 text-ink-400 hover:bg-surface hover:text-ink-900"
                            aria-label={`Remove ${a}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </Field>

                <Field label="CC (optional)" icon={Mail}>
                  <input
                    value={cc}
                    onChange={(e) => setCc(e.target.value)}
                    placeholder="email, email…"
                    className="w-full rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[12.5px] outline-none focus:border-brand-700"
                  />
                </Field>

                <Field label="Priority" icon={Sparkles}>
                  <div className="flex gap-1.5">
                    {(["normal", "high", "urgent"] as ApprovalPriority[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPriority(p)}
                        className={cn(
                          "flex-1 rounded-md border px-2.5 py-1.5 text-[11.5px] font-medium capitalize",
                          priority === p
                            ? p === "urgent"
                              ? "border-red-700 bg-red-50 text-red-700"
                              : p === "high"
                                ? "border-gold-700 bg-gold-50 text-gold-700"
                                : "border-brand-700 bg-brand-50 text-brand-700"
                            : "border-hairline bg-surface text-ink-500 hover:text-ink-900",
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Due Date" icon={Calendar}>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[12.5px] outline-none focus:border-brand-700"
                  />
                </Field>

                <Field label="Approval Notes">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    placeholder="Context for the approver — target margin, buyer sensitivity, key trade-offs…"
                    className="w-full resize-none rounded-md border border-hairline bg-surface px-2.5 py-2 text-[12.5px] outline-none focus:border-brand-700"
                  />
                </Field>
              </div>
            </div>

            <div className="rounded-xl border border-hairline bg-surface p-4">
              <div className="mb-3 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brand-700">
                <Paperclip className="h-3 w-3" /> Attachments
              </div>
              <label className="mb-2 flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-hairline bg-surface-alt/40 px-3 py-3 text-[11.5px] text-ink-500 hover:bg-surface-alt">
                <Upload className="h-3.5 w-3.5" />
                <span>Click to attach files</span>
                <input type="file" multiple className="hidden" onChange={handleFilePick} />
              </label>
              <AttachmentsList
                items={attachments}
                onRemove={(id) => setAttachments((cur) => cur.filter((a) => a.id !== id))}
              />
            </div>
          </div>

          {/* RIGHT — Submission Preview */}
          <div className="space-y-4">
            <div className="rounded-xl border border-brand-700/20 bg-brand-50/30 px-4 py-2.5 text-[11.5px] text-brand-700">
              Review what the approver will see. Nothing here is editable.
            </div>
            <ProductSummary snapshot={snapshot} />
            <ConfigurationSummary snapshot={snapshot} />
            <CostSummary snapshot={snapshot} />
            <AISummary snapshot={snapshot} />
            <HistoricalComparison snapshot={snapshot} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: typeof User;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-[10.5px] font-medium uppercase tracking-wider text-ink-500">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      {children}
    </div>
  );
}
