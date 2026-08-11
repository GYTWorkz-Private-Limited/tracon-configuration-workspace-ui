import { useState } from "react";
import { Sparkles, X, ArrowUp, Lightbulb, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { inr } from "@/lib/fabricConfig";

export type CopilotPatch = {
  cardId: string;
  value: { value: string; optionId?: string; rate?: number };
  label: string;
};

type Suggestion = {
  title: string;
  impact: string;
  patches: CopilotPatch[];
};

type Msg = { role: "ai" | "you"; text: string; suggestion?: Suggestion };

const SEED: Msg[] = [
  {
    role: "ai",
    text: "I've read this fabric configuration. Supplier and dyeing method together drive about 72% of the per-piece fabric cost — that's where the levers are.",
  },
];

const PROMPTS = [
  "Cheapest fabric setup",
  "Reduce consumption",
  "What's missing here?",
];

const ANSWERS: Record<string, Msg> = {
  "Cheapest fabric setup": {
    role: "ai",
    text: "Mafatlal Mills quotes ₹137.50 / m against TESPL's ₹141.28 / m in the same quality band, with a 30-day lead time. Switching the supplier keeps the 300 GSM spec intact and lowers fabric cost per piece by roughly ₹2.45.",
    suggestion: {
      title: "Switch supplier to Mafatlal Mills",
      impact: `Fabric rate ${inr(141.28)} → ${inr(137.5)} / m · saves ≈ ${inr(2.45)} / pc`,
      patches: [
        {
          cardId: "supplier",
          label: "Supplier → Mafatlal Mills",
          value: { value: "Mafatlal Mills", optionId: "mafatlal", rate: 137.5 },
        },
      ],
    },
  },
  "Reduce consumption": {
    role: "ai",
    text: "Cut length 23.00 in with 10% shrinkage and 7% wastage gives 0.688 m per piece. Marker efficiency on this width supports 5% wastage, which releases about 0.013 m per piece.",
    suggestion: {
      title: "Trim wastage from 7% to 5%",
      impact: "Required meter 0.688 → 0.675 m / pc",
      patches: [{ cardId: "wastage", label: "Wastage % → 5", value: { value: "5" } }],
    },
  },
  "What's missing here?": {
    role: "ai",
    text: "Technical fields (warp, weft, reed / pick) are still empty. They don't change fabric cost, but the buyer tech pack needs them before approval. Weaving is safe to set now — plain weave matches the approved handfeel sample.",
    suggestion: {
      title: "Set weaving to Plain Weave",
      impact: "No cost impact · completes the technical section",
      patches: [
        {
          cardId: "weaving",
          label: "Weaving → Plain Weave",
          value: { value: "Plain Weave", optionId: "plain-weave" },
        },
      ],
    },
  },
};

/** Contextual fabric configuration copilot. Suggestions can be applied to the canvas. */
export function CopilotPanel({
  context,
  onClose,
  onApply,
}: {
  context: string;
  onClose: () => void;
  onApply: (patches: CopilotPatch[]) => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>(SEED);
  const [input, setInput] = useState("");
  const [applied, setApplied] = useState<number[]>([]);
  const [dismissed, setDismissed] = useState<number[]>([]);

  const send = (text: string) => {
    const q = text.trim();
    if (!q) return;
    setInput("");
    const answer: Msg =
      ANSWERS[q] ??
      ANSWERS[Object.keys(ANSWERS).find((k) => q.toLowerCase().includes(k.split(" ")[0].toLowerCase())) ?? ""] ??
      {
        role: "ai",
        text: "Based on the current fabric cards, I'd start with supplier and dyeing — together they carry most of the per-piece cost. Ask me for the cheapest setup and I'll propose a change you can apply.",
      };
    setMsgs((m) => [...m, { role: "you", text: q }, answer]);
  };

  return (
    <aside className="relative flex h-full w-full flex-col overflow-hidden border-l border-hairline bg-surface">
      {/* Ambient background + orb */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(120%_60%_at_50%_0%,var(--color-cfg-soft),transparent_60%)] opacity-90" />
        <div className="absolute -top-16 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-[conic-gradient(from_180deg,var(--color-cfg),var(--color-brand-500),var(--color-cfg-soft),var(--color-cfg))] opacity-25 blur-2xl" />
        <div className="absolute bottom-24 -right-10 h-36 w-36 rounded-full bg-brand-100 opacity-40 blur-3xl" />
      </div>

      <header className="relative flex items-start justify-between gap-3 border-b border-hairline px-5 py-3.5">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-cfg-strong">
            <Sparkles className="h-3 w-3" /> AI Copilot
          </div>
          <h2 className="mt-0.5 text-[15px] font-medium text-ink-900">Fabric assistant</h2>
          <p className="mt-0.5 text-[12px] text-ink-500">Context: {context}</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close copilot"
          className="rounded-md p-1 text-ink-400 hover:bg-surface-alt hover:text-ink-900"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="relative flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {msgs.map((m, i) => (
          <div key={i} className="space-y-2">
            <div
              className={cn(
                "max-w-[92%] rounded-xl border px-3 py-2.5 text-[12.5px] leading-relaxed",
                m.role === "ai"
                  ? "border-hairline bg-surface text-ink-700 shadow-[0_1px_2px_rgba(11,15,13,0.04)]"
                  : "ml-auto border-ink-900 bg-ink-900 text-white",
              )}
            >
              {m.text}
            </div>

            {m.suggestion && !dismissed.includes(i) && (
              <div className="rounded-xl border border-cfg/40 bg-cfg-soft/60 p-3">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-cfg-strong">
                  <Sparkles className="h-2.5 w-2.5" /> Suggested change
                </div>
                <div className="mt-1 text-[13px] font-medium text-ink-900">
                  {m.suggestion.title}
                </div>
                <p className="mt-0.5 text-[11.5px] text-ink-600">{m.suggestion.impact}</p>
                <ul className="mt-2 space-y-1">
                  {m.suggestion.patches.map((p) => (
                    <li key={p.cardId} className="text-[11.5px] text-ink-700">
                      · {p.label}
                    </li>
                  ))}
                </ul>
                {applied.includes(i) ? (
                  <div className="mt-2.5 inline-flex items-center gap-1.5 text-[12px] font-medium text-cfg-strong">
                    <Check className="h-3.5 w-3.5" /> Applied to the flow
                  </div>
                ) : (
                  <div className="mt-2.5 flex items-center gap-2">
                    <button
                      onClick={() => {
                        onApply(m.suggestion!.patches);
                        setApplied((a) => [...a, i]);
                      }}
                      className="rounded-md bg-brand-700 px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-brand-800"
                    >
                      Apply suggestion
                    </button>
                    <button
                      onClick={() => setDismissed((d) => [...d, i])}
                      className="rounded-md border border-hairline bg-surface px-3 py-1.5 text-[12.5px] text-ink-600 hover:bg-surface-alt"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="relative border-t border-hairline bg-surface/80 px-5 py-3 backdrop-blur">
        <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.1em] text-ink-400">
          <Lightbulb className="h-3 w-3" /> Suggestions
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => send(p)}
              className="rounded-full border border-hairline bg-surface px-2.5 py-1 text-[11.5px] text-ink-600 hover:border-cfg hover:bg-cfg-soft hover:text-cfg-strong"
            >
              {p}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mt-3 flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this fabric setup…"
            className="min-w-0 flex-1 rounded-md border border-hairline bg-surface px-3 py-2 text-[13px] text-ink-900 placeholder:text-ink-400 focus:border-cfg focus:outline-none focus:ring-2 focus:ring-cfg/20"
          />
          <button
            type="submit"
            aria-label="Send"
            className="rounded-md bg-brand-700 p-2 text-white hover:bg-brand-800"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </form>
      </div>
    </aside>
  );
}
