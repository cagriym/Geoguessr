import { clueCategoryMeta, clueRecords, countryProfiles } from "./seed";
import type { ClueFilters, ClueRecord, CountryGuide, CountryProfile } from "./types";

const clueMap = new Map(clueRecords.map((clue) => [clue.id, clue]));
const countryMap = new Map(countryProfiles.map((country) => [country.code, country]));

export function getClueCategories() {
  return clueCategoryMeta;
}

export function getAllCountries() {
  return [...countryProfiles].sort((left, right) => left.name.localeCompare(right.name));
}

export function getCountryProfile(countryCode: string) {
  return countryMap.get(countryCode.toUpperCase()) ?? null;
}

export function getAllClues() {
  return [...clueRecords];
}

export function getClues(filters: ClueFilters = {}) {
  const query = filters.query?.trim().toLocaleLowerCase("tr");

  const filtered = clueRecords.filter((clue) => {
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

export function getCountryGuide(countryCode: string): CountryGuide | null {
  const country = getCountryProfile(countryCode);

  if (!country) {
    return null;
  }

  const countryClues = getClues({ countryCode: country.code });
  const featuredClues = country.featuredClueIds
    .map((clueId) => clueMap.get(clueId))
    .filter((clue): clue is ClueRecord => Boolean(clue));
  const beginnerClues = country.strongestBeginnerClueIds
    .map((clueId) => clueMap.get(clueId))
    .filter((clue): clue is ClueRecord => Boolean(clue));
  const compareCountries = country.compareCountryCodes
    .map((compareCode) => getCountryProfile(compareCode))
    .filter((item): item is CountryProfile => Boolean(item));

  return {
    beginnerClues,
    compareCountries,
    country,
    featuredClues,
    totalClueCount: countryClues.length,
  };
}

export function getCategoryDetail(category: string) {
  const meta = clueCategoryMeta.find((item) => item.slug === category);

  if (!meta) {
    return null;
  }

  return {
    clues: getClues({ category: meta.slug }),
    meta,
  };
}

export function getComparison(leftCode: string, rightCode: string) {
  const left = getCountryGuide(leftCode);
  const right = getCountryGuide(rightCode);

  if (!left || !right) {
    return null;
  }

  const leftCategories = new Set(getClues({ countryCode: left.country.code }).map((clue) => clue.category));
  const rightCategories = new Set(
    getClues({ countryCode: right.country.code }).map((clue) => clue.category)
  );

  const sharedCategories = clueCategoryMeta.filter(
    (category) => leftCategories.has(category.slug) && rightCategories.has(category.slug)
  );

  return {
    left,
    right,
    sharedCategories,
  };
}

export function getBeginnerStarterClues(limit = 6) {
  return getClues({ beginnerOnly: true, limit });
}
