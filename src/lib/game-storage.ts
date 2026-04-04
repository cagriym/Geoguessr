import type { GameRoundPayload, RevealedRoundPayload } from "@/lib/game-locations/types";

export type PersistedRoundSummary = {
  distanceKm: number | null;
  points: number;
  round: number;
};

export type PersistedGameState = {
  deadlineTs: number | null;
  guess: google.maps.LatLngLiteral | null;
  history: PersistedRoundSummary[];
  phase: "playing" | "revealed" | "finished";
  revealedRound: RevealedRoundPayload | null;
  round: number;
  roundDurationSeconds: number;
  roundDistance: number | null;
  roundScore: number | null;
  score: number;
  target: GameRoundPayload | null;
  usedLocationIds: string[];
  version: 3;
};

const STORAGE_KEY = "street-view-guess-game:session";
const STORAGE_EVENT = "street-view-guess-game:session-change";

export function loadPersistedGameState() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as PersistedGameState;

    if (parsed.version !== 3) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function savePersistedGameState(state: PersistedGameState) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

export function clearPersistedGameState() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

export function subscribeToPersistedGameState(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStorageEvent = (event: Event) => {
    if (event instanceof StorageEvent && event.storageArea !== window.sessionStorage) {
      return;
    }

    onStoreChange();
  };

  window.addEventListener(STORAGE_EVENT, handleStorageEvent);
  window.addEventListener("storage", handleStorageEvent);

  return () => {
    window.removeEventListener(STORAGE_EVENT, handleStorageEvent);
    window.removeEventListener("storage", handleStorageEvent);
  };
}
