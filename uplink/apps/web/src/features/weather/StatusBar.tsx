import type { WeatherCurrent, City } from "@uplink/shared";
import { formatAge } from "@uplink/shared";
import { useUplinkStore } from "../../stores/uplinkStore";
import { useLiveClock } from "../../hooks/useLiveClock";
import styles from "./StatusBar.module.css";

interface StatusBarProps {
  weather: WeatherCurrent | undefined;
  observer?: City;
}

export function StatusBar({ weather, observer }: StatusBarProps) {
  const live = useUplinkStore((s) => s.live);
  const storeCommsScore = useUplinkStore((s) => s.commsScore);
  const weatherPulseAt = useUplinkStore((s) => s.weatherPulseAt);
  const commsScore = weather?.commsScore ?? storeCommsScore;
  const now = useLiveClock(1000);

  const pulseClass = weatherPulseAt && Date.now() - weatherPulseAt < 1500 ? styles.pulse : "";

  return (
    <header className={styles.bar}>
      <div className={styles.brand}>
        <span className={styles.logo}>UPLINK</span>
        <span className={`${styles.live} ${live ? styles.liveOn : ""}`}>
          {live ? "● LIVE" : "○ OFFLINE"}
        </span>
        {observer ? <span className={styles.observerTag}>{observer.name}</span> : null}
      </div>
      <div className={styles.metrics}>
        <Metric
          label="Kp (global)"
          value={weather?.kp?.toFixed(1) ?? "—"}
          sub={weather?.recordedAt ? formatAge(weather.recordedAt, now.getTime()) : undefined}
          pulseClass={pulseClass}
        />
        <Metric
          label="Solar wind (global)"
          value={weather?.protonSpeed ? `${Math.round(weather.protonSpeed)} km/s` : "—"}
          pulseClass={pulseClass}
        />
        <Metric
          label="Bz IMF (global)"
          value={weather?.bzGsm != null ? `${weather.bzGsm.toFixed(1)} nT` : "—"}
          pulseClass={pulseClass}
        />
        <Metric
          label="Comms (global model)"
          value={`${100 - commsScore}%`}
          highlight={commsScore > 60 ? "critical" : commsScore > 30 ? "warning" : undefined}
          pulseClass={pulseClass}
        />
      </div>
      <nav className={styles.nav}>
        <a href="/">Control</a>
        <a href={`/weather${observer ? `?city=${encodeURIComponent(observer.id)}` : ""}`}>Weather</a>
        <a href="/about">About</a>
      </nav>
    </header>
  );
}

function Metric({
  label,
  value,
  sub,
  highlight,
  pulseClass,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: "warning" | "critical";
  pulseClass?: string;
}) {
  return (
    <div className={`${styles.metric} ${highlight ? styles[highlight] : ""}`}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={`${styles.metricValue} ${pulseClass ?? ""}`}>{value}</span>
      {sub ? <span className={styles.metricSub}>{sub}</span> : null}
    </div>
  );
}
