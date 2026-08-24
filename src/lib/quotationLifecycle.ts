/**
 * What stage a quotation is at, and therefore what may be done to it.
 *
 * The workspace and the approval screen were each deciding this for
 * themselves, which is how a quotation nobody had submitted came to show
 * "Pending Approval" and offer Approve / Reject on a document that had never
 * left the building. Stage is one derived answer, read from the two stores
 * that actually know:
 *
 *   quotationApprovalStore  — has it been submitted, and what have reviewers said
 *   quotationHistory        — has a version been frozen and sent
 *
 * Nothing is stored here. A quotation is in approval BECAUSE somebody
 * submitted it, not because a flag says so, and the two can never disagree if
 * only one of them exists.
 */

import {
  assignedPeople,
  useQuotationApproval,
  type QuotationApproval,
} from "./quotationApprovalStore";
import { latestVersion, useQuotationHistory, type QuotationHistory } from "./quotationHistory";

export type QuotationStage =
  /** being prepared — editable, no approver has seen it */
  | "quotation"
  /** submitted, reviewers are acting */
  | "approval"
  /** every assigned reviewer approved */
  | "approved"
  /** a reviewer asked for changes, or the version came back rejected */
  | "changes";

/**
 * The lifecycle a quotation travels, for the timeline at the top of the page.
 *
 * "Costing" is behind it — the quotation could not exist without one — so it
 * is always shown complete rather than as a step still to come.
 */
export const LIFECYCLE_STEPS = [
  "Costing",
  "Quotation",
  "Approval",
  "Sent to Buyer",
  "Accepted",
] as const;

export type LifecycleStep = (typeof LIFECYCLE_STEPS)[number];

export type QuotationState = {
  stage: QuotationStage;
  /** where the timeline sits — index into LIFECYCLE_STEPS */
  stepIndex: number;
  label: string;
  /** the quotation has been submitted at least once */
  submitted: boolean;
  /**
   * Editing the quotation is allowed.
   *
   * False from the moment it is submitted: what an approver is looking at must
   * not move under them, and the way to change a sent quotation is a new
   * version, not an edit to the one out for review.
   */
  editable: boolean;
  /** Approve / Reject / Override belong to reviewers, and only after submission */
  canDecide: boolean;
  approvedCount: number;
  reviewerCount: number;
};

const LABEL: Record<QuotationStage, string> = {
  quotation: "Draft",
  approval: "In Approval",
  approved: "Approved",
  changes: "Changes Requested",
};

const STEP_OF: Record<QuotationStage, number> = {
  quotation: 1,
  approval: 2,
  approved: 3,
  changes: 2,
};

/** Pure derivation, so a caller that already holds both records can reuse it. */
export function stateFrom(approval: QuotationApproval, history: QuotationHistory): QuotationState {
  const people = assignedPeople(approval);
  const approvedCount = people.filter((k) => approval.reviewStatus[k] === "approved").length;
  const anyChanges = people.some((k) => approval.reviewStatus[k] === "changes");
  const version = latestVersion(history);

  let stage: QuotationStage = "quotation";
  if (approval.submitted) {
    if (version?.status === "changes_requested" || anyChanges) stage = "changes";
    else if (
      version?.status === "approved" ||
      (people.length > 0 && approvedCount === people.length)
    )
      stage = "approved";
    else stage = "approval";
  }

  return {
    stage,
    stepIndex: STEP_OF[stage],
    label: LABEL[stage],
    submitted: approval.submitted,
    editable: !approval.submitted,
    canDecide: approval.submitted,
    approvedCount,
    reviewerCount: people.length,
  };
}

/** Subscribed read — what components should use. */
export function useQuotationState(quotationId: string): QuotationState {
  const approval = useQuotationApproval(quotationId);
  const history = useQuotationHistory(quotationId);
  return stateFrom(approval, history);
}
