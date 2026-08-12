/**
 * The single-product costing experience, as a component.
 *
 * This is the workspace that already existed on the Configuration route —
 * left rail, component table, inspector, scenarios, variants and options —
 * lifted out unchanged so it can be rendered in TWO places:
 *
 *   • a single article being costed on its own
 *   • one tab of a KIT, where each member article gets the very same screen
 *
 * Nothing about the costing changed in the move. Everything on screen is still
 * produced by one model from one variant, the manufacturing roll-up still ends
 * at DIRECT COST, and the commercial layer still sits beside it without
 * feeding back in.
 *
 * Two things are new, and both are about the steps downstream:
 *   1. it reports its roll-up upward (`onCosted`) so a Kit Summary can
 *      consolidate its members without re-costing them;
 *   2. it publishes its scenarios, variants and options so Quotation can offer
 *      exactly what costing has open — never a list of its own invention.
 */

import { useEffect, useMemo, useState } from "react";
import { Scale, Sparkles } from "lucide-react";

import { VariantTabs, type WorkVariant } from "@/components/configuration/VariantTabs";
import { CopilotPanel } from "@/components/configuration/CopilotPanel";
import { AddVariantModal } from "@/components/configuration/AddVariantModal";
import { AddOptionModal, type OptionEntry } from "@/components/configuration/AddOptionModal";
import { CompareWorkspace, type CompareRow } from "@/components/configuration/CompareWorkspace";

import { CostBreakdownStrip, type CostCategory } from "@/components/workspace/CostBreakdownStrip";
import { CategoryComposition } from "@/components/workspace/CategoryComposition";
import { CostLineTable } from "@/components/workspace/CostLineTable";
import { ComponentInspector } from "@/components/workspace/ComponentInspector";
import { ComponentLibraryModal } from "@/components/workspace/ComponentLibraryModal";
import { ConfigurationRail } from "@/components/workspace/ConfigurationRail";

import { cn } from "@/lib/utils";
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
import { publishSelection, type BuildRef } from "@/lib/costingSelectionStore";
import { seedVariantFor } from "@/lib/articleCosting";

/* ------------------------------------------------------------------ *
 * Contract
 * ------------------------------------------------------------------ */

/** Who is being costed — a POD article, or one member article of a kit. */
export type CostingIdentity = {
  /** POD article id, or the kit member's id */
  articleId: string;
  name: string;
  srfRef: string;
  size?: string;
  moq?: string;
  image?: string;
  articleNo?: string;
  styleNo?: string;
  colour?: string;
  currency?: string;
};

/** What this workspace reports upward, so a kit can consolidate its members. */
export type ArticleCosting = {
  articleId: string;
  name: string;
  image?: string;
  rollup: CostRollup;
  scenarioName: string;
  variantName: string;
  moq: number;
  sizeLabel: string;
  fxRate: number;
  sellingUsd: number;
  marginPct: number;
};

const CATEGORY_SECTION: Record<CostCategory, LineSection["id"] | null> = {
  raw: "material",
  process: "process",
  accessories: "accessory",
  packaging: "packaging",
  testing: "testing",
  direct: null,
};

const CATEGORY_COPY: Record<CostCategory, { caption: string; totalLabel: string }> = {
  raw: {
    caption: "Fabric, filling, interlining and every other direct material",
    totalLabel: "Raw Material Total",
  },
  process: {
    caption: "Dyeing, printing, embroidery, quilting, cutting, stitching, finishing",
    totalLabel: "Process Total",
  },
  accessories: {
    caption: "Zippers, buttons, labels, tags, tapes, cords and other trims",
    totalLabel: "Accessories / Trims Total",
  },
  packaging: {
    caption: "Polybag, wrap, inserts, labels and carton — costed at product level",
    totalLabel: "Packaging Total",
  },
  testing: {
    caption: "Lab tests, certification and inspection — lot cost spread across the MOQ",
    totalLabel: "Testing & Certification Total",
  },
  direct: {
    caption: "Define all components that make up this product",
    totalLabel: "Total Direct Cost",
  },
};

/* ------------------------------------------------------------------ *
 * Workspace
 * ------------------------------------------------------------------ */

export function ArticleCostingWorkspace({
  podId,
  buyer,
  buyerRef,
  identity,
  headerSlot,
  productCard = true,
  onCosted,
}: {
  podId: string;
  buyer: string;
  buyerRef: string;
  identity: CostingIdentity;
  /** the workflow band, when this workspace owns the page */
  headerSlot?: React.ReactNode;
  /** kits render their own header, so the product card is suppressed there */
  productCard?: boolean;
  onCosted?: (summary: ArticleCosting) => void;
}) {
  const bundle = resolveCostingModel(identity.srfRef);

  /* ---- scenarios: whole costing positions ---- */
  const [scenarios, setScenarios] = useState<Scenario[]>(DEFAULT_SCENARIOS);
  const [activeScenarioId, setActiveScenarioId] = useState(DEFAULT_SCENARIOS[0].id);

  /* ---- variants inside the active scenario ---- */
  const [variants, setVariants] = useState<Variant[]>([
    seedVariantFor(bundle.defaultVariant, identity),
  ]);
  const [activeVariantId, setActiveVariantId] = useState(bundle.defaultVariant.id);

  /* ---- workspace UI state ---- */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [librarySection, setLibrarySection] = useState<LineSection["id"] | null>(null);
  const [filter, setFilter] = useState<CostCategory | null>(null);
  const [live, setLive] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [optionModalOpen, setOptionModalOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  // Switching to an article backed by a different product bundle (Placemat →
  // Quilt) re-seeds everything derived from it. Param-only navigation does not
  // remount the route, so this is what stops the wrong product's components
  // showing after a tab change.
  useEffect(() => {
    setVariants([seedVariantFor(bundle.defaultVariant, identity)]);
    setActiveVariantId(bundle.defaultVariant.id);
    setScenarios(DEFAULT_SCENARIOS);
    setActiveScenarioId(DEFAULT_SCENARIOS[0].id);
    setSelectedId(null);
    setFilter(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle.product.id, identity.articleId]);

  const activeVariant = variants.find((v) => v.id === activeVariantId) ?? variants[0];
  const activeScenario = scenarios.find((s) => s.id === activeScenarioId) ?? scenarios[0];

  /** Identity comes from the real article record, not the model's constant. */
  const product: Product = useMemo(
    () => ({
      ...bundle.product,
      name: identity.name,
      articleNo: identity.articleNo ?? identity.articleId,
      styleId: identity.styleNo ?? bundle.product.styleId,
      buyer,
      buyerRef,
      size: identity.size || bundle.product.size,
      colour: identity.colour || bundle.product.colour,
      moq: identity.moq || bundle.product.moq,
      currency: identity.currency || bundle.product.currency,
    }),
    [bundle.product, identity, buyer, buyerRef],
  );

  /** base variant → scenario overrides → parameter application. All pure. */
  const pricedVariant = useMemo(() => {
    const scoped = applyScenario(activeVariant, activeScenario);
    return applyParameters(scoped, scoped.parameters, bundle.masters);
  }, [activeVariant, activeScenario, bundle.masters]);

  /** One roll-up — the single computation every column reads from. */
  const rollup: CostRollup = useMemo(
    () => rollupVariant(pricedVariant, bundle.masters),
    [pricedVariant, bundle.masters],
  );

  const output = useMemo(
    () => commercialOutput(rollup.directCost, pricedVariant.commercial),
    [rollup.directCost, pricedVariant.commercial],
  );

  const money = useMemo(
    () => createMoney("USD", pricedVariant.commercial.fxRate),
    [pricedVariant.commercial.fxRate],
  );

  /* ---- report upward, for the Kit Summary ---- */
  useEffect(() => {
    onCosted?.({
      articleId: identity.articleId,
      name: identity.name,
      image: identity.image,
      rollup,
      scenarioName: activeScenario.name,
      variantName: activeVariant.name,
      moq: moqOf(pricedVariant.parameters),
      sizeLabel: sizeOf(pricedVariant.parameters).join('" × ') + '"',
      fxRate: pricedVariant.commercial.fxRate,
      sellingUsd: output.sellingUsd,
      marginPct: output.marginPct,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollup, output, activeScenario.name, activeVariant.name, identity.articleId]);

  /* ---- publish to Quotation ---- */
  useEffect(() => {
    publishSelection({
      podId,
      articleId: identity.articleId,
      srfRef: identity.srfRef,
      scenarios,
      activeScenarioId: activeScenario.id,
      builds: variants.map(toBuildRef),
      activeBuildId: activeVariant.id,
    });
  }, [
    podId,
    identity.articleId,
    identity.srfRef,
    scenarios,
    activeScenario.id,
    variants,
    activeVariant.id,
  ]);

  /* ---- scenario comparison ---- */
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

  const priceUnder = (v: Variant, scenario: Scenario) => {
    const scoped = applyScenario(v, scenario);
    const priced = applyParameters(scoped, scoped.parameters, bundle.masters);
    const roll = rollupVariant(priced, bundle.masters);
    return { priced, roll, out: commercialOutput(roll.directCost, priced.commercial) };
  };

  const rowFrom = (
    id: string,
    name: string,
    subtitle: string,
    isActive: boolean,
    v: Variant,
    scenario: Scenario,
    baseSelling: number,
  ): CompareRow => {
    const { priced, roll, out } = priceUnder(v, scenario);
    return {
      id,
      name,
      subtitle,
      isActive,
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
      deltaPct: isActive ? null : scenarioDelta(out.sellingUsd, baseSelling),
    };
  };

  const variantCompareRows: CompareRow[] = useMemo(() => {
    const baseSelling = priceUnder(activeVariant, activeScenario).out.sellingUsd;
    return variants.map((v) =>
      rowFrom(
        v.id,
        v.name,
        v.kind === "option" ? "Option" : "Variant",
        v.id === activeVariantId,
        v,
        activeScenario,
        baseSelling,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variants, activeVariantId, activeScenario, bundle.masters]);

  const scenarioCompareRows: CompareRow[] = useMemo(() => {
    const preview = SCENARIO_PRESETS.slice(0, 4);
    const base = preview.find((s) => s.isBase) ?? preview[0];
    const baseSelling = priceUnder(bundle.defaultVariant, base).out.sellingUsd;
    return preview.map((s) =>
      rowFrom(s.id, s.name, s.subtitle, Boolean(s.isBase), bundle.defaultVariant, s, baseSelling),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle.defaultVariant, bundle.masters]);

  const selected = rollup.components.find((c) => c.component.id === selectedId) ?? null;
  const category: CostCategory = filter ?? "direct";

  const allSections = useMemo(
    () => buildSections(rollup.components, pricedVariant.packaging, pricedVariant.testing),
    [rollup.components, pricedVariant.packaging, pricedVariant.testing],
  );

  const visibleSections = useMemo(() => {
    const key = CATEGORY_SECTION[category];
    return key ? allSections.filter((s) => s.id === key) : allSections;
  }, [allSections, category]);

  const lineCount = visibleSections.reduce((t, s) => t + s.lines.length, 0);
  const categoryTotal =
    category === "direct" ? rollup.directCost : visibleSections.reduce((t, s) => t + s.total, 0);

  /* ---- mutations: every change is an immutable variant swap ---- */
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

  const applyMaterial = (componentId: string, materialMasterId: string) => {
    const master = bundle.masters.materials[materialMasterId];
    if (!master) return;
    // A scenario that declares its own fabric would re-apply it on the next
    // render and silently undo this choice, so the scenario is updated to
    // match rather than left to fight the variant.
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
                relationship: "master",
                sameAsComponentId: undefined,
                materialMasterId,
                rate: sourced(master.rate, "Rate Master", master.rateMasterId),
                rateUnit: master.rateUnit,
              },
            }
          : c,
      ),
    });
  };

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
    if (kind === "accessory" || kind === "process") {
      updateActive({
        ...activeVariant,
        components: activeVariant.components.map((c) =>
          c.id !== componentId
            ? c
            : kind === "accessory"
              ? {
                  ...c,
                  accessories: c.accessories.map((a) =>
                    a.id === itemId ? applyAccessoryOption(a, optionId) : a,
                  ),
                }
              : {
                  ...c,
                  processes: c.processes.map((p) =>
                    p.id === itemId ? applyProcessOption(p, optionId) : p,
                  ),
                },
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

  const attachTargets = rollup.components.map((c) => ({
    id: c.component.id,
    name: c.component.name,
  }));

  const openLibrary = (section?: LineSection["id"]) => {
    setLibrarySection(section ?? null);
    setLibraryOpen(true);
  };

  /** A library entry becomes a real costed object — never a placeholder row. */
  const addFromLibrary = (item: LibraryItem, targetComponentId: string | null, slot: string) => {
    const stamp = Date.now();

    if (item.kind === "fabric" || item.kind === "filling") {
      const id = `CMP-${stamp}`;
      const base = activeVariant.components.find((c) => c.consumption)?.consumption;
      updateActive(
        addComponentTo(
          activeVariant,
          componentFromLibrary(item, {
            id,
            productId: activeVariant.productId,
            sequence: activeVariant.components.length + 1,
            slot,
            finishedWidth: base?.finishedWidth ?? 20,
            finishedLength: base?.finishedLength ?? 26,
          }),
        ),
      );
      setSelectedId(id);
    } else if (item.kind === "process" && targetComponentId) {
      const target = rollup.components.find((c) => c.component.id === targetComponentId);
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

  /** Removing a line removes the thing it stands for. Nothing is soft-deleted. */
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

  /* ---- variants + options + scenarios ---- */
  const createVariant = (name: string, description?: string) => {
    const id = `VAR-${Date.now()}`;
    const next = duplicateVariant(activeVariant, id, name);
    setVariants((prev) => [
      ...prev,
      {
        ...next,
        kind: "variant",
        description,
        creationMethod: description ? "New" : next.creationMethod,
      },
    ]);
    setActiveVariantId(id);
    setSelectedId(null);
    setVariantModalOpen(false);
  };

  /**
   * An option is a branch off the active variant scoped to one or more
   * parameter values — so it gets its own tab nested under that variant
   * instead of silently rewriting it.
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

  const addScenario = (preset: Scenario) => {
    if (scenarios.some((s) => s.id === preset.id)) {
      setActiveScenarioId(preset.id);
      return;
    }
    setScenarios((prev) => [...prev, preset]);
    setActiveScenarioId(preset.id);
    setSelectedId(null);
  };

  const closeScenario = (id: string) => {
    const next = scenarios.filter((s) => s.id !== id);
    if (!next.length) return;
    setScenarios(next);
    if (!next.some((s) => s.id === activeScenarioId)) setActiveScenarioId(next[0].id);
  };

  const tabs: WorkVariant[] = variants.map((v) => ({
    id: v.id,
    name: v.name,
    kind: v.kind,
    parentId: v.parentId,
  }));

  return (
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
        {productCard && (
          <div className="shrink-0 rounded-xl border border-hairline bg-surface p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                {identity.image && (
                  <img
                    src={identity.image}
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
                    <span className="rounded bg-surface-alt px-1.5 py-0.5"># {podId}</span>
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

            {headerSlot && <div className="-mx-4 mt-3 border-t border-hairline">{headerSlot}</div>}
          </div>
        )}

        {/* scenarios — whole costing positions */}
        <div
          className={cn(
            "shrink-0 overflow-hidden rounded-xl border border-hairline bg-surface",
            productCard ? "mt-3" : "",
          )}
        >
          {/* Scenario navigation lives in the variant tabs below — a second
              scenario strip here was duplicate navigation for the same thing. */}
          {/* variants and options inside the active scenario */}
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
              setVariants((prev) => [...prev, duplicateVariant(src, newId, `${src.name} copy`)]);
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
              {lineCount} cost line{lineCount === 1 ? "" : "s"} totalling {money(categoryTotal)} /
              pc
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

        <div className="mt-2 flex shrink-0 flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 text-[10.5px] text-ink-400">
            * Costs shown are per piece. Values update automatically as the configuration changes.
          </p>
          <button
            type="button"
            onClick={() => setCompareOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[11.5px] font-medium text-ink-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            <Scale className="h-3.5 w-3.5 text-ink-400" /> Compare
          </button>
          <button
            type="button"
            onClick={() => setCopilotOpen((o) => !o)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
              copilotOpen
                ? "border-brand-700 bg-brand-50 text-brand-700"
                : "border-hairline bg-surface text-ink-700 hover:bg-surface-alt",
            )}
          >
            <Sparkles className="h-3.5 w-3.5" /> AI Copilot
          </button>
        </div>
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
        onDuplicate={(name) => createVariant(name)}
        onCreateCustom={(name, description) => createVariant(name, description)}
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
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/** What Quotation needs to know about a build, without the component tree. */
function toBuildRef(v: Variant): BuildRef {
  return {
    id: v.id,
    name: v.name,
    kind: v.kind === "option" ? "option" : "variant",
    parentId: v.parentId,
    description: v.description,
    pins: v.parameters.map((p) => ({
      parameterId: p.id,
      option: p.options.find((o) => o.id === p.selectedId) ?? p.options[0],
    })),
  };
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span>
      {label}: <span className="font-medium text-ink-900">{value}</span>
    </span>
  );
}
