const base = import.meta.env.VITE_API_URL ?? "/api";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${base}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? "Request failed");
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => fetchJson<{ status: string; tleAgeMinutes: number | null }>("/health"),
  satellites: () => fetchJson<import("@uplink/shared").Satellite[]>("/v1/satellites"),
  satellite: (noradId: number) =>
    fetchJson<import("@uplink/shared").Satellite & { position?: import("@uplink/shared").Position }>(
      `/v1/satellites/${noradId}`,
    ),
  groundTrack: (noradId: number) =>
    fetchJson<{ noradId: number; track: import("@uplink/shared").GroundTrackPoint[] }>(
      `/v1/satellites/${noradId}/ground-track`,
    ),
  passes: (noradId: number, lat: number, lon: number) =>
    fetchJson<{ passes: import("@uplink/shared").Pass[] }>(
      `/v1/passes?noradId=${noradId}&lat=${lat}&lon=${lon}`,
    ),
  issPasses: (lat: number, lon: number) =>
    fetchJson<{ passes: import("@uplink/shared").Pass[] }>(
      `/v1/passes/iss?lat=${lat}&lon=${lon}`,
    ),
  lookAngles: (noradId: number, lat: number, lon: number) =>
    fetchJson<import("@uplink/shared").LookAngles>(
      `/v1/look-angles?noradId=${noradId}&lat=${lat}&lon=${lon}`,
    ),
  weatherCurrent: () => fetchJson<import("@uplink/shared").WeatherCurrent>("/v1/weather/current"),
  weatherHistory: (hours = 24) =>
    fetchJson<import("@uplink/shared").WeatherSnapshot[]>(`/v1/weather/history?hours=${hours}`),
  alertsActive: () => fetchJson<import("@uplink/shared").Alert[]>("/v1/alerts/active"),
  cities: () => fetchJson<import("@uplink/shared").City[]>("/v1/cities"),
  observerBrief: (lat: number, lon: number, city?: string) =>
    fetchJson<import("@uplink/shared").ObserverBrief>(
      `/v1/observer/brief?lat=${lat}&lon=${lon}${city ? `&city=${encodeURIComponent(city)}` : ""}`,
    ),
  geocode: (q: string) =>
    fetchJson<import("@uplink/shared").GeocodeResult[]>(`/v1/geocode/search?q=${encodeURIComponent(q)}`),
};

export function getSseUrl(): string {
  return import.meta.env.VITE_SSE_URL ?? `${base}/v1/stream`;
}
