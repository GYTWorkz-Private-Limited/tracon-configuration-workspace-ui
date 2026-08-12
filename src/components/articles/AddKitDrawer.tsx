import { useState } from "react";
import { Boxes, Plus, Trash2, ChevronUp, ChevronDown, Check, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { DrawerShell } from "./DrawerShell";
import { ArticleLibraryDrawer } from "./ArticleLibraryDrawer";
import { KIT_PRESETS, type LibraryArticle } from "@/lib/articleLibrary";
import type { KitItem } from "@/lib/podsStore";

type Props = {
  open: boolean;
  onClose: () => void;
  defaultBuyer?: string;
  onCreate: (kit: {
    name: string;
    buyer: string;
    collection: string;
    moq: string;
    currency: string;
    items: KitItem[];
  }) => void;
};

export function AddKitDrawer({ open, onClose, defaultBuyer, onCreate }: Props) {
  const [name, setName] = useState("");
  const [buyer, setBuyer] = useState(defaultBuyer ?? "");
  const [collection, setCollection] = useState("");
  const [moq, setMoq] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [items, setItems] = useState<KitItem[]>([]);
  const [libOpen, setLibOpen] = useState(false);

  const ok = name.trim() && moq.trim() && items.length > 0;

  const addFromLibrary = (arts: LibraryArticle[]) => {
    setItems((prev) => [
      ...prev,
      ...arts
        .filter((a) => !prev.some((p) => p.libraryId === a.id))
        .map((a) => ({
          id: `KI-${a.id}`,
          libraryId: a.id,
          name: a.name,
          image: a.image,
          size: a.size,
          moq: a.moq,
          qty: 1,
          optional: false,
          status: "not_started" as const,
          estUnitCost: a.estUnitCost,
          estSellPrice: a.estSellPrice,
        })),
    ]);
  };

  const move = (i: number, dir: -1 | 1) =>
    setItems((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const patch = (id: string, p: Partial<KitItem>) =>
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const reset = () => {
    setName("");
    setCollection("");
    setMoq("");
    setItems([]);
  };

  return (
    <>
      <DrawerShell
        open={open && !libOpen}
        onClose={onClose}
        width="max-w-[860px]"
        title="Add Kit"
        subtitle="A kit is quoted as one line but each article keeps its own costing underneath."
        footer={
          <>
            <span className="text-[12px] text-ink-500">
              {items.length
                ? `${items.length} articles · ${items.reduce((s, i) => s + i.qty, 0)} pieces per set`
                : "No articles yet"}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="rounded-md border border-hairline px-3 py-2 text-[13px] text-ink-700 hover:bg-surface"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!ok) return;
                  onCreate({
                    name: name.trim(),
                    buyer: buyer.trim() || "—",
                    collection: collection.trim() || "—",
                    moq: moq.trim(),
                    currency,
                    items,
                  });
                  reset();
                  onClose();
                }}
                disabled={!ok}
                className="inline-flex items-center gap-1.5 rounded-md bg-ink-900 px-3 py-2 text-[13px] font-medium text-white hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Check className="h-4 w-4" /> Create Kit
              </button>
            </div>
          </>
        }
      >
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide text-ink-500">Preset</span>
            {KIT_PRESETS.map((k) => (
              <button
                key={k.name}
                onClick={() => setName(k.name)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[12px]",
                  name === k.name
                    ? "border-brand-700 bg-brand-50 text-brand-700"
                    : "border-hairline text-ink-700 hover:bg-surface-alt",
                )}
              >
                {k.name}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Field
              label="Kit Name *"
              value={name}
              onChange={setName}
              placeholder="e.g. Dining Set — SS27"
            />
            <Field label="Buyer" value={buyer} onChange={setBuyer} />
            <Field
              label="Collection"
              value={collection}
              onChange={setCollection}
              placeholder="e.g. Warm Table Top"
            />
            <Field label="MOQ *" value={moq} onChange={setMoq} placeholder="e.g. 1,000 sets" />
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-wide text-ink-500">
                Currency
              </span>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[13px] focus:outline-none"
              >
                {["USD", "EUR", "GBP", "INR"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-6 overflow-hidden rounded-lg border border-hairline">
            <div className="flex items-center justify-between border-b border-hairline bg-surface-alt px-4 py-2.5">
              <span className="inline-flex items-center gap-2 text-[12px] font-medium text-ink-900">
                <Layers className="h-3.5 w-3.5 text-ink-400" /> Kit articles
              </span>
              <button
                onClick={() => setLibOpen(true)}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-brand-700 hover:underline"
              >
                <Plus className="h-3.5 w-3.5" /> Select from Library
              </button>
            </div>

            {items.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <Boxes className="h-5 w-5 text-ink-400" />
                <p className="mt-2 text-[13px] text-ink-500">
                  No articles yet —{" "}
                  <button
                    onClick={() => setLibOpen(true)}
                    className="text-brand-700 hover:underline"
                  >
                    select from the Article Library
                  </button>
                  .
                </p>
              </div>
            ) : (
              <table className="w-full text-[13px]">
                <thead className="border-b border-hairline text-[11px] uppercase tracking-wide text-ink-500">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Article</th>
                    <th className="px-3 py-2 text-left font-medium">Size</th>
                    <th className="px-3 py-2 text-left font-medium">Qty / set</th>
                    <th className="px-3 py-2 text-left font-medium">Optional</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={it.id} className="border-b border-hairline last:border-0">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-3">
                          <img src={it.image} alt="" className="h-8 w-8 rounded object-cover" />
                          <span className="font-medium text-ink-900">{it.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-ink-500">{it.size}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={1}
                          value={it.qty}
                          onChange={(e) =>
                            patch(it.id, { qty: Math.max(1, Number(e.target.value) || 1) })
                          }
                          className="w-16 rounded-md border border-hairline bg-surface px-2 py-1 text-[13px] tabular-nums focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={!!it.optional}
                          onChange={(e) => patch(it.id, { optional: e.target.checked })}
                          className="h-4 w-4 rounded border-hairline accent-brand-700"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            onClick={() => move(i, -1)}
                            className="rounded p-1 text-ink-500 hover:bg-surface-alt"
                            aria-label="Move up"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => move(i, 1)}
                            className="rounded p-1 text-ink-500 hover:bg-surface-alt"
                            aria-label="Move down"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setItems((p) => p.filter((x) => x.id !== it.id))}
                            className="rounded p-1 text-ink-500 hover:bg-danger-50 hover:text-danger-600"
                            aria-label="Remove"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </DrawerShell>

      <ArticleLibraryDrawer
        noun="kit item"
        open={libOpen}
        onClose={() => setLibOpen(false)}
        title="Select Kit Articles"
        subtitle="Pick the articles that make up this kit."
        submitLabel="Add to Kit"
        defaultBuyer={buyer || defaultBuyer}
        onSubmit={addFromLibrary}
      />
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wide text-ink-500">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[13px] focus:border-brand-500 focus:outline-none"
      />
    </label>
  );
}
