import { NextResponse } from "next/server";

import { getCountryGuideData } from "@/lib/clues/repository";

type Params = Promise<{ countryCode: string }>;

export async function GET(_: Request, context: { params: Params }) {
  const { countryCode } = await context.params;
  const guide = await getCountryGuideData(countryCode);

  if (!guide) {
    return NextResponse.json({ error: "Country guide not found." }, { status: 404 });
  }

  return NextResponse.json(guide);
}
