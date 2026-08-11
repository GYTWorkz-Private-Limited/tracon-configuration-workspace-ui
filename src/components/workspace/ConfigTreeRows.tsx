// ConfigTreeRows — the expanded configuration of a component, as table rows.
//
// Not cards. Expanding a component reveals its groups (Material, Consumption,
// Processes, Accessories, Cost); expanding a group reveals its variables; and a
// variable that is genuinely configurable carries its option list inline.
//
// Every row is one node of `configTree`, which is derived from the same
// resolved component the parent row is costed from — so nothing here can drift
// from the number in the Cost / pc column.

import { useState } from "react";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConfigField, ConfigNode } from "@/lib/componentConfigTree";

type Props = {
  nodes: ConfigNode[];
  colSpan: number;
  money: (amountInr: number, decimals?: number) => string;
  /** fired when a configurable variable's option is picked */
  onSelectOption?: (componentId: string, field: ConfigField, optionId: string) => void;
};

export function ConfigTreeRows({ nodes, colSpan, money, onSelectOption }: Props) {
  return (
    <tr className="border-b border-hairline bg-surface-alt/40">
      <td colSpan={colSpan} className="px-0 py-0">
        <div className="border-l-2 border-brand-500/40 bg-surface-alt/30 py-1 pl-6">
          <ul className="space-y-px">
            {nodes.map((n) => (
              <TreeRow key={n.id} node={n} money={money} onSelectOption={onSelectOption} />
            ))}
          </ul>
        </div>
      </td>
    </tr>
  );
}

function TreeRow({
  node,
  money,
  onSelectOption,
  defaultOpen,
}: {
  node: ConfigNode;
  money: (amountInr: number, decimals?: number) => string;
  onSelectOption?: (componentId: string, field: ConfigField, optionId: string) => void;
  defaultOpen?: boolean;
}) {
  // Groups open by default: expanding a component should immediately show the
  // selected configuration, not a second row of closed folders.
  const [open, setOpen] = useState(Boolean(defaultOpen ?? node.level <= 1));
  const [picking, setPicking] = useState(false);
  const hasChildren = node.children.length > 0;
  const configurable = Boolean(node.field && node.options?.length && onSelectOption);

  const indent = { paddingLeft: `${(node.level - 1) * 14}px` };

  return (
    <li>
      <div
        className={cn(
          "group flex items-center gap-2 rounded pr-4 text-[11.5px] transition-colors",
          hasChildren ? "py-[3px]" : "py-[2px]",
          "hover:bg-surface",
        )}
        style={indent}
      >
        {/* twisty — only where there is something under it */}
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            aria-expanded={open}
            aria-label={`${open ? "Collapse" : "Expand"} ${node.label}`}
            className="shrink-0 rounded p-0.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-4 shrink-0 text-center text-ink-300" aria-hidden>
            ·
          </span>
        )}

        <span
          className={cn(
            "shrink-0",
            node.type === "group"
              ? "font-semibold text-ink-800"
              : node.type === "process" || node.type === "accessory"
                ? "font-medium text-ink-700"
                : "text-ink-500",
          )}
        >
          {node.label}
        </span>

        <span className="min-w-0 flex-1 truncate text-right" title={node.value}>
          {configurable ? (
            <span className="relative inline-block">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPicking((v) => !v);
                }}
                aria-expanded={picking}
                aria-label={`Change ${node.label}`}
                className="inline-flex items-center gap-1 rounded border border-brand-500/50 bg-brand-50 px-1.5 py-0.5 font-medium text-brand-800 transition-colors hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
              >
                {node.value}
                <ChevronDown className="h-2.5 w-2.5" aria-hidden />
              </button>
              {picking && (
                <>
                  <span
                    className="fixed inset-0 z-30"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPicking(false);
                    }}
                  />
                  <span className="absolute right-0 top-full z-40 mt-1 block max-h-[240px] w-[200px] overflow-y-auto rounded-lg border border-hairline bg-surface p-1 text-left shadow-2xl">
                    {node.options?.map((o) => {
                      const active = o.id === node.selectedOptionId;
                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPicking(false);
                            if (node.field) onSelectOption?.(node.componentId, node.field, o.id);
                          }}
                          className={cn(
                            "flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-[11.5px] transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
                            active
                              ? "bg-brand-50 font-medium text-brand-800"
                              : "text-ink-700 hover:bg-surface-alt",
                          )}
                        >
                          <Check
                            className={cn("h-2.5 w-2.5 shrink-0", !active && "opacity-0")}
                            aria-hidden
                          />
                          {o.label}
                        </button>
                      );
                    })}
                  </span>
                </>
              )}
            </span>
          ) : (
            <span className="text-ink-800">{node.value}</span>
          )}
        </span>

        {node.cost !== undefined && (
          <span className="w-[72px] shrink-0 text-right font-medium tabular-nums text-ink-900">
            {money(node.cost)}
          </span>
        )}
        {node.cost === undefined && <span className="w-[72px] shrink-0" aria-hidden />}
      </div>

      {open && hasChildren && (
        <ul className="space-y-px">
          {node.children.map((child) => (
            <TreeRow
              key={child.id}
              node={child}
              money={money}
              onSelectOption={onSelectOption}
              // Only the first level under a component opens automatically;
              // deeper detail stays folded so the row stays scannable.
              defaultOpen={child.level <= 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
