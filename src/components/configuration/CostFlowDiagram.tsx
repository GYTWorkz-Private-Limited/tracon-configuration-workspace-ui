// CostFlowDiagram — the cost network for the Configuration Workspace.
// Deterministic left-to-right swimlanes built from buildCostGraph(): what the
// manufacturing route is, where the money sits, and where the waste is.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Flame, Minus, Pencil, Plus, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { inr } from "@/lib/fabricConfig";
import type { CostGraph, CostNode, NodeKind } from "@/lib/costingGraph";
import type { DerivedRoute } from "@/lib/costingRoute";

type Metric = "cost" | "consumption" | "wastage";
type Rect = { x: number; y: number; w: number; h: number };

type Props = {
  graph: CostGraph;
  route: DerivedRoute;
  onOpenNode: (node: CostNode) => void;
  pulse?: string[];
  className?: string;
  /** lane indices to keep at full opacity; every other lane dims. null = show all. */
  focusLanes?: number[] | null;
};

const LANE_WIDTH = 216;
const LANE_GAP = 64;
const EM_DASH = "—";
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 1.4;
const ZOOM_STEP = 0.1;

const KIND: Record<NodeKind, { label: string; bar: string; chip: string; stroke: string }> = {
  material: {
    label: "Material",
    bar: "bg-brand-700",
    chip: "bg-brand-50 text-brand-800",
    stroke: "stroke-brand-700",
  },
  component: {
    label: "Component",
    bar: "bg-cfg",
    chip: "bg-cfg-soft text-cfg-strong",
    stroke: "stroke-cfg",
  },
  process: {
    label: "Process",
    bar: "bg-gold-600",
    chip: "bg-gold-50 text-gold-700",
    stroke: "stroke-gold-600",
  },
  trim: {
    label: "Trim",
    bar: "bg-brand-500",
    chip: "bg-brand-50 text-brand-700",
    stroke: "stroke-brand-500",
  },
  packaging: {
    label: "Packaging",
    bar: "bg-ink-500",
    chip: "bg-ink-50 text-ink-700",
    stroke: "stroke-ink-500",
  },
  rollup: {
    label: "Direct cost",
    bar: "bg-brand-900",
    chip: "bg-brand-100 text-brand-900",
    stroke: "stroke-brand-900",
  },
};

const LEGEND_ORDER: NodeKind[] = [
  "material",
  "component",
  "process",
  "trim",
  "packaging",
  "rollup",
];
/** border weight encodes share of direct cost */
const weightOf = (share: number) =>
  share >= 0.2 ? "border-[2.5px]" : share >= 0.08 ? "border-[1.75px]" : "border";

/** orthogonal elbow between the right edge of `a` and the left edge of `b` */
const elbowPath = (a: Rect, b: Rect): string => {
  const x1 = a.x + a.w;
  const y1 = a.y + a.h / 2;
  const x2 = b.x;
  const y2 = b.y + b.h / 2;
  const mx = x1 + (x2 - x1) / 2;
  const dy = y2 - y1;
  if (Math.abs(dy) < 1.5 || mx - x1 < 6) return `M ${x1} ${y1} L ${x2} ${y2}`;
  const dir = dy > 0 ? 1 : -1;
  const r = Math.min(12, Math.abs(dy) / 2, mx - x1, x2 - mx);
  return [
    `M ${x1} ${y1}`,
    `L ${mx - r} ${y1}`,
    `Q ${mx} ${y1} ${mx} ${y1 + r * dir}`,
    `L ${mx} ${y2 - r * dir}`,
    `Q ${mx} ${y2} ${mx + r} ${y2}`,
    `L ${x2} ${y2}`,
  ].join(" ");
};

const metricValue = (node: CostNode, metric: Metric): string => {
  if (metric === "cost") return node.cost > 0 ? inr(node.cost) : EM_DASH;
  if (metric === "consumption") return node.qtyRate ?? EM_DASH;
  return node.loss ?? EM_DASH;
};

export function CostFlowDiagram({ graph, route, onOpenNode, pulse, className, focusLanes }: Props) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef(new Map<string, HTMLElement>());
  const [rects, setRects] = useState<Record<string, Rect>>({});
  const [canvas, setCanvas] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const metric: Metric = "cost";
  const [hovered, setHovered] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const setNodeRef = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) nodeRefs.current.set(id, el);
      else nodeRefs.current.delete(id);
    },
    [],
  );

  /* ---- ref-based measurement: edges land on real card edges, never guesses.
   * Rects are normalised back to zoom=1 (logical) coordinates so the SVG
   * overlay — itself inside the scaled element — never double-scales. ---- */
  const measure = useCallback(() => {
    const host = canvasRef.current;
    if (!host) return;
    const base = host.getBoundingClientRect();
    const next: Record<string, Rect> = {};
    nodeRefs.current.forEach((el, id) => {
      const r = el.getBoundingClientRect();
      next[id] = {
        x: (r.left - base.left) / zoom,
        y: (r.top - base.top) / zoom,
        w: r.width / zoom,
        h: r.height / zoom,
      };
    });
    setRects(next);
    setCanvas({ w: host.scrollWidth, h: host.scrollHeight });
  }, [zoom]);

  useLayoutEffect(() => {
    measure();
  }, [measure, graph, metric]);

  useEffect(() => {
    const host = canvasRef.current;
    if (!host) return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(host);
    nodeRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [measure, graph]);

  /* ---- adjacency, for upstream / downstream highlighting ---- */
  const { up, down } = useMemo(() => {
    const upMap = new Map<string, string[]>();
    const downMap = new Map<string, string[]>();
    for (const e of graph.edges) {
      downMap.set(e.from, [...(downMap.get(e.from) ?? []), e.to]);
      upMap.set(e.to, [...(upMap.get(e.to) ?? []), e.from]);
    }
    return { up: upMap, down: downMap };
  }, [graph.edges]);

  const highlighted = useMemo(() => {
    if (!hovered) return null;
    const walk = (map: Map<string, string[]>) => {
      const seen = new Set<string>();
      const queue = [hovered];
      while (queue.length) {
        const id = queue.shift();
        if (!id) break;
        for (const next of map.get(id) ?? []) {
          if (seen.has(next)) continue;
          seen.add(next);
          queue.push(next);
        }
      }
      return seen;
    };
    return new Set<string>([hovered, ...walk(up), ...walk(down)]);
  }, [hovered, up, down]);

  const pulseSet = useMemo(() => new Set(pulse ?? []), [pulse]);
  const lanes = graph.lanes;
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  /* ---- no-zero-clutter: hide inactive / empty placeholder nodes; keep at
   * most one "not configured yet" ghost per lane so a lane is never a dead end ---- */
  const byLane = useMemo(
    () =>
      lanes.map((l) => {
        const all = graph.nodes.filter((n) => n.lane === l.index).sort((a, b) => a.row - b.row);
        if (l.index === 0 || l.index === lanes.length - 1) return all;
        const real = all.filter((n) => n.active && !(n.incomplete && n.cost <= 0));
        if (real.length) return real;
        const ghost = all.find((n) => n.active);
        return ghost ? [ghost] : [];
      }),
    [graph.nodes, lanes],
  );

  const focusSet = useMemo(() => (focusLanes ? new Set(focusLanes) : null), [focusLanes]);

  useEffect(() => {
    if (!focusLanes || !focusLanes.length) return;
    const host = scrollerRef.current;
    if (!host) return;
    const targetLane = Math.min(...focusLanes);
    const x = targetLane * (LANE_WIDTH + LANE_GAP) * zoom;
    host.scrollTo({ left: Math.max(0, x - LANE_GAP * zoom), behavior: "smooth" });
  }, [focusLanes, zoom]);

  const gridColumns = `repeat(${lanes.length}, ${LANE_WIDTH}px)`;
  const maxCumulative = Math.max(...graph.edges.map((e) => e.cumulative), graph.total, 0.0001);
  const rollupLane = lanes.length - 1;
  const zoomIn = () => setZoom((z) => Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 100) / 100));
  const zoomOut = () => setZoom((z) => Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 100) / 100));
  const zoomReset = () => setZoom(1);

  return (
    <section className={cn("relative rounded-2xl border border-hairline bg-surface", className)}>
      {/* ---- header: route, metric toggle, total ---- */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-hairline px-5 py-4">
        <div>
          <h3 className="text-[13px] font-semibold text-ink-900">Cost network</h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-ink-500">
            <span className="rounded-full bg-cfg-soft px-2 py-0.5 font-medium text-cfg-strong">
              {route.label}
            </span>
            <span>derived from the article — not selected</span>
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10.5px] uppercase tracking-[0.1em] text-ink-400">Direct cost</div>
          <div className="text-[20px] font-semibold leading-tight tabular-nums text-brand-700">
            {inr(graph.total)}
          </div>
        </div>
      </header>

      {/* ---- the diagram: horizontal scroll stays inside this box ---- */}
      <div ref={scrollerRef} className="overflow-x-auto overflow-y-hidden px-5 py-4">
        {/* sizer reserves the scaled scroll area — its own box is explicit
            pixels, not derived from the transformed child, so overflow-x-auto
            scrolls the right distance at every zoom level */}
        <div style={{ width: canvas.w * zoom || undefined, height: canvas.h * zoom || undefined }}>
          <div
            ref={canvasRef}
            className="relative"
            style={{
              minWidth: "max-content",
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
            }}
          >
            {/* edge layer, behind the cards */}
            <svg
              className="pointer-events-none absolute left-0 top-0 z-0"
              width={canvas.w}
              height={canvas.h}
              aria-hidden="true"
            >
              {graph.edges.map((edge) => {
                const a = rects[edge.from];
                const b = rects[edge.to];
                if (!a || !b) return null;
                const source = graph.nodes.find((n) => n.id === edge.from);
                const target = graph.nodes.find((n) => n.id === edge.to);
                const dim = highlighted
                  ? !(highlighted.has(edge.from) && highlighted.has(edge.to))
                  : focusSet
                    ? !(focusSet.has(source?.lane ?? -1) || focusSet.has(target?.lane ?? -1))
                    : false;
                const width = 1 + (edge.cumulative / maxCumulative) * 4;
                const isRollup = target?.lane === rollupLane;
                const mid = {
                  x: a.x + a.w + (b.x - (a.x + a.w)) / 2,
                  y: (a.y + a.h / 2 + b.y + b.h / 2) / 2,
                };
                return (
                  <g key={`${edge.from}->${edge.to}`} className={cn(dim && "opacity-15")}>
                    <path
                      d={elbowPath(a, b)}
                      fill="none"
                      strokeLinecap="round"
                      strokeWidth={width}
                      className={cn(KIND[edge.kind].stroke, "opacity-60")}
                    />
                    {isRollup && (
                      <text
                        x={mid.x}
                        y={mid.y - 5}
                        textAnchor="middle"
                        className="fill-ink-400 text-[9.5px] tabular-nums"
                      >
                        {inr(edge.cumulative)}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* lane headers, pinned */}
            <div
              className="sticky top-0 z-20 grid bg-surface pb-2"
              style={{ gridTemplateColumns: gridColumns, columnGap: `${LANE_GAP}px` }}
            >
              {lanes.map((lane) => (
                <div
                  key={lane.index}
                  className={cn(
                    "border-b pb-1.5 transition-colors",
                    focusSet && !focusSet.has(lane.index) ? "opacity-30" : "opacity-100",
                    focusSet?.has(lane.index) ? "border-brand-700" : "border-hairline",
                  )}
                >
                  <div
                    className={cn(
                      "text-[10px] uppercase tracking-[0.12em]",
                      focusSet?.has(lane.index) ? "font-semibold text-brand-700" : "text-ink-400",
                    )}
                  >
                    {String(lane.index)} · {lane.label}
                  </div>
                </div>
              ))}
            </div>

            {/* lane bodies */}
            <div
              className="relative z-10 grid items-start pt-4"
              style={{ gridTemplateColumns: gridColumns, columnGap: `${LANE_GAP}px` }}
            >
              {byLane.map((nodes, laneIndex) => (
                <div key={lanes[laneIndex].index} className="flex flex-col gap-3">
                  {nodes.map((node) => (
                    <NodeCard
                      key={node.id}
                      node={node}
                      metric={metric}
                      innerRef={setNodeRef(node.id)}
                      dimmed={
                        highlighted
                          ? !highlighted.has(node.id)
                          : focusSet
                            ? !focusSet.has(node.lane)
                            : false
                      }
                      pulsing={pulseSet.has(node.id)}
                      onHover={setHovered}
                      onOpen={onOpenNode}
                    />
                  ))}
                  {nodes.length === 0 && (
                    <div className="rounded-lg border border-dashed border-hairline px-3 py-4 text-[11px] text-ink-400">
                      Nothing in this lane
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ---- zoom control ---- */}
      <div className="absolute bottom-5 right-5 z-30 flex items-center gap-0.5 rounded-lg border border-hairline bg-surface p-0.5 shadow-md">
        <button
          type="button"
          onClick={zoomOut}
          disabled={zoom <= ZOOM_MIN}
          aria-label="Zoom out"
          className="rounded-md p-1.5 text-ink-600 hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={zoomReset}
          aria-label="Reset zoom to 100%"
          title="Reset zoom"
          className="min-w-[42px] rounded-md px-1.5 py-1.5 text-center text-[11.5px] font-medium tabular-nums text-ink-700 hover:bg-surface-alt"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={zoomIn}
          disabled={zoom >= ZOOM_MAX}
          aria-label="Zoom in"
          className="rounded-md p-1.5 text-ink-600 hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ---- legend ---- */}
      <footer className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hairline px-5 py-3">
        {LEGEND_ORDER.map((kind) => (
          <span key={kind} className="flex items-center gap-1.5 text-[11px] text-ink-500">
            <span className={cn("h-2 w-2 rounded-[2px]", KIND[kind].bar)} />
            {KIND[kind].label}
          </span>
        ))}
        <span className="ml-auto flex items-center gap-3 text-[11px] text-ink-400">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-[3px] border border-ink-300" />
            <ArrowRight className="h-3 w-3" />
            <span className="h-3 w-3 rounded-[3px] border-[2.5px] border-ink-400" />
            border weight = cost share
          </span>
          <span className="flex items-center gap-1">
            <Flame className="h-3 w-3 text-danger" /> top cost driver
          </span>
        </span>
      </footer>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Node card
 * ------------------------------------------------------------------ */

type CardProps = {
  node: CostNode;
  metric: Metric;
  innerRef: (el: HTMLElement | null) => void;
  dimmed: boolean;
  pulsing: boolean;
  onHover: (id: string | null) => void;
  onOpen: (node: CostNode) => void;
};

function NodeCard({ node, metric, innerRef, dimmed, pulsing, onHover, onOpen }: CardProps) {
  const kind = KIND[node.kind];
  const value = metricValue(node, metric);
  const sharePct = Math.round(node.share * 100);

  return (
    <button
      ref={innerRef}
      type="button"
      onClick={() => onOpen(node)}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(node.id)}
      onBlur={() => onHover(null)}
      className={cn(
        "group relative w-full overflow-hidden rounded-xl bg-surface p-3 text-left transition-all",
        node.active ? "border-hairline" : "border-dashed border-ink-200 bg-surface-alt",
        node.incomplete && node.active && "border-dashed border-ink-300",
        weightOf(node.share),
        dimmed ? "opacity-25" : "opacity-100",
        pulsing && "ring-2 ring-cfg ring-offset-2 ring-offset-surface",
        "hover:border-cfg hover:shadow-sm",
      )}
    >
      <span
        className={cn(
          "absolute left-0 top-0 h-full w-[3px]",
          node.active ? kind.bar : "bg-ink-200",
        )}
      />

      <div className="flex items-start justify-between gap-2 pl-1.5">
        <span
          className={cn(
            "text-[12px] font-semibold leading-tight",
            node.active ? "text-ink-900" : "text-ink-400",
          )}
        >
          {node.label}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {node.driver && <Flame className="h-3 w-3 text-danger" />}
          {node.share > 0 && (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[9.5px] font-medium tabular-nums",
                kind.chip,
              )}
            >
              {sharePct}%
            </span>
          )}
        </span>
      </div>

      {node.active ? (
        <>
          <p className="mt-1 pl-1.5 text-[10.5px] leading-snug text-ink-500">{node.spec}</p>
          {node.qtyRate && metric !== "consumption" && (
            <p className="mt-0.5 pl-1.5 text-[10.5px] tabular-nums text-ink-400">{node.qtyRate}</p>
          )}
          {node.loss && metric !== "wastage" && (
            <p className="mt-0.5 pl-1.5 text-[10.5px] font-medium tabular-nums text-warning">
              {node.loss}
            </p>
          )}
          <div
            className={cn(
              "mt-2 pl-1.5 font-semibold tabular-nums leading-none",
              metric === "cost" ? "text-[17px]" : "text-[13px]",
              node.incomplete ? "text-ink-300" : "text-ink-900",
            )}
          >
            {value}
          </div>
          {node.incomplete && (
            <span className="mt-1.5 flex items-center gap-1 pl-1.5 text-[10.5px] font-medium text-cfg-strong">
              <Pencil className="h-3 w-3" /> Configure
            </span>
          )}
        </>
      ) : (
        <p className="mt-1.5 flex items-start gap-1.5 pl-1.5 text-[10.5px] leading-snug text-ink-400">
          <Ban className="mt-px h-3 w-3 shrink-0" />
          {node.inactiveReason ?? "Not part of this route."}
        </p>
      )}
    </button>
  );
}
