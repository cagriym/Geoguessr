"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { ClueRecord, CountryGuide, ResolvedLocationContext } from "@/lib/clues/types";

type RoundClueInsightsProps = {
  isResolvingLocationContext: boolean;
  locationContext: ResolvedLocationContext | null | undefined;
  phase: "idle" | "playing" | "revealed" | "finished" | "loading-round" | "starting" | "error";
  starterClues: ClueRecord[];
};

export function RoundClueInsights({
  isResolvingLocationContext,
  locationContext,
  phase,
  starterClues,
}: RoundClueInsightsProps) {
  const [guide, setGuide] = useState<CountryGuide | null>(null);
  const [resolvedCountryCode, setResolvedCountryCode] = useState<string | null>(null);

  useEffect(() => {
    if ((phase !== "revealed" && phase !== "finished") || !locationContext?.countryCode) {
      return;
    }

    const controller = new AbortController();

    void fetch(`/api/clues/countries/${locationContext.countryCode}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        return (await response.json()) as CountryGuide;
      })
      .then((payload) => {
        if (!controller.signal.aborted) {
          setGuide(payload);
          setResolvedCountryCode(locationContext.countryCode);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setGuide(null);
          setResolvedCountryCode(locationContext.countryCode);
        }
      });

    return () => controller.abort();
  }, [locationContext?.countryCode, phase]);

  if (phase === "loading-round" || phase === "starting") {
    return null;
  }

  if (phase === "playing") {
    return (
      <aside className="mt-3 rounded-[24px] border border-white/12 bg-slate-950/82 px-5 py-4 text-sm text-slate-100 backdrop-blur-md">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-cyan-200">
              Oyun sirasi ipuclari
            </p>
            <p className="mt-2 leading-6 text-slate-300">
              Ilk bakista yol cizgisi, tabela dili ve varsa arac meta parcasina odaklan.
            </p>
          </div>
          <Link
            href="/clues"
            className="rounded-full border border-white/14 bg-white/7 px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-white transition hover:bg-white/12"
          >
            Clue atlas
          </Link>
        </div>

        <div className="mt-4 grid gap-3">
          {starterClues.map((clue) => (
            <CluePreviewCard key={clue.id} clue={clue} />
          ))}
        </div>
      </aside>
    );
  }

  if (
    isResolvingLocationContext ||
    ((phase === "revealed" || phase === "finished") &&
      Boolean(locationContext?.countryCode) &&
      resolvedCountryCode !== locationContext?.countryCode)
  ) {
    return (
      <aside className="mt-3 rounded-[24px] border border-white/12 bg-slate-950/82 px-5 py-4 text-sm text-slate-200 backdrop-blur-md">
        Round sonu ipuclari hazirlaniyor.
      </aside>
    );
  }

  if (!locationContext?.countryCode) {
    return (
      <aside className="mt-3 rounded-[24px] border border-white/12 bg-slate-950/82 px-5 py-4 text-sm text-slate-200 backdrop-blur-md">
        Bu round icin ulke baglami cozulmedi. Genel clue atlasini kullanarak kategori bazli
        inceleme yapabilirsin.
      </aside>
    );
  }

  if (!guide) {
    return (
      <aside className="mt-3 rounded-[24px] border border-white/12 bg-slate-950/82 px-5 py-4 text-sm text-slate-200 backdrop-blur-md">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-cyan-200">
          Round sonu clue ozeti
        </p>
        <p className="mt-2 leading-6 text-white">
          Bu konum {locationContext.countryName ?? "cozuldugu ulke"} icindeydi.
        </p>
        <p className="mt-3 leading-6 text-slate-300">
          Bu ulke icin veritabani kaydi henuz yok ya da Supabase okunamadi. Genel atlas sayfasindan
          kategori ve ulke tabanli kayitlari inceleyebilirsin.
        </p>
      </aside>
    );
  }

  return (
    <aside className="mt-3 rounded-[24px] border border-white/12 bg-slate-950/82 px-5 py-4 text-sm text-slate-100 backdrop-blur-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-cyan-200">
            Round sonu clue ozeti
          </p>
          <h3 className="mt-2 text-xl font-semibold text-white">
            Bu konum neden {guide.country.name} olabilirdi?
          </h3>
          <p className="mt-2 leading-6 text-slate-300">{guide.country.guideSummary}</p>
        </div>
        <Link
          href={`/clues/countries/${guide.country.code}`}
          className="rounded-full border border-white/14 bg-white/7 px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-white transition hover:bg-white/12"
        >
          Tam rehber
        </Link>
      </div>

      <div className="mt-4 grid gap-3">
        {guide.featuredClues.map((clue) => (
          <CluePreviewCard key={clue.id} clue={clue} />
        ))}
      </div>

      {guide.compareCountries.length > 0 ? (
        <div className="mt-4">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
            Sik karisan ulkeler
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {guide.compareCountries.map((country) => (
              <Link
                key={country.code}
                href={`/clues/countries/${country.code}`}
                className="rounded-full border border-white/12 bg-white/6 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:bg-white/12"
              >
                {country.name}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
}

function CluePreviewCard({ clue }: { clue: ClueRecord }) {
  return (
    <article className="rounded-[18px] border border-white/10 bg-white/6 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">{clue.title}</p>
        <span className="rounded-full border border-white/10 bg-slate-950/70 px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-cyan-200">
          {clue.countryName}
        </span>
      </div>
      <p className="mt-2 leading-6 text-slate-300">{clue.summary}</p>
    </article>
  );
}
