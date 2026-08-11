// Shared flow-connector rendering for the Configuration and Costing canvases.
// Orthogonal elbow paths with rounded corners — dotted when idle, solid teal
// when the hovered card's flow passes through them.

export type FlowLine = {
  from: string;
  to: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export const sameFlowLines = (a: FlowLine[], b: FlowLine[]) =>
  a.length === b.length &&
  a.every(
    (l, i) =>
      l.x1 === b[i].x1 &&
      l.y1 === b[i].y1 &&
      l.x2 === b[i].x2 &&
      l.y2 === b[i].y2 &&
      l.from === b[i].from &&
      l.to === b[i].to,
  );

/** Orthogonal elbow: out right → vertical at the mid gutter → in left. */
export function elbowPath(l: FlowLine, radius = 10) {
  const { x1, y1, x2, y2 } = l;

  // Wrap edge: the target sits left of (or level with) the source — happens when
  // the flow staircase wraps to the next row. Route out, across the row gap, back in.
  if (x2 < x1 + 24) {
    const stub = 22;
    const my = Math.round(y1 + (y2 - y1) / 2);
    const r = Math.min(radius, Math.abs(my - y1) / 2 || radius, Math.abs(y2 - my) / 2 || radius);
    const dir = y2 >= y1 ? 1 : -1;
    return [
      `M ${x1} ${y1}`,
      `L ${x1 + stub - r} ${y1}`,
      `Q ${x1 + stub} ${y1} ${x1 + stub} ${y1 + dir * r}`,
      `L ${x1 + stub} ${my - dir * r}`,
      `Q ${x1 + stub} ${my} ${x1 + stub - r} ${my}`,
      `L ${x2 - stub + r} ${my}`,
      `Q ${x2 - stub} ${my} ${x2 - stub} ${my + dir * r}`,
      `L ${x2 - stub} ${y2 - dir * r}`,
      `Q ${x2 - stub} ${y2} ${x2 - stub + r} ${y2}`,
      `L ${x2} ${y2}`,
    ].join(" ");
  }

  const mx = Math.round(x1 + (x2 - x1) / 2);
  if (Math.abs(y2 - y1) < 2) return `M ${x1} ${y1} L ${x2} ${y2}`;
  const dir = y2 > y1 ? 1 : -1;
  const r = Math.min(radius, Math.abs(y2 - y1) / 2, Math.abs(mx - x1), Math.abs(x2 - mx));
  return [
    `M ${x1} ${y1}`,
    `L ${mx - r} ${y1}`,
    `Q ${mx} ${y1} ${mx} ${y1 + dir * r}`,
    `L ${mx} ${y2 - dir * r}`,
    `Q ${mx} ${y2} ${mx + r} ${y2}`,
    `L ${x2} ${y2}`,
  ].join(" ");
}


export function FlowMarkers({ idPrefix }: { idPrefix: string }) {
  return (
    <defs>
      <marker
        id={`${idPrefix}-arrow`}
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="5"
        markerHeight="5"
        orient="auto-start-reverse"
      >
        <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="var(--color-ink-300)" />
      </marker>
      <marker
        id={`${idPrefix}-arrow-on`}
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="5.5"
        markerHeight="5.5"
        orient="auto-start-reverse"
      >
        <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="var(--color-cfg)" />
      </marker>
    </defs>
  );
}

export function FlowEdges({
  lines,
  activeEdges,
  hovering,
  idPrefix,
}: {
  lines: FlowLine[];
  activeEdges: Set<number>;
  hovering: boolean;
  idPrefix: string;
}) {
  return (
    <>
      <FlowMarkers idPrefix={idPrefix} />
      {lines.map((l, i) => {
        const on = activeEdges.has(i);
        const dim = hovering && !on;
        return (
          <g key={i} opacity={dim ? 0.14 : 1}>
            <path
              d={elbowPath(l)}
              fill="none"
              stroke={on ? "var(--color-cfg)" : "var(--color-ink-300)"}
              strokeWidth={on ? 1.9 : 1.3}
              strokeLinecap="round"
              strokeDasharray={on ? undefined : "2.5 5"}
              markerEnd={on ? `url(#${idPrefix}-arrow-on)` : `url(#${idPrefix}-arrow)`}
            />
            <circle
              cx={l.x1}
              cy={l.y1}
              r={on ? 3 : 2.2}
              fill={on ? "var(--color-cfg)" : "var(--color-ink-300)"}
            />
          </g>
        );
      })}
    </>
  );
}
