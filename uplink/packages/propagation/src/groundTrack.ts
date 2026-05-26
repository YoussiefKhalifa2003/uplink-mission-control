import type { SatRec } from "satellite.js";
import type { GroundTrackPoint } from "@uplink/shared";
import { getOrbitalPeriodMinutes, propagateToGeodetic } from "./propagate.js";

export interface GroundTrackOptions {
  startTime?: Date;
  sampleIntervalSec?: number;
  orbits?: number;
}

export interface LiveGroundTrackOptions {
  pastMinutes?: number;
  futureMinutes?: number;
  sampleIntervalSec?: number;
}

export interface LiveGroundTrack {
  past: GroundTrackPoint[];
  future: GroundTrackPoint[];
}

export function computeGroundTrack(
  satrec: SatRec,
  options: GroundTrackOptions = {},
): GroundTrackPoint[] {
  const startTime = options.startTime ?? new Date();
  const sampleIntervalSec = options.sampleIntervalSec ?? 30;
  const orbits = options.orbits ?? 1;
  const periodMin = getOrbitalPeriodMinutes(satrec);
  const totalSec = periodMin * 60 * orbits;
  const points: GroundTrackPoint[] = [];

  for (let sec = 0; sec <= totalSec; sec += sampleIntervalSec) {
    const date = new Date(startTime.getTime() + sec * 1000);
    const pos = propagateToGeodetic(satrec, date);
    if (pos) {
      points.push([pos.lat, pos.lng, 0.002]);
    }
  }

  return points;
}

/** Ops-style window: recent subsatellite trace + forward prediction from now. */
export function computeLiveGroundTrack(
  satrec: SatRec,
  now = new Date(),
  options: LiveGroundTrackOptions = {},
): LiveGroundTrack {
  const periodMin = getOrbitalPeriodMinutes(satrec);
  const isGeo = periodMin >= 600;

  const pastMinutes = options.pastMinutes ?? (isGeo ? 45 : Math.min(22, periodMin * 0.22));
  const futureMinutes = options.futureMinutes ?? (isGeo ? 120 : Math.min(48, periodMin * 0.5));
  const sampleIntervalSec =
    options.sampleIntervalSec ??
    (isGeo ? 120 : Math.max(24, Math.min(36, Math.round((periodMin * 60) / 90))));

  const startMs = now.getTime() - pastMinutes * 60 * 1000;
  const endMs = now.getTime() + futureMinutes * 60 * 1000;
  const stepMs = sampleIntervalSec * 1000;
  const points: GroundTrackPoint[] = [];

  for (let t = startMs; t <= endMs; t += stepMs) {
    const pos = propagateToGeodetic(satrec, new Date(t));
    if (pos) {
      points.push([pos.lat, pos.lng, 0.002]);
    }
  }

  if (points.length < 2) {
    return { past: points, future: points };
  }

  let splitIndex = 0;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (let i = 0; i < points.length; i++) {
    const t = startMs + i * stepMs;
    const delta = Math.abs(t - now.getTime());
    if (delta < bestDelta) {
      bestDelta = delta;
      splitIndex = i;
    }
  }

  return {
    past: points.slice(0, splitIndex + 1),
    future: points.slice(splitIndex),
  };
}

export function computeGroundTrackSegments(
  satrec: SatRec,
  now = new Date(),
): { past: GroundTrackPoint[]; current: GroundTrackPoint[]; future: GroundTrackPoint[] } {
  const live = computeLiveGroundTrack(satrec, now);
  const current =
    live.future.length > 0
      ? [live.future[0]!]
      : live.past.length > 0
        ? [live.past[live.past.length - 1]!]
        : [];

  return { past: live.past, current, future: live.future };
}
