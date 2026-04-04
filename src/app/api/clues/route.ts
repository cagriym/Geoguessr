import { NextResponse } from "next/server";

import { listCluesData } from "@/lib/clues/repository";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const query = searchParams.get("q") ?? undefined;
  const countryCode = searchParams.get("country") ?? undefined;
  const beginnerOnly = searchParams.get("beginner") === "true";
  const category = searchParams.get("category") ?? undefined;
  const limitValue = searchParams.get("limit");
  const limit = limitValue ? Number(limitValue) : undefined;

  const clues = await listCluesData({
    beginnerOnly,
    category: category as never,
    countryCode,
    limit: Number.isFinite(limit) ? limit : undefined,
    query,
  });

  return NextResponse.json({
    count: clues.length,
    filters: {
      beginnerOnly,
      category: category ?? null,
      countryCode: countryCode ?? null,
      query: query ?? null,
    },
    items: clues,
  });
}
