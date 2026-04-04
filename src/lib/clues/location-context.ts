import type { ResolvedLocationContext } from "./types";

declare global {
  interface Window {
    __roundLocationContextCache?: Map<string, Promise<ResolvedLocationContext>>;
  }
}

export async function resolveLocationContext(
  geocoder: google.maps.Geocoder,
  location: google.maps.LatLngLiteral
) {
  if (typeof window === "undefined") {
    return emptyLocationContext();
  }

  const cacheKey = `${location.lat.toFixed(5)},${location.lng.toFixed(5)}`;

  if (!window.__roundLocationContextCache) {
    window.__roundLocationContextCache = new Map();
  }

  const cached = window.__roundLocationContextCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const request = geocodeLocation(geocoder, location).catch(() => emptyLocationContext());
  window.__roundLocationContextCache.set(cacheKey, request);
  return request;
}

function geocodeLocation(geocoder: google.maps.Geocoder, location: google.maps.LatLngLiteral) {
  return new Promise<ResolvedLocationContext>((resolve, reject) => {
    geocoder.geocode({ location }, (results, status) => {
      if (status !== "OK" || !results?.length) {
        reject(new Error(String(status)));
        return;
      }

      const components = results[0].address_components ?? [];
      const country = components.find((component) => component.types.includes("country"));
      const adminArea = components.find((component) =>
        component.types.includes("administrative_area_level_1")
      );
      const locality = components.find(
        (component) => component.types.includes("locality") || component.types.includes("postal_town")
      );

      resolve({
        adminArea: adminArea?.long_name ?? null,
        countryCode: country?.short_name ?? null,
        countryName: country?.long_name ?? null,
        locality: locality?.long_name ?? null,
      });
    });
  });
}

function emptyLocationContext(): ResolvedLocationContext {
  return {
    adminArea: null,
    countryCode: null,
    countryName: null,
    locality: null,
  };
}
