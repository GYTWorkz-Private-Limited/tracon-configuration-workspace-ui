/**
 * The Costing Report, at its own address.
 *
 * It used to be a panel opened on top of the old node-canvas configurator,
 * which meant `/costing/:id` had to render that configurator first — so any
 * link to the Costing stage that did not carry `report=true` landed the user
 * on a screen the workspace had already replaced.
 *
 * Configuration & costing now happens in one place, the costing sheet at
 * `/config/:podId/:articleId`. This owns nothing but the variant state the
 * report reads, so the report has somewhere to live that is not the screen it
 * came from.
 */

import { useState } from "react";
import { DEFAULT_VARIANTS, type CushionInputs, type CushionVariant } from "@/lib/cushionCosting";
import { CostingIntelligenceReport } from "./CostingIntelligenceReport";

export function CostingReportWorkspace({
  srfId,
  productName,
  buyer,
  buyerRef,
  podRef,
  statusLabel,
  updatedAt,
  targetPriceUsd,
  articles,
  activeArticleId,
  onSelectArticle,
  navPodId,
  navArticleId,
  initialApprovalOpen,
  onClose,
}: {
  srfId: string;
  productName: string;
  buyer: string;
  buyerRef?: string;
  podRef?: string;
  statusLabel?: string;
  updatedAt?: string;
  targetPriceUsd: number;
  articles?: { id: string; name: string; size?: string; moq?: string }[];
  activeArticleId?: string;
  onSelectArticle?: (id: string) => void;
  navPodId?: string;
  navArticleId?: string;
  initialApprovalOpen?: boolean;
  onClose: () => void;
}) {
  const [variants, setVariants] = useState<CushionVariant[]>(DEFAULT_VARIANTS);
  const [activeId, setActiveId] = useState<string>(DEFAULT_VARIANTS[0].id);

  /** What-if drivers from the report's own sensitivity section. */
  const patchActive = (patch: Partial<CushionInputs>) =>
    setVariants((prev) =>
      prev.map((v) => (v.id === activeId ? { ...v, inputs: { ...v.inputs, ...patch } } : v)),
    );

  return (
    <CostingIntelligenceReport
      variants={variants}
      activeId={activeId}
      buyer={buyer}
      productName={productName}
      srfId={srfId}
      targetPriceUsd={targetPriceUsd}
      onClose={onClose}
      onPromote={setActiveId}
      podRef={podRef}
      buyerRef={buyerRef}
      statusLabel={statusLabel}
      updatedAt={updatedAt}
      articles={articles}
      activeArticleId={activeArticleId}
      onSelectArticle={onSelectArticle}
      onApplySensitivity={patchActive}
      navPodId={navPodId}
      navArticleId={navArticleId}
      initialApprovalOpen={initialApprovalOpen}
    />
  );
}
