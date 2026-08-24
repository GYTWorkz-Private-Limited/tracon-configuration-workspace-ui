/**
 * Reviewer assignment and status for a quotation sent for commercial approval.
 *
 * Deliberately holds only PROCESS state — who is reviewing, what they have
 * said — never a copy of the quotation itself. The approval screen reads the
 * live `QuoteDraft` through `quotationView`, so there is exactly one
 * quotation object; this store is the workflow wrapped around it.
 *
 * Mirrors the reviewer-assignment/submit/status pattern already used for
 * costing sign-off (`ApprovalWorkspace`) — same team structure, same demo
 * simulate-on-submit behaviour — so approval feels like one mechanism used
 * twice, not two different ones.
 */

import { useSyncExternalStore } from "react";

export type ReviewTeam = { id: string; label: string; note: string; members: string[] };

export const REVIEW_TEAMS: ReviewTeam[] = [
  {
    id: "merch",
    label: "Merchandiser",
    note: "Confirms buyer expectations",
    members: ["Sana V.", "Karthik R."],
  },
  {
    id: "commercial",
    label: "Commercial Manager",
    note: "Signs off pricing & margin",
    members: ["Meera K.", "Rohit P."],
  },
  {
    id: "management",
    label: "Management",
    note: "Final approval before it goes to the buyer",
    members: ["Anil D.", "Gautam K."],
  },
];

export type ReviewStatus = "pending" | "approved" | "changes";

export type QuotationApproval = {
  podId: string;
  submitted: boolean;
  submittedAt?: string;
  submittedBy?: string;
  assign: Record<string, string[]>;
  /** keyed `${teamId}:${person}` */
  reviewStatus: Record<string, ReviewStatus>;
};

type State = Record<string, QuotationApproval>;

const STORAGE_KEY = "tracon.quotationApproval.v1";

const emptyAssign = (): Record<string, string[]> =>
  Object.fromEntries(REVIEW_TEAMS.map((t) => [t.id, []]));

const blank = (podId: string): QuotationApproval => ({
  podId,
  submitted: false,
  assign: emptyAssign(),
  reviewStatus: {},
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

export function useQuotationApprovals(): State {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => serverState,
  );
}

export function useQuotationApproval(podId: string): QuotationApproval {
  return useQuotationApprovals()[podId] ?? blank(podId);
}

function write(podId: string, fn: (a: QuotationApproval) => QuotationApproval) {
  const current = state[podId] ?? blank(podId);
  state = { ...state, [podId]: fn(current) };
  emit();
}

export function toggleReviewer(podId: string, teamId: string, person: string) {
  write(podId, (a) => {
    const current = a.assign[teamId] ?? [];
    const next = current.includes(person)
      ? current.filter((p) => p !== person)
      : [...current, person];
    return { ...a, assign: { ...a.assign, [teamId]: next } };
  });
}

/** Everyone assigned, flattened to `${teamId}:${person}` keys. */
export function assignedPeople(a: QuotationApproval): string[] {
  return REVIEW_TEAMS.flatMap((t) => (a.assign[t.id] ?? []).map((p) => `${t.id}:${p}`));
}

export const allTeamsAssigned = (a: QuotationApproval): boolean =>
  REVIEW_TEAMS.every((t) => (a.assign[t.id]?.length ?? 0) > 0);

/**
 * Send for approval. Demo simulate, matching the costing sign-off pattern:
 * the merchandiser team approves immediately and everyone else is pending —
 * so the reviewer list has movement to show, while the quotation itself sits
 * honestly in Pending Approval. (It used to simulate a "changes" verdict too,
 * which threw every real send straight into the Revised lane of the pipeline
 * and made Pending Approval unreachable from the UI.)
 */
export function submitQuotationForApproval(podId: string, by = "Gautam Kitclu") {
  write(podId, (a) => {
    const people = assignedPeople(a);
    const reviewStatus: Record<string, ReviewStatus> = {};
    for (const key of people) {
      if (key.startsWith("merch:")) reviewStatus[key] = "approved";
      else reviewStatus[key] = "pending";
    }
    return {
      ...a,
      submitted: true,
      submittedAt: new Date().toISOString(),
      submittedBy: by,
      reviewStatus,
    };
  });
}

export function setReviewStatus(podId: string, personKey: string, status: ReviewStatus) {
  write(podId, (a) => ({ ...a, reviewStatus: { ...a.reviewStatus, [personKey]: status } }));
}

/**
 * The approval is granted.
 *
 * Records every assigned reviewer as approved rather than flipping a separate
 * "approved" flag, so the reviewer list and the quotation's stage are always
 * telling the same story — a quotation cannot read Approved while the panel
 * beside it still shows people pending.
 */
export function approveQuotation(quotationId: string) {
  write(quotationId, (a) => ({
    ...a,
    reviewStatus: Object.fromEntries(
      assignedPeople(a).map((key) => [key, "approved" as ReviewStatus]),
    ),
  }));
}

/** Send the quotation back: every reviewer's position becomes "changes". */
export function rejectQuotation(quotationId: string) {
  write(quotationId, (a) => ({
    ...a,
    reviewStatus: Object.fromEntries(
      assignedPeople(a).map((key) => [key, "changes" as ReviewStatus]),
    ),
  }));
}
