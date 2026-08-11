/**
 * Bundle / Set configuration workspace.
 *
 * A set is several articles quoted as one line. This workspace provides:
 *   1. Left Rail        → Parameter & commercial configuration for the active article in the set
 *   2. Header Card      → Set summary, direct cost, MOQ, kit composition controls & article library drawer
 *   3. Combined Table   → One column per article, row breakdown per cost category, plus SET TOTAL
 *   4. Detailed Sheets  → Fully EDITABLE costing sheet (CostLineTable) per member article
 *   5. Component Inspector → Right-hand calculation inspector when a component line is clicked
 *   6. Component Library → Modal to add materials, processes, trims, packaging, testing
 */

import { useMemo, useState } from "react";
import {
  Boxes,
  ChevronDown,
  Layers,
  Plus,
  Trash2,
  Minus,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { CostLineTable } from "@/components/workspace/CostLineTable";
import { ConfigurationRail } from "@/components/workspace/ConfigurationRail";
import { ComponentInspector } from "@/components/workspace/ComponentInspector";
import { ComponentLibraryModal } from "@/components/workspace/ComponentLibraryModal";
import { ArticleLibraryDrawer } from "@/components/articles/ArticleLibraryDrawer";

import { createMoney } from "@/lib/money";
import { resolveCostingModel } from "@/lib/costingModels";
import {
  rollupVariant,
  type CostRollup,
  type Variant,
  type ResolvedComponent,
  removeComponentFrom,
  addComponentTo,
  sourced,
} from "@/lib/costingModel";
import {
  applyParameters,
  commercialOutput,
  selectParameter,
  addCustomOption,
  type CommercialInputs,
  type ParameterId,
  type ParameterOption,
} from "@/lib/pricingVariants";
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
import { type LibraryArticle } from "@/lib/articleLibrary";
import { updateArticle, type Article, type KitItem, type Pod } from "@/lib/podsStore";

/** One member article, fully costed on its active variant build. */
type MemberCosting = {
  item: KitItem;
  variant: Variant;
  pricedVariant: Variant;
  rollup: CostRollup;
  sections: LineSection[];
  /** per piece, USD */
  directUsd: number;
  sellingUsd: number;
  marginPct: number;
  fxRate: number;
  money: ReturnType<typeof createMoney>;
};

const usd = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** The cost categories the combined table breaks a set down into. */
const CATEGORY_ROWS = [
  { key: "rawMaterial", label: "Raw material" },
  { key: "process", label: "Process" },
  { key: "accessories", label: "Accessories / trims" },
  { key: "packaging", label: "Packaging" },
  { key: "testing", label: "Testing & certification" },
] as const;

function costMemberStatic(item: KitItem): MemberCosting {
  const bundle = resolveCostingModel(item.srfRef);
  const variant = bundle.defaultVariant;
  const pricedVariant = applyParameters(variant, variant.parameters, bundle.masters);
  const rollup = rollupVariant(pricedVariant, bundle.masters);
  const out = commercialOutput(rollup.directCost, pricedVariant.commercial);
  const fxRate = pricedVariant.commercial.fxRate > 0 ? pricedVariant.commercial.fxRate : 1;
  return {
    item,
    variant,
    pricedVariant,
    rollup,
    sections: buildSections(rollup.components, pricedVariant.packaging, pricedVariant.testing),
    directUsd: rollup.directCost / fxRate,
    sellingUsd: out.sellingUsd,
    marginPct: out.marginPct,
    fxRate,
    money: createMoney("USD", fxRate),
  };
}

/** Set direct cost per set, in USD — for the header, without rendering the workspace. */
export function setDirectCostUsd(items: KitItem[] = []): number {
  return items.filter((i) => !i.optional).reduce((s, i) => s + costMemberStatic(i).directUsd * i.qty, 0);
}

export function BundleWorkspace({
  pod,
  article,
  stepper,
}: {
  pod?: Pod;
  article: Article;
  /** Workflow band, rendered inside the set summary card. */
  stepper?: React.ReactNode;
}) {
  const items = useMemo(() => article.kitItems ?? [], [article.kitItems]);

  // Track active variants per member article
  const [memberVariants, setMemberVariants] = useState<Record<string, Variant>>({});
  const [activeMemberId, setActiveMemberId] = useState<string>(items[0]?.id ?? "");

  // UI State for Inspector & Library Modals
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [inspectorMemberId, setInspectorMemberId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryMemberId, setLibraryMemberId] = useState<string | null>(null);
  const [librarySection, setLibrarySection] = useState<LineSection["id"] | null>(null);
  const [addArticleOpen, setAddArticleOpen] = useState(false);
  const [openAccordionId, setOpenAccordionId] = useState<string | null>(items[0]?.id ?? null);
  const [live, setLive] = useState(false);

  const pulse = () => {
    setLive(true);
    setTimeout(() => setLive(false), 1000);
  };

  const currentActiveId = items.some((i) => i.id === activeMemberId)
    ? activeMemberId
    : items[0]?.id ?? "";

  // Compute live costing for every member article based on its active variant
  const members = useMemo<MemberCosting[]>(() => {
    return items.map((item) => {
      const bundle = resolveCostingModel(item.srfRef);
      const variant = memberVariants[item.id] ?? bundle.defaultVariant;
      const pricedVariant = applyParameters(variant, variant.parameters, bundle.masters);
      const rollup = rollupVariant(pricedVariant, bundle.masters);
      const out = commercialOutput(rollup.directCost, pricedVariant.commercial);
      const fxRate = pricedVariant.commercial.fxRate > 0 ? pricedVariant.commercial.fxRate : 1;
      return {
        item,
        variant,
        pricedVariant,
        rollup,
        sections: buildSections(rollup.components, pricedVariant.packaging, pricedVariant.testing),
        directUsd: rollup.directCost / fxRate,
        sellingUsd: out.sellingUsd,
        marginPct: out.marginPct,
        fxRate,
        money: createMoney("USD", fxRate),
      };
    });
  }, [items, memberVariants]);

  const committed = members.filter((m) => !m.item.optional);
  const setTotals = useMemo(() => {
    const per = (pick: (m: MemberCosting) => number) =>
      committed.reduce((s, m) => s + (pick(m) / m.fxRate) * m.item.qty, 0);
    const direct = committed.reduce((s, m) => s + m.directUsd * m.item.qty, 0);
    const selling = committed.reduce((s, m) => s + m.sellingUsd * m.item.qty, 0);
    return {
      rawMaterial: per((m) => m.rollup.rawMaterial),
      process: per((m) => m.rollup.process),
      accessories: per((m) => m.rollup.accessories),
      packaging: per((m) => m.rollup.packaging),
      testing: per((m) => m.rollup.testing),
      direct,
      selling,
      marginPct: selling > 0 ? ((selling - direct) / selling) * 100 : 0,
      pieces: members.reduce((s, m) => s + m.item.qty, 0),
    };
  }, [committed, members]);

  // Active member for Left Rail configuration
  const activeMember = members.find((m) => m.item.id === currentActiveId) ?? members[0];

  // Inspector component resolution
  const inspectorMember = members.find((m) => m.item.id === inspectorMemberId);
  const selectedResolvedComponent: ResolvedComponent | null = useMemo(() => {
    if (!inspectorMember || !selectedComponentId) return null;
    return (
      inspectorMember.rollup.components.find(
        (c) => c.component.id === selectedComponentId,
      ) ?? null
    );
  }, [inspectorMember, selectedComponentId]);

  // Library targets for component modal
  const libraryMember = members.find((m) => m.item.id === libraryMemberId);
  const libraryTargets = useMemo(
    () =>
      libraryMember
        ? libraryMember.rollup.components.map((c) => ({
            id: c.component.id,
            name: c.component.name,
          }))
        : [],
    [libraryMember],
  );

  /* ---- Handlers for member article updates ---- */
  const handleSetParameter = (paramId: ParameterId, optionId: string) => {
    if (!currentActiveId || !activeMember) return;
    const currentVariant = activeMember.variant;
    const updatedVariant: Variant = {
      ...currentVariant,
      parameters: selectParameter(currentVariant.parameters, paramId, optionId),
    };
    setMemberVariants((prev) => ({ ...prev, [currentActiveId]: updatedVariant }));
    pulse();
  };

  const handleAddCustomParameter = (paramId: ParameterId, option: ParameterOption) => {
    if (!currentActiveId || !activeMember) return;
    const currentVariant = activeMember.variant;
    const updatedVariant: Variant = {
      ...currentVariant,
      parameters: addCustomOption(currentVariant.parameters, paramId, option),
    };
    setMemberVariants((prev) => ({ ...prev, [currentActiveId]: updatedVariant }));
    pulse();
  };

  const handleCommercialChange = (patch: Partial<CommercialInputs>) => {
    if (!currentActiveId || !activeMember) return;
    const currentVariant = activeMember.variant;
    const updatedVariant: Variant = {
      ...currentVariant,
      commercial: { ...currentVariant.commercial, ...patch },
    };
    setMemberVariants((prev) => ({ ...prev, [currentActiveId]: updatedVariant }));
    pulse();
  };

  const handleSelectOption = (
    memberId: string,
    kind: CostLine["kind"],
    componentId: string,
    itemId: string,
    optionId: string,
  ) => {
    const member = members.find((m) => m.item.id === memberId);
    if (!member) return;
    const bundle = resolveCostingModel(member.item.srfRef);
    const currentVariant = member.variant;
    let updatedVariant: Variant = { ...currentVariant };

    if (kind === "material") {
      const master = bundle.masters.materials[optionId];
      if (optionId === INHERIT_OPTION_ID) {
        updatedVariant = {
          ...currentVariant,
          components: currentVariant.components.map((c) =>
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
        };
      } else if (master) {
        updatedVariant = {
          ...currentVariant,
          components: currentVariant.components.map((c) =>
            c.id === componentId && c.material
              ? {
                  ...c,
                  material: {
                    ...c.material,
                    relationship: "master",
                    sameAsComponentId: undefined,
                    materialMasterId: optionId,
                    rate: sourced(master.rate, "Rate Master", master.rateMasterId),
                    rateUnit: master.rateUnit,
                  },
                }
              : c,
          ),
        };
      }
    } else if (kind === "accessory") {
      updatedVariant = {
        ...currentVariant,
        components: currentVariant.components.map((c) =>
          c.id === componentId
            ? {
                ...c,
                accessories: c.accessories.map((a) =>
                  a.id === itemId ? applyAccessoryOption(a, optionId) : a,
                ),
              }
            : c,
        ),
      };
    } else if (kind === "process") {
      updatedVariant = {
        ...currentVariant,
        components: currentVariant.components.map((c) =>
          c.id === componentId
            ? {
                ...c,
                processes: c.processes.map((p) =>
                  p.id === itemId ? applyProcessOption(p, optionId) : p,
                ),
              }
            : c,
        ),
      };
    } else if (kind === "packaging") {
      updatedVariant = {
        ...currentVariant,
        packaging: currentVariant.packaging.map((p) =>
          p.id === itemId ? applyPackagingOption(p, optionId) : p,
        ),
      };
    } else if (kind === "testing") {
      updatedVariant = {
        ...currentVariant,
        testing: currentVariant.testing.map((t) =>
          t.id === itemId ? applyTestingOption(t, optionId) : t,
        ),
      };
    }

    setMemberVariants((prev) => ({ ...prev, [memberId]: updatedVariant }));
    pulse();
  };

  const handleRemoveLine = (memberId: string, line: CostLine) => {
    if (!line.removable || !line.target) return;
    const member = members.find((m) => m.item.id === memberId);
    if (!member) return;
    const currentVariant = member.variant;
    const { componentId, itemId } = line.target;
    let updatedVariant: Variant = { ...currentVariant };

    if (line.kind === "material") {
      updatedVariant = removeComponentFrom(currentVariant, componentId);
      if (selectedComponentId === componentId) setSelectedComponentId(null);
    } else if (line.kind === "process" || line.kind === "accessory") {
      updatedVariant = {
        ...currentVariant,
        components: currentVariant.components.map((c) =>
          c.id === componentId
            ? line.kind === "process"
              ? { ...c, processes: c.processes.filter((p) => p.id !== itemId) }
              : { ...c, accessories: c.accessories.filter((a) => a.id !== itemId) }
            : c,
        ),
      };
    } else if (line.kind === "packaging") {
      updatedVariant = {
        ...currentVariant,
        packaging: currentVariant.packaging.filter((p) => p.id !== itemId),
      };
    } else if (line.kind === "testing") {
      updatedVariant = {
        ...currentVariant,
        testing: currentVariant.testing.filter((t) => t.id !== itemId),
      };
    }

    setMemberVariants((prev) => ({ ...prev, [memberId]: updatedVariant }));
    pulse();
  };

  const handleAddFromLibrary = (
    libraryItem: LibraryItem,
    targetComponentId: string | null,
    slot: string,
  ) => {
    if (!libraryMemberId) return;
    const member = members.find((m) => m.item.id === libraryMemberId);
    if (!member) return;
    const bundle = resolveCostingModel(member.item.srfRef);
    const currentVariant = member.variant;
    const stamp = Date.now();
    let updatedVariant: Variant = { ...currentVariant };

    if (libraryItem.kind === "fabric" || libraryItem.kind === "filling") {
      const preset = bundle.presets.find((p) => p.name === slot) ?? bundle.presets[0];
      const newComp = preset
        ? bundle.componentFromPreset(preset, `CMP-${stamp}`, currentVariant.components.length + 1)
        : componentFromLibrary(libraryItem, {
            id: `CMP-${stamp}`,
            productId: currentVariant.productId,
            sequence: currentVariant.components.length + 1,
            slot: slot || libraryItem.name,
            finishedWidth: 18,
            finishedLength: 18,
          });
      updatedVariant = addComponentTo(currentVariant, newComp);
    } else if (libraryItem.kind === "process") {
      if (targetComponentId) {
        const targetComp = currentVariant.components.find((c) => c.id === targetComponentId);
        const newProc = processFromLibrary(
          libraryItem,
          targetComponentId,
          (targetComp?.processes.length ?? 0) + 1,
          1,
        );
        if (newProc) {
          updatedVariant = {
            ...currentVariant,
            components: currentVariant.components.map((c) =>
              c.id === targetComponentId
                ? {
                    ...c,
                    processes: [...c.processes, newProc],
                  }
                : c,
            ),
          };
        }
      }
    } else if (libraryItem.kind === "trim") {
      if (targetComponentId) {
        const newAcc = accessoryFromLibrary(libraryItem, `ACC-${stamp}`, targetComponentId);
        updatedVariant = {
          ...currentVariant,
          components: currentVariant.components.map((c) =>
            c.id === targetComponentId
              ? {
                  ...c,
                  accessories: [...c.accessories, newAcc],
                }
              : c,
          ),
        };
      }
    } else if (libraryItem.kind === "packaging") {
      updatedVariant = {
        ...currentVariant,
        packaging: [
          ...currentVariant.packaging,
          packagingFromLibrary(libraryItem, `PKG-${stamp}`),
        ],
      };
    } else if (libraryItem.kind === "testing") {
      const lotSize = currentVariant.testing[0]?.lotSize ?? 3000;
      updatedVariant = {
        ...currentVariant,
        testing: [
          ...currentVariant.testing,
          testingFromLibrary(libraryItem, `TST-${stamp}`, lotSize),
        ],
      };
    }

    setMemberVariants((prev) => ({ ...prev, [libraryMemberId]: updatedVariant }));
    setLibraryOpen(false);
    pulse();
  };

  /* ---- Kit items store update handlers ---- */
  const persistKitItems = (nextItems: KitItem[]) => {
    if (pod) {
      updateArticle(pod.id, article.id, { kitItems: nextItems });
    }
  };

  const handleQtyChange = (itemId: string, delta: number) => {
    const nextItems = items.map((i) =>
      i.id === itemId ? { ...i, qty: Math.max(1, i.qty + delta) } : i,
    );
    persistKitItems(nextItems);
  };

  const handleToggleOptional = (itemId: string) => {
    const nextItems = items.map((i) =>
      i.id === itemId ? { ...i, optional: !i.optional } : i,
    );
    persistKitItems(nextItems);
  };

  const handleRemoveMember = (itemId: string) => {
    const nextItems = items.filter((i) => i.id !== itemId);
    persistKitItems(nextItems);
    if (currentActiveId === itemId) {
      setActiveMemberId(nextItems[0]?.id ?? "");
    }
  };

  const handleAddArticlesToKit = (addedArticles: LibraryArticle[]) => {
    const newItems: KitItem[] = addedArticles.map((a) => ({
      id: `KIT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      libraryId: a.id,
      srfRef: (a as any).srfRef ?? "PLACEMAT-COTTON",
      name: a.name,
      image: a.image,
      size: a.size,
      moq: a.moq,
      qty: 1,
      optional: false,
    }));
    const nextItems = [...items, ...newItems];
    persistKitItems(nextItems);
    setAddArticleOpen(false);
  };

  if (items.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center p-6 bg-canvas">
        <div className="flex flex-col items-center max-w-md rounded-xl border border-hairline bg-surface p-12 text-center shadow-sm">
          <Boxes className="h-10 w-10 text-brand-700 mb-3" />
          <h3 className="text-[16px] font-semibold text-ink-900">Empty Bundle / Set</h3>
          <p className="mt-2 text-[13px] text-ink-500 leading-relaxed">
            This set has no articles yet. Add articles from the article library to build and cost your set.
          </p>
          <button
            type="button"
            onClick={() => setAddArticleOpen(true)}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-[13px] font-medium text-white hover:bg-brand-800 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" /> Add Article to Set
          </button>
        </div>
        <ArticleLibraryDrawer
          open={addArticleOpen}
          onClose={() => setAddArticleOpen(false)}
          title="Add Article to Set"
          subtitle="Choose articles from the library to add to this bundle set."
          submitLabel="Add to Set"
          onSubmit={handleAddArticlesToKit}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-canvas">
      {/* ---- LEFT RAIL: Parameter & Commercial configuration for active member article ---- */}
      <div className="flex flex-col border-r border-hairline bg-surface shrink-0">
        <div className="border-b border-hairline bg-surface-alt/80 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-500 mb-1">
            Configuring Member Article:
          </div>
          <div className="flex flex-wrap gap-1">
            {members.map((m) => (
              <button
                key={m.item.id}
                type="button"
                onClick={() => setActiveMemberId(m.item.id)}
                className={cn(
                  "truncate max-w-[130px] rounded px-2 py-1 text-[11px] font-medium transition-colors",
                  m.item.id === currentActiveId
                    ? "bg-brand-700 text-white shadow-xs"
                    : "bg-surface text-ink-700 border border-hairline hover:bg-surface-alt",
                )}
                title={m.item.name}
              >
                {m.item.name}
              </button>
            ))}
          </div>
        </div>

        {activeMember && (
          <ConfigurationRail
            scenarioName="Set Member Build"
            productContext={`${activeMember.item.name} (${activeMember.item.size || "Std"})`}
            parameters={activeMember.pricedVariant.parameters}
            commercial={activeMember.pricedVariant.commercial}
            output={commercialOutput(
              activeMember.rollup.directCost,
              activeMember.pricedVariant.commercial,
            )}
            money={activeMember.money}
            onSelect={handleSetParameter}
            onAddCustom={handleAddCustomParameter}
            onCommercialChange={handleCommercialChange}
            onRecalculate={pulse}
            live={live}
          />
        )}
      </div>

      {/* ---- CENTER MAIN WORKSPACE ---- */}
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto p-4 bg-canvas gap-4">
        {/* ---- set summary card ---- */}
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
                  <h1 className="truncate text-[16px] font-semibold text-ink-900">{article.name}</h1>
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10.5px] font-medium text-brand-700">
                    <Layers className="h-3 w-3" /> Set · {items.length} articles
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-500">
                  <span>
                    MOQ: <span className="font-medium text-ink-900">{article.moq}</span>
                  </span>
                  <span>
                    Pieces / set: <span className="font-medium text-ink-900">{setTotals.pieces}</span>
                  </span>
                  {article.collection && article.collection !== "—" && (
                    <span>
                      Collection:{" "}
                      <span className="font-medium text-ink-900">{article.collection}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setAddArticleOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 py-1.5 text-[12px] font-medium text-ink-700 hover:bg-surface-alt transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 shadow-2xs"
              >
                <Plus className="h-3.5 w-3.5" /> Add article to set
              </button>

              <div className="text-right border-l border-hairline pl-4">
                <div className="text-[10px] font-medium uppercase tracking-[0.1em] text-ink-500">
                  Set direct cost
                </div>
                <div className="text-[22px] font-semibold tabular-nums text-ink-900">
                  {usd(setTotals.direct)}
                </div>
                <div className="text-[10.5px] text-ink-400">/ set</div>
              </div>
            </div>
          </div>

          {stepper && <div className="-mx-4 mt-3 border-t border-hairline">{stepper}</div>}
        </div>

        {/* ---- combined matrix table ---- */}
        <div className="shrink-0 overflow-hidden rounded-xl border border-hairline bg-surface shadow-xs">
          <div className="border-b border-hairline px-4 py-3 flex items-center justify-between">
            <div>
              <h2 className="text-[13px] font-semibold text-ink-900">Combined Set Costing Matrix</h2>
              <p className="text-[11.5px] text-ink-500">
                Click any column header to select and configure that article's parameters in the left rail.
              </p>
            </div>
            <span className="text-[11px] text-brand-700 font-medium bg-brand-50 px-2.5 py-1 rounded-full border border-brand-100">
              Interactive & Dynamic
            </span>
          </div>

          <div className="max-h-[52vh] overflow-auto">
            <table className="w-full min-w-[720px] border-collapse text-[12.5px]">
              <thead className="sticky top-0 z-10 bg-surface-alt">
                <tr className="border-b border-hairline">
                  <th className="sticky left-0 z-20 w-[180px] bg-surface-alt px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-400">
                    Line
                  </th>
                  {members.map((m) => {
                    const isActive = m.item.id === currentActiveId;
                    return (
                      <th
                        key={m.item.id}
                        onClick={() => setActiveMemberId(m.item.id)}
                        className={cn(
                          "min-w-[150px] px-3 py-2.5 text-right text-[11.5px] font-semibold transition-colors cursor-pointer border-l border-hairline/60",
                          isActive
                            ? "bg-brand-50/80 text-brand-900 shadow-inner"
                            : "text-ink-900 hover:bg-surface-alt/90",
                        )}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="truncate">{m.item.name}</span>
                          {m.item.optional && (
                            <span className="shrink-0 rounded bg-ink-100 px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wide text-ink-600">
                              Optional
                            </span>
                          )}
                        </div>
                        <div className="text-[10.5px] font-normal text-ink-400 mt-0.5">
                          ×{m.item.qty} · {m.item.size || "—"}
                        </div>
                      </th>
                    );
                  })}
                  <th className="min-w-[140px] bg-brand-50 px-3 py-2.5 text-right text-[11.5px] font-semibold text-brand-800 border-l border-hairline">
                    Set total
                    <div className="text-[10.5px] font-normal text-brand-700">
                      {setTotals.pieces} pcs / set
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <GroupHeader label="Product Specs & Composition" span={members.length + 2} />
                <Row
                  label="MOQ"
                  cells={members.map((m) => m.item.moq || "—")}
                  total={article.moq}
                  muted
                />
                <Row
                  label="Qty per set"
                  cells={members.map((m) => String(m.item.qty))}
                  total={String(setTotals.pieces)}
                  muted
                />
                <Row
                  label="Cost lines"
                  cells={members.map((m) => String(m.rollup.components.length))}
                  total="—"
                  muted
                />

                <GroupHeader label="Cost breakdown (per piece)" span={members.length + 2} />
                {CATEGORY_ROWS.map((c) => (
                  <Row
                    key={c.key}
                    label={c.label}
                    cells={members.map((m) => usd(m.rollup[c.key] / m.fxRate))}
                    total={usd(setTotals[c.key])}
                  />
                ))}
                <Row
                  label="Direct cost"
                  cells={members.map((m) => usd(m.directUsd))}
                  total={usd(setTotals.direct)}
                  strong
                />

                <GroupHeader label="Commercial" span={members.length + 2} />
                <Row
                  label="Selling price"
                  cells={members.map((m) => usd(m.sellingUsd))}
                  total={usd(setTotals.selling)}
                  strong
                />
                <Row
                  label="Extended (× qty)"
                  cells={members.map((m) => usd(m.sellingUsd * m.item.qty))}
                  total={usd(setTotals.selling)}
                />
                <Row
                  label="Margin"
                  cells={members.map((m) => `${m.marginPct.toFixed(1)}%`)}
                  total={`${setTotals.marginPct.toFixed(1)}%`}
                />
              </tbody>
            </table>
          </div>
        </div>

        {/* ---- per-article detailed configuration sheets ---- */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-[14px] font-semibold text-ink-900">
                Configurable Article Costing Sheets
              </h2>
              <p className="text-[11.5px] text-ink-500">
                Configure options, add materials or processes, and inspect components directly within each article's sheet.
              </p>
            </div>
          </div>

          {members.map((m) => {
            const open = openAccordionId === m.item.id;
            const isActive = m.item.id === currentActiveId;

            return (
              <div
                key={m.item.id}
                className={cn(
                  "overflow-hidden rounded-xl border transition-all bg-surface shadow-2xs",
                  isActive ? "border-brand-300 ring-1 ring-brand-300/40" : "border-hairline",
                )}
              >
                {/* Header accordion bar */}
                <div
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors",
                    isActive ? "bg-brand-50/40" : "hover:bg-surface-alt/60",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setOpenAccordionId(open ? null : m.item.id);
                      setActiveMemberId(m.item.id);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
                  >
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-ink-400 transition-transform",
                        open && "rotate-180",
                      )}
                    />
                    {m.item.image && (
                      <img src={m.item.image} alt="" className="h-8 w-8 rounded object-cover border border-hairline" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13.5px] font-semibold text-ink-900">
                          {m.item.name}
                        </span>
                        {m.item.optional ? (
                          <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[9.5px] font-medium uppercase text-ink-600">
                            Optional
                          </span>
                        ) : (
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9.5px] font-medium uppercase text-emerald-700">
                            Required
                          </span>
                        )}
                        {isActive && (
                          <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase text-brand-800">
                            Active in Rail
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-ink-500 mt-0.5">
                        {m.item.size || "—"} · MOQ {m.item.moq || "—"} · {m.rollup.components.length} cost lines
                      </div>
                    </div>
                  </button>

                  {/* Kit controls: Quantity, Optional toggle, Remove */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1 bg-surface-alt rounded-lg border border-hairline p-0.5">
                      <span className="px-2 text-[11px] text-ink-500 font-medium">Qty:</span>
                      <button
                        type="button"
                        onClick={() => handleQtyChange(m.item.id, -1)}
                        className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-surface text-ink-600"
                        title="Decrease set quantity"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center text-[12px] font-semibold text-ink-900">
                        {m.item.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleQtyChange(m.item.id, 1)}
                        className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-surface text-ink-600"
                        title="Increase set quantity"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleOptional(m.item.id)}
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-[11px] font-medium border transition-colors",
                        m.item.optional
                          ? "border-hairline bg-surface text-ink-600 hover:bg-surface-alt"
                          : "border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100",
                      )}
                    >
                      {m.item.optional ? "Make Required" : "Make Optional"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRemoveMember(m.item.id)}
                      className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="Remove article from set"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>

                    <div className="pl-3 border-l border-hairline text-right">
                      <div className="text-[13px] font-semibold tabular-nums text-ink-900">
                        {usd(m.directUsd)}
                      </div>
                      <div className="text-[10px] text-ink-400">direct / pc</div>
                    </div>
                  </div>
                </div>

                {/* Expanded Cost Line Table */}
                {open && (
                  <div className="border-t border-hairline p-3 bg-surface">
                    <CostLineTable
                      sections={m.sections}
                      money={m.money}
                      selectedId={inspectorMemberId === m.item.id ? selectedComponentId : null}
                      onSelect={(componentId) => {
                        setSelectedComponentId(componentId);
                        setInspectorMemberId(m.item.id);
                        setActiveMemberId(m.item.id);
                      }}
                      onAdd={(section) => {
                        setLibraryMemberId(m.item.id);
                        setLibrarySection(section ?? null);
                        setLibraryOpen(true);
                      }}
                      onRemove={(line) => handleRemoveLine(m.item.id, line)}
                      onSelectOption={(kind, componentId, itemId, optionId) =>
                        handleSelectOption(m.item.id, kind, componentId, itemId, optionId)
                      }
                      title={`${m.item.name} — Costing Sheet`}
                      caption="Configure components, materials, processes, and options for this article."
                      totalLabel="Total Direct Cost"
                      total={m.rollup.directCost}
                      live={live}
                      readOnly={false}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-2 shrink-0 text-[11px] text-ink-400 leading-relaxed">
          * Set figures update dynamically as member articles are configured. Each article maintains its own bill of materials and pricing rules.
        </p>
      </main>

      {/* ---- RIGHT INSPECTOR: Shown when a component line is clicked ---- */}
      {selectedResolvedComponent && (
        <ComponentInspector
          resolved={selectedResolvedComponent}
          productName={inspectorMember?.item.name ?? "Article"}
          scenarioName="Set Member Build"
          money={inspectorMember?.money ?? createMoney("USD", 1)}
          onClose={() => setSelectedComponentId(null)}
        />
      )}

      {/* ---- Component Library Modal ---- */}
      <ComponentLibraryModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        section={librarySection}
        targets={libraryTargets}
        onAdd={handleAddFromLibrary}
      />

      {/* ---- Add Article to Set Drawer ---- */}
      <ArticleLibraryDrawer
        open={addArticleOpen}
        onClose={() => setAddArticleOpen(false)}
        title="Add Article to Set"
        subtitle="Choose articles from the master library to add to this set."
        submitLabel="Add to Set"
        onSubmit={handleAddArticlesToKit}
      />
    </div>
  );
}

function GroupHeader({ label, span }: { label: string; span: number }) {
  return (
    <tr className="border-b border-hairline bg-surface-alt/60">
      <td
        colSpan={span}
        className="sticky left-0 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-500"
      >
        {label}
      </td>
    </tr>
  );
}

function Row({
  label,
  cells,
  total,
  strong,
  muted,
}: {
  label: string;
  cells: string[];
  total: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <tr className="border-b border-hairline last:border-0 hover:bg-surface-alt/30 transition-colors">
      <th
        scope="row"
        className="sticky left-0 z-10 bg-surface px-4 py-2 text-left text-[12px] font-normal text-ink-500"
      >
        {label}
      </th>
      {cells.map((c, i) => (
        <td
          key={i}
          className={cn(
            "px-3 py-2 text-right tabular-nums border-l border-hairline/40",
            muted ? "text-ink-500" : "text-ink-900",
            strong && "font-semibold",
          )}
        >
          {c}
        </td>
      ))}
      <td
        className={cn(
          "bg-brand-50/60 px-3 py-2 text-right tabular-nums text-brand-800 border-l border-hairline",
          strong ? "font-semibold" : "font-medium",
        )}
      >
        {total}
      </td>
    </tr>
  );
}
