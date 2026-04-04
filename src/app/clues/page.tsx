import type { Metadata } from "next";

import { ClueExplorer } from "@/components/clues/clue-explorer";
import { listCluesData, listCountriesData } from "@/lib/clues/repository";

export const metadata: Metadata = {
  description:
    "Ulke bazli, kategori bazli ve oyun ici kullanima uygun GeoGuessr clue atlas sistemi.",
  title: "Clue Atlas",
};

export default async function CluesPage() {
  const [clues, countries] = await Promise.all([listCluesData(), listCountriesData()]);

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <ClueExplorer clues={clues} countries={countries} />
      </div>
    </main>
  );
}
