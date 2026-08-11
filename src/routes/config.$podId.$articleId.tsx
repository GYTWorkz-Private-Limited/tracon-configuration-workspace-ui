/**
 * Configuration Workspace — the costing cockpit.
 *
 * Three columns, reading left to right as the costing question itself:
 *
 *   what drives the cost   →   what the cost is   →   what makes it up
 *   (parameters, commercials)  (components table)     (component inspector)
 *
 * Above them, scenarios: whole costing positions compared on selling-price
 * delta. Below the product card, variants and options inside the active
 * scenario.
 *
 *   Scenario → Variant → Option → Component → Material → Rule → Process → Cost
 *
 * Everything on screen is produced by one model (`costingModel`) from one
 * variant, so the rail, the table, the strip and the inspector can never
 * disagree. The manufacturing roll-up ends at DIRECT COST; the commercial
 * layer sits beside it in the left rail and never feeds back into it.
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Boxes, PackagePlus, Scale, Sparkles } from "lucide-react";

import { ProductHeader } from "@/components/layout/ProductHeader";
import { WorkflowStepper } from "@/components/layout/WorkflowStepper";
import { ArticleTabsBar } from "@/components/layout/ArticleTabsBar";
import { ActionGroup, ModuleRevisionAction } from "@/components/changes/FlowActions";
import { VariantTabs, type WorkVariant } from "@/components/configuration/VariantTabs";
import { CopilotPanel } from "@/components/configuration/CopilotPanel";
import { AddVariantModal } from "@/components/configuration/AddVariantModal";
import { AddOptionModal, type OptionEntry } from "@/components/configuration/AddOptionModal";
import { CompareWorkspace, type CompareRow } from "@/components/configuration/CompareWorkspace";
import { BundleBuilderDrawer } from "@/components/configuration/BundleBuilderDrawer";
import { BundleWorkspace, setDirectCostUsd } from "@/components/configuration/BundleWorkspace";
import { ArticleLibraryDrawer } from "@/components/articles/ArticleLibraryDrawer";
import { cn } from "@/lib/utils";

import { CostBreakdownStrip, type CostCategory } from "@/components/workspace/CostBreakdownStrip";
import { CategoryComposition } from "@/components/workspace/CategoryComposition";
import { CostLineTable } from "@/components/workspace/CostLineTable";
import { ComponentInspector } from "@/components/workspace/ComponentInspector";
import { ComponentLibraryModal } from "@/components/workspace/ComponentLibraryModal";
import { ConfigurationRail } from "@/components/workspace/ConfigurationRail";
import { ScenarioBar } from "@/components/workspace/ScenarioBar";

import { addKit, addLibraryArticles, usePod } from "@/lib/podsStore";
import { createMoney } from "@/lib/money";
import {
  addComponentTo,
  duplicateVariant,
  removeComponentFrom,
  rollupVariant,
  sourced,
  type CostRollup,
  type Product,
  type Variant,
} from "@/lib/costingModel";
import {
  applyAccessoryOption,
  applyPackagingOption,
  applyProcessOption,
  applyTestingOption,
  buildSections,
  INHERIT_OPTION_ID,
  type CostLine,
  type LineSection,
} from "@/lib/costLines";
import {
  accessoryFromLibrary,
  componentFromLibrary,
  packagingFromLibrary,
  processFromLibrary,
  testingFromLibrary,
  type LibraryItem,
} from "@/lib/library";
import {
  addCustomOption,
  applyParameters,
  commercialOutput,
  gsmOf,
  moqOf,
  selectParameter,
  sizeOf,
  type CommercialInputs,
  type ParameterId,
  type ParameterOption,
} from "@/lib/pricingVariants";
import {
  applyScenario,
  scenarioDelta,
  DEFAULT_SCENARIOS,
  SCENARIO_PRESETS,
  type Scenario,
} from "@/lib/scenarios";
import { resolveCostingModel } from "@/lib/costingModels";

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

/** Cost-strip category → the line section it is made of. */
const CATEGORY_SECTION: Record<CostCategory, LineSection["id"] | null> = {
  raw: "material",
  process: "process",
  accessories: "accessory",
  packaging: "packaging",
  testing: "testing",
  direct: null,
};

const CATEGORY_COPY: Record<CostCategory, { caption: string; totalLabel: string; empty: string }> =
  {
    raw: {
      caption: "Fabric, filling, interlining and every other direct material",
      totalLabel: "Raw Material Total",
      empty: "No component on this build consumes a direct material.",
    },
    process: {
      caption: "Dyeing, printing, embroidery, quilting, cutting, stitching, finishing",
      totalLabel: "Process Total",
      empty: "No processes are applied on this build.",
    },
    accessories: {
      caption: "Zippers, buttons, labels, tags, tapes, cords and other trims",
      totalLabel: "Accessories / Trims Total",
      empty: "No trims or accessories are configured.",
    },
    packaging: {
      caption: "Polybag, wrap, inserts, labels and carton — costed at product level",
      totalLabel: "Packaging Total",
      empty: "No packaging is configured.",
    },
    testing: {
      caption: "Lab tests, certification and inspection — lot cost spread across the MOQ",
      totalLabel: "Testing & Certification Total",
      empty: "No testing or certification is configured.",
    },
    direct: {
      caption: "Define all components that make up this product",
      totalLabel: "Total Direct Cost",
      empty: "No components yet. Add the first component to start costing this product.",
    },
  };

function ConfigurationWorkspacePage() {
  const { podId, articleId } = Route.useParams();
  const { sel } = Route.useSearch();
  const pod = usePod(podId);
  const navigate = useNavigate();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const selectedIds = sel ? sel.split(",").filter(Boolean) : (pod?.articles ?? []).map((a) => a.id);
  const sheets = (pod?.articles ?? []).filter((a) => selectedIds.includes(a.id));
  const article = sheets.find((a) => a.id === articleId) ?? sheets[0] ?? pod?.articles[0];

  /**
   * Every article resolves to its own product bundle — masters, default
   * variant, fabric options and add-component presets. Articles not in the
   * registry fall back to the Placemat reference build.
   */
  const bundle = resolveCostingModel(article?.srfRef);

  /* ---- scenarios: whole costing positions ---- */
  const [scenarios, setScenarios] = useState<Scenario[]>(DEFAULT_SCENARIOS);
  const [activeScenarioId, setActiveScenarioId] = useState(DEFAULT_SCENARIOS[0].id);

  /* ---- variants inside the active scenario ---- */
  const [variants, setVariants] = useState<Variant[]>([bundle.defaultVariant]);
  const [activeVariantId, setActiveVariantId] = useState(bundle.defaultVariant.id);

  /* ---- workspace UI state ---- */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** the Component Library, and the sheet section that opened it */
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [librarySection, setLibrarySection] = useState<LineSection["id"] | null>(null);
  const [filter, setFilter] = useState<CostCategory | null>(null);
  /** true briefly after a recalculation so the changed figures announce themselves */
  const [live, setLive] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [optionModalOpen, setOptionModalOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  /** late intake: add a forgotten article, or combine articles into a set */
  const [addArticleOpen, setAddArticleOpen] = useState(false);
  const [bundleOpen, setBundleOpen] = useState(false);

  /**
   * Every article in this workspace priced on its own default build, so the
   * bundle builder can roll a set price up without opening each sheet.
   */
  const bundleSuggestions = useMemo(
    () =>
      sheets.map((a) => {
        const b = resolveCostingModel(a.srfRef);
        const priced = applyParameters(b.defaultVariant, b.defaultVariant.parameters, b.masters);
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

  /**
   * Bring newly created articles/kits into the current costing selection so
   * they appear as tabs immediately, and optionally open one of them.
   */
  const openInWorkspace = (newIds: string[], focusId?: string) => {
    if (newIds.length === 0) return;
    const nextSel = [...new Set([...selectedIds, ...newIds])].join(",");
    navigate({
      to: "/config/$podId/$articleId",
      params: { podId, articleId: focusId ?? articleId },
      search: { sel: nextSel },
    });
  };

  // Switching to an article backed by a different product bundle (e.g.
  // Placemat → Quilt) re-seeds every piece of state derived from it. The
  // route component is not guaranteed to remount on a param-only navigation,
  // so this is what keeps the workspace from showing the wrong product's
  // components after clicking between article tabs.
  useEffect(() => {
    setVariants([bundle.defaultVariant]);
    setActiveVariantId(bundle.defaultVariant.id);
    setScenarios(DEFAULT_SCENARIOS);
    setActiveScenarioId(DEFAULT_SCENARIOS[0].id);
    setSelectedId(null);
    setFilter(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle.product.id]);

  const activeVariant = variants.find((v) => v.id === activeVariantId) ?? variants[0];
  const activeScenario = scenarios.find((s) => s.id === activeScenarioId) ?? scenarios[0];

  /**
   * Product identity comes from the real article record, not the mock constant,
   * so every article opened here describes itself correctly.
   */
  const product: Product = useMemo(() => {
    if (!article || !pod) return bundle.product;
    return {
      ...bundle.product,
      name: article.name,
      articleNo: article.articleNo ?? article.id,
      styleId: article.styleNo ?? bundle.product.styleId,
      buyer: pod.buyer,
      buyerRef: pod.buyerRef,
      size: article.size || bundle.product.size,
      colour: article.colour || bundle.product.colour,
      moq: article.moq || bundle.product.moq,
      currency: article.currency || bundle.product.currency,
      updatedAt: article.updatedAt,
    };
  }, [article, pod, bundle]);

  /**
   * The build actually being costed: base variant → scenario overrides →
   * parameter application. Every step is pure, so the stored variant keeps its
   * base configuration and switching scenarios is lossless.
   */
  const pricedVariant = useMemo(() => {
    const scoped = applyScenario(activeVariant, activeScenario);
    return applyParameters(scoped, scoped.parameters, bundle.masters);
  }, [activeVariant, activeScenario, bundle.masters]);

  /** One roll-up — the single computation every column reads from. */
  const rollup: CostRollup = useMemo(
    () => rollupVariant(pricedVariant, bundle.masters),
    [pricedVariant, bundle.masters],
  );

  /** Commercial layer, derived from direct cost. Never feeds back into it. */
  const output = useMemo(
    () => commercialOutput(rollup.directCost, pricedVariant.commercial),
    [rollup.directCost, pricedVariant.commercial],
  );

  /** Buyer-facing figures are quoted in USD at the variant's own FX rate. */
  const money = useMemo(
    () => createMoney("USD", pricedVariant.commercial.fxRate),
    [pricedVariant.commercial.fxRate],
  );

  /** Costed once per scenario so the bar can show a real selling-price delta. */
  const scenarioSelling = useMemo(() => {
    const out: Record<string, number> = {};
    for (const s of scenarios) {
      const scoped = applyScenario(activeVariant, s);
      const priced = applyParameters(scoped, scoped.parameters, bundle.masters);
      const roll = rollupVariant(priced, bundle.masters);
      out[s.id] = commercialOutput(roll.directCost, priced.commercial).sellingUsd;
    }
    return out;
  }, [scenarios, activeVariant, bundle.masters]);

  const baseScenarioId = scenarios.find((s) => s.isBase)?.id ?? scenarios[0]?.id;
  const deltaFor = (id: string) =>
    id === baseScenarioId
      ? null
      : scenarioDelta(scenarioSelling[id] ?? 0, scenarioSelling[baseScenarioId] ?? 0);

  const variantTotal = (id: string) => {
    const v = variants.find((x) => x.id === id);
    if (!v) return 0;
    const scoped = applyScenario(v, activeScenario);
    return rollupVariant(applyParameters(scoped, scoped.parameters, bundle.masters), bundle.masters)
      .directCost;
  };

  /** Full price a variant would carry under a given scenario — cost + commercial in one go. */
  const priceUnder = (v: Variant, scenario: Scenario) => {
    const scoped = applyScenario(v, scenario);
    const priced = applyParameters(scoped, scoped.parameters, bundle.masters);
    const roll = rollupVariant(priced, bundle.masters);
    const out = commercialOutput(roll.directCost, priced.commercial);
    return { priced, roll, out };
  };

  /**
   * Compare tab #1 — every variant/option currently open in this workspace,
   * each priced under the active scenario so the numbers match what's on screen.
   */
  const variantCompareRows: CompareRow[] = useMemo(() => {
    const baseSelling = priceUnder(activeVariant, activeScenario).out.sellingUsd;
    return variants.map((v) => {
      const { priced, roll, out } = priceUnder(v, activeScenario);
      return {
        id: v.id,
        name: v.name,
        subtitle: v.kind === "option" ? "Option" : "Variant",
        isActive: v.id === activeVariantId,
        size: sizeOf(priced.parameters).join('" × ') + '"',
        moq: `${moqOf(priced.parameters).toLocaleString()} pcs`,
        quality: `${gsmOf(priced.parameters)} GSM`,
        rawMaterialInr: roll.rawMaterial,
        processInr: roll.process,
        accessoriesInr: roll.accessories,
        packagingInr: roll.packaging,
        testingInr: roll.testing,
        directCostUsd: roll.directCost,
        componentCount: roll.components.length,
        sellingUsd: out.sellingUsd,
        marginPct: out.marginPct,
        buyerTargetUsd: out.buyerTargetUsd,
        onTarget: out.onTarget,
        deltaPct: v.id === activeVariantId ? null : scenarioDelta(out.sellingUsd, baseSelling),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variants, activeVariantId, activeScenario, bundle.masters]);

  /**
   * Compare tab #2 — four standard costing positions (base, premium, low cost,
   * high margin), computed on the base article's own build so the projection
   * is independent of whatever variant happens to be selected right now.
   */
  const scenarioCompareRows: CompareRow[] = useMemo(() => {
    const previewScenarios = SCENARIO_PRESETS.slice(0, 4);
    const baseScenario = previewScenarios.find((s) => s.isBase) ?? previewScenarios[0];
    const baseSelling = priceUnder(bundle.defaultVariant, baseScenario).out.sellingUsd;
    return previewScenarios.map((s) => {
      const { priced, roll, out } = priceUnder(bundle.defaultVariant, s);
      return {
        id: s.id,
        name: s.name,
        subtitle: s.subtitle,
        isActive: s.isBase,
        size: sizeOf(priced.parameters).join('" × ') + '"',
        moq: `${moqOf(priced.parameters).toLocaleString()} pcs`,
        quality: `${gsmOf(priced.parameters)} GSM`,
        rawMaterialInr: roll.rawMaterial,
        processInr: roll.process,
        accessoriesInr: roll.accessories,
        packagingInr: roll.packaging,
        testingInr: roll.testing,
        directCostUsd: roll.directCost,
        componentCount: roll.components.length,
        sellingUsd: out.sellingUsd,
        marginPct: out.marginPct,
        buyerTargetUsd: out.buyerTargetUsd,
        onTarget: out.onTarget,
        deltaPct: s.isBase ? null : scenarioDelta(out.sellingUsd, baseSelling),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle.defaultVariant, bundle.masters]);

  const selected = rollup.components.find((c) => c.component.id === selectedId) ?? null;

  const category: CostCategory = filter ?? "direct";

  /**
   * Every cost line on the build, grouped by category. A line is the thing that
   * costs money — a dyeing step, a label, a polybag — so the Process view lists
   * Dyeing / Cutting / Stitching rather than the components they belong to.
   */
  const allSections = useMemo(
    () => buildSections(rollup.components, pricedVariant.packaging, pricedVariant.testing),
    [rollup.components, pricedVariant.packaging, pricedVariant.testing],
  );

  /** The active view: one section when a category is picked, all of them otherwise. */
  const visibleSections = useMemo(() => {
    const key = CATEGORY_SECTION[category];
    return key ? allSections.filter((s) => s.id === key) : allSections;
  }, [allSections, category]);

  const lineCount = visibleSections.reduce((t, s) => t + s.lines.length, 0);

  /** The footer figure — always the sum of the lines on screen. */
  const categoryTotal =
    category === "direct" ? rollup.directCost : visibleSections.reduce((t, s) => t + s.total, 0);

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

  /* ---- live recalculation: every mutation is an immutable variant swap ---- */
  const pulse = () => {
    setLive(true);
    setTimeout(() => setLive(false), 1000);
  };

  const updateActive = (next: Variant) => {
    setVariants((prev) => prev.map((v) => (v.id === next.id ? next : v)));
    pulse();
  };

  const setParameter = (id: ParameterId, optionId: string) =>
    updateActive({
      ...activeVariant,
      parameters: selectParameter(activeVariant.parameters, id, optionId),
    });

  const addCustomParameter = (id: ParameterId, option: ParameterOption) =>
    updateActive({
      ...activeVariant,
      parameters: addCustomOption(activeVariant.parameters, id, option),
    });

  const setCommercial = (patch: Partial<CommercialInputs>) =>
    updateActive({ ...activeVariant, commercial: { ...activeVariant.commercial, ...patch } });

  /**
   * Swap the material master a component is built from. Self-fabric components
   * inherit through their stored relationship, so one change re-costs the whole
   * family without touching their records.
   *
   * A scenario that declares its own fabric re-applies that fabric on every
   * render, which would silently undo this choice. An explicit action inside a
   * scenario is a decision about THAT scenario, so the scenario's fabric is
   * updated to match rather than left to fight the variant.
   */
  const applyMaterial = (componentId: string, materialMasterId: string) => {
    const master = bundle.masters.materials[materialMasterId];
    if (!master) return;
    if (activeScenario.fabricMasterId) {
      setScenarios((prev) =>
        prev.map((s) =>
          s.id === activeScenario.id ? { ...s, fabricMasterId: materialMasterId } : s,
        ),
      );
    }
    updateActive({
      ...activeVariant,
      components: activeVariant.components.map((c) =>
        c.id === componentId && c.material
          ? {
              ...c,
              material: {
                ...c.material,
                // Choosing a specific master ends any inheritance — the slot is
                // now costed on its own cloth, not the parent's.
                relationship: "master",
                sameAsComponentId: undefined,
                materialMasterId,
                // The rate travels with the master. Carrying the previous
                // fabric's rate across would leave the row naming one cloth and
                // costing another; the quality parameter then re-derives from
                // this new base on the next pass.
                rate: sourced(master.rate, "Rate Master", master.rateMasterId),
                rateUnit: master.rateUnit,
              },
            }
          : c,
      ),
    });
  };

  /**
   * Put a component back on its parent's cloth. The relationship is stored
   * rather than the material, so the slot re-costs whenever the parent changes.
   */
  const inheritMaterial = (componentId: string) =>
    updateActive({
      ...activeVariant,
      components: activeVariant.components.map((c) =>
        c.id === componentId && c.material
          ? {
              ...c,
              material: {
                ...c.material,
                relationship: "same-as-component",
                sameAsComponentId: c.parentId ?? c.material.sameAsComponentId,
                materialMasterId: undefined,
                rate: { ...c.material.rate, override: undefined },
              },
            }
          : c,
      ),
    });

  /**
   * A line's option was changed — a dyeing method, a pack standard, a test
   * scope. Each writes a real rate onto the underlying item on the base
   * variant, so the roll-up (and therefore the row, the section subtotal, the
   * cost strip and the live output) all move on the next render. Nothing is
   * stored twice, and every change is recorded as a traceable override.
   */
  const selectLineOption = (
    kind: CostLine["kind"],
    componentId: string,
    itemId: string,
    optionId: string,
  ) => {
    if (kind === "material") {
      if (optionId === INHERIT_OPTION_ID) inheritMaterial(componentId);
      else applyMaterial(componentId, optionId);
      return;
    }
    if (kind === "accessory") {
      updateActive({
        ...activeVariant,
        components: activeVariant.components.map((c) =>
          c.id === componentId
            ? {
                ...c,
                accessories: c.accessories.map((a) =>
                  a.id === itemId ? applyAccessoryOption(a, optionId) : a,
                ),
              }
            : c,
        ),
      });
      return;
    }
    if (kind === "process") {
      updateActive({
        ...activeVariant,
        components: activeVariant.components.map((c) =>
          c.id === componentId
            ? {
                ...c,
                processes: c.processes.map((p) =>
                  p.id === itemId ? applyProcessOption(p, optionId) : p,
                ),
              }
            : c,
        ),
      });
      return;
    }
    if (kind === "packaging") {
      updateActive({
        ...activeVariant,
        packaging: activeVariant.packaging.map((p) =>
          p.id === itemId ? applyPackagingOption(p, optionId) : p,
        ),
      });
      return;
    }
    if (kind === "testing") {
      updateActive({
        ...activeVariant,
        testing: activeVariant.testing.map((t) =>
          t.id === itemId ? applyTestingOption(t, optionId) : t,
        ),
      });
    }
  };

  /** Components a process or trim can be attached to, in sheet order. */
  const attachTargets = rollup.components.map((c) => ({
    id: c.component.id,
    name: c.component.name,
  }));

  const openLibrary = (section?: LineSection["id"]) => {
    setLibrarySection(section ?? null);
    setLibraryOpen(true);
  };

  /**
   * A library entry becomes a real costed object — never a placeholder row.
   * Which object depends on what was picked: a fabric fills a slot as a new
   * component, a process attaches to an existing one, packaging and testing
   * sit at product level.
   */
  const addFromLibrary = (item: LibraryItem, targetComponentId: string | null, slot: string) => {
    const stamp = Date.now();

    if (item.kind === "fabric" || item.kind === "filling") {
      const id = `CMP-${stamp}`;
      const base = activeVariant.components.find((c) => c.consumption)?.consumption;
      const component = componentFromLibrary(item, {
        id,
        productId: activeVariant.productId,
        sequence: activeVariant.components.length + 1,
        slot,
        // A new slot is cut to the same finished size as the build it joins.
        finishedWidth: base?.finishedWidth ?? 20,
        finishedLength: base?.finishedLength ?? 26,
      });
      updateActive(addComponentTo(activeVariant, component));
      setSelectedId(id);
    } else if (item.kind === "process" && targetComponentId) {
      const target = rollup.components.find((c) => c.component.id === targetComponentId);
      // A per-metre step is charged on every metre the component consumes; a
      // per-piece step is charged once per occurrence.
      const quantity =
        item.process?.basis === "per m"
          ? (target?.consumptionPerPiece ?? 1)
          : item.process?.basis === "per 1000 stitches"
            ? 12.5
            : 1;
      updateActive({
        ...activeVariant,
        components: activeVariant.components.map((c) => {
          if (c.id !== targetComponentId) return c;
          const step = processFromLibrary(item, c.id, c.processes.length + 1, quantity);
          return step ? { ...c, processes: [...c.processes, step] } : c;
        }),
      });
    } else if (item.kind === "trim" && targetComponentId) {
      updateActive({
        ...activeVariant,
        components: activeVariant.components.map((c) =>
          c.id === targetComponentId
            ? {
                ...c,
                accessories: [...c.accessories, accessoryFromLibrary(item, `ACC-${stamp}`, c.id)],
              }
            : c,
        ),
      });
    } else if (item.kind === "packaging") {
      updateActive({
        ...activeVariant,
        packaging: [...activeVariant.packaging, packagingFromLibrary(item, `PKG-${stamp}`)],
      });
    } else if (item.kind === "testing") {
      const lotSize = activeVariant.testing[0]?.lotSize ?? 3000;
      updateActive({
        ...activeVariant,
        testing: [...activeVariant.testing, testingFromLibrary(item, `TST-${stamp}`, lotSize)],
      });
    }

    setLibraryOpen(false);
  };

  /**
   * Removing a line removes the thing it stands for — a material line is the
   * component itself, a process line is one step on it. The roll-up moves on
   * the next render; nothing is soft-deleted or hidden.
   */
  const removeLine = (line: CostLine) => {
    if (!line.removable || !line.target) return;
    const { componentId, itemId } = line.target;

    if (line.kind === "material") {
      updateActive(removeComponentFrom(activeVariant, componentId));
      if (selectedId === componentId) setSelectedId(null);
      return;
    }
    if (line.kind === "process" || line.kind === "accessory") {
      updateActive({
        ...activeVariant,
        components: activeVariant.components.map((c) =>
          c.id === componentId
            ? line.kind === "process"
              ? { ...c, processes: c.processes.filter((p) => p.id !== itemId) }
              : { ...c, accessories: c.accessories.filter((a) => a.id !== itemId) }
            : c,
        ),
      });
      return;
    }
    if (line.kind === "packaging") {
      updateActive({
        ...activeVariant,
        packaging: activeVariant.packaging.filter((p) => p.id !== itemId),
      });
      return;
    }
    updateActive({
      ...activeVariant,
      testing: activeVariant.testing.filter((t) => t.id !== itemId),
    });
  };

  /* ---- variants + options ---- */
  const createDuplicateVariant = (name: string) => {
    const id = `VAR-${Date.now()}`;
    const next = duplicateVariant(activeVariant, id, name);
    setVariants((prev) => [...prev, { ...next, kind: "variant" }]);
    setActiveVariantId(id);
    setSelectedId(null);
    setVariantModalOpen(false);
  };

  const createCustomVariant = (name: string, description: string) => {
    const id = `VAR-${Date.now()}`;
    const next = duplicateVariant(activeVariant, id, name);
    setVariants((prev) => [
      ...prev,
      { ...next, kind: "variant", description, creationMethod: "New" },
    ]);
    setActiveVariantId(id);
    setSelectedId(null);
    setVariantModalOpen(false);
  };

  /**
   * An option is a branch off the active variant, just like a duplicate, but
   * scoped to one or more parameter values rather than a full copy — so it
   * gets its own tab, nested under the variant it came from, instead of
   * silently rewriting the active variant's configuration.
   */
  const createOption = (name: string, entries: OptionEntry[]) => {
    const id = `OPT-${Date.now()}`;
    const next = duplicateVariant(activeVariant, id, name);
    const parameters = entries.reduce(
      (params, { parameterId, option }) => addCustomOption(params, parameterId, option),
      next.parameters,
    );
    setVariants((prev) => [
      ...prev,
      { ...next, parameters, kind: "option", parentId: activeVariant.id },
    ]);
    setActiveVariantId(id);
    setSelectedId(null);
    setOptionModalOpen(false);
  };

  const closeVariant = (id: string) => {
    const next = variants.filter((v) => v.id !== id && v.parentId !== id);
    if (!next.length) return;
    setVariants(next);
    if (!next.some((v) => v.id === activeVariantId)) setActiveVariantId(next[0].id);
    setSelectedId(null);
  };

  const tabs: WorkVariant[] = variants.map((v) => ({
    id: v.id,
    name: v.name,
    kind: v.kind,
    parentId: v.parentId,
  }));

  /** A set has no bill of materials of its own — it renders as a combined sheet. */
  const isSet = article.type === "kit";

  return (
    <div className="flex h-screen w-full flex-col bg-canvas">
      <ProductHeader
        pod={pod}
        article={article}
        mounted={mounted}
        totalCost={
          isSet
            ? `USD $${setDirectCostUsd(article.kitItems).toFixed(2)}`
            : `USD ${money(rollup.directCost)}`
        }
        backTo={
          <Link
            to="/pods/$id"
            params={{ id: pod.id }}
            aria-label="Back to articles"
            className="rounded-md p-1 text-ink-500 hover:bg-surface-alt hover:text-ink-900"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        }
      >
        <ActionGroup>
          <button
            type="button"
            onClick={() => setCopilotOpen((o) => !o)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
              copilotOpen
                ? "border-brand-700 bg-brand-50 text-brand-700"
                : "border-hairline bg-surface text-ink-700 hover:bg-surface-alt",
            )}
          >
            <Sparkles className="h-4 w-4" /> AI Copilot
          </button>
          <ModuleRevisionAction />
          <button
            type="button"
            onClick={() => setCompareOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 py-2 text-[13px] font-medium text-ink-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            <Scale className="h-4 w-4" /> Compare
          </button>
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
            Continue to Quotation <ArrowRight className="h-4 w-4" />
          </button>
        </ActionGroup>
      </ProductHeader>

      {/* ---- a set: combined sheet across its articles, no BOM of its own ---- */}
      {isSet ? (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <BundleWorkspace
            pod={pod}
            article={article}
            stepper={
              <WorkflowStepper
                active="Configuration & Costing"
                podId={pod.id}
                articleId={article.id}
                costingRef={article.srfRef}
              />
            }
          />
        </div>
      ) : (
        /* ---- three columns ---- */
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <ConfigurationRail
            scenarioName={activeScenario.name}
            productContext={`${product.size} (${product.name})`}
            parameters={pricedVariant.parameters}
            commercial={pricedVariant.commercial}
            output={output}
            money={money}
            onSelect={setParameter}
            onAddCustom={addCustomParameter}
            onCommercialChange={setCommercial}
            onRecalculate={pulse}
            live={live}
          />

          <main className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-canvas p-4">
            {/* product card */}
            <div className="shrink-0 rounded-xl border border-hairline bg-surface p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  {article.image && (
                    <img
                      src={article.image}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-lg border border-hairline object-cover"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="truncate text-[16px] font-semibold text-ink-900">
                        {product.name}
                      </h1>
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10.5px] font-medium text-brand-700">
                        {product.status}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-500">
                      <span className="rounded bg-surface-alt px-1.5 py-0.5">
                        # {product.articleNo}
                      </span>
                      <span className="rounded bg-surface-alt px-1.5 py-0.5"># {pod.id}</span>
                      <Meta label="Size" value={product.size} />
                      <Meta label="MOQ" value={product.moq} />
                      <Meta label="Buyer" value={product.buyer} />
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-medium uppercase tracking-[0.1em] text-ink-500">
                    Total Direct Cost
                  </div>
                  <div className="text-[22px] font-semibold tabular-nums text-ink-900">
                    {money(rollup.directCost)}
                  </div>
                  <div className="text-[10.5px] text-ink-400">/ pc</div>
                </div>
              </div>

              <div className="-mx-4 mt-3 border-t border-hairline">
                <WorkflowStepper
                  active="Configuration & Costing"
                  podId={pod.id}
                  articleId={article.id}
                  costingRef={article.srfRef}
                />
              </div>
            </div>

            {/* variants inside the scenario */}
            <div className="mt-3 shrink-0 overflow-hidden rounded-xl border border-hairline bg-surface">
              <VariantTabs
                variants={tabs}
                activeId={activeVariantId}
                price={(id) => money(variantTotal(id))}
                onSelect={(id) => {
                  setActiveVariantId(id);
                  setSelectedId(null);
                }}
                onAdd={(kind) =>
                  kind === "variant" ? setVariantModalOpen(true) : setOptionModalOpen(true)
                }
                onDuplicate={(id) => {
                  const src = variants.find((v) => v.id === id);
                  if (!src) return;
                  const newId = `VAR-${Date.now()}`;
                  setVariants((prev) => [
                    ...prev,
                    duplicateVariant(src, newId, `${src.name} copy`),
                  ]);
                  setActiveVariantId(newId);
                  setSelectedId(null);
                }}
                onRename={(id, name) =>
                  setVariants((prev) => prev.map((v) => (v.id === id ? { ...v, name } : v)))
                }
                onClose={closeVariant}
              />

              <CostBreakdownStrip
                rollup={rollup}
                money={money}
                activeKey={filter}
                live={live}
                onSelect={(k) => setFilter((prev) => (prev === k ? null : k))}
              />

              {filter && (
                <CategoryComposition
                  category={filter}
                  rollup={rollup}
                  packaging={pricedVariant.packaging}
                  testing={pricedVariant.testing}
                  money={money}
                />
              )}
            </div>

            {filter && (
              <div className="mt-2 flex shrink-0 items-center gap-2 rounded-lg bg-brand-50 px-4 py-1.5 text-[11.5px] text-brand-800">
                <span>
                  Showing{" "}
                  <strong className="font-semibold">{CATEGORY_COPY[category].totalLabel}</strong> —{" "}
                  {lineCount} cost line{lineCount === 1 ? "" : "s"} totalling {money(categoryTotal)}{" "}
                  / pc
                </span>
                <button
                  type="button"
                  onClick={() => setFilter(null)}
                  className="rounded px-1.5 py-0.5 font-medium underline underline-offset-2 hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
                >
                  Show the full sheet
                </button>
              </div>
            )}

            <div className="mt-3">
              <CostLineTable
                sections={visibleSections}
                money={money}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onAdd={openLibrary}
                onRemove={removeLine}
                onSelectOption={selectLineOption}
                title={filter ? CATEGORY_COPY[category].totalLabel : "Costing Sheet"}
                caption={CATEGORY_COPY[category].caption}
                totalLabel={CATEGORY_COPY[category].totalLabel}
                total={categoryTotal}
                live={live}
                compact={Boolean(selected)}
              />
            </div>

            <p className="mt-2 shrink-0 text-[10.5px] text-ink-400">
              * Costs shown are per piece. Values update automatically as the configuration changes.
            </p>
          </main>

          {copilotOpen ? (
            <div className="w-[360px] shrink-0">
              <CopilotPanel
                context={`${product.name} · ${activeVariant.name}`}
                onClose={() => setCopilotOpen(false)}
                onApply={() => {}}
              />
            </div>
          ) : (
            <ComponentInspector
              resolved={selected}
              productName={product.name}
              scenarioName={activeScenario.name}
              money={money}
              onClose={() => setSelectedId(null)}
            />
          )}
        </div>
      )}

      <ArticleTabsBar
        podId={pod.id}
        articles={sheets}
        activeId={article.id}
        sel={sel}
        fixed={false}
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

      <ComponentLibraryModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        section={librarySection}
        targets={attachTargets}
        onAdd={addFromLibrary}
      />

      <AddVariantModal
        open={variantModalOpen}
        onClose={() => setVariantModalOpen(false)}
        activeVariantName={activeVariant.name}
        onDuplicate={createDuplicateVariant}
        onCreateCustom={createCustomVariant}
      />

      <AddOptionModal
        open={optionModalOpen}
        onClose={() => setOptionModalOpen(false)}
        parameters={pricedVariant.parameters}
        onCreate={createOption}
      />

      {compareOpen && (
        <CompareWorkspace
          open={compareOpen}
          onClose={() => setCompareOpen(false)}
          productName={product.name}
          articleNo={product.articleNo}
          variantRows={variantCompareRows}
          scenarioRows={scenarioCompareRows}
          money={money}
          onApplyVariant={(id) => {
            if (variants.some((v) => v.id === id)) {
              setActiveVariantId(id);
              setSelectedId(null);
            }
            setCompareOpen(false);
          }}
        />
      )}

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

      {/* Bundle / set costing — several articles quoted as one combined offering */}
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

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span>
      {label}: <span className="font-medium text-ink-900">{value}</span>
    </span>
  );
}
