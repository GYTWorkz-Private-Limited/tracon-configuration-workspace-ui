// StylePickerCard — the "how does this build start?" decision, made explicit.
//
// A component table that simply appears pre-filled hides WHERE its rows came
// from, so the workspace asks first: pull the parts from a style master, or
// build manually from the Component Library. Either answer is recorded per
// article ("manual" is a real choice, not the absence of one), which is why
// the card collapses to a slim provenance strip instead of disappearing —
// the origin of the parts stays readable for the life of the costing.

import { useState } from "react";
import { Layers, PencilRuler, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MANUAL_STYLE_ID,
  STYLE_MASTER,
  setStyleFor,
  clearStyleFor,
  styleById,
  useStyleFor,
} from "@/lib/styleMaster";

export function StylePickerCard({
  podId,
  articleId,
  onApply,
}: {
  podId: string;
  articleId: string;
  onApply: (styleId: string) => void;
}) {
  const chosen = useStyleFor(podId, articleId);
  const [browsing, setBrowsing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /* ---- choice made: slim provenance strip ---- */
  if (chosen) {
    const style = styleById(chosen);
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-hairline bg-surface px-3 py-2">
        <Layers className="h-3.5 w-3.5 shrink-0 text-brand-700" aria-hidden />
        {style ? (
          <p className="min-w-0 flex-1 truncate text-[12.5px] text-ink-500">
            <span className="font-semibold text-ink-900">{style.name}</span>
            <span className="mx-1.5 text-ink-300" aria-hidden>
              ·
            </span>
            {style.parts.length} parts seeded
          </p>
        ) : (
          <p className="min-w-0 flex-1 truncate text-[12.5px] text-ink-500">
            <span className="font-semibold text-ink-900">Manual build</span>
            <span className="mx-1.5 text-ink-300" aria-hidden>
              ·
            </span>
            parts added from the library
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            // Re-opening the decision only clears the CHOICE — seeded
            // components stay; the workspace owns removing or reseeding them.
            clearStyleFor(podId, articleId);
            setBrowsing(false);
            setSelectedId(null);
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium text-ink-600 transition-colors hover:bg-surface-alt hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
        >
          <RotateCcw className="h-3 w-3" aria-hidden /> Change
        </button>
      </div>
    );
  }

  /* ---- no choice yet: the two paths, given equal weight ---- */
  return (
    <div className="rounded-lg border border-hairline bg-surface">
      <div className="border-b border-hairline px-3 py-2">
        <h3 className="text-[12.5px] font-semibold text-ink-900">Start from a style</h3>
        <p className="text-[11.5px] text-ink-500">
          Seed this article&rsquo;s parts from the style master, or define them yourself.
        </p>
      </div>

      {/* Side-by-side because neither path is the "default" — a costing team
          that always builds manually should not feel routed around. */}
      <div className="grid grid-cols-1 gap-px bg-hairline sm:grid-cols-2">
        <div className="bg-surface p-3">
          <div className="flex items-start gap-2">
            <Layers className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden />
            <div className="min-w-0">
              <p className="text-[12.5px] font-semibold text-ink-900">Pull from style master</p>
              <p className="text-[11.5px] text-ink-500">
                Parts, dimensions and cut-size consumption arrive pre-filled; you assign fabric and
                trim per part.
              </p>
            </div>
          </div>
          {!browsing && (
            <button
              type="button"
              onClick={() => setBrowsing(true)}
              className="mt-2.5 rounded-md border border-hairline px-2.5 py-1.5 text-[12px] font-medium text-brand-700 transition-colors hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
            >
              Browse styles
            </button>
          )}
        </div>

        <div className="bg-surface p-3">
          <div className="flex items-start gap-2">
            <PencilRuler className="mt-0.5 h-4 w-4 shrink-0 text-ink-500" aria-hidden />
            <div className="min-w-0">
              <p className="text-[12.5px] font-semibold text-ink-900">Define manually</p>
              <p className="text-[11.5px] text-ink-500">
                Add parts one at a time from the Component Library — &ldquo;Add another body
                part&rdquo; keeps offering the next one.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStyleFor(podId, articleId, MANUAL_STYLE_ID)}
            className="mt-2.5 rounded-md border border-hairline px-2.5 py-1.5 text-[12px] font-medium text-ink-600 transition-colors hover:bg-surface-alt hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            Dismiss — build manually
          </button>
        </div>
      </div>

      {browsing && (
        <div className="border-t border-hairline">
          <ul className="divide-y divide-hairline">
            {STYLE_MASTER.map((style) => {
              const selected = style.id === selectedId;
              return (
                <li key={style.id}>
                  {/* The whole row selects; Apply is a separate deliberate step
                      because it writes real components into the build. */}
                  <button
                    type="button"
                    onClick={() => setSelectedId(selected ? null : style.id)}
                    aria-pressed={selected}
                    className={cn(
                      "w-full px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-700",
                      selected ? "bg-brand-700/5" : "hover:bg-surface-alt",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className={cn(
                          "h-3 w-3 shrink-0 rounded-full border",
                          selected ? "border-brand-700 bg-brand-700" : "border-ink-300",
                        )}
                      />
                      <span className="truncate text-[12.5px] font-semibold text-ink-900">
                        {style.name}
                      </span>
                      <span className="shrink-0 text-[11px] text-ink-500">{style.category}</span>
                      <span className="ml-auto shrink-0 text-[11px] tabular-nums text-ink-500">
                        {style.parts.length} parts
                      </span>
                    </span>
                    <span className="mt-1.5 flex flex-wrap gap-1 pl-5">
                      {style.parts.map((part) => (
                        <span
                          key={part.name}
                          className="rounded-full border border-hairline bg-surface-alt/60 px-2 py-0.5 text-[10.5px] text-ink-600"
                        >
                          {part.name}
                        </span>
                      ))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-end gap-2 border-t border-hairline px-3 py-2">
            <button
              type="button"
              onClick={() => {
                setBrowsing(false);
                setSelectedId(null);
              }}
              className="rounded-md px-2.5 py-1.5 text-[12px] font-medium text-ink-500 transition-colors hover:bg-surface-alt hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedId}
              onClick={() => {
                if (!selectedId) return;
                // Record first, then let the workspace seed components — the
                // strip above renders from the store, not from the callback.
                setStyleFor(podId, articleId, selectedId);
                onApply(selectedId);
              }}
              className="rounded-md bg-brand-700 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
            >
              Apply style
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
