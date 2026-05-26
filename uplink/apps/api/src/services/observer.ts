import { ISS_NORAD_ID, computeCommsScore, type ObserverBrief, type Pass } from "@uplink/shared";
import { getPasses, getLookAngles } from "./passes.js";
import { listSatellites } from "./tle.js";
import { getCurrentWeather, sampleAuroraProbability } from "./weather.js";
import { createSatrecFromLines, computeLookAngles } from "@uplink/propagation";

function computeSunElevationDeg(lat: number, lon: number, date: Date): number {
  const rad = Math.PI / 180;
  const jd =
    date.getTime() / 86400000 +
    2440587.5 -
    0.5 / 86400;
  const n = jd - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * rad;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
  const epsilon = 23.439 * rad;
  const alpha = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda));
  const delta = Math.asin(Math.sin(epsilon) * Math.sin(lambda));

  const ut =
    date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600 + date.getUTCMilliseconds() / 3600000;
  const thetaG = ((280.46 + 360.9856474 * n + ut * 15) % 360) * rad;
  const theta = thetaG + lon * rad;
  const latRad = lat * rad;
  const elevation = Math.asin(
    Math.sin(latRad) * Math.sin(delta) + Math.cos(latRad) * Math.cos(delta) * Math.cos(theta - alpha),
  );
  return elevation / rad;
}

async function countOverheadSats(lat: number, lon: number, minEl = 10): Promise<number> {
  const sats = await listSatellites();
  const obs = { lat, lon, elevationM: 0 };
  const now = new Date();
  let count = 0;
  for (const sat of sats) {
    const satrec = createSatrecFromLines(sat.tleLine1, sat.tleLine2);
    const look = computeLookAngles(satrec, obs, now);
    if (look && look.elevationDeg >= minEl) count++;
  }
  return count;
}

function formatCountdownToPass(pass: Pass | null): string {
  if (!pass) return "none scheduled";
  const ms = new Date(pass.aos).getTime() - Date.now();
  if (ms <= 0) return "now";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function auroraLabel(prob: number | null, lat: number): string {
  if (Math.abs(lat) < 45) return "unlikely at your latitude";
  if (prob === null) return "data unavailable";
  if (prob >= 50) return "possible tonight";
  if (prob >= 20) return "low chance";
  return "unlikely";
}

function buildBriefing(
  cityLabel: string,
  nextPass: Pass | null,
  overheadCount: number,
  kp: number | null,
  auroraProb: number | null,
  lat: number,
  protonSpeed: number | null,
): string {
  const passPart = nextPass
    ? `ISS next visible in ${formatCountdownToPass(nextPass)}`
    : "No ISS passes above 10° in the next week";
  const kpPart = kp !== null ? `Global Kp is ${kp <= 3 ? "quiet" : kp <= 5 ? "moderate" : "elevated"} (${kp.toFixed(1)})` : "Kp data pending";
  const windPart =
    protonSpeed !== null
      ? `Solar wind ${Math.round(protonSpeed)} km/s — ${protonSpeed > 600 ? "elevated" : protonSpeed > 450 ? "brisk" : "normal"}`
      : "";
  return `From ${cityLabel}: ${passPart}. ${overheadCount} satellite${overheadCount === 1 ? "" : "s"} overhead now. ${kpPart}. Aurora ${auroraLabel(auroraProb, lat)}.${windPart ? ` ${windPart}.` : ""}`;
}

export async function getObserverBrief(lat: number, lon: number, cityName?: string): Promise<ObserverBrief> {
  const now = new Date();
  const passes = await getPasses(ISS_NORAD_ID, lat, lon, 7, 10);
  const next24h = new Date(now.getTime() + 86400000);
  const passesNext24h = passes.filter((p) => new Date(p.aos) <= next24h).length;
  const nextIssPass = passes.find((p) => new Date(p.los) > now) ?? null;

  const auroraProbability = sampleAuroraProbability(lat, lon);
  const sunElevationDeg = computeSunElevationDeg(lat, lon, now);
  const overheadCount = await countOverheadSats(lat, lon);
  const issLookAngles = await getLookAngles(ISS_NORAD_ID, lat, lon);
  const weather = getCurrentWeather();

  const label = cityName ?? `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
  const briefing = buildBriefing(
    label,
    nextIssPass,
    overheadCount,
    weather?.kp ?? null,
    auroraProbability,
    lat,
    weather?.protonSpeed ?? null,
  );

  return {
    lat,
    lon,
    nextIssPass,
    passesNext24h,
    auroraProbability,
    sunElevationDeg,
    overheadCount,
    issLookAngles,
    briefing,
  };
}

export async function getCommsNoteForSite(commsScore: number): Promise<string> {
  if (commsScore > 60) return "HF and satellite comms may be degraded at your site during this storm.";
  if (commsScore > 30) return "Minor HF fading possible; LEO tracking generally unaffected.";
  return "Comms conditions nominal for your site given current global space weather.";
}

export function siteCommsScore(): number {
  const w = getCurrentWeather();
  if (!w) return 0;
  return computeCommsScore(w.kp, w.protonSpeed, w.bzGsm);
}
