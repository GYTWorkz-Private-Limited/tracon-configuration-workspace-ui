/**
 * Slot catalogues — what a style CAN have, before anything is chosen.
 *
 * A style defines which slots exist; the costing instance fills them. Keeping
 * the catalogue here means the library can say "this fabric fits Front / Back /
 * Contrast" without any screen hardcoding a list.
 */

import type { FabricPath } from "./types";

export const PRODUCT_TYPES = [
  "Quilt",
  "Comforter",
  "Sham",
  "Cushion",
  "Table Cloth",
  "Table Runner",
  "Placemat",
  "Kitchen Linen",
  "Curtain",
  "Other",
] as const;

export type SizePreset = {
  id: string;
  name: string;
  code: string;
  variant: "Base" | "Derived";
  finishedWidth: number;
  finishedLength: number;
  unit: "Inch";
  /** relative to the base size — consumption scales on this */
  consumptionFactor: number | "Auto";
};

/**
 * Size is a configurable variable because it drives consumption directly.
 * `consumptionFactor: "Auto"` means the engine derives it from the finished
 * dimensions rather than a stated multiplier.
 */
export const SIZE_PRESETS: SizePreset[] = [
  {
    id: "SZ-TWIN",
    name: "Twin",
    code: "TWIN-90X96",
    variant: "Derived",
    finishedWidth: 90,
    finishedLength: 96,
    unit: "Inch",
    consumptionFactor: "Auto",
  },
  {
    id: "SZ-KING",
    name: "King",
    code: "KING-108X96",
    variant: "Base",
    finishedWidth: 108,
    finishedLength: 96,
    unit: "Inch",
    consumptionFactor: "Auto",
  },
  {
    id: "SZ-SHAM",
    name: "Sham",
    code: "SHAM-20X26",
    variant: "Derived",
    finishedWidth: 20,
    finishedLength: 26,
    unit: "Inch",
    consumptionFactor: "Auto",
  },
];

/* ------------------------------------------------------------------ *
 * Component slots
 * ------------------------------------------------------------------ */

export const FABRIC_SLOTS = [
  "Front Fabric",
  "Back Fabric",
  "Main Fabric",
  "Contrast Fabric",
  "Border",
  "Flange",
  "Piping / Edge",
  "Lining",
  "Pocket",
  "Pocket Lining",
  "Binding",
  "Other Fabric Component",
] as const;

export const FILLING_SLOTS = [
  "Filling",
  "Wadding",
  "Padding",
  "Interlining",
  "Other Filling",
] as const;

/** Quilting is a PROCESS applied to a component, never a material of its own. */
export const QUILTING_TYPES = [
  "No Quilting",
  "Heart",
  "Diamond",
  "Channel",
  "Box",
  "Wave",
  "Custom Pattern",
] as const;

export const DECORATION_SLOTS = [
  "Embroidery",
  "Appliqué",
  "Print",
  "Embellishment",
  "Sequin",
  "Beadwork",
  "Patch",
  "Other Decoration",
] as const;

export const ACCESSORY_SLOTS = {
  Closures: ["Zipper", "Button", "Press Button", "Hook", "Eye", "Velcro"],
  Labels: ["Care Label", "Brand Label", "Size Label", "Hang Tag", "Barcode Label"],
  Other: ["Piping", "Binding", "Cord", "Ribbon", "Elastic", "Patch", "Hanger", "Other Trim"],
} as const;

/* ------------------------------------------------------------------ *
 * Fabric costing paths
 * ------------------------------------------------------------------ */

/**
 * Every fabric reaches its final rate one of three ways. The path decides which
 * variables are real for that fabric — a Ready Fabric has no loom or yarn
 * inputs, and a Yarn-Dyed Woven cannot be costed without them.
 */
export const FABRIC_PATHS: Record<string, FabricPath> = {
  ready: {
    id: "ready",
    label: "A · Ready Fabric",
    chain: ["Ready Fabric", "Applicable Process", "Final Fabric Rate"],
    stages: [
      {
        stage: "Fabric",
        variables: [
          "Fabric Code",
          "Fabric Name",
          "Fabric Type",
          "Composition",
          "GSM",
          "Width",
          "Costing Width",
          "Construction",
          "Colour",
          "Shade",
          "Certification",
          "Supplier",
          "Rate",
          "Rate Unit",
        ],
      },
      { stage: "Losses", variables: ["Shrinkage %", "Wastage %"] },
      { stage: "Output", variables: ["Consumption", "Cost / Piece"] },
    ],
  },
  greige: {
    id: "greige",
    label: "B · Greige + Process",
    chain: [
      "Greige Fabric",
      "Dyeing / Printing",
      "Finishing",
      "Shrinkage / Wastage",
      "Final Fabric Rate",
    ],
    stages: [
      {
        stage: "Greige",
        variables: [
          "Greige Fabric",
          "Greige Width",
          "GSM",
          "Construction",
          "Supplier",
          "Greige Rate",
        ],
      },
      {
        stage: "Dyeing",
        variables: [
          "Dyeing Type",
          "Colour",
          "Shade",
          "Dye Type",
          "Dyeing Supplier",
          "Dyeing Rate",
          "Rate Unit",
        ],
      },
      {
        stage: "Printing",
        variables: [
          "Print Type",
          "Print Method",
          "No. of Screens",
          "Colour Coverage",
          "Placement",
          "Supplier",
          "Print Rate",
        ],
      },
      { stage: "Finishing", variables: ["Finish Type", "Process", "Supplier", "Rate"] },
      { stage: "Losses", variables: ["Shrinkage %", "Wastage %", "Process Loss %"] },
    ],
  },
  ydw: {
    id: "ydw",
    label: "C · Yarn-Dyed Woven",
    chain: ["Yarn", "Dyeing", "Weaving", "Finishing", "Shrinkage / Wastage", "Final Fabric Rate"],
    stages: [
      {
        stage: "Yarn",
        variables: [
          "Yarn Type",
          "Yarn Count",
          "Yarn Composition",
          "Yarn Supplier",
          "Yarn Rate ₹/kg",
          "Warp Consumption kg/m",
          "Weft Consumption kg/m",
        ],
      },
      { stage: "Dyeing", variables: ["Dyeing Type", "Dyeing Rate ₹/kg", "Colour", "Shade"] },
      {
        stage: "Weaving",
        variables: [
          "Loom Type",
          "Reed",
          "Pick",
          "Warp Density",
          "Weft Density",
          "Weaving Rate ₹/m",
        ],
      },
      { stage: "Finishing", variables: ["Finishing Process", "Finishing Rate ₹/m"] },
      { stage: "Losses", variables: ["Shrinkage %", "Wastage %"] },
    ],
  },
};

/** The 23 common fields every selected component carries, in reading order. */
export const COMPONENT_MATERIAL_FIELDS = [
  "Component Name",
  "Material Name",
  "Material Code",
  "Material Type",
  "Fabric Type",
  "Composition",
  "GSM",
  "Width",
  "Costing Width",
  "Colour",
  "Shade",
  "Pantone",
  "Construction",
  "Yarn Count",
  "Supplier",
  "Certification",
  "Availability",
  "Rate",
  "Rate Unit",
  "Consumption",
  "Wastage",
  "Shrinkage",
  "Component Cost",
] as const;
