import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Check,
  Layers,
  ArrowLeft,
  Copy,
  FilePlus2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DrawerShell } from "./DrawerShell";
import { ArticleLibraryDrawer } from "./ArticleLibraryDrawer";
import { SearchField } from "@/components/ui/pickers";
import { KIT_PRESETS, type LibraryArticle } from "@/lib/articleLibrary";
import { useExistingKits, type ExistingKit, type KitItem } from "@/lib/podsStore";

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
  /**
   * Most kits are not new. Landing straight in an empty form asked the user to
   * re-add articles that already sit inside a kit somewhere else, so the drawer
   * opens on the choice instead and only then commits to a path.
   */
  const [view, setView] = useState<"choose" | "existing" | "build">("choose");
  /** Set when the articles below were preloaded, so their origin stays visible. */
  const [reusedFrom, setReusedFrom] = useState<ExistingKit | null>(null);
  const [kitQuery, setKitQuery] = useState("");

  const existingKits = useExistingKits();

  const shownKits = useMemo(() => {
    const term = kitQuery.trim().toLowerCase();
    if (!term) return existingKits;
    return existingKits.filter(
      (k) =>
        k.name.toLowerCase().includes(term) ||
        k.buyer.toLowerCase().includes(term) ||
        (k.collection ?? "").toLowerCase().includes(term) ||
        k.items.some((i) => i.name.toLowerCase().includes(term)),
    );
  }, [existingKits, kitQuery]);

  const ok = name.trim() && moq.trim() && items.length > 0;

  const reuse = (k: ExistingKit) => {
    setName(k.name);
    setCollection(k.collection ?? "");
    setMoq(k.moq);
    if (k.currency) setCurrency(k.currency);
    // Copied, not referenced — editing qty here must not rewrite the kit the
    // articles came from.
    setItems(k.items.map((i) => ({ ...i })));
    setReusedFrom(k);
    setView("build");
  };

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
    setReusedFrom(null);
    setKitQuery("");
    setView("choose");
  };

  // Reopening must ask the question again — a drawer that remembers the last
  // path silently hides the other one.
  useEffect(() => {
    if (!open) reset();
  }, [open]);

  return (
    <>
      <DrawerShell
        open={open && !libOpen}
        onClose={onClose}
        width="max-w-[860px]"
        title={view === "existing" ? "Choose Existing Kit" : "Add Kit"}
        subtitle={
          view === "existing"
            ? "Pick a kit that already exists — all of its articles come across, still editable."
            : "A kit is quoted as one line but each article keeps its own costing underneath."
        }
        footer={
          view === "choose" ? (
            <>
              <span className="text-[12px] text-ink-500">
                {existingKits.length
                  ? `${existingKits.length} kit${existingKits.length === 1 ? "" : "s"} available to reuse`
                  : "No kits created yet"}
              </span>
              <button
                onClick={onClose}
                className="rounded-md border border-hairline px-3 py-2 text-[13px] text-ink-700 hover:bg-surface"
              >
                Cancel
              </button>
            </>
          ) : view === "existing" ? (
            <>
              <span className="text-[12px] text-ink-500">
                {shownKits.length} kit{shownKits.length === 1 ? "" : "s"}
              </span>
              <button
                onClick={() => setView("choose")}
                className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-3 py-2 text-[13px] text-ink-700 hover:bg-surface"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            </>
          ) : (
            <>
              <span className="text-[12px] text-ink-500">
                {items.length
                  ? `${items.length} articles · ${items.reduce((s, i) => s + i.qty, 0)} pieces per set`
                  : "No articles yet"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setView("choose")}
                  className="rounded-md border border-hairline px-3 py-2 text-[13px] text-ink-700 hover:bg-surface"
                >
                  Back
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
                  <Check className="h-4 w-4" /> {reusedFrom ? "Add Kit" : "Create Kit"}
                </button>
              </div>
            </>
          )
        }
      >
        {view === "choose" ? (
          <ChooseStart
            kitCount={existingKits.length}
            onExisting={() => setView("existing")}
            onCreate={() => {
              setReusedFrom(null);
              setView("build");
            }}
          />
        ) : view === "existing" ? (
          <div>
            <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-5 py-3">
              <SearchField
                autoFocus
                label="Search kits"
                value={kitQuery}
                onChange={setKitQuery}
                placeholder="Search kit name, buyer, collection or article…"
              />
            </div>
            {existingKits.length === 0 ? (
              <div className="flex flex-col items-center px-5 py-16 text-center">
                <Boxes className="h-5 w-5 text-ink-400" />
                <p className="mt-2 text-[13px] text-ink-500">
                  No kits created yet —{" "}
                  <button
                    onClick={() => setView("build")}
                    className="text-brand-700 hover:underline"
                  >
                    create the first one
                  </button>
                  .
                </p>
              </div>
            ) : shownKits.length === 0 ? (
              <p className="px-5 py-14 text-center text-[13px] text-ink-400">
                No kits match “{kitQuery}”.
              </p>
            ) : (
              <ul className="divide-y divide-hairline">
                {shownKits.map((k) => (
                  <li key={`${k.podId}-${k.kitId}`}>
                    <button
                      onClick={() => reuse(k)}
                      className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-alt/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-700"
                    >
                      <img
                        src={k.image}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded object-cover"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-[13px] font-medium text-ink-900">
                          {k.name}
                          <span className="rounded bg-ink-100 px-1.5 py-px text-[10.5px] font-normal text-ink-500">
                            {k.items.length} article{k.items.length === 1 ? "" : "s"}
                          </span>
                        </span>
                        <span className="block truncate text-[11.5px] text-ink-500">
                          {summarise(k.items)}
                        </span>
                        <span className="block truncate text-[11px] text-ink-400">
                          {[k.buyer, k.collection, k.podId, `MOQ ${k.moq}`]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-[12px] text-brand-700">
                        <Copy className="h-3.5 w-3.5" /> Use kit
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="p-5">
            {reusedFrom && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-brand-500 bg-brand-50/50 px-4 py-2.5 text-[12.5px] text-ink-900">
                <Sparkles className="h-4 w-4 shrink-0 text-brand-700" />
                <span>
                  {reusedFrom.items.length} articles preloaded from{" "}
                  <span className="font-semibold">{reusedFrom.name}</span> ({reusedFrom.buyer} ·{" "}
                  {reusedFrom.podId}) — edit before adding.
                </span>
              </div>
            )}
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
        )}
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

/** Member names, cut short — the row states the count, the list gives the flavour. */
function summarise(items: KitItem[]) {
  const shown = items.slice(0, 3).map((i) => i.name);
  const rest = items.length - shown.length;
  return rest > 0 ? `${shown.join(", ")} +${rest} more` : shown.join(", ");
}

function ChooseStart({
  kitCount,
  onExisting,
  onCreate,
}: {
  kitCount: number;
  onExisting: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <StartCard
          icon={<Boxes className="h-4 w-4" />}
          title="Choose existing kit"
          desc={
            kitCount
              ? "Reuse a kit already built on another POD — every article comes across, ready to edit."
              : "No kits created yet — create the first one."
          }
          badge={kitCount ? `${kitCount} available` : undefined}
          disabled={kitCount === 0}
          onClick={onExisting}
        />
        <StartCard
          icon={<FilePlus2 className="h-4 w-4" />}
          title="Create new kit"
          desc="Name the set and pick its articles from the Article Library."
          onClick={onCreate}
        />
      </div>
    </div>
  );
}

function StartCard({
  icon,
  title,
  desc,
  badge,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  badge?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-full flex-col items-start gap-2 rounded-lg border border-hairline bg-surface p-4 text-left transition-colors",
        disabled ? "cursor-not-allowed opacity-60" : "hover:bg-surface-alt",
      )}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ink-100 text-ink-700">
        {icon}
      </span>
      <span className="flex items-center gap-2 text-[13px] font-semibold text-ink-900">
        {title}
        {badge && (
          <span className="rounded-full bg-brand-700 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {badge}
          </span>
        )}
      </span>
      <span className="text-[12px] leading-relaxed text-ink-500">{desc}</span>
    </button>
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
