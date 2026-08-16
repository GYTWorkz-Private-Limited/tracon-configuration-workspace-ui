import { useSyncExternalStore } from "react";
import { podIdForSrf } from "./podsStore";

/** Canonical POD reference for a snapshot. Falls back to derived POD id when not set. */
export function podRefFor(s: { podId?: string; srfId: string }): string {
  return s.podId || podIdForSrf(s.srfId) || s.srfId.replace(/^SRF-/, "POD-");
}

export type ApprovalStatus = "pending" | "approved" | "sent_back" | "rejected";

export type ApprovalVersion = {
  id: string;
  at: string;
  by: string;
  label: string;
  editedBeforeApproval?: boolean;
  changedFields?: string[];
};
export type ApprovalPriority = "normal" | "high" | "urgent";

export type ApprovalOverride = {
  field: string;
  from: string;
  to: string;
  reason: string;
  by: string;
  at: string;
};

export type ApprovalConfigItem = { label: string; value: string; cost?: string };
export type ApprovalConfigGroup = { label: string; items: ApprovalConfigItem[] };

export type ApprovalCostRow = { label: string; cost: number; color: string; pct: number };

/** One article inside a kit approval — its own commercial line. */
export type ApprovalKitLine = {
  articleId: string;
  name: string;
  sellingPrice: number;
  margin: number;
  moq: string;
};

export type ApprovalSnapshot = {
  productName: string;
  productImage?: string;
  buyer: string;
  articleId: string;
  articleCode: string;
  srfId: string;
  /** Canonical POD reference id (buyer-facing). Optional for legacy snapshots. */
  podId?: string;
  moq: string;
  size: string;
  supplier: string;
  scenarioName: string;
  sellingPrice: number;
  cost: number;
  margin: number;
  targetPrice: number;
  confidence: number;
  commercialHealth: "Strong" | "Watch" | "At Risk";
  /** present when the approval is for a set/kit — one line per member */
  kitItems?: ApprovalKitLine[];
  configGroups: ApprovalConfigGroup[];
  costRows: ApprovalCostRow[];
  aiSummary: {
    verdict: string;
    risks: string[];
    confidence: number;
    bestScenario: string;
    recommendations: string[];
  };
  history: {
    similarProducts: number;
    previousMargin: number;
    winRate: number;
    similarBuyers: string[];
    historicalSupplier: string;
    avgLeadTime: string;
  };
};

export type ApprovalAttachment = { id: string; name: string; kind: string; size?: string };

export type Approval = {
  id: string;
  status: ApprovalStatus;
  priority: ApprovalPriority;
  submittedBy: string;
  submittedAt: string;
  updatedAt: string;
  dueDate?: string;
  approvers: string[];
  cc: string[];
  notes: string;
  snapshot: ApprovalSnapshot;
  attachments: ApprovalAttachment[];
  overrides: ApprovalOverride[];
  revisionComment?: string;
  decidedBy?: string;
  decidedAt?: string;
  rejectReason?: string;
  editedBeforeApproval?: boolean;
  versions?: ApprovalVersion[];
};

// ---------------- store ----------------
type Listener = () => void;
let listeners: Listener[] = [];
let items: Approval[] = seed();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(l: Listener) {
  listeners.push(l);
  return () => {
    listeners = listeners.filter((x) => x !== l);
  };
}

function getSnapshot() {
  return items;
}

const now = () => new Date().toISOString();
const shortId = () => "APR-" + Math.floor(1000 + Math.random() * 9000);

export function useApprovals(): Approval[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useApproval(id: string): Approval | undefined {
  const list = useApprovals();
  return list.find((a) => a.id === id);
}

export function submitApproval(
  payload: Omit<Approval, "id" | "status" | "submittedAt" | "updatedAt" | "overrides"> & {
    id?: string;
  },
): Approval {
  const at = now();
  const created: Approval = {
    id: payload.id ?? shortId(),
    status: "pending",
    submittedAt: at,
    updatedAt: at,
    overrides: [],
    versions: [
      {
        id: "v1",
        at,
        by: payload.submittedBy,
        label: "Submitted for approval",
      },
    ],
    ...payload,
  };
  items = [created, ...items];
  emit();
  return created;
}

export function approveApproval(id: string, by = "Gautam Kitclu") {
  items = items.map((a) => {
    if (a.id !== id) return a;
    const at = now();
    const versions = [
      ...(a.versions ?? []),
      {
        id: `v${(a.versions?.length ?? 0) + 1}`,
        at,
        by,
        label: a.editedBeforeApproval ? "Edited & approved" : "Approved",
        editedBeforeApproval: a.editedBeforeApproval,
      },
    ];
    return {
      ...a,
      status: "approved" as const,
      decidedBy: by,
      decidedAt: at,
      updatedAt: at,
      versions,
    };
  });
  emit();
}

export function rejectApproval(id: string, reason: string, by = "Gautam Kitclu") {
  const at = now();
  items = items.map((a) => {
    if (a.id !== id) return a;
    const versions = [
      ...(a.versions ?? []),
      { id: `v${(a.versions?.length ?? 0) + 1}`, at, by, label: `Rejected — ${reason}` },
    ];
    return {
      ...a,
      status: "rejected" as const,
      rejectReason: reason,
      decidedBy: by,
      decidedAt: at,
      updatedAt: at,
      versions,
    };
  });
  emit();
}

export function updateApprovalSnapshot(
  id: string,
  patch: Partial<ApprovalSnapshot>,
  changedFields: string[],
  by = "Gautam Kitclu",
) {
  const at = now();
  items = items.map((a) => {
    if (a.id !== id) return a;
    const versions = [
      ...(a.versions ?? []),
      {
        id: `v${(a.versions?.length ?? 0) + 1}`,
        at,
        by,
        label: `Edited: ${changedFields.join(", ") || "adjustments"}`,
        changedFields,
      },
    ];
    return {
      ...a,
      snapshot: { ...a.snapshot, ...patch },
      editedBeforeApproval: true,
      updatedAt: at,
      versions,
    };
  });
  emit();
}

export function sendBackApproval(id: string, comment: string, by = "Gautam Kitclu") {
  items = items.map((a) =>
    a.id === id
      ? {
          ...a,
          status: "sent_back",
          revisionComment: comment,
          decidedBy: by,
          decidedAt: now(),
          updatedAt: now(),
        }
      : a,
  );
  emit();
}

export function overrideAndApprove(
  id: string,
  overrides: Omit<ApprovalOverride, "at" | "by">[],
  by = "Gautam Kitclu",
) {
  const at = now();
  items = items.map((a) => {
    if (a.id !== id) return a;
    const applied: ApprovalOverride[] = overrides.map((o) => ({ ...o, by, at }));
    // Reflect changes in snapshot for display
    const snap = { ...a.snapshot };
    for (const o of applied) {
      const num = Number(o.to.replace(/[^0-9.\-]/g, ""));
      if (o.field === "Selling Price" && !Number.isNaN(num)) snap.sellingPrice = num;
      if (o.field === "Target Margin" && !Number.isNaN(num)) snap.margin = num;
      if (o.field === "Final Margin" && !Number.isNaN(num)) snap.margin = num;
      if (o.field === "Discount" && !Number.isNaN(num)) {
        // adjust selling price by discount from target
        snap.sellingPrice = snap.targetPrice * (1 + num / 100);
      }
    }
    return {
      ...a,
      status: "approved",
      overrides: [...a.overrides, ...applied],
      snapshot: snap,
      decidedBy: by,
      decidedAt: at,
      updatedAt: at,
    };
  });
  emit();
}

// -------- Derived status helpers --------
export type CostingStatus = "in_progress" | "approved" | "needs_revision" | "pending_approval";

export function costingStatusForArticle(articleId: string): CostingStatus {
  const relevant = items.filter((a) => a.snapshot.articleId === articleId);
  if (relevant.length === 0) return "in_progress";
  // Priority: pending > sent_back > approved
  if (relevant.some((a) => a.status === "pending")) return "pending_approval";
  if (relevant.some((a) => a.status === "sent_back")) return "needs_revision";
  return "approved";
}

export function srfStatusFor(srfId: string): "in_quotation" | "revision_requested" | null {
  const relevant = items.filter((a) => a.snapshot.srfId === srfId);
  if (relevant.length === 0) return null;
  if (relevant.some((a) => a.status === "approved")) return "in_quotation";
  if (relevant.some((a) => a.status === "sent_back")) return "revision_requested";
  return null;
}

// -------- Seed --------
function seed(): Approval[] {
  const baseSnapshot = (over: Partial<ApprovalSnapshot> = {}): ApprovalSnapshot => ({
    productName: "Zero-Twist Bath Towel 500 GSM",
    buyer: "H&M Home",
    articleId: "art-01",
    articleCode: "ART-4471-A",
    srfId: "SRF-1039",
    moq: "1,000 pcs",
    size: "70 × 140 cm",
    supplier: "Karur Mills",
    scenarioName: "Current",
    sellingPrice: 7.65,
    cost: 6.02,
    margin: 21.3,
    targetPrice: 8.5,
    confidence: 86,
    commercialHealth: "Strong",
    configGroups: [
      {
        label: "Material",
        items: [
          { label: "Front Fabric", value: "Cotton 500 GSM", cost: "$2.15" },
          { label: "Back Fabric", value: "Percale 200TC", cost: "$1.80" },
          { label: "GSM", value: "500" },
          { label: "Supplier", value: "Karur Mills" },
        ],
      },
      {
        label: "Making",
        items: [
          { label: "Printing", value: "Digital 1-color", cost: "$0.18" },
          { label: "Embroidery", value: "Logo — 8k stitches", cost: "$0.22" },
          { label: "Quilting", value: "Box quilting 10cm", cost: "$0.28" },
          { label: "Filling", value: "Hollow-fiber 200 GSM", cost: "$0.90" },
        ],
      },
      {
        label: "Commercial",
        items: [
          { label: "MOQ", value: "1,000 pcs" },
          { label: "Packaging", value: "Retail-ready" },
          { label: "Certification", value: "OEKO-TEX · BCI" },
          { label: "Transportation", value: "FCL Sea · Nhava Sheva" },
        ],
      },
    ],
    costRows: [
      { label: "Material", cost: 5.31, pct: 50.3, color: "#05604d" },
      { label: "Making", cost: 0.64, pct: 6.0, color: "#2d8f7a" },
      { label: "Packaging", cost: 0.42, pct: 4.0, color: "#c69324" },
      { label: "Testing", cost: 0.45, pct: 4.3, color: "#7A5230" },
      { label: "Certification", cost: 0.35, pct: 3.3, color: "#a58b3f" },
      { label: "Transportation", cost: 0.28, pct: 2.7, color: "#4d5651" },
      { label: "Overheads & Margin", cost: 3.13, pct: 29.6, color: "#0a7460" },
    ],
    aiSummary: {
      verdict:
        "Commercially viable at 21.3% margin — 0.85 pt above target. Cost stack is stable and buyer historical acceptance is high.",
      risks: [
        "Cotton yarn +4.8% MoM could shave 1.2 pt margin",
        "Buyer typically pushes 2% discount at PO",
      ],
      confidence: 86,
      bestScenario: "Value Engineered — 24.1% margin, same lead time",
      recommendations: [
        "Lock 90-day forward with Karur Mills to hedge yarn",
        "Trial value-tier packaging on 2.5k MOQ tier",
        "Qualify Panipat as secondary front-fabric supplier",
      ],
    },
    history: {
      similarProducts: 7,
      previousMargin: 19.8,
      winRate: 71,
      similarBuyers: ["West Elm", "IKEA", "Marks & Spencer"],
      historicalSupplier: "Karur Mills · 12 orders",
      avgLeadTime: "44 days",
    },
    ...over,
  });

  return [
    {
      id: "APR-2052",
      status: "pending",
      priority: "high",
      submittedBy: "Gautam Kitclu",
      submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      approvers: ["Meera K."],
      cc: [],
      notes: "Set of two, quoted as one price — table linen kit for Zara Home.",
      snapshot: baseSnapshot({
        productName: "Kit — Placemat + Runner",
        buyer: "Zara Home",
        articleId: "art-kit-tabletop",
        articleCode: "KIT-2201",
        srfId: "SRF-1042",
        sellingPrice: 15.9,
        cost: 11.4,
        margin: 28.3,
        targetPrice: 16.0,
        moq: "1,500 sets",
        kitItems: [
          { articleId: "A-PLACEMAT", name: "Placemat", sellingPrice: 5.5, margin: 26.0, moq: "3,000 pcs" },
          { articleId: "A-RUNNER", name: "Runner", sellingPrice: 10.4, margin: 29.5, moq: "1,500 pcs" },
        ],
      }),
      attachments: [],
      overrides: [],
    },
    {
      id: "APR-2048",
      status: "pending",
      priority: "high",
      submittedBy: "Priya S.",
      submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(),
      approvers: ["Meera K.", "Rohit P."],
      cc: ["Gautam Kitclu"],
      notes: "Please review margin — buyer target is $8.50 and we've hit $7.65 with 21% margin.",
      snapshot: baseSnapshot(),
      attachments: [
        { id: "at-1", name: "Buyer_target_costing.xlsx", kind: "xlsx", size: "84 KB" },
        { id: "at-2", name: "SRF-1039_Techpack.pdf", kind: "pdf", size: "2.1 MB" },
      ],
      overrides: [],
    },
    {
      id: "APR-2039",
      status: "approved",
      priority: "normal",
      submittedBy: "Gautam Kitclu",
      submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
      approvers: ["Meera K."],
      cc: [],
      notes: "Standard reorder for AW slot.",
      snapshot: baseSnapshot({
        productName: "Luxury Velvet Cushion 45cm",
        buyer: "West Elm",
        articleId: "art-cush",
        articleCode: "ART-5522-C",
        srfId: "SRF-1042",
        sellingPrice: 6.9,
        cost: 4.9,
        margin: 29.0,
        targetPrice: 6.9,
        commercialHealth: "Strong",
        supplier: "Panipat Textiles",
        moq: "1,200 pcs",
      }),
      attachments: [{ id: "at-3", name: "Approval_memo.pdf", kind: "pdf" }],
      overrides: [
        {
          field: "Selling Price",
          from: "$6.85",
          to: "$6.90",
          reason: "Buyer historical acceptance at $6.90; captures +0.7 pt margin",
          by: "Meera K.",
          at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
        },
      ],
      decidedBy: "Meera K.",
      decidedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    },
    {
      id: "APR-2031",
      status: "sent_back",
      priority: "urgent",
      submittedBy: "Rohit P.",
      submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
      approvers: ["Meera K."],
      cc: ["Priya S."],
      notes: "Rush order — need approval by EOD.",
      snapshot: baseSnapshot({
        productName: "Linen Chambray Throw",
        buyer: "IKEA",
        articleId: "art-throw",
        articleCode: "ART-6621-L",
        srfId: "SRF-1036",
        sellingPrice: 12.4,
        cost: 10.8,
        margin: 12.9,
        targetPrice: 13.5,
        commercialHealth: "Watch",
        supplier: "Erode Weaves",
        moq: "500 pcs",
      }),
      attachments: [],
      overrides: [],
      revisionComment:
        "Margin too low at 12.9%. Please recalculate with 2500 MOQ and evaluate secondary supplier.",
      decidedBy: "Meera K.",
      decidedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    },
  ];
}
