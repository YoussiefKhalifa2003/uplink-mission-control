import styles from "./AboutPage.module.css";

export function AboutPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <a href="/" className={styles.back}>← UPLINK</a>
        <h1>About UPLINK</h1>
      </header>

      <section className={styles.section}>
        <h2>Mission</h2>
        <p>
          UPLINK is a real-time orbital operations dashboard that propagates satellites using
          SGP4/SDP4 orbital mechanics, predicts visible passes over any location, and monitors
          live NOAA space weather with mission-control alerts.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Technology</h2>
        <ul>
          <li>React 18 + TypeScript + Vite</li>
          <li>react-globe.gl + Three.js WebGL globe</li>
          <li>satellite.js SGP4 propagation (client Web Worker + server API)</li>
          <li>Node.js Fastify API with SSE real-time stream</li>
          <li>Node.js built-in SQLite (node:sqlite)</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>Data Sources</h2>
        <ul>
          <li>
            <a href="https://celestrak.org" target="_blank" rel="noreferrer">CelesTrak</a>
            — NORAD TLE two-line element sets
          </li>
          <li>
            <a href="https://www.swpc.noaa.gov" target="_blank" rel="noreferrer">NOAA SWPC</a>
            — Space weather (Kp, solar wind, IMF)
          </li>
          <li>
            <a href="https://www.openstreetmap.org" target="_blank" rel="noreferrer">OpenStreetMap</a>
            — Geocoding via Nominatim
          </li>
          <li>NASA Blue Marble — Earth texture (public domain)</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>Author</h2>
        <p>
          Built by Youssief Khalifa — portfolio capstone demonstrating real-time geospatial web
          systems and orbital mechanics.
        </p>
      </section>

      <p className={styles.license}>MIT License · Not affiliated with NASA or NOAA</p>
    </div>
  );
}
