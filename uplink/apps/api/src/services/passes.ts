import { createHash } from "node:crypto";
import { sqlite, dbGet, dbAll } from "../db/index.js";
import { getSatellite } from "./tle.js";
import {
  createSatrecFromLines,
  predictPasses,
  computeLookAngles,
  propagateToGeodetic,
  computeGroundTrack,
  isSatelliteVisible,
} from "@uplink/propagation";
import type { Pass, LookAngles, Position, GroundTrackPoint } from "@uplink/shared";

function cacheKey(noradId: number, lat: number, lon: number, minEl: number, days: number): string {
  return createHash("sha256")
    .update(`${noradId}:${lat.toFixed(4)}:${lon.toFixed(4)}:${minEl}:${days}`)
    .digest("hex");
}

interface PassCacheRow {
  passes_json: string;
}

export async function getPasses(
  noradId: number,
  lat: number,
  lon: number,
  days = 7,
  minEl = 10,
): Promise<Pass[]> {
  const key = cacheKey(noradId, lat, lon, minEl, days);
  const now = new Date().toISOString();

  const cached = dbGet<PassCacheRow>(
    "SELECT passes_json FROM pass_cache WHERE cache_key = ? AND expires_at > ?",
    key,
    now,
  );

  if (cached) {
    return JSON.parse(cached.passes_json) as Pass[];
  }

  const sat = await getSatellite(noradId);
  if (!sat) return [];

  const satrec = createSatrecFromLines(sat.tleLine1, sat.tleLine2);
  const passes = predictPasses(satrec, noradId, { lat, lon, elevationM: 0 }, {
    minElevationDeg: minEl,
    endTime: new Date(Date.now() + days * 86400000),
    maxPasses: 20,
  });

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  sqlite
    .prepare(
      `INSERT INTO pass_cache (cache_key, passes_json, computed_at, expires_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET passes_json = excluded.passes_json,
         computed_at = excluded.computed_at, expires_at = excluded.expires_at`,
    )
    .run(key, JSON.stringify(passes), now, expiresAt);

  return passes;
}

export async function getLookAngles(
  noradId: number,
  lat: number,
  lon: number,
  at?: string,
): Promise<LookAngles | null> {
  const sat = await getSatellite(noradId);
  if (!sat) return null;

  const satrec = createSatrecFromLines(sat.tleLine1, sat.tleLine2);
  const date = at ? new Date(at) : new Date();
  const look = computeLookAngles(satrec, { lat, lon, elevationM: 0 }, date);
  if (!look) return null;

  const visible = isSatelliteVisible(satrec, { lat, lon, elevationM: 0 }, date, 0);

  return {
    azimuthDeg: look.azimuthDeg,
    elevationDeg: look.elevationDeg,
    rangeKm: look.rangeKm,
    timestamp: date.toISOString(),
    visible,
    observerLat: lat,
    observerLon: lon,
  };
}

export async function getSatellitePosition(noradId: number, at?: string): Promise<Position | null> {
  const sat = await getSatellite(noradId);
  if (!sat) return null;

  const satrec = createSatrecFromLines(sat.tleLine1, sat.tleLine2);
  const date = at ? new Date(at) : new Date();
  const pos = propagateToGeodetic(satrec, date);
  if (!pos) return null;

  return {
    noradId,
    lat: pos.lat,
    lng: pos.lng,
    alt: pos.alt,
    velocityKms: pos.velocityKms,
    timestamp: date.toISOString(),
  };
}

export async function getGroundTrack(noradId: number): Promise<GroundTrackPoint[]> {
  const sat = await getSatellite(noradId);
  if (!sat) return [];

  const satrec = createSatrecFromLines(sat.tleLine1, sat.tleLine2);
  return computeGroundTrack(satrec, { sampleIntervalSec: 30, orbits: 1 });
}
