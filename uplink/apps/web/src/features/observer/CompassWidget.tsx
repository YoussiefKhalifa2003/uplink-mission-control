import styles from "./CompassWidget.module.css";

interface CompassWidgetProps {
  azimuthDeg: number;
  elevationDeg?: number;
}

export function CompassWidget({ azimuthDeg, elevationDeg }: CompassWidgetProps) {
  return (
    <div className={styles.compass} aria-label={`Azimuth ${azimuthDeg.toFixed(0)} degrees`}>
      <div className={styles.ring}>
        <span className={styles.n}>N</span>
        <span className={styles.e}>E</span>
        <span className={styles.s}>S</span>
        <span className={styles.w}>W</span>
        <div
          className={styles.needle}
          style={{ transform: `rotate(${azimuthDeg}deg)` }}
          aria-hidden
        />
      </div>
      <div className={styles.readout}>
        <span>{azimuthDeg.toFixed(1)}°</span>
        {elevationDeg != null ? <span className={styles.el}>El {elevationDeg.toFixed(1)}°</span> : null}
      </div>
    </div>
  );
}
