export const clueCategories = [
  {
    description: "Google car parcalari, snorkel, roof rack ve coverage ekipmani ipuclari.",
    label: "Google Car",
    slug: "google-car",
  },
  {
    description: "Bollard, reflektor ve yol kenari direkleri uzerinden ulke ayirma.",
    label: "Bollards",
    slug: "bollards",
  },
  {
    description: "Google kamera jenerasyonu, blur karakteri ve eski-yeni coverage farklari.",
    label: "Camera Gen",
    slug: "camera-generation",
  },
  {
    description: "Yol cizgileri, serit kenari boyalari ve orta cizgi sistemleri.",
    label: "Road Lines",
    slug: "road-lines",
  },
  {
    description: "Yon tabelalari, hiz limitleri ve yol numaralandirma kaliplari.",
    label: "Road Signs",
    slug: "road-signs",
  },
  {
    description: "Plaka renkleri, formatlari ve montaj aliskanliklari.",
    label: "License Plates",
    slug: "license-plates",
  },
  {
    description: "Alan kodlari, domain uzantilari ve telefon referanslari.",
    label: "Domain + Phone",
    slug: "domain-phone",
  },
  {
    description: "Yazi sistemi, diakritik isaretler ve alfabe farklari.",
    label: "Alphabet + Language",
    slug: "alphabet-language",
  },
  {
    description: "Para birimi ve fiyatlama uzerinden ulke teyidi.",
    label: "Currency",
    slug: "currency",
  },
  {
    description: "Coverage bosluklari, sehir odaklari ve ulkeye ozel haritalama paterni.",
    label: "Coverage",
    slug: "coverage-pattern",
  },
] as const;

export type ClueCategorySlug = (typeof clueCategories)[number]["slug"];
export type ClueConfidence = "high" | "medium" | "low";
export type ClueDistinctiveness = 1 | 2 | 3 | 4 | 5;

export type ClueSource = {
  label: string;
  type: "official-guide" | "category-reference" | "community-repo";
  url: string;
};

export type ClueVisualExample = {
  alt: string;
  caption: string;
  imageUrl?: string;
};

export type ClueRecord = {
  beginnerFriendly: boolean;
  category: ClueCategorySlug;
  commonConfusionCountryCodes: string[];
  confidence: ClueConfidence;
  countryCode: string;
  countryName: string;
  description: string;
  distinctiveness: ClueDistinctiveness;
  id: string;
  regionName?: string;
  slug: string;
  sourceRefs: ClueSource[];
  summary: string;
  tags: string[];
  title: string;
  visualExample: ClueVisualExample;
};

export type CountryProfile = {
  code: string;
  compareCountryCodes: string[];
  confusedWithCountryCodes: string[];
  featuredClueIds: string[];
  guideSummary: string;
  name: string;
  seoDescription: string;
  strongestBeginnerClueIds: string[];
};

export type ClueFilters = {
  beginnerOnly?: boolean;
  category?: ClueCategorySlug;
  countryCode?: string;
  limit?: number;
  query?: string;
};

export type CountryGuide = {
  beginnerClues: ClueRecord[];
  compareCountries: CountryProfile[];
  country: CountryProfile;
  featuredClues: ClueRecord[];
  totalClueCount: number;
};

export type ResolvedLocationContext = {
  adminArea: string | null;
  countryCode: string | null;
  countryName: string | null;
  locality: string | null;
};
