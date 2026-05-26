import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { City, WeatherCurrent } from "@uplink/shared";
import { formatAge, ISS_NORAD_ID } from "@uplink/shared";
import { api } from "../../lib/api";
import { useUplinkStore } from "../../stores/uplinkStore";
import { useLiveClock } from "../../hooks/useLiveClock";
import { DataScopeBadge } from "../ui/DataScopeBadge";
import { CompassWidget } from "../observer/CompassWidget";
import styles from "./WeatherLocalImpact.module.css";

interface WeatherLocalImpactProps {
  observer: City;
  cities: City[];
  weather: WeatherCurrent | undefined;
  onSelectCity: (city: City) => void;
}

export function WeatherLocalImpact({ observer, cities, weather, onSelectCity }: WeatherLocalImpactProps) {
  const [query, setQuery] = useState("");
  const now = useLiveClock(1000);
  const liveLookAngles = useUplinkStore((s) => s.liveLookAngles);
  const overheadSats = useUplinkStore((s) => s.overheadSats);
  const weatherPulseAt = useUplinkStore((s) => s.weatherPulseAt);

  const { data: brief } = useQuery({
    queryKey: ["observer", "brief", observer.lat, observer.lon],
    queryFn: () => api.observerBrief(observer.lat, observer.lon, observer.name),
    refetchInterval: 60000,
  });

  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return cities.filter((c) => c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q)).slice(0, 8);
  }, [cities, query]);

  const pickCity = (city: City) => {
    onSelectCity(city);
    setQuery("");
    const url = new URL(window.location.href);
    url.searchParams.set("city", city.id);
    window.history.replaceState({}, "", url.toString());
  };

  const issAngles = liveLookAngles?.noradId === ISS_NORAD_ID ? liveLookAngles : brief?.issLookAngles;
  const pulseClass = weatherPulseAt && Date.now() - weatherPulseAt < 1500 ? styles.pulse : "";

  return (
    <aside className={styles.panel}>
      <div className={styles.head}>
        <h2>Impact at {observer.name}</h2>
        <DataScopeBadge scope="site" />
      </div>

      <input
        className={styles.search}
        type="search"
        placeholder="Change observer city…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search observer city"
      />
      {filtered.length > 0 && (
        <ul className={styles.results}>
          {filtered.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => pickCity(c)}>
                {c.name}, {c.country}
              </button>
            </li>
          ))}
        </ul>
      )}

      {brief ? (
        <div className={styles.briefing}>{brief.briefing}</div>
      ) : (
        <div className={styles.loading}>Computing site briefing…</div>
      )}

      <div className={styles.metrics}>
        <Metric
          label="Overhead now"
          value={String(overheadSats.length > 0 ? overheadSats.length : (brief?.overheadCount ?? "—"))}
          badge="live"
        />
        <Metric
          label="ISS passes (24h)"
          value={brief != null ? String(brief.passesNext24h) : "—"}
          badge="site"
        />
        <Metric
          label="Aurora at lat"
          value={brief?.auroraProbability != null ? `${brief.auroraProbability}%` : "—"}
          badge="site"
        />
        <Metric
          label="Sun elevation"
          value={brief != null ? `${brief.sunElevationDeg.toFixed(1)}°` : "—"}
          badge="site"
        />
      </div>

      {brief?.nextIssPass ? (
        <div className={styles.passCard}>
          <div className={styles.passLabel}>Next ISS pass</div>
          <div className={styles.passTime}>{new Date(brief.nextIssPass.aos).toLocaleString()}</div>
          <div className={styles.passMeta}>
            Max {brief.nextIssPass.maxElevationDeg.toFixed(1)}° · {Math.round(brief.nextIssPass.durationSec / 60)} min
          </div>
        </div>
      ) : null}

      {issAngles ? (
        <div className={styles.tracking}>
          <div className={styles.trackingHead}>
            <span>ISS live tracking</span>
            <DataScopeBadge scope="live" />
          </div>
          <div className={styles.trackingGrid}>
            <span>Az {issAngles.azimuthDeg.toFixed(1)}°</span>
            <span>El {issAngles.elevationDeg.toFixed(1)}°</span>
            <span>{issAngles.rangeKm.toFixed(0)} km</span>
          </div>
          <CompassWidget azimuthDeg={issAngles.azimuthDeg} elevationDeg={issAngles.elevationDeg} />
        </div>
      ) : null}

      <div className={`${styles.commsNote} ${pulseClass}`}>
        <DataScopeBadge scope="global" />
        <p>
          HF/comms model (global): {weather ? `${weather.commsScore}% degradation` : "—"} —{" "}
          {weather && weather.commsScore > 60
            ? "elevated risk for HF at your site"
            : weather && weather.commsScore > 30
              ? "minor HF effects possible"
              : "nominal for your site"}
        </p>
        {weather?.recordedAt ? (
          <span className={styles.age}>Global data {formatAge(weather.recordedAt, now.getTime())}</span>
        ) : null}
      </div>
    </aside>
  );
}

function Metric({ label, value, badge }: { label: string; value: string; badge: "live" | "site" }) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricLabel}>{label}</span>
      <DataScopeBadge scope={badge === "live" ? "live" : "site"} />
      <span className={styles.metricValue}>{value}</span>
    </div>
  );
}
