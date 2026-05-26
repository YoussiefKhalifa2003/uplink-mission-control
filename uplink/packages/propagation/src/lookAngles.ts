import * as satellite from "satellite.js";
import type { SatRec } from "satellite.js";
import type { Observer } from "@uplink/shared";
import { propagateToGeodetic } from "./propagate.js";

export interface LookAnglesResult {
  azimuthDeg: number;
  elevationDeg: number;
  rangeKm: number;
}

function normalizeDeg360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function computeLookAngles(
  satrec: SatRec,
  observer: Observer,
  date: Date,
): LookAnglesResult | null {
  const pv = satellite.propagate(satrec, date);
  if (!pv || !pv.position || typeof pv.position === "boolean") return null;

  const positionEci = pv.position;
  const gmst = satellite.gstime(date);
  const positionEcf = satellite.eciToEcf(positionEci, gmst);

  const observerGd = {
    longitude: satellite.degreesToRadians(observer.lon),
    latitude: satellite.degreesToRadians(observer.lat),
    height: observer.elevationM / 1000,
  };

  const look = satellite.ecfToLookAngles(observerGd, positionEcf);

  return {
    azimuthDeg: normalizeDeg360(radToDeg(look.azimuth)),
    elevationDeg: radToDeg(look.elevation),
    rangeKm: look.rangeSat,
  };
}

export function computeElevationDeg(
  satrec: SatRec,
  observer: Observer,
  date: Date,
): number {
  const look = computeLookAngles(satrec, observer, date);
  return look?.elevationDeg ?? -90;
}

export function isSatelliteVisible(
  satrec: SatRec,
  observer: Observer,
  date: Date,
  minElevationDeg: number,
): boolean {
  return computeElevationDeg(satrec, observer, date) >= minElevationDeg;
}

export { propagateToGeodetic };
