import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import type { Satellite, City } from "@uplink/shared";
import { api } from "../../lib/api";
import { splitTrackAtAntimeridian, subsampleTrack, trackToPathData, type TrackPoint } from "../../lib/groundTrackUtils";
import { useUplinkStore } from "../../stores/uplinkStore";
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
const NIGHT_TEXTURE = "//unpkg.com/three-globe/example/img/earth-night.jpg";
const REGIONAL_ALTITUDE = 1.5;

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
  const lastSatFlyRef = useRef<number | null>(null);
  const skipObserverFlyRef = useRef(true);
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
  const setObserver = useUplinkStore((s) => s.setObserver);
  const setSelectedNoradId = useUplinkStore((s) => s.setSelectedNoradId);
  const setLiveLookAngles = useUplinkStore((s) => s.setLiveLookAngles);
  const setPropagationTickAt = useUplinkStore((s) => s.setPropagationTickAt);
  const setOverheadSats = useUplinkStore((s) => s.setOverheadSats);
  const setGlobeAltitude = useUplinkStore((s) => s.setGlobeAltitude);
  const setToastMessage = useUplinkStore((s) => s.setToastMessage);

  observerRef.current = observer;
  selectedNoradIdRef.current = selectedNoradId;

  const displaySats = useMemo(() => satellites.slice(0, 40), [satellites]);
  const regionalMode = globeAltitude < REGIONAL_ALTITUDE;

  const visiblePoints = useMemo(() => {
    if (!regionalMode) return positions;
    return positions.filter(
      (p) => p.noradId === selectedNoradId || (p.elevationDeg != null && p.elevationDeg >= 0),
    );
  }, [positions, regionalMode, selectedNoradId]);

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
              opacity: isRegional && !aboveHorizon ? 0.2 : 1,
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

  useEffect(() => {
    if (!globeReady || !selectedNoradId || !globeRef.current) return;
    if (lastSatFlyRef.current === selectedNoradId) return;
    const pos = positions.find((p) => p.noradId === selectedNoradId);
    if (!pos) return;
    lastSatFlyRef.current = selectedNoradId;
    globeRef.current.pointOfView({ lat: pos.lat, lng: pos.lng, altitude: Math.min(globeAltitude, 2.5) }, 1500);
  }, [selectedNoradId, positions, globeReady, globeAltitude]);

  useEffect(() => {
    if (!observer || !globeRef.current || !globeReady) return;
    if (skipObserverFlyRef.current) {
      skipObserverFlyRef.current = false;
      return;
    }
    lastSatFlyRef.current = null;
    globeRef.current.pointOfView({ lat: observer.lat, lng: observer.lon, altitude: 1.8 }, 1500);
  }, [observer?.id, observer?.lat, observer?.lon, globeReady]);

  const labelData = useMemo(() => {
    const labels: Array<{ lat: number; lng: number; text: string; id: string }> = [];
    if (observer) {
      labels.push({ lat: observer.lat, lng: observer.lon, text: observer.name, id: "observer" });
    }
    for (const p of visiblePoints) {
      if (p.showLabel) {
        labels.push({ lat: p.lat, lng: p.lng, text: p.name, id: `sat-${p.noradId}` });
      }
    }
    return labels;
  }, [observer, visiblePoints]);

  const ringsData = useMemo(
    () =>
      observer
        ? [
            {
              lat: observer.lat,
              lng: observer.lon,
              maxR: regionalMode ? (commsScore <= 30 ? 4 : commsScore <= 60 ? 6 : 10) : commsScore <= 30 ? 3 : commsScore <= 60 ? 5 : 8,
              propagationSpeed: commsScore > 60 ? 2 : 1,
              repeatPeriod: commsScore > 60 ? 1200 : 2000,
            },
          ]
        : [],
    [observer, commsScore, regionalMode],
  );

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
      setToastMessage(`Now tracking from ${city.name || `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`}`);
    },
    [setObserver, setToastMessage],
  );

  const handleGlobeClick = useCallback(
    ({ lat, lng }: { lat: number; lng: number }) => {
      void setObserverFromCoords(lat, lng);
    },
    [setObserverFromCoords],
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
        setToastMessage(`Now tracking from ${cityInCountry.name}`);
        globeRef.current?.pointOfView({ lat: cityInCountry.lat, lng: cityInCountry.lon, altitude: 1.5 }, 1500);
      } else {
        void setObserverFromCoords(centroid.lat, centroid.lng, name);
        globeRef.current?.pointOfView({ lat: centroid.lat, lng: centroid.lng, altitude: 1.5 }, 1500);
      }
    },
    [setObserver, setObserverFromCoords, setToastMessage],
  );

  const handlePointClick = useCallback(
    (point: object) => {
      const noradId = (point as SatPoint).noradId;
      if (noradId != null) setSelectedNoradId(noradId);
    },
    [setSelectedNoradId],
  );

  const globeSized = dimensions.width > 0 && dimensions.height > 0;
  const showCountryBorders = !regionalMode && countries.length > 0;

  return (
    <div
      ref={containerRef}
      className={`${styles.globeWrap} ${regionalMode ? styles.regional : ""}`}
      data-comms={commsScore > 60 ? "critical" : commsScore > 30 ? "warning" : "normal"}
    >
      {globeSized && (
        <Globe
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          globeImageUrl={EARTH_TEXTURE}
          bumpImageUrl={NIGHT_TEXTURE}
          backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
          enablePointerInteraction
          onGlobeReady={handleGlobeReady}
          onGlobeClick={handleGlobeClick}
          polygonsData={showCountryBorders ? countries : []}
          polygonCapColor={() => "rgba(0, 212, 255, 0.03)"}
          polygonSideColor={() => "rgba(0, 0, 0, 0)"}
          polygonStrokeColor={() => "rgba(0, 212, 255, 0.12)"}
          polygonAltitude={0.004}
          onPolygonClick={handlePolygonClick}
          pointsData={visiblePoints}
          pointLat="lat"
          pointLng="lng"
          pointAltitude="alt"
          pointRadius={(p: object) => ((p as SatPoint).noradId === selectedNoradId ? 0.55 : 0.3)}
          pointColor={(p: object) => {
            const pt = p as SatPoint;
            if (pt.noradId === selectedNoradId) return "#00d4ff";
            if (pt.opacity < 1) return "rgba(140, 155, 180, 0.25)";
            return groupHex(pt.groupTag);
          }}
          pointLabel={(p: object) => (p as SatPoint).name}
          onPointClick={handlePointClick}
          pathsData={trackPaths}
          pathPoints="coords"
          pathPointLat={(d: number | TrackPoint) => (Array.isArray(d) ? d[0] : 0)}
          pathPointLng={(d: number | TrackPoint) => (Array.isArray(d) ? d[1] : 0)}
          pathPointAlt={(d: number | TrackPoint) => (Array.isArray(d) ? d[2] : 0)}
          pathColor={() => "rgba(0, 212, 255, 0.75)"}
          pathStroke={1.5}
          ringsData={ringsData}
          ringColor={() => commsColor(commsScore)}
          ringMaxRadius="maxR"
          ringPropagationSpeed="propagationSpeed"
          ringRepeatPeriod="repeatPeriod"
          labelsData={labelData}
          labelLat="lat"
          labelLng="lng"
          labelText="text"
          labelSize={(d: object) => ((d as { id?: string }).id === "observer" ? 1.2 : 0.75)}
          labelColor={(d: object) => ((d as { id?: string }).id === "observer" ? "#00d4ff" : "#e8edf5")}
          labelDotRadius={(d: object) => ((d as { id?: string }).id === "observer" ? 0.3 : 0.15)}
          labelDotOrientation={() => "top"}
          labelResolution={1}
          labelIncludeDot={true}
        />
      )}
      {regionalMode ? <div className={styles.regionalHint}>Regional view · overhead labels only</div> : null}
    </div>
  );
};
