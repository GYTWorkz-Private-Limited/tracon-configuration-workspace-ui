# Costing Configuration Workspace — Product & UX Specification

> Direct Manufacturing Cost Model. Excludes indirect costs and commercial overheads.

---

## 1. The Problem, Stated in Business Terms

The Configuration Workspace today behaves as if it is costing two different products at once.

The forms a costing executive fills in describe the **real article** — the placemat, runner or napkin with its actual fabric, printing, washing and stitching. The visual network diagram and the Add Variant / Add Option actions describe a **generic sample product** left over from an earlier concept. They share a screen but not a subject.

Three consequences, all of which a costing team feels immediately:

1. **The diagram is not trustworthy.** It shows nodes and rates that do not correspond to anything the user entered. A diagram that cannot be trusted is worse than no diagram, because it invites the user to reason from false numbers.
2. **Add Variant / Add Option appears broken.** It is not broken — it is filing new variants into a product record nobody is looking at. The user clicks, something happens somewhere, and the screen does not change. This reads as a dead button.
3. **The configuration has no declared order.** Variables are grouped by whatever screen they landed on rather than by the sequence in which a costing team actually thinks. There is no single answer to "what is the complete list of things I must decide to cost this article?"

Everything below fixes those three, in that order of importance.

---

## 2. The Governing Design Principle

> **One article. One set of numbers. Many views.**

The forms, the network diagram, the comparison table and the costing report are four *views* of a single configuration record. They are never four copies of it.

Practical consequences, all of which are testable by a user without opening a developer console:

- Change a fabric rate in a form → the diagram node, the comparison column, the roll-up total and the report line all move in the same interaction.
- Click a node in the diagram → the **same** editable card opens that the form would have opened. Not a read-only mirror. Not a second form.
- Create a variant → it appears simultaneously as a tab, as a diagram you can switch to, and as a column in the comparison table.
- If a number appears in two places on screen and they disagree, that is a defect of the highest severity. There is no acceptable reason for it.

**The second principle, equally load-bearing:**

> **The manufacturing route is derived, never asked.**

Nobody selects a "Manufacturing Route." The route is the *consequence* of what material was chosen and which processes were switched on. The system infers it and displays it back as a confirmation ribbon. This is the difference between a form and a costing tool.

---

## 3. Information Architecture — The Costing Spine

The workspace follows the order in which a costing team actually reasons. This order is fixed, numbered and visible at all times as a left-hand spine or a top stepper. A user should always be able to answer "where am I, what have I finished, what is still open."

| # | Section | The question it answers |
|---|---------|------------------------|
| 0 | Article & Order Context | What are we costing, for whom, how many? |
| 1 | Fabric & Material Specification | What is the base material? |
| 2 | Component Breakdown | Where is each material used on the product? |
| 3 | Process Configuration | How is it processed? |
| 4 | Consumption, Wastage & Shrinkage | How much is actually required? |
| 5 | Accessories & Trims | What else goes into it? |
| 6 | Packaging | How does it leave the factory? |
| 7 | Direct Cost Roll-Up | What does it cost? |

Between Section 1 and Section 3 the system inserts a **Derived Route Ribbon** — not a section, not an input. A horizontal chip sequence reading, for example:

> `Greige Fabric → Dyeing → Printing → Washing → Finishing → Cutting → Stitching → Packing`

It updates live as choices change. It is read-only. It carries a one-line explanation on hover: *"Dyeing is included because the fabric is Greige."* This ribbon is the single most important trust-building element on the screen — it proves the system understood the configuration.

### Section completion states

Each section carries a status: **Not Started · In Progress · Complete · Needs Attention**.

"Needs Attention" is reserved for genuine logical conflicts, not missing optional fields — for example, a printing process configured on a component that has no printable area, or a consumption figure entered against a component that was never defined. This is the workspace's quality conscience and it must never cry wolf.

---

## 4. The Variable Dictionary

This is the canonical list. Every variable has: a **unit**, an **input type**, a **source**, and two flags that determine its behaviour elsewhere in the product.

- **Cost-bearing (₡)** — this variable produces a line in the Direct Cost Roll-Up.
- **Quantity-sensitive (Q)** — this variable's value changes when order quantity or MOQ changes. These are the *only* variables an Option is permitted to alter.

Input types: **Master** (chosen from a controlled library) · **Entry** (typed by user) · **Derived** (calculated, read-only, always shows its formula on hover).

---

### Section 0 — Article & Order Context

| Variable | Unit | Input | ₡ | Q |
|---|---|---|:-:|:-:|
| Product Category | — | Master | | |
| Article / Style | — | Master | | |
| Buyer | — | Master | | |
| Buyer Reference | — | Entry | | |
| Size | cm / in | Master | | |
| Colour / Pantone | — | Master | | |
| Unit Type | pc / set / pair | Master | | |
| Order Quantity | pcs | Entry | | **Q** |
| MOQ | pcs | Entry | | **Q** |
| Quoted MOQ | pcs | Entry | | **Q** |
| Currency | — | Master | | |
| Costing Date / Validity | date | Entry | | |

> **Design note.** Order Quantity, MOQ and Quoted MOQ are the three levers that define an Option. They must be visually grouped and visually distinct from the rest of Section 0 — a bordered "Commercial Basis" block. When a user edits one of these three inside an Option, the system must make plain that they are editing that Option's basis, not the article's.

---

### Section 1 — Fabric & Material Specification

| Variable | Unit | Input | ₡ | Q |
|---|---|---|:-:|:-:|
| Fabric Type | — | Master | | |
| Fabric Availability | Greige / Ready / From Yarn | Master | | |
| Yarn Count | Ne / Nm / Denier | Master | | |
| Yarn Specification | — | Master | | |
| Construction | ends × picks | Entry | | |
| GSM | g/m² | Entry | | |
| Composition | % | Entry | | |
| Greige Width | cm | Entry | | |
| Finished Width | cm | Entry | | |
| Costing Width | cm | Derived | | |
| Fabric Rate | ₹ / m or ₹ / kg | Master + override | **₡** | **Q** |
| Yarn Rate | ₹ / kg | Master + override | **₡** | **Q** |
| Certification | — | Master (multi) | | |

> **Fabric Availability is the most consequential single field in the entire workspace.** It determines the derived route. It deserves a prominent, three-way segmented control — not a dropdown buried among twelve others. Changing it must trigger a clear, reversible confirmation: *"Switching to Ready Fabric will remove Dyeing and Yarn Preparation from this configuration. Their entered values will be kept and restored if you switch back."*
>
> Never silently discard user work on a route change. Deactivate, retain, restore.

---

### Section 2 — Component Breakdown

The product is decomposed into components. This is the bridge between "what is the material" and "how much of it."

**Component library:** Main Body · Front · Back · Sleeve · Collar · Cuff · Pocket · Lining · Border · Piping · Binding · Gusset · Placket · Yoke · Insert · Filling · Interlining · Decorative Panel · Backing · Custom.

Every component row carries:

| Variable | Unit | Input | ₡ | Q |
|---|---|---|:-:|:-:|
| Component | — | Master | | |
| Material assigned | — | Master (from §1) | | |
| Specification | — | Entry | | |
| Colour | — | Master | | |
| Cut Size (L × W) | cm | Entry | | |
| Costing Width | cm | Derived | | |
| Pieces per Unit | count | Entry | | |
| Consumption | m or m² | Derived | | |
| Wastage | % | Entry | | **Q** |
| Shrinkage | % | Entry | | |
| Net Quantity | m or kg | Derived | **₡** | |
| Rate | ₹ / unit | Master + override | **₡** | **Q** |
| Component Cost | ₹ | Derived | **₡** | |

> **Design note.** This is a table, not a stack of cards. Costing people work in rows and compare down columns. Give it inline editing, keyboard tab-through, row duplication, and a running column total pinned to the footer. This single table is where the majority of the user's time is spent — it should feel like a good spreadsheet, not like a web form.

---

### Section 3 — Process Configuration

Processes are **not** a checklist the user picks from freely. The system presents only those processes that are applicable given the material and components chosen, and marks the rest as unavailable with a stated reason.

| Process | Applies when |
|---|---|
| Yarn Preparation / Twisting | Availability = From Yarn |
| Dyeing | Availability = Greige or From Yarn, or colour ≠ natural |
| Weaving / Knitting | Availability = From Yarn |
| Printing | User-enabled; requires a printable component |
| Embroidery | User-enabled; requires a component |
| Washing | User-enabled |
| Finishing | Always available |
| Cutting | Always required |
| Stitching / Assembly | Always required |
| Hemming / Edge Finish | Always required |
| Special Processes (Fusing, Quilting, Hand Work) | User-enabled |

Each enabled process carries:

| Variable | Unit | Input | ₡ | Q |
|---|---|---|:-:|:-:|
| Process Method | — | Master | | |
| Applied to Component(s) | — | Master (from §2) | | |
| Specification / Recipe | — | Entry | | |
| Basis of Charge | per m / kg / pc / area | Master | | |
| Rate | ₹ / basis | Master + override | **₡** | **Q** |
| Minimum Lot Charge | ₹ | Master | **₡** | **Q** |
| Setup / Screen / Plate Cost | ₹ | Entry | **₡** | **Q** |
| Setup Amortised per Piece | ₹ | Derived | **₡** | **Q** |
| Process Loss | % | Entry | | |
| Process Cost | ₹ | Derived | **₡** | |

> **Design note.** Setup costs and minimum lot charges are where MOQ actually bites. These fields must be visually flagged with a small quantity marker, because they are the ones a costing head will interrogate when asked "why is the 3,000-piece price so much higher?" The Option comparison must be able to isolate them.

---

### Section 4 — Consumption, Wastage & Shrinkage

This section is largely **derived** and should read as a reconciliation, not a data-entry screen. It answers: *given everything above, how much material do we actually buy?*

| Variable | Unit | Input | ₡ | Q |
|---|---|---|:-:|:-:|
| Calculation Method | Fixed / Width / Length / Area / Marker / Formula / Component | Master | | |
| Marker Efficiency | % | Entry | | **Q** |
| Cutting Loss | % | Entry | | |
| Dyeing Loss | % | Entry | | |
| Printing Wastage | % | Entry | | |
| Embroidery Wastage | % | Entry | | |
| Allowances | % or cm | Entry | | |
| Gross Required Quantity | m / kg | Derived | **₡** | **Q** |

> **Design note.** Show a single visual "waterfall" here: Net requirement → + wastage → + shrinkage → + process loss → Gross purchase quantity. One glance should tell a costing manager how much of the material spend is loss. This is the section that generates the most negotiation leverage and it currently has the least visual support.

---

### Section 5 — Accessories & Trims

Same row structure as Section 2 — a table, not cards.

**Library:** Zipper · Button · Press Button · Eyelet · O-Ring · Piping · Polywadding · Filling · Fusing · Cardboard · Labels · Other Direct Trims.

| Variable | Unit | Input | ₡ | Q |
|---|---|---|:-:|:-:|
| Trim Type | — | Master | | |
| Used On (Component) | — | Master (from §2) | | |
| Specification | — | Entry | | |
| Quantity per Unit | count / m | Entry | | |
| Wastage | % | Entry | | **Q** |
| Rate | ₹ / unit | Master + override | **₡** | **Q** |
| Trim MOQ | units | Master | | **Q** |
| Fixing / Attaching Cost | ₹ / unit | Master | **₡** | |
| Trim Cost | ₹ | Derived | **₡** | |

---

### Section 6 — Packaging

Four named groups, presented as collapsible blocks in this order:

**Labels** — Brand · Size · Wash Care · Composition · Barcode · Hang Tag
**Standard Packaging** — Poly Bag · Paper Bag · Tissue · Sticker · Inner Box
**Special Packaging** — Printed Poly Bag · Gift Box · Header Card · Buyer-Specific
**Carton Packing** — Carton Type · Carton Size · Pieces per Carton · Packing Configuration

| Variable | Unit | Input | ₡ | Q |
|---|---|---|:-:|:-:|
| Item | — | Master | | |
| Specification | — | Entry | | |
| Quantity per Unit | count | Entry / Derived | | |
| Rate | ₹ / unit | Master + override | **₡** | **Q** |
| Label / Pack MOQ | units | Master | | **Q** |
| Pieces per Carton | count | Entry | | |
| Cost per Piece | ₹ | Derived | **₡** | |

---

### Section 7 — Direct Cost Roll-Up

Read-only. Three categories, then the total.

```
RAW MATERIAL       Fabric · Yarn · Filling · Interlining/Fusing · Accessories & Trims
      +
PROCESS            Yarn Prep · Dyeing · Weaving/Knitting · Printing · Embroidery ·
                   Washing · Finishing · Cutting · Stitching · Hemming · Special
      +
PACKAGING          Labels · Standard · Special · Carton
      =
TOTAL DIRECT MANUFACTURING COST
```

Each line shows: **amount per piece · % of total · a caret to expand into its contributing components**. Expanding any line walks the user back down the traceability chain to the exact input that produced it.

**Cost traceability chain** — every rupee must be walkable along this path, in both directions:

```
Master Variable → Selected Sub-Option → Component / Usage → Specification →
Consumption → Wastage / Shrinkage → Rate → Component Cost →
Master Variable Total → Category Total → Total Direct Cost
```

---

## 5. Variants and Options — The Model

This is the distinction the product currently does not make, and it is the root of the confusion.

```
ARTICLE  (the thing being costed — one product, one buyer reference)
  │
  ├── VARIANT   "a different way of MAKING it"
  │      Changes specification: fabric, construction, process route,
  │      component build, trims, packaging.
  │      Each variant is a complete, independent configuration.
  │      Example: "Base — Reactive Print" vs "Alt — Pigment Print"
  │               "Greige route" vs "Ready fabric route"
  │
  └── OPTION    "the same build at a different COMMERCIAL BASIS"
         Changes only quantity-driven values: order quantity, MOQ,
         rate breaks, minimum lot charges, setup amortisation,
         packing efficiency, trim/label MOQ effects.
         The specification is identical and locked.
         Example: "3,000 pcs" vs "10,000 pcs" vs "25,000 pcs"
```

**The rule that makes this comprehensible to a user:**

> A **Variant** changes *what we make*. An **Option** changes *how many we make*.
> If a change alters the product, it is a Variant. If it alters only the price of the same product, it is an Option.

Options are nested under Variants. Variant A can have three MOQ options; Variant B can have two. A quotation is assembled by selecting specific Variant + Option pairs.

### Add Variant — drawer specification

Triggered from the variant tab bar. Opens a right-side drawer, not a modal — the user must be able to see the current configuration while deciding.

**Step 1 — Starting point** (three large selectable cards):

| Choice | Behaviour |
|---|---|
| **Duplicate an existing variant** *(default)* | Pick a source variant. Full copy of all eight sections. |
| **Start from a master template** | Pick from the article/category library. Pre-fills Sections 1–6 with standard values. |
| **Start blank** | Only Section 0 carries over from the article. Everything else empty. |

**Step 2 — Identity**
- Variant Name *(required)* — with a smart suggestion based on what differs, e.g. *"Pigment Print — 180 GSM"*
- Short Code *(auto-generated, editable)* — e.g. `V2`
- Purpose note *(optional, one line)* — "what is this variant testing?" This appears as a subtitle on the comparison column and is the single most useful field for anyone reading the costing later.

**Step 3 — On duplicate only: what to carry**
Checklist, all ticked by default: Fabric Spec · Components · Processes · Consumption · Trims · Packaging. Plus one toggle: **"Refresh all rates from current master"** *(default on)* — this is what stops stale rates propagating silently through copied variants.

**Step 4 — Confirm**
- Preview strip: *"New variant will start at ₹XXX.XX/pc — same as source"*
- Primary action: **Create & Open**. Secondary: **Create & Stay**.

**After creation:** the new variant tab is added and activated, the diagram switches to it, a column appears in the comparison table, and — critically — a **"changed from source"** badge appears on any section the user then edits, so the variant's story stays legible.

### Add Option — drawer specification

Triggered from the option selector inside a variant. This is a *shorter* drawer. It must feel lighter than Add Variant, because it is a smaller decision.

**Step 1 — Basis**
- Parent Variant *(pre-filled with current, changeable)*
- Order Quantity *(required)* — the primary input
- MOQ and Quoted MOQ *(default to Order Quantity, editable)*
- Option Name *(auto-generated from quantity: "10,000 pcs", editable)*

**Step 2 — Duplicate from** *(optional)*
Pick an existing option to inherit manual rate overrides from. Default: inherit from the variant's base option.

**Step 3 — Quantity-sensitive recalculation** — a visible checklist, all on by default:

- ☑ Fabric & yarn rate breaks
- ☑ Dyeing minimum lot charge
- ☑ Printing screen / plate amortisation
- ☑ Embroidery setup amortisation
- ☑ Trim and label MOQ effects
- ☑ Carton fill efficiency
- ☑ Wastage percentage bands

Unchecking an item means "hold this value constant from the source option." This checklist is the honest answer to *"why did the price change?"* and it should be preserved and viewable on the created option.

**Step 4 — Immediate delta**
Before confirming, show the comparison inline:

> `Base (3,000 pcs) ₹248.60/pc → New (10,000 pcs) ₹221.40/pc · −₹27.20 (−10.9%)`
> `Largest movers: Printing setup −₹14.80 · Fabric rate −₹8.10 · Carton fill −₹2.40`

Primary action: **Create Option**.

**Locked fields inside an Option.** All specification fields are visibly locked with a lock icon and a tooltip: *"Specification is set by the variant. To change how the product is made, create a new variant or edit the parent."* A clear escape hatch is provided: **"Edit parent variant"** and **"Promote this option to a new variant."**

That last action matters. Users *will* want to change a spec inside an option. Rather than forbidding it, offer promotion — it converts a mistake into a correct action.

---

## 6. The Network Diagram

### What it is for

Not decoration. The diagram exists to answer three questions faster than a table can:

1. **What is the route?** — the actual manufacturing path this configuration implies.
2. **Where is the money?** — which nodes carry the cost.
3. **Where is the waste?** — which steps lose material.

If it does not answer those three at a glance, it has failed regardless of how it looks.

### Layout

**Left-to-right, in swimlanes that correspond exactly to the costing spine.** The user reads the same order in the diagram as in the forms — this is what makes the two feel like one product.

```
CONTEXT → MATERIAL → COMPONENTS → PROCESS CHAIN → TRIMS → PACKAGING → ROLL-UP
```

- **Deterministic layout.** Identical configuration produces an identical diagram every time. No physics simulation, no drift. Costing people compare screenshots; the diagram must be stable enough to compare.
- **Process chain flows in true manufacturing sequence** — derived, left to right, with inapplicable processes shown greyed and dashed rather than hidden. Seeing that Dyeing is *deliberately absent* is more valuable than not seeing Dyeing at all.
- **Convergence at the roll-up.** All lanes terminate in a single Total Direct Cost node on the right.

### Node cards — what every node shows

Every node is a compact card, not a labelled dot. Minimum content:

```
┌────────────────────────────┐
│ ▸ DYEING            ₡ 12%  │   ← category colour bar + share of total
│ Reactive · Navy 19-4052    │   ← specification line
│ 1,240 m @ ₹18.50/m         │   ← quantity @ rate
│ Loss 3.5%                  │   ← the loss/wastage figure
│ ₹34.20/pc                  │   ← cost contribution, largest type on card
└────────────────────────────┘
```

**Visual encoding:**
- **Colour by category** — Material, Component, Process, Trim, Packaging, Roll-Up. Six colours, used consistently across diagram, comparison table and report.
- **Node size or border weight by cost share** — the expensive steps should be visibly heavier. A user should find the top cost driver without reading a number.
- **Top 3 cost drivers carry a "driver" badge.**
- **Edge labels carry cumulative cost** — the running cost as it flows through the chain. This turns the diagram into a visual cost build-up.
- **Edge thickness by material quantity flowing**, with visible narrowing where loss occurs.
- **Warning marker** on any node with incomplete data or a logical conflict.

### Interaction

- **Click a node → the same editable card as the form.** Edit, save, and the node, the roll-up, the comparison table and the report all update together. This is the single interaction that proves the "one product" principle to the user.
- **Hover a node → highlight its full traceability path** — upstream inputs and downstream contribution, everything else dimmed.
- **Toggle overlays** — Cost · Consumption · Wastage · Lead Time. Same diagram, different data painted onto it.
- **Variant switching in place** — switching variant redraws the diagram; nodes that differ from the compared variant pulse or carry a delta chip.
- **Collapse to lane summaries** for presentation to a buyer; expand for working.

### Empty and partial states

A node for a section not yet configured appears as a dashed placeholder with a direct call to action — *"Processes not configured — Configure"* — rather than being absent. **The skeleton of the full costing should be visible from the first second**, so the user always knows how much is left to do.

---

## 7. The Configuration Comparison Table

A full tabular view of the entire configuration, structured like the costing report so that the two are recognisably the same document.

### Structure

- **Rows = variables**, in exact costing-spine order, grouped under collapsible section headers (0 through 7). Every variable from the dictionary appears — nothing is hidden from comparison.
- **Columns = the things being compared.** Column header is two-tier: **Variant name** on top, **Option (quantity)** beneath. So a user can place `Base / 3,000` next to `Base / 10,000` next to `Pigment / 10,000` in one view.
- **First column is sticky.** Section headers are sticky. Long tables must stay navigable.
- **Footer roll-up rows are pinned** — Raw Material, Process, Packaging, Total Direct Cost, and cost per piece. These stay visible while scrolling the detail.

### Controls

- **"Show differences only"** — the most-used control on the screen. Collapses all identical rows, leaving only what actually differs between the selected columns. Should be one click, prominently placed, and remembered.
- **Set a baseline column.** All other columns then display both absolute value and delta from baseline (`₹18.50` `+₹2.30`). Deltas colour-coded, with the convention stated in the legend: *lower cost = green*.
- **Section filter** — compare only Processes, only Trims, etc.
- **Add column** — inline, opens the same Add Variant / Add Option drawers. Comparison is where users realise they need another scenario; let them create it without leaving.
- **Export** to the costing report format and to spreadsheet, preserving section grouping.

### Design notes

- Numeric columns right-aligned, one consistent decimal convention, units in the row label not repeated in every cell.
- Derived rows visually distinct from entered rows — a costing head must be able to see instantly which numbers were typed and which were calculated.
- Any cell with a manual override carries a small marker and a hover showing the master value it replaced. Overrides are where costing errors hide; surface them.
- Rows where a variable is **not applicable** to a variant show `—`, never `0`. A zero is a claim; a dash is an absence, and confusing the two produces wrong totals in the reader's head.

---

## 8. Acceptance Criteria

The work is done when a costing executive can do all of the following without assistance:

1. Open an article and see all eight sections with honest completion states.
2. Change Fabric Availability from Ready to Greige and watch the Derived Route Ribbon and the diagram's process chain change accordingly, with no data lost.
3. Click any node in the diagram, edit a rate, and see the same number change in the form, the roll-up, the comparison table and the report.
4. Click **Add Variant**, duplicate the base, rename it, and land in a working new variant that appears as a tab, a diagram and a comparison column.
5. Click **Add Option**, enter 10,000 pieces, and see a costed option with an explained delta against the base — including which quantity-sensitive variables moved.
6. Open the comparison table, select three variant/option pairs, switch on "differences only", and read the complete story of what differs and what it costs.
7. Expand any line in the Direct Cost Roll-Up and walk it back to the exact input that produced it.
8. Find no number anywhere on the screen that contradicts the same number elsewhere.
