import { describe, expect, it } from "vitest";
import {
  prepareGroundTrackForGlobe,
  splitTrackAtAntimeridian,
  subsampleTrack,
  toSurfaceTrack,
} from "../lib/groundTrackUtils";

describe("groundTrackUtils", () => {
  it("splits track at antimeridian", () => {
    const track: Array<[number, number, number]> = [
      [0, 170, 0.4],
      [0, 175, 0.4],
      [0, -175, 0.4],
      [0, -170, 0.4],
    ];
    const segments = splitTrackAtAntimeridian(track);
    expect(segments).toHaveLength(2);
    expect(segments[0]).toHaveLength(2);
    expect(segments[1]).toHaveLength(2);
  });

  it("does not over-split near poles when longitude jumps", () => {
    const track: Array<[number, number, number]> = [
      [86, 120, 0.002],
      [87, -160, 0.002],
      [88, 40, 0.002],
      [87, -120, 0.002],
    ];
    const segments = splitTrackAtAntimeridian(track);
    expect(segments).toHaveLength(1);
  });

  it("subsamples long tracks", () => {
    const track = Array.from({ length: 100 }, (_, i) => [0, i, 0.4] as [number, number, number]);
    const out = subsampleTrack(track, 10);
    expect(out).toHaveLength(10);
  });

  it("projects orbital track to the surface for globe rendering", () => {
    const track: Array<[number, number, number]> = [
      [10, 20, 0.06],
      [11, 21, 0.06],
    ];
    expect(toSurfaceTrack(track)).toEqual([
      [10, 20, 0.002],
      [11, 21, 0.002],
    ]);
  });

  it("prepares a single clean path segment for typical tracks", () => {
    const track = Array.from({ length: 80 }, (_, i) => [30, -100 + i * 2, 0.06] as [number, number, number]);
    const paths = prepareGroundTrackForGlobe(track);
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.length).toBeLessThanOrEqual(2);
    for (const path of paths) {
      expect(path.coords.length).toBeGreaterThan(1);
      expect(path.coords.every(([, , alt]) => alt === 0.002)).toBe(true);
    }
  });
});
