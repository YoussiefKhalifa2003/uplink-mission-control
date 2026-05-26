import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import type { Satellite, City } from "@uplink/shared";
import { api } from "../../lib/api";
import { splitTrackAtAntimeridian, subsampleTrack, trackToPathData, type TrackPoint } from "../../lib/groundTrackUtils";
import { useUplinkStore } from "../../stores/uplinkStore";
import { GlobeHelp } from "./GlobeHelp";
import styles from "./GlobeView.module.css";

interface SatPoint {
  noradId: number;
  lat: number;
  lng: number;
  alt: number;
  name: string;
  groupTag?: string;
  elevationDeg?: number;
  opacity: number;
  showLabel: boolean;
}

interface CountryFeature {
  type: string;
  properties: { name?: string; NAME?: string; ADMIN?: string; ISO_A3?: string };
  geometry: { type: string; coordinates: unknown };
}

function countryName(f: CountryFeature): string {
  return f.properties?.name ?? f.properties?.NAME ?? f.properties?.ADMIN ?? "Country";
}

interface GlobeViewProps {
  satellites: Satellite[];
  commsScore: number;
}

const EARTH_TEXTURE = "//unpkg.com/three-globe/example/img/earth-blue-marble.jpg";
const REGIONAL_ALTITUDE = 1.5;
const OBSERVER_FLY_ALTITUDE = 1.05;

function commsColor(score: number): string {
  if (score <= 30) return "rgba(0, 212, 255, 0.35)";
  if (score <= 60) return "rgba(255, 176, 32, 0.45)";
  return "rgba(255, 59, 59, 0.55)";
}

function groupHex(groupTag?: string): string {
  if (!groupTag) return "#ffffff";
  const tag = groupTag.toLowerCase();
  if (tag.includes("station")) return "#00d4ff";
  if (tag.includes("weather")) return "#ffb020";
  if (tag.includes("starlink")) return "#a78bfa";
  if (tag.includes("gps") || tag.includes("gnss")) return "#4ade80";
  return "#ffffff";
}

function configureGlobeControls(globe: GlobeMethods) {
  const controls = globe.controls();
  controls.enabled = true;
  controls.enableRotate = true;
  controls.enableZoom = true;
  controls.enablePan = false;
  controls.rotateSpeed = 0.35;
  controls.zoomSpeed = 0.8;
  const renderer = globe.renderer();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  const canvas = renderer.domElement;
  canvas.style.touchAction = "none";
  canvas.style.cursor = "grab";
}

function featureCentroid(f: CountryFeature): { lat: number; lng: number } | null {
  const geom = f.geometry;
  if (!geom) return null;
  const rings: number[][][] =
    geom.type === "Polygon"
      ? (geom.coordinates as number[][][])
      : geom.type === "MultiPolygon"
        ? (geom.coordinates as number[][][][])[0] ?? []
        : [];
  const ring = rings[0];
  if (!ring?.length) return null;
  let sumLat = 0;
  let sumLng = 0;
  for (const pt of ring) {
    sumLng += pt[0] ?? 0;
    sumLat += pt[1] ?? 0;
  }
  return { lat: sumLat / ring.length, lng: sumLng / ring.length };
}

function throttle<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: Parameters<T>) => {
    const now = Date.now();
    const run = () => {
      last = Date.now();
      fn(...args);
    };
    if (now - last >= ms) {
      run();
    } else if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        run();
      }, ms - (now - last));
    }
  }) as T;
}

export function GlobeView({ satellites, commsScore }: GlobeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const workerRef = useRef<Worker | null>(null);
  const citiesRef = useRef<City[]>([]);
  const selectedNoradIdRef = useRef<number | null>(null);
  const observerRef = useRef<City | null>(null);

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [globeReady, setGlobeReady] = useState(false);
  const [positions, setPositions] = useState<SatPoint[]>([]);
  const [trackPaths, setTrackPaths] = useState<Array<{ id: string; coords: TrackPoint[] }>>([]);
  const [countries, setCountries] = useState<CountryFeature[]>([]);

  const observer = useUplinkStore((s) => s.observer);
  const selectedNoradId = useUplinkStore((s) => s.selectedNoradId);
  const globeAltitude = useUplinkStore((s) => s.globeAltitude);
  const flyToObserverSeq = useUplinkStore((s) => s.flyToObserverSeq);
  const flyToSatelliteSeq = useUplinkStore((s) => s.flyToSatelliteSeq);
  const setObserver = useUplinkStore((s) => s.setObserver);
  const setSelectedNoradId = useUplinkStore((s) => s.setSelectedNoradId);
  const requestFlyToSatellite = useUplinkStore((s) => s.requestFlyToSatellite);
  const setLiveLookAngles = useUplinkStore((s) => s.setLiveLookAngles);
  const setPropagationTickAt = useUplinkStore((s) => s.setPropagationTickAt);
  const setOverheadSats = useUplinkStore((s) => s.setOverheadSats);
  const setGlobeAltitude = useUplinkStore((s) => s.setGlobeAltitude);
  const setToastMessage = useUplinkStore((s) => s.setToastMessage);

  observerRef.current = observer;
  selectedNoradIdRef.current = selectedNoradId;

  const displaySats = useMemo(() => satellites.slice(0, 40), [satellites]);
  const regionalMode = globeAltitude < REGIONAL_ALTITUDE;

  useEffect(() => {
    if (!globeReady) return;
    let cancelled = false;
    const loadCountries = () => {
      fetch("/data/countries.geojson")
        .then((r) => r.json())
        .then((data: { features: CountryFeature[] }) => {
          if (!cancelled) setCountries(data.features ?? []);
        })
        .catch(() => {
          if (!cancelled) setCountries([]);
        });
    };
    api.cities().then((c) => { citiesRef.current = c; }).catch(() => {});
    const idle = window.requestIdleCallback?.(loadCountries, { timeout: 2000 });
    const fallback = idle == null ? window.setTimeout(loadCountries, 800) : null;
    return () => {
      cancelled = true;
      if (idle != null) window.cancelIdleCallback(idle);
      if (fallback != null) window.clearTimeout(fallback);
    };
  }, [globeReady]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setDimensions({ width: Math.round(width), height: Math.round(height) });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleGlobeReady = useCallback(() => {
    const globe = globeRef.current;
    if (!globe) return;
    configureGlobeControls(globe);
    setGlobeReady(true);
    if (observerRef.current) {
      globe.pointOfView({ lat: observerRef.current.lat, lng: observerRef.current.lon, altitude: 2.2 }, 0);
    }
  }, []);

  useEffect(() => {
    const worker = new Worker(new URL("../../workers/propagation.worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;

    worker.postMessage({
      type: "INIT_TLES",
      tles: displaySats.map((s) => ({
        noradId: s.noradId,
        name: s.name,
        line1: s.tleLine1,
        line2: s.tleLine2,
      })),
    });

    const interval = setInterval(() => {
      worker.postMessage({ type: "TICK", timestamp: new Date().toISOString() });
    }, 1000);

    worker.onmessage = (ev) => {
      const data = ev.data;
      if (data.type === "TICK_RESULT") {
        const elMap = new Map<number, number>();
        for (const o of data.overhead ?? []) {
          elMap.set(o.noradId, o.elevationDeg);
        }
        setOverheadSats(data.overhead ?? []);
        setPropagationTickAt(new Date().toISOString());

        const rawPositions = data.positions as Array<{ noradId: number; lat: number; lng: number; alt: number }>;
        const isRegional = useUplinkStore.getState().globeAltitude < REGIONAL_ALTITUDE;
        const selected = useUplinkStore.getState().selectedNoradId;

        setPositions(
          rawPositions.map((p) => {
            const sat = displaySats.find((s) => s.noradId === p.noradId);
            const el = elMap.get(p.noradId);
            const aboveHorizon = el != null ? el >= 0 : true;
            const overhead = el != null && el >= 10;
            return {
              ...p,
              name: sat?.name ?? String(p.noradId),
              groupTag: sat?.groupTag,
              elevationDeg: el,
              opacity: isRegional && !aboveHorizon ? 0.35 : 1,
              showLabel: isRegional && (overhead || p.noradId === selected),
            };
          }),
        );

        if (data.lookAngles) {
          const obs = observerRef.current;
          setLiveLookAngles({
            noradId: data.lookAngles.noradId,
            azimuthDeg: data.lookAngles.azimuthDeg,
            elevationDeg: data.lookAngles.elevationDeg,
            rangeKm: data.lookAngles.rangeKm,
            timestamp: data.lookAngles.timestamp,
            visible: data.lookAngles.visible,
            observerLat: obs?.lat,
            observerLon: obs?.lon,
          });
        }
      }

      if (data.type === "GROUND_TRACK") {
        if (data.noradId !== selectedNoradIdRef.current) return;
        const sampled = subsampleTrack(data.track as TrackPoint[], 48);
        const segments = splitTrackAtAntimeridian(sampled);
        setTrackPaths(trackToPathData(segments));
      }
    };

    return () => {
      clearInterval(interval);
      worker.terminate();
      workerRef.current = null;
      setLiveLookAngles(null);
      setOverheadSats([]);
    };
  }, [displaySats, setLiveLookAngles, setPropagationTickAt, setOverheadSats]);

  useEffect(() => {
    if (!workerRef.current || !observer) return;
    workerRef.current.postMessage({
      type: "SET_OBSERVER",
      lat: observer.lat,
      lon: observer.lon,
      selectedNoradId,
    });
  }, [observer?.lat, observer?.lon, observer?.id, selectedNoradId]);

  useEffect(() => {
    setTrackPaths([]);
    if (!workerRef.current || !selectedNoradId) return;
    workerRef.current.postMessage({
      type: "COMPUTE_GROUND_TRACK",
      noradId: selectedNoradId,
      timestamp: new Date().toISOString(),
    });
  }, [selectedNoradId]);

  const setObserverFromCoords = useCallback(
    async (lat: number, lng: number, label?: string) => {
      const cities = citiesRef.current;
      const nearest = cities.reduce<{ city: City; dist: number } | null>((best, c) => {
        const d = (c.lat - lat) ** 2 + (c.lon - lng) ** 2;
        if (!best || d < best.dist) return { city: c, dist: d };
        return best;
      }, null);
      const useBundled = nearest && nearest.dist < 4;
      const city: City = useBundled
        ? nearest!.city
        : {
            id: `pin-${lat.toFixed(2)}-${lng.toFixed(2)}`,
            name: label ?? `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(2)}°${lng >= 0 ? "E" : "W"}`,
            country: label ? "" : "Custom",
            lat,
            lon: lng,
            timezone: "UTC",
          };
      setObserver(city);
      setToastMessage(`Observer set to ${city.name} — passes & tracking updated`);
    },
    [setObserver, setToastMessage],
  );

  useEffect(() => {
    if (!globeReady || !globeRef.current) return;
    const globe = globeRef.current;
    const controls = globe.controls();
    const onChange = throttle(() => {
      const pov = globe.pointOfView();
      if (pov.altitude != null) setGlobeAltitude(pov.altitude);
    }, 250);
    controls.addEventListener("change", onChange);
    return () => controls.removeEventListener("change", onChange);
  }, [globeReady, setGlobeAltitude]);

  // Double-click land to set observer (single click is for drag/rotate)
  useEffect(() => {
    if (!globeReady || !globeRef.current) return;
    const globe = globeRef.current;
    const canvas = globe.renderer().domElement;

    const onDblClick = (ev: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      type GlobeWithCoords = GlobeMethods & {
        toGlobeCoords?: (x: number, y: number) => { lat: number; lng: number } | null;
      };
      const coords = (globe as GlobeWithCoords).toGlobeCoords?.(x, y);
      if (coords) void setObserverFromCoords(coords.lat, coords.lng);
    };

    canvas.addEventListener("dblclick", onDblClick);
    return () => canvas.removeEventListener("dblclick", onDblClick);
  }, [globeReady, setObserverFromCoords]);

  // City / observer fly — always takes priority over satellite tracking
  useEffect(() => {
    if (!globeReady || !globeRef.current || !observer || flyToObserverSeq === 0) return;
    globeRef.current.pointOfView(
      { lat: observer.lat, lng: observer.lon, altitude: OBSERVER_FLY_ALTITUDE },
      1200,
    );
  }, [flyToObserverSeq, globeReady, observer]);

  // Satellite fly — only when user explicitly clicks a satellite
  useEffect(() => {
    if (!globeReady || !globeRef.current || flyToSatelliteSeq === 0) return;
    const pos = positions.find((p) => p.noradId === selectedNoradId);
    if (!pos) return;
    globeRef.current.pointOfView(
      { lat: pos.lat, lng: pos.lng, altitude: Math.max(0.55, Math.min(globeAltitude, 1.2)) },
      1200,
    );
  }, [flyToSatelliteSeq, selectedNoradId, positions, globeReady, globeAltitude]);

  const labelData = useMemo(() => {
    const labels: Array<{ lat: number; lng: number; text: string; id: string }> = [];
    if (observer) {
      labels.push({ lat: observer.lat, lng: observer.lon, text: observer.name, id: "observer" });
    }
    for (const p of positions) {
      if (p.showLabel) {
        labels.push({ lat: p.lat, lng: p.lng, text: p.name, id: `sat-${p.noradId}` });
      }
    }
    return labels;
  }, [observer, positions]);

  const ringsData = useMemo(
    () =>
      observer
        ? [
            {
              lat: observer.lat,
              lng: observer.lon,
              maxR: regionalMode ? 5 : commsScore <= 30 ? 3 : commsScore <= 60 ? 5 : 8,
              propagationSpeed: 1.2,
              repeatPeriod: 1800,
            },
          ]
        : [],
    [observer, commsScore, regionalMode],
  );

  const handlePolygonClick = useCallback(
    (polygon: object) => {
      const f = polygon as CountryFeature;
      const name = countryName(f);
      const centroid = featureCentroid(f);
      if (!centroid) return;
      const cities = citiesRef.current;
      const cityInCountry = cities.find(
        (c) => c.country.toLowerCase() === name.toLowerCase() || name.toLowerCase().includes(c.country.toLowerCase()),
      );
      if (cityInCountry) {
        setObserver(cityInCountry);
        setToastMessage(`Observer set to ${cityInCountry.name}`);
      } else {
        void setObserverFromCoords(centroid.lat, centroid.lng, name);
      }
    },
    [setObserver, setObserverFromCoords, setToastMessage],
  );

  const handlePointClick = useCallback(
    (point: object) => {
      const pt = point as SatPoint;
      if (pt.noradId == null) return;
      setSelectedNoradId(pt.noradId);
      requestFlyToSatellite();
      setToastMessage(`Tracking ${pt.name} — click a city in the panel to return to your site`);
    },
    [setSelectedNoradId, requestFlyToSatellite, setToastMessage],
  );

  const globeSized = dimensions.width > 0 && dimensions.height > 0;

  return (
    <div
      ref={containerRef}
      className={`${styles.globeWrap} ${regionalMode ? styles.regional : ""}`}
      data-comms={commsScore > 60 ? "critical" : commsScore > 30 ? "warning" : "normal"}
    >
      <GlobeHelp regionalMode={regionalMode} />
      {globeSized && (
        <Globe
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          globeImageUrl={EARTH_TEXTURE}
          backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
          showAtmosphere
          atmosphereColor="rgba(0, 200, 255, 0.1)"
          atmosphereAltitude={0.15}
          enablePointerInteraction
          onGlobeReady={handleGlobeReady}
          polygonsData={countries}
          polygonCapColor={() => (regionalMode ? "rgba(0, 212, 255, 0.06)" : "rgba(0, 212, 255, 0.03)")}
          polygonSideColor={() => "rgba(0, 0, 0, 0)"}
          polygonStrokeColor={() => (regionalMode ? "rgba(0, 212, 255, 0.5)" : "rgba(0, 212, 255, 0.2)")}
          polygonAltitude={regionalMode ? 0.008 : 0.004}
          onPolygonClick={handlePolygonClick}
          pointsData={positions}
          pointLat="lat"
          pointLng="lng"
          pointAltitude="alt"
          pointRadius={(p: object) => ((p as SatPoint).noradId === selectedNoradId ? 0.6 : 0.32)}
          pointColor={(p: object) => {
            const pt = p as SatPoint;
            if (pt.noradId === selectedNoradId) return "#00d4ff";
            if (pt.opacity < 1) return "rgba(180, 200, 220, 0.4)";
            return groupHex(pt.groupTag);
          }}
          pointLabel="name"
          onPointClick={handlePointClick}
          pathsData={trackPaths}
          pathPoints="coords"
          pathPointLat={(d: number | TrackPoint) => (Array.isArray(d) ? d[0] : 0)}
          pathPointLng={(d: number | TrackPoint) => (Array.isArray(d) ? d[1] : 0)}
          pathPointAlt={(d: number | TrackPoint) => (Array.isArray(d) ? d[2] : 0)}
          pathColor={() => "rgba(0, 212, 255, 0.85)"}
          pathStroke={2}
          ringsData={ringsData}
          ringColor={() => (regionalMode ? "rgba(0, 212, 255, 0.5)" : commsColor(commsScore))}
          ringMaxRadius="maxR"
          ringPropagationSpeed="propagationSpeed"
          ringRepeatPeriod="repeatPeriod"
          labelsData={labelData}
          labelLat="lat"
          labelLng="lng"
          labelText="text"
          labelSize={(d: object) => ((d as { id?: string }).id === "observer" ? 1.35 : 0.8)}
          labelColor={(d: object) => ((d as { id?: string }).id === "observer" ? "#00d4ff" : "#e8edf5")}
          labelDotRadius={(d: object) => ((d as { id?: string }).id === "observer" ? 0.45 : 0.18)}
          labelDotOrientation={() => "top"}
          labelResolution={1}
          labelIncludeDot
        />
      )}
      {regionalMode ? (
        <div className={styles.regionalHint}>
          Regional view · double-click land or search a city to move observer
        </div>
      ) : null}
    </div>
  );
};
