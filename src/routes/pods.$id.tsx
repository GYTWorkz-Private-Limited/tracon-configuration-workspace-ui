import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Plus,
  Sparkles,
  Trash2,
  Pencil,
  Check,
  X,
  Package,
  Boxes,
  Copy,
  ClipboardCheck,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ArticleLibraryDrawer } from "@/components/articles/ArticleLibraryDrawer";
import {
  RECOSTING_LABEL,
  podHasRecostIn,
  useRecostRequest,
  useRecostRequests,
} from "@/lib/recostingStore";
import { AddKitDrawer } from "@/components/articles/AddKitDrawer";
import {
  usePod,
  addLibraryArticles,
  addKit,
  cloneArticle,
  kitProgress,
  updateArticle,
  deleteArticle,
  markArticlesInProgress,
  POD_STATUS_LABEL,
  ARTICLE_STATUS_LABEL,
  type Article,
  type ArticleStatus,
} from "@/lib/podsStore";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pods/$id")({
  loader: ({ params }) => ({ id: params.id }),
  head: () => ({ meta: [{ title: "POD · Tracon" }] }),
  component: PodDetail,
  notFoundComponent: () => <div className="p-10 text-sm text-ink-500">POD not found.</div>,
});

const STATUS_TONE: Record<ArticleStatus, string> = {
  not_started: "bg-ink-100 text-ink-700",
  in_progress: "bg-brand-50 text-brand-700",
  pending_approval: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  // Red, deliberately not amber: "waiting on an approver" and "sent back"
  // must not read the same at a glance.
  recosting: "bg-red-50 text-red-700",
};

/** Preset catalogue used by the Product combobox + Style helper. */
const PRODUCT_PRESETS: { name: string; style: string; size: string; moq: string }[] = [
  { name: "Placemat", style: "Table Top", size: '13" × 19"', moq: "3,000 pcs" },
  { name: "Runner", style: "Table Top", size: '14" × 72"', moq: "1,500 pcs" },
  { name: "Napkin", style: "Table Top", size: '20" × 20"', moq: "6,000 pcs" },
  { name: "Cushion Cover", style: "Cushion Cover", size: "45×45 cm", moq: "1,000 pcs" },
  { name: "Cushion Cover (Piped)", style: "Cushion Cover", size: "50×50 cm", moq: "1,000 pcs" },
  { name: "Cushion Cover (Quilted)", style: "Cushion Cover", size: "40×40 cm", moq: "800 pcs" },
  { name: "Bath Towel", style: "Bath Towel", size: "70×140 cm", moq: "1,200 pcs" },
  { name: "Bath Sheet", style: "Bath Towel", size: "90×170 cm", moq: "800 pcs" },
  { name: "Hand Towel", style: "Hand Towel", size: "40×60 cm", moq: "2,000 pcs" },
  { name: "Face Towel", style: "Hand Towel", size: "30×30 cm", moq: "3,000 pcs" },
  { name: "Kitchen Towel", style: "Hand Towel", size: "45×65 cm", moq: "2,500 pcs" },
  { name: "Beach Towel", style: "Bath Towel", size: "90×180 cm", moq: "600 pcs" },
  { name: "Throw Blanket", style: "Throw", size: "130×170 cm", moq: "500 pcs" },
  { name: "Knitted Throw", style: "Throw", size: "125×150 cm", moq: "400 pcs" },
  { name: "Bedding Set", style: "Bedding Set", size: "Queen", moq: "300 sets" },
  { name: "Duvet Cover", style: "Bedding Set", size: "220×240 cm", moq: "400 pcs" },
  { name: "Fitted Sheet", style: "Bedding Set", size: "160×200 cm", moq: "500 pcs" },
  { name: "Pillow Case", style: "Bedding Set", size: "50×75 cm", moq: "1,000 pcs" },
  { name: "Curtain Panel", style: "Curtain", size: "140×240 cm", moq: "800 pcs" },
  { name: "Sheer Curtain", style: "Curtain", size: "140×270 cm", moq: "600 pcs" },
  { name: "Scarf", style: "Scarf", size: "70×200 cm", moq: "1,500 pcs" },
  { name: "Silk Scarf", style: "Scarf", size: "90×90 cm", moq: "1,000 pcs" },
  { name: "Table Runner", style: "Throw", size: "40×180 cm", moq: "600 pcs" },
  { name: "Table Cloth", style: "Throw", size: "150×250 cm", moq: "500 pcs" },
  { name: "Napkin Set", style: "Throw", size: "45×45 cm", moq: "2,000 sets" },
  { name: "Apron", style: "Cushion Cover", size: "70×85 cm", moq: "1,000 pcs" },
  { name: "Tote Bag", style: "Cushion Cover", size: "38×42 cm", moq: "1,500 pcs" },
  { name: "Bathrobe", style: "Bath Towel", size: "L / XL", moq: "500 pcs" },
];

const STYLE_PRESETS = Array.from(new Set(PRODUCT_PRESETS.map((p) => p.style)));

function PodDetail() {
  const { id } = Route.useParams();
  const pod = usePod(id);
  const recosts = useRecostRequests();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addMenu, setAddMenu] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  const [kitOpen, setKitOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!addMenu) return;
    const onDoc = (e: MouseEvent) => {
      if (!addMenuRef.current?.contains(e.target as Node)) setAddMenu(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [addMenu]);

  if (!pod) {
    return (
      <AppShell>
        <div className="mx-auto max-w-[720px] rounded-lg border border-hairline bg-surface p-10 text-center">
          <p className="text-[14px] text-ink-500">POD "{id}" not found.</p>
          <Link to="/pods" className="mt-3 inline-block text-brand-700 hover:underline">
            ← Back to dashboard
          </Link>
        </div>
      </AppShell>
    );
  }

  const selectable = pod.articles.filter(
    (a) => a.status === "not_started" || a.status === "in_progress",
  );
  const canStart = selected.size > 0;

  const toggle = (aid: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(aid)) next.delete(aid);
      else next.add(aid);
      return next;
    });

  const toggleExpand = (aid: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(aid)) next.delete(aid);
      else next.add(aid);
      return next;
    });

  const toggleAll = () => {
    if (selected.size === selectable.length) setSelected(new Set());
    else setSelected(new Set(selectable.map((a) => a.id)));
  };

  const startCosting = () => {
    if (!canStart) return;
    const ids = pod.articles.filter((a) => selected.has(a.id)).map((a) => a.id);
    markArticlesInProgress(pod.id, ids);
    navigate({
      to: "/product/$podId/$articleId",
      params: { podId: pod.id, articleId: ids[0] },
      search: { sel: ids.join(",") },
    });
  };

  const hasRows = pod.articles.length > 0;

  return (
    <AppShell>
      <div className="w-full">
        <Link
          to="/pods"
          className="inline-flex items-center gap-1 text-[12px] text-ink-500 hover:text-ink-900"
        >
          <ArrowLeft className="h-3 w-3" /> Dashboard
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[22px] font-semibold tracking-tight text-ink-900">{pod.id}</h1>
              <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-700">
                {POD_STATUS_LABEL[pod.status]}
              </span>
              {/* An article sent back from a quotation puts the whole order in
                  a recosting round — said here, where the order is managed. */}
              {podHasRecostIn(recosts, pod.id) && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                  Recost / Requote
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-500">
              <span>
                Buyer <span className="text-ink-900">{pod.buyer}</span>
              </span>
              <span>
                Buyer Ref <span className="text-ink-900">{pod.buyerRef}</span>
              </span>
              <span>
                Prepared by <span className="text-ink-900">{pod.preparedBy}</span>
              </span>
              <span>
                Updated <span className="text-ink-900">{pod.updatedAt}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div ref={addMenuRef} className="relative">
              <button
                onClick={() => setAddMenu((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 py-2 text-[13px] text-ink-900 hover:bg-surface-alt"
              >
                <Plus className="h-4 w-4" /> Add
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 text-ink-400 transition-transform",
                    addMenu && "rotate-180",
                  )}
                />
              </button>
              {addMenu && (
                <div className="absolute right-0 z-30 mt-1 w-[260px] overflow-hidden rounded-md border border-hairline bg-surface shadow-lg">
                  <button
                    onClick={() => {
                      setAddMenu(false);
                      setLibOpen(true);
                    }}
                    className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-surface-alt"
                  >
                    <Package className="mt-0.5 h-4 w-4 text-ink-400" />
                    <span>
                      <span className="block text-[13px] font-medium text-ink-900">
                        Add Article
                      </span>
                      <span className="block text-[11px] text-ink-500">
                        Browse the Article Library or create new
                      </span>
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setAddMenu(false);
                      setKitOpen(true);
                    }}
                    className="flex w-full items-start gap-2.5 border-t border-hairline px-3 py-2.5 text-left hover:bg-surface-alt"
                  >
                    <Boxes className="mt-0.5 h-4 w-4 text-ink-400" />
                    <span>
                      <span className="block text-[13px] font-medium text-ink-900">Add Kit</span>
                      <span className="block text-[11px] text-ink-500">
                        Bedding set, dining set, gift set…
                      </span>
                    </span>
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={startCosting}
              disabled={!canStart}
              className="inline-flex items-center gap-1.5 rounded-md bg-ink-900 px-3 py-2 text-[13px] font-medium text-white hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Sparkles className="h-4 w-4" /> Start Costing
              {canStart && (
                <span className="ml-1 rounded-full bg-white/20 px-1.5 text-[11px] tabular-nums">
                  {selected.size}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-hairline bg-surface">
          <div className="flex items-center justify-between rounded-t-lg border-b border-hairline bg-surface-alt px-4 py-2.5">
            <div className="flex items-center gap-2 text-[12px]">
              <Package className="h-3.5 w-3.5 text-ink-400" />
              <span className="font-medium text-ink-900">Articles</span>
              <span className="text-ink-400">·</span>
              <span className="text-ink-500">
                {pod.articles.length} total
                {selectable.length > 0 ? ", select articles below to send for costing" : ""}
              </span>
            </div>
            {selectable.length > 0 && (
              <button onClick={toggleAll} className="text-[12px] text-brand-700 hover:underline">
                {selected.size === selectable.length ? "Clear selection" : "Select all costable"}
              </button>
            )}
          </div>

          {!hasRows ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-alt">
                <Package className="h-5 w-5 text-ink-400" />
              </div>
              <p className="mt-3 text-[13px] text-ink-500">
                No articles yet — start from the library or build a kit.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => setLibOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-ink-900 px-3 py-2 text-[13px] font-medium text-white hover:bg-ink-700"
                >
                  <Plus className="h-4 w-4" /> Add Article
                </button>
                <button
                  onClick={() => setKitOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 py-2 text-[13px] text-ink-900 hover:bg-surface-alt"
                >
                  <Boxes className="h-4 w-4" /> Add Kit
                </button>
              </div>
            </div>
          ) : (
            <table className="w-full text-[13px]">
              <thead className="border-b border-hairline text-[11px] uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="w-10 px-4 py-2.5" />
                  <th className="px-4 py-2.5 text-left font-medium">Product</th>
                  <th className="px-4 py-2.5 text-left font-medium">Type</th>
                  <th className="px-4 py-2.5 text-left font-medium">Size</th>
                  <th className="px-4 py-2.5 text-left font-medium">MOQ</th>
                  <th className="px-4 py-2.5 text-left font-medium">Style</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                  <th className="px-4 py-2.5 text-left font-medium">Updated</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {pod.articles.map((a) =>
                  editingId === a.id ? (
                    <ArticleEditRow
                      key={a.id}
                      podId={pod.id}
                      article={a}
                      onClose={() => setEditingId(null)}
                    />
                  ) : (
                    <ArticleRow
                      key={a.id}
                      podId={pod.id}
                      article={a}
                      selected={selected.has(a.id)}
                      expanded={expanded.has(a.id)}
                      onExpand={() => toggleExpand(a.id)}
                      onToggle={() => toggle(a.id)}
                      onEdit={() => setEditingId(a.id)}
                      onClone={() => cloneArticle(pod.id, a.id)}
                      onDelete={() => {
                        if (confirm(`Delete "${a.name}"?`)) deleteArticle(pod.id, a.id);
                        setSelected((s) => {
                          const n = new Set(s);
                          n.delete(a.id);
                          return n;
                        });
                      }}
                    />
                  ),
                )}
                {hasRows && (
                  <tr>
                    <td
                      colSpan={9}
                      className="border-t border-hairline bg-surface-alt/40 px-4 py-2"
                    >
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => setLibOpen(true)}
                          className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-700 hover:underline"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add article
                        </button>
                        <button
                          onClick={() => setKitOpen(true)}
                          className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-700 hover:underline"
                        >
                          <Boxes className="h-3.5 w-3.5" /> Add kit
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-lg border border-hairline bg-surface-alt/50 p-3 text-[12px] text-ink-500">
          <ClipboardCheck className="h-4 w-4 text-ink-400" />
          Selected articles will move to{" "}
          <span className="mx-1 font-medium text-ink-900">In Progress</span> and open in the AI Cost
          Intelligence Workspace. Unselected articles remain{" "}
          <span className="mx-1 font-medium text-ink-900">Not Started</span> and can be costed
          later.
        </div>
      </div>

      <ArticleLibraryDrawer
        open={libOpen}
        onClose={() => setLibOpen(false)}
        defaultBuyer={pod.buyer}
        onSubmit={(arts) =>
          addLibraryArticles(
            pod.id,
            arts.map((a) => ({
              name: a.name,
              description: `${a.articleNo} · ${a.buyerRef}`,
              size: a.size,
              moq: a.moq,
              style: a.style,
              image: a.image,
              libraryId: a.id,
              category: a.category,
              collection: a.collection,
              season: a.season,
              articleNo: a.articleNo,
              supplier: a.supplier,
              composition: a.composition,
              construction: a.construction,
              colour: a.colour,
              techPackRef: a.techPackRef,
              techPackVersion: a.version,
            })),
          )
        }
      />

      <AddKitDrawer
        open={kitOpen}
        onClose={() => setKitOpen(false)}
        defaultBuyer={pod.buyer}
        onCreate={(kit) => addKit(pod.id, kit)}
      />
    </AppShell>
  );
}

function ArticleRow({
  podId,
  article,
  selected,
  expanded,
  onExpand,
  onToggle,
  onEdit,
  onDelete,
  onClone,
}: {
  podId: string;
  article: Article;
  selected: boolean;
  expanded: boolean;
  onExpand: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClone: () => void;
}) {
  const costable = article.status === "not_started" || article.status === "in_progress";
  const isKit = article.type === "kit";
  const prog = kitProgress(article);
  // A quotation may be waiting on this article being re-costed. That belongs
  // on the costing team's own list, not only inside the quotation.
  const recost = useRecostRequest(podId, article.id);
  return (
    <>
      <tr
        className={cn(
          "border-b border-hairline hover:bg-surface-alt/40",
          selected && "bg-brand-50/40",
          expanded && "bg-surface-alt/30",
        )}
      >
        <td className="px-4 py-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            disabled={!costable}
            className="h-4 w-4 rounded border-hairline accent-brand-700 disabled:opacity-30"
          />
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            {isKit ? (
              <button
                onClick={onExpand}
                className="rounded p-1 text-ink-500 hover:bg-surface-alt hover:text-ink-900"
                aria-label={expanded ? "Collapse kit" : "Expand kit"}
              >
                <ChevronRight
                  className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-90")}
                />
              </button>
            ) : (
              <span className="w-[22px]" />
            )}
            {article.image ? (
              <img src={article.image} alt="" className="h-8 w-8 rounded object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded bg-ink-100 text-ink-400">
                <Package className="h-4 w-4" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-1.5 font-medium text-ink-900">
                {article.name}
                {article.techPackRef && (
                  <span className="rounded bg-brand-50 px-1 py-px text-[10px] text-brand-700">
                    Tech pack
                  </span>
                )}
              </div>
              {isKit ? (
                <div className="text-[11px] text-ink-400">
                  {prog.costed} of {prog.total} Articles Costed
                </div>
              ) : (
                article.description && (
                  <div className="text-[11px] text-ink-400">{article.description}</div>
                )
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <span
            className={cn(
              "inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-medium",
              isKit
                ? "border-violet-200 bg-violet-50 text-violet-700"
                : "border-sky-200 bg-sky-50 text-sky-700",
            )}
          >
            {isKit ? <Boxes className="h-3 w-3" /> : <Package className="h-3 w-3" />}
            {isKit ? "Kit" : "Article"}
          </span>
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-ink-700">{article.size}</td>
        <td className="whitespace-nowrap px-4 py-3 text-ink-700">{article.moq}</td>
        <td className="whitespace-nowrap px-4 py-3 text-ink-500">{article.style ?? "—"}</td>
        <td className="px-4 py-3">
          <span
            className={cn(
              "inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium",
              STATUS_TONE[article.status],
            )}
          >
            {ARTICLE_STATUS_LABEL[article.status]}
          </span>
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-ink-500">
          {recost ? (
            <span
              title={`${recost.reason} — asked by ${recost.quotationId}`}
              className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-amber-900"
            >
              {RECOSTING_LABEL}
            </span>
          ) : (
            article.updatedAt
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1">
            {article.status !== "not_started" && (
              <Link
                to="/config/$podId/$articleId"
                params={{ podId, articleId: article.id }}
                search={{ sel: undefined }}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-[12px] text-brand-700 hover:bg-brand-50"
              >
                Open <ArrowUpRight className="h-3 w-3" />
              </Link>
            )}
            <button
              onClick={onClone}
              className="rounded p-1.5 text-ink-500 hover:bg-surface-alt hover:text-ink-900"
              aria-label="Clone"
              title="Clone"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onEdit}
              className="rounded p-1.5 text-ink-500 hover:bg-surface-alt hover:text-ink-900"
              aria-label="Edit article"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDelete}
              className="rounded p-1.5 text-ink-500 hover:bg-danger-50 hover:text-danger-600"
              aria-label="Delete article"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      </tr>

      {isKit &&
        expanded &&
        (article.kitItems ?? []).map((it, i, arr) => (
          <tr
            key={it.id}
            className={cn("bg-surface-alt/25", i === arr.length - 1 && "border-b border-hairline")}
          >
            <td className="px-4" />
            <td className="py-2 pl-4 pr-4">
              <div className="flex items-stretch gap-3 pl-[10px]">
                <span className="relative block w-4 shrink-0" aria-hidden>
                  <span
                    className={cn(
                      "absolute left-0 top-0 w-px bg-ink-200",
                      i === arr.length - 1 ? "h-1/2" : "h-full",
                    )}
                  />
                  <span className="absolute left-0 top-1/2 block h-px w-4 bg-ink-200" />
                </span>
                {it.image ? (
                  <img src={it.image} alt="" className="h-7 w-7 self-center rounded object-cover" />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center self-center rounded bg-ink-100 text-ink-400">
                    <Package className="h-3.5 w-3.5" />
                  </div>
                )}
                <div className="min-w-0 self-center">
                  <div className="truncate text-[12.5px] font-medium text-ink-800">{it.name}</div>
                  <div className="text-[11px] text-ink-400">
                    ×{it.qty} per set{it.optional ? " · Optional" : ""}
                  </div>
                </div>
              </div>
            </td>
            <td className="whitespace-nowrap px-4 py-2 text-[11px] text-ink-400">Kit item</td>
            <td className="whitespace-nowrap px-4 py-2 text-[12px] text-ink-600">
              {it.size ?? "—"}
            </td>
            <td className="whitespace-nowrap px-4 py-2 text-[12px] text-ink-600">
              {it.moq ?? "—"}
            </td>
            <td className="px-4 py-2 text-[12px] text-ink-400">—</td>
            <td className="px-4 py-2">
              <span
                className={cn(
                  "inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium",
                  STATUS_TONE[it.status ?? "not_started"],
                )}
              >
                {ARTICLE_STATUS_LABEL[it.status ?? "not_started"]}
              </span>
            </td>
            <td className="px-4 py-2" />
            <td className="px-4 py-2" />
          </tr>
        ))}
    </>
  );
}

/* Inline draft rows were replaced by the Article Library / Add Kit drawers. */

function ArticleEditRow({
  podId,
  article,
  onClose,
}: {
  podId: string;
  article: Article;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: article.name,
    size: article.size,
    moq: article.moq,
    style: article.style ?? "",
  });
  const save = () => {
    updateArticle(podId, article.id, {
      name: form.name.trim() || article.name,
      size: form.size.trim(),
      moq: form.moq.trim(),
      style: form.style.trim() || undefined,
    });
    onClose();
  };
  return (
    <tr className="border-b border-hairline bg-amber-50/30">
      <td />
      <td className="px-4 py-2">
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full rounded-md border border-hairline bg-surface px-2 py-1.5 text-[13px]"
        />
      </td>
      <td className="px-4 py-2">
        <input
          value={form.size}
          onChange={(e) => setForm({ ...form, size: e.target.value })}
          className="w-full rounded-md border border-hairline bg-surface px-2 py-1.5 text-[13px]"
        />
      </td>
      <td className="px-4 py-2">
        <input
          value={form.moq}
          onChange={(e) => setForm({ ...form, moq: e.target.value })}
          className="w-full rounded-md border border-hairline bg-surface px-2 py-1.5 text-[13px]"
        />
      </td>
      <td className="px-4 py-2">
        <input
          list={`style-presets-edit-${podId}`}
          value={form.style}
          onChange={(e) => setForm({ ...form, style: e.target.value })}
          className="w-full rounded-md border border-hairline bg-surface px-2 py-1.5 text-[13px]"
        />
        <datalist id={`style-presets-edit-${podId}`}>
          {STYLE_PRESETS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </td>
      <td />
      <td />
      <td />

      <td className="px-4 py-2">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={save}
            className="rounded p-1.5 text-emerald-700 hover:bg-emerald-50"
            aria-label="Save"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="rounded p-1.5 text-ink-500 hover:bg-surface-alt"
            aria-label="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
