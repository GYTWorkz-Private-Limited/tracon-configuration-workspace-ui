// ConfigComparisonTable — the whole configuration read as a costing report.
// Rows are every variable in the 0..7 costing spine; columns are variant/option
// pairs. Numbers come from costingSpine only, so this can never disagree with
// the canvas or the network diagram.

import { Fragment, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Equal,
  Plus,
  SlidersHorizontal,
  Sigma,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { inr } from "@/lib/fabricConfig";
import {
  SPINE,
  type CompareColumn,
  type CompareRow,
  type SpineSectionId,
} from "@/lib/costingSpine";

type Props = {
  columns: CompareColumn[];
  rows: CompareRow[];
  rollups: { label: string; values: number[] }[];
  activeId: string;
  onSelectColumn: (id: string) => void;
  onAddColumn: (kind: "variant" | "option") => void;
  productName: string;
};

const DASH = "—";
const HEADER_H = 74; // px — two-tier column header, section rows stick beneath it
const FOOT_H = 38; // px — fixed height of a pinned roll-up row
const FOOT_TOTAL_H = 44; // px — the TOTAL row is a touch taller

const isAbsent = (text: string) => text.trim() === "" || text.trim() === DASH;

const signed = (n: number) => `${n < 0 ? "−" : "+"}${inr(Math.abs(n))}`;

const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`;

export function ConfigComparisonTable({
  columns,
  rows,
  rollups,
  activeId,
  onSelectColumn,
  onAddColumn,
  productName,
}: Props) {
  const [diffOnly, setDiffOnly] = useState(false);
  const [baselineId, setBaselineId] = useState(columns[0]?.id ?? "");
  const [collapsed, setCollapsed] = useState<SpineSectionId[]>([]);
  const [sections, setSections] = useState<SpineSectionId[]>([]);

  const baseIndex = Math.max(
    0,
    columns.findIndex((c) => c.id === baselineId),
  );
  const multi = columns.length > 1;

  const visible = useMemo(
    () =>
      rows.filter(
        (r) => (sections.length === 0 || sections.includes(r.section)) && (!diffOnly || r.differs),
      ),
    [rows, sections, diffOnly],
  );

  const bySection = useMemo(
    () =>
      SPINE.map((s) => ({
        section: s,
        rows: visible.filter((r) => r.section === s.id),
        hidden:
          rows.filter((r) => r.section === s.id).length -
          visible.filter((r) => r.section === s.id).length,
      })).filter((b) => b.rows.length > 0 || sections.includes(b.section.id)),
    [visible, rows, sections],
  );

  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((x) => x !== value) : [...list, value];

  const exportCsv = () => {
    const head = [
      ["Configuration comparison", productName].map(csvCell).join(","),
      [
        "Variable",
        "Unit",
        "Input",
        ...columns.map((c) => `${c.variantName}${c.optionName ? ` / ${c.optionName}` : ""}`),
      ]
        .map(csvCell)
        .join(","),
    ];
    const body = bySection.flatMap(({ section, rows: sr }) => [
      csvCell(`${section.index} · ${section.label} — ${section.question}`),
      ...sr.map((r) =>
        [r.label, r.unit ?? "", r.input, ...r.cells.map((c) => c.text)].map(csvCell).join(","),
      ),
    ]);
    const foot = rollups.map((r) =>
      [r.label, "rupees per pc", "derived", ...r.values.map((v) => inr(v))].map(csvCell).join(","),
    );
    const blob = new Blob([[...head, ...body, csvCell("Roll-up"), ...foot].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${productName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-comparison.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ---------------------------------------------------------- toolbar */}
      <div className="shrink-0 border-b border-hairline bg-surface px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setDiffOnly((d) => !d)}
            disabled={!multi}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
              diffOnly
                ? "bg-brand-700 text-white hover:bg-brand-800"
                : "border border-hairline bg-surface text-ink-700 hover:bg-surface-alt",
              !multi && "cursor-not-allowed opacity-40",
            )}
          >
            <Equal className="h-3.5 w-3.5" />
            Show differences only
          </button>

          <label className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[12px] text-ink-500">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Baseline
            <select
              value={columns[baseIndex]?.id ?? ""}
              onChange={(e) => setBaselineId(e.target.value)}
              className="bg-transparent text-[12px] font-medium text-ink-900 outline-none"
            >
              {columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.variantName}
                  {c.optionName ? ` / ${c.optionName}` : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => onAddColumn("variant")}
              className="inline-flex items-center gap-1 rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink-700 hover:bg-surface-alt"
            >
              <Plus className="h-3.5 w-3.5" /> Variant
            </button>
            <button
              onClick={() => onAddColumn("option")}
              className="inline-flex items-center gap-1 rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink-700 hover:bg-surface-alt"
            >
              <Plus className="h-3.5 w-3.5" /> Option
            </button>
            <button
              onClick={exportCsv}
              className="inline-flex items-center gap-1 rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink-700 hover:bg-surface-alt"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>
        </div>

        {/* section filter chips */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Chip
            active={sections.length === 0}
            onClick={() => setSections([])}
            label="All sections"
          />
          {SPINE.map((s) => (
            <Chip
              key={s.id}
              active={sections.includes(s.id)}
              onClick={() => setSections((cur) => toggle(cur, s.id))}
              label={`${s.index} · ${s.label}`}
            />
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------ table */}
      <div className="min-h-0 flex-1 overflow-auto overflow-x-auto bg-canvas">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              <th
                className="sticky left-0 top-0 z-40 min-w-[260px] border-b border-r border-hairline bg-surface-alt px-4 text-left align-bottom"
                style={{ height: HEADER_H }}
              >
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-500">
                  Variable
                </div>
                <div className="pb-2 pt-0.5 text-[11px] text-ink-400">{productName}</div>
              </th>
              {columns.map((c, i) => (
                <th
                  key={c.id}
                  onClick={() => onSelectColumn(c.id)}
                  className={cn(
                    "sticky top-0 z-30 min-w-[150px] cursor-pointer border-b border-hairline px-4 text-right align-bottom transition-colors",
                    c.id === activeId ? "bg-brand-50" : "bg-surface-alt hover:bg-surface",
                  )}
                  style={{ height: HEADER_H }}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span
                      className={cn(
                        "shrink-0 rounded px-1 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.06em]",
                        c.kind === "option"
                          ? "bg-cfg-soft text-cfg-strong"
                          : "bg-ink-100 text-ink-600",
                      )}
                    >
                      {c.kind}
                    </span>
                    <div className="truncate text-[12.5px] font-semibold text-ink-900">
                      {c.variantName}
                    </div>
                  </div>
                  <div className="truncate text-[11px] text-ink-500">{c.optionName ?? "Base"}</div>
                  <div className="pb-2 pt-0.5 text-[13px] font-semibold tabular-nums text-brand-700">
                    {inr(c.total)}
                    {i === baseIndex && multi && (
                      <span className="ml-1 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                        base
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {bySection.map(({ section, rows: sr, hidden }) => {
              const isOpen = !collapsed.includes(section.id);
              return (
                <Fragment key={section.id}>
                  <tr>
                    <td
                      colSpan={columns.length + 1}
                      className="sticky z-20 border-y border-hairline bg-ink-50 px-4 py-2"
                      style={{ top: HEADER_H }}
                    >
                      <button
                        onClick={() => setCollapsed((c) => toggle(c, section.id))}
                        className="flex w-full items-center gap-2 text-left"
                      >
                        {isOpen ? (
                          <ChevronDown className="h-3.5 w-3.5 text-ink-400" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-ink-400" />
                        )}
                        <span className="text-[10.5px] font-semibold tabular-nums text-ink-400">
                          {section.index}
                        </span>
                        <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-700">
                          {section.label}
                        </span>
                        <span className="text-[11.5px] italic text-ink-400">
                          {section.question}
                        </span>
                        {diffOnly && hidden > 0 && (
                          <span className="ml-auto text-[10.5px] tabular-nums text-ink-400">
                            {hidden} identical hidden
                          </span>
                        )}
                      </button>
                    </td>
                  </tr>

                  {isOpen &&
                    sr.map((r, idx) => (
                      <Fragment key={r.varId}>
                        {r.group !== sr[idx - 1]?.group && (
                          <tr>
                            <td
                              colSpan={columns.length + 1}
                              className="border-b border-hairline/60 bg-surface-alt/60 px-4 py-1 text-[10.5px] font-medium uppercase tracking-[0.1em] text-ink-400"
                            >
                              {r.group}
                            </td>
                          </tr>
                        )}
                        <ValueRow row={r} baseIndex={baseIndex} multi={multi} />
                      </Fragment>
                    ))}
                </Fragment>
              );
            })}

            {bySection.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-4 py-10 text-center text-[12.5px] text-ink-400"
                >
                  Every variable is identical across these columns.
                </td>
              </tr>
            )}
          </tbody>

          {/* pinned roll-up */}
          <tfoot>
            {rollups.map((r, i) => {
              const last = i === rollups.length - 1;
              // rows stack upward from the bottom: offset = total height of the rows below
              const offset = last ? 0 : FOOT_TOTAL_H + (rollups.length - 2 - i) * FOOT_H;
              const geometry = { bottom: offset, height: last ? FOOT_TOTAL_H : FOOT_H };
              return (
                <tr key={r.label}>
                  <th
                    scope="row"
                    className={cn(
                      "sticky left-0 z-30 border-t border-hairline px-4 text-left",
                      last
                        ? "bg-brand-700 text-[13px] font-semibold text-white"
                        : "bg-surface-alt text-[12px] font-medium text-ink-800",
                    )}
                    style={geometry}
                  >
                    {r.label}
                  </th>
                  {columns.map((c, ci) => {
                    const value = r.values[ci] ?? 0;
                    const delta = value - (r.values[baseIndex] ?? 0);
                    const show = multi && ci !== baseIndex && Math.abs(delta) > 0.004;
                    return (
                      <td
                        key={c.id}
                        className={cn(
                          "sticky z-20 whitespace-nowrap border-t border-hairline px-4 text-right tabular-nums",
                          last
                            ? "bg-brand-700 text-[14px] font-semibold text-white"
                            : "bg-surface-alt text-[12.5px] font-medium text-ink-900",
                        )}
                        style={geometry}
                      >
                        {inr(value)}
                        {show && (
                          <span
                            className={cn(
                              "ml-1.5 text-[10.5px] font-medium",
                              last
                                ? delta < 0
                                  ? "text-brand-100"
                                  : "text-gold-100"
                                : delta < 0
                                  ? "text-success"
                                  : "text-danger",
                            )}
                          >
                            {signed(delta)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ rows */

function ValueRow({
  row,
  baseIndex,
  multi,
}: {
  row: CompareRow;
  baseIndex: number;
  multi: boolean;
}) {
  const derived = row.input === "derived";
  const baseCell = row.cells[baseIndex];

  return (
    <tr className={cn("border-b border-hairline/60", row.differs && "bg-cfg-soft")}>
      <th
        scope="row"
        className={cn(
          "sticky left-0 z-10 border-r border-hairline px-4 py-1.5 text-left font-normal",
          row.differs ? "bg-cfg-soft" : "bg-surface",
        )}
      >
        <span className="flex items-center gap-1.5">
          {derived && (
            <span title="Derived — calculated, not entered" className="shrink-0">
              <Sigma className="h-3 w-3 text-ink-300" />
            </span>
          )}
          <span
            className={cn(
              "truncate",
              derived ? "italic text-ink-500" : "text-ink-800",
              row.costBearing && !derived && "font-medium",
            )}
          >
            {row.label}
          </span>
          {row.unit && <span className="shrink-0 text-[11px] text-ink-400">({row.unit})</span>}
          {row.quantitySensitive && (
            <span
              title="Quantity-sensitive — an option with a different MOQ can move this line"
              className="shrink-0 text-[10px] font-semibold text-cfg-strong"
            >
              Q
            </span>
          )}
        </span>
      </th>

      {row.cells.map((cell, i) => {
        const absent = isAbsent(cell.text);
        const delta =
          multi &&
          i !== baseIndex &&
          row.costBearing &&
          cell.numeric !== undefined &&
          baseCell?.numeric !== undefined
            ? cell.numeric - baseCell.numeric
            : undefined;
        return (
          <td
            key={i}
            className={cn(
              "px-4 py-1.5 text-right align-top tabular-nums",
              absent ? "text-ink-300" : derived ? "italic text-ink-600" : "text-ink-900",
            )}
          >
            <span className="inline-flex items-baseline gap-1">
              {cell.overridden && !absent && (
                <span
                  className="text-[9px] text-gold-600"
                  title={`Overridden — master value ${baseCell?.text ?? DASH}`}
                >
                  ◆
                </span>
              )}
              {absent ? DASH : cell.text}
            </span>
            {delta !== undefined && Math.abs(delta) > 0.004 && (
              <div className={cn("text-[10.5px]", delta < 0 ? "text-success" : "text-danger")}>
                {delta < 0 ? "−" : "+"}
                {Math.abs(delta).toFixed(2)}
              </div>
            )}
          </td>
        );
      })}
    </tr>
  );
}

function Chip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
        active
          ? "border-brand-700 bg-brand-50 text-brand-700"
          : "border-hairline bg-surface text-ink-500 hover:bg-surface-alt",
      )}
    >
      {label}
    </button>
  );
}
