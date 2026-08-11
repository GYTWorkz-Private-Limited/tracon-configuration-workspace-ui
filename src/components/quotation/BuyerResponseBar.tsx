// Record Buyer Response — the single input row that advances the quote's
// timeline, status pill and outcome history in one save.

import { useState } from "react";
import { MessageSquare } from "lucide-react";
import type { BuyerOutcome, BuyerResponse } from "@/lib/quotationsStore";

const OUTCOMES: { value: BuyerOutcome; label: string }[] = [
  { value: "none", label: "— Select outcome —" },
  { value: "accepted", label: "Accepted" },
  { value: "countered", label: "Countered" },
  { value: "rejected", label: "Rejected" },
];

export function BuyerResponseBar({
  response,
  onSave,
}: {
  response?: BuyerResponse;
  onSave: (r: BuyerResponse) => void;
}) {
  const [outcome, setOutcome] = useState<BuyerOutcome>(response?.outcome ?? "none");
  const [counter, setCounter] = useState(
    response?.counterPriceUsd ? String(response.counterPriceUsd) : "",
  );
  const [comments, setComments] = useState(response?.comments ?? "");

  const counterNum = Number(counter);
  const canSave = outcome !== "none";

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor="buyer-outcome"
          className="flex items-center gap-2 text-[13px] font-semibold text-ink-900"
        >
          <MessageSquare className="h-4 w-4 text-ink-500" aria-hidden />
          Record Buyer Response:
        </label>

        <select
          id="buyer-outcome"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value as BuyerOutcome)}
          className="min-w-[190px] rounded-md border border-hairline bg-surface px-2.5 py-2 text-[12.5px] text-ink-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
        >
          {OUTCOMES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <input
          type="number"
          step="0.01"
          min="0"
          value={counter}
          onChange={(e) => setCounter(e.target.value)}
          aria-label="Counter price if any, in USD"
          placeholder="Counter price (if any)"
          className="w-[190px] rounded-md border border-hairline bg-surface px-2.5 py-2 text-[12.5px] text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
        />

        <input
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          aria-label="Buyer comments"
          placeholder="Buyer comments…"
          className="min-w-[220px] flex-1 rounded-md border border-hairline bg-surface px-2.5 py-2 text-[12.5px] text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
        />

        <button
          disabled={!canSave}
          onClick={() =>
            onSave({
              outcome,
              counterPriceUsd:
                Number.isFinite(counterNum) && counterNum > 0 ? counterNum : undefined,
              comments: comments.trim() || undefined,
            })
          }
          className="rounded-md bg-brand-700 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save Response
        </button>
      </div>

      {response?.at && (
        <p className="mt-2 text-[11.5px] text-ink-500">
          Last recorded {new Date(response.at).toLocaleString("en-GB")} — {response.outcome}
          {response.counterPriceUsd ? ` at $${response.counterPriceUsd.toFixed(2)}` : ""}
          {response.comments ? ` · “${response.comments}”` : ""}
        </p>
      )}
    </div>
  );
}
