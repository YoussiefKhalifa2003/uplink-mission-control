import styles from "./DataScopeBadge.module.css";

export type DataScope = "global" | "site" | "live";

const LABELS: Record<DataScope, string> = {
  global: "Global · ~60s",
  site: "Your site",
  live: "Live 1 Hz",
};

interface DataScopeBadgeProps {
  scope: DataScope;
  className?: string;
}

export function DataScopeBadge({ scope, className }: DataScopeBadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[scope]} ${className ?? ""}`} title={SCOPE_HINTS[scope]}>
      {LABELS[scope]}
    </span>
  );
}

const SCOPE_HINTS: Record<DataScope, string> = {
  global: "Same value everywhere on Earth. Updates when NOAA publishes new data (~60 seconds).",
  site: "Recalculates when you change your observer city.",
  live: "Updates every second with satellite propagation on the globe.",
};

export function GlobalMetricHelp() {
  return (
    <details className={styles.help}>
      <summary>Why doesn&apos;t this change when I pick a city?</summary>
      <p>
        Kp, solar wind, and IMF are measured at the L1 point between Earth and the Sun — they affect the
        whole planet equally. Switch cities to see passes, overhead satellites, and look angles change.
      </p>
      <a href="/about">Learn more</a>
    </details>
  );
}
