import * as satellite from "satellite.js";
import type { SatRec } from "satellite.js";
import { EARTH_RADIUS_KM } from "./tle.js";

export interface GeodeticPosition {
  lat: number;
  lng: number;
  heightKm: number;
  alt: number;
  velocityKms: number;
}

export function propagateToGeodetic(
  satrec: SatRec,
  date: Date,
): GeodeticPosition | null {
  const pv = satellite.propagate(satrec, date);
  if (!pv || !pv.position || typeof pv.position === "boolean") return null;

  const positionEci = pv.position;
  const velocityEci = pv.velocity;
  const gmst = satellite.gstime(date);
  const geodetic = satellite.eciToGeodetic(positionEci, gmst);

  const lat = satellite.degreesLat(geodetic.latitude);
  const lng = satellite.degreesLong(geodetic.longitude);
  const heightKm = geodetic.height;

  let velocityKms = 0;
  if (velocityEci && typeof velocityEci !== "boolean") {
    velocityKms = Math.sqrt(
      velocityEci.x ** 2 + velocityEci.y ** 2 + velocityEci.z ** 2,
    );
  }

  return {
    lat,
    lng,
    heightKm,
    alt: heightKm / EARTH_RADIUS_KM,
    velocityKms,
  };
}

export function getOrbitalPeriodMinutes(satrec: SatRec): number {
  const meanMotionRadMin = (satrec.no * 2 * Math.PI) / 1440;
  if (meanMotionRadMin <= 0) return 90;
  return (2 * Math.PI) / meanMotionRadMin;
}
