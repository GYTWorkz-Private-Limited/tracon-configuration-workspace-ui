// VariantTabs — browser-style strip for pricing variants and the options that
// belong to the currently selected one. A variant is a different way of
// making the article; an option is an alternative value for one parameter
// within a variant, so options render nested under their parent.

import { useState } from "react";
import { CornerDownRight, Copy, Layers, PackagePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type WorkVariant = {
  id: string;
  name: string;
  kind: "variant" | "option";
  parentId?: string;
};

/** Parents first, each immediately followed by its own options. */
function nest(variants: WorkVariant[]): { variant: WorkVariant; nested: boolean }[] {
  const parents = variants.filter((v) => v.kind !== "option");
  const parentIds = new Set(parents.map((p) => p.id));
  const ordered = parents.flatMap((p) => [
    { variant: p, nested: false },
    ...variants
      .filter((v) => v.kind === "option" && v.parentId === p.id)
      .map((v) => ({ variant: v, nested: true })),
  ]);
  const orphans = variants
    .filter((v) => v.kind === "option" && (!v.parentId || !parentIds.has(v.parentId)))
    .map((v) => ({ variant: v, nested: false }));
  return [...ordered, ...orphans];
}

export function VariantTabs({
  variants,
  activeId,
  price,
  onSelect,
  onAdd,
  onDuplicate,
  onRename,
  onClose,
}: {
  variants: WorkVariant[];
  activeId: string;
  /** live grand total per variant, preformatted */
  price: (id: string) => string;
  onSelect: (id: string) => void;
  onAdd: (kind: "variant" | "option") => void;
  onDuplicate: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onClose: (id: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="shrink-0 border-b border-hairline bg-surface-alt px-4 lg:px-6">
      <div className="flex items-end gap-1 overflow-x-auto pt-2">
        {nest(variants).map(({ variant: v, nested }) => {
          const isActive = v.id === activeId;
          const parent = v.parentId ? variants.find((p) => p.id === v.parentId) : undefined;
          return (
            <div
              key={v.id}
              onClick={() => onSelect(v.id)}
              onDoubleClick={() => setEditing(v.id)}
              title={
                parent
                  ? `Option of ${parent.name} — an alternative value for one parameter · double-click to rename`
                  : "Variant — a different way of making it · double-click to rename"
              }
              className={cn(
                "group flex shrink-0 cursor-pointer items-center gap-2 rounded-t-lg border border-b-0 py-2 pr-3 text-[12.5px] transition-colors",
                nested ? "ml-1 pl-1.5" : "pl-3",
                isActive
                  ? "border-hairline bg-surface text-ink-900"
                  : "border-transparent bg-transparent text-ink-500 hover:bg-surface/70",
              )}
            >
              {nested && (
                <CornerDownRight
                  className="h-3 w-3 shrink-0 text-cfg-strong/60"
                  aria-hidden="true"
                />
              )}
              {editing === v.id ? (
                <input
                  autoFocus
                  defaultValue={v.name}
                  onBlur={(e) => {
                    const name = e.target.value.trim();
                    if (name) onRename(v.id, name);
                    setEditing(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setEditing(null);
                  }}
                  className="w-28 rounded border border-brand-700 bg-surface px-1 py-0.5 text-[12.5px] outline-none"
                />
              ) : (
                <span className={cn("whitespace-nowrap", isActive && "font-medium")}>{v.name}</span>
              )}

              <span className="whitespace-nowrap text-[12px] font-semibold tabular-nums text-brand-700">
                {price(v.id)}
              </span>

              <span
                className={cn(
                  "rounded px-1 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.08em]",
                  v.kind === "option" ? "bg-cfg-soft text-cfg-strong" : "bg-ink-100 text-ink-600",
                )}
              >
                {v.kind}
              </span>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate(v.id);
                }}
                aria-label={`Duplicate ${v.name}`}
                title="Duplicate"
                className="rounded p-0.5 text-ink-400 opacity-0 hover:bg-surface-alt hover:text-ink-800 group-hover:opacity-100"
              >
                <Copy className="h-3 w-3" />
              </button>

              {variants.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose(v.id);
                  }}
                  aria-label={`Close ${v.name}`}
                  className="rounded p-0.5 text-ink-400 hover:bg-surface-alt hover:text-ink-800"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}

        {/* Add — two direct actions. The currently selected variant is always
            the implicit context for "+ Add Option", so there is nothing to
            pick before either action opens. */}
        <div className="flex shrink-0 items-center gap-1.5 pb-1 pl-1">
          <button
            onClick={() => onAdd("variant")}
            className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink-700 hover:bg-surface-alt"
          >
            <Layers className="h-3.5 w-3.5 text-brand-700" /> Add Variant
          </button>
          <button
            onClick={() => onAdd("option")}
            className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink-700 hover:bg-surface-alt"
          >
            <PackagePlus className="h-3.5 w-3.5 text-brand-700" /> Add Option
          </button>
        </div>
      </div>
    </div>
  );
}
