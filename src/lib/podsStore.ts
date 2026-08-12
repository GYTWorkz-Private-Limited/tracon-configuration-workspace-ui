import { useSyncExternalStore } from "react";
import { SRFS, IMG } from "./inquiries-data";
import { EXCEL_ARTICLES, EXCEL_POD, ARTICLE_IMAGES } from "./excelArticles";

export type PodStatus = "draft" | "in_progress" | "pending_approval" | "approved" | "completed";
export type ArticleStatus =
  "not_started" | "in_progress" | "pending_approval" | "approved" | "completed";

export type ArticleType = "article" | "kit";

/** One line inside a kit — always points at a real article-level costing item. */
export type KitItem = {
  id: string;
  libraryId?: string;
  /** Costing model this member resolves to — lets the set be costed article by article. */
  srfRef?: string;
  name: string;
  image?: string;
  size?: string;
  moq?: string;
  qty: number;
  optional?: boolean;
  status?: ArticleStatus;
  estUnitCost?: number;
  estSellPrice?: number;
};

/** Provenance of an article — kept for future audit-history / tech-pack sync. */
export type ArticleSource = "seed" | "library" | "techpack" | "costsheet" | "blank" | "manual";

export type Article = {
  id: string;
  name: string;
  description?: string;
  size: string;
  moq: string;
  style?: string;
  image?: string;
  status: ArticleStatus;
  /** Underlying costing session id — reused across the existing AI workspace. */
  srfRef: string;
  updatedAt: string;
  /* ---- article vs kit ---- */
  type?: ArticleType;
  kitItems?: KitItem[];
  collection?: string;
  season?: string;
  category?: string;
  /* ---- provenance / future-ready ---- */
  source?: ArticleSource;
  libraryId?: string;
  techPackRef?: string;
  techPackVersion?: string;
  importedAt?: string;
  audit?: { at: string; action: string; detail?: string }[];
  /* ---- cost-sheet (Excel) fields ---- */
  articleNo?: string;
  designNo?: string;
  styleNo?: string;
  colour?: string;
  supplier?: string;
  composition?: string;
  construction?: string;
  currency?: string;
  fxRate?: string;
  costSheetVersion?: string;
  remarks?: string;
};

export type Pod = {
  id: string;
  buyerRef: string;
  buyer: string;
  preparedBy: string;
  status: PodStatus;
  owner: string;
  createdAt: string;
  updatedAt: string;
  articles: Article[];
};

const STORAGE_KEY = "tracon.pods.v6";

function now() {
  return new Date().toISOString();
}

function seed(): Pod[] {
  // Bundle existing demo SRFs into 3 realistic PODs.
  const byId = Object.fromEntries(SRFS.map((s) => [s.id, s]));
  const mkArticle = (srfId: string, status: ArticleStatus): Article => {
    const s = byId[srfId];
    return {
      id: `A-${srfId}`,
      name: s?.productName ?? "Article",
      description: s?.category,
      size:
        s?.category === "Bath Towel"
          ? "70×140 cm"
          : s?.category === "Cushion Cover"
            ? "45×45 cm"
            : "Std",
      moq: s?.moq ?? "1,000 pcs",
      style: s?.category,
      image: s?.image,
      status,
      srfRef: srfId,
      updatedAt: "2h ago",
    };
  };

  /**
   * A set the buyer orders as one unit. Its members are the SAME articles that
   * sit beside it in the POD, so a kit is never a separate costing — each
   * member is costed on its own article and the set is their sum.
   */
  const tableTopKit: Article = {
    id: "A-KIT-TABLETOP",
    name: "Placemat + Runner",
    description: "Table-top set — printed placemat with coordinated runner",
    size: "Set of 2",
    moq: "1,500 sets",
    status: "not_started",
    srfRef: "SRF-1042",
    updatedAt: "just now",
    type: "kit",
    collection: EXCEL_POD.season,
    currency: EXCEL_POD.currency,
    image: ARTICLE_IMAGES.placemat,
    kitItems: [
      {
        id: "A-PLACEMAT",
        srfRef: "SRF-1042",
        name: "Placemat",
        image: ARTICLE_IMAGES.placemat,
        size: '13" × 19"',
        moq: "3,000 pcs",
        qty: 1,
        status: "not_started",
      },
      {
        id: "A-RUNNER",
        srfRef: "SRF-1031",
        name: "Runner",
        image: ARTICLE_IMAGES.runner,
        size: '14" × 72"',
        moq: "1,500 pcs",
        qty: 1,
        status: "not_started",
      },
    ],
  };

  const excelPod: Pod = {
    id: EXCEL_POD.id,
    buyerRef: EXCEL_POD.buyerRef,
    buyer: EXCEL_POD.buyer,
    preparedBy: EXCEL_POD.preparedBy,
    status: "in_progress",
    owner: EXCEL_POD.preparedBy,
    createdAt: now(),
    updatedAt: "just now",
    articles: [
      ...EXCEL_ARTICLES.map((a): Article => ({
        id: `A-${a.key.toUpperCase()}`,
        name: a.name,
        description: a.description,
        size: a.size,
        moq: a.moq,
        style: a.name,
        image: ARTICLE_IMAGES[a.key],
        status: "not_started" as ArticleStatus,
        srfRef: a.srfRef,
        updatedAt: "just now",
        articleNo: a.articleNo,
        designNo: a.designNo,
        styleNo: a.styleNo,
        colour: a.colour,
        supplier: a.supplier,
        composition: a.composition,
        construction: a.construction,
        currency: EXCEL_POD.currency,
        fxRate: EXCEL_POD.fxRate,
        costSheetVersion: EXCEL_POD.costSheetVersion,
        remarks: a.remarks,
      })),
      tableTopKit,
    ],
  };

  return [
    excelPod,
    {
      id: "POD-2041",
      buyerRef: "ZH-AW26-CUSH-01",
      buyer: "Zara Home",
      preparedBy: "Gautam Kitclu",
      status: "in_progress",
      owner: "Gautam Kitclu",
      createdAt: now(),
      updatedAt: "2h ago",
      articles: [
        mkArticle("SRF-1035", "in_progress"),
        mkArticle("SRF-1042", "not_started"),
        mkArticle("SRF-1036", "not_started"),
      ],
    },
    {
      id: "POD-2038",
      buyerRef: "IKEA-SS26-BED-04",
      buyer: "IKEA",
      preparedBy: "Rahul M.",
      status: "pending_approval",
      owner: "Rahul M.",
      createdAt: now(),
      updatedAt: "1d ago",
      articles: [
        {
          id: "A-SRF-1024",
          name: "Quilt — King",
          description: "Top of Bed — Quilts & Comforters",
          size: '108" × 96" (King)',
          moq: "2,500 pcs",
          style: "Quilt",
          image: byId["SRF-1024"]?.image,
          status: "pending_approval",
          srfRef: "SRF-1024",
          updatedAt: "1d ago",
        },
        mkArticle("SRF-1041", "in_progress"),
      ],
    },
    {
      id: "POD-2032",
      buyerRef: "WE-AW26-HOME-11",
      buyer: "West Elm",
      preparedBy: "Priya S.",
      status: "completed",
      owner: "Priya S.",
      createdAt: now(),
      updatedAt: "4d ago",
      articles: [mkArticle("SRF-1017", "completed"), mkArticle("SRF-1031", "approved")],
    },
  ];
}

let pods: Pod[] = [];
const listeners = new Set<() => void>();

function loadInitial() {
  if (typeof window === "undefined") {
    pods = seed();
    return;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      pods = JSON.parse(raw);
      return;
    }
  } catch {
    // ignore
  }
  pods = seed();
  persist();
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pods));
  } catch {
    // ignore
  }
}

function emit() {
  persist();
  listeners.forEach((l) => l());
}

loadInitial();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Stable list used for SSR + hydration so localStorage edits never mismatch. */
const serverPods: Pod[] = seed();

export function usePods(): Pod[] {
  return useSyncExternalStore(
    subscribe,
    () => pods,
    () => serverPods,
  );
}

export function usePod(id: string): Pod | undefined {
  const all = usePods();
  return all.find((p) => p.id === id);
}

export function getPod(id: string) {
  return pods.find((p) => p.id === id);
}

export function podIdForSrf(srfId: string): string | undefined {
  return pods.find((p) => p.articles.some((a) => a.srfRef === srfId))?.id;
}

function nextPodId() {
  const nums = pods.map((p) => Number(p.id.replace(/\D/g, ""))).filter((n) => !Number.isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 2040) + 1;
  return `POD-${next}`;
}

/** Every new POD starts with the standard table-top article set. */
function defaultArticles(): Article[] {
  return EXCEL_ARTICLES.map((a) => ({
    id: `A-${a.key.toUpperCase()}`,
    name: a.name,
    description: a.description,
    size: a.size,
    moq: a.moq,
    style: a.name,
    image: ARTICLE_IMAGES[a.key],
    status: "not_started" as ArticleStatus,
    srfRef: a.srfRef,
    updatedAt: "just now",
    articleNo: a.articleNo,
    designNo: a.designNo,
    styleNo: a.styleNo,
    colour: a.colour,
    supplier: a.supplier,
    composition: a.composition,
    construction: a.construction,
    currency: EXCEL_POD.currency,
    fxRate: EXCEL_POD.fxRate,
    costSheetVersion: EXCEL_POD.costSheetVersion,
    remarks: a.remarks,
  }));
}

export function createPod(input: { buyerRef: string; buyer: string; preparedBy: string }): Pod {
  const p: Pod = {
    id: nextPodId(),
    buyerRef: input.buyerRef,
    buyer: input.buyer,
    preparedBy: input.preparedBy,
    status: "draft",
    owner: input.preparedBy,
    createdAt: now(),
    updatedAt: "just now",
    articles: defaultArticles(),
  };
  pods = [p, ...pods];
  emit();
  return p;
}

export function updatePod(id: string, patch: Partial<Omit<Pod, "id" | "articles">>) {
  pods = pods.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: "just now" } : p));
  emit();
}

export function deletePod(id: string) {
  pods = pods.filter((p) => p.id !== id);
  emit();
}

const CATEGORY_SRF: Record<string, string> = {
  "Cushion Cover": "SRF-1042",
  "Bath Towel": "SRF-1039",
  "Hand Towel": "SRF-1033",
  Throw: "SRF-1031",
  "Bedding Set": "SRF-1024",
  Curtain: "SRF-1030",
  Scarf: "SRF-1019",
};

/** Pick a demo SRF that best matches the article for costing continuity. */
function pickSrfRef(style?: string): string {
  if (style && CATEGORY_SRF[style]) return CATEGORY_SRF[style];
  return SRFS[0].id;
}

/**
 * Same resolution, exposed for callers that build kit members from the Article
 * Library — a kit item needs an srfRef so the bundle workspace can cost it.
 */
export const srfRefForStyle = pickSrfRef;

function pickImage(style?: string): string {
  if (style?.toLowerCase().includes("cushion")) return IMG.cushion;
  if (style?.toLowerCase().includes("towel")) return IMG.towel;
  if (style?.toLowerCase().includes("throw")) return IMG.throw;
  if (style?.toLowerCase().includes("bed")) return IMG.bedding;
  if (style?.toLowerCase().includes("curtain")) return IMG.curtain;
  if (style?.toLowerCase().includes("scarf")) return IMG.scarf;
  return IMG.cushion;
}

export function addArticle(
  podId: string,
  input: { name: string; description?: string; size: string; moq: string; style?: string },
) {
  const id = `A-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const article: Article = {
    id,
    name: input.name,
    description: input.description,
    size: input.size,
    moq: input.moq,
    style: input.style,
    image: pickImage(input.style),
    status: "not_started",
    srfRef: pickSrfRef(input.style),
    updatedAt: "just now",
  };
  pods = pods.map((p) =>
    p.id === podId ? { ...p, articles: [...p.articles, article], updatedAt: "just now" } : p,
  );
  emit();
  return article;
}

export function updateArticle(podId: string, articleId: string, patch: Partial<Article>) {
  pods = pods.map((p) =>
    p.id === podId
      ? {
          ...p,
          updatedAt: "just now",
          articles: p.articles.map((a) =>
            a.id === articleId ? { ...a, ...patch, updatedAt: "just now" } : a,
          ),
        }
      : p,
  );
  emit();
}

export function deleteArticle(podId: string, articleId: string) {
  pods = pods.map((p) =>
    p.id === podId
      ? { ...p, articles: p.articles.filter((a) => a.id !== articleId), updatedAt: "just now" }
      : p,
  );
  emit();
}

export function markArticlesInProgress(podId: string, articleIds: string[]) {
  pods = pods.map((p) => {
    if (p.id !== podId) return p;
    return {
      ...p,
      status: "in_progress",
      updatedAt: "just now",
      articles: p.articles.map((a) =>
        articleIds.includes(a.id) && a.status === "not_started"
          ? { ...a, status: "in_progress" }
          : a,
      ),
    };
  });
  emit();
}

export const POD_STATUS_LABEL: Record<PodStatus, string> = {
  draft: "Draft",
  in_progress: "In Progress",
  pending_approval: "Pending Approval",
  approved: "Approved",
  completed: "Completed",
};

export const ARTICLE_STATUS_LABEL: Record<ArticleStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  pending_approval: "Pending Approval",
  approved: "Approved",
  completed: "Completed",
};

export function articleProgress(pod: Pod): { costed: number; total: number } {
  const done = pod.articles.filter(
    (a) => a.status === "approved" || a.status === "completed",
  ).length;
  return { costed: done, total: pod.articles.length };
}

/* ------------------------------------------------------------------ */
/* Library + kit intake                                               */
/* ------------------------------------------------------------------ */

function stamp() {
  return new Date().toLocaleString();
}

function rid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

/** Add one or more articles picked from the Article Library. */
export function addLibraryArticles(
  podId: string,
  items: Array<Partial<Article> & { name: string; size: string; moq: string }>,
): Article[] {
  const created: Article[] = items.map((i) => ({
    id: rid("A"),
    status: "not_started" as ArticleStatus,
    srfRef: pickSrfRef(i.style ?? i.category),
    updatedAt: "just now",
    type: "article" as ArticleType,
    source: "library" as ArticleSource,
    importedAt: stamp(),
    audit: [{ at: stamp(), action: "Added from Article Library" }],
    ...i,
  })) as Article[];
  pods = pods.map((p) =>
    p.id === podId ? { ...p, articles: [...p.articles, ...created], updatedAt: "just now" } : p,
  );
  emit();
  return created;
}

/** Add a kit — a single costing item that keeps article-level costing underneath. */
export function addKit(
  podId: string,
  input: {
    name: string;
    buyer?: string;
    collection?: string;
    moq: string;
    currency?: string;
    items: KitItem[];
  },
): Article {
  const kit: Article = {
    id: rid("K"),
    name: input.name,
    description: `${input.items.length} articles · quoted together`,
    size: "Set",
    moq: input.moq,
    style: input.collection,
    image: input.items[0]?.image,
    status: "not_started",
    srfRef: pickSrfRef(input.collection),
    updatedAt: "just now",
    type: "kit",
    kitItems: input.items,
    collection: input.collection,
    currency: input.currency,
    source: "library",
    importedAt: stamp(),
    audit: [{ at: stamp(), action: "Kit created", detail: `${input.items.length} articles` }],
  };
  pods = pods.map((p) =>
    p.id === podId ? { ...p, articles: [...p.articles, kit], updatedAt: "just now" } : p,
  );
  emit();
  return kit;
}

/** Future-ready: clone an existing article or kit inside the same POD. */
export function cloneArticle(podId: string, articleId: string) {
  const pod = pods.find((p) => p.id === podId);
  const src = pod?.articles.find((a) => a.id === articleId);
  if (!src) return;
  const copy: Article = {
    ...src,
    id: rid(src.type === "kit" ? "K" : "A"),
    name: `${src.name} (Copy)`,
    status: "not_started",
    updatedAt: "just now",
    audit: [...(src.audit ?? []), { at: stamp(), action: "Cloned", detail: src.id }],
  };
  pods = pods.map((p) =>
    p.id === podId ? { ...p, articles: [...p.articles, copy], updatedAt: "just now" } : p,
  );
  emit();
  return copy;
}

/** Costed count for a kit, based on its underlying article lines. */
export function kitProgress(a: Article): { costed: number; total: number } {
  const items = a.kitItems ?? [];
  const costed = items.filter((i) => i.status === "approved" || i.status === "completed").length;
  return { costed, total: items.length };
}
