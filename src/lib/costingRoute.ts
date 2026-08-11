/**
 * Derived manufacturing route.
 *
 * The route is never user-selected — it is read from the article's fabric
 * availability and the process fields that are actually populated, so every
 * step carries a plain-English reason for being in or out.
 */

import type { ConfigState } from "./fabricConfig";

const toNum = (s?: string) => {
  const n = parseFloat((s ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export type Availability = "ready" | "greige" | "yarn";
export type DerivedStep = { id: string; label: string; active: boolean; reason: string };
export type DerivedRoute = { availability: Availability; label: string; steps: DerivedStep[] };

const AVAILABILITY_LABEL: Record<Availability, string> = {
  ready: "Ready Fabric route",
  greige: "Greige Fabric route",
  yarn: "Yarn route",
};

const AVAILABILITY_NOUN: Record<Availability, string> = {
  ready: "bought ready",
  greige: "Greige",
  yarn: "bought as yarn",
};

const availabilityOf = (state: ConfigState): Availability => {
  const raw = (state.mfgRoute?.value ?? state.fabricSource?.value ?? "").toLowerCase();
  if (raw.startsWith("ready")) return "ready";
  if (raw.startsWith("greige")) return "greige";
  return "yarn";
};

const isSet = (v?: string) => {
  const t = (v ?? "").trim().toLowerCase();
  return t !== "" && t !== "none" && t !== "no" && t !== "not required";
};

export function deriveRoute(state: ConfigState): DerivedRoute {
  const availability = availabilityOf(state);
  const fabricNote =
    availability === "ready"
      ? "Not applicable — the fabric is bought ready."
      : availability === "greige"
        ? "Included because the fabric is Greige."
        : "Included because the yarn is bought in.";

  const printing = isSet(state.printingMethod?.value) || isSet(state.printTech?.value);
  const embDots = toNum(state.embDots?.value);
  const washing = toNum(state.washPerKg?.value) > 0 || isSet(state.washType?.value);

  const steps: DerivedStep[] = [
    {
      id: "yarnPrep",
      label: "Yarn Preparation",
      active: availability === "yarn",
      reason:
        availability === "yarn"
          ? "Included because the yarn is bought in."
          : `Not applicable — the fabric is ${AVAILABILITY_NOUN[availability]}.`,
    },
    {
      id: "dyeing",
      label: "Dyeing",
      active: availability !== "ready",
      reason:
        availability === "ready" ? "Not applicable — the fabric is bought ready." : fabricNote,
    },
    {
      id: "weaving",
      label: "Weaving / Knitting",
      active: availability === "yarn",
      reason:
        availability === "yarn"
          ? "Included because the fabric is woven from bought-in yarn."
          : `Not applicable — the fabric is ${AVAILABILITY_NOUN[availability]}.`,
    },
    {
      id: "printing",
      label: "Printing",
      active: printing,
      reason: printing
        ? "Included because a printing method is selected."
        : "Not applicable — no printing method is selected.",
    },
    {
      id: "embroidery",
      label: "Embroidery",
      active: embDots > 0,
      reason:
        embDots > 0
          ? `Included because ${embDots} embroidery dots are specified.`
          : "Not applicable — no embroidery dots are specified.",
    },
    {
      id: "washing",
      label: "Washing",
      active: washing,
      reason: washing
        ? "Included because a wash type or per-kg wash rate is set."
        : "Not applicable — no washing is specified.",
    },
    { id: "finishing", label: "Finishing", active: true, reason: "Always part of the route." },
    { id: "cutting", label: "Cutting", active: true, reason: "Always part of the route." },
    {
      id: "stitching",
      label: "Stitching / Assembly",
      active: true,
      reason: "Always part of the route.",
    },
    {
      id: "hemming",
      label: "Hemming / Edge Finish",
      active: true,
      reason: "Always part of the route.",
    },
    { id: "packing", label: "Packing", active: true, reason: "Always part of the route." },
  ];

  return { availability, label: AVAILABILITY_LABEL[availability], steps };
}
