/**
 * "How do I know this is what will actually be sent to the buyer?"
 *
 * The customer-facing document — full-screen, closable, and strictly a
 * different SELECTION of the same quotation data the workspace edits. No
 * commercial overheads, supplier margins, provisions, internal cost
 * assumptions, benchmarking or AI recommendations ever reach this component;
 * it is only ever handed the buyer-safe fields (`sellingUsd`, `sellingInr`,
 * scenario/variant/option identity, MOQ).
 */

import { Boxes, Package, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Pod } from "@/lib/podsStore";
import { usd } from "@/lib/commercialProvisions";
import { totalsOf, type ViewedItem } from "@/lib/quotationView";
import { ScenarioChip, BuildChip } from "./ConfigChips";

const COMPANY = {
  name: "Tracon Exports Pvt. Ltd.",
  tagline: "Home textiles · Table linen · Bath",
  address: "Plot 42, SIDCO Industrial Estate, Karur 639002, Tamil Nadu, India",
  contact: "+91 4324 240 118 · exports@tracon.co · www.tracon.co",
};

const TERMS = {
  incoterm: "FOB Nhava Sheva, India",
  payment: "TT 30% advance, 70% against BL copy",
  leadTime: "75–90 days from order confirmation & approved counter-sample",
  validityDays: 30,
};

function quotationNumber(podId: string) {
  const digits = podId
    .replace(/[^0-9]/g, "")
    .padStart(4, "0")
    .slice(-4);
  return `QT-${new Date().getFullYear()}-${digits}`;
}

export function QuotationPreview({
  open,
  onClose,
  pod,
  views,
  onSendForApproval,
}: {
  open: boolean;
  onClose: () => void;
  pod: Pod;
  views: ViewedItem[];
  onSendForApproval: () => void;
}) {
  if (!open) return null;

  const totals = totalsOf(views);
  const today = new Date();
  const validUntil = new Date(today);
  validUntil.setDate(validUntil.getDate() + TERMS.validityDays);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink-900/40" role="dialog" aria-modal="true">
      <div className="flex min-h-0 flex-1 flex-col bg-canvas">
        {/* Chrome — not part of the document itself */}
        <header className="flex shrink-0 items-center gap-3 border-b border-hairline bg-surface px-6 py-3 lg:px-8">
          <div className="min-w-0 flex-1">
            <h1 className="text-[15px] font-semibold text-ink-900">Quotation preview</h1>
            <p className="text-[11.5px] text-ink-500">
              What {pod.buyer} will see. Nothing costing or commercial appears below.
            </p>
          </div>
          <button
            type="button"
            onClick={onSendForApproval}
            disabled={views.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            <Send className="h-4 w-4" /> Send for Approval
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="rounded-md p-2 text-ink-500 hover:bg-surface-alt hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* The document */}
        <div className="min-h-0 flex-1 overflow-y-auto py-8">
          <div className="mx-auto max-w-[860px] rounded-xl border border-hairline bg-surface px-8 py-8 shadow-sm lg:px-12 lg:py-10">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-6 border-b border-hairline pb-6">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-700 text-[14px] font-semibold text-white">
                    T
                  </span>
                  <div>
                    <div className="text-[15px] font-semibold text-ink-900">{COMPANY.name}</div>
                    <div className="text-[11px] text-ink-500">{COMPANY.tagline}</div>
                  </div>
                </div>
                <p className="mt-3 max-w-[260px] text-[11px] leading-relaxed text-ink-500">
                  {COMPANY.address}
                  <br />
                  {COMPANY.contact}
                </p>
              </div>

              <div className="text-right">
                <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-400">
                  Quotation
                </div>
                <div className="text-[20px] font-semibold tabular-nums text-ink-900">
                  {quotationNumber(pod.id)}
                </div>
                <dl className="mt-2 space-y-0.5 text-[11.5px] text-ink-600">
                  <div className="flex justify-end gap-2">
                    <dt className="text-ink-400">Date</dt>
                    <dd className="tabular-nums text-ink-900">{fmt(today)}</dd>
                  </div>
                  <div className="flex justify-end gap-2">
                    <dt className="text-ink-400">Valid until</dt>
                    <dd className="tabular-nums text-ink-900">{fmt(validUntil)}</dd>
                  </div>
                  <div className="flex justify-end gap-2">
                    <dt className="text-ink-400">Buyer</dt>
                    <dd className="text-ink-900">{pod.buyer}</dd>
                  </div>
                  <div className="flex justify-end gap-2">
                    <dt className="text-ink-400">Currency</dt>
                    <dd className="text-ink-900">USD</dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Quoted products */}
            <div className="mt-7 space-y-5">
              {views.length === 0 ? (
                <p className="py-10 text-center text-[13px] text-ink-500">
                  Nothing has been added to this quotation yet.
                </p>
              ) : (
                views.map((v) => <PreviewItem key={v.item.id} view={v} />)
              )}
            </div>

            {/* Final summary */}
            {views.length > 0 && (
              <div className="mt-8 overflow-hidden rounded-lg border-2 border-brand-700">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-brand-700 px-5 py-3 text-white">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.1em]">
                    Total Quotation Value
                  </span>
                  <span className="text-[22px] font-semibold tabular-nums">
                    {usd(totals.orderValueUsd, 0)}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-px bg-hairline sm:grid-cols-3">
                  <SummaryCell label="Incoterm" value={TERMS.incoterm} />
                  <SummaryCell label="Payment terms" value={TERMS.payment} />
                  <SummaryCell label="Lead time" value={TERMS.leadTime} />
                </dl>
              </div>
            )}

            <p className="mt-6 text-[10.5px] leading-relaxed text-ink-400">
              This quotation is subject to the terms above and confirmation of order quantities.
              Prices are quoted per piece / per set as indicated, packed in export-worthy cartons.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-5 py-3">
      <dt className="text-[10px] font-medium uppercase tracking-[0.1em] text-ink-500">{label}</dt>
      <dd className="mt-0.5 text-[12px] text-ink-800">{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * One quoted product or kit, buyer-facing only
 * ------------------------------------------------------------------ */

function PreviewItem({ view }: { view: ViewedItem }) {
  return view.kind === "kit" ? <PreviewKit view={view} /> : <PreviewProduct view={view} />;
}

function PreviewProduct({ view }: { view: Extract<ViewedItem, { kind: "product" }> }) {
  const { item, priced } = view;
  return (
    <section className="overflow-hidden rounded-lg border border-hairline">
      <ProductRow
        image={item.image}
        name={item.name}
        srfRef={item.srfRef}
        description={item.name}
        sizeLabel={item.size ?? priced.sizeLabel}
        moq={priced.moq}
        scenario={priced.scenario.name}
        build={priced.build.name}
        buildKind={priced.build.kind}
        unitPriceUsd={priced.commercial.sellingUsd}
        lineTotalUsd={priced.orderValueUsd}
      />
    </section>
  );
}

function PreviewKit({ view }: { view: Extract<ViewedItem, { kind: "kit" }> }) {
  const { item, priced } = view;
  return (
    <section className="overflow-hidden rounded-lg border-2 border-[var(--color-cfg)]">
      <header className="flex items-center gap-2 bg-[var(--color-cfg-soft)] px-4 py-2.5">
        <Boxes className="h-4 w-4 text-[var(--color-cfg-strong)]" aria-hidden />
        <h3 className="text-[13.5px] font-semibold text-ink-900">KIT — {item.name}</h3>
        <span className="ml-auto text-[11px] text-ink-500">
          {priced.members.length} product{priced.members.length === 1 ? "" : "s"} per set
        </span>
      </header>

      <div className="divide-y divide-hairline">
        {priced.members.map((m) => (
          <ProductRow
            key={m.articleId}
            image={m.image}
            name={m.name}
            srfRef={undefined}
            description={m.name}
            sizeLabel={m.sizeLabel}
            moq={m.moq}
            scenario={m.scenario.name}
            build={m.build.name}
            buildKind={m.build.kind}
            unitPriceUsd={m.commercial.sellingUsd}
            lineTotalUsd={undefined}
            compact
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline bg-surface-alt/50 px-4 py-3">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.1em] text-ink-500">
            Kit Total / Set
          </div>
          <div className="text-[11.5px] text-ink-500">
            {priced.sets.toLocaleString("en-IN")} sets quoted
          </div>
        </div>
        <div className="text-right">
          <div className="text-[18px] font-semibold tabular-nums text-ink-900">
            {usd(priced.commercial.sellingUsd)}
          </div>
          <div className="text-[11px] tabular-nums text-ink-500">
            {usd(priced.orderValueUsd, 0)} total
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductRow({
  image,
  name,
  srfRef,
  description,
  sizeLabel,
  moq,
  scenario,
  build,
  buildKind,
  unitPriceUsd,
  lineTotalUsd,
  compact,
}: {
  image?: string;
  name: string;
  srfRef?: string;
  description: string;
  sizeLabel: string;
  moq: number;
  scenario: string;
  build: string;
  buildKind: "variant" | "option";
  unitPriceUsd: number;
  lineTotalUsd?: number;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap items-start gap-4 px-4", compact ? "py-3" : "py-4")}>
      {image ? (
        <img
          src={image}
          alt=""
          className="h-14 w-14 shrink-0 rounded-md border border-hairline object-cover"
        />
      ) : (
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-alt text-ink-400">
          <Package className="h-5 w-5" aria-hidden />
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h4 className="text-[13.5px] font-semibold text-ink-900">{name}</h4>
          {srfRef && <span className="text-[11px] text-ink-400">Ref {srfRef}</span>}
        </div>
        <p className="mt-0.5 text-[11.5px] text-ink-500">
          {description} · {sizeLabel}
        </p>

        {/* Scenario / variant / option — configurations of the SAME product,
            never rendered as separate line items. */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <ScenarioChip
            scenario={{ id: "", name: scenario, subtitle: "", parameters: {}, commercial: {} }}
          />
          <BuildChip build={{ id: "", name: build, kind: buildKind, pins: [] }} />
          <span className="rounded bg-surface-alt px-1.5 py-0.5 text-[10.5px] tabular-nums text-ink-600">
            MOQ {moq.toLocaleString("en-IN")} pcs
          </span>
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className="text-[10px] font-medium uppercase tracking-[0.1em] text-ink-500">
          Quoted Price
        </div>
        <div className="text-[15px] font-semibold tabular-nums text-ink-900">
          {usd(unitPriceUsd)} <span className="text-[10.5px] font-normal text-ink-400">/ pc</span>
        </div>
        {lineTotalUsd !== undefined && (
          <div className="text-[11px] tabular-nums text-ink-500">{usd(lineTotalUsd, 0)} total</div>
        )}
      </div>
    </div>
  );
}
