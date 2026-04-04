import "server-only";

import { cache } from "react";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { curatedLocationSeed } from "./seed";
import type {
  GameLocationRecord,
  GameLocationWithClues,
  LocationClueRecord,
  LocationRecordStatus,
} from "./types";

type DbLocationRow = {
  country_code: string;
  country_name: string;
  difficulty: GameLocationRecord["difficulty"];
  heading: number;
  id: string;
  label: string;
  latitude: number;
  locality: string | null;
  longitude: number;
  pitch: number;
  region_name: string | null;
  slug: string;
  status: LocationRecordStatus;
  summary: string;
  tags: string[];
  verification_notes: string;
  verification_state: GameLocationRecord["verificationState"];
  view_zoom: number;
};

type DbClueRow = {
  category: LocationClueRecord["category"];
  confidence: LocationClueRecord["confidence"];
  details: string;
  distinctiveness: LocationClueRecord["distinctiveness"];
  id: string;
  location_id: string;
  position_hint: string | null;
  short_text: string;
  sort_order: number;
  tags: string[];
  timing: LocationClueRecord["timing"];
  title: string;
};

const getGameLocationSnapshot = cache(async () => {
  const client = createSupabaseAdminClient();

  if (!client) {
    return null;
  }

  const [locationsResult, cluesResult] = await Promise.all([
    client
      .from("game_locations")
      .select(
        "id, slug, status, label, country_code, country_name, region_name, locality, latitude, longitude, heading, pitch, view_zoom, difficulty, summary, verification_state, verification_notes, tags"
      )
      .eq("status", "ready")
      .order("country_name")
      .order("label"),
    client
      .from("location_clues")
      .select(
        "id, location_id, timing, category, title, short_text, details, position_hint, confidence, distinctiveness, sort_order, tags"
      )
      .order("location_id")
      .order("sort_order"),
  ]);

  if (locationsResult.error || cluesResult.error) {
    console.error("Supabase curated location snapshot load failed", {
      cluesError: cluesResult.error,
      locationsError: locationsResult.error,
    });
    return null;
  }

  const locations = (locationsResult.data ?? []).map(mapLocationRow);
  const clues = (cluesResult.data ?? []).map(mapClueRow);

  return buildSnapshot(locations, clues);
});

export async function listPlayableLocations() {
  const snapshot = await getGameLocationSnapshot();
  return snapshot?.locations ?? curatedLocationSeed.map((entry) => entry.location);
}

export async function getPlayableLocation(locationId: string) {
  const snapshot = await getGameLocationSnapshot();

  if (!snapshot) {
    return curatedLocationSeed.find((entry) => entry.location.id === locationId) ?? null;
  }

  return snapshot.byId.get(locationId) ?? null;
}

export async function pickNextLocation(excludedLocationIds: string[]) {
  const locations = await listPlayableLocations();
  const excluded = new Set(excludedLocationIds);
  const available = locations.filter((location) => !excluded.has(location.id));

  if (available.length === 0) {
    return null;
  }

  const nextIndex = Math.floor(Math.random() * available.length);
  return available[nextIndex] ?? null;
}

function mapLocationRow(row: DbLocationRow): GameLocationRecord {
  return {
    context: {
      countryCode: row.country_code,
      countryName: row.country_name,
      locality: row.locality,
      regionName: row.region_name,
    },
    difficulty: row.difficulty,
    heading: row.heading,
    id: row.id,
    label: row.label,
    pitch: row.pitch,
    position: {
      lat: row.latitude,
      lng: row.longitude,
    },
    slug: row.slug,
    status: row.status,
    summary: row.summary,
    tags: row.tags ?? [],
    verificationNotes: row.verification_notes,
    verificationState: row.verification_state,
    viewZoom: row.view_zoom,
  };
}

function mapClueRow(row: DbClueRow): LocationClueRecord {
  return {
    category: row.category,
    confidence: row.confidence,
    details: row.details,
    distinctiveness: row.distinctiveness,
    id: row.id,
    locationId: row.location_id,
    positionHint: row.position_hint,
    shortText: row.short_text,
    sortOrder: row.sort_order,
    tags: row.tags ?? [],
    timing: row.timing,
    title: row.title,
  };
}

function buildSnapshot(locations: GameLocationRecord[], clues: LocationClueRecord[]) {
  const byId = new Map<string, GameLocationWithClues>();

  for (const location of locations) {
    byId.set(location.id, {
      clues: [],
      location,
    });
  }

  for (const clue of clues) {
    const locationEntry = byId.get(clue.locationId);

    if (locationEntry) {
      locationEntry.clues.push(clue);
    }
  }

  return {
    byId,
    locations,
  };
}
