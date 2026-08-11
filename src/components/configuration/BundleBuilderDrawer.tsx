/**
 * Bundle / Set builder — combine several articles into one saleable offering
 * and price it as a single line.
 *
 * The set keeps every article's own costing underneath: the roll-up here is
 * quantity-weighted (qty per set), optional articles are excluded from the
 * committed set price, and a bundle discount expresses the "buy the set"
 * concession on top of the summed article prices.
 */

import { useMemo, useState } from "react";
import { Boxes, Check, ChevronDown, ChevronUp, Layers, Plus, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { DrawerShell } from "@/components/articles/DrawerShell";
import { ArticleLibraryDrawer } from "@/components/articles/ArticleLibraryDrawer";
import { KIT_PRESETS, type LibraryArticle } from "@/lib/articleLibrary";
import { srfRefForStyle, type KitItem } from "@/lib/podsStore";

/** How the combined offering is sold — drives naming and the quotation line. */
const BUNDLE_KINDS = ["Set", "Bundle", "Gift Pack", "Collection"] as const;
type BundleKind = (typeof BUNDLE_KINDS)[number];

const CURRENCIES = ["USD", "EUR", "GBP", "INR"] as const;

export type BundleDraft = {
  name: string;
  buyer: string;
  collection: string;
  moq: string;
  currency: string;
  kind: BundleKind;
  discountPct: number;
  items: KitItem[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  defaultBuyer?: string;
  defaultCollection?: string;
  /** Articles already in the workspace, offered as one-click additions. */
  suggestions?: Array<{
    id: string;
    name: string;
    image?: string;
    size?: string;
    moq?: string;
    srfRef?: string;
    estUnitCost?: number;
    estSellPrice?: number;
  }>;
  onCreate: (bundle: BundleDraft) => void;
};

const money = (n: number, currency: string) =>
  `${currency === "USD" ? "$" : currency === "INR" ? "₹" : ""}${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export function BundleBuilderDrawer({
  open,
  onClose,
  defaultBuyer,
  defaultCollection,
  suggestions = [],
  onCreate,
}: Props) {
  const [kind, setKind] = useState<BundleKind>("Set");
  const [name, setName] = useState("");
  const [buyer, setBuyer] = useState(defaultBuyer ?? "");
  const [collection, setCollection] = useState(defaultCollection ?? "");
  const [moq, setMoq] = useState("");
  const [currency, setCurrency] = useState<string>("USD");
  const [discountPct, setDiscountPct] = useState(0);
  const [items, setItems] = useState<KitItem[]>([]);
  const [libOpen, setLibOpen] = useState(false);

  const ok = name.trim().length > 0 && moq.trim().length > 0 && items.length > 0;

  const totals = useMemo(() => {
    const committed = items.filter((i) => !i.optional);
    const cost = committed.reduce((s, i) => s + (i.estUnitCost ?? 0) * i.qty, 0);
    const list = committed.reduce((s, i) => s + (i.estSellPrice ?? 0) * i.qty, 0);
    const setPrice = list * (1 - discountPct / 100);
    const marginPct = setPrice > 0 ? ((setPrice - cost) / setPrice) * 100 : 0;
    const pieces = items.reduce((s, i) => s + i.qty, 0);
    return { cost, list, setPrice, marginPct, pieces, saving: list - setPrice };
  }, [items, discountPct]);

  const addItems = (
    incoming: Array<{
      key: string;
      name: string;
      image?: string;
      size?: string;
      moq?: string;
      srfRef?: string;
      estUnitCost?: number;
      estSellPrice?: number;
    }>,
  ) =>
    setItems((prev) => [
      ...prev,
      ...incoming
        .filter((a) => !prev.some((p) => p.libraryId === a.key))
        .map((a) => ({
          id: `BI-${a.key}`,
          libraryId: a.key,
          name: a.name,
          image: a.image,
          size: a.size,
          moq: a.moq,
          srfRef: a.srfRef,
          qty: 1,
          optional: false,
          status: "not_started" as const,
          estUnitCost: a.estUnitCost,
          estSellPrice: a.estSellPrice,
        })),
    ]);

  const addFromLibrary = (arts: LibraryArticle[]) =>
    addItems(
      arts.map((a) => ({
        key: a.id,
        name: a.name,
        image: a.image,
        size: a.size,
        moq: a.moq,
        srfRef: srfRefForStyle(a.category),
        estUnitCost: a.estUnitCost,
        estSellPrice: a.estSellPrice,
      })),
    );

  const patch = (id: string, p: Partial<KitItem>) =>
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const move = (i: number, dir: -1 | 1) =>
    setItems((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const reset = () => {
    setName("");
    setCollection(defaultCollection ?? "");
    setMoq("");
    setDiscountPct(0);
    setItems([]);
  };

  const unpicked = suggestions.filter((s) => !items.some((i) => i.libraryId === s.id));

  return (
    <>
      <DrawerShell
        open={open && !libOpen}
        onClose={onClose}
        width="max-w-[920px]"
        title={`Create ${kind.toLowerCase()}`}
        subtitle="Combine articles into one saleable offering. Each article keeps its own costing underneath; the set is quoted as a single line."
        footer={
          <>
            <span className="text-[12px] text-ink-500">
              {items.length
                ? `${items.length} article${items.length === 1 ? "" : "s"} · ${totals.pieces} pieces per ${kind.toLowerCase()} · ${money(totals.setPrice, currency)} per ${kind.toLowerCase()}`
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
                    kind,
                    discountPct,
                    items,
                  });
                  reset();
                  onClose();
                }}
                disabled={!ok}
                className="inline-flex items-center gap-1.5 rounded-md bg-ink-900 px-3 py-2 text-[13px] font-medium text-white hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Check className="h-4 w-4" /> Create {kind.toLowerCase()}
              </button>
            </div>
          </>
        }
      >
        <div className="p-5">
          {/* ---- how it is sold ---- */}
          <fieldset className="flex flex-wrap items-center gap-2">
            <legend className="sr-only">Offering type</legend>
            <span className="text-[11px] uppercase tracking-wide text-ink-500">Offering</span>
            {BUNDLE_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
                  kind === k
                    ? "border-brand-700 bg-brand-50 text-brand-700"
                    : "border-hairline text-ink-700 hover:bg-surface-alt",
                )}
              >
                {k}
              </button>
            ))}
          </fieldset>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide text-ink-500">Preset</span>
            {KIT_PRESETS.map((k) => (
              <button
                key={k.name}
                type="button"
                onClick={() => setName(k.name)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
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
              label={`${kind} name *`}
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
            <Field
              label={`MOQ * (${kind.toLowerCase()}s)`}
              value={moq}
              onChange={setMoq}
              placeholder="e.g. 1,000 sets"
            />
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-wide text-ink-500">
                Currency
              </span>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[13px] focus:border-brand-500 focus:outline-none"
              >
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-wide text-ink-500">
                Bundle discount %
              </span>
              <input
                type="number"
                min={0}
                max={60}
                step={0.5}
                value={discountPct}
                onChange={(e) =>
                  setDiscountPct(Math.min(60, Math.max(0, Number(e.target.value) || 0)))
                }
                className="w-full rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[13px] tabular-nums focus:border-brand-500 focus:outline-none"
              />
            </label>
          </div>

          {/* ---- articles in this set ---- */}
          <div className="mt-6 overflow-hidden rounded-lg border border-hairline">
            <div className="flex items-center justify-between border-b border-hairline bg-surface-alt px-4 py-2.5">
              <span className="inline-flex items-center gap-2 text-[12px] font-medium text-ink-900">
                <Layers className="h-3.5 w-3.5 text-ink-400" /> Articles in this{" "}
                {kind.toLowerCase()}
              </span>
              <button
                type="button"
                onClick={() => setLibOpen(true)}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-brand-700 hover:underline"
              >
                <Plus className="h-3.5 w-3.5" /> Select from Library
              </button>
            </div>

            {unpicked.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-4 py-2.5">
                <span className="text-[11px] uppercase tracking-wide text-ink-500">
                  In this workspace
                </span>
                {unpicked.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => addItems([{ ...s, key: s.id }])}
                    className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-2.5 py-1 text-[12px] text-ink-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
                  >
                    <Plus className="h-3 w-3 text-ink-400" /> {s.name}
                  </button>
                ))}
              </div>
            )}

            {items.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <Boxes className="h-5 w-5 text-ink-400" />
                <p className="mt-2 text-[13px] text-ink-500">
                  No articles yet —{" "}
                  <button
                    type="button"
                    onClick={() => setLibOpen(true)}
                    className="text-brand-700 hover:underline"
                  >
                    select from the Article Library
                  </button>
                  .
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead className="border-b border-hairline text-[11px] uppercase tracking-wide text-ink-500">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Article</th>
                      <th className="px-3 py-2 text-left font-medium">Size</th>
                      <th className="px-3 py-2 text-left font-medium">MOQ</th>
                      <th className="px-3 py-2 text-left font-medium">
                        Qty / {kind.toLowerCase()}
                      </th>
                      <th className="px-3 py-2 text-right font-medium">Cost</th>
                      <th className="px-3 py-2 text-right font-medium">Price</th>
                      <th className="px-3 py-2 text-left font-medium">Optional</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, i) => (
                      <tr key={it.id} className="border-b border-hairline last:border-0">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-3">
                            {it.image && (
                              <img src={it.image} alt="" className="h-8 w-8 rounded object-cover" />
                            )}
                            <span className="font-medium text-ink-900">{it.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            aria-label={`Size for ${it.name}`}
                            value={it.size ?? ""}
                            onChange={(e) => patch(it.id, { size: e.target.value })}
                            className="w-24 rounded-md border border-hairline bg-surface px-2 py-1 text-[12.5px] focus:border-brand-500 focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            aria-label={`MOQ for ${it.name}`}
                            value={it.moq ?? ""}
                            onChange={(e) => patch(it.id, { moq: e.target.value })}
                            className="w-24 rounded-md border border-hairline bg-surface px-2 py-1 text-[12.5px] focus:border-brand-500 focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={1}
                            aria-label={`Quantity per ${kind.toLowerCase()} for ${it.name}`}
                            value={it.qty}
                            onChange={(e) =>
                              patch(it.id, { qty: Math.max(1, Number(e.target.value) || 1) })
                            }
                            className="w-16 rounded-md border border-hairline bg-surface px-2 py-1 text-[13px] tabular-nums focus:border-brand-500 focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-ink-500">
                          {money((it.estUnitCost ?? 0) * it.qty, currency)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-ink-900">
                          {money((it.estSellPrice ?? 0) * it.qty, currency)}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            aria-label={`${it.name} is optional in this ${kind.toLowerCase()}`}
                            checked={!!it.optional}
                            onChange={(e) => patch(it.id, { optional: e.target.checked })}
                            className="h-4 w-4 rounded border-hairline accent-brand-700"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              type="button"
                              onClick={() => move(i, -1)}
                              className="rounded p-1 text-ink-500 hover:bg-surface-alt"
                              aria-label={`Move ${it.name} up`}
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => move(i, 1)}
                              className="rounded p-1 text-ink-500 hover:bg-surface-alt"
                              aria-label={`Move ${it.name} down`}
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setItems((p) => p.filter((x) => x.id !== it.id))}
                              className="rounded p-1 text-ink-500 hover:bg-danger-50 hover:text-danger-600"
                              aria-label={`Remove ${it.name}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ---- combined pricing ---- */}
          {items.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-hairline bg-surface-alt/50 p-4 sm:grid-cols-4">
              <Stat label={`Cost / ${kind.toLowerCase()}`} value={money(totals.cost, currency)} />
              <Stat label="Sum of articles" value={money(totals.list, currency)} />
              <Stat
                label={`${kind} price`}
                value={money(totals.setPrice, currency)}
                hint={discountPct > 0 ? `−${money(totals.saving, currency)} bundled` : undefined}
                emphasis
              />
              <Stat label="Margin" value={`${totals.marginPct.toFixed(1)}%`} />
            </div>
          )}

          <p className="mt-2 text-[10.5px] text-ink-400">
            Optional articles are excluded from the {kind.toLowerCase()} price and quoted as
            add-ons.
          </p>
        </div>
      </DrawerShell>

      <ArticleLibraryDrawer
        open={libOpen}
        onClose={() => setLibOpen(false)}
        title={`Select ${kind.toLowerCase()} articles`}
        subtitle={`Pick the articles that make up this ${kind.toLowerCase()}.`}
        submitLabel={`Add to ${kind.toLowerCase()}`}
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

function Stat({
  label,
  value,
  hint,
  emphasis,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-[0.1em] text-ink-500">{label}</div>
      <div
        className={cn(
          "mt-0.5 tabular-nums",
          emphasis ? "text-[18px] font-semibold text-ink-900" : "text-[15px] text-ink-900",
        )}
      >
        {value}
      </div>
      {hint && <div className="text-[10.5px] text-brand-700">{hint}</div>}
    </div>
  );
}
