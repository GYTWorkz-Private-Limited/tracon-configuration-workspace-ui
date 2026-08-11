// CostingCanvas — read-only visual derivation of the selling price.
// Product details → Material cost → Material total → Overheads → Grand total → Pricing.
// Same card design, pan/zoom and connector language as the Configuration canvas.

import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ZoomIn, ZoomOut, Maximize2, Hand, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { FlowEdges, sameFlowLines, type FlowLine } from "@/components/flow/FlowEdges";
import { COST_SECTIONS, type CostCard, type CostSectionDef } from "@/lib/costingSheet";

/** Generalised card so the same canvas can render other flows (e.g. Configuration summary). */
export type FlowCardDef = Omit<CostCard, "section" | "explain"> & {
  section: string;
  explain?: CostCard["explain"];
};

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

type Props = {
  cards: FlowCardDef[];
  /** column definitions; defaults to the costing review sections */
  sections?: CostSectionDef[];
  /** footer hint text */
  hint?: string;
  activeCardId: string | null;
  onOpenCard: (id: string) => void;
  pulse?: string[];
};

export function CostingCanvas({
  cards,
  sections: sectionDefs = COST_SECTIONS,
  hint = "Read only — click a card to see how it's calculated",
  activeCardId,
  onOpenCard,
  pulse = [],
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});
  const [lines, setLines] = useState<FlowLine[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hoverId, setHoverId] = useState<string | null>(null);

  const [zoom, setZoom] = useState(0.96);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const viewRef = useRef({ zoom: 0.96, offset: { x: 0, y: 0 } });
  viewRef.current = { zoom, offset };

  const columns = useMemo(
    () =>
      sectionDefs.map((s) => ({
        section: s,
        cards: cards.filter((c) => c.section === s.id),
      })).filter((c) => c.cards.length > 0),
    [cards, sectionDefs],
  );

  const measure = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;
    const k = viewRef.current.zoom || 1;
    const box = content.getBoundingClientRect();
    const nextSize = { w: Math.round(box.width / k), h: Math.round(box.height / k) };

    const next: FlowLine[] = [];
    for (let i = 0; i < columns.length - 1; i++) {
      for (const f of columns[i].cards) {
        const fe = cardRefs.current[f.id];
        if (!fe) continue;
        const fr = fe.getBoundingClientRect();
        for (const t of columns[i + 1].cards) {
          const te = cardRefs.current[t.id];
          if (!te) continue;
          const tr = te.getBoundingClientRect();
          next.push({
            from: f.id,
            to: t.id,
            x1: Math.round((fr.right - box.left) / k),
            y1: Math.round((fr.top + fr.height / 2 - box.top) / k),
            x2: Math.round((tr.left - box.left) / k),
            y2: Math.round((tr.top + tr.height / 2 - box.top) / k),
          });
        }
      }
    }
    setSize((prev) => (prev.w === nextSize.w && prev.h === nextSize.h ? prev : nextSize));
    setLines((prev) => (sameFlowLines(prev, next) ? prev : next));
  }, [columns]);

  /** every node downstream of the hovered card, ending at the final price */
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
                idPrefix="costing"
              />
            </svg>

            <div className="relative flex min-w-max items-start gap-8">
              {columns.map(({ section, cards: colCards }) => (
                <div key={section.id} className="w-[268px] shrink-0">
                  <div className="mb-3 flex items-baseline gap-2">
                    <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-500">
                      {section.label}
                    </h3>
                    {section.note && (
                      <span className="text-[10px] uppercase tracking-[0.1em] text-ink-300">
                        {section.note}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {colCards.map((c) => (
                      <CostingCard
                        key={c.id}
                        ref={(el) => {
                          cardRefs.current[c.id] = el;
                        }}
                        card={c}
                        active={activeCardId === c.id}
                        pulsing={pulse.includes(c.id)}
                        inFlow={flow.nodes.has(c.id)}
                        dimmed={hoverId !== null && !flow.nodes.has(c.id)}
                        onHover={(on) => setHoverId(on ? c.id : null)}
                        onClick={() => onOpenCard(c.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

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

      <div className="pointer-events-none absolute bottom-5 right-5 inline-flex items-center gap-3 rounded-full border border-hairline bg-surface/90 px-2.5 py-1 text-[11.5px] text-ink-400">
        <span className="inline-flex items-center gap-1.5">
          <Lock className="h-3 w-3" /> {hint}
        </span>
        <span className="h-3 w-px bg-hairline" />
        <span className="inline-flex items-center gap-1.5">
          <Hand className="h-3 w-3" /> Drag to pan
        </span>
      </div>
    </div>
  );
}

const CostingCard = forwardRef<
  HTMLButtonElement,
  {
    card: FlowCardDef;
    active: boolean;
    pulsing: boolean;
    inFlow: boolean;
    dimmed: boolean;
    onHover: (on: boolean) => void;
    onClick: () => void;
  }
>(function CostingCard({ card, active, pulsing, inFlow, dimmed, onHover, onClick }, ref) {
  const isGrand = card.emphasis === "grand";
  const isTotal = card.emphasis === "total";
  const isProduct = card.section === "product";

  return (
    <button
      ref={ref}
      onClick={onClick}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={cn(
        "group relative w-full overflow-hidden rounded-xl border pl-4 pr-3.5 py-3 text-left transition-all",
        "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:content-['']",
        isGrand
          ? "border-ink-900 bg-ink-900 text-white before:bg-cfg shadow-[0_2px_16px_rgba(11,15,13,0.18)]"
          : isTotal
            ? "border-cfg/50 bg-surface before:bg-cfg shadow-[0_1px_10px_rgba(12,176,160,0.10)]"
            : "border-cfg/30 bg-surface before:bg-cfg shadow-[0_1px_2px_rgba(11,15,13,0.04)]",
        !isGrand && "hover:border-cfg hover:shadow-[0_2px_12px_rgba(12,176,160,0.14)]",
        active && "shadow-[0_0_0_2px_rgba(12,176,160,0.30)]",
        inFlow && !active && "shadow-[0_0_0_2px_rgba(12,176,160,0.16)]",
        dimmed && "opacity-35",
        pulsing && "border-brand-500 bg-brand-50",
      )}
    >
      <div
        className={cn(
          "text-[10.5px] font-semibold uppercase tracking-[0.12em]",
          isGrand ? "text-white/60" : "text-cfg-strong",
        )}
      >
        {card.label}
      </div>
      <div
        className={cn(
          "mt-1 tabular-nums tracking-tight",
          isGrand
            ? "text-[30px] font-bold leading-none text-white"
            : isTotal
              ? "text-[22px] font-semibold leading-tight text-ink-900"
              : isProduct
                ? "text-[14px] font-medium text-ink-900"
                : "text-[17px] font-semibold text-ink-900",
        )}
      >
        {card.value}
      </div>
      {card.desc && (
        <div
          className={cn(
            "mt-1 text-[11px] leading-relaxed",
            isGrand ? "text-white/60" : "text-ink-500",
          )}
        >
          {card.desc}
        </div>
      )}
      {card.rows && card.rows.length > 0 && (
        <dl
          className={cn(
            "mt-2.5 space-y-1 border-t pt-2.5 text-[11.5px]",
            isGrand ? "border-white/15" : "border-hairline",
          )}
        >
          {card.rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-2">
              <dt className={isGrand ? "text-white/55" : "text-ink-400"}>{r.label}</dt>
              <dd
                className={cn(
                  "truncate tabular-nums",
                  isGrand ? "text-white" : "text-ink-800",
                )}
              >
                {r.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </button>
  );
});
