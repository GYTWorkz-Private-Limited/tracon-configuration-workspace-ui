/**
 * Record Buyer Response — what came back from the other side of the table.
 *
 * Lives on the quotation detail page once the quotation is out with the buyer.
 * The outcome is picked first and the form reshapes around it: a counter needs
 * a number, silence needs a follow-up date, a rejection needs the reason — one
 * panel, never six fields at once.
 *
 * Every saved response lands on a TIMELINE below the form rather than
 * replacing the last one: a buyer who counters and later accepts is a
 * negotiation the next quotation will want to read.
 */

import { useState } from "react";
import { CalendarClock, Check, MessageSquare, Send, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { usd } from "@/lib/commercialProvisions";
import {
  BUYER_OUTCOME_LABEL,
  latestResponse,
  recordBuyerResponse,
  useBuyerRecord,
  type BuyerOutcome,
} from "@/lib/buyerResponseStore";
import { toast } from "sonner";

const OUTCOMES: BuyerOutcome[] = [
  "accepted",
  "counter",
  "revision",
  "rejected_price",
  "rejected_moq",
  "no_response",
];

const OUTCOME_HINT: Record<BuyerOutcome, string> = {
  accepted: "The quoted prices stand — nothing changes hands but the confirmation.",
  counter: "The buyer wants it, at their number.",
  revision: "Changes were asked for — this usually becomes a requote.",
  rejected_price: "Lost on price.",
  rejected_moq: "Lost on quantity.",
  no_response: "Nothing back yet — set a date to chase.",
};

const OUTCOME_TONE: Record<BuyerOutcome, string> = {
  accepted: "border-brand-600 bg-brand-50 text-brand-800",
  counter: "border-brand-600 bg-brand-50 text-brand-800",
  revision: "border-amber-400 bg-amber-50 text-amber-800",
  rejected_price: "border-[var(--color-risk)]/50 bg-[var(--color-risk-soft)] text-[var(--color-risk)]",
  rejected_moq: "border-[var(--color-risk)]/50 bg-[var(--color-risk-soft)] text-[var(--color-risk)]",
  no_response: "border-hairline bg-surface-alt text-ink-700",
};

export function BuyerResponsePanel({
  quotationId,
  quotedPriceUsd,
  onRequote,
}: {
  quotationId: string;
  /** the value the buyer is answering — context beside the counter field */
  quotedPriceUsd: number;
  /** a revision outcome offers the way into the next round */
  onRequote?: () => void;
}) {
  const record = useBuyerRecord(quotationId);
  const [outcome, setOutcome] = useState<BuyerOutcome | null>(null);
  const [counterPrice, setCounterPrice] = useState("");
  const [requestedMoq, setRequestedMoq] = useState("");
  const [comments, setComments] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");

  const last = latestResponse(record);

  const reset = () => {
    setOutcome(null);
    setCounterPrice("");
    setRequestedMoq("");
    setComments("");
    setFollowUpDate("");
  };

  const canSave =
    outcome !== null &&
    (outcome !== "counter" || Number(counterPrice) > 0) &&
    (outcome !== "no_response" || followUpDate.length > 0);

  const save = () => {
    if (!outcome || !canSave) return;
    recordBuyerResponse(quotationId, {
      outcome,
      counterPriceUsd: outcome === "counter" ? Number(counterPrice) : undefined,
      requestedMoq: outcome === "rejected_moq" && requestedMoq.trim() ? requestedMoq.trim() : undefined,
      comments: comments.trim() || undefined,
      followUpDate: outcome === "no_response" ? followUpDate : undefined,
    });
    toast.success(`Buyer response recorded — ${BUYER_OUTCOME_LABEL[outcome]}`);
    reset();
  };

  return (
    <section
      aria-label="Record buyer response"
      className="mt-4 overflow-hidden rounded-xl border border-hairline bg-surface"
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-hairline bg-surface-alt px-4 py-2.5">
        <MessageSquare className="h-3.5 w-3.5 text-ink-500" aria-hidden />
        <h2 className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-ink-700">
          Record buyer response
        </h2>
        {last && (
          <span className="text-[11.5px] text-ink-500">
            latest: {BUYER_OUTCOME_LABEL[last.outcome]} ·{" "}
            {new Date(last.recordedAt).toLocaleDateString()}
          </span>
        )}
      </header>

      <div className="px-4 py-3.5">
        <p className="mb-2 text-[12px] font-medium text-ink-700">What did the buyer say?</p>

        {/* Outcome first — the form below is shaped by this choice. */}
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {OUTCOMES.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setOutcome((cur) => (cur === o ? null : o))}
              aria-pressed={outcome === o}
              className={cn(
                "rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
                outcome === o
                  ? OUTCOME_TONE[o]
                  : "border-hairline bg-surface text-ink-700 hover:bg-surface-alt",
              )}
            >
              <span className="flex items-center gap-1.5 text-[12.5px] font-semibold">
                {outcome === o && <Check className="h-3.5 w-3.5" aria-hidden />}
                {BUYER_OUTCOME_LABEL[o]}
              </span>
              <span className="mt-0.5 block text-[11px] opacity-80">{OUTCOME_HINT[o]}</span>
            </button>
          ))}
        </div>

        {outcome && (
          <div className="mt-3 grid gap-3 border-t border-hairline pt-3 sm:grid-cols-2">
            {outcome === "counter" && (
              <label className="block">
                <span className="mb-1 block text-[11.5px] font-medium text-ink-700">
                  Counter price ($ / unit)
                  <span className="ml-1.5 font-normal text-ink-400">
                    quoted {usd(quotedPriceUsd)}
                  </span>
                </span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={counterPrice}
                  onChange={(e) => setCounterPrice(e.target.value)}
                  placeholder="e.g. 4.10"
                  className="w-full rounded-md border border-hairline bg-surface px-2.5 py-2 text-[13px] tabular-nums text-ink-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
                />
              </label>
            )}

            {outcome === "rejected_moq" && (
              <label className="block">
                <span className="mb-1 block text-[11.5px] font-medium text-ink-700">
                  Requested MOQ <span className="font-normal text-ink-400">if given</span>
                </span>
                <input
                  value={requestedMoq}
                  onChange={(e) => setRequestedMoq(e.target.value)}
                  placeholder="e.g. 500 pcs"
                  className="w-full rounded-md border border-hairline bg-surface px-2.5 py-2 text-[13px] text-ink-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
                />
              </label>
            )}

            {outcome === "no_response" && (
              <label className="block">
                <span className="mb-1 block text-[11.5px] font-medium text-ink-700">
                  Follow-up date
                </span>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="w-full rounded-md border border-hairline bg-surface px-2.5 py-2 text-[13px] text-ink-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
                />
              </label>
            )}

            <label className={cn("block", outcome === "accepted" && "sm:col-span-2")}>
              <span className="mb-1 block text-[11.5px] font-medium text-ink-700">
                {outcome === "revision"
                  ? "Requested changes"
                  : outcome === "no_response"
                    ? "Follow-up notes"
                    : outcome.startsWith("rejected")
                      ? "Reason / buyer comments"
                      : "Buyer comments"}
                <span className="ml-1.5 font-normal text-ink-400">optional</span>
              </span>
              <textarea
                rows={2}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="w-full rounded-md border border-hairline bg-surface px-2.5 py-2 text-[12.5px] text-ink-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
              />
            </label>

            <div className="flex items-end gap-2 sm:col-span-2">
              <button
                type="button"
                disabled={!canSave}
                onClick={save}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
              >
                <Send className="h-4 w-4" aria-hidden /> Save response
              </button>
              {outcome === "revision" && onRequote && (
                <button
                  type="button"
                  onClick={onRequote}
                  className="inline-flex items-center gap-1.5 rounded-md border border-brand-700 bg-brand-50 px-3.5 py-2 text-[13px] font-medium text-brand-700 hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
                >
                  <Sparkles className="h-4 w-4" aria-hidden /> Generate requote
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {record.responses.length > 0 && (
        <div className="border-t border-hairline px-4 py-3">
          <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-500">
            Buyer response timeline
          </h3>
          <ul className="mt-2 space-y-2">
            {record.responses.map((r) => (
              <li key={r.id} className="flex items-start gap-2.5">
                <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden />
                <div className="min-w-0">
                  <p className="text-[12.5px] text-ink-900">
                    <span className="font-semibold">{BUYER_OUTCOME_LABEL[r.outcome]}</span>
                    {r.counterPriceUsd !== undefined && (
                      <span className="ml-1.5 tabular-nums">at {usd(r.counterPriceUsd)}</span>
                    )}
                    {r.requestedMoq && <span className="ml-1.5">— asked {r.requestedMoq}</span>}
                    {r.followUpDate && (
                      <span className="ml-1.5">
                        — follow up {new Date(r.followUpDate).toLocaleDateString()}
                      </span>
                    )}
                  </p>
                  {r.comments && <p className="mt-0.5 text-[12px] text-ink-600">{r.comments}</p>}
                  <p className="mt-0.5 text-[10.5px] text-ink-400">
                    {r.recordedBy} · {new Date(r.recordedAt).toLocaleString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
