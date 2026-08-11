# Plan — AI-Native Configuration Workspace (cushion covers)

Goal: build the hero **Configuration** screen from the PRD as a node-graph "workflow builder" that visualizes the cost buildup (like the reference images) and drives real-time costing. Keep every existing tab (AI workspace, cost analysis, quote) intact — this is additive.

## Scope for this pass

Only Screen 2 (Configuration Workspace) + a lightweight Screen 3 (Generate Costing snapshot panel driven by the same model). Screens 1, 4, 5 are out of scope for this pass — they already exist in some form and would balloon the change.

## What we build

### 1. New cost model for cushion covers

File: `src/lib/cushionCosting.ts`

- Input rates (₹/m, ₹/pc) mirroring the uploaded Excel + reference image: greige cotton, reactive print, solid dyeing, finish+transport, cutting, stitching, embroidery, trims+labels, packaging, setup.
- Intermediate nodes: Front Fabric ₹/m, Back Fabric ₹/m (with shrinkage + waste multipliers), Front/pc, Back/pc, Piping/pc, plus per-piece making nodes.
- Cost groups: Fabric subtotal, Making subtotal, Overhead (8% of direct), Total ₹/pc, FX rate, Target margin → Suggested quote $.
- Pure functions: `computeCushion(inputs, config)` returns every node value + edge contributions so the graph can render "edge thickness = contribution".

### 2. Graph renderer

File: `src/components/config/CostGraph.tsx`

- Custom SVG layout (no new deps) — 7 columns matching the reference: Inputs → Fabric ₹/m → Cost ₹/pc → Cost Groups → Overhead → Total ₹/pc → Quote $.
- Nodes are rounded cards with a colored dot (fabric = teal, making = indigo, overhead/FX = amber, output = brand green) and stacked label + value.
- Edges as cubic Bézier paths, stroke width proportional to the child's contribution to the parent node. Dashed edges for signals (FX rate, target margin).
- Hover a node → highlight its incoming edges, show a formula tooltip (e.g. `(₹120 + ₹22 + ₹7) × shrink 5% × waste 5%`).
- Click a node → opens a right-side detail popover with the editable inputs that feed it (Composition, GSM, Width, Shrinkage, Supplier, Rate, MOQ, Lead Time, Currency) and an "AI suggests" block with 2–3 alternatives (Apply / Create Variant).

### 3. Configuration Workspace shell

File: `src/components/config/ConfigurationWorkspace.tsx`

- Three-pane layout, matching the PRD:
  - **Left** — Product Information card, auto-filled from SRF: Customer, Buyer, Article, Qty, Target Price, MOQ, Dimensions, Construction, Fabric, Artwork, Packaging, Delivery, Timeline, Approval Status. All values editable inline.
  - **Center** — Scenario header strip (As enquired · Value-engineered · Premium chips with $ + tagline, matching the top of image 1) and the `CostGraph` below it. A legend row at the bottom explains dot colors, dashed edges, and edge thickness. "Forward pass · N nodes · N edges" header.
  - **Right** — AI Copilot rail. Prompt chips ("Reduce cost 8%", "Meet buyer target", "Find better supplier", "Why is cost high?", "Compare Variant B") and a message thread. Actions produce a "Proposed changes" card with an **Apply to active variant** button that patches the config and pulse-highlights every affected node in the graph.
- Variant switcher above the graph — click a chip to swap the active configuration; "+ Variant" clones the active one.

### 4. Wire into the costing route

File: `src/routes/costing.$id.tsx`

- Add a new **Configuration** tab alongside the existing Build / Cost Analysis / Quote tabs. Make it the default landing tab for cushion-cover articles; other articles keep the current AI Workspace default.
- The Configuration tab renders `<ConfigurationWorkspace srf={...} article={...} />`. Approved mode disables editing (already handled at the route level with the fieldset wrapper) — respect it here.

### 5. Generate Costing snapshot

- A "Generate Costing" button in the Configuration header collapses the graph and shows a printable snapshot: Cost Build-up, Commercial (breakeven / floor / recommended / margin %), Target Achievement gap. Re-uses the existing quotation styling for consistency; not a new export flow.  
  
i want this to be costing analysis to be more detailed and rich based on the configuration and also historical baselines and comparison with other similar customer quotes

## Out of scope (call out to user)

- Screen 1 SRF landing changes, Screen 4 dashboard, Screen 5 approval AI summary.
- Real AI — the copilot is deterministic mock intents like the current AiWorkspace.
- Bed linen / throws / table linen.

## Technical notes

- No new npm deps; SVG-only graph keeps bundle flat and matches the hand-drawn feel of the reference.
- All costing math lives in `cushionCosting.ts` as pure functions so tests / snapshots are trivial to add later.
- Variant state stays in local React state keyed by article id; no store changes.

Approve and I'll build it in one sweep.  
  
