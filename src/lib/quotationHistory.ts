/**
 * What happened to a quotation, and what was sent.
 *
 * Two different records, deliberately kept apart:
 *
 *   AUDIT   — every change anybody made to the working quotation, append-only.
 *             It answers "who moved this number, and when".
 *   VERSION — the quotation as it stood the moment it was SENT for approval,
 *             frozen. It answers "what did the buyer actually receive".
 *
 * A version is a snapshot because the draft keeps moving: the quote re-costs
 * itself from Configuration on every read, so without freezing the figures at
 * send time there would be no way to say what v1 contained once someone
 * re-costed an article for v2.
 *
 * Nothing here holds a second copy of the LIVE quotation — the working
 * document stays `quoteDraftStore`, priced by `quotationView`.
 *
 * Keyed by QUOTATION, not by POD: a POD can carry several quotations at once,
 * and each has its own versions, comments and audit.
 */

import { useSyncExternalStore } from "react";

export type VersionStatus = "sent" | "approved" | "changes_requested" | "superseded";

export type AuditKind =
  | "quotation_started"
  | "item_added"
  | "item_removed"
  | "line_added"
  | "line_removed"
  | "quoted_line_changed"
  | "moq_override"
  | "margin_changed"
  | "total_cost_edited"
  | "total_cost_reset"
  | "selling_price_edited"
  | "selling_price_reset"
  | "option_changed"
  | "recost_requested"
  | "sent_for_approval"
  | "version_started"
  | "comment"
  | "approval_status";

export type AuditEntry = {
  id: string;
  at: string;
  by: string;
  kind: AuditKind;
  /** one line, past tense — what a reader needs to understand the change */
  summary: string;
  /** the version this happened under, when one was open */
  versionNo?: number;
};

export type QuotationComment = {
  id: string;
  at: string;
  by: string;
  text: string;
  /** the version being commented on */
  versionNo: number;
};

/** One line of a frozen version — enough to read the quote back without it. */
export type VersionLine = {
  name: string;
  kind: "product" | "kit";
  quantity: number;
  quantityLabel: string;
  finalCostInr: number;
  sellingUsd: number;
  marginPct: number;
  orderValueUsd: number;
};

export type QuotationVersion = {
  id: string;
  no: number;
  quotationId: string;
  status: VersionStatus;
  sentAt: string;
  sentBy: string;
  note?: string;
  lines: VersionLine[];
  orderValueUsd: number;
  blendedMarginPct: number;
};

export type QuotationHistory = {
  quotationId: string;
  versions: QuotationVersion[];
  audit: AuditEntry[];
  comments: QuotationComment[];
  /**
   * A sent quotation is read-only until somebody explicitly opens the next
   * version. That is what makes "what was sent" mean something.
   */
  locked: boolean;
};

type State = Record<string, QuotationHistory>;

const STORAGE_KEY = "tracon.quotationHistory.v2";

const blank = (quotationId: string): QuotationHistory => ({
  quotationId,
  versions: [],
  audit: [],
  comments: [],
  locked: false,
});

let state: State = {};
const listeners = new Set<() => void>();

function load() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) state = JSON.parse(raw) as State;
  } catch {
    state = {};
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function emit() {
  persist();
  listeners.forEach((l) => l());
}

load();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const serverState: State = {};

function useHistories(): State {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => serverState,
  );
}

export function useQuotationHistory(quotationId: string): QuotationHistory {
  return useHistories()[quotationId] ?? blank(quotationId);
}

/** Every quotation that has any history — for the Quotations list. */
export function useAllQuotationHistories(): State {
  return useHistories();
}

let seq = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

function write(quotationId: string, fn: (h: QuotationHistory) => QuotationHistory) {
  state = { ...state, [quotationId]: fn(state[quotationId] ?? blank(quotationId)) };
  emit();
}

/** Unsubscribed read — for event handlers and stores, never for render. */
export function historyOf(quotationId: string): QuotationHistory {
  return state[quotationId] ?? blank(quotationId);
}

export const latestVersion = (h: QuotationHistory): QuotationVersion | undefined =>
  h.versions[h.versions.length - 1];

/** The version number changes made right now will be sent under. */
export const workingVersionNo = (h: QuotationHistory): number => h.versions.length + 1;

/* ------------------------------------------------------------------ *
 * Audit
 * ------------------------------------------------------------------ */

/**
 * Record a change. Called from the draft store rather than from components, so
 * a change made from a new screen tomorrow is logged without that screen
 * having to remember to log it.
 */
export function logQuotationEvent(
  quotationId: string,
  kind: AuditKind,
  summary: string,
  by = "Gautam Kitclu",
) {
  write(quotationId, (h) => ({
    ...h,
    audit: [
      ...h.audit,
      {
        id: uid("AU"),
        at: new Date().toISOString(),
        by,
        kind,
        summary,
        versionNo: h.versions.length + 1,
      },
    ],
  }));
}

/* ------------------------------------------------------------------ *
 * Versions
 * ------------------------------------------------------------------ */

/**
 * Freeze the quotation and send it. Returns the version number created.
 *
 * The caller passes the priced lines because pricing lives in
 * `quotationView` — this module stores history, it does not compute money.
 */
export function sendVersionForApproval(
  quotationId: string,
  snapshot: { lines: VersionLine[]; orderValueUsd: number; blendedMarginPct: number },
  by = "Gautam Kitclu",
  note?: string,
): number {
  const h = historyOf(quotationId);
  const no = h.versions.length + 1;
  const version: QuotationVersion = {
    id: uid("QV"),
    no,
    quotationId,
    status: "sent",
    sentAt: new Date().toISOString(),
    sentBy: by,
    note,
    lines: snapshot.lines,
    orderValueUsd: snapshot.orderValueUsd,
    blendedMarginPct: snapshot.blendedMarginPct,
  };
  write(quotationId, (cur) => ({
    ...cur,
    versions: [...cur.versions, version],
    locked: true,
    audit: [
      ...cur.audit,
      {
        id: uid("AU"),
        at: version.sentAt,
        by,
        kind: "sent_for_approval",
        summary: `Version ${no} sent for approval — ${snapshot.lines.length} line${snapshot.lines.length === 1 ? "" : "s"}, $${snapshot.orderValueUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
        versionNo: no,
      },
    ],
  }));
  return no;
}

/**
 * Open the next version for editing.
 *
 * The buyer has come back and wants it re-costed, so the sent version is
 * marked superseded — it stays readable, it just stops being the current
 * position — and the working quotation becomes editable again.
 */
export function startNewVersion(quotationId: string, by = "Gautam Kitclu") {
  write(quotationId, (h) => {
    if (h.versions.length === 0) return { ...h, locked: false };
    const no = h.versions.length + 1;
    return {
      ...h,
      locked: false,
      versions: h.versions.map((v, i) =>
        i === h.versions.length - 1 && v.status === "sent" ? { ...v, status: "superseded" } : v,
      ),
      audit: [
        ...h.audit,
        {
          id: uid("AU"),
          at: new Date().toISOString(),
          by,
          kind: "version_started",
          summary: `Version ${no} opened for re-costing`,
          versionNo: no,
        },
      ],
    };
  });
}

export function setVersionStatus(quotationId: string, versionId: string, status: VersionStatus) {
  write(quotationId, (h) => {
    const v = h.versions.find((x) => x.id === versionId);
    if (!v) return h;
    return {
      ...h,
      versions: h.versions.map((x) => (x.id === versionId ? { ...x, status } : x)),
      audit: [
        ...h.audit,
        {
          id: uid("AU"),
          at: new Date().toISOString(),
          by: "Gautam Kitclu",
          kind: "approval_status",
          summary: `Version ${v.no} marked ${STATUS_LABEL[status].toLowerCase()}`,
          versionNo: v.no,
        },
      ],
    };
  });
}

/* ------------------------------------------------------------------ *
 * Comments
 * ------------------------------------------------------------------ */

export function addQuotationComment(
  quotationId: string,
  versionNo: number,
  text: string,
  by = "Gautam Kitclu",
) {
  const trimmed = text.trim();
  if (!trimmed) return;
  write(quotationId, (h) => ({
    ...h,
    comments: [
      ...h.comments,
      { id: uid("QC"), at: new Date().toISOString(), by, text: trimmed, versionNo },
    ],
    audit: [
      ...h.audit,
      {
        id: uid("AU"),
        at: new Date().toISOString(),
        by,
        kind: "comment",
        summary: `Comment added on version ${versionNo}`,
        versionNo,
      },
    ],
  }));
}

/** Anything a user can add, a user can take back. */
export function removeQuotationComment(quotationId: string, commentId: string) {
  write(quotationId, (h) => ({ ...h, comments: h.comments.filter((c) => c.id !== commentId) }));
}

export const STATUS_LABEL: Record<VersionStatus, string> = {
  sent: "Sent for approval",
  approved: "Approved",
  changes_requested: "Changes requested",
  superseded: "Superseded",
};
