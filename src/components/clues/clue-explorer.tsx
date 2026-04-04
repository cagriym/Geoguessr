"use client";

import Link from "next/link";
import { useState } from "react";

import { clueCategories, type ClueRecord, type CountryProfile } from "@/lib/clues/types";

type ClueExplorerProps = {
  clues: ClueRecord[];
  countries: CountryProfile[];
};

export function ClueExplorer({ clues, countries }: ClueExplorerProps) {
  const [query, setQuery] = useState("");
  const [countryCode, setCountryCode] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [beginnerOnly, setBeginnerOnly] = useState(false);
  const [leftCompare, setLeftCompare] = useState("IS");
  const [rightCompare, setRightCompare] = useState("NO");

  const filteredClues = clues.filter((clue) => {
    if (countryCode !== "ALL" && clue.countryCode !== countryCode) {
      return false;
    }

    if (category !== "ALL" && clue.category !== category) {
      return false;
    }

    if (beginnerOnly && !clue.beginnerFriendly) {
      return false;
    }

    if (!query.trim()) {
      return true;
    }

    const haystack = [
      clue.countryName,
      clue.title,
      clue.summary,
      clue.description,
      clue.tags.join(" "),
    ]
      .join(" ")
      .toLocaleLowerCase("tr");

    return haystack.includes(query.trim().toLocaleLowerCase("tr"));
  });

  const comparison = buildComparison(leftCompare, rightCompare, countries, clues);

  return (
    <div className="grid gap-6">
      <section className="rounded-[30px] border border-white/12 bg-white/6 p-5 backdrop-blur-xl">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-cyan-200">
              Clue Atlas
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
              Ulke, bolge ve obje bazli ogretici ipucu sistemi
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200 sm:text-base">
              Bu atlas, Plonk It&apos;in katmanli rehber mantigini, GeoHints&apos;in kategori bazli referans
              yapisini ve topluluk clue notlarini tek bir normalize veri modelinde birlestirir.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Toplam clue" value={String(clues.length)} />
            <MetricCard label="Ulke" value={String(countries.length)} />
            <MetricCard label="Kategori" value={String(clueCategories.length)} />
            <MetricCard
              label="Yeni baslayan"
              value={String(clues.filter((clue) => clue.beginnerFriendly).length)}
            />
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-white/12 bg-slate-950/62 p-5 backdrop-blur-xl">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px_220px]">
          <label className="grid gap-2 text-sm text-slate-300">
            Arama
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="snorkel, tabela, izlanda, bollard..."
              className="rounded-2xl border border-white/12 bg-slate-950/85 px-4 py-3 text-white outline-none"
            />
          </label>

          <label className="grid gap-2 text-sm text-slate-300">
            Ulke
            <select
              value={countryCode}
              onChange={(event) => setCountryCode(event.target.value)}
              className="rounded-2xl border border-white/12 bg-slate-950/85 px-4 py-3 text-white outline-none"
            >
              <option value="ALL">Tum ulkeler</option>
              {countries.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm text-slate-300">
            Kategori
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="rounded-2xl border border-white/12 bg-slate-950/85 px-4 py-3 text-white outline-none"
            >
              <option value="ALL">Tum kategoriler</option>
              {clueCategories.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-end gap-3 rounded-[24px] border border-white/10 bg-white/6 px-4 py-3 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={beginnerOnly}
              onChange={(event) => setBeginnerOnly(event.target.checked)}
              className="mt-1 size-4 accent-cyan-300"
            />
            Yeni baslayanlar icin en guclu clue&apos;lari goster
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {clueCategories.map((item) => (
            <Link
              key={item.slug}
              href={`/clues/categories/${item.slug}`}
              className="rounded-full border border-white/12 bg-white/6 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:bg-white/12"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-[30px] border border-white/12 bg-white/6 p-5 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-cyan-200">
              Sonuclar
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              {filteredClues.length} clue bulundu
            </h2>
          </div>
          <Link
            href="/"
            className="rounded-full border border-white/12 bg-white/6 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:bg-white/12"
          >
            Oyuna don
          </Link>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {filteredClues.map((clue) => (
            <article
              key={clue.id}
              className="rounded-[24px] border border-white/12 bg-slate-950/62 p-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/clues/countries/${clue.countryCode}`}
                  className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-cyan-200"
                >
                  {clue.countryName}
                </Link>
                <Link
                  href={`/clues/categories/${clue.category}`}
                  className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-300"
                >
                  {clue.category}
                </Link>
                <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-emerald-200">
                  Ayirt edicilik {clue.distinctiveness}/5
                </span>
              </div>

              <h3 className="mt-4 text-xl font-semibold text-white">{clue.title}</h3>
              <p className="mt-3 leading-7 text-slate-300">{clue.summary}</p>
              <p className="mt-3 text-sm leading-7 text-slate-200">{clue.description}</p>

              <div className="mt-4 rounded-[18px] border border-dashed border-white/10 bg-white/4 px-4 py-3 text-sm leading-6 text-slate-300">
                <p className="font-semibold text-white">Gorsel alan</p>
                <p className="mt-2">{clue.visualExample.caption}</p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {clue.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/8 bg-slate-900/90 px-3 py-1 text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-slate-400"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[30px] border border-white/12 bg-slate-950/62 p-5 backdrop-blur-xl">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-cyan-200">
          Benzer ulkelerle karsilastir
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="grid gap-2 text-sm text-slate-300">
            Sol ulke
            <select
              value={leftCompare}
              onChange={(event) => setLeftCompare(event.target.value)}
              className="rounded-2xl border border-white/12 bg-slate-950/85 px-4 py-3 text-white outline-none"
            >
              {countries.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm text-slate-300">
            Sag ulke
            <select
              value={rightCompare}
              onChange={(event) => setRightCompare(event.target.value)}
              className="rounded-2xl border border-white/12 bg-slate-950/85 px-4 py-3 text-white outline-none"
            >
              {countries.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {comparison ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <ComparisonPanel
              clues={comparison.left.featuredClues}
              href={`/clues/countries/${comparison.left.country.code}`}
              title={comparison.left.country.name}
            />
            <div className="rounded-[24px] border border-white/12 bg-white/6 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">
                Ortak kategori
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {comparison.sharedCategories.map((item) => (
                  <span
                    key={item.slug}
                    className="rounded-full border border-white/10 bg-slate-950/85 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200"
                  >
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
            <ComparisonPanel
              clues={comparison.right.featuredClues}
              href={`/clues/countries/${comparison.right.country.code}`}
              title={comparison.right.country.name}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-white/12 bg-slate-950/72 px-4 py-4">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function ComparisonPanel({
  clues,
  href,
  title,
}: {
  clues: ClueRecord[];
  href: string;
  title: string;
}) {
  return (
    <article className="rounded-[24px] border border-white/12 bg-white/6 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xl font-semibold text-white">{title}</h3>
        <Link
          href={href}
          className="rounded-full border border-white/10 bg-slate-950/85 px-3 py-2 text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-slate-200"
        >
          Rehber
        </Link>
      </div>
      <div className="mt-4 grid gap-3">
        {clues.map((clue) => (
          <div key={clue.id} className="rounded-[18px] border border-white/10 bg-slate-950/70 px-4 py-3">
            <p className="font-semibold text-white">{clue.title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{clue.summary}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

function buildComparison(
  leftCode: string,
  rightCode: string,
  countries: CountryProfile[],
  clues: ClueRecord[]
) {
  const leftCountry = countries.find((country) => country.code === leftCode);
  const rightCountry = countries.find((country) => country.code === rightCode);

  if (!leftCountry || !rightCountry) {
    return null;
  }

  const leftClues = clues.filter((clue) => clue.countryCode === leftCode);
  const rightClues = clues.filter((clue) => clue.countryCode === rightCode);
  const leftFeaturedClues = leftCountry.featuredClueIds
    .map((clueId) => clues.find((clue) => clue.id === clueId))
    .filter((clue): clue is ClueRecord => Boolean(clue));
  const rightFeaturedClues = rightCountry.featuredClueIds
    .map((clueId) => clues.find((clue) => clue.id === clueId))
    .filter((clue): clue is ClueRecord => Boolean(clue));
  const sharedCategories = clueCategories.filter(
    (category) =>
      leftClues.some((clue) => clue.category === category.slug) &&
      rightClues.some((clue) => clue.category === category.slug)
  );

  return {
    left: {
      country: leftCountry,
      featuredClues: leftFeaturedClues,
    },
    right: {
      country: rightCountry,
      featuredClues: rightFeaturedClues,
    },
    sharedCategories,
  };
}
