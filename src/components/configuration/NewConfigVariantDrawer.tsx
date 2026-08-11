// NewConfigVariantDrawer — the "add variant / option" flow from the earlier
// versions, rebuilt on the configuration workspace's own state model.
// A variant starts either as a copy of an existing tab or from the base seed.

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkVariant } from "./VariantTabs";

export type NewVariantSpec = {
  name: string;
  kind: "variant" | "option";
  parentId?: string;
  /** variant id to copy configuration from, or "blank" for the base seed */
  copyFrom: string;
};

type Props = {
  open: boolean;
  kind: "variant" | "option";
  variants: WorkVariant[];
  activeId: string;
  onClose: () => void;
  onCreate: (spec: NewVariantSpec) => void;
};

export function NewConfigVariantDrawer({
  open,
  kind,
  variants,
  activeId,
  onClose,
  onCreate,
}: Props) {
  const suggested =
    kind === "option"
      ? `Option ${variants.filter((v) => v.kind === "option").length + 1}`
      : `Variant ${variants.filter((v) => v.kind === "variant").length + 1}`;

  const [name, setName] = useState(suggested);
  const [parentId, setParentId] = useState(activeId);
  const [copyFrom, setCopyFrom] = useState(activeId);

  useEffect(() => {
    if (open) {
      setName(suggested);
      setParentId(activeId);
      setCopyFrom(activeId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind, activeId]);

  if (!open) return null;

  const parents = variants.filter((v) => v.kind === "variant");

  const submit = () => {
    const trimmed = name.trim() || suggested;
    onCreate({
      name: trimmed,
      kind,
      parentId: kind === "option" ? parentId : undefined,
      copyFrom,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink-900/25">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative flex h-full w-[400px] flex-col bg-surface shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-hairline px-5 py-4">
          <div>
            <div className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-500">
              Pricing variants
            </div>
            <h2 className="text-[16px] font-semibold text-ink-900">
              New {kind === "option" ? "option" : "variant"}
            </h2>
            <p className="mt-0.5 text-[12px] leading-relaxed text-ink-500">
              {kind === "option"
                ? "An option sits under a variant — same article, different commercial choice."
                : "A variant is a full configuration of this article with its own direct cost."}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-ink-400 hover:bg-surface-alt hover:text-ink-900"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <label className="block">
            <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink-500">
              Name
            </span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="mt-1 w-full rounded-md border border-hairline px-2.5 py-1.5 text-[13px] text-ink-900 outline-none focus:border-brand-700"
            />
          </label>

          {kind === "option" && parents.length > 0 && (
            <div>
              <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink-500">
                Belongs to
              </span>
              <div className="mt-1.5 space-y-1.5">
                {parents.map((p) => (
                  <Choice
                    key={p.id}
                    active={p.id === parentId}
                    title={p.name}
                    meta="Parent variant"
                    onClick={() => setParentId(p.id)}
                  />
                ))}
              </div>
            </div>
          )}

          <div>
            <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink-500">
              Start from
            </span>
            <div className="mt-1.5 space-y-1.5">
              {variants.map((v) => (
                <Choice
                  key={v.id}
                  active={v.id === copyFrom}
                  title={`Copy of ${v.name}`}
                  meta="Carries every configured field across"
                  onClick={() => setCopyFrom(v.id)}
                />
              ))}
              <Choice
                active={copyFrom === "blank"}
                title="Base configuration"
                meta="Reset to the seeded cost sheet defaults"
                onClick={() => setCopyFrom("blank")}
              />
            </div>
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-hairline px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-md border border-hairline px-3 py-2 text-[12.5px] text-ink-600 hover:bg-surface-alt"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="rounded-md bg-brand-700 px-3.5 py-2 text-[12.5px] font-medium text-white hover:bg-brand-800"
          >
            Create {kind}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Choice({
  active,
  title,
  meta,
  onClick,
}: {
  active: boolean;
  title: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-lg border px-3 py-2 text-left transition-colors",
        active ? "border-brand-700 bg-brand-50" : "border-hairline hover:bg-surface-alt",
      )}
    >
      <div className={cn("text-[12.5px] font-medium", active ? "text-brand-700" : "text-ink-900")}>
        {title}
      </div>
      <div className="text-[11px] text-ink-500">{meta}</div>
    </button>
  );
}
