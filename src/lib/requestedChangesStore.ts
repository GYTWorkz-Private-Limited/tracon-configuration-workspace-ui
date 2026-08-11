// Requested Changes + revision tracking for the Cost Intelligence flow.
// Pure client-side mock store with a tiny subscribe API (useSyncExternalStore).

import { useSyncExternalStore } from "react";

export type ChangeModule =
  | "Product"
  | "Fabric"
  | "Printing"
  | "Embroidery"
  | "Washing"
  | "Manufacturing"
  | "Accessories"
  | "Costing";

export type RequestedChange = {
  id: string;
  module: ChangeModule;
  field: string;
  requestedBy: string;
  requestedRole: string;
  requestedAt: string;
  currentValue: string;
  requestedValue: string;
  comment: string;
  reason: string;
  status: "Pending" | "Completed";
  completedAt?: string;
};

export type Revision = {
  id: string;
  version: number;
  createdAt: string;
  createdBy: string;
  status: "Approved" | "Changes requested" | "Working copy" | "Submitted for approval";
  comments: string;
};

/** Workflow steps a requested change can belong to. */
export type ChangeStep = "Product" | "Configuration" | "Costing" | "Costing Report";

export function stepForModule(m: ChangeModule): ChangeStep {
  if (m === "Product") return "Product";
  if (m === "Costing") return "Costing";
  return "Configuration";
}

export const CHANGE_STEPS: ChangeStep[] = ["Product", "Configuration", "Costing", "Costing Report"];

type State = {
  changes: RequestedChange[];
  revisions: Revision[];
  /** the version currently being edited (working copy), if any */
  workingVersion: number | null;
  /** true once the costing has been sent for approval — gates header actions */
  submitted: boolean;
  /** true once every reviewer has approved the resubmitted revision */
  approvalDone: boolean;
  /** persistent requested-changes tray visible across Product/Config/Costing */
  dockOpen: boolean;
  /** tray collapsed to the bottom strip */
  dockMinimized: boolean;
  /** overlays that render their own grouped header actions */
  actionHosts: number;
  /** field the user jumped to from revision history */
  highlight: { step: ChangeStep; field: string } | null;
};

const seedChanges: RequestedChange[] = [
  {
    id: "rc-1",
    module: "Fabric",
    field: "Supplier",
    requestedBy: "Meera K.",
    requestedRole: "Costing Manager",
    requestedAt: "04 Aug 2026, 09:12",
    currentValue: "TESPL",
    requestedValue: "ABC Textiles",
    comment: "ABC Textiles quoted 6% lower on the same construction last month.",
    reason: "Reduce material cost.",
    status: "Pending",
  },
  {
    id: "rc-2",
    module: "Fabric",
    field: "Fabric wastage %",
    requestedBy: "Meera K.",
    requestedRole: "Costing Manager",
    requestedAt: "04 Aug 2026, 09:14",
    currentValue: "5.0%",
    requestedValue: "3.0%",
    comment: "5% wastage is high for this weave — mill confirmed 3% is achievable.",
    reason: "Align wastage with mill confirmation.",
    status: "Pending",
  },
  {
    id: "rc-3",
    module: "Costing",
    field: "Target margin",
    requestedBy: "Sana V.",
    requestedRole: "Merchandiser",
    requestedAt: "04 Aug 2026, 10:05",
    currentValue: "26.0%",
    requestedValue: "24.0%",
    comment: "Buyer target is tight at this MOQ. Hold 24% to stay inside the landed target.",
    reason: "Meet buyer target price.",
    status: "Pending",
  },
  {
    id: "rc-4",
    module: "Manufacturing",
    field: "Stitching cost",
    requestedBy: "Vikram S.",
    requestedRole: "Costing Assistant",
    requestedAt: "04 Aug 2026, 10:22",
    currentValue: "₹18.00",
    requestedValue: "₹16.50",
    comment: "Karur unit rate revision came in lower for this style — update the sheet.",
    reason: "Use latest unit rate.",
    status: "Pending",
  },
  {
    id: "rc-5",
    module: "Product",
    field: "MOQ",
    requestedBy: "Anil D.",
    requestedRole: "Management",
    requestedAt: "04 Aug 2026, 10:40",
    currentValue: "3,000 pcs",
    requestedValue: "5,000 pcs",
    comment: "Buyer indicated a larger first drop. Re-cost at 5,000 pcs.",
    reason: "Buyer volume revision.",
    status: "Pending",
  },
];

const seedRevisions: Revision[] = [
  {
    id: "rev-1",
    version: 1,
    createdAt: "02 Aug 2026, 16:20",
    createdBy: "Anita R.",
    status: "Changes requested",
    comments:
      "Initial costing submitted for approval. 5 changes requested across Product, Fabric, Manufacturing and Costing.",
  },
];

let state: State = {
  changes: seedChanges,
  revisions: seedRevisions,
  workingVersion: null,
  submitted: false,
  approvalDone: false,
  dockOpen: false,
  dockMinimized: false,
  actionHosts: 0,
  highlight: null,
};

const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function now() {
  return new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function useRequestedChanges() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

export function pendingCount() {
  return state.changes.filter((c) => c.status === "Pending").length;
}

export function usePendingChangeCount() {
  const s = useRequestedChanges();
  return s.changes.filter((c) => c.status === "Pending").length;
}

/** Opening the Requested Changes workspace starts a new working revision. */
export function beginWorkingRevision(by = "You") {
  if (state.workingVersion !== null) return state.workingVersion;
  const nextVersion = Math.max(...state.revisions.map((r) => r.version)) + 1;
  state = {
    ...state,
    workingVersion: nextVersion,
    revisions: [
      ...state.revisions,
      {
        id: `rev-${nextVersion}`,
        version: nextVersion,
        createdAt: now(),
        createdBy: by,
        status: "Working copy",
        comments: "Working copy created to action requested changes. Version 1 remains unchanged.",
      },
    ],
  };
  emit();
  return nextVersion;
}

export function setChangeStatus(id: string, status: RequestedChange["status"]) {
  state = {
    ...state,
    changes: state.changes.map((c) =>
      c.id === id ? { ...c, status, completedAt: status === "Completed" ? now() : undefined } : c,
    ),
  };
  emit();
}

/** Submitting the working copy files it into revision history. */
export function resubmitForApproval(by = "You") {
  const v = state.workingVersion;
  if (v === null) return;
  state = {
    ...state,
    workingVersion: null,
    revisions: state.revisions.map((r) =>
      r.version === v
        ? {
            ...r,
            status: "Submitted for approval",
            createdBy: by,
            createdAt: now(),
            comments: `V${v}: all ${state.changes.length} requested changes completed and resubmitted for approval — ${state.changes
              .map((c) => `${c.module} · ${c.field} (${c.currentValue} → ${c.requestedValue})`)
              .join("; ")}.`,
          }
        : r,
    ),
  };
  emit();
}

/* ---------------- approval / dock lifecycle ---------------- */

/** Called when the costing is sent for approval. Unlocks the header actions. */
export function markSubmittedForApproval() {
  if (state.submitted) return;
  state = { ...state, submitted: true };
  emit();
}

export function useChangesGate() {
  const s = useRequestedChanges();
  return { submitted: s.submitted, approvalDone: s.approvalDone, dockOpen: s.dockOpen };
}

export function openChangesDock() {
  beginWorkingRevision();
  state = { ...state, dockOpen: true, dockMinimized: false };
  emit();
}

export function closeChangesDock() {
  state = { ...state, dockOpen: false, dockMinimized: false };
  emit();
}

export function minimizeChangesDock() {
  state = { ...state, dockMinimized: true };
  emit();
}

export function expandChangesDock() {
  state = { ...state, dockMinimized: false };
  emit();
}

/**
 * Overlays (Costing Report / Approval) render their own grouped header actions;
 * while at least one is mounted the global floating action bar stays hidden so
 * buttons never overlap or shift.
 */
export function registerActionHost() {
  state = { ...state, actionHosts: state.actionHosts + 1 };
  emit();
  return () => {
    state = { ...state, actionHosts: Math.max(0, state.actionHosts - 1) };
    emit();
  };
}

export function markAllComplete() {
  state = {
    ...state,
    changes: state.changes.map((c) =>
      c.status === "Completed" ? c : { ...c, status: "Completed", completedAt: now() },
    ),
  };
  emit();
}

/** Resubmitted revision approved by the same team → quotation unlocks. */
export function completeApproval() {
  const latest = Math.max(...state.revisions.map((r) => r.version));
  state = {
    ...state,
    approvalDone: true,
    dockOpen: false,
    revisions: state.revisions.map((r) =>
      r.version === latest
        ? {
            ...r,
            status: "Approved",
            comments: `${r.comments} Approved by all reviewers (Costing Assistant, Costing Manager, Merchandiser, Management) on ${now()}. Send to quotation unlocked.`,
          }
        : r,
    ),
  };
  emit();
}

export function setHighlight(h: State["highlight"]) {
  state = { ...state, highlight: h };
  emit();
}

/** Steps that actually changed in the working revision, in workflow order. */
export function changesByStep() {
  const groups: { step: ChangeStep; items: RequestedChange[] }[] = [];
  for (const step of CHANGE_STEPS) {
    const items = state.changes.filter((c) => stepForModule(c.module) === step);
    if (items.length) groups.push({ step, items });
  }
  return groups;
}
