"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { RoundClueInsights } from "@/components/clues/round-clue-insights";
import { accuracyLabel, formatDistance, formatPoints } from "@/lib/geo";
import {
  clearPersistedGameState,
  loadPersistedGameState,
  savePersistedGameState,
  subscribeToPersistedGameState,
  type PersistedRoundSummary,
} from "@/lib/game-storage";
import type { GameRoundPayload, RevealedRoundPayload } from "@/lib/game-locations/types";
import { loadGoogleMapsApi } from "@/lib/maps-loader";

const TOTAL_ROUNDS = 5;
const ROUND_TIME_SECONDS = 90;
const ROUND_DURATION_OPTIONS = [30, 60, 90, 120, 180] as const;
const MAP_OVERVIEW_CENTER = { lat: 20, lng: 10 };

type GamePhase = "idle" | "starting" | "loading-round" | "playing" | "revealed" | "finished" | "error";
type LaunchIntent = "new" | "resume" | null;

type StatCardProps = {
  accent: string;
  label: string;
  value: string;
};

function StatCard({ accent, label, value }: StatCardProps) {
  return (
    <div className="rounded-[22px] border border-white/12 bg-white/7 px-4 py-3 backdrop-blur-md">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-300">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${accent}`}>{value}</p>
    </div>
  );
}

export function StreetGuessGame() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const gameViewportRef = useRef<HTMLDivElement | null>(null);
  const streetViewElementRef = useRef<HTMLDivElement | null>(null);
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const mapClickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const guessMarkerRef = useRef<google.maps.Marker | null>(null);
  const targetMarkerRef = useRef<google.maps.Marker | null>(null);
  const pathLineRef = useRef<google.maps.Polyline | null>(null);
  const phaseRef = useRef<GamePhase>("idle");
  const submitGuessRef = useRef<(autoReveal?: boolean) => Promise<void>>(async () => {});

  const [phase, setPhase] = useState<GamePhase>("idle");
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [timer, setTimer] = useState(ROUND_TIME_SECONDS);
  const [roundDurationSeconds, setRoundDurationSeconds] = useState(ROUND_TIME_SECONDS);
  const [deadlineTs, setDeadlineTs] = useState<number | null>(null);
  const [guess, setGuess] = useState<google.maps.LatLngLiteral | null>(null);
  const [target, setTarget] = useState<GameRoundPayload | null>(null);
  const [usedLocationIds, setUsedLocationIds] = useState<string[]>([]);
  const [roundScore, setRoundScore] = useState<number | null>(null);
  const [roundDistance, setRoundDistance] = useState<number | null>(null);
  const [history, setHistory] = useState<PersistedRoundSummary[]>([]);
  const [revealedRound, setRevealedRound] = useState<RevealedRoundPayload | null>(null);
  const [isResolvingReveal, setIsResolvingReveal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [isViewportFullscreenLike, setIsViewportFullscreenLike] = useState(false);
  const [launchIntent, setLaunchIntent] = useState<LaunchIntent>(null);

  const hasRecoverableSession = useSyncExternalStore(
    subscribeToPersistedGameState,
    () => Boolean(loadPersistedGameState()),
    () => false
  );

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncFullscreenLikeState = () => {
      const byApi = Boolean(document.fullscreenElement);
      const byViewport =
        Math.abs(window.outerHeight - window.innerHeight) < 8 &&
        Math.abs(window.outerWidth - window.innerWidth) < 8;

      setIsViewportFullscreenLike(byApi || byViewport);
    };

    syncFullscreenLikeState();
    window.addEventListener("resize", syncFullscreenLikeState);
    document.addEventListener("fullscreenchange", syncFullscreenLikeState);
    return () => {
      window.removeEventListener("resize", syncFullscreenLikeState);
      document.removeEventListener("fullscreenchange", syncFullscreenLikeState);
    };
  }, []);

  const clearMapOverlays = useCallback(() => {
    guessMarkerRef.current?.setMap(null);
    targetMarkerRef.current?.setMap(null);
    pathLineRef.current?.setMap(null);
    guessMarkerRef.current = null;
    targetMarkerRef.current = null;
    pathLineRef.current = null;
  }, []);

  const requestGameFullscreen = useCallback(() => {
    const targetElement = gameViewportRef.current;
    if (!targetElement || document.fullscreenElement === targetElement) return;
    void targetElement.requestFullscreen?.().catch(() => {});
  }, []);

  const ensureGuessMarker = useCallback((point: google.maps.LatLngLiteral | null) => {
    const map = mapRef.current;
    if (!window.google?.maps || !map) return;

    if (!point) {
      guessMarkerRef.current?.setMap(null);
      guessMarkerRef.current = null;
      return;
    }

    if (!guessMarkerRef.current) {
      guessMarkerRef.current = new window.google.maps.Marker({
        icon: {
          fillColor: "#34d399",
          fillOpacity: 1,
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 7,
          strokeColor: "#052e16",
          strokeWeight: 3,
        },
        map,
        position: point,
        title: "Tahminin",
      });
      return;
    }

    guessMarkerRef.current.setPosition(point);
    guessMarkerRef.current.setMap(map);
  }, []);

  const revealOnMap = useCallback((playerGuess: google.maps.LatLngLiteral | null, actualTarget: google.maps.LatLngLiteral) => {
    const map = mapRef.current;
    if (!window.google?.maps || !map) return;

    clearMapOverlays();

    if (playerGuess) {
      guessMarkerRef.current = new window.google.maps.Marker({
        icon: {
          fillColor: "#34d399",
          fillOpacity: 1,
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 7,
          strokeColor: "#052e16",
          strokeWeight: 3,
        },
        map,
        position: playerGuess,
        title: "Tahminin",
      });
    }

    targetMarkerRef.current = new window.google.maps.Marker({
      icon: {
        fillColor: "#f97316",
        fillOpacity: 1,
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 8,
        strokeColor: "#7c2d12",
        strokeWeight: 3,
      },
      map,
      position: actualTarget,
      title: "Gercek konum",
    });

    if (playerGuess) {
      pathLineRef.current = new window.google.maps.Polyline({
        map,
        path: [playerGuess, actualTarget],
        strokeColor: "#a855f7",
        strokeOpacity: 0.9,
        strokeWeight: 3,
      });
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(actualTarget);
      bounds.extend(playerGuess);
      map.fitBounds(bounds, 72);
      return;
    }

    map.setCenter(actualTarget);
    map.setZoom(5);
  }, [clearMapOverlays]);

  const ensureMapsReady = useCallback(async () => {
    if (!apiKey) {
      throw new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY tanimli degil.");
    }

    await loadGoogleMapsApi(apiKey);

    if (!streetViewElementRef.current || !mapElementRef.current) {
      throw new Error("Harita alanlari henuz hazir degil.");
    }

    if (!mapRef.current) {
      mapRef.current = new window.google.maps.Map(mapElementRef.current, {
        center: MAP_OVERVIEW_CENTER,
        clickableIcons: false,
        disableDefaultUI: true,
        gestureHandling: "greedy",
        keyboardShortcuts: false,
        minZoom: 2,
        zoom: 2,
      });
    }

    if (!panoramaRef.current) {
      panoramaRef.current = new window.google.maps.StreetViewPanorama(streetViewElementRef.current, {
        addressControl: false,
        disableDefaultUI: true,
        enableCloseButton: false,
        fullscreenControl: false,
        linksControl: true,
        motionTracking: false,
        panControl: false,
        showRoadLabels: false,
        zoomControl: true,
      });
    }

    if (mapRef.current && !mapClickListenerRef.current) {
      mapClickListenerRef.current = mapRef.current.addListener("click", (event: google.maps.MapMouseEvent) => {
        if (phaseRef.current !== "playing" || !event.latLng) return;
        const nextGuess = { lat: event.latLng.lat(), lng: event.latLng.lng() };
        setGuess(nextGuess);
        ensureGuessMarker(nextGuess);
      });
    }
  }, [apiKey, ensureGuessMarker]);

  const hydrateRound = useCallback((activeRound: GameRoundPayload, playerGuess: google.maps.LatLngLiteral | null) => {
    const map = mapRef.current;
    const panorama = panoramaRef.current;
    if (!map || !panorama) return;
    map.setCenter(MAP_OVERVIEW_CENTER);
    map.setZoom(2);
    panorama.setPosition(activeRound.position);
    panorama.setPov({ heading: activeRound.heading, pitch: activeRound.pitch });
    panorama.setVisible(true);
    panorama.setZoom(activeRound.viewZoom);
    ensureGuessMarker(playerGuess);
  }, [ensureGuessMarker]);

  const fetchRound = useCallback(async (excludeLocationIds: string[]) => {
    const response = await fetch("/api/game/round", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ excludeLocationIds }),
    });
    if (!response.ok) throw new Error("Yeni round veritabanindan alinamadi.");
    return ((await response.json()) as { round: GameRoundPayload }).round;
  }, []);

  const revealRound = useCallback(async (activeTarget: GameRoundPayload, playerGuess: google.maps.LatLngLiteral | null, currentRound: number, baseHistory: PersistedRoundSummary[], baseScore: number) => {
    setIsResolvingReveal(true);
    try {
      const response = await fetch("/api/game/reveal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ guess: playerGuess, roundToken: activeTarget.roundToken }),
      });
      if (!response.ok) throw new Error("Round sonucu alinamadi.");

      const payload = (await response.json()) as RevealedRoundPayload;
      const nextHistory = [...baseHistory, { distanceKm: payload.distanceKm, points: payload.points, round: currentRound }];
      const nextPhase = currentRound >= TOTAL_ROUNDS ? "finished" : "revealed";

      setRoundDistance(payload.distanceKm);
      setRoundScore(payload.points);
      setHistory(nextHistory);
      setScore(baseScore + payload.points);
      setDeadlineTs(null);
      setTimer(0);
      setRevealedRound(payload);
      setPhase(nextPhase);
      revealOnMap(playerGuess, payload.target.position);
    } finally {
      setIsResolvingReveal(false);
    }
  }, [revealOnMap]);

  const loadRound = useCallback(async (nextRound: number, currentUsedLocationIds: string[], durationSeconds: number = roundDurationSeconds) => {
    const map = mapRef.current;
    if (!map) return;
    try {
      setPhase("loading-round");
      setErrorMessage(null);
      setRound(nextRound);
      setGuess(null);
      setRevealedRound(null);
      setRoundScore(null);
      setRoundDistance(null);
      setDeadlineTs(null);
      setTimer(durationSeconds);
      clearMapOverlays();
      map.setCenter(MAP_OVERVIEW_CENTER);
      map.setZoom(2);

      const nextTarget = await fetchRound(currentUsedLocationIds);
      const nextUsedLocationIds = [...currentUsedLocationIds, nextTarget.locationId];

      setTarget(nextTarget);
      setUsedLocationIds(nextUsedLocationIds);
      hydrateRound(nextTarget, null);
      setDeadlineTs(Date.now() + durationSeconds * 1000);
      setPhase("playing");
    } catch (error) {
      console.error(error);
      setPhase("error");
      setErrorMessage(error instanceof Error ? error.message : "Yeni round yuklenemedi.");
    }
  }, [clearMapOverlays, fetchRound, hydrateRound, roundDurationSeconds]);

  const startFreshGame = useCallback(async () => {
    try {
      setPhase("starting");
      await ensureMapsReady();
      clearPersistedGameState();
      setIsMapExpanded(false);
      setScore(0);
      setHistory([]);
      setUsedLocationIds([]);
      await loadRound(1, [], roundDurationSeconds);
    } catch (error) {
      console.error(error);
      setPhase("error");
      setErrorMessage(error instanceof Error ? error.message : "Oyun baslatilamadi.");
    }
  }, [ensureMapsReady, loadRound, roundDurationSeconds]);

  const restorePersistedGame = useCallback(async () => {
    try {
      const snapshot = loadPersistedGameState();
      if (!snapshot || !snapshot.target) {
        await startFreshGame();
        return;
      }

      setPhase("starting");
      await ensureMapsReady();
      setIsMapExpanded(false);
      setRoundDurationSeconds(snapshot.roundDurationSeconds);
      setScore(snapshot.score);
      setHistory(snapshot.history);
      setUsedLocationIds(snapshot.usedLocationIds);
      setRound(snapshot.round);
      setGuess(snapshot.guess);
      setTarget(snapshot.target);
      setRoundScore(snapshot.roundScore);
      setRoundDistance(snapshot.roundDistance);
      setRevealedRound(snapshot.revealedRound);
      hydrateRound(snapshot.target, snapshot.guess);

      if ((snapshot.phase === "revealed" || snapshot.phase === "finished") && snapshot.revealedRound) {
        revealOnMap(snapshot.guess, snapshot.revealedRound.target.position);
        setTimer(0);
        setDeadlineTs(null);
        setPhase(snapshot.phase);
        return;
      }

      const remainingSeconds = getRemainingSeconds(snapshot.deadlineTs);
      if (remainingSeconds === 0) {
        await revealRound(snapshot.target, snapshot.guess, snapshot.round, snapshot.history, snapshot.score);
        return;
      }

      setTimer(remainingSeconds);
      setDeadlineTs(snapshot.deadlineTs);
      setPhase("playing");
    } catch (error) {
      console.error(error);
      setPhase("error");
      setErrorMessage(error instanceof Error ? error.message : "Kayitli oyun yuklenemedi.");
    }
  }, [ensureMapsReady, hydrateRound, revealOnMap, revealRound, startFreshGame]);

  const submitGuess = useCallback(async (autoReveal = false) => {
    if (!target || (!guess && !autoReveal)) return;
    setErrorMessage(null);
    try {
      await revealRound(target, guess, round, history, score);
    } catch (error) {
      console.error(error);
      setPhase("error");
      setErrorMessage(error instanceof Error ? error.message : "Round sonucu alinamadi.");
    }
  }, [guess, history, revealRound, round, score, target]);

  useEffect(() => {
    submitGuessRef.current = submitGuess;
  }, [submitGuess]);

  useEffect(() => {
    if (phase !== "playing" || !deadlineTs) return;
    let timerId = 0;

    const tick = () => {
      const nextTimer = getRemainingSeconds(deadlineTs);
      setTimer(nextTimer);
      if (nextTimer === 0) {
        window.clearInterval(timerId);
        void submitGuessRef.current(true);
      }
    };

    tick();
    timerId = window.setInterval(tick, 1000);
    return () => window.clearInterval(timerId);
  }, [deadlineTs, phase]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;

    const resizeTimer = window.setTimeout(() => {
      window.google.maps.event.trigger(map, "resize");
      if ((phase === "revealed" || phase === "finished") && revealedRound) {
        revealOnMap(guess, revealedRound.target.position);
      } else if (phase === "playing") {
        ensureGuessMarker(guess);
      }
    }, 180);

    return () => window.clearTimeout(resizeTimer);
  }, [ensureGuessMarker, guess, isMapExpanded, phase, revealOnMap, revealedRound]);

  useEffect(() => {
    if (!["playing", "revealed", "finished"].includes(phase)) return;
    savePersistedGameState({
      deadlineTs: phase === "playing" ? deadlineTs : null,
      guess,
      history,
      phase: phase as "playing" | "revealed" | "finished",
      revealedRound: phase === "playing" ? null : revealedRound,
      round,
      roundDistance,
      roundDurationSeconds,
      roundScore,
      score,
      target,
      usedLocationIds,
      version: 3,
    });
  }, [deadlineTs, guess, history, phase, revealedRound, round, roundDistance, roundDurationSeconds, roundScore, score, target, usedLocationIds]);

  useEffect(() => {
    if (phase === "idle" || phase === "error") clearPersistedGameState();
  }, [phase]);

  const handleLaunchDecision = useCallback(async (shouldUseFullscreen: boolean) => {
    const activeIntent = launchIntent;
    setLaunchIntent(null);
    if (!activeIntent) return;
    if (shouldUseFullscreen) requestGameFullscreen();
    if (activeIntent === "resume") {
      await restorePersistedGame();
      return;
    }
    await startFreshGame();
  }, [launchIntent, requestGameFullscreen, restorePersistedGame, startFreshGame]);

  const historyAverage = history.length > 0 ? history.reduce((sum, item) => sum + (item.distanceKm ?? 0), 0) / history.length : 0;
  const isImmersiveGameMode = isViewportFullscreenLike && phase !== "idle" && phase !== "error";
  const readyToGuess = phase === "playing" && Boolean(guess) && !isResolvingReveal;
  const canAdvance = phase === "revealed" && round < TOTAL_ROUNDS;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1e293b,transparent_42%),linear-gradient(180deg,#020617,#0f172a_46%,#020617)] text-white">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8">
        {!isImmersiveGameMode ? (
          <header className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
            <div className="rounded-[30px] border border-white/12 bg-white/6 p-6 backdrop-blur-xl">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.32em] text-cyan-200">Street Guess</p>
              <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Scene bazli Supabase oyunu</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200 sm:text-base">
                Roundlar artik veritabanindaki tekil lokasyon kayitlarindan geliyor. Clue atlas public degil; her scene icin yazilan clue paketi sadece o round reveal oldugunda aciliyor.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <StatCard accent="text-cyan-200" label="Toplam skor" value={formatPoints(score)} />
              <StatCard accent="text-lime-300" label="Round" value={`${round}/${TOTAL_ROUNDS}`} />
              <StatCard accent="text-orange-300" label="Sure" value={`${timer}s`} />
            </div>
          </header>
        ) : null}

        <section ref={gameViewportRef} className={`relative overflow-hidden rounded-[34px] border border-white/12 bg-slate-950/58 shadow-[0_26px_80px_rgba(2,6,23,0.5)] ${isImmersiveGameMode ? "min-h-[100dvh]" : "min-h-[72vh]"}`}>
          <div ref={streetViewElementRef} className={`absolute inset-0 ${phase === "idle" ? "pointer-events-none opacity-40" : ""}`} />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.55),transparent_24%,transparent_72%,rgba(2,6,23,0.72))]" />

          <div className="absolute left-4 top-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3">
            <div className="rounded-full border border-white/12 bg-slate-950/72 px-4 py-3 text-[0.68rem] font-semibold uppercase tracking-[0.32em] text-slate-100 backdrop-blur-md">
              Panoramada gezin, sonra sagdaki haritada tahmin birak.
            </div>
            <div className="rounded-full border border-white/12 bg-slate-950/72 px-4 py-3 text-[0.68rem] font-semibold uppercase tracking-[0.32em] text-cyan-200 backdrop-blur-md">
              Round suresi {roundDurationSeconds}s
            </div>
          </div>

          <div className="absolute left-4 bottom-4 z-20 w-[min(92vw,520px)]">
            <div className="rounded-[24px] border border-white/12 bg-slate-950/76 px-5 py-4 text-sm leading-6 text-slate-100 backdrop-blur-md">
              {roundScore !== null ? (
                <>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-cyan-200">Round sonucu</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{accuracyLabel(roundDistance)}</p>
                  <p className="mt-3">Mesafe: <span className="font-semibold text-orange-300">{formatDistance(roundDistance)}</span></p>
                  <p>Bu round puani: <span className="font-semibold text-emerald-300">{formatPoints(roundScore)}</span></p>
                  {revealedRound?.context.countryName ? <p>Cozulen ulke: <span className="font-semibold text-cyan-200">{revealedRound.context.countryName}</span></p> : null}
                </>
              ) : phase === "loading-round" || phase === "starting" ? "Veritabanindaki scene havuzu hazirlaniyor." : phase === "playing" ? "Sagdaki haritaya tiklayip tahminini yerlestir. Sonra gonder." : "Yeni bir oyun baslatmak icin modali kullan."}
            </div>
            {["playing", "revealed", "finished", "loading-round", "starting"].includes(phase) ? (
              <RoundClueInsights
                clueCount={target?.clueCount ?? 0}
                clues={revealedRound?.clues ?? []}
                isResolvingClues={isResolvingReveal}
                locationContext={revealedRound?.context ?? null}
                phase={phase}
                summary={revealedRound?.summary ?? target?.summary ?? null}
                verificationState={target?.verificationState ?? null}
              />
            ) : null}
          </div>

          <div className={`absolute bottom-4 right-4 z-20 transition-all duration-300 ${isMapExpanded ? "w-[min(96vw,760px)]" : "w-[min(90vw,360px)] sm:w-[380px]"}`}>
            <div className="overflow-hidden rounded-[30px] border border-white/12 bg-slate-950/88 shadow-[0_20px_60px_rgba(2,6,23,0.55)] backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-400">Guess Map</p>
                  <p className="mt-1 text-sm text-slate-200">Tahmin icin haritaya tikla.</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setIsMapExpanded((current) => !current)} className="rounded-full border border-white/14 bg-white/7 px-3 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200 transition hover:bg-white/12">
                    {isMapExpanded ? "Haritayi kucult" : "Haritayi buyut"}
                  </button>
                  <button type="button" onClick={() => void startFreshGame()} disabled={!apiKey} className="rounded-full border border-white/14 bg-white/7 px-3 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200 transition hover:bg-white/12 disabled:cursor-not-allowed disabled:text-slate-500">
                    Yeni oyun
                  </button>
                </div>
              </div>
              <div ref={mapElementRef} className={`w-full bg-slate-900 transition-all duration-300 ${isMapExpanded ? "h-[52vh] min-h-[360px]" : "h-56 sm:h-64"}`} />
              <div className="grid gap-3 px-4 py-4 sm:grid-cols-2">
                <button type="button" onClick={() => void submitGuess(false)} disabled={!readyToGuess} className="rounded-full bg-lime-400 px-4 py-3 text-sm font-bold uppercase tracking-[0.22em] text-slate-950 transition hover:bg-lime-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">
                  Tahmini gonder
                </button>
                <button type="button" onClick={() => void loadRound(round + 1, usedLocationIds)} disabled={!canAdvance} className="rounded-full border border-white/14 bg-white/7 px-4 py-3 text-sm font-bold uppercase tracking-[0.22em] text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:border-white/8 disabled:bg-white/5 disabled:text-slate-500">
                  Sonraki round
                </button>
              </div>
            </div>
          </div>

          {phase === "idle" ? (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/48 p-6 backdrop-blur-sm">
              <div className="w-full max-w-2xl rounded-[32px] border border-white/12 bg-slate-950/90 p-8 text-center shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-cyan-200">Oyun Ayari</p>
                <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Once round suresini sec, sonra oyunu baslat.</h2>
                <p className="mt-4 text-sm leading-7 text-slate-200 sm:text-base">Bu surumde roundlar Supabase icindeki curated scene havuzundan geliyor. Harita sagda kucuk acilir, istersen daha sonra buyutebilirsin.</p>
                <div className="mt-6 rounded-[24px] border border-white/10 bg-white/6 p-5 text-left">
                  <label htmlFor="round-duration" className="text-[0.72rem] font-semibold uppercase tracking-[0.26em] text-slate-300">Round suresi</label>
                  <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
                    <select id="round-duration" value={roundDurationSeconds} onChange={(event) => { const nextDuration = Number(event.target.value); setRoundDurationSeconds(nextDuration); setTimer(nextDuration); }} className="rounded-2xl border border-white/12 bg-slate-950/85 px-4 py-3 text-sm font-semibold text-white outline-none">
                      {ROUND_DURATION_OPTIONS.map((durationOption) => <option key={durationOption} value={durationOption}>{durationOption} saniye</option>)}
                    </select>
                    <p className="text-sm leading-6 text-slate-300">Sure oyun icinde gosterilir ve session refresh sonrasinda korunur.</p>
                  </div>
                </div>
                {errorMessage ? <div className="mt-5 rounded-[22px] border border-red-400/30 bg-red-950/70 px-4 py-3 text-sm leading-6 text-red-100">{errorMessage}</div> : null}
                <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <button type="button" onClick={() => setLaunchIntent("new")} disabled={!apiKey} className="rounded-full bg-lime-400 px-6 py-3 text-sm font-bold uppercase tracking-[0.22em] text-slate-950 transition hover:bg-lime-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">Oyna</button>
                  {hasRecoverableSession ? <button type="button" onClick={() => setLaunchIntent("resume")} disabled={!apiKey} className="rounded-full border border-white/14 bg-white/7 px-6 py-3 text-sm font-bold uppercase tracking-[0.22em] text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:text-slate-500">Kayitli oyuna don</button> : null}
                </div>
              </div>
            </div>
          ) : null}

          {launchIntent ? (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/58 p-6 backdrop-blur-sm">
              <div className="w-full max-w-lg rounded-[30px] border border-white/12 bg-slate-950/92 p-7 shadow-[0_24px_80px_rgba(2,6,23,0.45)]">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.32em] text-amber-200">Tam Ekran Uyarisi</p>
                <h3 className="mt-3 text-2xl font-semibold text-white">Oyun baslarken Street View icin tam ekran izni isteyelim mi?</h3>
                <p className="mt-4 text-sm leading-7 text-slate-200">Tam ekranda Street View daha temiz acilir. Sagdaki kucuk harita yerinde kalir ve istersen oyun sirasinda buyutulebilir.</p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <button type="button" onClick={() => void handleLaunchDecision(true)} className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-bold uppercase tracking-[0.22em] text-slate-950 transition hover:bg-cyan-200">Tam ekranla baslat</button>
                  <button type="button" onClick={() => void handleLaunchDecision(false)} className="rounded-full border border-white/14 bg-white/7 px-5 py-3 text-sm font-bold uppercase tracking-[0.22em] text-white transition hover:bg-white/12">Normal baslat</button>
                  <button type="button" onClick={() => setLaunchIntent(null)} className="rounded-full border border-white/10 bg-transparent px-5 py-3 text-sm font-bold uppercase tracking-[0.22em] text-slate-400 transition hover:border-white/14 hover:text-white">Vazgec</button>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        {!isImmersiveGameMode ? (
          <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-[30px] border border-white/12 bg-white/6 p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.32em] text-cyan-200">Roundlar</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Tahmin gecmisi</h2>
                </div>
                <p className="text-sm text-slate-300">Ortalama mesafe: <span className="font-semibold text-orange-300">{formatDistance(historyAverage)}</span></p>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {history.length === 0 ? <div className="rounded-[22px] border border-dashed border-white/14 bg-slate-950/35 px-4 py-5 text-sm text-slate-300">Henuz tamamlanmis round yok.</div> : history.map((item) => (
                  <article key={item.round} className="rounded-[22px] border border-white/12 bg-slate-950/46 px-4 py-4">
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-slate-400">Round {item.round}</p>
                    <p className="mt-3 text-2xl font-semibold text-white">{formatPoints(item.points)}</p>
                    <p className="mt-2 text-sm text-slate-300">Mesafe: <span className="font-medium text-orange-300">{formatDistance(item.distanceKm)}</span></p>
                  </article>
                ))}
              </div>
            </div>
            <aside className="rounded-[30px] border border-white/12 bg-white/6 p-5 backdrop-blur-xl">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.32em] text-cyan-200">Akis</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Curated scene mimarisi</h2>
              <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-200">
                <li>Round secimi Supabase icindeki `game_locations` tablosundan geliyor.</li>
                <li>Her lokasyonun clue seti `location_clues` tablosunda scene bazli tutuluyor.</li>
                <li>Public clue sayfasi yok; clue paketi sadece reveal sonrasi aciliyor.</li>
                <li>Aktif round suresi: {roundDurationSeconds} saniye.</li>
                <li>Oyun baslarken Street View alani fullscreen istenir.</li>
                <li>Sagdaki harita buyutulup tekrar kucultulebilir.</li>
              </ul>
            </aside>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function getRemainingSeconds(deadlineTs: number | null) {
  if (!deadlineTs) return 0;
  return Math.max(0, Math.ceil((deadlineTs - Date.now()) / 1000));
}
