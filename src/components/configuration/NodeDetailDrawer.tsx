// NodeDetailDrawer — the contextual configuration surface opened by clicking a
// network node. Lists every field that belongs to the node's group as a
// compact row; clicking a row opens the existing single-field ConfigDrawer
// alongside it. Closing this drawer returns the full network canvas to view —
// nothing here permanently occupies screen space.

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { inr, type CardDef, type ConfigState } from "@/lib/fabricConfig";
import { componentsCost, fabricComponents, type FabricComponent } from "@/lib/configTree";
import { FabricComponents } from "./FabricComponents";

type Props = {
  title: string;
  breadcrumb: string;
  cards: CardDef[];
  state: ConfigState;
  amount: number;
  showComponents?: boolean;
  fabricExtras?: FabricComponent[];
  onPatchComponent?: (id: string, patch: Partial<FabricComponent>) => void;
  onAddComponent?: (name: string) => void;
  onRemoveComponent?: (id: string) => void;
  activeCardId: string | null;
  onOpenCard: (id: string) => void;
  onClose: () => void;
};

export function NodeDetailDrawer({
  title,
  breadcrumb,
  cards,
  state,
  amount,
  showComponents,
  fabricExtras,
  onPatchComponent,
  onAddComponent,
  onRemoveComponent,
  activeCardId,
  onOpenCard,
  onClose,
}: Props) {
  const components =
    showComponents && fabricExtras ? fabricComponents(state, fabricExtras) : undefined;

  return (
    <aside className="flex h-full w-[420px] max-w-[92vw] shrink-0 flex-col border-l border-hairline bg-surface shadow-2xl">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-hairline px-5 py-4">
        <div>
          <div className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-500">
            {breadcrumb}
          </div>
          <h2 className="text-[16px] font-semibold text-ink-900">{title}</h2>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-1 text-ink-400 hover:bg-surface-alt hover:text-ink-900"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {components && onPatchComponent && onAddComponent && onRemoveComponent && (
          <div className="border-b border-hairline">
            <FabricComponents
              components={components}
              onChange={onPatchComponent}
              onAdd={onAddComponent}
              onRemove={onRemoveComponent}
            />
          </div>
        )}

        <div className="divide-y divide-hairline">
          {cards
            .filter((c) => c.kind !== "readonly")
            .map((card) => {
              const value = state[card.id];
              const configured = Boolean(value);
              const display = value ? `${value.value}${card.suffix ?? ""}` : "Not configured";
              const rate = value?.rate ? inr(value.rate) : null;
              return (
                <button
                  key={card.id}
                  onClick={() => onOpenCard(card.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-surface-alt",
                    activeCardId === card.id && "bg-brand-50",
                  )}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-500">
                      {card.label}
                      {card.mandatory && !configured && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />
                      )}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 block truncate text-[13px]",
                        configured ? "font-medium text-ink-900" : "text-ink-400",
                      )}
                    >
                      {display}
                    </span>
                  </span>
                  {rate && (
                    <span className="shrink-0 text-[11.5px] tabular-nums text-ink-500">
                      {rate}
                      {card.unit === "perM" ? " / m" : card.unit === "perPc" ? " / pc" : ""}
                    </span>
                  )}
                </button>
              );
            })}
          {cards.filter((c) => c.kind !== "readonly").length === 0 && (
            <p className="px-5 py-6 text-[12.5px] text-ink-500">
              Nothing to configure in this group yet.
            </p>
          )}
        </div>
      </div>

      <footer className="flex shrink-0 items-center justify-between border-t border-hairline bg-surface-alt px-5 py-3">
        <span className="text-[11px] uppercase tracking-[0.1em] text-ink-500">
          {showComponents ? "Component subtotal" : "Group subtotal"}
        </span>
        <span className="text-[15px] font-semibold tabular-nums text-ink-900">
          {inr(showComponents && components ? componentsCost(components) : amount)}
        </span>
      </footer>
    </aside>
  );
}
