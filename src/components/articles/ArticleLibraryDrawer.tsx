import { useMemo, useState, useEffect } from "react";
import {
  Search,
  Filter,
  Eye,
  Plus,
  Check,
  FileText,
  FileSpreadsheet,
  FilePlus2,
  Sparkles,
  ArrowLeft,
  Loader2,
  Package,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DrawerShell, ConfidenceBadge } from "./DrawerShell";
import {
  LIBRARY_ARTICLES,
  LIBRARY_FILTERS,
  LIBRARY_STATUS_LABEL,
  TECH_PACKS,
  extractTechPack,
  EXTRACTION_STAGES,
  COST_SHEET_FILES,
  COST_SHEET_MAPPINGS,
  MAPPING_TARGETS,
  type LibraryArticle,
} from "@/lib/articleLibrary";

export type LibrarySelection = LibraryArticle;

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  defaultBuyer?: string;
  onSubmit: (articles: LibraryArticle[]) => void;
};

/* ================================================================== */

export function ArticleLibraryDrawer({
  open,
  onClose,
  title = "Article Library",
  subtitle = "Search the master catalogue, or create a new article from a tech pack.",
  submitLabel = "Add to POD",
  defaultBuyer,
  onSubmit,
}: Props) {
  const [view, setView] = useState<"library" | "create">("library");
  const [q, setQ] = useState("");
  const [buyer, setBuyer] = useState<string>(defaultBuyer && LIBRARY_FILTERS.buyer.includes(defaultBuyer) ? defaultBuyer : "all");
  const [category, setCategory] = useState("all");
  const [collection, setCollection] = useState("all");
  const [season, setSeason] = useState("all");
  const [status, setStatus] = useState("all");
  const [picked, setPicked] = useState<string[]>([]);
  const [preview, setPreview] = useState<LibraryArticle | null>(null);
  const [drafts, setDrafts] = useState<LibraryArticle[]>([]);

  useEffect(() => {
    if (!open) {
      setView("library");
      setPicked([]);
      setPreview(null);
      setQ("");
    }
  }, [open]);

  const all = useMemo(() => [...drafts, ...LIBRARY_ARTICLES], [drafts]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return all.filter((a) => {
      if (buyer !== "all" && a.buyer !== buyer) return false;
      if (category !== "all" && a.category !== category) return false;
      if (collection !== "all" && a.collection !== collection) return false;
      if (season !== "all" && a.season !== season) return false;
      if (status !== "all" && a.status !== status) return false;
      if (!term) return true;
      return (
        a.name.toLowerCase().includes(term) ||
        a.articleNo.toLowerCase().includes(term) ||
        a.buyerRef.toLowerCase().includes(term)
      );
    });
  }, [all, q, buyer, category, collection, season, status]);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const submit = () => {
    const items = all.filter((a) => picked.includes(a.id));
    if (!items.length) return;
    onSubmit(items);
    onClose();
  };

  return (
    <DrawerShell
      open={open}
      onClose={onClose}
      title={view === "library" ? title : "Create New Article"}
      subtitle={view === "library" ? subtitle : "Choose how the article data should come in."}
      footer={
        view === "library" ? (
          <>
            <span className="text-[12px] text-ink-500">
              {picked.length ? `${picked.length} selected` : `${rows.length} articles`}
            </span>
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="rounded-md border border-hairline px-3 py-2 text-[13px] text-ink-700 hover:bg-surface">
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={!picked.length}
                className="inline-flex items-center gap-1.5 rounded-md bg-ink-900 px-3 py-2 text-[13px] font-medium text-white hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-4 w-4" /> {submitLabel}
                {picked.length > 0 && (
                  <span className="ml-1 rounded-full bg-white/20 px-1.5 text-[11px] tabular-nums">{picked.length}</span>
                )}
              </button>
            </div>
          </>
        ) : undefined
      }
    >
      {view === "create" ? (
        <CreateNewArticle
          onBack={() => setView("library")}
          onCreated={(a) => {
            setDrafts((d) => [a, ...d]);
            setPicked((p) => [...p, a.id]);
            setView("library");
          }}
        />
      ) : (
        <div className="flex h-full">
          <div className="min-w-0 flex-1">
            {/* search + create */}
            <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-5 py-3">
              <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-md border border-hairline bg-surface px-3 py-2">
                <Search className="h-4 w-4 text-ink-400" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search article name, article number or buyer reference…"
                  className="flex-1 bg-transparent text-[13px] text-ink-900 placeholder:text-ink-400 focus:outline-none"
                />
              </div>
              <button
                onClick={() => setView("create")}
                className="inline-flex items-center gap-1.5 rounded-md border border-brand-700 px-3 py-2 text-[13px] font-medium text-brand-700 hover:bg-brand-50"
              >
                <FilePlus2 className="h-4 w-4" /> Create New Article
              </button>
            </div>

            {/* filters */}
            <div className="flex flex-wrap items-center gap-2 border-b border-hairline bg-surface-alt/50 px-5 py-2.5">
              <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-ink-400">
                <Filter className="h-3.5 w-3.5" /> Filters
              </span>
              <Select value={buyer} onChange={setBuyer} label="Buyer" options={LIBRARY_FILTERS.buyer} />
              <Select value={category} onChange={setCategory} label="Category" options={LIBRARY_FILTERS.category} />
              <Select value={collection} onChange={setCollection} label="Collection" options={LIBRARY_FILTERS.collection} />
              <Select value={season} onChange={setSeason} label="Season" options={LIBRARY_FILTERS.season} />
              <Select
                value={status}
                onChange={setStatus}
                label="Status"
                options={LIBRARY_FILTERS.status}
                render={(s) => LIBRARY_STATUS_LABEL[s as keyof typeof LIBRARY_STATUS_LABEL] ?? s}
              />
              {(buyer !== "all" || category !== "all" || collection !== "all" || season !== "all" || status !== "all") && (
                <button
                  onClick={() => {
                    setBuyer("all"); setCategory("all"); setCollection("all"); setSeason("all"); setStatus("all");
                  }}
                  className="text-[12px] text-brand-700 hover:underline"
                >
                  Clear
                </button>
              )}
            </div>

            <table className="w-full text-[13px]">
              <thead className="border-b border-hairline text-[11px] uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="w-10 px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={rows.length > 0 && rows.every((r) => picked.includes(r.id))}
                      onChange={() =>
                        setPicked((p) =>
                          rows.every((r) => p.includes(r.id)) ? [] : Array.from(new Set([...p, ...rows.map((r) => r.id)])),
                        )
                      }
                      className="h-4 w-4 rounded border-hairline accent-brand-700"
                      aria-label="Select all"
                    />
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium">Article</th>
                  <th className="px-3 py-2.5 text-left font-medium">Size</th>
                  <th className="px-3 py-2.5 text-left font-medium">MOQ</th>
                  <th className="px-3 py-2.5 text-left font-medium">Style</th>
                  <th className="px-3 py-2.5 text-left font-medium">Supplier</th>
                  <th className="px-3 py-2.5 text-left font-medium">Updated</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => {
                  const on = picked.includes(a.id);
                  return (
                    <tr
                      key={a.id}
                      className={cn("border-b border-hairline last:border-0 hover:bg-surface-alt/40", on && "bg-brand-50/40")}
                    >
                      <td className="px-4 py-2.5">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggle(a.id)}
                          className="h-4 w-4 rounded border-hairline accent-brand-700"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-3">
                          <img src={a.image} alt="" className="h-9 w-9 rounded object-cover" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 font-medium text-ink-900">
                              {a.name}
                              <span className="rounded bg-ink-100 px-1 py-px text-[10px] text-ink-500">{a.version}</span>
                            </div>
                            <div className="truncate text-[11px] text-ink-400">
                              {a.articleNo} · {a.buyer} · {a.buyerRef} · {a.season}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-ink-700">{a.size}</td>
                      <td className="px-3 py-2.5 text-ink-700">{a.moq}</td>
                      <td className="px-3 py-2.5 text-ink-500">{a.style}</td>
                      <td className="px-3 py-2.5 text-ink-500">{a.supplier}</td>
                      <td className="px-3 py-2.5 text-ink-500">{a.updatedAt}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setPreview(a)}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[12px] text-ink-700 hover:bg-surface-alt"
                          >
                            <Eye className="h-3.5 w-3.5" /> Preview
                          </button>
                          <button
                            onClick={() => !on && toggle(a.id)}
                            className={cn(
                              "inline-flex items-center gap-1 rounded px-2 py-1 text-[12px]",
                              on ? "text-emerald-700" : "text-brand-700 hover:bg-brand-50",
                            )}
                          >
                            {on ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                            {on ? "Selected" : submitLabel}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-[13px] text-ink-400">
                      No articles match your search.
                      <button onClick={() => setView("create")} className="ml-1 text-brand-700 hover:underline">
                        Create a new article →
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {preview && <PreviewPanel article={preview} onClose={() => setPreview(null)} />}
        </div>
      )}
    </DrawerShell>
  );
}

function Select({
  value,
  onChange,
  label,
  options,
  render,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: string[];
  render?: (v: string) => string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "rounded-md border border-hairline bg-surface px-2 py-1.5 text-[12px] text-ink-700 focus:outline-none",
        value !== "all" && "border-brand-500 text-brand-700",
      )}
    >
      <option value="all">{label}: All</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {label}: {render ? render(o) : o}
        </option>
      ))}
    </select>
  );
}

function PreviewPanel({ article, onClose }: { article: LibraryArticle; onClose: () => void }) {
  return (
    <aside className="w-[320px] shrink-0 border-l border-hairline bg-surface-alt/40">
      <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
        <span className="text-[12px] font-medium text-ink-900">Preview</span>
        <button onClick={onClose} className="text-[12px] text-ink-500 hover:text-ink-900">Close</button>
      </div>
      <div className="p-4">
        <img src={article.image} alt={article.name} className="h-40 w-full rounded-md object-cover" />
        <h3 className="mt-3 text-[14px] font-semibold text-ink-900">{article.name}</h3>
        <p className="text-[12px] text-ink-500">{article.articleNo} · {article.style}</p>
        <dl className="mt-3 space-y-1.5 text-[12px]">
          {[
            ["Buyer", article.buyer],
            ["Buyer Ref", article.buyerRef],
            ["Category", article.category],
            ["Collection", article.collection],
            ["Season", article.season],
            ["Size", article.size],
            ["MOQ", article.moq],
            ["Supplier", article.supplier],
            ["Composition", article.composition ?? "—"],
            ["Construction", article.construction ?? "—"],
            ["GSM", article.gsm ?? "—"],
            ["Colour", article.colour ?? "—"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt className="text-ink-500">{k}</dt>
              <dd className="text-right text-ink-900">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 flex items-center gap-2 rounded-md border border-hairline bg-surface px-3 py-2 text-[11px] text-ink-500">
          <History className="h-3.5 w-3.5 text-ink-400" />
          {article.techPackRef ? `Tech pack ${article.techPackRef} · synced ${article.lastSyncedAt ?? "—"}` : "No tech pack linked"}
        </div>
      </div>
    </aside>
  );
}

/* ================================================================== */
/* Create New Article                                                  */
/* ================================================================== */

function CreateNewArticle({
  onBack,
  onCreated,
}: {
  onBack: () => void;
  onCreated: (a: LibraryArticle) => void;
}) {
  const [method, setMethod] = useState<"techpack" | "costsheet" | "blank">("techpack");

  return (
    <div className="p-5">
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-1 text-[12px] text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-3 w-3" /> Back to library
      </button>

      <div className="grid gap-3 sm:grid-cols-3">
        <MethodCard
          selected={method === "techpack"}
          recommended
          icon={<FileText className="h-4 w-4" />}
          title="Pull from Tech Pack"
          desc="AI reads the buyer tech pack and prefills construction, process, packaging and commercial data."
          onClick={() => setMethod("techpack")}
        />
        <MethodCard
          selected={method === "costsheet"}
          icon={<FileSpreadsheet className="h-4 w-4" />}
          title="Import Working Cost Sheet"
          desc="Map columns from an existing costing sheet. Unresolved mappings are flagged for confirmation."
          onClick={() => setMethod("costsheet")}
        />
        <MethodCard
          selected={method === "blank"}
          icon={<FilePlus2 className="h-4 w-4" />}
          title="Blank Article"
          desc="Start from an empty article and fill in the details manually."
          onClick={() => setMethod("blank")}
        />
      </div>

      <div className="mt-5 border-t border-hairline pt-5">
        {method === "techpack" && <TechPackFlow onCreated={onCreated} />}
        {method === "costsheet" && <CostSheetFlow onCreated={onCreated} />}
        {method === "blank" && <BlankFlow onCreated={onCreated} />}
      </div>
    </div>
  );
}

function MethodCard({
  icon, title, desc, onClick, recommended, selected,
}: { icon: React.ReactNode; title: string; desc: string; onClick: () => void; recommended?: boolean; selected?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-full flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors",
        selected
          ? "border-ink-900 bg-surface ring-1 ring-ink-900"
          : "border-hairline bg-surface hover:bg-surface-alt",
      )}
    >
      <span className={cn("flex h-8 w-8 items-center justify-center rounded-md", selected ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-700")}>
        {icon}
      </span>
      <span className="flex items-center gap-2 text-[13px] font-semibold text-ink-900">
        {title}
        {recommended && <span className="rounded-full bg-brand-700 px-1.5 py-0.5 text-[10px] font-medium text-white">Recommended</span>}
      </span>
      <span className="text-[12px] leading-relaxed text-ink-500">{desc}</span>
    </button>
  );
}

function newDraft(partial: Partial<LibraryArticle>): LibraryArticle {
  return {
    id: `NEW-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    name: "New Article",
    articleNo: "—",
    buyer: "—",
    buyerRef: "—",
    category: "Uncategorised",
    collection: "—",
    season: "—",
    status: "draft",
    image: TECH_PACKS[0].image,
    size: "—",
    moq: "—",
    style: "—",
    supplier: "—",
    updatedAt: "just now",
    version: "v1",
    ...partial,
  };
}

/* ---------------- Tech pack ---------------- */

function TechPackFlow({ onCreated }: { onCreated: (a: LibraryArticle) => void }) {
  const [tp, setTp] = useState<(typeof TECH_PACKS)[number] | null>(null);
  const [stage, setStage] = useState(-1);
  const [fields, setFields] = useState<ReturnType<typeof extractTechPack>>([]);

  useEffect(() => {
    if (!tp) return;
    setStage(0);
    setFields([]);
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      if (i >= EXTRACTION_STAGES.length) {
        clearInterval(t);
        setStage(EXTRACTION_STAGES.length);
        setFields(extractTechPack(tp));
      } else setStage(i);
    }, 550);
    return () => clearInterval(t);
  }, [tp]);

  const done = fields.length > 0;
  const pct = stage < 0 ? 0 : Math.min(100, Math.round((stage / EXTRACTION_STAGES.length) * 100));

  const set = (key: string, value: string) =>
    setFields((f) => f.map((x) => (x.key === key ? { ...x, value, confidence: 1 } : x)));

  return (
    <div>
      <p className="text-[12px] text-ink-500">Select a tech pack — extraction starts automatically.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {TECH_PACKS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTp(t)}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3 text-left",
              tp?.id === t.id ? "border-brand-700 bg-brand-50/60" : "border-hairline bg-surface hover:bg-surface-alt",
            )}
          >
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
            <span className="min-w-0">
              <span className="block truncate text-[12px] font-medium text-ink-900">{t.fileName}</span>
              <span className="block text-[11px] text-ink-500">{t.buyer} · {t.season} · {t.pages} pages · {t.version}</span>
              <span className="block text-[11px] text-ink-400">{t.uploadedAt}</span>
            </span>
          </button>
        ))}
      </div>

      {tp && !done && (
        <div className="mt-5 rounded-lg border border-hairline bg-surface p-4">
          <div className="flex items-center gap-2 text-[13px] font-medium text-ink-900">
            <Loader2 className="h-4 w-4 animate-spin text-brand-700" /> Extracting data from {tp.fileName}
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-100">
            <div className="h-full rounded-full bg-brand-700 transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <ul className="mt-3 space-y-1.5 text-[12px]">
            {EXTRACTION_STAGES.map((s, i) => (
              <li key={s} className={cn("flex items-center gap-2", i <= stage ? "text-ink-900" : "text-ink-400")}>
                {i < stage ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : i === stage ? <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-700" /> : <span className="h-3.5 w-3.5" />}
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {done && tp && (
        <div className="mt-5">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-brand-500 bg-brand-50/50 px-4 py-3">
            <div className="flex items-center gap-2 text-[13px] text-ink-900">
              <Sparkles className="h-4 w-4 text-brand-700" />
              <span>
                Extracted <span className="font-semibold">{fields.length} fields</span> from {tp.fileName} — highlighted
                fields came from the tech pack and stay editable.
              </span>
            </div>
            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-ink-700">{tp.version}</span>
          </div>

          <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {fields.map((f) => (
              <label key={f.key} className="block">
                <span className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-500">
                  {f.label}
                  <ConfidenceBadge value={f.confidence} />
                  {f.confidence < 0.6 && <span className="text-[10px] normal-case text-danger-600">confirm</span>}
                </span>
                <input
                  value={f.value}
                  onChange={(e) => set(f.key, e.target.value)}
                  className={cn(
                    "w-full rounded-md border px-2.5 py-1.5 text-[13px] focus:outline-none",
                    f.confidence >= 0.6
                      ? "border-brand-500/60 bg-brand-50/40 text-ink-900 focus:border-brand-700"
                      : "border-danger-200 bg-danger-50/40 text-ink-900",
                  )}
                />
              </label>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              onClick={() => {
                const v = (k: string) => fields.find((f) => f.key === k)?.value ?? "—";
                onCreated(
                  newDraft({
                    name: v("name"),
                    articleNo: v("articleNo"),
                    buyer: v("buyer"),
                    buyerRef: v("buyerRef"),
                    season: tp.season,
                    size: v("size"),
                    moq: v("moq"),
                    supplier: v("supplier"),
                    composition: v("composition"),
                    construction: v("construction"),
                    gsm: v("gsm"),
                    colour: v("colorways"),
                    image: tp.image,
                    techPackRef: tp.id,
                    lastSyncedAt: "just now",
                    style: v("printDetails").startsWith("Rotary") ? "Printed" : "—",
                  }),
                );
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-ink-900 px-3 py-2 text-[13px] font-medium text-white hover:bg-ink-700"
            >
              <Check className="h-4 w-4" /> Create article
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Cost sheet ---------------- */

function CostSheetFlow({ onCreated }: { onCreated: (a: LibraryArticle) => void }) {
  const [file, setFile] = useState<string | null>(null);
  const [maps, setMaps] = useState(COST_SHEET_MAPPINGS);
  const unresolved = maps.filter((m) => !m.target).length;

  return (
    <div>
      <p className="text-[12px] text-ink-500">Pick a working cost sheet — known columns are mapped automatically.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {COST_SHEET_FILES.map((f) => (
          <button
            key={f}
            onClick={() => { setFile(f); setMaps(COST_SHEET_MAPPINGS); }}
            className={cn(
              "flex items-start gap-2 rounded-lg border p-3 text-left text-[12px]",
              file === f ? "border-brand-700 bg-brand-50/60" : "border-hairline bg-surface hover:bg-surface-alt",
            )}
          >
            <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
            <span className="min-w-0 truncate text-ink-900">{f}</span>
          </button>
        ))}
      </div>

      {file && (
        <div className="mt-5 overflow-hidden rounded-lg border border-hairline">
          <div className="flex items-center justify-between border-b border-hairline bg-surface-alt px-4 py-2.5 text-[12px]">
            <span className="font-medium text-ink-900">Column mapping</span>
            <span className={cn(unresolved ? "text-amber-700" : "text-emerald-700")}>
              {unresolved ? `${unresolved} unresolved — confirm below` : "All columns mapped"}
            </span>
          </div>
          <table className="w-full text-[13px]">
            <thead className="border-b border-hairline text-[11px] uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Sheet column</th>
                <th className="px-4 py-2 text-left font-medium">Sample</th>
                <th className="px-4 py-2 text-left font-medium">Maps to</th>
                <th className="px-4 py-2 text-left font-medium">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {maps.map((m) => (
                <tr key={m.source} className={cn("border-b border-hairline last:border-0", !m.target && "bg-amber-50/40")}>
                  <td className="px-4 py-2 font-medium text-ink-900">{m.source}</td>
                  <td className="px-4 py-2 text-ink-500">{m.sample}</td>
                  <td className="px-4 py-2">
                    <select
                      value={m.target ?? ""}
                      onChange={(e) =>
                        setMaps((ms) => ms.map((x) => (x.source === m.source ? { ...x, target: e.target.value || null } : x)))
                      }
                      className={cn(
                        "rounded-md border px-2 py-1 text-[12px] focus:outline-none",
                        m.target ? "border-hairline bg-surface text-ink-900" : "border-amber-300 bg-white text-amber-700",
                      )}
                    >
                      <option value="">Unmapped — select field</option>
                      {MAPPING_TARGETS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2"><ConfidenceBadge value={m.confidence} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {file && (
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={() =>
              onCreated(
                newDraft({
                  name: maps.find((m) => m.target === "name")?.sample.split("—")[0].trim() || "Imported Article",
                  articleNo: maps.find((m) => m.target === "articleNo")?.sample ?? "—",
                  size: maps.find((m) => m.target === "size")?.sample ?? "—",
                  moq: maps.find((m) => m.target === "moq")?.sample ?? "—",
                  supplier: maps.find((m) => m.target === "supplier")?.sample ?? "—",
                  composition: maps.find((m) => m.target === "composition")?.sample,
                  construction: maps.find((m) => m.target === "construction")?.sample,
                }),
              )
            }
            disabled={unresolved > 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-ink-900 px-3 py-2 text-[13px] font-medium text-white hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Check className="h-4 w-4" /> Import article
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Blank ---------------- */

function BlankFlow({ onCreated }: { onCreated: (a: LibraryArticle) => void }) {
  const [form, setForm] = useState({ name: "", articleNo: "", buyer: "", buyerRef: "", category: "", collection: "", season: "", size: "", moq: "", style: "", supplier: "" });
  const ok = form.name.trim() && form.size.trim() && form.moq.trim();
  return (
    <div>
      <div className="flex items-center gap-2 text-[12px] text-ink-500">
        <Package className="h-4 w-4 text-ink-400" /> Blank article — fill in what you know, the rest stays editable later.
      </div>
      <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {([
          ["name", "Product Name *"], ["articleNo", "Article Number"], ["buyer", "Buyer"],
          ["buyerRef", "Buyer Reference"], ["category", "Product Category"], ["collection", "Collection"],
          ["season", "Season"], ["size", "Size *"], ["moq", "MOQ *"], ["style", "Style"], ["supplier", "Supplier"],
        ] as const).map(([k, label]) => (
          <label key={k} className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-wide text-ink-500">{label}</span>
            <input
              value={form[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              className="w-full rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[13px] focus:border-brand-500 focus:outline-none"
            />
          </label>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-end">
        <button
          onClick={() =>
            onCreated(
              newDraft({
                name: form.name.trim(),
                articleNo: form.articleNo.trim() || "—",
                buyer: form.buyer.trim() || "—",
                buyerRef: form.buyerRef.trim() || "—",
                category: form.category.trim() || "Uncategorised",
                collection: form.collection.trim() || "—",
                season: form.season.trim() || "—",
                size: form.size.trim(),
                moq: form.moq.trim(),
                style: form.style.trim() || "—",
                supplier: form.supplier.trim() || "—",
              }),
            )
          }
          disabled={!ok}
          className="inline-flex items-center gap-1.5 rounded-md bg-ink-900 px-3 py-2 text-[13px] font-medium text-white hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Check className="h-4 w-4" /> Create article
        </button>
      </div>
    </div>
  );
}
