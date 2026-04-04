import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getCountryGuideData, listCluesData, listCountriesData } from "@/lib/clues/repository";

type Params = Promise<{ countryCode: string }>;

export async function generateStaticParams() {
  return (await listCountriesData()).map((country) => ({
    countryCode: country.code,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { countryCode } = await params;
  const guide = await getCountryGuideData(countryCode);

  if (!guide) {
    return { title: "Ulke rehberi bulunamadi" };
  }

  return {
    description: guide.country.seoDescription,
    title: `${guide.country.name} clue rehberi`,
  };
}

export default async function CountryGuidePage({
  params,
}: {
  params: Params;
}) {
  const { countryCode } = await params;
  const guide = await getCountryGuideData(countryCode);

  if (!guide) {
    notFound();
  }

  const countryClues = await listCluesData({ countryCode: guide.country.code });

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-6">
        <section className="rounded-[32px] border border-white/12 bg-white/6 p-6 backdrop-blur-xl">
          <Link
            href="/clues"
            className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-cyan-200"
          >
            Clue atlas
          </Link>
          <h1 className="mt-3 text-4xl font-semibold text-white">{guide.country.name}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200 sm:text-base">
            {guide.country.guideSummary}
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-[30px] border border-white/12 bg-slate-950/62 p-6 backdrop-blur-xl">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-cyan-200">
              Featured clues
            </p>
            <div className="mt-5 grid gap-4">
              {countryClues.map((clue) => (
                <article
                  key={clue.id}
                  className="rounded-[24px] border border-white/10 bg-white/6 p-5"
                >
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-cyan-200">
                      {clue.category}
                    </span>
                    <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-emerald-200">
                      Guven {clue.confidence}
                    </span>
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold text-white">{clue.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-200">{clue.description}</p>
                  <div className="mt-4 rounded-[18px] border border-dashed border-white/10 bg-slate-950/60 px-4 py-3 text-sm leading-6 text-slate-300">
                    {clue.visualExample.caption}
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="grid gap-5">
            <div className="rounded-[30px] border border-white/12 bg-white/6 p-5 backdrop-blur-xl">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-cyan-200">
                Yeni baslayanlar icin en guclu clue&apos;lar
              </p>
              <div className="mt-4 grid gap-3">
                {guide.beginnerClues.map((clue) => (
                  <div
                    key={clue.id}
                    className="rounded-[20px] border border-white/10 bg-slate-950/70 px-4 py-4"
                  >
                    <p className="font-semibold text-white">{clue.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{clue.summary}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[30px] border border-white/12 bg-white/6 p-5 backdrop-blur-xl">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-cyan-200">
                Benzer ulkelerle karsilastir
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {guide.compareCountries.map((country) => (
                  <Link
                    key={country.code}
                    href={`/clues/countries/${country.code}`}
                    className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200"
                  >
                    {country.name}
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
