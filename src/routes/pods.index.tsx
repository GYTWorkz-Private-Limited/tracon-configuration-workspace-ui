import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, ArrowUpRight, MoreHorizontal } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import {
  usePods,
  articleProgress,
  POD_STATUS_LABEL,
  type Pod,
  type PodStatus,
} from "@/lib/podsStore";
import { podHasRecostIn, useRecostRequests } from "@/lib/recostingStore";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pods/")({
  head: () => ({
    meta: [
      { title: "Costing Dashboard · Tracon" },
      {
        name: "description",
        content: "Track costing PODs across buyers, articles, and approval stages.",
      },
    ],
  }),
  component: PodsDashboard,
});

/**
 * Where "Open" on a POD actually lands.
 *
 * A POD that already has an article being costed has somewhere real to go —
 * straight into that article's Configuration & Costing sheet, every article
 * on the POD reachable from its tabs. Routing through the setup page first
 * would make the user re-pick a template and re-select articles they already
 * chose the last time they opened this POD.
 *
 * Only a POD where nothing has been started yet — no article past
 * "not_started" — has no config screen to jump into, so that one still opens
 * on the setup page, where a template gets chosen and articles get picked for
 * the first time.
 */
function openTargetFor(pod: Pod) {
  const started = pod.articles.find((a) => a.status !== "not_started");
  if (!started) return { to: "/pods/$id" as const, params: { id: pod.id } };
  return {
    to: "/config/$podId/$articleId" as const,
    params: { podId: pod.id, articleId: started.id },
    search: { sel: pod.articles.map((a) => a.id).join(",") },
  };
}

/**
 * The dashboard's status is the ANSWER to "what is this order waiting on",
 * so a live recosting ask overrides whatever stage the POD was stored at —
 * an approved order with an article sent back is waiting on costing, not on
 * approval.
 */
const STATUS_TONE: Record<PodStatus, string> = {
  in_progress: "bg-brand-50 text-brand-700",
  pending_approval: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  // Red, deliberately not amber: "waiting on an approver" and "sent back"
  // must not read the same at a glance.
  recosting: "bg-red-50 text-red-700",
};

function PodsDashboard() {
  const pods = usePods();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | PodStatus>("all");
  const recosts = useRecostRequests();
  const statusOf = (p: { id: string; status: PodStatus }): PodStatus =>
    podHasRecostIn(recosts, p.id) ? "recosting" : p.status;

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return pods.filter((p) => {
      if (status !== "all" && statusOf(p) !== status) return false;
      if (!term) return true;
      return (
        p.id.toLowerCase().includes(term) ||
        p.buyerRef.toLowerCase().includes(term) ||
        p.buyer.toLowerCase().includes(term) ||
        p.owner.toLowerCase().includes(term) ||
        p.articles.some((a) => a.name.toLowerCase().includes(term))
      );
    });
  }, [pods, q, status, recosts]);

  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-ink-900">
              Costing Dashboard
            </h1>
            <p className="mt-1 text-[13px] text-ink-500">
              PODs bundle buyer articles into a single costing brief. Open one to add articles and
              start costing.
            </p>
          </div>
          <button
            onClick={() => navigate({ to: "/pods/new" })}
            className="inline-flex items-center gap-2 rounded-md bg-ink-900 px-3 py-2 text-[13px] font-medium text-white hover:bg-ink-700"
          >
            <Plus className="h-4 w-4" /> New Costing
          </button>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <div className="flex flex-1 min-w-[280px] items-center gap-2 rounded-md border border-hairline bg-surface px-3 py-2">
            <Search className="h-4 w-4 text-ink-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search PODs, buyers, articles, buyer refs…"
              className="flex-1 bg-transparent text-[13px] text-ink-900 placeholder:text-ink-400 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-1 rounded-md border border-hairline bg-surface p-1">
            {(["all", "in_progress", "pending_approval", "approved", "recosting"] as const).map(
              (s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={cn(
                    "rounded px-2.5 py-1 text-[12px] transition-colors",
                    status === s ? "bg-ink-900 text-white" : "text-ink-500 hover:text-ink-900",
                  )}
                >
                  {s === "all" ? "All" : POD_STATUS_LABEL[s]}
                </button>
              ),
            )}
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-hairline bg-surface">
          <table className="w-full text-[13px]">
            <thead className="border-b border-hairline bg-surface-alt text-[11px] uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">POD Ref</th>
                <th className="px-4 py-3 text-left font-medium">Buyer Ref</th>
                <th className="px-4 py-3 text-left font-medium">Buyer</th>
                <th className="px-4 py-3 text-left font-medium">Articles</th>
                <th className="px-4 py-3 text-left font-medium">Progress</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Owner</th>
                <th className="px-4 py-3 text-left font-medium">Updated</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const { costed, total } = articleProgress(p);
                const pct = total ? (costed / total) * 100 : 0;
                return (
                  <tr
                    key={p.id}
                    className="border-b border-hairline last:border-0 hover:bg-surface-alt/50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        {...openTargetFor(p)}
                        className="font-medium text-ink-900 hover:text-brand-700"
                      >
                        {p.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-700">{p.buyerRef}</td>
                    <td className="px-4 py-3 text-ink-900">{p.buyer}</td>
                    <td className="px-4 py-3 text-ink-500">
                      {total} {total === 1 ? "article" : "articles"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-ink-100">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="tabular-nums text-ink-500">
                          {costed}/{total} Costed
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-medium",
                          STATUS_TONE[statusOf(p)],
                        )}
                      >
                        {POD_STATUS_LABEL[statusOf(p)]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-700">{p.owner}</td>
                    <td className="px-4 py-3 text-ink-500">{p.updatedAt}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        {...openTargetFor(p)}
                        className="inline-flex items-center gap-1 text-brand-700 hover:underline"
                      >
                        Open <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-ink-400">
                    No PODs match your filters.
                    <button
                      onClick={() => navigate({ to: "/pods/new" })}
                      className="ml-2 text-brand-700 hover:underline"
                    >
                      Create one →
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

// silence unused import warning in older lints
void MoreHorizontal;
