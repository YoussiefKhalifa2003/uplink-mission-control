import { useState } from "react";
import styles from "./GlobeHelp.module.css";

const STORAGE_KEY = "uplink_globe_help_open";

interface GlobeHelpProps {
  regionalMode: boolean;
}

export function GlobeHelp({ regionalMode }: GlobeHelpProps) {
  const [open, setOpen] = useState(() => localStorage.getItem(STORAGE_KEY) === "1");

  const toggle = (next: boolean) => {
    setOpen(next);
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  };

  if (!open) {
    return (
      <button
        type="button"
        className={styles.toggleBtn}
        onClick={() => toggle(true)}
        aria-label="Show globe controls"
        title="Globe controls"
      >
        ?
      </button>
    );
  }

  return (
    <div className={styles.help} aria-label="Globe controls help">
      <div className={styles.head}>
        <span className={styles.title}>Globe controls</span>
        <button type="button" className={styles.close} onClick={() => toggle(false)} aria-label="Hide help">
          ×
        </button>
      </div>
      <p>
        <strong>Search a city</strong> → camera flies to your site
      </p>
      <p>
        <strong>Double-click land</strong> → set observer · <strong>Drag</strong> rotate · <strong>Scroll</strong> zoom
      </p>
      <p>
        <strong>Click a sat dot</strong> → track satellite + orbit
      </p>
      {regionalMode ? (
        <p className={styles.active}>Zoomed in — borders & overhead labels on</p>
      ) : null}
    </div>
  );
}
