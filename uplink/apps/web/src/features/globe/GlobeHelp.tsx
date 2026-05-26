import styles from "./GlobeHelp.module.css";

interface GlobeHelpProps {
  regionalMode: boolean;
}

export function GlobeHelp({ regionalMode }: GlobeHelpProps) {
  return (
    <div className={styles.help} aria-label="Globe controls help">
      <div className={styles.title}>How to use the globe</div>
      <ul>
        <li>
          <strong>Search a city</strong> in the right panel — the camera flies to your observer site, not the satellite.
        </li>
        <li>
          <strong>Drag</strong> to rotate · <strong>Scroll</strong> to zoom · <strong>Click land</strong> to set a custom observer
        </li>
        <li>
          <strong>Click a satellite dot</strong> to track it and show its orbit path
        </li>
        {regionalMode ? (
          <li className={styles.active}>
            <strong>Regional view</strong> — country borders stay visible. Overhead satellites are labeled.
          </li>
        ) : (
          <li>
            <strong>Zoom in</strong> on a city for regional detail and overhead satellite labels
          </li>
        )}
      </ul>
    </div>
  );
}
