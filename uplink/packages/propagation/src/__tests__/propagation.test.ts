import { describe, it, expect } from "vitest";
import {
  parseTleBlock,
  propagateToGeodetic,
  computeLookAngles,
  predictPasses,
  computeLiveGroundTrack,
  EARTH_RADIUS_KM,
} from "../index.js";

const ISS_TLE = `ISS (ZARYA)
1 25544U 98067A   24120.50000000  .00010000  00000-0  20000-4 0  9993
2 25544  51.6400 247.4627 0006703 130.5360 325.0288 15.48919399000000`;

describe("TLE parsing", () => {
  it("parses ISS TLE block", () => {
    const parsed = parseTleBlock(ISS_TLE);
    expect(parsed).not.toBeNull();
    expect(parsed!.noradId).toBe(25544);
    expect(parsed!.name).toContain("ISS");
  });
});

describe("Propagation", () => {
  it("propagates ISS to valid geodetic coordinates", () => {
    const parsed = parseTleBlock(ISS_TLE)!;
    const pos = propagateToGeodetic(parsed.satrec, new Date());
    expect(pos).not.toBeNull();
    expect(pos!.lat).toBeGreaterThanOrEqual(-90);
    expect(pos!.lat).toBeLessThanOrEqual(90);
    expect(pos!.lng).toBeGreaterThanOrEqual(-180);
    expect(pos!.lng).toBeLessThanOrEqual(180);
    expect(pos!.heightKm).toBeGreaterThan(300);
    expect(pos!.heightKm).toBeLessThan(500);
    expect(pos!.alt).toBeCloseTo(pos!.heightKm / EARTH_RADIUS_KM, 3);
  });
});

describe("Look angles", () => {
  it("returns valid azimuth and elevation", () => {
    const parsed = parseTleBlock(ISS_TLE)!;
    const look = computeLookAngles(
      parsed.satrec,
      { lat: 25.2048, lon: 55.2708, elevationM: 0 },
      new Date(),
    );
    expect(look).not.toBeNull();
    expect(look!.azimuthDeg).toBeGreaterThanOrEqual(0);
    expect(look!.azimuthDeg).toBeLessThan(360);
    expect(look!.rangeKm).toBeGreaterThan(0);
  });
});

describe("Pass prediction", () => {
  it("finds at least one ISS pass over Dubai in 7 days", () => {
    const parsed = parseTleBlock(ISS_TLE)!;
    const passes = predictPasses(parsed.satrec, 25544, {
      lat: 25.2048,
      lon: 55.2708,
      elevationM: 0,
    });
    expect(passes.length).toBeGreaterThan(0);
    expect(passes[0]!.maxElevationDeg).toBeGreaterThanOrEqual(10);
    expect(passes[0]!.durationSec).toBeGreaterThan(0);
  });
});

describe("Live ground track", () => {
  it("produces different subsatellite paths for different satellites", () => {
    const iss = parseTleBlock(ISS_TLE)!;
    const now = new Date("2024-05-01T12:00:00Z");
    const issTrack = computeLiveGroundTrack(iss.satrec, now);

    const hubbleTle = `HST
1 20580U 90037B   24120.50000000  .00000100  00000-0  10000-4 0  9990
2 20580  28.4700 120.0000 0002800  90.0000 270.0000 15.09000000000000`;
    const hst = parseTleBlock(hubbleTle)!;
    const hstTrack = computeLiveGroundTrack(hst.satrec, now);

    expect(issTrack.future.length).toBeGreaterThan(2);
    expect(hstTrack.future.length).toBeGreaterThan(2);
    expect(issTrack.future[0]).not.toEqual(hstTrack.future[0]);
  });
});
