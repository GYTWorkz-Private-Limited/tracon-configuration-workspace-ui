// Shared demo data for Inquiries + SRFs modules
export type InquiryStage = "new" | "review" | "ready" | "srf_created";
export type SrfStage =
  | "created"
  | "design"
  | "ready_costing"
  | "costing_progress"
  | "costing_complete"
  | "quotation_ready";

const traconImg = (id: string, w = 720, h = 540) =>
  `https://static.wixstatic.com/media/${id}/v1/fill/w_${w},h_${h},al_c,q_85,enc_auto/${id}`;

export const IMG = {
  towel: traconImg("a63c28_b23ea9674fc04064946eea95f7ab9fd1~mv2_d_3524_2349_s_2.jpg"),
  cushion: traconImg("a63c28_1aff8307b9304f78b91b0e5c4e53eee5~mv2_d_2000_1333_s_2.jpg"),
  throw: traconImg("a63c28_718bb02c2dfd403dbb6376f7299018c8~mv2.jpg"),
  bedding: traconImg("a63c28_b4389c444d3c43a8a931b8a6b91a8fd0~mv2_d_1868_2000_s_2.jpg", 720, 720),
  curtain: traconImg("a63c28_79f2650b5283422e85b4747dabece50e~mv2.jpg"),
  scarf: traconImg("a63c28_7878c8415d994c2baa7861bbce6f2c43~mv2_d_1400_1400_s_2.jpg", 720, 720),
};

export type Inquiry = {
  id: string;
  image: string;
  buyer: string;
  buyerCompany: string;
  contact: { name: string; email: string };
  category: string;
  productDescription: string;
  season: string;
  targetPrice: string;
  moq: string;
  requiredDate: string;
  source: "Email" | "Portal" | "Meeting" | "Referral";
  receivedOn: string;
  aiStatus: "Complete" | "Partial" | "In Review" | "Failed";
  missing: string[];
  assignedTo: { name: string; initials: string };
  stage: InquiryStage;
  fabricPreference: string;
  constructionPreference: string;
  specialRequirements: string;
  attachments: { name: string; type: string; size: string }[];
  aiSummary: string;
  similarTo?: { pct: number; product: string; buyer: string; year: string };
  srfId?: string; // when SRF has been generated
};

export const INQUIRIES: Inquiry[] = [
  {
    id: "INQ-2418",
    image: IMG.towel,
    buyer: "Marks & Spencer",
    buyerCompany: "Marks & Spencer Group plc",
    contact: { name: "Sonia Whitfield", email: "s.whitfield@marksandspencer.com" },
    category: "Bath Towel",
    productDescription: "Waffle Bath Towel, 600 GSM, retail-ready packaging for AW26 core range.",
    season: "AW 2026",
    targetPrice: "£4.80 FOB",
    moq: "2,500 pcs",
    requiredDate: "12 Mar 2026",
    source: "Email",
    receivedOn: "12m ago",
    aiStatus: "Partial",
    missing: ["Packaging spec", "Care label"],
    assignedTo: { name: "Gautam Kitclu", initials: "GK" },
    stage: "new",
    fabricPreference: "100% Ringspun Cotton, combed",
    constructionPreference: "Waffle weave, dobby border",
    specialRequirements: "OEKO-TEX Standard 100, low-lint",
    attachments: [
      { name: "MS_Waffle_Towel_TechPack.pdf", type: "Tech Pack", size: "2.4 MB" },
      { name: "Inquiry_MarksSpencer_AW26.msg", type: "Email", size: "184 KB" },
      { name: "Reference_Ivory.jpg", type: "Image", size: "1.1 MB" },
    ],
    aiSummary:
      "M&S is looking for a soft-hand waffle bath towel at 600 GSM for their AW26 core collection. Volume 2,500 pcs at £4.80 FOB, needed by Mar 12. Packaging and care label spec are not provided.",
    similarTo: { pct: 91, product: "Waffle Bath Towel Ivory", buyer: "M&S", year: "AW 2024" },
  },
  {
    id: "INQ-2415",
    image: IMG.throw,
    buyer: "Zara Home",
    buyerCompany: "Inditex S.A.",
    contact: { name: "Marta Núñez", email: "m.nunez@zarahome.com" },
    category: "Throw",
    productDescription: "Herringbone woven throw in cotton/linen blend with fringed edges.",
    season: "SS 2026",
    targetPrice: "€12.50 FOB",
    moq: "1,800 pcs",
    requiredDate: "28 Feb 2026",
    source: "Portal",
    receivedOn: "1h ago",
    aiStatus: "Complete",
    missing: [],
    assignedTo: { name: "Ananya R.", initials: "AR" },
    stage: "review",
    fabricPreference: "60% Cotton / 40% Linen, 320 GSM",
    constructionPreference: "Herringbone weave, yarn-dyed",
    specialRequirements: "Hand-knotted fringe, no chemical softener",
    attachments: [
      { name: "ZaraHome_Throw_Spec.pdf", type: "Tech Pack", size: "1.8 MB" },
      { name: "Colour_Palette.pdf", type: "PDF", size: "620 KB" },
    ],
    aiSummary:
      "Zara Home requests a herringbone throw for SS26, 320 GSM cotton/linen with fringed edges. Complete spec received, ready for internal review.",
    similarTo: { pct: 74, product: "Chevron Throw", buyer: "Zara Home", year: "AW 2024" },
  },
  {
    id: "INQ-2411",
    image: IMG.scarf,
    buyer: "Uniqlo",
    buyerCompany: "Fast Retailing",
    contact: { name: "Kenji Sato", email: "k.sato@uniqlo.com" },
    category: "Scarf",
    productDescription: "Silk-blend scarf 90×90 cm with digital print artwork.",
    season: "SS 2026",
    targetPrice: "$8.20 FOB",
    moq: "3,000 pcs",
    requiredDate: "15 Apr 2026",
    source: "Meeting",
    receivedOn: "3h ago",
    aiStatus: "Complete",
    missing: [],
    assignedTo: { name: "Priya S.", initials: "PS" },
    stage: "ready",
    fabricPreference: "70% Silk / 30% Viscose",
    constructionPreference: "Plain weave, digital print",
    specialRequirements: "Hand-rolled hem",
    attachments: [
      { name: "Uniqlo_Scarf_TechPack.pdf", type: "Tech Pack", size: "3.1 MB" },
      { name: "Artwork_v3.ai", type: "Artwork", size: "12 MB" },
    ],
    aiSummary:
      "Uniqlo has fully specified a silk-blend digital-print scarf for SS26. All commercials confirmed. Ready to generate SRF.",
  },
  {
    id: "INQ-2402",
    image: IMG.cushion,
    buyer: "West Elm",
    buyerCompany: "Williams-Sonoma Inc.",
    contact: { name: "Rachel Kim", email: "rkim@westelm.com" },
    category: "Cushion Cover",
    productDescription: "Luxury velvet cushion cover 45×45 cm, piped edge, hidden zip.",
    season: "AW 2026",
    targetPrice: "$6.90 FOB",
    moq: "1,200 pcs",
    requiredDate: "20 May 2026",
    source: "Email",
    receivedOn: "5h ago",
    aiStatus: "Complete",
    missing: [],
    assignedTo: { name: "Gautam Kitclu", initials: "GK" },
    stage: "srf_created",
    srfId: "SRF-1042",
    fabricPreference: "100% Polyester Velvet",
    constructionPreference: "Piped edge, invisible zip",
    specialRequirements: "Colourfast to light 4+",
    attachments: [{ name: "WestElm_Cushion_Spec.pdf", type: "Tech Pack", size: "1.6 MB" }],
    aiSummary:
      "West Elm cushion cover with complete spec. SRF generated and handed to the internal team.",
    similarTo: { pct: 91, product: "Velvet Cushion 40cm", buyer: "West Elm", year: "AW 2024" },
  },
  {
    id: "INQ-2398",
    image: IMG.bedding,
    buyer: "IKEA",
    buyerCompany: "IKEA of Sweden AB",
    contact: { name: "Erik Lindqvist", email: "erik.l@ikea.com" },
    category: "Bedding Set",
    productDescription: "Percale bedding set, queen size, GOTS-certified organic cotton.",
    season: "SS 2026",
    targetPrice: "$24.00 FOB",
    moq: "5,000 sets",
    requiredDate: "30 Jun 2026",
    source: "Portal",
    receivedOn: "yesterday",
    aiStatus: "In Review",
    missing: ["Certification proof"],
    assignedTo: { name: "Rahul M.", initials: "RM" },
    stage: "ready",
    fabricPreference: "100% Organic Cotton Percale, 200 TC",
    constructionPreference: "1 flat sheet + 1 fitted + 2 pillowcases",
    specialRequirements: "GOTS certified, retail box",
    attachments: [
      { name: "IKEA_Bedding_RFQ.pdf", type: "RFQ", size: "2.9 MB" },
      { name: "GOTS_Requirements.pdf", type: "PDF", size: "480 KB" },
    ],
    aiSummary:
      "IKEA requests a GOTS-certified percale bedding set. AI is awaiting proof of certification chain before completing extraction.",
    similarTo: { pct: 82, product: "Percale Set — King", buyer: "IKEA", year: "SS 2025" },
  },
  {
    id: "INQ-2390",
    image: IMG.curtain,
    buyer: "John Lewis",
    buyerCompany: "John Lewis Partnership",
    contact: { name: "Oliver Reed", email: "o.reed@johnlewis.co.uk" },
    category: "Curtain",
    productDescription: "Blackout curtain panel, 3-layer, grommet top, fire-rated.",
    season: "AW 2026",
    targetPrice: "£18.50 FOB",
    moq: "1,500 pcs",
    requiredDate: "10 Jul 2026",
    source: "Referral",
    receivedOn: "yesterday",
    aiStatus: "Partial",
    missing: ["Fire certification", "Grommet spec"],
    assignedTo: { name: "Ananya R.", initials: "AR" },
    stage: "new",
    fabricPreference: "100% Polyester, triple-woven",
    constructionPreference: "3-layer blackout, grommet top",
    specialRequirements: "BS 5867 Part 2 Type B fire rating",
    attachments: [{ name: "JLP_Curtain_Brief.pdf", type: "Brief", size: "1.2 MB" }],
    aiSummary:
      "John Lewis needs a fire-rated blackout curtain panel. Fire certification and grommet hardware spec are missing from the brief.",
  },
  {
    id: "INQ-2384",
    image: IMG.cushion,
    buyer: "Anthropologie",
    buyerCompany: "URBN Inc.",
    contact: { name: "Hannah Blake", email: "h.blake@anthropologie.com" },
    category: "Cushion Cover",
    productDescription: "Boho-print cotton cushion cover 50×50 cm, tassel corners.",
    season: "SS 2026",
    targetPrice: "$5.60 FOB",
    moq: "1,000 pcs",
    requiredDate: "18 Apr 2026",
    source: "Email",
    receivedOn: "2d ago",
    aiStatus: "Complete",
    missing: [],
    assignedTo: { name: "Priya S.", initials: "PS" },
    stage: "ready",
    fabricPreference: "100% Cotton Slub, 220 GSM",
    constructionPreference: "Digital print, tassel trim",
    specialRequirements: "AZO-free dyes",
    attachments: [{ name: "Antro_Cushion_TP.pdf", type: "Tech Pack", size: "2.1 MB" }],
    aiSummary: "Anthropologie boho cushion for SS26, fully specified. Ready to convert to SRF.",
  },
  {
    id: "INQ-2376",
    image: IMG.bedding,
    buyer: "Crate & Barrel",
    buyerCompany: "CB2 / Crate & Barrel",
    contact: { name: "Daniel Ortiz", email: "d.ortiz@crateandbarrel.com" },
    category: "Bedding Set",
    productDescription: "Sateen bedding set, king size, 400 TC with contrast piping.",
    season: "AW 2026",
    targetPrice: "$32.00 FOB",
    moq: "2,500 sets",
    requiredDate: "22 Jul 2026",
    source: "Portal",
    receivedOn: "3d ago",
    aiStatus: "Complete",
    missing: [],
    assignedTo: { name: "Gautam Kitclu", initials: "GK" },
    stage: "srf_created",
    srfId: "SRF-1041",
    fabricPreference: "100% Cotton Sateen, 400 TC",
    constructionPreference: "Contrast piping, mitred corners",
    specialRequirements: "Retail-ready gift box",
    attachments: [{ name: "CB_Sateen_Bedding.pdf", type: "Tech Pack", size: "2.7 MB" }],
    aiSummary: "Crate & Barrel sateen bedding for AW26. Spec complete, SRF generated.",
  },
];

// SRFs — internal working documents derived from an inquiry
export type Srf = {
  id: string;
  inquiryId: string;
  image: string;
  productName: string;
  buyer: string;
  category: string;
  season: string;
  targetPrice: string;
  moq: string;
  requiredDate: string;
  stage: SrfStage;
  version: number;
  progress: number; // 0-100
  team: { name: string; initials: string }[];
  lastUpdated: string;
  documents: number;
  notes: number;
  similarTo?: { pct: number; product: string; buyer: string; year: string };
};

export const SRFS: Srf[] = [
  {
    id: "SRF-1042",
    inquiryId: "INQ-2402",
    image: IMG.cushion,
    productName: "Luxury Velvet Cushion 45cm",
    buyer: "West Elm",
    category: "Cushion Cover",
    season: "AW 2026",
    targetPrice: "$6.90",
    moq: "1,200 pcs",
    requiredDate: "20 May 2026",
    stage: "design",
    version: 2,
    progress: 42,
    team: [
      { name: "Gautam Kitclu", initials: "GK" },
      { name: "Priya S.", initials: "PS" },
    ],
    lastUpdated: "2h ago",
    documents: 6,
    notes: 4,
    similarTo: { pct: 91, product: "Velvet Cushion 40cm", buyer: "West Elm", year: "AW 2024" },
  },
  {
    id: "SRF-1039",
    inquiryId: "INQ-2381",
    image: IMG.towel,
    productName: "Zero-Twist Bath Towel 500 GSM",
    buyer: "H&M Home",
    category: "Bath Towel",
    season: "SS 2026",
    targetPrice: "€5.40",
    moq: "3,000 pcs",
    requiredDate: "18 Apr 2026",
    stage: "created",
    version: 1,
    progress: 12,
    team: [{ name: "Ananya R.", initials: "AR" }],
    lastUpdated: "35m ago",
    documents: 3,
    notes: 1,
  },
  {
    id: "SRF-1035",
    inquiryId: "INQ-2375",
    image: IMG.cushion,
    productName: "Velvet Cushion — Emerald",
    buyer: "Zara Home",
    category: "Cushion Cover",
    season: "SS 2026",
    targetPrice: "€7.20",
    moq: "800 pcs",
    requiredDate: "05 May 2026",
    stage: "ready_costing",
    version: 3,
    progress: 68,
    team: [
      { name: "Rahul M.", initials: "RM" },
      { name: "Gautam Kitclu", initials: "GK" },
    ],
    lastUpdated: "5h ago",
    documents: 9,
    notes: 7,
    similarTo: { pct: 78, product: "Velvet Cushion Ruby", buyer: "Zara Home", year: "AW 2024" },
  },
  {
    id: "SRF-1031",
    inquiryId: "INQ-2362",
    image: IMG.throw,
    productName: "Linen Throw — Natural",
    buyer: "West Elm",
    category: "Throw",
    season: "AW 2026",
    targetPrice: "$14.00",
    moq: "2,000 pcs",
    requiredDate: "15 Jun 2026",
    stage: "costing_progress",
    version: 4,
    progress: 74,
    team: [{ name: "Priya S.", initials: "PS" }],
    lastUpdated: "yesterday",
    documents: 11,
    notes: 6,
  },
  {
    id: "SRF-1024",
    inquiryId: "INQ-2340",
    image: IMG.bedding,
    productName: "Percale Bedding Set — Queen",
    buyer: "IKEA",
    category: "Bedding Set",
    season: "SS 2026",
    targetPrice: "$24.00",
    moq: "5,000 sets",
    requiredDate: "30 Jun 2026",
    stage: "costing_complete",
    version: 5,
    progress: 92,
    team: [
      { name: "Rahul M.", initials: "RM" },
      { name: "Ananya R.", initials: "AR" },
      { name: "Gautam Kitclu", initials: "GK" },
    ],
    lastUpdated: "2d ago",
    documents: 14,
    notes: 9,
  },
  {
    id: "SRF-1019",
    inquiryId: "INQ-2330",
    image: IMG.scarf,
    productName: "Silk Scarf — Signature Print",
    buyer: "Uniqlo",
    category: "Scarf",
    season: "SS 2026",
    targetPrice: "$8.20",
    moq: "3,000 pcs",
    requiredDate: "22 Apr 2026",
    stage: "quotation_ready",
    version: 6,
    progress: 100,
    team: [{ name: "Priya S.", initials: "PS" }],
    lastUpdated: "3d ago",
    documents: 18,
    notes: 12,
    similarTo: { pct: 88, product: "Silk Scarf Floral", buyer: "Uniqlo", year: "SS 2025" },
  },
  {
    id: "SRF-1041",
    inquiryId: "INQ-2376",
    image: IMG.bedding,
    productName: "Sateen Bedding Set — King",
    buyer: "Crate & Barrel",
    category: "Bedding Set",
    season: "AW 2026",
    targetPrice: "$32.00",
    moq: "2,500 sets",
    requiredDate: "22 Jul 2026",
    stage: "created",
    version: 1,
    progress: 8,
    team: [{ name: "Gautam Kitclu", initials: "GK" }],
    lastUpdated: "1h ago",
    documents: 2,
    notes: 0,
  },
  {
    id: "SRF-1036",
    inquiryId: "INQ-2384",
    image: IMG.cushion,
    productName: "Boho Slub Cushion 50cm",
    buyer: "Anthropologie",
    category: "Cushion Cover",
    season: "SS 2026",
    targetPrice: "$5.60",
    moq: "1,000 pcs",
    requiredDate: "18 Apr 2026",
    stage: "ready_costing",
    version: 2,
    progress: 55,
    team: [{ name: "Priya S.", initials: "PS" }],
    lastUpdated: "4h ago",
    documents: 5,
    notes: 2,
  },
  {
    id: "SRF-1033",
    inquiryId: "INQ-2360",
    image: IMG.towel,
    productName: "Terry Hand Towel — Sand",
    buyer: "H&M Home",
    category: "Hand Towel",
    season: "SS 2026",
    targetPrice: "€2.90",
    moq: "6,000 pcs",
    requiredDate: "10 May 2026",
    stage: "ready_costing",
    version: 1,
    progress: 60,
    team: [
      { name: "Ananya R.", initials: "AR" },
      { name: "Rahul M.", initials: "RM" },
    ],
    lastUpdated: "6h ago",
    documents: 7,
    notes: 3,
  },
  {
    id: "SRF-1030",
    inquiryId: "INQ-2358",
    image: IMG.curtain,
    productName: "Blackout Curtain Panel — Charcoal",
    buyer: "John Lewis",
    category: "Curtain",
    season: "AW 2026",
    targetPrice: "£18.50",
    moq: "1,500 pcs",
    requiredDate: "10 Jul 2026",
    stage: "costing_progress",
    version: 2,
    progress: 71,
    team: [{ name: "Gautam Kitclu", initials: "GK" }],
    lastUpdated: "yesterday",
    documents: 8,
    notes: 4,
  },
  {
    id: "SRF-1017",
    inquiryId: "INQ-2325",
    image: IMG.throw,
    productName: "Cotton Waffle Throw — Ivory",
    buyer: "West Elm",
    category: "Throw",
    season: "SS 2026",
    targetPrice: "$16.40",
    moq: "1,800 pcs",
    requiredDate: "12 May 2026",
    stage: "quotation_ready",
    version: 4,
    progress: 100,
    team: [
      { name: "Rahul M.", initials: "RM" },
      { name: "Priya S.", initials: "PS" },
    ],
    lastUpdated: "4d ago",
    documents: 15,
    notes: 10,
  },
];

export const INQUIRY_STAGES: { key: InquiryStage; label: string; hint: string }[] = [
  { key: "new", label: "New Inquiry", hint: "Just received" },
  { key: "review", label: "Under Review", hint: "Clarify with customer" },
  { key: "ready", label: "Ready for SRF", hint: "Spec complete" },
  { key: "srf_created", label: "SRF Created", hint: "Handed to team" },
];

export const SRF_STAGES: { key: SrfStage; label: string; hint: string }[] = [
  { key: "created", label: "SRF Created", hint: "Kickoff" },
  { key: "design", label: "Design", hint: "In development" },
  { key: "ready_costing", label: "Ready for Costing", hint: "Spec locked" },
  { key: "costing_progress", label: "Costing In Progress", hint: "Rates being built" },
  { key: "costing_complete", label: "Costing Complete", hint: "Awaiting review" },
  { key: "quotation_ready", label: "Costing Approved", hint: "Approved · Read-only" },
];
