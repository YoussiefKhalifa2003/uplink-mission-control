import { describe, expect, it } from "vitest";
import {
  prepareLiveGroundTrackPaths,
  splitTrackAtAntimeridian,
  subsampleTrack,
  toSurfaceTrack,
} from "../lib/groundTrackUtils";

describe("groundTrackUtils", () => {
  it("splits track at antimeridian with boundary points", () => {
    const track: Array<[number, number, number]> = [
      [0, 170, 0.002],
      [0, 175, 0.002],
      [0, -175, 0.002],
      [0, -170, 0.002],
    ];
    const segments = splitTrackAtAntimeridian(track);
    expect(segments).toHaveLength(2);
    expect(segments[0]!.at(-1)?.[1]).toBe(180);
    expect(segments[1]![0]?.[1]).toBe(-180);
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
      [10, 20, 0.016],
      [11, 21, 0.016],
    ]);
  });

  it("builds unique path ids per satellite and role", () => {
    const pathsA = prepareLiveGroundTrackPaths(25544, [[0, 10, 0.002], [1, 12, 0.002]], [[1, 12, 0.002], [2, 14, 0.002]]);
    const pathsB = prepareLiveGroundTrackPaths(43013, [[30, 40, 0.002], [31, 42, 0.002]], [[31, 42, 0.002], [32, 44, 0.002]]);
    expect(pathsA[0]?.id).toContain("25544");
    expect(pathsB[0]?.id).toContain("43013");
    expect(pathsA[0]?.id).not.toEqual(pathsB[0]?.id);
  });
});
