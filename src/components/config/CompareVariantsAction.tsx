/**
 * "Compare variants" — the button and everything behind it.
 *
 * The comparison is a decision surface, not a report: the whole reason to line
 * four costings up side by side is to pick one. So the workspace it opens can
 * apply the column being read, or start a new variant from it, and both land
 * back here rather than leaving the user to re-find the screen they came from.
 *
 * Kept as one component because the button, the full-screen comparison and the
 * new-variant drawer share a single piece of state — which variant is being
 * looked at — and splitting them would mean threading it through the header.
 */

import { useState } from "react";
import { Columns3 } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_VARIANTS, type CushionVariant } from "@/lib/cushionCosting";
import { CompareVariantsWorkspace } from "./CompareVariantsWorkspace";
import { NewVariantDrawer } from "./NewVariantDrawer";

export function CompareVariantsAction({ productName }: { productName: string }) {
  const [open, setOpen] = useState(false);
  const [variants, setVariants] = useState<CushionVariant[]>(DEFAULT_VARIANTS);
  const [activeId, setActiveId] = useState<string>(DEFAULT_VARIANTS[0].id);
  /** The column a new variant is being duplicated from. */
  const [duplicating, setDuplicating] = useState<CushionVariant | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 py-2 text-[13px] font-medium text-ink-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
      >
        <Columns3 className="h-4 w-4" /> Compare variants
      </button>

      {open && (
        <CompareVariantsWorkspace
          variants={variants}
          activeId={activeId}
          productName={productName}
          onClose={() => setOpen(false)}
          onApplyVariant={(id) => {
            setActiveId(id);
            setOpen(false);
            toast.success(`${variants.find((v) => v.id === id)?.name ?? "Variant"} is now active`);
          }}
          onDuplicateVariant={setDuplicating}
        />
      )}

      {/* The drawer opens OVER the comparison, which stays behind it — the
          new column has to appear in the table the moment it is saved, and
          that only reads if the table never went away. */}
      {duplicating && (
        <NewVariantDrawer
          open
          active={duplicating}
          onClose={() => setDuplicating(null)}
          onCreate={(v) => {
            setVariants((prev) => [...prev, v]);
            setDuplicating(null);
            toast.success(`${v.name} added to the comparison`);
          }}
        />
      )}
    </>
  );
}
