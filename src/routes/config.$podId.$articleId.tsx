/**
 * Configuration Workspace — the costing cockpit.
 *
 * Costing can start on either shape:
 *
 *   Single product  →  one sheet: parameters · components · inspector
 *   Kit / set       →  one tab per member article, each running that SAME
 *                      sheet, plus a Kit Summary that consolidates them
 *
 * The single-product experience is unchanged; it simply lives in
 * `ArticleCostingWorkspace` now so a kit can render one per member. This route
 * is the shell around it: header, workflow band, article tabs and the two
 * intake drawers.
 *
 *   Scenario → Variant → Option → Component → Material → Rule → Process → Cost
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Boxes, PackagePlus, Sparkles } from "lucide-react";

import { GlobalNav } from "@/components/layout/GlobalNav";
import { ProductHeader } from "@/components/layout/ProductHeader";
import { WorkflowStepper } from "@/components/layout/WorkflowStepper";
import { ArticleTabsBar } from "@/components/layout/ArticleTabsBar";
import { ActionGroup, ModuleRevisionAction } from "@/components/changes/FlowActions";
import { CompareVariantsAction } from "@/components/config/CompareVariantsAction";
import { BundleBuilderDrawer } from "@/components/configuration/BundleBuilderDrawer";
import { ArticleLibraryDrawer } from "@/components/articles/ArticleLibraryDrawer";
import {
  ArticleCostingWorkspace,
  type ArticleCosting,
} from "@/components/workspace/ArticleCostingWorkspace";
import { KitCostingWorkspace } from "@/components/workspace/KitCostingWorkspace";

import { cn } from "@/lib/utils";
import { addKit, addLibraryArticles, usePod } from "@/lib/podsStore";
import { rollupVariant } from "@/lib/costingModel";
import { applyParameters, commercialOutput } from "@/lib/pricingVariants";
import { resolveCostingModel } from "@/lib/costingModels";
import { estimateKitDirectInr, seedVariantFor } from "@/lib/articleCosting";

export const Route = createFileRoute("/config/$podId/$articleId")({
  validateSearch: (s: Record<string, unknown>) => ({
    sel: typeof s.sel === "string" ? s.sel : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Configuration Workspace · Tracon Costing" },
      {
        name: "description",
        content:
          "Scenario → variant → component → material → consumption rule → process → rate → cost, in one workspace.",
      },
      { property: "og:title", content: "Configuration Workspace · Tracon Costing" },
      {
        property: "og:description",
        content:
          "Configure every component and read the complete calculation behind its cost without leaving the workspace.",
      },
    ],
  }),
  component: ConfigurationWorkspacePage,
});

const inr2 = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function ConfigurationWorkspacePage() {
  const { podId, articleId } = Route.useParams();
  const { sel } = Route.useSearch();
  const pod = usePod(podId);
  const navigate = useNavigate();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /** late intake: an article the team forgot, or several combined into a set */
  const [addArticleOpen, setAddArticleOpen] = useState(false);
  const [bundleOpen, setBundleOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);

  /** the live roll-up, lifted so the page header can report the running cost */
  const [costing, setCosting] = useState<ArticleCosting | null>(null);

  const selectedIds = sel ? sel.split(",").filter(Boolean) : (pod?.articles ?? []).map((a) => a.id);
  const sheets = (pod?.articles ?? []).filter((a) => selectedIds.includes(a.id));
  const article = sheets.find((a) => a.id === articleId) ?? sheets[0] ?? pod?.articles[0];

  /**
   * Every article priced on its own default build, so the bundle builder can
   * roll a set price up without opening each sheet.
   */
  const bundleSuggestions = useMemo(
    () =>
      sheets.map((a) => {
        const b = resolveCostingModel(a.srfRef);
        const seeded = seedVariantFor(b.defaultVariant, { size: a.size, moq: a.moq });
        const priced = applyParameters(seeded, seeded.parameters, b.masters);
        const roll = rollupVariant(priced, b.masters);
        const out = commercialOutput(roll.directCost, priced.commercial);
        return {
          id: a.libraryId ?? a.id,
          name: a.name,
          image: a.image,
          size: a.size,
          moq: a.moq,
          estUnitCost: roll.directCost / priced.commercial.fxRate,
          estSellPrice: out.sellingUsd,
        };
      }),
    [sheets],
  );

  /** Bring newly created articles/kits into the selection so they tab in at once. */
  const openInWorkspace = (newIds: string[], focusId?: string) => {
    if (newIds.length === 0) return;
    const nextSel = [...new Set([...selectedIds, ...newIds])].join(",");
    navigate({
      to: "/config/$podId/$articleId",
      params: { podId, articleId: focusId ?? articleId },
      search: { sel: nextSel },
    });
  };

  if (!pod || !article) {
    return (
      <div className="min-h-screen bg-canvas">
        <div className="mx-auto mt-20 max-w-[720px] rounded-lg border border-hairline bg-surface p-10 text-center">
          <p className="text-[14px] text-ink-500">POD "{podId}" not found.</p>
          <Link to="/pods" className="mt-3 inline-block text-brand-700 hover:underline">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const isKit = article.type === "kit";

  const stepper = (
    <WorkflowStepper
      active="Configuration & Costing"
      podId={pod.id}
      articleId={article.id}
      costingRef={article.srfRef}
    />
  );

  return (
    /* The tab bar is docked to the viewport bottom; the padding keeps the
       last rows of any sheet clear of it. */
    <div className="flex h-screen w-full flex-col bg-canvas pb-[52px]">
      <GlobalNav />
      <ProductHeader
        pod={pod}
        article={article}
        mounted={mounted}
        /* ₹ throughout the configuration stage — the dollar figure is the
           quotation's, and two currencies on one screen invited the room to
           argue about FX instead of cost. */
        totalCost={
          isKit
            ? `${inr2(estimateKitDirectInr(article.kitItems))} / set`
            : costing
              ? `${inr2(costing.rollup.directCost)} / pc`
              : "₹ —"
        }
        /* Back goes to the dashboard, not to the POD's setup page: opening a
           POD lands here, so that page is not a step the user came through
           and sending them "back" to it would be showing them template and
           article pickers for work that is already configured. */
        backTo={
          <Link
            to="/pods"
            aria-label="Back to the costing dashboard"
            className="rounded-md p-1 text-ink-500 hover:bg-surface-alt hover:text-ink-900"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        }
      >
        <ActionGroup>
          <ModuleRevisionAction />
          <CompareVariantsAction productName={article.name} />
          <button
            onClick={() =>
              navigate({
                to: "/costing/$id",
                params: { id: article.srfRef },
                search: {
                  podId: pod.id,
                  sel: sheets.map((a) => a.id).join(","),
                  articleId: article.id,
                  report: true,
                },
              })
            }
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-1"
          >
            Continue to Costing Report <ArrowRight className="h-4 w-4" />
          </button>
          {/* Last in the group, so it lands at the top-right corner of the
              page whether or not the header wraps — the place a costing user
              goes looking for it. */}
          <button
            type="button"
            onClick={() => setCopilotOpen((o) => !o)}
            aria-pressed={copilotOpen}
            title="Ask the costing copilot about this configuration"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
              copilotOpen
                ? "border-brand-700 bg-brand-50 text-brand-700"
                : "border-hairline bg-surface text-ink-700 hover:bg-surface-alt",
            )}
          >
            <Sparkles className="h-4 w-4" /> AI Copilot
          </button>
        </ActionGroup>
      </ProductHeader>

      {isKit ? (
        /* ---- a kit: a tab per member article, plus the consolidation ---- */
        <KitCostingWorkspace
          pod={pod}
          kit={article}
          stepper={stepper}
          copilotOpen={copilotOpen}
          onCopilotOpenChange={setCopilotOpen}
        />
      ) : (
        /* ---- a single product: the sheet, unchanged ---- */
        <>
          {/* Same band, same place, as the Costing Report, Quotation and
              Approval — the workflow strip is the spine of the workspace and
              must not scroll away inside a card. */}
          {stepper}
          <ArticleCostingWorkspace
            copilotOpen={copilotOpen}
            onCopilotOpenChange={setCopilotOpen}
            podId={pod.id}
            buyer={pod.buyer}
            buyerRef={pod.buyerRef}
            identity={{
              articleId: article.id,
              name: article.name,
              srfRef: article.srfRef,
              size: article.size,
              moq: article.moq,
              image: article.image,
              articleNo: article.articleNo,
              styleNo: article.styleNo,
              colour: article.colour,
              currency: article.currency,
            }}
            onCosted={setCosting}
          />
        </>
      )}

      <ArticleTabsBar
        podId={pod.id}
        articles={sheets}
        activeId={article.id}
        sel={sel}
        stage="Configuration"
        actions={
          <>
            <button
              type="button"
              onClick={() => setAddArticleOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 py-1.5 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
            >
              <PackagePlus className="h-3.5 w-3.5 text-ink-400" /> Add product
            </button>
            <button
              type="button"
              onClick={() => setBundleOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand-700 bg-brand-50 px-3 py-1.5 text-[12.5px] font-medium text-brand-700 hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
            >
              <Boxes className="h-3.5 w-3.5" /> Create bundle / set
            </button>
          </>
        }
      />

      {/* Late intake — an article the team forgot to bring in before costing */}
      <ArticleLibraryDrawer
        open={addArticleOpen}
        onClose={() => setAddArticleOpen(false)}
        submitLabel="Add to workspace"
        defaultBuyer={pod.buyer}
        onSubmit={(arts) => {
          const created = addLibraryArticles(
            pod.id,
            arts.map((a) => ({
              name: a.name,
              description: `${a.articleNo} · ${a.buyerRef}`,
              size: a.size,
              moq: a.moq,
              style: a.style,
              image: a.image,
              libraryId: a.id,
              category: a.category,
              collection: a.collection,
              season: a.season,
              articleNo: a.articleNo,
              supplier: a.supplier,
              composition: a.composition,
              construction: a.construction,
              colour: a.colour,
              techPackRef: a.techPackRef,
              techPackVersion: a.version,
            })),
          );
          openInWorkspace(created.map((a) => a.id));
        }}
      />

      {/* Bundle / set costing — several articles costed and quoted as one set */}
      <BundleBuilderDrawer
        open={bundleOpen}
        onClose={() => setBundleOpen(false)}
        defaultBuyer={pod.buyer}
        defaultCollection={article.collection}
        suggestions={bundleSuggestions}
        onCreate={(b) => {
          const kit = addKit(pod.id, {
            name: b.name,
            buyer: b.buyer,
            collection: b.collection,
            moq: b.moq,
            currency: b.currency,
            items: b.items,
          });
          openInWorkspace([kit.id], kit.id);
        }}
      />
    </div>
  );
}
