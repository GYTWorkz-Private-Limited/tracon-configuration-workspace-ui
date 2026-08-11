import { useEffect, useState } from "react";
import { Search, Sparkles, Star, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALL_CARDS, inr, moduleLabelForCard, type CardDef, type CardOption, type ConfigState, type Unit } from "@/lib/fabricConfig";
import { explainConfigCard } from "@/lib/configExplain";
import { ExplainSection } from "./ExplainSection";

const unitSuffix = (unit?: Unit) =>
  unit === "perPc" ? " / Piece" : unit === "perDot" ? " / Dot" : unit === "perKg" ? " / KG" : unit === "perM" ? " / Meter" : "";

type Props = {
  cardId: string;
  state: ConfigState;
  /** cards of the module this drawer belongs to — used for the calculation block */
  moduleCards?: CardDef[];
  onClose: () => void;
  onApply: (cardId: string, value: { value: string; optionId?: string; rate?: number }) => void;
  onClear: (cardId: string) => void;
};



export function ConfigDrawer({ cardId, state, moduleCards, onClose, onApply, onClear }: Props) {
  const card = ALL_CARDS.find((c) => c.id === cardId)!;
  const current = state[cardId];
  const [query, setQuery] = useState("");
  const [pick, setPick] = useState<CardOption | null>(
    card.options?.find((o) => o.id === current?.optionId) ?? null,
  );
  const [text, setText] = useState(current?.value ?? "");
  const [supplier, setSupplier] = useState(state[`${cardId}__supplier`]?.value ?? "");
  const [notes, setNotes] = useState(state[`${cardId}__notes`]?.value ?? "");

  useEffect(() => {
    setQuery("");
    setPick(card.options?.find((o) => o.id === current?.optionId) ?? null);
    setText(current?.value ?? "");
    setSupplier(state[`${cardId}__supplier`]?.value ?? "");
    setNotes(state[`${cardId}__notes`]?.value ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);

  const options = (card.options ?? []).filter((o) =>
    (o.label + " " + (o.meta ?? "")).toLowerCase().includes(query.toLowerCase()),
  );
  const recommended = options.filter((o) => o.recommended);
  const rest = options.filter((o) => !o.recommended);

  const apply = () => {
    if (card.kind === "options") {
      if (!pick) return;
      onApply(cardId, { value: pick.label, optionId: pick.id, rate: pick.rate });
    } else {
      if (!text.trim()) return;
      if (card.accessory) {
        onApply(`${cardId}__supplier`, { value: supplier.trim() });
        onApply(`${cardId}__notes`, { value: notes.trim() });
      }
      onApply(cardId, { value: text.trim() });
    }
  };

  return (
    <aside className="flex h-full w-full flex-col border-l border-hairline bg-surface">
      <header className="flex items-start justify-between gap-3 border-b border-hairline px-5 py-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-ink-400">
            {moduleLabelForCard(cardId)} <span className="text-ink-300">/</span> <span className="text-brand-700">{card.label}</span>
          </div>
          <h2 className="mt-0.5 truncate text-[15px] font-medium text-ink-900">Configure {card.label}</h2>
          {card.hint && <p className="mt-0.5 text-[12px] text-ink-500">{card.hint}</p>}
        </div>
        <button
          onClick={onClose}
          aria-label="Close configuration"
          className="rounded-md p-1 text-ink-400 hover:bg-surface-alt hover:text-ink-900"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {card.kind === "options" ? (
          <>
            {(card.options?.length ?? 0) > 3 && (
              <div className="relative mb-4">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search ${card.label.toLowerCase()}…`}
                  className="w-full rounded-md border border-hairline bg-surface py-2 pl-8 pr-3 text-[13px] text-ink-900 placeholder:text-ink-400 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/15"
                />
              </div>
            )}

            {recommended.length > 0 && (
              <section className="mb-5">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-brand-700">
                  <Sparkles className="h-3 w-3" /> AI recommended
                </div>
                <div className="space-y-2.5">
                  {recommended.map((o) => (
                    <OptionRow
                      key={o.id}
                      option={o}
                      card={card}
                      selected={pick?.id === o.id}
                      isCurrent={current?.optionId === o.id}
                      onSelect={() => setPick(o)}
                      highlight
                    />
                  ))}
                </div>
              </section>
            )}

            <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.1em] text-ink-400">
              All options
            </div>
            <div className="space-y-2.5">
              {rest.map((o) => (
                <OptionRow
                  key={o.id}
                  option={o}
                  card={card}
                  selected={pick?.id === o.id}
                  isCurrent={current?.optionId === o.id}
                  onSelect={() => setPick(o)}
                />
              ))}
              {!options.length && <p className="text-[12.5px] text-ink-400">No matches.</p>}
            </div>
          </>
        ) : (
          <div>
            <label className="text-[10.5px] uppercase tracking-[0.12em] text-ink-400">
              {card.accessory ? "Cost" : card.label}
              {card.suffix ? ` (${card.suffix}${unitSuffix(card.unit)})` : ""}
            </label>

            <input
              value={text}
              inputMode={card.kind === "number" ? "decimal" : "text"}
              onChange={(e) => setText(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-hairline bg-surface px-3 py-2 text-[14px] text-ink-900 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/15"
            />
            {card.accessory && (
              <>
                <label className="mt-4 block text-[10.5px] uppercase tracking-[0.12em] text-ink-400">
                  Supplier <span className="normal-case tracking-normal text-ink-300">(optional)</span>
                </label>
                <input
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="e.g. TESPL"
                  className="mt-1.5 w-full rounded-md border border-hairline bg-surface px-3 py-2 text-[14px] text-ink-900 placeholder:text-ink-400 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/15"
                />
                <label className="mt-4 block text-[10.5px] uppercase tracking-[0.12em] text-ink-400">
                  Notes <span className="normal-case tracking-normal text-ink-300">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Specification, size, buyer reference…"
                  className="mt-1.5 w-full resize-none rounded-md border border-hairline bg-surface px-3 py-2 text-[13.5px] text-ink-900 placeholder:text-ink-400 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/15"
                />
              </>
            )}
            <p className="mt-2 text-[12px] leading-relaxed text-ink-500">
              Sourced from the JCP cost sheet. Changes recalculate consumption, fabric total and grand
              total immediately.
            </p>
          </div>
        )}

        <ExplainSection explain={explainConfigCard(cardId, state, moduleCards)} />
      </div>


      <footer className="flex items-center gap-2 border-t border-hairline px-5 py-3">
        {current ? (
          <button
            onClick={() => onClear(cardId)}
            className="rounded-md border border-hairline px-3 py-2 text-[13px] text-ink-600 hover:bg-surface-alt"
          >
            Clear
          </button>
        ) : (
          <button
            onClick={onClose}
            className="rounded-md border border-hairline px-3 py-2 text-[13px] text-ink-600 hover:bg-surface-alt"
          >
            Cancel
          </button>
        )}
        <button
          onClick={apply}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-4 py-2 text-[13px] font-medium text-white hover:bg-brand-800"
        >
          <Check className="h-3.5 w-3.5" /> Apply {card.label}
        </button>
      </footer>
    </aside>
  );
}

function OptionRow({
  option,
  card,
  selected,
  isCurrent,
  onSelect,
  highlight,
}: {
  option: CardOption;
  card: (typeof ALL_CARDS)[number];
  selected: boolean;
  isCurrent: boolean;
  onSelect: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full rounded-lg border p-3 text-left transition-colors",
        selected ? "border-brand-700 bg-brand-50" : "border-hairline bg-surface hover:bg-surface-alt",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {highlight && <Star className="h-3 w-3 shrink-0 text-brand-700" />}
            <span className="truncate text-[13.5px] font-medium text-ink-900">{option.label}</span>
            {isCurrent && (
              <span className="shrink-0 rounded-full bg-ink-100 px-1.5 py-0.5 text-[9.5px] uppercase tracking-[0.08em] text-ink-600">
                current
              </span>
            )}
          </div>
          {option.meta && <div className="mt-0.5 text-[12px] text-ink-500">{option.meta}</div>}
        </div>
        {option.rate !== undefined && card.unit && card.unit !== "none" && (
          <span className="shrink-0 text-[13px] tabular-nums text-ink-900">
            {inr(option.rate)} / {card.unit === "perPc" ? "pc" : card.unit === "perDot" ? "dot" : card.unit === "perKg" ? "kg" : "m"}
          </span>
        )}

      </div>

      {option.extras && (
        <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-hairline pt-2.5 text-[11.5px]">
          {option.extras.map((e) => (
            <div key={e.label} className="flex items-center justify-between gap-2">
              <dt className="text-ink-400">{e.label}</dt>
              <dd className="text-ink-800">{e.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {option.reasons && (
        <div className="mt-2.5">
          <div className="text-[10.5px] uppercase tracking-[0.1em] text-ink-400">Recommended because</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {option.reasons.map((r) => (
              <span
                key={r}
                className="rounded-full bg-node-100 px-2 py-0.5 text-[11px] font-medium text-brand-700"
              >
                {r}
              </span>
            ))}
          </div>
        </div>
      )}
    </button>
  );
}
