import type { Pass } from "@uplink/shared";
import type { SatRec } from "satellite.js";
import type { Observer } from "@uplink/shared";
import { computeElevationDeg } from "./lookAngles.js";

const COARSE_STEP_MS = 30_000;

function refineCrossing(
  satrec: SatRec,
  observer: Observer,
  start: Date,
  end: Date,
  rising: boolean,
  minElevationDeg: number,
): Date {
  let lo = start.getTime();
  let hi = end.getTime();

  while (hi - lo > 1000) {
    const mid = Math.floor((lo + hi) / 2);
    const el = computeElevationDeg(satrec, observer, new Date(mid));
    const above = el >= minElevationDeg;
    if (rising) {
      if (above) hi = mid;
      else lo = mid;
    } else {
      if (above) lo = mid;
      else hi = mid;
    }
  }

  return new Date(Math.floor((lo + hi) / 2));
}

export interface PassPredictOptions {
  startTime?: Date;
  endTime?: Date;
  minElevationDeg?: number;
  maxPasses?: number;
}

export function predictPasses(
  satrec: SatRec,
  noradId: number,
  observer: Observer,
  options: PassPredictOptions = {},
): Pass[] {
  const startTime = options.startTime ?? new Date();
  const endTime =
    options.endTime ??
    new Date(startTime.getTime() + 7 * 24 * 60 * 60 * 1000);
  const minElevationDeg = options.minElevationDeg ?? 10;
  const maxPasses = options.maxPasses ?? 50;

  const passes: Pass[] = [];
  let t = startTime.getTime();
  const end = endTime.getTime();
  let prevAbove = computeElevationDeg(satrec, observer, new Date(t)) >= minElevationDeg;

  while (t < end && passes.length < maxPasses) {
    const nextT = Math.min(t + COARSE_STEP_MS, end);
    const above = computeElevationDeg(satrec, observer, new Date(nextT)) >= minElevationDeg;

    if (!prevAbove && above) {
      const aos = refineCrossing(
        satrec,
        observer,
        new Date(t),
        new Date(nextT),
        true,
        minElevationDeg,
      );

      let scanT = aos.getTime() + COARSE_STEP_MS;
      let los: Date | null = null;

      while (scanT < end) {
        const scanAbove =
          computeElevationDeg(satrec, observer, new Date(scanT)) >= minElevationDeg;
        if (!scanAbove) {
          los = refineCrossing(
            satrec,
            observer,
            new Date(scanT - COARSE_STEP_MS),
            new Date(scanT),
            false,
            minElevationDeg,
          );
          break;
        }
        scanT += COARSE_STEP_MS;
      }

      if (los) {
        let maxEl = -90;
        let maxElTime = aos;
        for (let p = aos.getTime(); p <= los.getTime(); p += 5000) {
          const el = computeElevationDeg(satrec, observer, new Date(p));
          if (el > maxEl) {
            maxEl = el;
            maxElTime = new Date(p);
          }
        }

        const now = Date.now();
        passes.push({
          noradId,
          aos: aos.toISOString(),
          los: los.toISOString(),
          durationSec: Math.round((los.getTime() - aos.getTime()) / 1000),
          maxElevationDeg: Math.round(maxEl * 10) / 10,
          maxElevationTime: maxElTime.toISOString(),
          isVisibleNow: now >= aos.getTime() && now <= los.getTime() && maxEl >= minElevationDeg,
        });

        t = los.getTime() + COARSE_STEP_MS;
        prevAbove = false;
        continue;
      }
    }

    prevAbove = above;
    t = nextT;
  }

  return passes;
}
