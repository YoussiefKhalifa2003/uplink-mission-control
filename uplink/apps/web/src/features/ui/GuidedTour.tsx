import { useEffect, useState } from "react";
import styles from "./GuidedTour.module.css";

const STORAGE_KEY = "uplink_tour_done";

const STEPS = [
  {
    title: "Pick your city",
    body: "Search for an observer location in the right panel. Pass times and satellite tracking are calculated for that spot on Earth.",
  },
  {
    title: "Global vs local data",
    body: "The top bar shows planetary space weather (Kp, solar wind) — same everywhere. Passes and tracking change when you switch cities.",
  },
  {
    title: "Explore the globe",
    body: "Double-click land to set your observer, or click a country border. Zoom in for regional detail and overhead satellite labels.",
  },
];

export function GuidedTour() {
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === "1") return;
    const t = setTimeout(() => setStep(0), 800);
    return () => clearTimeout(t);
  }, []);

  if (step === null) return null;

  const current = STEPS[step]!;

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setStep(null);
  };

  const next = () => {
    if (step >= STEPS.length - 1) finish();
    else setStep(step + 1);
  };

  return (
    <div className={styles.overlay} role="dialog" aria-label="Welcome tour">
      <div className={styles.card}>
        <div className={styles.stepLabel}>
          Step {step + 1} of {STEPS.length}
        </div>
        <h2 className={styles.title}>{current.title}</h2>
        <p className={styles.body}>{current.body}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.skip} onClick={finish}>
            Skip
          </button>
          <button type="button" className={styles.next} onClick={next}>
            {step >= STEPS.length - 1 ? "Got it" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
