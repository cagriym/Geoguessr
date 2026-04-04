import { NextResponse } from "next/server";

import { getPlayableLocation, pickNextLocation } from "@/lib/game-locations/repository";
import { createRoundToken } from "@/lib/game-locations/round-token";

type NextRoundRequest = {
  excludeLocationIds?: unknown;
};

export async function POST(request: Request) {
  let payload: NextRoundRequest = {};

  try {
    payload = (await request.json()) as NextRoundRequest;
  } catch {
    payload = {};
  }

  const excludedLocationIds = Array.isArray(payload.excludeLocationIds)
    ? payload.excludeLocationIds.filter((value): value is string => typeof value === "string")
    : [];

  const location = await pickNextLocation(excludedLocationIds);

  if (!location) {
    return NextResponse.json(
      {
        error: "Veritabaninda oynanabilir yeni lokasyon kalmadi.",
      },
      { status: 404 }
    );
  }

  const locationEntry = await getPlayableLocation(location.id);

  return NextResponse.json({
    round: {
      clueCount: locationEntry?.clues.length ?? 0,
      difficulty: location.difficulty,
      heading: location.heading,
      label: location.label,
      locationId: location.id,
      pitch: location.pitch,
      position: location.position,
      roundToken: createRoundToken(location.id),
      summary: location.summary,
      verificationState: location.verificationState,
      viewZoom: location.viewZoom,
    },
  });
}
