export type LocationClueTiming = "playing" | "revealed";

export type LocationClueCategory =
  | "language"
  | "road-layout"
  | "street-furniture"
  | "architecture"
  | "vehicles"
  | "environment";

export type LocationClueConfidence = "high" | "medium" | "low";
export type LocationClueDistinctiveness = 1 | 2 | 3 | 4 | 5;
export type LocationDifficulty = "easy" | "medium" | "hard";
export type LocationVerificationState = "seeded" | "audited";
export type LocationRecordStatus = "draft" | "ready";

export type LocationContext = {
  countryCode: string;
  countryName: string;
  locality: string | null;
  regionName: string | null;
};

export type GameLocationRecord = {
  difficulty: LocationDifficulty;
  heading: number;
  id: string;
  label: string;
  pitch: number;
  position: google.maps.LatLngLiteral;
  slug: string;
  status: LocationRecordStatus;
  summary: string;
  tags: string[];
  verificationNotes: string;
  verificationState: LocationVerificationState;
  viewZoom: number;
  context: LocationContext;
};

export type LocationClueRecord = {
  category: LocationClueCategory;
  confidence: LocationClueConfidence;
  details: string;
  distinctiveness: LocationClueDistinctiveness;
  id: string;
  locationId: string;
  positionHint: string | null;
  shortText: string;
  sortOrder: number;
  tags: string[];
  timing: LocationClueTiming;
  title: string;
};

export type GameLocationWithClues = {
  clues: LocationClueRecord[];
  location: GameLocationRecord;
};

export type GameRoundPayload = {
  clueCount: number;
  difficulty: LocationDifficulty;
  heading: number;
  label: string;
  locationId: string;
  pitch: number;
  position: google.maps.LatLngLiteral;
  roundToken: string;
  summary: string;
  verificationState: LocationVerificationState;
  viewZoom: number;
};

export type RevealedRoundPayload = {
  clues: LocationClueRecord[];
  context: LocationContext;
  distanceKm: number | null;
  points: number;
  summary: string;
  target: {
    label: string;
    position: google.maps.LatLngLiteral;
  };
};
