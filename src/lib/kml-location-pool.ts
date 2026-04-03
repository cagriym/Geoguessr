export type KmlLocationTuple = readonly [number, number];

export type KmlStreetViewRound = {
  heading: number;
  pano: string;
  pitch: number;
  position: google.maps.LatLngLiteral;
  sourceIndex: number;
  sourcePosition: google.maps.LatLngLiteral;
};

const DATASET_URL = "/data/equitable-stochastic-2023-06-24.points.json";
const MAX_RESOLVE_ATTEMPTS = 24;

declare global {
  interface Window {
    __kmlLocationPoolPromise?: Promise<KmlLocationTuple[]>;
  }
}

export async function loadKmlLocationPool() {
  if (typeof window === "undefined") {
    throw new Error("KML location pool can only be loaded in the browser.");
  }

  if (window.__kmlLocationPoolPromise) {
    return window.__kmlLocationPoolPromise;
  }

  window.__kmlLocationPoolPromise = fetch(DATASET_URL, { cache: "force-cache" })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to fetch KML location pool: ${response.status}`);
      }

      return (await response.json()) as KmlLocationTuple[];
    })
    .catch((error) => {
      window.__kmlLocationPoolPromise = undefined;
      throw error;
    });

  return window.__kmlLocationPoolPromise;
}

export async function resolveStreetViewRoundFromKml(
  streetViewService: google.maps.StreetViewService,
  googleMaps: typeof google,
  usedIndices: number[]
) {
  const pool = await loadKmlLocationPool();
  const excluded = new Set(usedIndices);
  const attemptLimit = Math.min(pool.length, Math.max(MAX_RESOLVE_ATTEMPTS, excluded.size + 8));

  for (let attempt = 0; attempt < attemptLimit; attempt += 1) {
    const sourceIndex = pickRandomIndex(pool.length, excluded);
    excluded.add(sourceIndex);

    const [lat, lng] = pool[sourceIndex];
    const sourcePosition = { lat, lng };

    try {
      const panorama = await lookupPanorama(streetViewService, googleMaps, sourcePosition);
      const latLng = panorama.location?.latLng;
      const pano = panorama.location?.pano;

      if (!latLng || !pano) {
        continue;
      }

      return {
        heading: Math.round(Math.random() * 360),
        pano,
        pitch: Math.round((Math.random() * 12 - 6) * 10) / 10,
        position: {
          lat: latLng.lat(),
          lng: latLng.lng(),
        },
        sourceIndex,
        sourcePosition,
      } satisfies KmlStreetViewRound;
    } catch {
      continue;
    }
  }

  throw new Error("KML havuzundan Street View konumu cozulmedi.");
}

async function lookupPanorama(
  streetViewService: google.maps.StreetViewService,
  googleMaps: typeof google,
  location: google.maps.LatLngLiteral
) {
  return new Promise<google.maps.StreetViewPanoramaData>((resolve, reject) => {
    streetViewService.getPanorama(
      {
        location,
        preference: googleMaps.maps.StreetViewPreference.NEAREST,
        radius: 250,
        source: googleMaps.maps.StreetViewSource.OUTDOOR,
      },
      (data, status) => {
        if (status === googleMaps.maps.StreetViewStatus.OK && data) {
          resolve(data);
          return;
        }

        reject(new Error(String(status)));
      }
    );
  });
}

function pickRandomIndex(length: number, excluded: Set<number>) {
  if (excluded.size >= length) {
    throw new Error("KML havuzunda kullanilabilir nokta kalmadi.");
  }

  let index = Math.floor(Math.random() * length);

  while (excluded.has(index)) {
    index = Math.floor(Math.random() * length);
  }

  return index;
}
