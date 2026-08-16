/**
 * Version history, comments and the audit trail for one POD's quotation.
 *
 * Three tabs rather than three screens, because they answer one question
 * between them: "how did this quotation get to where it is". Versions are what
 * was sent, comments are what people said about a version, and the audit is
 * every change anybody made along the way.
 *
 * Read-only over `quotationHistory` — nothing is computed here.
 */

import { useState } from "react";
import { ClipboardList, History, MessageSquare, Send, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { usd } from "@/lib/commercialProvisions";
import {
  STATUS_LABEL,
  addQuotationComment,
  removeQuotationComment,
  useQuotationHistory,
  workingVersionNo,
  type QuotationVersion,
  type VersionStatus,
} from "@/lib/quotationHistory";

type Tab = "versions" | "comments" | "audit";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "versions", label: "Versions", icon: History },
  { id: "comments", label: "Comments", icon: MessageSquare },
  { id: "audit", label: "Audit trail", icon: ClipboardList },
];

export function QuotationHistoryPanel({
  quotationId,
  onClose,
  onNewVersion,
}: {
  quotationId: string;
  onClose: () => void;
  /** offered on a sent quotation — re-open it for re-costing as the next version */
  onNewVersion?: () => void;
}) {
  const history = useQuotationHistory(quotationId);
  const [tab, setTab] = useState<Tab>("versions");

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Quotation history"
    >
      <button className="absolute inset-0 bg-ink-900/40" aria-label="Close" onClick={onClose} />

      <aside className="relative flex h-full w-full max-w-[520px] flex-col border-l border-hairline bg-surface shadow-2xl">
        <header className="flex shrink-0 items-start gap-3 border-b border-hairline px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-ink-900">Quotation history</h2>
            <p className="mt-0.5 text-[11.5px] text-ink-500">
              {history.versions.length === 0
                ? "No version has been sent yet — the working quotation becomes version 1 when it goes for approval."
                : `${history.versions.length} version${history.versions.length === 1 ? "" : "s"} sent · working on version ${workingVersionNo(history)}`}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto shrink-0 rounded-md p-1.5 text-ink-500 hover:bg-surface-alt hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex shrink-0 gap-1 border-b border-hairline px-3 py-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
                tab === t.id
                  ? "bg-brand-50 text-brand-700"
                  : "text-ink-500 hover:bg-surface-alt hover:text-ink-900",
              )}
            >
              <t.icon className="h-3.5 w-3.5" aria-hidden /> {t.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {tab === "versions" && (
            <VersionList versions={history.versions} onNewVersion={onNewVersion} />
          )}
          {tab === "comments" && (
            <Comments
              quotationId={quotationId}
              versionNo={
                history.versions[history.versions.length - 1]?.no ?? workingVersionNo(history)
              }
              comments={history.comments}
            />
          )}
          {tab === "audit" && <AuditTrail entries={history.audit} />}
        </div>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Versions
 * ------------------------------------------------------------------ */

function VersionList({
  versions,
  onNewVersion,
}: {
  versions: QuotationVersion[];
  onNewVersion?: () => void;
}) {
  if (versions.length === 0) {
    return (
      <p className="py-10 text-center text-[12.5px] text-ink-500">
        Nothing has been sent for approval yet. Version history starts with the first version you
        send.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {onNewVersion && (
        <button
          type="button"
          onClick={onNewVersion}
          className="flex w-full items-center gap-2 rounded-lg border border-dashed border-brand-600 bg-brand-50/50 px-3.5 py-2.5 text-left text-[12.5px] font-semibold text-brand-700 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
        >
          <Send className="h-3.5 w-3.5" aria-hidden />
          Re-cost and create version {versions.length + 1}
        </button>
      )}

      {[...versions].reverse().map((v) => (
        <article key={v.id} className="overflow-hidden rounded-lg border border-hairline">
          <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-hairline bg-surface-alt px-3.5 py-2.5">
            <h3 className="text-[13px] font-semibold text-ink-900">Version {v.no}</h3>
            <VersionStatusPill status={v.status} />
            <span className="ml-auto text-[15px] font-semibold tabular-nums text-ink-900">
              {usd(v.orderValueUsd, 0)}
            </span>
          </header>

          <div className="px-3.5 py-2 text-[11.5px] text-ink-500">
            Sent by {v.sentBy} · {new Date(v.sentAt).toLocaleString()} · blended margin{" "}
            {v.blendedMarginPct.toFixed(1)}%
          </div>

          <ul className="border-t border-hairline">
            {v.lines.map((l, i) => (
              <li
                key={`${l.name}-${i}`}
                className="flex flex-wrap items-baseline gap-x-2 border-b border-hairline/70 px-3.5 py-2 text-[12px] last:border-b-0"
              >
                <span className="font-medium text-ink-900">{l.name}</span>
                <span className="text-[11px] text-ink-500">{l.quantityLabel}</span>
                <span className="ml-auto tabular-nums text-ink-700">
                  {usd(l.sellingUsd)} · {l.marginPct.toFixed(1)}%
                </span>
                <span className="w-full text-right text-[11px] tabular-nums text-ink-400">
                  {usd(l.orderValueUsd, 0)}
                </span>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

export function VersionStatusPill({ status }: { status: VersionStatus }) {
  const tone: Record<VersionStatus, string> = {
    sent: "bg-brand-50 text-brand-700",
    approved: "bg-brand-700 text-white",
    changes_requested: "bg-amber-50 text-amber-900",
    superseded: "bg-ink-100 text-ink-600",
  };
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em]",
        tone[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Comments
 * ------------------------------------------------------------------ */

function Comments({
  quotationId,
  versionNo,
  comments,
}: {
  quotationId: string;
  versionNo: number;
  comments: { id: string; at: string; by: string; text: string; versionNo: number }[];
}) {
  const [text, setText] = useState("");

  const post = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    addQuotationComment(quotationId, versionNo, text);
    setText("");
  };

  return (
    <div className="space-y-3">
      <form onSubmit={post}>
        <label htmlFor="q-comment" className="sr-only">
          Comment on version {versionNo}
        </label>
        <textarea
          id="q-comment"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Comment on version ${versionNo} — why the price moved, what the buyer asked for…`}
          className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-[12.5px] text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            disabled={!text.trim()}
            className="rounded-md bg-brand-700 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            Add comment
          </button>
        </div>
      </form>

      {comments.length === 0 ? (
        <p className="py-8 text-center text-[12.5px] text-ink-500">No comments yet.</p>
      ) : (
        <ul className="space-y-2">
          {[...comments].reverse().map((c) => (
            <li key={c.id} className="rounded-lg border border-hairline bg-surface px-3.5 py-2.5">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[12.5px] font-medium text-ink-900">{c.by}</span>
                <span className="text-[11px] text-ink-400">
                  v{c.versionNo} · {new Date(c.at).toLocaleString()}
                </span>
                {/* Anything a user can add, a user can take back. */}
                <button
                  type="button"
                  onClick={() => removeQuotationComment(quotationId, c.id)}
                  aria-label="Remove this comment"
                  className="ml-auto rounded p-1 text-ink-300 hover:bg-surface-alt hover:text-[#8f2c22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[12.5px] text-ink-700">{c.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Audit
 * ------------------------------------------------------------------ */

function AuditTrail({
  entries,
}: {
  entries: { id: string; at: string; by: string; summary: string; versionNo?: number }[];
}) {
  if (entries.length === 0) {
    return <p className="py-10 text-center text-[12.5px] text-ink-500">Nothing logged yet.</p>;
  }

  return (
    <ol className="space-y-0">
      {[...entries].reverse().map((e) => (
        <li key={e.id} className="flex gap-3 border-b border-hairline/70 py-2.5 last:border-b-0">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-200" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-[12.5px] text-ink-900">{e.summary}</span>
            <span className="mt-0.5 block text-[11px] text-ink-400">
              {e.by} · {new Date(e.at).toLocaleString()}
              {e.versionNo !== undefined && ` · v${e.versionNo}`}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
