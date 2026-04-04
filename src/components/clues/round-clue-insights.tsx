"use client";

import type {
  LocationClueRecord,
  LocationContext,
  LocationVerificationState,
} from "@/lib/game-locations/types";

type RoundClueInsightsProps = {
  clueCount: number;
  clues: LocationClueRecord[];
  isResolvingClues: boolean;
  phase: "idle" | "playing" | "revealed" | "finished" | "loading-round" | "starting" | "error";
  summary: string | null;
  verificationState: LocationVerificationState | null;
  locationContext: LocationContext | null;
};

export function RoundClueInsights({
  clueCount,
  clues,
  isResolvingClues,
  phase,
  summary,
  verificationState,
  locationContext,
}: RoundClueInsightsProps) {
  if (phase === "loading-round" || phase === "starting") {
    return null;
  }

  if (phase === "playing") {
    return (
      <aside className="mt-3 rounded-[24px] border border-white/12 bg-slate-950/82 px-5 py-4 text-sm text-slate-100 backdrop-blur-md">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-cyan-200">
          Round clue kasasi
        </p>
        <p className="mt-2 leading-6 text-slate-300">
          Bu round icin lokasyona ozel ipuclari public degil ve oyun bitene kadar kapali tutuluyor.
          Tahmini gonderdiginde ayni sahneye ait detayli clue aciklamasi acilacak.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs uppercase tracking-[0.2em] text-slate-300">
          <span className="rounded-full border border-white/10 bg-white/6 px-3 py-2">
            Reveal sonrasi {clueCount} clue
          </span>
          <span className="rounded-full border border-white/10 bg-white/6 px-3 py-2">
            Kaynak: lokasyon kaydi
          </span>
        </div>
      </aside>
    );
  }

  if (isResolvingClues) {
    return (
      <aside className="mt-3 rounded-[24px] border border-white/12 bg-slate-950/82 px-5 py-4 text-sm text-slate-200 backdrop-blur-md">
        Round sonu lokasyon clue paketi hazirlaniyor.
      </aside>
    );
  }

  if (!locationContext) {
    return (
      <aside className="mt-3 rounded-[24px] border border-white/12 bg-slate-950/82 px-5 py-4 text-sm text-slate-200 backdrop-blur-md">
        Bu round icin lokasyon kaydi okunamadi.
      </aside>
    );
  }

  return (
    <aside className="mt-3 rounded-[24px] border border-white/12 bg-slate-950/82 px-5 py-4 text-sm text-slate-100 backdrop-blur-md">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-cyan-200">
            Round sonu lokasyon clue ozeti
          </p>
          <h3 className="mt-2 text-xl font-semibold text-white">
            Bu sahne neden {locationContext.countryName} olabilirdi?
          </h3>
          <p className="mt-2 leading-6 text-slate-300">
            {summary ?? "Lokasyona ait scene notlari bu panelde toplanir."}
          </p>
        </div>
        {verificationState ? (
          <span className="rounded-full border border-white/10 bg-white/6 px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-300">
            {verificationState === "audited" ? "Scene audited" : "Seeded scene"}
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em] text-slate-300">
        <span className="rounded-full border border-white/10 bg-white/6 px-3 py-2">
          {locationContext.locality ?? "lokasyon"} / {locationContext.regionName ?? "bolge"}
        </span>
        <span className="rounded-full border border-white/10 bg-white/6 px-3 py-2">
          {clues.length} kayitli scene clue
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        {clues.map((clue) => (
          <article key={clue.id} className="rounded-[18px] border border-white/10 bg-white/6 px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">{clue.title}</p>
              <div className="flex flex-wrap gap-2 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-cyan-200">
                <span className="rounded-full border border-white/10 bg-slate-950/70 px-2 py-1">
                  {clue.category}
                </span>
                <span className="rounded-full border border-white/10 bg-slate-950/70 px-2 py-1">
                  {clue.confidence}
                </span>
              </div>
            </div>
            <p className="mt-2 leading-6 text-slate-200">{clue.shortText}</p>
            <p className="mt-3 leading-6 text-slate-300">{clue.details}</p>
            {clue.positionHint ? (
              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
                Kadranda bak: {clue.positionHint}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </aside>
  );
}
