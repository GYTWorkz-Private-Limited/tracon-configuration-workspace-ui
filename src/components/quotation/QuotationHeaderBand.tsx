// Quotation header — the dark identity band plus the horizontal quote timeline.
// Everything here is buyer-facing context; nothing in it is a cost figure.

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  STATUS_LABEL,
  STATUS_TONE,
  type Quotation,
  type QuotationStatus,
} from "@/lib/quotationsStore";

const fmt = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : undefined;

type Step = { key: string; label: string; at?: string; pending: string };

function steps(q: Quotation): Step[] {
  const t = q.timeline;
  return [
    { key: "costing", label: "Costing Done", at: fmt(t.costingDoneAt), pending: "—" },
    {
      key: "approved",
      label: "Management Approved",
      at: fmt(t.approvedAt),
      pending: q.status === "pending_approval" ? "In review" : "Pending",
    },
    { key: "sent", label: "Quote Sent", at: fmt(t.sentAt), pending: "Pending" },
    {
      key: "response",
      label: "Buyer Response",
      at: t.respondedAt ? responseLabel(q) : undefined,
      pending: "Pending",
    },
    { key: "order", label: "Order Confirmed", at: fmt(t.orderedAt), pending: "—" },
  ];
}

function responseLabel(q: Quotation): string {
  const o = q.response?.outcome;
  const when = fmt(q.response?.at) ?? "";
  const word =
    o === "accepted"
      ? "Accepted"
      : o === "countered"
        ? "Countered"
        : o === "rejected"
          ? "Rejected"
          : "";
  return [word, when].filter(Boolean).join(" · ");
}

export function QuotationHeaderBand({
  quotation,
  onOpenHistory,
}: {
  quotation: Quotation;
  onOpenHistory: () => void;
}) {
  const q = quotation;
  const list = steps(q);
  const reachedIdx = list.reduce((last, s, i) => (s.at ? i : last), -1);

  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
      {/* Identity band */}
      <div className="bg-gradient-to-r from-brand-900 via-brand-800 to-brand-600 px-5 py-4 lg:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.01em] text-white">
                Quotation {q.id}
              </h1>
              <button
                onClick={onOpenHistory}
                className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-white/25"
                title="Open version history & audit log"
              >
                v{q.version}
                {q.versions.length > 0 ? ` · ${q.versions.length + 1} versions` : ""}
              </button>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-white/80">
              <span>
                Buyer <span className="font-medium text-white">{q.buyer}</span>
              </span>
              <span aria-hidden>·</span>
              <span>Ref: {q.buyerRef}</span>
              {q.timeline.sentAt && (
                <>
                  <span aria-hidden>·</span>
                  <span>Sent: {fmt(q.timeline.sentAt)}</span>
                </>
              )}
              <span aria-hidden>·</span>
              <span>Valid Until: {fmt(q.validUntil)}</span>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <Chip>{q.terms.incoterm}</Chip>
              <Chip>Payment: {q.terms.payment}</Chip>
              <Chip>Delivery: {q.terms.delivery}</Chip>
              {q.terms.certifications.length > 0 && (
                <Chip>{q.terms.certifications.join(" · ")}</Chip>
              )}
            </div>
          </div>

          <StatusPill status={q.status} />
        </div>
      </div>

      {/* Timeline */}
      <div className="px-5 py-4 lg:px-6">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-400">
          Quote timeline
        </div>
        <ol className="mt-3 flex items-start">
          {list.map((s, i) => {
            const done = Boolean(s.at);
            const isLast = i === list.length - 1;
            return (
              <li key={s.key} className="flex min-w-0 flex-1 items-start">
                <div className="flex min-w-0 flex-1 flex-col items-center text-center">
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full border-2",
                      done
                        ? "border-brand-600 bg-brand-600 text-white"
                        : "border-ink-200 bg-surface text-ink-300",
                    )}
                    aria-hidden
                  >
                    {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
                  </span>
                  <span
                    className={cn(
                      "mt-1.5 text-[12px] font-medium leading-tight",
                      done ? "text-brand-700" : "text-ink-400",
                    )}
                  >
                    {s.label}
                  </span>
                  <span className="text-[11px] text-ink-400">{s.at ?? s.pending}</span>
                </div>
                {!isLast && (
                  <span
                    className={cn(
                      "mt-3 h-0.5 flex-1 shrink-0",
                      i <= reachedIdx - 1 || (done && i < reachedIdx)
                        ? "bg-brand-600"
                        : "bg-ink-100",
                    )}
                    aria-hidden
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-white/15 px-2 py-1 text-[11.5px] font-medium text-white">
      {children}
    </span>
  );
}

export function StatusPill({ status, className }: { status: QuotationStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-3 py-1.5 text-[12.5px] font-semibold",
        STATUS_TONE[status],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
