import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { createPod } from "@/lib/podsStore";

export const Route = createFileRoute("/pods/new")({
  head: () => ({
    meta: [
      { title: "New Costing POD · Tracon" },
      { name: "description", content: "Start a new costing POD with minimal data entry." },
    ],
  }),
  component: NewPod,
});

function NewPod() {
  const navigate = useNavigate();
  const [buyerRef, setBuyerRef] = useState("");
  const [buyer, setBuyer] = useState("");
  const [preparedBy, setPreparedBy] = useState("Gautam Kitclu");

  const canSubmit = buyer.trim().length > 0 && preparedBy.trim().length > 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const pod = createPod({ buyer: buyer.trim(), buyerRef: buyerRef.trim() || "—", preparedBy: preparedBy.trim() });
    navigate({ to: "/pods/$id", params: { id: pod.id } });
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[720px]">
        <Link to="/pods" className="inline-flex items-center gap-1 text-[12px] text-ink-500 hover:text-ink-900">
          <ArrowLeft className="h-3 w-3" /> Back to dashboard
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-700 text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight text-ink-900">New Costing POD</h1>
            <p className="text-[12px] text-ink-500">
              Capture the essentials. You'll add articles on the next step.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-5 rounded-lg border border-hairline bg-surface p-6">
          <Field label="POD Reference ID" hint="Auto-generated after creation">
            <input
              disabled
              value="Auto-generated"
              className="w-full rounded-md border border-hairline bg-surface-alt px-3 py-2 text-[13px] text-ink-400"
            />
          </Field>
          <Field label="Buyer Reference ID">
            <input
              value={buyerRef}
              onChange={(e) => setBuyerRef(e.target.value)}
              placeholder="e.g. ZH-AW26-CUSH-01"
              className="w-full rounded-md border border-hairline bg-surface px-3 py-2 text-[13px] text-ink-900 focus:border-brand-500 focus:outline-none"
            />
          </Field>
          <Field label="Buyer" required>
            <input
              value={buyer}
              onChange={(e) => setBuyer(e.target.value)}
              placeholder="e.g. Zara Home"
              className="w-full rounded-md border border-hairline bg-surface px-3 py-2 text-[13px] text-ink-900 focus:border-brand-500 focus:outline-none"
            />
          </Field>
          <Field label="Prepared By" required>
            <input
              value={preparedBy}
              onChange={(e) => setPreparedBy(e.target.value)}
              className="w-full rounded-md border border-hairline bg-surface px-3 py-2 text-[13px] text-ink-900 focus:border-brand-500 focus:outline-none"
            />
          </Field>

          <div className="flex items-center justify-end gap-2 border-t border-hairline pt-4">
            <Link to="/pods" className="rounded-md px-3 py-2 text-[13px] text-ink-500 hover:text-ink-900">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-md bg-ink-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Create POD & add articles →
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-[12px] font-medium text-ink-900">
          {label}
          {required && <span className="ml-1 text-danger-600">*</span>}
        </span>
        {hint && <span className="text-[11px] text-ink-400">{hint}</span>}
      </div>
      {children}
    </label>
  );
}
