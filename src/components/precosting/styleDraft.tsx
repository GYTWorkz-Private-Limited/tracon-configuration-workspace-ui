/**
 * The shape of a style while it is being TYPED, which is not the shape of a
 * style once it exists.
 *
 * Every dimension is held as a string here on purpose: a half-typed "1." or an
 * emptied field is a legitimate state mid-edit, and coercing to a number on
 * each keystroke is what makes a numeric form fight the person filling it in.
 * Coercion happens once, at the boundary where the draft becomes a `StyleDef`.
 */

import { cutSizeOf, type StyleDef, type StylePart } from "@/lib/styleMaster";

/**
 * A style the user built but chose NOT to promote to the master still has to
 * live somewhere — it is the only thing that can seed the article's parts. So
 * it is written to the same custom-style store and marked here, and the picker
 * filters it back out: saved so the sheet works, invisible so next quarter's
 * picker is not a graveyard of one-off builds.
 */
export const ONE_TIME_PREFIX = "One-time build";

/**
 * Read the stored flag, never the label: whether a style is shared is a fact
 * about the record, and deciding it by parsing a display string means a
 * reworded byline silently republishes someone's one-off build.
 */
export const isOneTimeStyle = (s: StyleDef) => Boolean(s.oneTime);

export type PartDraft = {
  name: string;
  type: string;
  description: string;
  finishedWidth: string;
  finishedLength: string;
  cutWidth: string;
  cutLength: string;
  consumption: string;
  wastagePct: string;
  edgeFinish: string;
  workmanship: string;
  spec: string;
  slot: "fabric" | "trim";
};

export type StyleDraft = {
  name: string;
  code: string;
  product: string;
  category: string;
  construction: string;
  edgeFinish: string;
  /** free text, one note per line — the spec sheet's own wording */
  workmanship: string;
  description: string;
  parts: PartDraft[];
};

/** The component types the costing model understands, for the part dropdown. */
export const PART_TYPES = [
  "Self Fabric Panel",
  "Trim / Self Fabric",
  "Fabric",
  "Lining",
  "Filling",
  "Trim",
  "Decoration",
  "Process",
] as const;

export const emptyPart = (): PartDraft => ({
  name: "",
  type: "Self Fabric Panel",
  description: "",
  finishedWidth: "",
  finishedLength: "",
  cutWidth: "",
  cutLength: "",
  consumption: "",
  wastagePct: "5",
  edgeFinish: "",
  workmanship: "",
  spec: "",
  slot: "fabric",
});

export const emptyDraft = (seed?: Partial<StyleDraft>): StyleDraft => ({
  name: "",
  code: "",
  product: "",
  category: "",
  construction: "",
  edgeFinish: "",
  workmanship: "",
  description: "",
  parts: [emptyPart()],
  ...seed,
});

const num = (s: string, fallback = 0) => {
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : fallback;
};

/** Cut size the user has not overridden — the allowances, applied for them. */
export function derivedCut(part: PartDraft): { width: number; length: number } {
  return cutSizeOf({
    finishedWidth: num(part.finishedWidth),
    finishedLength: num(part.finishedLength),
  } as StylePart);
}

export function toStylePart(part: PartDraft): StylePart {
  return {
    name: part.name.trim(),
    type: part.type,
    description: part.description.trim() || part.name.trim(),
    finishedWidth: num(part.finishedWidth),
    finishedLength: num(part.finishedLength),
    // An override is only recorded when the user actually typed one; leaving
    // it undefined keeps `cutSizeOf` as the single source of the derivation.
    cutWidth: part.cutWidth.trim() ? num(part.cutWidth) : undefined,
    cutLength: part.cutLength.trim() ? num(part.cutLength) : undefined,
    consumption: num(part.consumption),
    wastagePct: num(part.wastagePct, 5),
    edgeFinish: part.edgeFinish.trim() || undefined,
    workmanship: part.workmanship.trim() || undefined,
    spec: part.spec.trim() || undefined,
    slot: part.slot,
  };
}

/** The draft as the style it would become — used for preview AND for saving. */
export function toStyleDef(draft: StyleDraft): Omit<StyleDef, "id" | "custom" | "savedAt"> {
  return {
    code: draft.code.trim(),
    name: draft.name.trim(),
    category: draft.category.trim() || "Uncategorised",
    product: draft.product.trim() || undefined,
    construction: draft.construction.trim() || undefined,
    edgeFinish: draft.edgeFinish.trim() || undefined,
    workmanship: draft.workmanship
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
    description: draft.description.trim() || `${draft.name.trim()} — built during pre-costing.`,
    parts: draft.parts.filter((p) => p.name.trim()).map(toStylePart),
  };
}

export type DraftErrors = {
  name?: string;
  code?: string;
  parts?: string;
  /** index → message, for the part that is incomplete */
  part: Record<number, string>;
};

/**
 * Enough validation that a style cannot be saved empty — a nameless style with
 * no parts would seed nothing and still occupy the master list forever.
 */
export function validateDraft(draft: StyleDraft): DraftErrors {
  const errors: DraftErrors = { part: {} };
  if (!draft.name.trim()) errors.name = "Give the style a name.";
  if (!draft.code.trim()) errors.code = "A style code is how the spec sheet refers to it.";

  const named = draft.parts.filter((p) => p.name.trim());
  if (named.length === 0)
    errors.parts = "Add at least one part — a style with no parts seeds nothing.";

  draft.parts.forEach((p, i) => {
    if (!p.name.trim()) return;
    if (num(p.consumption) <= 0) errors.part[i] = "Consumption (m/pc) must be more than zero.";
    else if (num(p.finishedWidth) <= 0 || num(p.finishedLength) <= 0)
      errors.part[i] = "Finished width and length are needed to derive the cut size.";
  });

  return errors;
}

export const draftIsValid = (e: DraftErrors) =>
  !e.name && !e.code && !e.parts && Object.keys(e.part).length === 0;

/** Editing a master style by hand starts from its values, not from blank. */
export function draftFromStyle(style: StyleDef): StyleDraft {
  return {
    name: style.name,
    code: style.code,
    product: style.product ?? "",
    category: style.category,
    construction: style.construction ?? "",
    edgeFinish: style.edgeFinish ?? "",
    workmanship: (style.workmanship ?? []).join("\n"),
    description: style.description,
    parts: style.parts.map((p) => ({
      name: p.name,
      type: p.type,
      description: p.description,
      finishedWidth: String(p.finishedWidth),
      finishedLength: String(p.finishedLength),
      cutWidth: p.cutWidth === undefined ? "" : String(p.cutWidth),
      cutLength: p.cutLength === undefined ? "" : String(p.cutLength),
      consumption: String(p.consumption),
      wastagePct: String(p.wastagePct),
      edgeFinish: p.edgeFinish ?? "",
      workmanship: p.workmanship ?? "",
      spec: p.spec ?? "",
      slot: p.slot,
    })),
  };
}
