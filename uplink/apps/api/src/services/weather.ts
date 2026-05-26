import {
  computeCommsScore,
  kpStormLabel,
  kpToGScale,
  protonFluxToSScale,
  xrayClassToRScale,
  type WeatherCurrent,
  type Alert,
  type AlertSeverity,
  type KpForecastPoint,
  type SpaceWeatherEvent,
} from "@uplink/shared";
import { sqlite, dbAll } from "../db/index.js";

const KP_URL = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json";
const KP_FORECAST_URL = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json";
const WIND_URL = "https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json";
const MAG_URL = "https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json";
const EVENTS_URL = "https://services.swpc.noaa.gov/json/edited_events.json";
const XRAY_URL = "https://services.swpc.noaa.gov/json/goes/primary/xray-flares-latest.json";
const PROTON_URL = "https://services.swpc.noaa.gov/json/goes/primary/integral-protons-6-hour.json";
const ELECTRON_URL = "https://services.swpc.noaa.gov/json/goes/primary/integral-electrons-6-hour.json";
const F107_URL = "https://services.swpc.noaa.gov/json/f107_cm_flux.json";
const AURORA_URL = "https://services.swpc.noaa.gov/json/ovation_aurora_latest.json";

let lastWeatherPoll: Date | null = null;
let currentWeather: WeatherCurrent | null = null;
let auroraCoordinates: Array<[number, number, number]> = [];

export function getAuroraCoordinates(): Array<[number, number, number]> {
  return auroraCoordinates;
}

/** Sample OVATION aurora power at observer lat/lon (0–100 scale). */
export function sampleAuroraProbability(lat: number, lon: number): number | null {
  if (auroraCoordinates.length === 0) return null;
  let nearest: { dist: number; power: number } | null = null;
  for (const [gridLon, gridLat, power] of auroraCoordinates) {
    const dLat = gridLat - lat;
    let dLon = gridLon - lon;
    if (dLon > 180) dLon -= 360;
    if (dLon < -180) dLon += 360;
    const dist = dLat * dLat + dLon * dLon;
    if (!nearest || dist < nearest.dist) nearest = { dist, power };
  }
  if (!nearest) return null;
  return Math.min(100, Math.round((nearest.power / 10) * 100));
}

const recentAlertKeys = new Map<string, { severity: AlertSeverity; at: number }>();

export function getLastWeatherPoll(): Date | null {
  return lastWeatherPoll;
}

export function getCurrentWeather(): WeatherCurrent | null {
  return currentWeather;
}

function parseNumeric(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.json();
}

function latestActiveRow(data: unknown): Record<string, unknown> | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  const active = [...(data as Record<string, unknown>[])].reverse().find(
    (r) => r.active === true || r.active === "true" || r.active === 1,
  );
  return (active ?? data[data.length - 1]) as Record<string, unknown>;
}

function extractLatestKp(data: unknown): number | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  const last = data[data.length - 1] as Record<string, unknown> | unknown[];
  if (Array.isArray(last)) {
    const kpIdx = (data[0] as string[]).indexOf("Kp");
    return parseNumeric(last[kpIdx]);
  }
  return parseNumeric((last as Record<string, unknown>).Kp ?? (last as Record<string, unknown>).kp);
}

function extractWind(data: unknown): {
  speed: number | null;
  density: number | null;
  temperature: number | null;
  source: string | null;
  timeTag: string | null;
} {
  const row = latestActiveRow(data);
  if (!row) {
    return { speed: null, density: null, temperature: null, source: null, timeTag: null };
  }
  return {
    speed: parseNumeric(row.proton_speed ?? row.speed),
    density: parseNumeric(row.proton_density),
    temperature: parseNumeric(row.proton_temperature),
    source: row.source != null ? String(row.source) : null,
    timeTag: row.time_tag != null ? String(row.time_tag) : null,
  };
}

function extractMag(data: unknown): {
  bx: number | null;
  by: number | null;
  bz: number | null;
  bt: number | null;
  lon: number | null;
  lat: number | null;
  source: string | null;
  timeTag: string | null;
} {
  const row = latestActiveRow(data);
  if (!row) {
    return { bx: null, by: null, bz: null, bt: null, lon: null, lat: null, source: null, timeTag: null };
  }
  return {
    bx: parseNumeric(row.bx_gsm),
    by: parseNumeric(row.by_gsm),
    bz: parseNumeric(row.bz_gsm),
    bt: parseNumeric(row.bt),
    lon: parseNumeric(row.phi_gsm ?? row.lon_gsm),
    lat: parseNumeric(row.theta_gsm ?? row.lat_gsm),
    source: row.source != null ? String(row.source) : null,
    timeTag: row.time_tag != null ? String(row.time_tag) : null,
  };
}

function latestGoesFlux(data: unknown, energy: string): number | null {
  if (!Array.isArray(data)) return null;
  const rows = (data as Record<string, unknown>[]).filter((r) => String(r.energy ?? "") === energy);
  if (rows.length === 0) return null;
  const last = rows[rows.length - 1]!;
  return parseNumeric(last.flux);
}

function extractXray(data: unknown): {
  xrayClass: string | null;
  fluxLong: number | null;
  fluxRatio: number | null;
} {
  if (!Array.isArray(data) || data.length === 0) {
    return { xrayClass: null, fluxLong: null, fluxRatio: null };
  }
  const row = data[data.length - 1] as Record<string, unknown>;
  return {
    xrayClass: row.current_class != null ? String(row.current_class) : row.max_class != null ? String(row.max_class) : null,
    fluxLong: parseNumeric(row.current_int_xrlong ?? row.max_xrlong),
    fluxRatio: parseNumeric(row.current_ratio ?? row.max_ratio),
  };
}

function extractF107(data: unknown): { f107: number | null; mean90: number | null } {
  if (!Array.isArray(data) || data.length === 0) return { f107: null, mean90: null };
  const row = data[0] as Record<string, unknown>;
  return {
    f107: parseNumeric(row.flux),
    mean90: parseNumeric(row.ninety_day_mean),
  };
}

function extractKpForecast(data: unknown): KpForecastPoint[] {
  if (!Array.isArray(data)) return [];
  return (data as Record<string, unknown>[])
    .slice(-24)
    .map((row) => ({
      time: String(row.time_tag ?? ""),
      kp: parseNumeric(row.kp) ?? 0,
      kind: (String(row.observed ?? "observed") as KpForecastPoint["kind"]),
      noaaScale: row.noaa_scale != null ? String(row.noaa_scale) : null,
    }));
}

function extractRecentEvents(data: unknown): SpaceWeatherEvent[] {
  if (!Array.isArray(data)) return [];
  const weekAgo = Date.now() - 7 * 86400000;
  return (data as Record<string, unknown>[])
    .map((ev) => ({
      type: String(ev.type ?? ev.event_type ?? "Event"),
      begin: String(ev.begin_time ?? ev.begin ?? ""),
      peak: ev.peak_time != null ? String(ev.peak_time) : ev.max_time != null ? String(ev.max_time) : null,
      end: ev.end_time != null ? String(ev.end_time) : ev.end != null ? String(ev.end) : null,
      location: ev.location != null ? String(ev.location) : ev.source_location != null ? String(ev.source_location) : null,
      description: ev.description != null ? String(ev.description) : null,
    }))
    .filter((ev) => {
      const t = new Date(ev.begin).getTime();
      return Number.isFinite(t) && t >= weekAgo;
    })
    .slice(0, 12);
}

function extractAurora(data: unknown): { powerMax: number | null; observationTime: string | null } {
  if (!data || typeof data !== "object") {
    auroraCoordinates = [];
    return { powerMax: null, observationTime: null };
  }
  const obj = data as Record<string, unknown>;
  const coords = obj.coordinates;
  let powerMax: number | null = null;
  const parsed: Array<[number, number, number]> = [];
  if (Array.isArray(coords)) {
    for (const c of coords) {
      if (!Array.isArray(c) || c.length < 3) continue;
      const lon = parseNumeric(c[0]);
      const lat = parseNumeric(c[1]);
      const p = parseNumeric(c[2]);
      if (lon === null || lat === null || p === null) continue;
      parsed.push([lon, lat, p]);
      if (powerMax === null || p > powerMax) powerMax = p;
    }
  }
  auroraCoordinates = parsed;
  return {
    powerMax,
    observationTime: obj["Observation Time"] != null ? String(obj["Observation Time"]) : null,
  };
}

interface AlertRule {
  alertId: string;
  severity: AlertSeverity;
  message: string;
  check: (ctx: { kp: number | null; protonSpeed: number | null; bzGsm: number | null; events: unknown }) => boolean;
}

const ALERT_RULES: AlertRule[] = [
  {
    alertId: "KP_SEVERE",
    severity: "CRITICAL",
    message: "Severe storm — navigation and grid impacts possible",
    check: ({ kp }) => kp !== null && kp >= 7,
  },
  {
    alertId: "KP_STRONG",
    severity: "CRITICAL",
    message: "Strong geomagnetic storm — HF blackout risk on sunlit side",
    check: ({ kp }) => kp !== null && kp >= 6 && kp < 7,
  },
  {
    alertId: "KP_MODERATE",
    severity: "WARNING",
    message: "Moderate geomagnetic storm — HF radio degradation possible",
    check: ({ kp }) => kp !== null && kp >= 5 && kp < 6,
  },
  {
    alertId: "SW_EXTREME",
    severity: "CRITICAL",
    message: "Extreme solar wind — storm arrival likely",
    check: ({ protonSpeed }) => protonSpeed !== null && protonSpeed >= 800,
  },
  {
    alertId: "SW_HIGH",
    severity: "WARNING",
    message: "Elevated solar wind — increased geomagnetic coupling",
    check: ({ protonSpeed }) => protonSpeed !== null && protonSpeed >= 600 && protonSpeed < 800,
  },
  {
    alertId: "BZ_SOUTH",
    severity: "WARNING",
    message: "Southward IMF — enhanced aurora and HF disruption",
    check: ({ bzGsm }) => bzGsm !== null && bzGsm <= -10,
  },
];

function checkFlareAlerts(events: unknown): AlertRule[] {
  const rules: AlertRule[] = [];
  if (!Array.isArray(events)) return rules;
  const sixHoursAgo = Date.now() - 6 * 3600000;

  for (const ev of events as Record<string, unknown>[]) {
    const type = String(ev.type ?? ev.event_type ?? "");
    const begin = new Date(String(ev.begin_time ?? ev.begin ?? "")).getTime();
    if (!Number.isFinite(begin) || begin < sixHoursAgo) continue;
    if (/X/i.test(type)) {
      rules.push({
        alertId: "FLARE_X",
        severity: "CRITICAL",
        message: "X-class solar flare — radio blackout likely",
        check: () => true,
      });
    } else if (/M/i.test(type)) {
      rules.push({
        alertId: "FLARE_M",
        severity: "WARNING",
        message: "M-class solar flare detected",
        check: () => true,
      });
    }
  }
  return rules;
}

function shouldFireAlert(alertId: string, severity: AlertSeverity): boolean {
  const key = `${alertId}:${severity}`;
  const prev = recentAlertKeys.get(key);
  const now = Date.now();
  if (prev && now - prev.at < 30 * 60 * 1000) return false;
  recentAlertKeys.set(key, { severity, at: now });
  return true;
}

export type AlertCallback = (alert: Alert, type: "fired" | "cleared") => void;

let alertCallback: AlertCallback | null = null;

export function setAlertCallback(cb: AlertCallback): void {
  alertCallback = cb;
}

interface AlertRow {
  id: number;
  alert_id: string;
  severity: string;
  message: string;
  comms_score: number | null;
  fired_at: string;
  cleared_at: string | null;
}

export async function pollWeather(): Promise<WeatherCurrent> {
  const [
    kpData,
    kpForecastData,
    windData,
    magData,
    eventsData,
    xrayData,
    protonData,
    electronData,
    f107Data,
    auroraData,
  ] = await Promise.all([
    fetchJson(KP_URL).catch(() => []),
    fetchJson(KP_FORECAST_URL).catch(() => []),
    fetchJson(WIND_URL).catch(() => []),
    fetchJson(MAG_URL).catch(() => []),
    fetchJson(EVENTS_URL).catch(() => []),
    fetchJson(XRAY_URL).catch(() => []),
    fetchJson(PROTON_URL).catch(() => []),
    fetchJson(ELECTRON_URL).catch(() => []),
    fetchJson(F107_URL).catch(() => []),
    fetchJson(AURORA_URL).catch(() => null),
  ]);

  const kp = extractLatestKp(kpData);
  const wind = extractWind(windData);
  const mag = extractMag(magData);
  const xray = extractXray(xrayData);
  const f107 = extractF107(f107Data);
  const aurora = extractAurora(auroraData);
  const protonFlux10MeV = latestGoesFlux(protonData, ">=10 MeV");
  const protonFlux1MeV = latestGoesFlux(protonData, ">=1 MeV");
  const protonFlux100MeV = latestGoesFlux(protonData, ">=100 MeV");
  const electronFlux2MeV = latestGoesFlux(electronData, ">=2 MeV");
  const kpForecast = extractKpForecast(kpForecastData);
  const recentEvents = extractRecentEvents(eventsData);

  const protonSpeed = wind.speed;
  const bzGsm = mag.bz;
  const bt = mag.bt;
  const commsScore = computeCommsScore(kp, protonSpeed, bzGsm);
  const recordedAt = new Date().toISOString();
  const gScale = kpToGScale(kp);
  const sScale = protonFluxToSScale(protonFlux10MeV);
  const rScale = xrayClassToRScale(xray.xrayClass);

  const weather: WeatherCurrent = {
    kp,
    protonSpeed,
    bzGsm,
    bt,
    commsScore,
    recordedAt,
    protonDensity: wind.density,
    protonTemperature: wind.temperature,
    windSource: wind.source,
    windTimeTag: wind.timeTag,
    bxGsm: mag.bx,
    byGsm: mag.by,
    lonGsm: mag.lon,
    latGsm: mag.lat,
    magSource: mag.source,
    magTimeTag: mag.timeTag,
    xrayClass: xray.xrayClass,
    xrayFluxLong: xray.fluxLong,
    xrayFluxRatio: xray.fluxRatio,
    protonFlux1MeV,
    protonFlux10MeV,
    protonFlux100MeV,
    electronFlux2MeV,
    f107: f107.f107,
    f107_90dayMean: f107.mean90,
    gScale,
    sScale,
    rScale,
    kpStormLabel: kpStormLabel(kp),
    kpForecast,
    recentEvents,
    auroraPowerMax: aurora.powerMax,
    auroraObservationTime: aurora.observationTime,
  };

  sqlite
    .prepare(
      `INSERT INTO space_weather_snapshots (recorded_at, kp, proton_speed, bz_gsm, bt, raw_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(recordedAt, kp, protonSpeed, bzGsm, bt, JSON.stringify({ kpData, windData, magData }));

  currentWeather = weather;
  lastWeatherPoll = new Date();

  const ctx = { kp, protonSpeed, bzGsm, events: eventsData };
  const allRules = [...ALERT_RULES, ...checkFlareAlerts(eventsData)];

  for (const rule of allRules) {
    if (rule.check(ctx) && shouldFireAlert(rule.alertId, rule.severity)) {
      const result = sqlite
        .prepare(
          `INSERT INTO alerts (alert_id, severity, message, comms_score, fired_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(rule.alertId, rule.severity, rule.message, commsScore, recordedAt);

      if (alertCallback) {
        alertCallback(
          {
            id: Number(result.lastInsertRowid),
            alertId: rule.alertId,
            severity: rule.severity,
            message: rule.message,
            commsScore,
            firedAt: recordedAt,
          },
          "fired",
        );
      }
    }
  }

  if (alertCallback) {
    alertCallback(
      {
        alertId: "weather",
        severity: "INFO",
        message: "weather update",
        firedAt: recordedAt,
        commsScore,
      },
      "fired",
    );
  }

  return weather;
}

interface SnapshotRow {
  recorded_at: string;
  kp: number | null;
  proton_speed: number | null;
  bz_gsm: number | null;
  bt: number | null;
}

export async function getWeatherHistory(hours: number) {
  const since = new Date(Date.now() - hours * 3600000).toISOString();
  return dbAll<SnapshotRow>(
    "SELECT recorded_at, kp, proton_speed, bz_gsm, bt FROM space_weather_snapshots WHERE recorded_at >= ? ORDER BY recorded_at DESC LIMIT 500",
    since,
  );
}

export async function getActiveAlerts(): Promise<Alert[]> {
  const rows = dbAll<AlertRow>(
    "SELECT * FROM alerts WHERE cleared_at IS NULL ORDER BY fired_at DESC LIMIT 50",
  );
  return rows.map((r) => ({
    id: r.id,
    alertId: r.alert_id,
    severity: r.severity as AlertSeverity,
    message: r.message,
    commsScore: r.comms_score ?? undefined,
    firedAt: r.fired_at,
    clearedAt: r.cleared_at,
  }));
}

export async function getAlertHistory(days: number): Promise<Alert[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const rows = dbAll<AlertRow>(
    "SELECT * FROM alerts WHERE fired_at >= ? ORDER BY fired_at DESC LIMIT 200",
    since,
  );
  return rows.map((r) => ({
    id: r.id,
    alertId: r.alert_id,
    severity: r.severity as AlertSeverity,
    message: r.message,
    commsScore: r.comms_score ?? undefined,
    firedAt: r.fired_at,
    clearedAt: r.cleared_at,
  }));
}
