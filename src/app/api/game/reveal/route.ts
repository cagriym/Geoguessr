import { NextResponse } from "next/server";

import { haversineDistanceKm, scoreFromDistance } from "@/lib/geo";
import { getPlayableLocation } from "@/lib/game-locations/repository";
import { readRoundToken } from "@/lib/game-locations/round-token";

type RevealRoundRequest = {
  guess?: {
    lat?: unknown;
    lng?: unknown;
  } | null;
  roundToken?: unknown;
};

export async function POST(request: Request) {
  let payload: RevealRoundRequest = {};

  try {
    payload = (await request.json()) as RevealRoundRequest;
  } catch {
    payload = {};
  }

  if (typeof payload.roundToken !== "string") {
    return NextResponse.json({ error: "Round token eksik." }, { status: 400 });
  }

  const token = readRoundToken(payload.roundToken);

  if (!token) {
    return NextResponse.json({ error: "Round token dogrulanamadi." }, { status: 400 });
  }

  const locationEntry = await getPlayableLocation(token.locationId);

  if (!locationEntry) {
    return NextResponse.json({ error: "Lokasyon kaydi bulunamadi." }, { status: 404 });
  }

  const guess = parseGuess(payload.guess);
  const distanceKm = guess ? haversineDistanceKm(guess, locationEntry.location.position) : null;
  const points = distanceKm === null ? 0 : scoreFromDistance(distanceKm);

  return NextResponse.json({
    clues: locationEntry.clues,
    context: locationEntry.location.context,
    distanceKm,
    points,
    summary: locationEntry.location.summary,
    target: {
      label: locationEntry.location.label,
      position: locationEntry.location.position,
    },
  });
}

function parseGuess(rawGuess: RevealRoundRequest["guess"]) {
  if (!rawGuess || typeof rawGuess !== "object") {
    return null;
  }

  const { lat, lng } = rawGuess;

  if (typeof lat !== "number" || typeof lng !== "number") {
    return null;
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
}
