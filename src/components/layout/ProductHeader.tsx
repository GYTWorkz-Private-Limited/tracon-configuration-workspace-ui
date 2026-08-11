import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { ARTICLE_STATUS_LABEL, type Article } from "@/lib/podsStore";
import { cn } from "@/lib/utils";

/**
 * Compact persistent product header — thumbnail, product identity line,
 * metadata line, running total cost, then the page's own actions.
 * Image upload is UI-only (local preview, no persistence).
 */
export function ProductHeader({
  pod,
  article,
  totalCost,
  backTo,
  mounted = true,
  children,
}: {
  pod: { id: string; buyer: string; buyerRef: string };
  article: Article;
  /** Preformatted running cost, e.g. "INR 247.70". */
  totalCost: string;
  backTo?: React.ReactNode;
  /** Guard status text against hydration mismatch when the store is client-only. */
  mounted?: boolean;
  children?: React.ReactNode;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const image = preview ?? article.image;

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPreview(URL.createObjectURL(file));
    e.target.value = "";
  };

  return (
    <header className="shrink-0 border-b border-hairline bg-surface px-6 py-3 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          {backTo}

          {/* Thumbnail / upload placeholder */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              aria-label={image ? "Replace product image" : "Upload product image"}
              className={cn(
                "flex h-12 w-12 items-center justify-center overflow-hidden rounded-md border bg-surface-alt",
                image ? "border-hairline" : "border-dashed border-ink-300 text-ink-400 hover:text-ink-700",
              )}
            >
              {image ? (
                <img src={image} alt={article.name} className="h-full w-full object-cover" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </button>
            {image && (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                aria-label="Replace product image"
                className="absolute -bottom-1 -right-1 rounded-full border border-hairline bg-surface p-0.5 text-ink-500 shadow-sm hover:text-ink-900"
              >
                <Pencil className="h-2.5 w-2.5" />
              </button>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={pick}
              className="hidden"
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="truncate text-[18px] font-semibold tracking-tight text-ink-900">
                {article.name}
              </h1>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-700">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-700" aria-hidden />
                {mounted ? ARTICLE_STATUS_LABEL[article.status] : ""}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-ink-500">
              <span className="rounded bg-surface-alt px-1.5 py-0.5 text-ink-600"># {article.articleNo ?? article.id}</span>
              <span className="rounded bg-surface-alt px-1.5 py-0.5 text-ink-600"># {pod.id}</span>
              <Meta label="Size" value={article.size || "—"} />
              <Dot />
              <Meta label="MOQ" value={article.moq || "—"} />
              <Dot />
              <Meta label="Currency" value={article.currency || "—"} />
              <Dot />
              <Meta label="Buyer" value={pod.buyer} />
              <Dot />
              <span>last updated {article.updatedAt}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="text-right">
            <div className="text-[11px] text-ink-400">Total Cost</div>
            <div className="text-[17px] font-semibold tabular-nums text-ink-900">{totalCost}</div>
          </div>
          {children}
        </div>
      </div>
    </header>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span>
      {label}: <span className="font-medium text-ink-900">{value}</span>
    </span>
  );
}

function Dot() {
  return <span className="text-ink-300">·</span>;
}
