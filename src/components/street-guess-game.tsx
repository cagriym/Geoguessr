"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  clearPersistedGameState,
  loadPersistedGameState,
  savePersistedGameState,
  subscribeToPersistedGameState,
  type PersistedRoundSummary,
} from "@/lib/game-storage";
import {
  accuracyLabel,
  formatDistance,
  formatPoints,
  haversineDistanceKm,
  scoreFromDistance,
} from "@/lib/geo";
import { type KmlStreetViewRound, loadKmlLocationPool, resolveStreetViewRoundFromKml } from "@/lib/kml-location-pool";
import { loadGoogleMapsApi } from "@/lib/maps-loader";

const TOTAL_ROUNDS = 5;
const ROUND_TIME_SECONDS = 90;
const MAP_OVERVIEW_CENTER = { lat: 20, lng: 10 };
const LOCATION_POOL_LABEL = "equitable-stochastic.2023-06-24.full.kml";
const ROUND_DURATION_OPTIONS = [30, 60, 90, 120, 180] as const;

type GamePhase =
  | "idle"
  | "starting"
  | "loading-round"
  | "playing"
  | "revealed"
  | "finished"
  | "error";

type RoundSummary = PersistedRoundSummary;
type LaunchIntent = "new" | "resume" | null;

function StatCard({
  label,
  value,
  accent,
}: {
  accent: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/12 bg-white/7 px-4 py-3 backdrop-blur-md">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-300">
        {label}
      </p>
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
  const streetViewServiceRef = useRef<google.maps.StreetViewService | null>(null);
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
  const [target, setTarget] = useState<KmlStreetViewRound | null>(null);
  const [usedIndices, setUsedIndices] = useState<number[]>([]);
  const [roundScore, setRoundScore] = useState<number | null>(null);
  const [roundDistance, setRoundDistance] = useState<number | null>(null);
  const [history, setHistory] = useState<RoundSummary[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [launchIntent, setLaunchIntent] = useState<LaunchIntent>(null);
  const hasRecoverableSession = useSyncExternalStore(
    subscribeToPersistedGameState,
    () => Boolean(loadPersistedGameState()),
    () => false
  );

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const clearMapOverlays = useCallback(() => {
    guessMarkerRef.current?.setMap(null);
    targetMarkerRef.current?.setMap(null);
    pathLineRef.current?.setMap(null);

    guessMarkerRef.current = null;
    targetMarkerRef.current = null;
    pathLineRef.current = null;
  }, []);

  const requestGameFullscreen = useCallback(() => {
    if (typeof document === "undefined") {
      return;
    }

    const targetElement = gameViewportRef.current;

    if (!targetElement || document.fullscreenElement === targetElement) {
      return;
    }

    void targetElement.requestFullscreen?.().catch(() => {});
  }, []);

  const openLaunchPrompt = useCallback((intent: Exclude<LaunchIntent, null>) => {
    setLaunchIntent(intent);
  }, []);

  const closeLaunchPrompt = useCallback(() => {
    setLaunchIntent(null);
  }, []);

  const ensureGuessMarker = useCallback((point: google.maps.LatLngLiteral | null) => {
    const googleMaps = window.google;
    const map = mapRef.current;

    if (!googleMaps || !map) {
      return;
    }

    if (!point) {
      guessMarkerRef.current?.setMap(null);
      guessMarkerRef.current = null;
      return;
    }

    if (!guessMarkerRef.current) {
      guessMarkerRef.current = new googleMaps.maps.Marker({
        icon: {
          fillColor: "#34d399",
          fillOpacity: 1,
          path: googleMaps.maps.SymbolPath.CIRCLE,
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

  const revealOnMap = useCallback(
    (playerGuess: google.maps.LatLngLiteral | null, actualTarget: google.maps.LatLngLiteral) => {
      const googleMaps = window.google;
      const map = mapRef.current;

      if (!googleMaps || !map) {
        return;
      }

      clearMapOverlays();

      if (playerGuess) {
        guessMarkerRef.current = new googleMaps.maps.Marker({
          icon: {
            fillColor: "#34d399",
            fillOpacity: 1,
            path: googleMaps.maps.SymbolPath.CIRCLE,
            scale: 7,
            strokeColor: "#052e16",
            strokeWeight: 3,
          },
          map,
          position: playerGuess,
          title: "Tahminin",
        });
      }

      targetMarkerRef.current = new googleMaps.maps.Marker({
        icon: {
          fillColor: "#f97316",
          fillOpacity: 1,
          path: googleMaps.maps.SymbolPath.CIRCLE,
          scale: 8,
          strokeColor: "#7c2d12",
          strokeWeight: 3,
        },
        map,
        position: actualTarget,
        title: "Gercek konum",
      });

      if (playerGuess) {
        pathLineRef.current = new googleMaps.maps.Polyline({
          map,
          path: [playerGuess, actualTarget],
          strokeColor: "#a855f7",
          strokeOpacity: 0.9,
          strokeWeight: 3,
        });
      }

      const bounds = new googleMaps.maps.LatLngBounds();
      bounds.extend(actualTarget);

      if (playerGuess) {
        bounds.extend(playerGuess);
        map.fitBounds(bounds, 72);
        return;
      }

      map.setCenter(actualTarget);
      map.setZoom(5);
    },
    [clearMapOverlays]
  );

  const ensureMapsReady = useCallback(async () => {
    if (!apiKey) {
      throw new Error(
        "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY tanimlanmadi. .env.local dosyasina Google Maps anahtari ekle."
      );
    }

    await Promise.all([loadGoogleMapsApi(apiKey), loadKmlLocationPool()]);

    if (!streetViewElementRef.current || !mapElementRef.current) {
      throw new Error("Harita alanlari henuz hazir degil.");
    }

    const googleMaps = window.google;

    if (!mapRef.current) {
      mapRef.current = new googleMaps.maps.Map(mapElementRef.current, {
        center: MAP_OVERVIEW_CENTER,
        clickableIcons: false,
        disableDefaultUI: true,
        gestureHandling: "greedy",
        keyboardShortcuts: false,
        minZoom: 2,
        styles: [
          {
            elementType: "geometry",
            featureType: "all",
            stylers: [{ saturation: -20 }],
          },
        ],
        zoom: 2,
      });
    }

    if (!panoramaRef.current) {
      panoramaRef.current = new googleMaps.maps.StreetViewPanorama(streetViewElementRef.current, {
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

    if (!streetViewServiceRef.current) {
      streetViewServiceRef.current = new googleMaps.maps.StreetViewService();
    }

    if (mapRef.current && !mapClickListenerRef.current) {
      mapClickListenerRef.current = mapRef.current.addListener(
        "click",
        (event: google.maps.MapMouseEvent) => {
          if (phaseRef.current !== "playing" || !event.latLng) {
            return;
          }

          const nextGuess = {
            lat: event.latLng.lat(),
            lng: event.latLng.lng(),
          };

          setGuess(nextGuess);
          ensureGuessMarker(nextGuess);
        }
      );
    }
  }, [apiKey, ensureGuessMarker]);

  const buildRoundOutcome = useCallback(
    (activeRound: KmlStreetViewRound, playerGuess: google.maps.LatLngLiteral | null, currentRound: number) => {
      const distanceKm = playerGuess ? haversineDistanceKm(playerGuess, activeRound.position) : null;
      const points = distanceKm === null ? 0 : scoreFromDistance(distanceKm);

      return {
        distanceKm,
        points,
        summary: {
          distanceKm,
          points,
          round: currentRound,
        } satisfies RoundSummary,
      };
    },
    []
  );

  const hydrateRound = useCallback(
    (activeRound: KmlStreetViewRound, playerGuess: google.maps.LatLngLiteral | null) => {
      const map = mapRef.current;
      const panorama = panoramaRef.current;

      if (!map || !panorama) {
        return;
      }

      map.setCenter(MAP_OVERVIEW_CENTER);
      map.setZoom(2);
      panorama.setPano(activeRound.pano);
      panorama.setPov({
        heading: activeRound.heading,
        pitch: activeRound.pitch,
      });
      panorama.setVisible(true);
      panorama.setZoom(1);
      ensureGuessMarker(playerGuess);
    },
    [ensureGuessMarker]
  );

  const loadRound = useCallback(
    async (
      nextRound: number,
      currentUsedIndices: number[],
      durationSeconds: number = roundDurationSeconds
    ) => {
      const map = mapRef.current;
      const panorama = panoramaRef.current;
      const streetViewService = streetViewServiceRef.current;

      if (!map || !panorama || !streetViewService) {
        return;
      }

      setPhase("loading-round");
      setErrorMessage(null);
      setRound(nextRound);
      setGuess(null);
      setRoundScore(null);
      setRoundDistance(null);
      setDeadlineTs(null);
      setTimer(durationSeconds);
      clearMapOverlays();

      map.setCenter(MAP_OVERVIEW_CENTER);
      map.setZoom(2);

      try {
        const nextTarget = await resolveStreetViewRoundFromKml(
          streetViewService,
          window.google,
          currentUsedIndices
        );
        const nextUsedIndices = [...currentUsedIndices, nextTarget.sourceIndex];

        setTarget(nextTarget);
        setUsedIndices(nextUsedIndices);
        hydrateRound(nextTarget, null);
        setDeadlineTs(Date.now() + durationSeconds * 1000);
        setTimer(durationSeconds);
        setPhase("playing");
      } catch (error) {
        console.error(error);
        setPhase("error");
        setErrorMessage(
          "KML havuzundan Street View konumu bulunamadi. Maps yetkilerini veya veri dosyasini kontrol et."
        );
      }
    },
    [clearMapOverlays, hydrateRound, roundDurationSeconds]
  );

  const startFreshGame = useCallback(async () => {
    try {
      setPhase("starting");
      await ensureMapsReady();
      clearPersistedGameState();
      setIsMapExpanded(false);
      setScore(0);
      setHistory([]);
      setUsedIndices([]);
      await loadRound(1, [], roundDurationSeconds);
    } catch (error) {
      console.error(error);
      setPhase("error");
      setErrorMessage(error instanceof Error ? error.message : "Oyun baslatilamadi.");
    }
  }, [ensureMapsReady, loadRound, roundDurationSeconds]);

  const restorePersistedGame = useCallback(async () => {
    try {
      setPhase("starting");

      const snapshot = loadPersistedGameState();

      if (!snapshot || !snapshot.target) {
        await startFreshGame();
        return;
      }

      await ensureMapsReady();

      setIsMapExpanded(false);
      setRoundDurationSeconds(snapshot.roundDurationSeconds);
      setScore(snapshot.score);
      setHistory(snapshot.history);
      setUsedIndices(snapshot.usedIndices);
      setRound(snapshot.round);
      setGuess(snapshot.guess);
      setTarget(snapshot.target);
      setRoundScore(snapshot.roundScore);
      setRoundDistance(snapshot.roundDistance);
      setErrorMessage(null);

      hydrateRound(snapshot.target, snapshot.guess);

      if (snapshot.phase === "revealed" || snapshot.phase === "finished") {
        revealOnMap(snapshot.guess, snapshot.target.position);
        setDeadlineTs(null);
        setTimer(0);
        setPhase(snapshot.phase);
        return;
      }

      const remainingSeconds = getRemainingSeconds(snapshot.deadlineTs);

      if (remainingSeconds === 0) {
        const outcome = buildRoundOutcome(snapshot.target, snapshot.guess, snapshot.round);
        const nextHistory = [...snapshot.history, outcome.summary];
        const nextScore = snapshot.score + outcome.points;
        const nextPhase = snapshot.round >= TOTAL_ROUNDS ? "finished" : "revealed";

        setHistory(nextHistory);
        setScore(nextScore);
        setRoundScore(outcome.points);
        setRoundDistance(outcome.distanceKm);
        setDeadlineTs(null);
        setTimer(0);
        setPhase(nextPhase);
        revealOnMap(snapshot.guess, snapshot.target.position);
        return;
      }

      setTimer(remainingSeconds);
      setDeadlineTs(snapshot.deadlineTs);
      setPhase("playing");
    } catch (error) {
      console.error(error);
      setPhase("error");
      setErrorMessage(error instanceof Error ? error.message : "Kayitli oyun geri yuklenemedi.");
    }
  }, [buildRoundOutcome, ensureMapsReady, hydrateRound, revealOnMap, startFreshGame]);

  const submitGuess = useCallback(
    async (autoReveal = false) => {
      if (!target) {
        return;
      }

      if (!guess && !autoReveal) {
        return;
      }

      const outcome = buildRoundOutcome(target, guess, round);
      const nextHistory = [...history, outcome.summary];
      const nextScore = score + outcome.points;
      const nextPhase = round >= TOTAL_ROUNDS ? "finished" : "revealed";

      setRoundDistance(outcome.distanceKm);
      setRoundScore(outcome.points);
      setHistory(nextHistory);
      setScore(nextScore);
      setDeadlineTs(null);
      setTimer(0);
      setPhase(nextPhase);

      revealOnMap(guess, target.position);
    },
    [buildRoundOutcome, guess, history, revealOnMap, round, score, target]
  );

  const handleLaunchDecision = useCallback(
    async (shouldUseFullscreen: boolean) => {
      const activeIntent = launchIntent;
      closeLaunchPrompt();

      if (!activeIntent) {
        return;
      }

      if (shouldUseFullscreen) {
        requestGameFullscreen();
      }

      if (activeIntent === "resume") {
        await restorePersistedGame();
        return;
      }

      await startFreshGame();
    },
    [closeLaunchPrompt, launchIntent, requestGameFullscreen, restorePersistedGame, startFreshGame]
  );

  useEffect(() => {
    submitGuessRef.current = submitGuess;
  }, [submitGuess]);

  useEffect(() => {
    if (phase !== "playing" || !deadlineTs) {
      return;
    }

    let timerId = 0;

    const tick = () => {
      const nextTimer = getRemainingSeconds(deadlineTs);
      setTimer(nextTimer);

      if (nextTimer === 0) {
        window.clearInterval(timerId);
        queueMicrotask(() => {
          void submitGuessRef.current(true);
        });
      }
    };

    tick();

    timerId = window.setInterval(tick, 1000);
    return () => window.clearInterval(timerId);
  }, [deadlineTs, phase]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !window.google?.maps) {
      return;
    }

    const resizeTimer = window.setTimeout(() => {
      window.google.maps.event.trigger(map, "resize");

      if ((phase === "revealed" || phase === "finished") && target) {
        revealOnMap(guess, target.position);
        return;
      }

      if (phase === "playing") {
        ensureGuessMarker(guess);
      }
    }, 180);

    return () => window.clearTimeout(resizeTimer);
  }, [ensureGuessMarker, guess, isMapExpanded, phase, revealOnMap, target]);

  useEffect(() => {
    if (phase !== "playing" && phase !== "revealed" && phase !== "finished") {
      return;
    }

    savePersistedGameState({
      deadlineTs: phase === "playing" ? deadlineTs : null,
      guess,
      history,
      phase,
      round,
      roundDurationSeconds,
      roundDistance,
      roundScore,
      score,
      target,
      usedIndices,
      version: 2,
    });
  }, [
    deadlineTs,
    guess,
    history,
    phase,
    round,
    roundDistance,
    roundDurationSeconds,
    roundScore,
    score,
    target,
    usedIndices,
  ]);

  useEffect(() => {
    return () => {
      mapClickListenerRef.current?.remove();
      mapClickListenerRef.current = null;
    };
  }, []);

  const currentPhase: GamePhase = apiKey ? phase : "error";
  const currentErrorMessage = apiKey
    ? errorMessage
    : "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY tanimlanmadi. .env.local dosyasina Google Maps anahtari ekle.";

  const readyToGuess = currentPhase === "playing" && Boolean(guess);
  const canAdvance = currentPhase === "revealed" && round < TOTAL_ROUNDS;
  const shouldShowSummary = currentPhase === "finished";
  const historyAverage =
    history.length === 0
      ? null
      : history.reduce((total, item) => total + (item.distanceKm ?? 0), 0) / history.length;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1d4ed8_0%,#0f172a_35%,#020617_100%)] px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <section className="flex flex-col gap-4 rounded-[30px] border border-white/12 bg-white/6 p-5 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.38em] text-cyan-200">
              Street View Guess Game
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
              KML havuzundan beslenen, login gerektirmeyen GeoGuessr tarzi oyun.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">
              Oyun artik istemcide `Oyna` tusuna basildiginda baslar. Konum havuzu tek bir statik
              JSON dosyasindan yuklenir, aktif round snapshot&apos;i sessionStorage ile saklanir ve
              refresh sonrasinda ayni oyuna devam edebilirsin.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatCard label="Round" value={`${round}/${TOTAL_ROUNDS}`} accent="text-cyan-200" />
            <StatCard label="Timer" value={`${timer}s`} accent="text-fuchsia-200" />
            <StatCard
              label="Round sure"
              value={`${roundDurationSeconds}s`}
              accent="text-violet-200"
            />
            <StatCard label="Score" value={formatPoints(score)} accent="text-emerald-300" />
            <StatCard
              label="Source"
              value={currentPhase === "idle" ? "Hazir" : "KML"}
              accent="text-orange-200"
            />
          </div>
        </section>

        <section
          ref={gameViewportRef}
          className="relative overflow-hidden rounded-[36px] border border-white/10 bg-slate-950/65 shadow-[0_30px_120px_rgba(15,23,42,0.75)]"
        >
          <div ref={streetViewElementRef} className="h-[58vh] min-h-[440px] w-full lg:h-[78vh]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.15),rgba(2,6,23,0.5))]" />

          <div className="absolute left-4 top-4 z-10 flex flex-wrap items-center gap-2">
            <div className="rounded-full border border-white/16 bg-slate-950/74 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-slate-200 backdrop-blur-md">
              Panoramada gezin, sonra sagdaki haritada tahmin birak.
            </div>
            <div className="rounded-full border border-white/16 bg-slate-950/74 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200 backdrop-blur-md">
              Round suresi {roundDurationSeconds}s
            </div>
          </div>

          {currentErrorMessage && currentPhase !== "idle" ? (
            <div className="absolute left-4 top-20 z-10 max-w-md rounded-[22px] border border-red-400/30 bg-red-950/78 px-4 py-3 text-sm leading-6 text-red-100 backdrop-blur-md">
              {currentErrorMessage}
            </div>
          ) : null}

          <div className="absolute bottom-4 left-4 z-10 max-w-md">
            {roundScore !== null ? (
              <div className="rounded-[24px] border border-white/12 bg-slate-950/82 px-5 py-4 text-sm leading-6 text-slate-100 backdrop-blur-md">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-slate-300">
                  Sonuc
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {accuracyLabel(roundDistance)}
                </p>
                <p className="mt-3 text-slate-200">
                  Mesafe:{" "}
                  <span className="font-semibold text-orange-300">
                    {formatDistance(roundDistance)}
                  </span>
                </p>
                <p className="text-slate-200">
                  Bu round puani:{" "}
                  <span className="font-semibold text-emerald-300">
                    {formatPoints(roundScore)}
                  </span>
                </p>
              </div>
            ) : (
              <div className="rounded-[24px] border border-white/12 bg-slate-950/76 px-5 py-4 text-sm leading-6 text-slate-100 backdrop-blur-md">
                {currentPhase === "loading-round" || currentPhase === "starting"
                  ? "Street View ve KML havuzu hazirlaniyor."
                  : currentPhase === "playing"
                    ? "Sagdaki haritaya tiklayip tahminini yerlestir. Sonra gonder."
                    : "Yeni bir oyun baslatmak icin modalı kullan."}
              </div>
            )}
          </div>

          <div
            className={`absolute bottom-4 right-4 z-20 transition-all duration-300 ${
              isMapExpanded ? "w-[min(96vw,760px)]" : "w-[min(90vw,360px)] sm:w-[380px]"
            }`}
          >
            <div className="overflow-hidden rounded-[30px] border border-white/12 bg-slate-950/88 shadow-[0_20px_60px_rgba(2,6,23,0.55)] backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-400">
                    Guess Map
                  </p>
                  <p className="mt-1 text-sm text-slate-200">Tahmin icin haritaya tikla.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsMapExpanded((current) => !current)}
                    className="rounded-full border border-white/14 bg-white/7 px-3 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200 transition hover:bg-white/12"
                  >
                    {isMapExpanded ? "Haritayi kucult" : "Haritayi buyut"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void startFreshGame()}
                    className="rounded-full border border-white/14 bg-white/7 px-3 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200 transition hover:bg-white/12 disabled:cursor-not-allowed disabled:text-slate-500"
                    disabled={!apiKey}
                  >
                    Yeni oyun
                  </button>
                </div>
              </div>

              <div
                ref={mapElementRef}
                className={`w-full bg-slate-900 transition-all duration-300 ${
                  isMapExpanded ? "h-[52vh] min-h-[360px]" : "h-56 sm:h-64"
                }`}
              />

              <div className="grid gap-3 px-4 py-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void submitGuess(false)}
                  disabled={!readyToGuess}
                  className="rounded-full bg-lime-400 px-4 py-3 text-sm font-bold uppercase tracking-[0.22em] text-slate-950 transition hover:bg-lime-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                  Tahmini gonder
                </button>

                <button
                  type="button"
                  onClick={() => void loadRound(round + 1, usedIndices)}
                  disabled={!canAdvance}
                  className="rounded-full border border-white/14 bg-white/7 px-4 py-3 text-sm font-bold uppercase tracking-[0.22em] text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:border-white/8 disabled:bg-white/5 disabled:text-slate-500"
                >
                  Sonraki round
                </button>
              </div>
            </div>
          </div>

          {phase === "idle" ? (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/48 p-6 backdrop-blur-sm">
              <div className="w-full max-w-2xl rounded-[32px] border border-white/12 bg-slate-950/90 p-8 text-center shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-cyan-200">
                  Oyun Ayari
                </p>
                <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
                  Once round suresini sec, sonra oyunu baslat.
                </h2>
                <p className="mt-4 text-sm leading-7 text-slate-200 sm:text-base">
                  Street View viewport oyun baslayinca tam ekran icin izin isteyecek. Harita sagda
                  kucuk acilir, istersen daha sonra buyutebilirsin.
                </p>

                <div className="mt-6 rounded-[24px] border border-white/10 bg-white/6 p-5 text-left">
                  <label
                    htmlFor="round-duration"
                    className="text-[0.72rem] font-semibold uppercase tracking-[0.26em] text-slate-300"
                  >
                    Round suresi
                  </label>
                  <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
                    <select
                      id="round-duration"
                      value={roundDurationSeconds}
                      onChange={(event) => {
                        const nextDuration = Number(event.target.value);
                        setRoundDurationSeconds(nextDuration);
                        setTimer(nextDuration);
                      }}
                      className="rounded-2xl border border-white/12 bg-slate-950/85 px-4 py-3 text-sm font-semibold text-white outline-none"
                    >
                      {ROUND_DURATION_OPTIONS.map((durationOption) => (
                        <option key={durationOption} value={durationOption}>
                          {durationOption} saniye
                        </option>
                      ))}
                    </select>
                    <p className="text-sm leading-6 text-slate-300">
                      Secilen sure oyun icinde header&apos;da gosterilir ve kayitli oturum
                      yenilendiginde korunur.
                    </p>
                  </div>
                </div>

                {currentErrorMessage ? (
                  <div className="mt-5 rounded-[22px] border border-red-400/30 bg-red-950/70 px-4 py-3 text-sm leading-6 text-red-100">
                    {currentErrorMessage}
                  </div>
                ) : null}

                <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => openLaunchPrompt("new")}
                    className="rounded-full bg-lime-400 px-6 py-3 text-sm font-bold uppercase tracking-[0.22em] text-slate-950 transition hover:bg-lime-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                    disabled={!apiKey}
                  >
                    Oyna
                  </button>

                  {hasRecoverableSession ? (
                    <button
                      type="button"
                      onClick={() => openLaunchPrompt("resume")}
                      className="rounded-full border border-white/14 bg-white/7 px-6 py-3 text-sm font-bold uppercase tracking-[0.22em] text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:text-slate-500"
                      disabled={!apiKey}
                    >
                      Kayitli oyuna don
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {launchIntent ? (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/58 p-6 backdrop-blur-sm">
              <div className="w-full max-w-lg rounded-[30px] border border-white/12 bg-slate-950/92 p-7 shadow-[0_24px_80px_rgba(2,6,23,0.45)]">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.32em] text-amber-200">
                  Tam Ekran Uyarisi
                </p>
                <h3 className="mt-3 text-2xl font-semibold text-white">
                  Oyun baslarken Street View icin tam ekran izni isteyelim mi?
                </h3>
                <p className="mt-4 text-sm leading-7 text-slate-200">
                  Tam ekranda Street View daha temiz acilir. Sağdaki kucuk harita yerinde kalir ve
                  istersen oyun sirasinda buyutulebilir.
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => void handleLaunchDecision(true)}
                    className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-bold uppercase tracking-[0.22em] text-slate-950 transition hover:bg-cyan-200"
                  >
                    Tam ekranla baslat
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleLaunchDecision(false)}
                    className="rounded-full border border-white/14 bg-white/7 px-5 py-3 text-sm font-bold uppercase tracking-[0.22em] text-white transition hover:bg-white/12"
                  >
                    Normal baslat
                  </button>
                  <button
                    type="button"
                    onClick={closeLaunchPrompt}
                    className="rounded-full border border-white/10 bg-transparent px-5 py-3 text-sm font-bold uppercase tracking-[0.22em] text-slate-400 transition hover:border-white/14 hover:text-white"
                  >
                    Vazgec
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-[30px] border border-white/12 bg-white/6 p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.32em] text-cyan-200">
                  Roundlar
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Tahmin gecmisi</h2>
              </div>
              <p className="text-sm text-slate-300">
                Ortalama mesafe:{" "}
                <span className="font-semibold text-orange-300">
                  {formatDistance(historyAverage)}
                </span>
              </p>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {history.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-white/14 bg-slate-950/35 px-4 py-5 text-sm text-slate-300">
                  Henuz tamamlanmis round yok.
                </div>
              ) : (
                history.map((item) => (
                  <article
                    key={item.round}
                    className="rounded-[22px] border border-white/12 bg-slate-950/46 px-4 py-4"
                  >
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-slate-400">
                      Round {item.round}
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-white">
                      {formatPoints(item.points)}
                    </p>
                    <p className="mt-2 text-sm text-slate-300">
                      Mesafe:{" "}
                      <span className="font-medium text-orange-300">
                        {formatDistance(item.distanceKm)}
                      </span>
                    </p>
                  </article>
                ))
              )}
            </div>
          </div>

          <aside className="rounded-[30px] border border-white/12 bg-white/6 p-5 backdrop-blur-xl">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.32em] text-cyan-200">
              Akis
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Client-side mimari</h2>

            <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-200">
              <li>Login yok, middleware yok, oyun sadece istemcide basliyor.</li>
              <li>KML dosyasi build sirasinda statik lokasyon havuzuna donusturuldu.</li>
              <li>Veri havuzu ve Google Maps kodu sadece butona basildiginda yukleniyor.</li>
              <li>Aktif round snapshot&apos;i sessionStorage ile refresh sonrasina tasiniyor.</li>
              <li>Aktif round suresi: {roundDurationSeconds} saniye.</li>
              <li>Oyun baslarken Street View alani fullscreen istenir.</li>
              <li>Sagdaki harita buyutulup tekrar kucultulebilir.</li>
              <li>Kaynak dosya: {LOCATION_POOL_LABEL}</li>
            </ul>
          </aside>
        </section>

        {shouldShowSummary ? (
          <section className="rounded-[32px] border border-white/12 bg-slate-950/78 p-6 backdrop-blur-xl">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.32em] text-cyan-200">
              Oyun bitti
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-white">
              Toplam skorun {formatPoints(score)}.
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">
              {history.length} round sonunda ortalama hata payin {formatDistance(historyAverage)}.
              Yeni oyunla ayni veri havuzundan farkli noktalara gecebilirsin.
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function getRemainingSeconds(deadlineTs: number | null) {
  if (!deadlineTs) {
    return 0;
  }

  return Math.max(0, Math.ceil((deadlineTs - Date.now()) / 1000));
}
