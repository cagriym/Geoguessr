import "server-only";

import { cache } from "react";

import {
  getAllCountries,
  getBeginnerStarterClues,
  getCategoryDetail,
  getClues,
  getCountryGuide,
} from "./catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ClueFilters, ClueRecord, CountryGuide, CountryProfile } from "./types";

type DbCategoryRow = {
  description: string;
  label: string;
  slug: string;
};

type DbCountryRow = {
  code: string;
  compare_country_codes: string[];
  confused_with_country_codes: string[];
  featured_clue_ids: string[];
  guide_summary: string;
  name: string;
  seo_description: string;
  strongest_beginner_clue_ids: string[];
};

type DbClueRow = {
  beginner_friendly: boolean;
  category_slug: ClueRecord["category"];
  common_confusion_country_codes: string[];
  confidence: ClueRecord["confidence"];
  country_code: string;
  country_name: string;
  description: string;
  distinctiveness: ClueRecord["distinctiveness"];
  id: string;
  region_name: string | null;
  slug: string;
  source_refs: ClueRecord["sourceRefs"];
  summary: string;
  tags: string[];
  title: string;
  visual_example_alt: string;
  visual_example_caption: string;
  visual_example_image_url: string | null;
};

const getDatabaseSnapshot = cache(async () => {
  const client = createSupabaseServerClient();

  if (!client) {
    return null;
  }

  const [categoriesResult, countriesResult, cluesResult] = await Promise.all([
    client.from("clue_categories").select("slug, label, description").order("label"),
    client
      .from("country_profiles")
      .select(
        "code, name, guide_summary, seo_description, compare_country_codes, confused_with_country_codes, featured_clue_ids, strongest_beginner_clue_ids"
      )
      .order("name"),
    client
      .from("clues")
      .select(
        "id, slug, country_code, country_name, region_name, category_slug, title, summary, description, confidence, distinctiveness, beginner_friendly, tags, common_confusion_country_codes, source_refs, visual_example_alt, visual_example_caption, visual_example_image_url"
      )
      .order("country_name")
      .order("title"),
  ]);

  if (categoriesResult.error || countriesResult.error || cluesResult.error) {
    console.error("Supabase clue snapshot load failed", {
      categoriesError: categoriesResult.error,
      cluesError: cluesResult.error,
      countriesError: countriesResult.error,
    });
    return null;
  }

  return {
    categories: (categoriesResult.data ?? []) as DbCategoryRow[],
    clues: (cluesResult.data ?? []).map(mapClueRow),
    countries: (countriesResult.data ?? []).map(mapCountryRow),
  };
});

export async function listCountriesData() {
  const snapshot = await getDatabaseSnapshot();
  return snapshot?.countries ?? getAllCountries();
}

export async function listCluesData(filters: ClueFilters = {}) {
  const snapshot = await getDatabaseSnapshot();
  const clues = snapshot?.clues ?? getClues();
  return applyClueFilters(clues, filters);
}

export async function getCountryGuideData(countryCode: string): Promise<CountryGuide | null> {
  const snapshot = await getDatabaseSnapshot();

  if (!snapshot) {
    return getCountryGuide(countryCode);
  }

  const code = countryCode.toUpperCase();
  const country = snapshot.countries.find((item) => item.code === code);

  if (!country) {
    return null;
  }

  const featuredClues = country.featuredClueIds
    .map((clueId) => snapshot.clues.find((clue) => clue.id === clueId))
    .filter((clue): clue is ClueRecord => Boolean(clue));
  const beginnerClues = country.strongestBeginnerClueIds
    .map((clueId) => snapshot.clues.find((clue) => clue.id === clueId))
    .filter((clue): clue is ClueRecord => Boolean(clue));
  const compareCountries = country.compareCountryCodes
    .map((compareCode) => snapshot.countries.find((item) => item.code === compareCode))
    .filter((item): item is CountryProfile => Boolean(item));
  const countryClues = snapshot.clues.filter((clue) => clue.countryCode === code);

  return {
    beginnerClues,
    compareCountries,
    country,
    featuredClues,
    totalClueCount: countryClues.length,
  };
}

export async function getCategoryDetailData(category: string) {
  const snapshot = await getDatabaseSnapshot();

  if (!snapshot) {
    return getCategoryDetail(category);
  }

  const meta = snapshot.categories.find((item) => item.slug === category);

  if (!meta) {
    return null;
  }

  return {
    clues: snapshot.clues.filter((clue) => clue.category === category),
    meta,
  };
}

export async function getStarterCluesData(limit = 3) {
  const snapshot = await getDatabaseSnapshot();

  if (!snapshot) {
    return getBeginnerStarterClues(limit);
  }

  return applyClueFilters(snapshot.clues, {
    beginnerOnly: true,
    limit,
  });
}

function applyClueFilters(clues: ClueRecord[], filters: ClueFilters) {
  const query = filters.query?.trim().toLocaleLowerCase("tr");

  const filtered = clues.filter((clue) => {
    if (filters.countryCode && clue.countryCode !== filters.countryCode.toUpperCase()) {
      return false;
    }

    if (filters.category && clue.category !== filters.category) {
      return false;
    }

    if (filters.beginnerOnly && !clue.beginnerFriendly) {
      return false;
    }

    if (!query) {
      return true;
    }

    const haystack = [
      clue.countryName,
      clue.title,
      clue.summary,
      clue.description,
      clue.tags.join(" "),
      clue.category,
    ]
      .join(" ")
      .toLocaleLowerCase("tr");

    return haystack.includes(query);
  });

  const sorted = filtered.sort((left, right) => {
    if (right.distinctiveness !== left.distinctiveness) {
      return right.distinctiveness - left.distinctiveness;
    }

    if (left.beginnerFriendly !== right.beginnerFriendly) {
      return Number(right.beginnerFriendly) - Number(left.beginnerFriendly);
    }

    return left.title.localeCompare(right.title);
  });

  return typeof filters.limit === "number" ? sorted.slice(0, filters.limit) : sorted;
}

function mapCountryRow(row: DbCountryRow): CountryProfile {
  return {
    code: row.code,
    compareCountryCodes: row.compare_country_codes ?? [],
    confusedWithCountryCodes: row.confused_with_country_codes ?? [],
    featuredClueIds: row.featured_clue_ids ?? [],
    guideSummary: row.guide_summary,
    name: row.name,
    seoDescription: row.seo_description,
    strongestBeginnerClueIds: row.strongest_beginner_clue_ids ?? [],
  };
}

function mapClueRow(row: DbClueRow): ClueRecord {
  return {
    beginnerFriendly: row.beginner_friendly,
    category: row.category_slug,
    commonConfusionCountryCodes: row.common_confusion_country_codes ?? [],
    confidence: row.confidence,
    countryCode: row.country_code,
    countryName: row.country_name,
    description: row.description,
    distinctiveness: row.distinctiveness,
    id: row.id,
    regionName: row.region_name ?? undefined,
    slug: row.slug,
    sourceRefs: row.source_refs ?? [],
    summary: row.summary,
    tags: row.tags ?? [],
    title: row.title,
    visualExample: {
      alt: row.visual_example_alt,
      caption: row.visual_example_caption,
      imageUrl: row.visual_example_image_url ?? undefined,
    },
  };
}
