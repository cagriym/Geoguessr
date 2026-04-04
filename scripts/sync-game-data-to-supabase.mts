import { createClient } from "@supabase/supabase-js";

import * as gameSeedModule from "../src/lib/game-locations/seed";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !secretKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SECRET_KEY .env.local icinde tanimli olmali."
  );
}

const supabase = createClient(supabaseUrl, secretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const seedNamespace = gameSeedModule as typeof import("../src/lib/game-locations/seed") & {
  default?: {
    curatedLocationSeed?: typeof import("../src/lib/game-locations/seed").curatedLocationSeed;
  };
};

const curatedLocationSeed =
  seedNamespace.curatedLocationSeed ?? seedNamespace.default?.curatedLocationSeed ?? [];

const gameLocationRows = curatedLocationSeed.map(({ location }) => ({
  country_code: location.context.countryCode,
  country_name: location.context.countryName,
  difficulty: location.difficulty,
  heading: location.heading,
  id: location.id,
  label: location.label,
  latitude: location.position.lat,
  locality: location.context.locality,
  longitude: location.position.lng,
  pitch: location.pitch,
  region_name: location.context.regionName,
  slug: location.slug,
  status: location.status,
  summary: location.summary,
  tags: location.tags,
  verification_notes: location.verificationNotes,
  verification_state: location.verificationState,
  view_zoom: location.viewZoom,
}));

const locationClueRows = curatedLocationSeed.flatMap(({ clues }) =>
  clues.map((clue) => ({
    category: clue.category,
    confidence: clue.confidence,
    details: clue.details,
    distinctiveness: clue.distinctiveness,
    id: clue.id,
    location_id: clue.locationId,
    position_hint: clue.positionHint,
    short_text: clue.shortText,
    sort_order: clue.sortOrder,
    tags: clue.tags,
    timing: clue.timing,
    title: clue.title,
  }))
);

await upsert("game_locations", gameLocationRows, "id");
await upsert("location_clues", locationClueRows, "id");

console.log(
  `Synced ${gameLocationRows.length} game locations and ${locationClueRows.length} location clues to Supabase.`
);

async function upsert(table: string, rows: Record<string, unknown>[], conflictColumn: string) {
  const { error } = await supabase.from(table).upsert(rows, {
    ignoreDuplicates: false,
    onConflict: conflictColumn,
  });

  if (error) {
    throw new Error(`${table} upsert failed: ${error.message}`);
  }
}
