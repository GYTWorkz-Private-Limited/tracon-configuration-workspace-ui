/**
 * Free-text -> configuration patch.
 *
 * Deterministic keyword matching against the same ALL_CARDS option library the
 * forms use — there is no external AI call, so every match is a real,
 * selectable option and the result can never disagree with what the canvas
 * would show if a user picked it by hand.
 */

import { ALL_CARDS, type CardDef, type CardOption, type ConfigState } from "./fabricConfig";

export type VariantMatch = {
  cardId: string;
  cardLabel: string;
  optionLabel: string;
  score: number;
};

export type VariantInterpretation = {
  patch: ConfigState;
  matches: VariantMatch[];
};

const STOPWORDS = new Set([
  "the",
  "and",
  "with",
  "for",
  "use",
  "using",
  "to",
  "a",
  "an",
  "in",
  "of",
  "on",
  "at",
  "this",
  "that",
  "from",
  "into",
  "make",
  "made",
  "set",
  "switch",
  "change",
  "update",
  "increase",
  "decrease",
  "reduce",
  "lower",
  "raise",
  "higher",
  "add",
  "also",
  "please",
  "want",
  "need",
  "like",
  "new",
  "variant",
  "option",
  "pcs",
  "piece",
  "pieces",
  "per",
  "is",
  "are",
  "should",
  "would",
  "some",
  "instead",
  "keep",
  "same",
  "current",
]);

const tokenize = (s: string): string[] =>
  (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length > 1 && !STOPWORDS.has(t));

/** Direct numeric reads — these bypass the option-matching pass entirely. */
const NUMERIC_PATTERNS: { id: string; regex: RegExp }[] = [
  { id: "orderQty", regex: /(\d[\d,]{2,})\s*(pcs|pieces|pc)\b/i },
  { id: "wastage", regex: /wastage[^%\d]{0,18}(\d{1,2}(?:\.\d+)?)\s*%/i },
  { id: "shrinkage", regex: /shrinkage[^%\d]{0,18}(\d{1,2}(?:\.\d+)?)\s*%/i },
];

const MAX_PATCHED_CARDS = 10;

export function interpretVariantPrompt(prompt: string): VariantInterpretation {
  const patch: ConfigState = {};
  const matches: VariantMatch[] = [];
  const text = prompt.trim();
  if (!text) return { patch, matches };

  for (const { id, regex } of NUMERIC_PATTERNS) {
    const m = text.match(regex);
    if (!m) continue;
    const card = ALL_CARDS.find((c) => c.id === id);
    if (!card) continue;
    const raw = m[1].replace(/,/g, "");
    patch[id] = { value: raw };
    matches.push({
      cardId: id,
      cardLabel: card.label,
      optionLabel: `${raw}${card.suffix ?? ""}`,
      score: 3,
    });
  }

  const promptTokens = new Set(tokenize(text));
  if (!promptTokens.size) return { patch, matches };

  const candidates: { card: CardDef; option: CardOption; score: number }[] = [];

  for (const card of ALL_CARDS) {
    if (card.kind !== "options" || !card.options?.length || patch[card.id]) continue;
    let best: { option: CardOption; score: number } | null = null;
    for (const option of card.options) {
      if (option.label.length <= 3) continue;
      const optionTokens = tokenize(option.label);
      if (!optionTokens.length) continue;
      const score = optionTokens.filter((t) => promptTokens.has(t)).length;
      if (score < 1) continue;
      const strongSingle =
        score === 1 && optionTokens.some((t) => t.length >= 5 && promptTokens.has(t));
      if (score < 2 && !strongSingle) continue;
      if (!best || score > best.score) best = { option, score };
    }
    if (best) candidates.push({ card, option: best.option, score: best.score });
  }

  candidates.sort((a, b) => b.score - a.score);
  for (const c of candidates.slice(0, MAX_PATCHED_CARDS)) {
    patch[c.card.id] = { value: c.option.label, optionId: c.option.id, rate: c.option.rate };
    matches.push({
      cardId: c.card.id,
      cardLabel: c.card.label,
      optionLabel: c.option.label,
      score: c.score,
    });
  }

  matches.sort((a, b) => b.score - a.score);
  return { patch, matches };
}
