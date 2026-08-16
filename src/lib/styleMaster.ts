/**
 * Style master — the step BEFORE material selection.
 *
 * A style answers "what parts does this product have?" so the costing team
 * never starts from a blank component table: selecting a style seeds every
 * part with its dimensions and a pinned cut-size consumption, and the user
 * then assigns fabric/trim per part from the library exactly as before.
 *
 * The style deliberately stops at PARTS. It carries no material, no rate and
 * no process — those stay decisions of the costing team, which is why
 * `applyStyleParts` leaves `material` undefined on every seeded component.
 *
 * The per-article style CHOICE (including "manual" — the user declined the
 * master and builds part by part) is persisted here too, following the
 * `recostingStore` localStorage + useSyncExternalStore pattern so every
 * screen showing the article agrees on how its build started.
 */

import { useSyncExternalStore } from "react";
import type { ComponentDef, ComponentType, ConsumptionRule } from "./costingModel";

/* ------------------------------------------------------------------ *
 * Style definitions
 * ------------------------------------------------------------------ */

export type StylePart = {
  name: string;
  /** a `ComponentType` string — kept as string so style data stays plain */
  type: string;
  description: string;
  /** finished dimensions, inches */
  finishedWidth: number;
  finishedLength: number;
  /**
   * CUT size, inches — finished plus the seam and hem the cutter actually
   * lays. The spec sheet states both because they answer different questions:
   * finished is what the buyer measures, cut is what the marker consumes.
   */
  cutWidth?: number;
  cutLength?: number;
  /** metres per piece, cut-size — pinned onto the seeded rule as an override */
  consumption: number;
  wastagePct: number;
  /** how this part's edges are closed — hem, mitre, piping, overlock */
  edgeFinish?: string;
  /** the workmanship this part demands, as the spec sheet words it */
  workmanship?: string;
  /** component-specific specification — GSM, count, construction note */
  spec?: string;
  /** which library the user will pick this part's material from */
  slot: "fabric" | "trim";
};

export type StyleDef = {
  id: string;
  /** style code as the spec sheet prints it */
  code: string;
  name: string;
  category: string;
  /** the product/article this style makes */
  product?: string;
  /** construction / style type — "Two-panel, bagged out", "Single ply hemmed" */
  construction?: string;
  /** the style's overall edge treatment, when it has one rule */
  edgeFinish?: string;
  /** workmanship notes that belong to the style rather than one part */
  workmanship?: string[];
  description: string;
  parts: StylePart[];
  /**
   * Styles the team built by hand and saved. A master is a shared asset, so a
   * saved style says who added it and when — an unattributed row in a master
   * list is one nobody will dare delete later.
   */
  custom?: boolean;
  savedAt?: string;
  savedBy?: string;
};

/** The recorded choice when the user opts OUT of the master. */
export const MANUAL_STYLE_ID = "manual";

export const STYLE_MASTER: StyleDef[] = [
  {
    id: "sty-plm-bordered",
    code: "STY-PLM-201",
    name: "Bordered Placemat",
    category: "Table Linen",
    product: "Placemat",
    construction: "Two-panel, bagged out with mitred contrast border",
    edgeFinish: "Mitred border, corded piping in the perimeter seam",
    workmanship: [
      "Single needle lockstitch, 10-11 SPI",
      "Piping inserted continuous, joins hidden at one corner",
      "Border mitres matched at all four corners",
    ],
    description: "Two-panel placemat with a contrast border and corded piping in the seam.",
    parts: [
      {
        name: "Front Panel",
        type: "Self Fabric Panel",
        description: "Face panel, the visible top of the placemat.",
        finishedWidth: 13,
        finishedLength: 19,
        consumption: 0.24,
        wastagePct: 8,
        slot: "fabric",
      },
      {
        name: "Back Panel",
        type: "Self Fabric Panel",
        description: "Backing panel on the reverse face.",
        finishedWidth: 13,
        finishedLength: 19,
        consumption: 0.22,
        wastagePct: 5,
        slot: "fabric",
      },
      {
        name: "Border",
        type: "Trim / Self Fabric",
        description: "Mitred contrast border on all four edges.",
        finishedWidth: 1.5,
        finishedLength: 64,
        consumption: 0.18,
        wastagePct: 5,
        slot: "fabric",
      },
      {
        name: "Piping",
        type: "Trim",
        description: "Ready-made corded piping inserted in the perimeter seam.",
        finishedWidth: 0.5,
        finishedLength: 66,
        consumption: 1.75,
        wastagePct: 4,
        slot: "trim",
      },
    ],
  },
  {
    id: "sty-run-tassel",
    code: "STY-RUN-118",
    name: "Table Runner — Tasselled",
    category: "Table Linen",
    product: "Table Runner",
    construction: "Face and backing bagged out, pointed ends, turned through",
    edgeFinish: 'Bagged-out edge, topstitched 1/8" from the seam',
    workmanship: [
      "Points trimmed and turned square before topstitch",
      "Tassel cord anchored through both plies at each point",
    ],
    description: "Lined runner with pointed ends finished in tassels on cord.",
    parts: [
      {
        name: "Top Panel",
        type: "Self Fabric Panel",
        description: "Face panel running the full table length.",
        finishedWidth: 14,
        finishedLength: 72,
        consumption: 1.95,
        wastagePct: 6,
        slot: "fabric",
      },
      {
        name: "Backing",
        type: "Lining",
        description: "Full backing cloth, bagged out with the face.",
        finishedWidth: 14,
        finishedLength: 72,
        consumption: 1.9,
        wastagePct: 5,
        slot: "fabric",
      },
      {
        name: "End Facing",
        type: "Trim / Self Fabric",
        description: "Facing strip stabilising each pointed end.",
        finishedWidth: 14,
        finishedLength: 3,
        consumption: 0.12,
        wastagePct: 5,
        slot: "fabric",
      },
      {
        name: "Tassel Cord",
        type: "Trim",
        description: "Cord with end tassels, one at each point.",
        finishedWidth: 0.5,
        finishedLength: 7,
        consumption: 0.35,
        wastagePct: 3,
        slot: "trim",
      },
    ],
  },
  {
    id: "sty-duv-piped",
    code: "STY-DUV-402",
    name: "Duvet Set — Piped",
    category: "Bed Linen",
    product: "Duvet Cover — Queen",
    construction: "Two-panel cover, self-piped perimeter, concealed zip at foot",
    edgeFinish: "Self-fabric bias piping on all four sides",
    workmanship: [
      "Bias strips cut at 45° across the width",
      "Zip guard flap bar-tacked at both ends",
      "French seam on the internal flap",
    ],
    description: "Queen duvet cover with self-piped edges, zip closure and internal flap.",
    parts: [
      {
        name: "Top Panel",
        type: "Self Fabric Panel",
        description: "Printed/face side of the duvet cover.",
        finishedWidth: 90,
        finishedLength: 94,
        consumption: 3.4,
        wastagePct: 5,
        slot: "fabric",
      },
      {
        name: "Bottom Panel",
        type: "Self Fabric Panel",
        description: "Reverse side, plain or coordinate.",
        finishedWidth: 90,
        finishedLength: 94,
        consumption: 3.35,
        wastagePct: 5,
        slot: "fabric",
      },
      {
        name: "Piping",
        type: "Trim / Self Fabric",
        // 1.5" bias strips cut across the width — 9m of piping is only ~0.3m of cloth
        description: "Self-fabric bias piping around the perimeter seam.",
        finishedWidth: 1.5,
        finishedLength: 368,
        consumption: 0.3,
        wastagePct: 8,
        slot: "fabric",
      },
      {
        name: "Zip Guard Flap",
        type: "Trim / Self Fabric",
        description: "Internal flap shielding the zipper from the filler.",
        finishedWidth: 3,
        finishedLength: 90,
        consumption: 0.28,
        wastagePct: 5,
        slot: "fabric",
      },
      {
        name: "Concealed Zipper",
        type: "Trim",
        description: "Continuous concealed zipper along the bottom opening.",
        finishedWidth: 1,
        finishedLength: 90,
        consumption: 2.3,
        wastagePct: 2,
        slot: "trim",
      },
    ],
  },
  {
    id: "sty-apr-classic",
    code: "STY-APR-305",
    name: "Apron — Classic",
    category: "Kitchen Linen",
    product: "Bib Apron",
    construction: "One-piece body, self-fabric ties and neck strap, patch pocket",
    edgeFinish: 'Double-fold hem 1/2" on all edges',
    workmanship: [
      "Ties folded four-ply and edge-stitched",
      "Pocket bar-tacked at both top corners and at the divide",
    ],
    description: "Bib apron with waist ties, adjustable neck strap and a patch pocket.",
    parts: [
      {
        name: "Body",
        type: "Self Fabric Panel",
        description: "One-piece bib-and-skirt body panel.",
        finishedWidth: 24,
        finishedLength: 32,
        consumption: 0.95,
        wastagePct: 6,
        slot: "fabric",
      },
      {
        name: "Waist Ties",
        type: "Trim / Self Fabric",
        description: "Pair of self-fabric waist ties, folded and topstitched.",
        finishedWidth: 2.5,
        finishedLength: 36,
        consumption: 0.15,
        wastagePct: 5,
        slot: "fabric",
      },
      {
        name: "Neck Strap",
        type: "Trim / Self Fabric",
        description: "Neck loop, self fabric over the head or slider-adjusted.",
        finishedWidth: 2.5,
        finishedLength: 22,
        consumption: 0.08,
        wastagePct: 5,
        slot: "fabric",
      },
      {
        name: "Patch Pocket",
        type: "Trim / Self Fabric",
        description: "Divided patch pocket on the skirt front.",
        finishedWidth: 8,
        finishedLength: 7,
        consumption: 0.12,
        wastagePct: 5,
        slot: "fabric",
      },
    ],
  },
];

/**
 * Cut size, when the style did not state one.
 *
 * The seeded parts carry finished dimensions and the consumption rule's own
 * seam and hem allowances; cut size is what those add up to. Deriving it keeps
 * one source of truth — a hand-typed cut size would be free to drift from the
 * geometry the consumption was actually calculated on.
 */
export const SEAM_ALLOWANCE = 0.5;
export const HEM_ALLOWANCE = 0.5;

export function cutSizeOf(part: StylePart): { width: number; length: number } {
  return {
    width: part.cutWidth ?? part.finishedWidth + SEAM_ALLOWANCE * 2,
    length: part.cutLength ?? part.finishedLength + HEM_ALLOWANCE * 2,
  };
}

export const cutSizeLabel = (part: StylePart) => {
  const { width, length } = cutSizeOf(part);
  return `${width}" × ${length}"`;
};

export function styleById(styleId: string | undefined): StyleDef | undefined {
  if (!styleId || styleId === MANUAL_STYLE_ID) return undefined;
  return [...STYLE_MASTER, ...customStyles].find((s) => s.id === styleId);
}

/** Every style the picker can offer — the shipped master plus saved ones. */
export function allStyles(): StyleDef[] {
  return [...customStyles, ...STYLE_MASTER];
}

/* ------------------------------------------------------------------ *
 * Style → components
 * ------------------------------------------------------------------ */

/**
 * Build real `ComponentDef` rows from a style's parts.
 *
 * The seeded rule keeps the full Area-Based input set (dimensions, wastage,
 * fabric width) so the inspector can show HOW the number was derived, but the
 * style's cut-size consumption is pinned via `overrideConsumption` — the
 * master's figure is the contract, not whatever the formula lands on for a
 * fabric the user has not picked yet. `material` stays undefined on purpose:
 * assigning fabric/trim from the library is the user's next step.
 */
export function applyStyleParts(styleId: string): ComponentDef[] {
  const style = styleById(styleId);
  if (!style) return [];

  return style.parts.map((part, i) => {
    const id = `cmp-style-${style.id}-${i}`;

    const consumption: ConsumptionRule = {
      id: `cr-style-${style.id}-${i}`,
      method: "Area-Based",
      formula:
        "((W + seam) × (L + hem) × shrinkage × wastage) ÷ (costing_width × marker_efficiency) ÷ 39.37",
      formulaVersion: "v2.1",
      unit: "mtr",
      finishedWidth: part.finishedWidth,
      finishedLength: part.finishedLength,
      seamAllowance: 0.5,
      hemAllowance: 0.5,
      shrinkagePct: 5,
      wastagePct: part.wastagePct,
      fabricWidth: 58,
      markerEfficiency: 0.81,
      plies: 1,
      quantity: 1,
      overrideConsumption: part.consumption,
      overrideReason: `Cut-size consumption from style master ${style.code}`,
      source: "Style Master",
    };

    return {
      id,
      productId: "styled",
      name: part.name,
      // Style data keeps `type` as a plain string; the cast is safe because
      // every STYLE_MASTER part uses a literal from the ComponentType union.
      type: part.type as ComponentType,
      description: part.description,
      usage: part.slot === "fabric" ? "Main construction" : "Trim / closure",
      required: false,
      quantity: 1,
      // Continue after the product's own seed rows, which stop below 10.
      sequence: 10 + i,
      relatedComponentIds: [],
      active: true,
      material: undefined,
      consumption,
      processes: [],
      accessories: [],
    };
  });
}

/* ------------------------------------------------------------------ *
 * Styles the team saved — a manual build promoted to a reusable master
 * ------------------------------------------------------------------ */

/**
 * A style built by hand is worth keeping only if the next order can find it.
 * Saving one writes it beside the shipped master and it behaves identically
 * from then on — same picker, same seeding, same confirmation summary — which
 * is the whole point of "Save as Style Master": the second time this product
 * is costed, nobody types the parts again.
 */
const CUSTOM_KEY = "tracon.customStyles.v1";

let customStyles: StyleDef[] = [];
const customListeners = new Set<() => void>();

function isStyleList(value: unknown): value is StyleDef[] {
  return (
    Array.isArray(value) &&
    value.every(
      (s) =>
        Boolean(s) &&
        typeof s === "object" &&
        typeof (s as StyleDef).id === "string" &&
        Array.isArray((s as StyleDef).parts),
    )
  );
}

function loadCustom() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(CUSTOM_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    // Stored state outlives the code that wrote it: a saved style with the
    // wrong shape is dropped rather than allowed to break every picker.
    if (isStyleList(parsed)) customStyles = parsed;
  } catch {
    customStyles = [];
  }
}

function emitCustom() {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(CUSTOM_KEY, JSON.stringify(customStyles));
    } catch {
      // ignore
    }
  }
  customListeners.forEach((l) => l());
}

loadCustom();

function subscribeCustom(cb: () => void) {
  customListeners.add(cb);
  return () => customListeners.delete(cb);
}

/** Stable empty snapshot so SSR and the first client render agree. */
const serverCustom: StyleDef[] = [];

export function useCustomStyles(): StyleDef[] {
  return useSyncExternalStore(
    subscribeCustom,
    () => customStyles,
    () => serverCustom,
  );
}

/** Every style the picker can offer, subscribed. */
export function useAllStyles(): StyleDef[] {
  const custom = useCustomStyles();
  return [...custom, ...STYLE_MASTER];
}

export function saveCustomStyle(
  style: Omit<StyleDef, "id" | "custom" | "savedAt">,
  savedBy = "You",
): StyleDef {
  const saved: StyleDef = {
    ...style,
    id: `sty-custom-${Math.random().toString(36).slice(2, 8)}`,
    custom: true,
    savedAt: new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    savedBy,
  };
  customStyles = [saved, ...customStyles];
  emitCustom();
  return saved;
}

export function deleteCustomStyle(styleId: string) {
  if (!customStyles.some((s) => s.id === styleId)) return;
  customStyles = customStyles.filter((s) => s.id !== styleId);
  emitCustom();
}

/* ------------------------------------------------------------------ *
 * Per-article style choice — persisted, cross-screen
 * ------------------------------------------------------------------ */

type State = Record<string, string>;

const STORAGE_KEY = "tracon.articleStyle.v1";

const styleKey = (podId: string, articleId: string) => `${podId}::${articleId}`;

let state: State = {};
const listeners = new Set<() => void>();

function load() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    // Shape check — a stale or hand-edited entry must not crash every screen
    // that renders an article, so anything but Record<string, string> is dropped.
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      state = Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).filter(
          ([, v]) => typeof v === "string",
        ) as [string, string][],
      );
    }
  } catch {
    state = {};
  }
}

function emit() {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }
  listeners.forEach((l) => l());
}

load();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// Stable empty snapshot — SSR must always see "no choice made yet".
const serverState: State = {};

export function useStyleChoices(): State {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => serverState,
  );
}

/** Subscribed read of one article's choice — a style id, "manual", or nothing yet. */
export function useStyleFor(podId?: string, articleId?: string): string | undefined {
  const all = useStyleChoices();
  if (!podId || !articleId) return undefined;
  return all[styleKey(podId, articleId)];
}

export function setStyleFor(podId: string, articleId: string, styleId: string) {
  state = { ...state, [styleKey(podId, articleId)]: styleId };
  emit();
}

/** Withdraw the choice — the picker banner comes back and the user re-decides. */
export function clearStyleFor(podId: string, articleId: string) {
  const key = styleKey(podId, articleId);
  if (!(key in state)) return;
  const next = { ...state };
  delete next[key];
  state = next;
  emit();
}
