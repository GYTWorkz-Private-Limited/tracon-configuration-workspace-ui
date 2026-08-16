// CostGraph — SVG + HTML hybrid rendering the cushion cover forward pass.
// Nodes are absolutely-positioned HTML cards on top of an SVG that draws
// clean orthogonal dotted connectors between columns.

import { useMemo, useRef, useState } from "react";
import { Minus, Plus, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EDGES,
  NODES,
  computeCushion,
  type CushionInputs,
  type GraphNode,
} from "@/lib/cushionCosting";

type Pt = { x: number; y: number };

const COL_X = [40, 260, 520, 780, 1020, 1240, 1500];
const NODE_W = 200;
const NODE_H = 62;
const ROW_H = 90;
const TOP_PAD = 40;
const CANVAS_W = 1720;
const CANVAS_H = 1000;

const KIND_COLOR: Record<string, { dot: string; ring: string }> = {
  "input-fabric": { dot: "bg-teal-500", ring: "ring-teal-100" },
  "input-making": { dot: "bg-indigo-500", ring: "ring-indigo-100" },
  "input-setup": { dot: "bg-slate-400", ring: "ring-slate-100" },
  "fabric-per-m": { dot: "bg-teal-500", ring: "ring-teal-100" },
  "cost-per-pc": { dot: "bg-teal-500", ring: "ring-teal-100" },
  group: { dot: "bg-indigo-500", ring: "ring-indigo-100" },
  overhead: { dot: "bg-amber-500", ring: "ring-amber-100" },
  fx: { dot: "bg-amber-500", ring: "ring-amber-100" },
  "target-margin": { dot: "bg-amber-500", ring: "ring-amber-100" },
  total: { dot: "bg-ink-900", ring: "ring-ink-100" },
  quote: { dot: "bg-emerald-500", ring: "ring-emerald-100" },
};

const EDGE_STROKE: Record<string, string> = {
  fabric: "#0EA5A0",
  making: "#6366F1",
  signal: "#F59E0B",
  output: "#10B981",
};

function nodeRightAnchor(n: GraphNode): Pt {
  return {
    x: COL_X[n.column] + NODE_W,
    y: TOP_PAD + n.row * ROW_H + NODE_H / 2,
  };
}
function nodeLeftAnchor(n: GraphNode): Pt {
  return {
    x: COL_X[n.column],
    y: TOP_PAD + n.row * ROW_H + NODE_H / 2,
  };
}

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 1.4;
const ZOOM_STEP = 0.1;
const ZOOM_DEFAULT = 0.75;

export function CostGraph({
  inputs,
  highlightedNodes,
  onNodeClick,
}: {
  inputs: CushionInputs;
  highlightedNodes?: string[];
  onNodeClick?: (nodeId: string) => void;
}) {
  const metrics = useMemo(() => computeCushion(inputs), [inputs]);
  const [hover, setHover] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(ZOOM_DEFAULT);
  const scrollRef = useRef<HTMLDivElement>(null);
  const highlightSet = useMemo(() => new Set(highlightedNodes ?? []), [highlightedNodes]);

  const clampZoom = (z: number) =>
    Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100));

  const isEdgeActive = (fromId: string, toId: string) =>
    !!hover && (hover === fromId || hover === toId);

  // Build orthogonal (H → V → H) paths so lines are strictly straight and linear.
  const paths = useMemo(() => {
    return EDGES.map((e) => {
      const from = NODES.find((n) => n.id === e.from);
      const to = NODES.find((n) => n.id === e.to);
      if (!from || !to) return null;
      const a = nodeRightAnchor(from);
      const b = nodeLeftAnchor(to);
      const midX = a.x + (b.x - a.x) / 2;
      const d = `M ${a.x} ${a.y} H ${midX} V ${b.y} H ${b.x}`;
      return { ...e, d };
    }).filter(Boolean) as Array<{ from: string; to: string; kind: string; d: string }>;
  }, []);

  return (
    <div className="relative rounded-2xl border border-hairline bg-white">
      {/* Zoom controls */}
      <div className="absolute bottom-14 right-3 z-20 flex items-center gap-1 rounded-lg border border-hairline bg-white/95 px-1 py-0.5 shadow-md backdrop-blur">
        <button
          type="button"
          onClick={() => setZoom((z) => clampZoom(z - ZOOM_STEP))}
          disabled={zoom <= ZOOM_MIN + 0.001}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-ink-600 hover:bg-surface-alt disabled:opacity-40"
          aria-label="Zoom out"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-[38px] text-center text-[11px] tabular-nums text-ink-600">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setZoom((z) => clampZoom(z + ZOOM_STEP))}
          disabled={zoom >= ZOOM_MAX - 0.001}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-ink-600 hover:bg-surface-alt disabled:opacity-40"
          aria-label="Zoom in"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <span className="mx-0.5 h-4 w-px bg-hairline" />
        <button
          type="button"
          onClick={() => setZoom(ZOOM_DEFAULT)}
          className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] text-ink-500 hover:bg-surface-alt hover:text-ink-900"
          aria-label="Fit"
        >
          <Maximize2 className="h-3 w-3" /> Fit
        </button>
      </div>

      <div
        ref={scrollRef}
        className="relative overflow-auto rounded-2xl bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.04),transparent_60%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.04),transparent_55%)]"
        style={{ height: Math.min(CANVAS_H * zoom + 60, 820) }}
      >
        <div
          style={{
            width: CANVAS_W * zoom,
            height: CANVAS_H * zoom,
          }}
        >
          <div
            className="relative"
            style={{
              width: CANVAS_W,
              height: CANVAS_H,
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
            }}
          >
            {/* Column headers */}
            <div className="absolute inset-x-0 top-0" style={{ height: 32 }}>
              {[
                "Inputs · rates + techpack",
                "Fabric ₹ / metre",
                "Cost ₹ / piece",
                "Cost groups",
                "Overhead",
                "Total ₹ / pc",
                "Quote $  (output)",
              ].map((label, i) => (
                <div
                  key={label}
                  className="absolute flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-500"
                  style={{ left: COL_X[i], top: 6, width: NODE_W }}
                >
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-semibold text-indigo-700 tabular-nums">
                    {i + 1}
                  </span>
                  <span className="truncate">{label}</span>
                </div>
              ))}
            </div>

            {/* SVG edges — thin dotted orthogonal connectors */}
            <svg
              className="absolute inset-0 pointer-events-none"
              width={CANVAS_W}
              height={CANVAS_H}
              viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
            >
              {paths.map((e, i) => {
                const active = isEdgeActive(e.from, e.to);
                const color = EDGE_STROKE[e.kind] ?? "#94A3B8";
                return (
                  <path
                    key={i}
                    d={e.d}
                    fill="none"
                    stroke={color}
                    strokeWidth={active ? 1.4 : 1}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="1 5"
                    opacity={hover ? (active ? 0.95 : 0.12) : 0.5}
                  />
                );
              })}
            </svg>

            {/* Nodes */}
            {NODES.map((n) => {
              const value = n.value(metrics, inputs);
              const color = KIND_COLOR[n.kind];
              const highlighted = highlightSet.has(n.id);
              const isHover = hover === n.id;
              const showBig = n.kind === "quote" || n.kind === "total";
              return (
                <button
                  key={n.id}
                  type="button"
                  onMouseEnter={() => setHover(n.id)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => onNodeClick?.(n.id)}
                  className={cn(
                    "absolute flex flex-col justify-center rounded-xl border border-hairline bg-white px-3 py-2 text-left shadow-sm transition-all",
                    "hover:-translate-y-0.5 hover:shadow-md ring-2 ring-transparent",
                    isHover && "ring-brand-200 border-brand-300",
                    highlighted &&
                      "border-brand-400 shadow-[0_0_0_3px_rgba(16,185,129,0.15)] animate-pulse",
                    n.kind === "quote" && "border-emerald-300 bg-emerald-50",
                    n.kind === "total" && "border-ink-900 bg-ink-900 text-white",
                  )}
                  style={{
                    left: COL_X[n.column],
                    top: TOP_PAD + n.row * ROW_H,
                    width: NODE_W,
                    height: showBig ? NODE_H + 16 : NODE_H,
                  }}
                  title={n.formula ? n.formula(inputs) : undefined}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={cn("h-1.5 w-1.5 rounded-full", color.dot)} />
                    <span
                      className={cn(
                        "text-[10.5px] font-medium uppercase tracking-[0.08em]",
                        n.kind === "total" ? "text-white/70" : "text-ink-500",
                      )}
                    >
                      {n.label}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "mt-0.5 font-semibold tabular-nums",
                      showBig ? "text-[19px]" : "text-[14.5px]",
                      n.kind === "total" ? "text-white" : "text-ink-900",
                    )}
                  >
                    {n.format(value)}
                  </div>
                  {n.sub && (
                    <div
                      className={cn(
                        "text-[10.5px]",
                        n.kind === "total" ? "text-white/60" : "text-ink-400",
                      )}
                    >
                      {n.sub}
                    </div>
                  )}
                  {isHover && n.formula && (
                    <div className="absolute left-0 top-full z-10 mt-1 w-[220px] rounded-md border border-hairline bg-white px-2 py-1.5 text-[10.5px] text-ink-600 shadow-lg">
                      {n.formula(inputs)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 border-t border-hairline bg-white px-4 py-2.5 text-[11px] text-ink-500">
        <LegendDot color="#0EA5A0" label="fabric path" />
        <LegendDot color="#6366F1" label="making path" />
        <LegendDot color="#F59E0B" label="overhead / FX / margin" />
        <LegendDot color="#10B981" label="output (quote)" />
        <span className="ml-auto italic">
          dotted connectors · hover any node for math · zoom to explore
        </span>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-[3px] w-6 rounded-full"
        style={{
          background: `repeating-linear-gradient(90deg, ${color} 0 2px, transparent 2px 6px)`,
        }}
      />
      <span>{label}</span>
    </span>
  );
}
