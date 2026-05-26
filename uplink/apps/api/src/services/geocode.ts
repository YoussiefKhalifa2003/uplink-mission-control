import { sqlite, dbGet } from "../db/index.js";
import type { GeocodeResult } from "@uplink/shared";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export async function searchGeocode(query: string): Promise<GeocodeResult[]> {
  const key = query.trim().toLowerCase();
  if (!key) return [];

  const cached = dbGet<{ results_json: string; cached_at: string }>(
    "SELECT results_json, cached_at FROM geocode_cache WHERE query_key = ?",
    key,
  );

  if (cached) {
    const age = Date.now() - new Date(cached.cached_at).getTime();
    if (age < 86400000) {
      return JSON.parse(cached.results_json) as GeocodeResult[];
    }
  }

  const userAgent = process.env.NOMINATIM_USER_AGENT ?? "UPLINK/1.0 (portfolio)";
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=5`;

  const res = await fetch(url, {
    headers: { "User-Agent": userAgent },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) return [];

  const data = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>;
  const results: GeocodeResult[] = data.map((r) => ({
    displayName: r.display_name,
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
  }));

  sqlite
    .prepare(
      `INSERT INTO geocode_cache (query_key, results_json, cached_at)
       VALUES (?, ?, ?)
       ON CONFLICT(query_key) DO UPDATE SET results_json = excluded.results_json, cached_at = excluded.cached_at`,
    )
    .run(key, JSON.stringify(results), new Date().toISOString());

  return results;
}
