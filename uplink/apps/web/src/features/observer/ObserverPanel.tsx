import { useState, useMemo } from "react";
import type { City, Pass, LookAngles, Satellite } from "@uplink/shared";
import { formatAge } from "@uplink/shared";
import { useLiveClock } from "../../hooks/useLiveClock";
import { usePassVisibility } from "../../hooks/usePassVisibility";
import { useUplinkStore } from "../../stores/uplinkStore";
import { DataScopeBadge } from "../ui/DataScopeBadge";
import { CompassWidget } from "./CompassWidget";
import styles from "./ObserverPanel.module.css";

interface ObserverPanelProps {
  cities: City[];
  observer: City;
  onSelectCity: (city: City) => void;
  onSearch: (query: string) => Promise<City[]>;
  passes: Pass[];
  passesLoading: boolean;
  passesUpdatedAt?: number;
  selectedSat: Satellite | undefined;
  lookAngles: LookAngles | undefined;
  propagationTickAt?: string | null;
}

export function ObserverPanel({
  cities,
  observer,
  onSelectCity,
  onSearch,
  passes,
  passesLoading,
  passesUpdatedAt,
  selectedSat,
  lookAngles,
  propagationTickAt,
}: ObserverPanelProps) {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<City[]>([]);
  const now = useLiveClock(1000);
  const livePasses = usePassVisibility(passes);
  const overheadSats = useUplinkStore((s) => s.overheadSats);
  const setSelectedNoradId = useUplinkStore((s) => s.setSelectedNoradId);

  const filteredCities = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return cities
      .filter((c) => c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q))
      .slice(0, 8);
  }, [cities, query]);

  const handleSearch = async (value: string) => {
    setQuery(value);
    if (value.length < 2) {
      setSearchResults([]);
      return;
    }
    const local = filteredCities;
    if (local.length > 0) {
      setSearchResults(local);
      return;
    }
    try {
      const results = await onSearch(value);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    }
  };

  const pickCity = (city: City) => {
    onSelectCity(city);
    setQuery("");
    setSearchResults([]);
    const url = new URL(window.location.href);
    url.searchParams.set("city", city.id);
    window.history.replaceState({}, "", url.toString());
  };

  const localTime = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const nextPass = livePasses.find((p) => new Date(p.los) > now) ?? null;
  const visiblePass = livePasses.find((p) => p.isVisibleNow);

  return (
    <aside className={styles.panel}>
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.heading}>Observer</h2>
          <DataScopeBadge scope="site" />
        </div>
        <input
          className={styles.search}
          type="search"
          placeholder="Search city — camera flies here"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          aria-label="Search observer location"
        />
        <p className={styles.searchHint}>Pick a city to center the globe on your site. Click a satellite dot to track it.</p>
        {searchResults.length > 0 && (
          <ul className={styles.results}>
            {searchResults.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => pickCity(c)}>
                  {c.name}, {c.country}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className={styles.observerInfo}>
          <div className={styles.observerName}>{observer.name}</div>
          <div className={styles.coords}>
            {observer.lat.toFixed(4)}°, {observer.lon.toFixed(4)}°
          </div>
          <div className={styles.localTime}>
            Your local time: <span>{localTime}</span>
          </div>
        </div>
      </section>

      {visiblePass ? (
        <div className={styles.passBanner}>ISS visible now — look up!</div>
      ) : nextPass ? (
        <div className={styles.countdownBanner}>
          Next ISS pass in <strong>{formatCountdown(nextPass.aos, now.getTime())}</strong>
        </div>
      ) : null}

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.heading}>Overhead Now</h2>
          <DataScopeBadge scope="live" />
        </div>
        {overheadSats.length === 0 ? (
          <div className={styles.empty}>No satellites above 10° at your site</div>
        ) : (
          <ul className={styles.overheadList}>
            {overheadSats.slice(0, 8).map((s) => (
              <li key={s.noradId}>
                <button type="button" onClick={() => setSelectedNoradId(s.noradId)}>
                  <span className={styles.overheadName}>{s.name}</span>
                  <span className={styles.overheadEl}>{s.elevationDeg.toFixed(1)}°</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.heading}>Next Passes (ISS)</h2>
          {passesUpdatedAt ? (
            <span className={styles.updated}>
              Updated {formatAge(new Date(passesUpdatedAt).toISOString(), now.getTime())}
            </span>
          ) : null}
        </div>
        {passesLoading && <div className={styles.loading}>Computing passes for {observer.name}…</div>}
        {!passesLoading && livePasses.length === 0 && (
          <div className={styles.empty}>No passes above 10° in the next 7 days</div>
        )}
        <ul className={styles.passList} key={`${observer.lat}-${observer.lon}`}>
          {livePasses.slice(0, 5).map((p) => (
            <li key={p.aos} className={p.isVisibleNow ? styles.passVisible : ""}>
              <div className={styles.passTime}>{formatPassTime(p.aos)}</div>
              <div className={styles.passMeta}>
                Max {p.maxElevationDeg.toFixed(1)}° · {formatDuration(p.durationSec)}
                {p.isVisibleNow ? " · VISIBLE NOW" : ""}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {selectedSat && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.heading}>Live Tracking</h2>
            <DataScopeBadge scope="live" />
          </div>
          <div className={styles.satName}>
            {selectedSat.name}
            {selectedSat.stale && <span className={styles.staleBadge}>Stale TLE</span>}
          </div>
          <div className={styles.telemetry}>
            <TelemetryRow label="NORAD" value={String(selectedSat.noradId)} />
            {lookAngles ? (
              <>
                <TelemetryRow
                  label="Status"
                  value={lookAngles.visible ? "Above horizon" : "Below horizon"}
                  highlight={lookAngles.visible ? "ok" : undefined}
                />
                <TelemetryRow label="Azimuth" value={`${lookAngles.azimuthDeg.toFixed(1)}°`} live />
                <TelemetryRow label="Elevation" value={`${lookAngles.elevationDeg.toFixed(1)}°`} live />
                <TelemetryRow label="Range" value={`${lookAngles.rangeKm.toFixed(0)} km`} live />
                <TelemetryRow
                  label="Last tick"
                  value={propagationTickAt ? formatAge(propagationTickAt, now.getTime()) : "—"}
                />
                <CompassWidget azimuthDeg={lookAngles.azimuthDeg} elevationDeg={lookAngles.elevationDeg} />
              </>
            ) : (
              <div className={styles.loading}>Waiting for propagation tick…</div>
            )}
          </div>
        </section>
      )}

      <section className={styles.sectionNote}>
        <p>
          Top status bar (Kp, solar wind, Bz) is <strong>global space weather</strong> — same everywhere on Earth.
          Azimuth, elevation, and range tick every second with the globe (SGP4 propagation).
        </p>
      </section>
    </aside>
  );
}

function TelemetryRow({
  label,
  value,
  highlight,
  live,
}: {
  label: string;
  value: string;
  highlight?: "ok";
  live?: boolean;
}) {
  return (
    <div className={styles.telemetryRow}>
      <span>
        {label}
        {live ? <span className={styles.liveDot} aria-hidden /> : null}
      </span>
      <span className={`${styles.telemetryValue} ${highlight === "ok" ? styles.telemetryOk : ""}`}>{value}</span>
    </div>
  );
}

function formatPassTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  return `${m} min`;
}

function formatCountdown(aosIso: string, nowMs: number): string {
  const ms = new Date(aosIso).getTime() - nowMs;
  if (ms <= 0) return "now";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
