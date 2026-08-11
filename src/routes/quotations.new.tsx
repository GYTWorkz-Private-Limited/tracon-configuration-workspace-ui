import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Layers, Package } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { cn } from "@/lib/utils";
import { ARTICLE_STATUS_LABEL, usePods } from "@/lib/podsStore";
import { createQuotation, draftForPod, quotationsForPod } from "@/lib/quotationsStore";

export const Route = createFileRoute("/quotations/new")({
  head: () => ({
    meta: [
      { title: "New quotation · Tracon" },
      {
        name: "description",
        content: "Create a quotation for a POD and add any mix of articles, sets and kits.",
      },
    ],
  }),
  component: NewQuotation,
});

function NewQuotation() {
  const pods = usePods();
  const navigate = useNavigate();
  const [podId, setPodId] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const pod = useMemo(() => pods.find((p) => p.id === podId), [pods, podId]);
  const existingDraft = podId ? draftForPod(podId) : undefined;

  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };

  const create = () => {
    if (!podId) return;
    const q = createQuotation({ podId, articleIds: Array.from(picked) });
    navigate({ to: "/quotations/$id", params: { id: q.id } });
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1100px]">
        <Link
          to="/quotations"
          className="inline-flex items-center gap-1.5 text-[12px] text-ink-400 hover:text-ink-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Quotations
        </Link>

        <h1 className="mt-3 text-[26px] leading-tight tracking-[-0.02em] text-ink-900">
          New quotation
        </h1>
        <p className="mt-1 max-w-[640px] text-[13px] text-ink-500">
          Pick the POD, then add any combination of articles, sets and kits. You are not limited to
          items already flagged for quotation — anything with a costing reference can be quoted.
        </p>

        {/* Step 1 — POD */}
        <section className="mt-6">
          <StepHeading n={1} title="Choose the POD" done={Boolean(podId)} />
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {pods.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => {
                    setPodId(p.id);
                    setPicked(new Set());
                  }}
                  className={cn(
                    "w-full rounded-lg border px-3.5 py-3 text-left transition-colors",
                    podId === p.id
                      ? "border-brand-600 bg-brand-50/40"
                      : "border-hairline bg-surface hover:bg-surface-alt",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-ink-900">{p.id}</span>
                    {quotationsForPod(p.id).length > 0 && (
                      <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-600">
                        {quotationsForPod(p.id).length} quote
                        {quotationsForPod(p.id).length === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[12px] text-ink-600">{p.buyer}</div>
                  <div className="text-[11.5px] text-ink-400">
                    {p.buyerRef} · {p.articles.length} article
                    {p.articles.length === 1 ? "" : "s"}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Step 2 — items */}
        {pod && (
          <section className="mt-8">
            <StepHeading n={2} title="Add articles, sets and kits" done={picked.size > 0} />

            {existingDraft && (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="min-w-0 flex-1 text-[12.5px] text-amber-900">
                  {pod.id} already has an open quotation —{" "}
                  <strong className="font-semibold">{existingDraft.id}</strong> (v
                  {existingDraft.version}). Adding items there keeps everything on one quote.
                </p>
                <Link
                  to="/quotations/$id"
                  params={{ id: existingDraft.id }}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-ink-900 px-3 py-2 text-[12.5px] font-medium text-white hover:bg-ink-700"
                >
                  Open {existingDraft.id} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}

            <ul className="mt-3 space-y-2">
              {pod.articles.map((a) => {
                const checked = picked.has(a.id);
                const isKit = a.type === "kit";
                return (
                  <li key={a.id}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 transition-colors",
                        checked
                          ? "border-brand-600 bg-brand-50/30"
                          : "border-hairline bg-surface hover:bg-surface-alt",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(a.id)}
                        className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-brand-700)]"
                      />
                      {a.image ? (
                        <img
                          src={a.image}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-md border border-hairline object-cover"
                        />
                      ) : (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-alt text-ink-400">
                          {isKit ? <Layers className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[13px] font-semibold text-ink-900">{a.name}</span>
                          {isKit && (
                            <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-brand-700">
                              Kit · {a.kitItems?.length ?? 0} items
                            </span>
                          )}
                          <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-600">
                            {ARTICLE_STATUS_LABEL[a.status]}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-[11.5px] text-ink-500">
                          {a.size} · MOQ {a.moq} · {a.srfRef}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Create */}
        <div className="sticky bottom-0 mt-8 flex flex-wrap items-center gap-3 border-t border-hairline bg-canvas/95 py-4 backdrop-blur">
          <p className="text-[12.5px] text-ink-500">
            {pod
              ? `${pod.id} · ${picked.size} item${picked.size === 1 ? "" : "s"}`
              : "Pick a POD to continue"}
          </p>
          <button
            disabled={!podId}
            onClick={create}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Create quotation <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </AppShell>
  );
}

function StepHeading({ n, title, done }: { n: number; title: string; done: boolean }) {
  return (
    <h2 className="flex items-center gap-2 text-[14px] font-semibold text-ink-900">
      <span
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold",
          done ? "bg-brand-700 text-white" : "bg-ink-100 text-ink-500",
        )}
        aria-hidden
      >
        {done ? <Check className="h-3 w-3" strokeWidth={3} /> : n}
      </span>
      {title}
    </h2>
  );
}
