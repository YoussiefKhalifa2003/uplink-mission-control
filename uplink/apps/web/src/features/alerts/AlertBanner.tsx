import { motion, AnimatePresence } from "framer-motion";
import type { Alert } from "@uplink/shared";
import styles from "./AlertBanner.module.css";

interface AlertBannerProps {
  alerts: Alert[];
}

export function AlertBanner({ alerts }: AlertBannerProps) {
  const critical = alerts.filter(
    (a) => a.alertId !== "weather" && (a.severity === "CRITICAL" || a.severity === "WARNING"),
  );
  const top = critical[0];

  return (
    <AnimatePresence>
      {top && (
        <motion.div
          className={`${styles.banner} ${styles[top.severity.toLowerCase()]}`}
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -48, opacity: 0 }}
          transition={{ duration: 0.3 }}
          role="alert"
        >
          <span className={styles.severity}>{top.severity}</span>
          <span className={styles.message}>{top.message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function AlertTicker({ alerts }: AlertBannerProps) {
  const items = alerts.filter((a) => a.alertId !== "weather").slice(0, 5);
  if (items.length === 0) return null;

  return (
    <div className={styles.ticker} aria-live="polite">
      <div className={styles.tickerTrack}>
        {items.map((a) => (
          <span key={`${a.alertId}-${a.firedAt}`} className={styles.tickerItem}>
            [{a.severity}] {a.message}
          </span>
        ))}
      </div>
    </div>
  );
}
