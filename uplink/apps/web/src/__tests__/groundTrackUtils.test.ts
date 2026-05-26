import { describe, expect, it } from "vitest";
import { splitTrackAtAntimeridian, subsampleTrack } from "../lib/groundTrackUtils";

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

  it("subsamples long tracks", () => {
    const track = Array.from({ length: 100 }, (_, i) => [0, i, 0.4] as [number, number, number]);
    const out = subsampleTrack(track, 10);
    expect(out).toHaveLength(10);
  });
});
