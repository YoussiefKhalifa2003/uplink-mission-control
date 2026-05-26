import type { SatRec } from "satellite.js";
import type { GroundTrackPoint } from "@uplink/shared";
import { getOrbitalPeriodMinutes, propagateToGeodetic } from "./propagate.js";

export interface GroundTrackOptions {
  startTime?: Date;
  sampleIntervalSec?: number;
  orbits?: number;
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
      points.push([pos.lat, pos.lng, pos.alt]);
    }
  }

  return points;
}

export function computeGroundTrackSegments(
  satrec: SatRec,
  now = new Date(),
): { past: GroundTrackPoint[]; current: GroundTrackPoint[]; future: GroundTrackPoint[] } {
  const periodMin = getOrbitalPeriodMinutes(satrec);
  const halfPeriodMs = (periodMin * 60 * 1000) / 2;

  const pastStart = new Date(now.getTime() - halfPeriodMs);
  const futureEnd = new Date(now.getTime() + halfPeriodMs);

  const past = computeGroundTrack(satrec, {
    startTime: pastStart,
    sampleIntervalSec: 30,
    orbits: 0.5,
  });

  const current = computeGroundTrack(satrec, {
    startTime: now,
    sampleIntervalSec: 30,
    orbits: 0.25,
  });

  const future = computeGroundTrack(satrec, {
    startTime: now,
    sampleIntervalSec: 30,
    orbits: 0.5,
  });

  void futureEnd;
  return { past, current, future };
}
