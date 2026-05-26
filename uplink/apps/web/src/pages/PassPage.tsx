import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { ISS_NORAD_ID } from "@uplink/shared";
import styles from "./PassPage.module.css";

export function PassPage() {
  const { citySlug, noradId } = useParams();
  const id = parseInt(noradId ?? String(ISS_NORAD_ID), 10);

  const { data: cities = [] } = useQuery({
    queryKey: ["cities"],
    queryFn: () => api.cities(),
  });

  const city = cities.find((c) => c.id === citySlug) ?? cities.find((c) => c.name.toLowerCase() === citySlug?.replace(/-/g, " "));

  const { data, isLoading, error } = useQuery({
    queryKey: ["passes", id, city?.lat, city?.lon],
    queryFn: () => api.passes(id, city!.lat, city!.lon),
    enabled: !!city,
  });

  if (!city) {
    return (
      <div className={styles.page}>
        <h1>Location not found</h1>
        <p>Unknown city: {citySlug}</p>
        <a href="/">← Back to mission control</a>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <a href="/" className={styles.back}>← UPLINK</a>
        <h1>
          Passes over {city.name}
        </h1>
        <p className={styles.sub}>NORAD {id} · Next 7 days · Min elevation 10°</p>
      </header>

      {isLoading && <p className={styles.loading}>Computing orbital passes...</p>}
      {error && <p className={styles.error}>Failed to load passes</p>}

      <ul className={styles.list}>
        {(data?.passes ?? []).map((p) => (
          <li key={p.aos} className={styles.card}>
            <div className={styles.aos}>
              AOS {new Date(p.aos).toLocaleString()}
            </div>
            <div className={styles.los}>
              LOS {new Date(p.los).toLocaleString()}
            </div>
            <div className={styles.stats}>
              <span>Max elevation: {p.maxElevationDeg}°</span>
              <span>Duration: {Math.round(p.durationSec / 60)} min</span>
            </div>
            {p.isVisibleNow && <span className={styles.visible}>VISIBLE NOW</span>}
          </li>
        ))}
      </ul>

      {(data?.passes ?? []).length === 0 && !isLoading && (
        <p className={styles.empty}>No passes found for this location.</p>
      )}
    </div>
  );
}
