import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Sparkles, ZoomIn, ZoomOut, Maximize2, Hand } from "lucide-react";
import { cn } from "@/lib/utils";
import { FlowEdges, sameFlowLines, type FlowLine } from "@/components/flow/FlowEdges";
import {
  FABRIC_CARDS,
  SECTIONS,
  computeConfig,
  inr,
  type CardDef,
  type ConfigState,
  type SectionDef,
} from "@/lib/fabricConfig";

type Props = {
  state: ConfigState;
  cards?: CardDef[];
  sections?: SectionDef[];
  totalLabel?: string;
  /** module totals may legitimately be ₹0.00 (embroidery / washing) */
  zeroTotals?: boolean;
  /** total-card AI insight; omit to hide it */
  insight?: { text: string; savings?: string } | null;
  /** display values for readonly cards fed from outside (summary module) */
  readonlyValues?: Record<string, string>;
  /** replaces the grand-total card body (summary module) */
  totalOverride?: {
    heading: string;
    value: string;
    rows: { label: string; value: string }[];
    status?: string;
  };
  /** readonly cards are clickable (summary module) */
  readonlyClickable?: boolean;
  /** lay the flow out as a wrapping diagonal staircase instead of one long row */
  diagonal?: boolean;
  /** columns per staircase row when diagonal */
  perRow?: number;
  activeCardId: string | null;
  onOpenCard: (id: string) => void;
  pulse: string[];

};

type Line = FlowLine;

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

const sameLines = sameFlowLines;


const FABRIC_INSIGHT = {
  text: "Switching to Mafatlal Mills at ₹137.50 / m keeps the same quality band and saves about ₹2.45 per piece at MOQ 4,800.",
  savings: "Potential savings ₹2.45 / pc",
};

export function ConfigCanvas({
  state,
  cards: cardDefs = FABRIC_CARDS,
  sections = SECTIONS,
  totalLabel = "Fabric total",
  zeroTotals = false,
  insight = FABRIC_INSIGHT,
  readonlyValues,
  totalOverride,
  readonlyClickable = false,
  diagonal = false,
  perRow = 4,
  activeCardId,
  onOpenCard,
  pulse,
}: Props) {
  const metrics = useMemo(() => computeConfig(state, cardDefs), [state, cardDefs]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});
  const [lines, setLines] = useState<Line[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hoverId, setHoverId] = useState<string | null>(null);


  const [zoom, setZoom] = useState(0.96);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const viewRef = useRef({ zoom: 0.96, offset: { x: 0, y: 0 } });
  viewRef.current = { zoom, offset };

  const columns = useMemo(
    () =>
      sections.map((s) => ({
        section: s,
        cards: cardDefs.filter((c) => c.section === s.id),
      })),
    [sections, cardDefs],
  );

  const rows = useMemo(() => {
    if (!diagonal) return [columns];
    const out: (typeof columns)[] = [];
    for (let i = 0; i < columns.length; i += perRow) out.push(columns.slice(i, i + perRow));
    return out;
  }, [columns, diagonal, perRow]);


  const isConfigured = useCallback(
    (c: CardDef) =>
      c.kind === "readonly" ? metricReady(c, metrics, readonlyValues) : Boolean(state[c.id]),
    [state, metrics, readonlyValues],
  );

  const measure = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;
    const k = viewRef.current.zoom || 1;
    const box = content.getBoundingClientRect();
    const nextSize = { w: Math.round(box.width / k), h: Math.round(box.height / k) };

    // ids of the connectable (configured) nodes per column; grand total is one node
    const colNodes = columns.map(({ section, cards }) =>
      section.id === "grand"
        ? metrics.grandTotal > 0 || zeroTotals || Boolean(totalOverride)
          ? ["__grand"]
          : []
        : cards.filter(isConfigured).map((c) => c.id),
    );

    const next: Line[] = [];
    for (let i = 0; i < colNodes.length - 1; i++) {
      const from = colNodes[i];
      const to = colNodes[i + 1];
      if (!from.length || !to.length) continue;
      for (const fId of from) {
        const fe = cardRefs.current[fId];
        if (!fe) continue;
        const fr = fe.getBoundingClientRect();
        for (const tId of to) {
          const te = cardRefs.current[tId];
          if (!te) continue;
          const tr = te.getBoundingClientRect();
          next.push({
            from: fId,
            to: tId,
            x1: Math.round((fr.right - box.left) / k),
            y1: Math.round((fr.top + fr.height / 2 - box.top) / k),
            x2: Math.round((tr.left - box.left) / k),
            y2: Math.round((tr.top + tr.height / 2 - box.top) / k),
          });

        }
      }
    }
    setSize((prev) => (prev.w === nextSize.w && prev.h === nextSize.h ? prev : nextSize));
    setLines((prev) => (sameLines(prev, next) ? prev : next));
  }, [columns, isConfigured, metrics.grandTotal, zeroTotals]);

  /** every node reachable downstream from the hovered card, ending at the grand total */
  const flow = useMemo(() => {
    if (!hoverId) return { nodes: new Set<string>(), edges: new Set<number>() };
    const nodes = new Set<string>([hoverId]);
    const edges = new Set<number>();
    let frontier = [hoverId];
    while (frontier.length) {
      const nextFrontier: string[] = [];
      lines.forEach((l, i) => {
        if (!frontier.includes(l.from) || edges.has(i)) return;
        edges.add(i);
        if (!nodes.has(l.to)) {
          nodes.add(l.to);
          nextFrontier.push(l.to);
        }
      });
      frontier = nextFrontier;
    }
    return { nodes, edges };
  }, [hoverId, lines]);


  useLayoutEffect(() => {
    measure();
  }, [measure, zoom]);

  useEffect(() => {
    const ro = new ResizeObserver(() => measure());
    if (contentRef.current) ro.observe(contentRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  // wheel zoom anchored at the cursor (non-passive listener)
  const wheelRef = useRef<(e: WheelEvent) => void>(() => {});
  wheelRef.current = (e: WheelEvent) => {
    const el = viewportRef.current;
    if (!el) return;
    const { zoom: z, offset: o } = viewRef.current;
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
    const next = clamp(z * Math.exp(-dy * 0.0018), MIN_ZOOM, MAX_ZOOM);
    if (next === z) return;
    const rect = el.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const k = next / z;
    setOffset({ x: px - (px - o.x) * k, y: py - (py - o.y) * k });
    setZoom(next);
  };

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      wheelRef.current(e);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const zoomAtCenter = (factor: number) => {
    const el = viewportRef.current;
    if (!el) return;
    const { zoom: z, offset: o } = viewRef.current;
    const next = clamp(z * factor, MIN_ZOOM, MAX_ZOOM);
    if (next === z) return;
    const rect = el.getBoundingClientRect();
    const px = rect.width / 2;
    const py = rect.height / 2;
    const k = next / z;
    setOffset({ x: px - (px - o.x) * k, y: py - (py - o.y) * k });
    setZoom(next);
  };

  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, input, a")) return;
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    setPanning(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setOffset({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) });
  };
  const endPan = () => {
    drag.current = null;
    setPanning(false);
  };

  return (
    <div className="relative h-full overflow-hidden bg-canvas">
      <div
        ref={viewportRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        className={cn(
          "absolute inset-0 touch-none select-none",
          panning ? "cursor-grabbing" : "cursor-grab",
        )}
        style={{
          backgroundImage: "radial-gradient(var(--color-ink-200) 1px, transparent 1px)",
          backgroundSize: `${22 * zoom}px ${22 * zoom}px`,
          backgroundPosition: `${offset.x}px ${offset.y}px`,
        }}
      >
        <div
          ref={contentRef}
          className="absolute left-0 top-0 origin-top-left"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
        >
          <div className="relative p-8">
            <svg
              className="pointer-events-none absolute left-0 top-0"
              width={Math.max(size.w, 0)}
              height={Math.max(size.h, 0)}
              aria-hidden
            >
              <FlowEdges
                lines={lines}
                activeEdges={flow.edges}
                hovering={hoverId !== null}
                idPrefix="cfg"
              />

            </svg>


            <div
              className={cn(
                "relative flex min-w-max",
                diagonal ? "flex-col gap-9" : "items-start gap-7",
              )}
            >
              {rows.map((row, ri) => (
                <div key={ri} className="flex items-start gap-7">
                  {row.map(({ section, cards }, j) => (
                    <div
                      key={section.id}
                      className="w-[284px] shrink-0"
                      style={diagonal ? { marginTop: j * 46 } : undefined}
                    >
                      <div className="mb-3 flex items-baseline gap-2">
                        <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-500">
                          {section.label}
                        </h3>

                        {section.readOnly && (
                          <span className="text-[10px] uppercase tracking-[0.1em] text-ink-300">
                            read only
                          </span>
                        )}
                      </div>

                      {section.id === "grand" ? (
                        <GrandTotalCard
                          totalLabel={totalLabel}
                          zeroTotals={zeroTotals}
                          insight={insight}
                          override={totalOverride}
                          metrics={metrics}
                          pulsing={pulse.length > 0}
                          inFlow={flow.nodes.has("__grand")}
                          dimmed={hoverId !== null && !flow.nodes.has("__grand")}
                          ref={(el) => {
                            cardRefs.current["__grand"] = el;
                          }}
                        />
                      ) : (
                        <div className="flex flex-col gap-2.5">
                          {cards.map((c) => (
                            <SummaryCard
                              key={c.id}
                              ref={(el) => {
                                cardRefs.current[c.id] = el;
                              }}
                              card={c}
                              state={state}
                              metrics={metrics}
                              readonlyValues={readonlyValues}
                              readonlyClickable={readonlyClickable}
                              active={activeCardId === c.id}
                              pulsing={pulse.includes(c.id)}
                              inFlow={flow.nodes.has(c.id)}
                              dimmed={hoverId !== null && !flow.nodes.has(c.id)}
                              onHover={(on) => setHoverId(on ? c.id : null)}
                              onClick={() => onOpenCard(c.id)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>

      {/* Zoom / pan controls */}
      <div className="pointer-events-auto absolute bottom-4 left-4 flex items-center gap-1 rounded-lg border border-hairline bg-surface p-1 shadow-sm">
        <button
          onClick={() => zoomAtCenter(1 / 1.2)}
          aria-label="Zoom out"
          className="rounded-md p-1.5 text-ink-500 hover:bg-surface-alt hover:text-ink-900"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="w-11 text-center text-[12px] tabular-nums text-ink-600">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => zoomAtCenter(1.2)}
          aria-label="Zoom in"
          className="rounded-md p-1.5 text-ink-500 hover:bg-surface-alt hover:text-ink-900"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <span className="mx-0.5 h-4 w-px bg-hairline" />
        <button
          onClick={() => {
            setZoom(0.96);
            setOffset({ x: 0, y: 0 });
          }}
          aria-label="Reset view"
          className="rounded-md p-1.5 text-ink-500 hover:bg-surface-alt hover:text-ink-900"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-5 right-5 inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface/90 px-2.5 py-1 text-[11.5px] text-ink-400">
        <Hand className="h-3 w-3" /> Drag to pan · scroll to zoom
      </div>
    </div>
  );
}

function metricReady(
  c: CardDef,
  m: ReturnType<typeof computeConfig>,
  readonlyValues?: Record<string, string>,
) {
  if (readonlyValues?.[c.id] !== undefined) return true;
  if (!c.metric) return false;
  if (c.zeroOk) return true;
  return m[c.metric] > 0;
}

function metricLabel(
  c: CardDef,
  m: ReturnType<typeof computeConfig>,
  readonlyValues?: Record<string, string>,
) {
  const supplied = readonlyValues?.[c.id];
  if (supplied !== undefined) return supplied;
  switch (c.metric) {
    case "consumption":
    case "requiredMeter":
      return m[c.metric] ? `${m[c.metric].toFixed(3)} mtr` : "—";
    case "fabricPerM":
      return m.fabricPerM ? `${inr(m.fabricPerM)} / m` : "—";
    case "costPerPiece":
      return c.zeroOk || m.costPerPiece ? `${inr(m.costPerPiece)} / pc` : "—";
    case "fabricTotal":
      return c.zeroOk || m.fabricTotal ? inr(m.fabricTotal) : "—";
    default:
      return "—";
  }
}

const SummaryCard = forwardRef<
  HTMLButtonElement,
  {
    card: CardDef;
    state: ConfigState;
    metrics: ReturnType<typeof computeConfig>;
    readonlyValues?: Record<string, string>;
    readonlyClickable?: boolean;
    active: boolean;
    pulsing: boolean;
    inFlow?: boolean;
    dimmed?: boolean;
    onHover?: (on: boolean) => void;
    onClick: () => void;
  }
>(function SummaryCard(
  {
    card,
    state,
    metrics,
    readonlyValues,
    readonlyClickable = false,
    active,
    pulsing,
    inFlow,
    dimmed,
    onHover,
    onClick,
  },
  ref,
) {
  const readonly = card.kind === "readonly";
  const v = state[card.id];
  const configured = readonly ? metricReady(card, metrics, readonlyValues) : Boolean(v);
  const clickable = !readonly || readonlyClickable;
  const value = readonly
    ? metricLabel(card, metrics, readonlyValues)
    : v
      ? `${v.value}${card.suffix ? ` ${card.suffix}` : ""}`
      : "Not configured";
  const rateLine =
    !readonly && v?.rate !== undefined && card.unit && card.unit !== "none"
      ? `${inr(v.rate)} / ${card.unit === "perPc" ? "pc" : card.unit === "perDot" ? "Dot" : card.unit === "perKg" ? "KG" : "m"}`
      : undefined;


  return (
    <button
      ref={ref}
      onClick={() => clickable && onClick()}
      aria-disabled={!clickable}
      onMouseEnter={() => configured && onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      className={cn(
        "group relative w-full overflow-hidden rounded-xl border bg-surface pl-4 pr-3.5 py-3 text-left shadow-[0_1px_2px_rgba(11,15,13,0.04)] transition-all",
        "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:content-['']",
        configured
          ? "border-cfg/35 before:bg-cfg"
          : "border-hairline before:bg-ink-100",
        !clickable
          ? "cursor-default"
          : configured
            ? "hover:border-cfg hover:shadow-[0_2px_12px_rgba(12,176,160,0.14)]"
            : "hover:border-ink-300 hover:shadow-[0_2px_12px_rgba(11,15,13,0.06)]",
        active && "border-cfg shadow-[0_0_0_2px_rgba(12,176,160,0.18)]",
        inFlow && "border-cfg shadow-[0_0_0_2px_rgba(12,176,160,0.14)]",
        dimmed && "opacity-35",
        pulsing && "border-brand-500 bg-brand-50 before:bg-brand-700",
      )}
    >

      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-[0.12em]",
            configured ? "text-cfg-strong" : "text-ink-300",
          )}
        >
          {card.label}
          {card.mandatory && (
            <span
              aria-label="Mandatory field"
              title="Mandatory"
              className="inline-block h-[5px] w-[5px] shrink-0 rounded-full bg-[#e5484d]"
            />
          )}
        </span>
      </div>

      <div
        className={cn(
          "mt-1 truncate text-[13.5px]",
          configured ? "font-medium text-ink-900" : "text-ink-300",
        )}
      >
        {value}
      </div>

      {rateLine && (
        <div className="mt-0.5 text-[15px] font-semibold tabular-nums text-ink-900">{rateLine}</div>
      )}

      {card.ai && (
        <div className="mt-2 rounded-lg bg-brand-50 px-2.5 py-2">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-brand-700">
            <Sparkles className="h-2.5 w-2.5" /> AI suggestion
          </div>
          {card.aiReason && (
            <p className="mt-1 text-[11.5px] leading-relaxed text-ink-600">{card.aiReason}</p>
          )}
        </div>
      )}
    </button>
  );
});

const GrandTotalCard = forwardRef<
  HTMLDivElement,
  {
    metrics: ReturnType<typeof computeConfig>;
    pulsing: boolean;
    inFlow?: boolean;
    dimmed?: boolean;
    totalLabel?: string;
    zeroTotals?: boolean;
    insight?: { text: string; savings?: string } | null;
    override?: {
      heading: string;
      value: string;
      rows: { label: string; value: string }[];
      status?: string;
    };
  }
>(function GrandTotalCard(
  {
    metrics,
    pulsing,
    inFlow,
    dimmed,
    totalLabel = "Fabric total",
    zeroTotals = false,
    insight,
    override,
  },
  ref,
) {
  const isSummary = Boolean(override);
  const show = (n: number) => (zeroTotals || n ? inr(n) : "—");
  const rows = override?.rows ?? [
    { label: totalLabel, value: show(metrics.fabricTotal) },
    { label: "Running total", value: show(metrics.runningTotal) },
  ];
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-xl border shadow-[0_1px_14px_rgba(11,15,13,0.06)] transition-all",
        isSummary
          ? "bg-ink-900 p-5 text-white"
          : pulsing
            ? "border-brand-500 bg-brand-50 p-4"
            : "border-ink-200 bg-surface p-4",
        inFlow && "shadow-[0_0_0_2px_rgba(12,176,160,0.14)]",
        dimmed && "opacity-35",
      )}
    >
      <div
        className={cn(
          "text-[10.5px] uppercase tracking-[0.12em]",
          isSummary ? "text-ink-200" : "text-ink-400",
        )}
      >
        {override?.heading ?? "Grand total / piece"}
      </div>
      <div
        className={cn(
          "mt-1 leading-none tracking-tight tabular-nums",
          isSummary
            ? "text-[38px] font-bold text-white"
            : "text-[28px] font-semibold text-ink-900",
        )}
      >
        {override?.value ?? show(metrics.grandTotal)}
      </div>
      {override?.status && (
        <div
          className={cn(
            "mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium",
            isSummary
              ? "bg-white/10 text-white"
              : "bg-cfg-soft text-cfg-strong",
          )}
        >
          {override.status}
        </div>
      )}
      <dl
        className={cn(
          "mt-3 space-y-1.5 border-t pt-3 text-[12px]",
          isSummary ? "border-white/10" : "border-hairline",
        )}
      >
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-2">
            <dt className={isSummary ? "text-ink-300" : "text-ink-500"}>{r.label}</dt>
            <dd className={cn("tabular-nums", isSummary ? "text-white" : "text-ink-900")}>
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
      {insight && !isSummary && (
        <div className="mt-3 rounded-lg bg-brand-50 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-brand-700">
            <Sparkles className="h-3 w-3" /> AI recommendation
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-600">{insight.text}</p>
          {insight.savings && (
            <div className="mt-2 text-[12px] font-medium text-brand-700">{insight.savings}</div>
          )}
        </div>
      )}
    </div>
  );
});
