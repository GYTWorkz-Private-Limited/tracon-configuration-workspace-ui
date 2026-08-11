/**
 * Product data sourced from the working cost sheet
 * (XYZ-030-26-27 / Old 482-25-26 · SS27 working file).
 *
 * The Excel header block supplies the buyer, POD reference, supplier, colour,
 * design references, currency and exchange rate; the three table-linen
 * articles below (Placemat, Runner, Napkin) reuse those values verbatim.
 */

export const EXCEL_POD = {
  id: "POD-2046",
  buyer: "Zara Home",
  buyerRef: "ZH-SS27-TBLTOP-01",
  preparedBy: "PDL",
  season: "Spring / Summer SS27",
  currency: "USD",
  fxRate: "60.00",
  costSheetVersion: "v1.0 · 27/03/2026",
  supplier: "TESPL",
} as const;

import placematImg from "@/assets/article-placemat.png";
import runnerImg from "@/assets/article-runner.png";
import napkinImg from "@/assets/article-napkin.png";

export const ARTICLE_IMAGES: Record<string, string> = {
  placemat: placematImg,
  runner: runnerImg,
  napkin: napkinImg,
};

export type ExcelArticle = {
  key: string;
  image?: string;
  name: string;
  articleNo: string;
  designNo: string;
  styleNo: string;
  description: string;
  colour: string;
  size: string;
  moq: string;
  supplier: string;
  composition: string;
  construction: string;
  remarks: string;
  srfRef: string;
};

export const EXCEL_ARTICLES: ExcelArticle[] = [
  {
    key: "placemat",
    name: "Placemat",
    articleNo: "6939227",
    designNo: "5564727 PRN",
    styleNo: "SS27-PM-01",
    description: "Front: all over printed fabric, mitred border, single needle stitch",
    colour: "Warm / Multi",
    size: '13" × 19"',
    moq: "3,000 pcs",
    supplier: "TESPL",
    composition: "100% Cotton",
    construction: "144 TC / Flat weave",
    remarks: "Safe Guard · 60 days payment terms",
    srfRef: "SRF-1042",
  },
  {
    key: "runner",
    name: "Runner",
    articleNo: "6979727",
    designNo: "5564727 PRN",
    styleNo: "SS27-RN-01",
    description: "Front: all over printed fabric, hemmed ends, coordinated with placemat",
    colour: "Warm / Multi",
    size: '14" × 72"',
    moq: "1,500 pcs",
    supplier: "TESPL",
    composition: "100% Cotton",
    construction: "144 TC / Flat weave",
    remarks: "Reviewed by KK/JR/GK · 30.04.2026",
    srfRef: "SRF-1031",
  },
  {
    key: "napkin",
    name: "Napkin",
    articleNo: "6980227",
    designNo: "5424426 Solid",
    styleNo: "SS27-NP-01",
    description: "Solid dyed base, mitred corner, double needle hem",
    colour: "Cool / Multi",
    size: '20" × 20"',
    moq: "6,000 pcs",
    supplier: "TESPL",
    composition: "100% Cotton",
    construction: "144 TC / Flat weave",
    remarks: "Set component — priced with placemat programme",
    srfRef: "SRF-1033",
  },
];
