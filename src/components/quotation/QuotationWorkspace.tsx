// Quotation Workspace — the commercial layer, end to end.
//
// One screen carries the whole state machine: draft → pending approval → sent
// → buyer response → order, with requoting and versioning available at any
// point after the quote has left the building. Approval lives here rather than
// in a separate module, because approving a price is not a different job from
// preparing one.

import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Download,
  RefreshCw,
  CheckCircle2,
  Send,
  History,
  Lock,
  ThumbsUp,
  Undo2,
  PencilLine,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePod } from "@/lib/podsStore";
import {
  acceptRisk,
  activeLines,
  addArticles,
  addVariantLine,
  approveQuotation,
  blendedMargin,
  convertToOrder,
  driftFor,
  generateRequote,
  logBuyerUpload,
  orderValueUsd,
  recordBuyerResponse,
  rejectLine,
  requestRevision,
  restoreLine,
  reviseQuotation,
  sendForApproval,
  sendableLines,
  setLineMargin,
  setLinePrice,
  updateTerms,
  validateForApproval,
  type BuyerResponse,
  type Quotation,
  type QuotationLine,
} from "@/lib/quotationsStore";
import { QuotationHeaderBand } from "./QuotationHeaderBand";
import { CostRiskBanner } from "./CostRiskBanner";
import { BuyerResponseBar } from "./BuyerResponseBar";
import { QuotedLinesTable } from "./QuotedLinesTable";
import { QuotationContextPanels } from "./QuotationContextPanels";
import { QuotationHistoryPanel } from "./QuotationHistoryPanel";
import { RequoteDrawer } from "./RequoteDrawer";
import { AddLinesDrawer } from "./AddLinesDrawer";
import { AddVariantModal, CostInspector, SendForApprovalModal } from "./QuotationDialogs";

/** The preparer can only edit while the quote is theirs to edit. */
function isEditable(q: Quotation): boolean {
  return q.status === "draft" || q.status === "needs_revision";
}

export function QuotationWorkspace({ quotation }: { quotation: Quotation }) {
  const q = quotation;
  const pod = usePod(q.podId);
  const navigate = useNavigate();

  const [historyOpen, setHistoryOpen] = useState(false);
  const [requoteOpen, setRequoteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [inspect, setInspect] = useState<QuotationLine | null>(null);
  const [variantParent, setVariantParent] = useState<QuotationLine | null>(null);
  const [termsOpen, setTermsOpen] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");
  const [revising, setRevising] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  const editable = isEditable(q);
  const drift = useMemo(() => driftFor(q), [q]);
  const problems = useMemo(() => validateForApproval(q), [q]);
  const value = orderValueUsd(q);
  const margin = blendedMargin(q);
  const contextLines = sendableLines(q);
  const taken = new Set(q.lines.map((l) => l.articleId).filter(Boolean) as string[]);

  const showResponseBar =
    q.status === "sent" ||
    q.status === "accepted" ||
    q.status === "rejected" ||
    q.status === "needs_revision";

  const canConvert = q.response?.outcome === "accepted" && q.status !== "converted_to_order";

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 pb-24">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-400">
        <Link to="/quotations" className="hover:text-ink-900">
          Quotations
        </Link>
        <span aria-hidden>/</span>
        <span className="text-ink-900">{q.id}</span>
        {pod && (
          <>
            <span aria-hidden>·</span>
            <Link to="/pods/$id" params={{ id: pod.id }} className="hover:text-ink-900">
              {pod.id}
            </Link>
          </>
        )}
      </div>

      <QuotationHeaderBand quotation={q} onOpenHistory={() => setHistoryOpen(true)} />

      {/* State-specific bars */}
      {q.status === "pending_approval" && (
        <ApprovalBar
          note={q.approvalNote}
          onApprove={() => approveQuotation(q.id)}
          onRequestRevision={(note) => requestRevision(q.id, note)}
        />
      )}

      {q.status === "needs_revision" && q.revisionNote && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-[12.5px] text-orange-900">
          <strong className="font-semibold">Revision requested:</strong> {q.revisionNote}
        </div>
      )}

      {drift && (
        <CostRiskBanner
          drift={drift}
          accepted={Boolean(q.riskAcceptedAt)}
          sentAt={q.timeline.sentAt}
          onRequote={() => setRequoteOpen(true)}
          onAcceptRisk={(reason) => acceptRisk(q.id, reason)}
        />
      )}

      {showResponseBar && (
        <BuyerResponseBar
          response={q.response}
          onSave={(r: BuyerResponse) => recordBuyerResponse(q.id, r)}
        />
      )}

      {/* Commercial summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Lines quoted" value={String(activeLines(q).length)} />
        <Kpi
          label="Order value"
          value={`$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
        />
        <Kpi
          label="Blended margin"
          value={`${margin.toFixed(1)}%`}
          tone={margin < 12 ? "bad" : margin >= 20 ? "good" : "plain"}
        />
        <Kpi label="Version" value={`v${q.version}`} sub={`${q.versions.length + 1} total`} />
      </div>

      {/* Terms — editable while the quote is a draft */}
      <TermsStrip
        quotation={q}
        editable={editable}
        open={termsOpen}
        onToggle={() => setTermsOpen((v) => !v)}
      />

      <QuotedLinesTable
        quotation={q}
        editable={editable}
        onPrice={(lineId, price) => setLinePrice(q.id, lineId, price)}
        onMargin={(lineId, m) => setLineMargin(q.id, lineId, m)}
        onReject={(lineId, reason) => rejectLine(q.id, lineId, reason)}
        onRestore={(lineId) => restoreLine(q.id, lineId)}
        onAddItems={() => setAddOpen(true)}
        onAddVariant={(parentId) =>
          setVariantParent(q.lines.find((l) => l.id === parentId) ?? null)
        }
        onRevise={() => setRevising(true)}
        onDownload={() => window.print()}
        onUpload={() => uploadRef.current?.click()}
        onInspect={(line) => setInspect(line)}
      />

      {contextLines.length > 0 && <QuotationContextPanels quotation={q} lines={contextLines} />}

      {/* Bottom action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-surface/95 backdrop-blur lg:pl-[236px]">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-2 px-6 py-3 lg:px-10">
          <Link
            to="/quotations"
            className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 py-2 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Quotations
          </Link>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 py-2 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt"
          >
            <Download className="h-3.5 w-3.5" /> Download PDF
          </button>
          <button
            onClick={() => setHistoryOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 py-2 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt"
          >
            <History className="h-3.5 w-3.5" /> Version history
          </button>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {!editable && q.status !== "converted_to_order" && (
              <button
                onClick={() => setRevising(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-amber-600"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Revise Quote
              </button>
            )}
            {q.status !== "draft" && q.status !== "pending_approval" && (
              <button
                onClick={() => setRequoteOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 py-2 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt"
              >
                Generate Requote
              </button>
            )}
            {editable && (
              <button
                onClick={() => setApprovalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-800"
              >
                <Send className="h-3.5 w-3.5" /> Send for Approval
              </button>
            )}
            <button
              disabled={!canConvert}
              onClick={() => {
                convertToOrder(q.id);
                navigate({ to: "/quotations" });
              }}
              title={
                canConvert
                  ? "Convert this accepted quotation into an order"
                  : "Record an Accepted buyer response first"
              }
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Mark as Accepted → Convert to Order
            </button>
          </div>
        </div>
      </div>

      {/* Buyer-returned document. The upload is logged; the commercial
          decision still has to be recorded explicitly above. */}
      <input
        ref={uploadRef}
        type="file"
        accept=".pdf,.xlsx,.xls,.csv,.doc,.docx"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) logBuyerUpload(q.id, file.name);
          e.target.value = "";
          setHistoryOpen(true);
        }}
      />

      {/* Overlays */}
      <QuotationHistoryPanel
        quotation={q}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />
      <RequoteDrawer
        quotation={q}
        open={requoteOpen}
        onClose={() => setRequoteOpen(false)}
        onGenerate={(input) => {
          generateRequote(q.id, input);
          setRequoteOpen(false);
        }}
      />
      <AddLinesDrawer
        pod={pod}
        taken={taken}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={(ids) => addArticles(q.id, ids)}
      />
      <CostInspector
        line={inspect}
        podId={q.podId}
        articleId={inspect?.articleId}
        onClose={() => setInspect(null)}
      />
      <AddVariantModal
        parent={variantParent}
        onClose={() => setVariantParent(null)}
        onAdd={(patch) => {
          if (variantParent) addVariantLine(q.id, variantParent.id, patch);
          setVariantParent(null);
        }}
      />
      <SendForApprovalModal
        open={approvalOpen}
        problems={problems}
        lineCount={sendableLines(q).length}
        orderValueUsd={value}
        marginPct={margin}
        onClose={() => setApprovalOpen(false)}
        onSubmit={(note) => {
          sendForApproval(q.id, note || undefined);
          setApprovalOpen(false);
        }}
      />

      {revising && (
        <ReviseModal
          version={q.version}
          note={revisionNote}
          setNote={setRevisionNote}
          onClose={() => setRevising(false)}
          onConfirm={() => {
            reviseQuotation(q.id, revisionNote.trim() || "Revision opened");
            setRevisionNote("");
            setRevising(false);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ApprovalBar({
  note,
  onApprove,
  onRequestRevision,
}: {
  note?: string;
  onApprove: () => void;
  onRequestRevision: (note: string) => void;
}) {
  const [asking, setAsking] = useState(false);
  const [text, setText] = useState("");

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <Lock className="h-4 w-4 shrink-0 text-amber-700" aria-hidden />
        <p className="min-w-0 flex-1 text-[12.5px] text-amber-900">
          <strong className="font-semibold">Pending commercial approval.</strong> The quotation is
          read-only to the preparer. Approval covers price only — manufacturing cost was approved at
          the costing stage.
          {note && <span className="mt-0.5 block italic">“{note}”</span>}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setAsking((v) => !v)}
            className="rounded-md border border-hairline bg-surface px-3 py-2 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt"
          >
            <Undo2 className="mr-1 inline h-3.5 w-3.5" /> Request revision
          </button>
          <button
            onClick={onApprove}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-emerald-700"
          >
            <ThumbsUp className="h-3.5 w-3.5" /> Approve & release to buyer
          </button>
        </div>
      </div>

      {asking && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-hairline bg-surface p-3">
          <label htmlFor="revision-ask" className="sr-only">
            What needs to change?
          </label>
          <input
            id="revision-ask"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What needs to change before this can be approved?"
            className="min-w-[260px] flex-1 rounded-md border border-hairline bg-surface px-2.5 py-2 text-[12.5px] text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
          />
          <button
            disabled={text.trim().length < 4}
            onClick={() => {
              onRequestRevision(text.trim());
              setAsking(false);
              setText("");
            }}
            className="rounded-md bg-ink-900 px-3 py-2 text-[12.5px] font-medium text-white hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send back to preparer
          </button>
        </div>
      )}
    </div>
  );
}

function TermsStrip({
  quotation: q,
  editable,
  open,
  onToggle,
}: {
  quotation: Quotation;
  editable: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <section className="rounded-lg border border-hairline bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Term label="Incoterm" value={q.terms.incoterm} />
        <Term label="Payment" value={q.terms.payment} />
        <Term label="Delivery" value={q.terms.delivery} />
        <Term label="Certifications" value={q.terms.certifications.join(" · ") || "—"} />
        {editable && (
          <button
            onClick={onToggle}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink-700 hover:bg-surface-alt"
          >
            <PencilLine className="h-3.5 w-3.5" /> {open ? "Done" : "Edit terms"}
          </button>
        )}
      </div>

      {open && editable && (
        <div className="mt-3 grid gap-3 border-t border-hairline pt-3 sm:grid-cols-2 lg:grid-cols-4">
          <TermInput
            id="term-incoterm"
            label="Incoterm"
            value={q.terms.incoterm}
            onCommit={(v) => updateTerms(q.id, { incoterm: v })}
          />
          <TermInput
            id="term-payment"
            label="Payment terms"
            value={q.terms.payment}
            onCommit={(v) => updateTerms(q.id, { payment: v })}
          />
          <TermInput
            id="term-delivery"
            label="Delivery window"
            value={q.terms.delivery}
            onCommit={(v) => updateTerms(q.id, { delivery: v })}
          />
          <TermInput
            id="term-certs"
            label="Certifications (comma separated)"
            value={q.terms.certifications.join(", ")}
            onCommit={(v) =>
              updateTerms(q.id, {
                certifications: v
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>
      )}
    </section>
  );
}

function Term({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.12em] text-ink-400">{label}</div>
      <div className="text-[12.5px] font-medium text-ink-900">{value}</div>
    </div>
  );
}

function TermInput({
  id,
  label,
  value,
  onCommit,
}: {
  id: string;
  label: string;
  value: string;
  onCommit: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <div>
      <label htmlFor={id} className="text-[10px] uppercase tracking-[0.12em] text-ink-400">
        {label}
      </label>
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== value && onCommit(draft)}
        className="mt-1 w-full rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[12.5px] text-ink-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
      />
    </div>
  );
}

function ReviseModal({
  version,
  note,
  setNote,
  onClose,
  onConfirm,
}: {
  version: number;
  note: string;
  setNote: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Revise quotation"
    >
      <button className="absolute inset-0 bg-ink-900/40" aria-label="Close" onClick={onClose} />
      <div className="relative w-full max-w-[440px] rounded-xl border border-hairline bg-surface shadow-2xl">
        <header className="border-b border-hairline px-5 py-4">
          <h2 className="text-[15px] font-semibold text-ink-900">Open revision v{version + 1}</h2>
          <p className="mt-0.5 text-[12px] text-ink-500">
            v{version} is archived in full and stays viewable. Nothing is overwritten.
          </p>
        </header>
        <div className="px-5 py-4">
          <label htmlFor="revise-note" className="text-[12px] font-medium text-ink-700">
            What is changing?
          </label>
          <textarea
            id="revise-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Buyer countered at $21.40 — reworking MOQ tiers."
            className="mt-1.5 w-full rounded-md border border-hairline bg-surface px-3 py-2 text-[12.5px] text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
          />
        </div>
        <footer className="flex justify-end gap-2 border-t border-hairline px-5 py-3.5">
          <button
            onClick={onClose}
            className="rounded-md border border-hairline bg-surface px-3 py-2 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-amber-700"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Open v{version + 1}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone = "plain",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "plain" | "good" | "bad";
}) {
  return (
    <div className="rounded-lg border border-hairline bg-surface px-4 py-3">
      <div className="text-[10.5px] uppercase tracking-[0.12em] text-ink-400">{label}</div>
      <div
        className={cn(
          "mt-1 text-[22px] font-semibold leading-none tabular-nums",
          tone === "bad" ? "text-rose-600" : tone === "good" ? "text-emerald-700" : "text-ink-900",
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-[11px] text-ink-400">{sub}</div>}
    </div>
  );
}
