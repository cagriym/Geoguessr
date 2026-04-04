import { createClient } from "@supabase/supabase-js";

import { clueCategoryMeta, clueRecords, countryProfiles } from "../src/lib/clues/seed";

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

const categoryRows = clueCategoryMeta.map((category) => ({
  description: category.description,
  label: category.label,
  slug: category.slug,
}));

const countryRows = countryProfiles.map((country) => ({
  code: country.code,
  compare_country_codes: country.compareCountryCodes,
  confused_with_country_codes: country.confusedWithCountryCodes,
  featured_clue_ids: country.featuredClueIds,
  guide_summary: country.guideSummary,
  name: country.name,
  seo_description: country.seoDescription,
  strongest_beginner_clue_ids: country.strongestBeginnerClueIds,
}));

const clueRows = clueRecords.map((clue) => ({
  beginner_friendly: clue.beginnerFriendly,
  category_slug: clue.category,
  common_confusion_country_codes: clue.commonConfusionCountryCodes,
  confidence: clue.confidence,
  country_code: clue.countryCode,
  country_name: clue.countryName,
  description: clue.description,
  distinctiveness: clue.distinctiveness,
  id: clue.id,
  region_name: clue.regionName ?? null,
  slug: clue.slug,
  source_refs: clue.sourceRefs,
  summary: clue.summary,
  tags: clue.tags,
  title: clue.title,
  visual_example_alt: clue.visualExample.alt,
  visual_example_caption: clue.visualExample.caption,
  visual_example_image_url: clue.visualExample.imageUrl ?? null,
}));

await upsert("clue_categories", categoryRows, "slug");
await upsert("country_profiles", countryRows, "code");
await upsert("clues", clueRows, "id");

console.log(
  `Synced ${categoryRows.length} categories, ${countryRows.length} countries and ${clueRows.length} clues to Supabase.`
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
