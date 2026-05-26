export type TrackPoint = [number, number, number];

const POLE_GUARD_LAT = 85;
const GROUND_TRACK_SURFACE_ALT = 0.002;
const MAX_GROUND_TRACK_POINTS = 36;

/** Ground tracks render on the surface — not at orbital altitude. */
export function toSurfaceTrack(track: TrackPoint[]): TrackPoint[] {
  return track.map(([lat, lng]) => [lat, lng, GROUND_TRACK_SURFACE_ALT]);
}

/**
 * Split at the antimeridian so three-globe does not draw wrap-around chords.
 * Ignores longitude jumps near the poles where subsatellite longitude is unstable.
 */
export function splitTrackAtAntimeridian(track: TrackPoint[]): TrackPoint[][] {
  if (track.length < 2) return track.length ? [track] : [];

  const segments: TrackPoint[][] = [];
  let current: TrackPoint[] = [track[0]!];

  for (let i = 1; i < track.length; i++) {
    const prev = track[i - 1]!;
    const pt = track[i]!;
    const lngDelta = Math.abs(pt[1] - prev[1]);
    const nearPole = Math.abs(pt[0]) > POLE_GUARD_LAT || Math.abs(prev[0]) > POLE_GUARD_LAT;

    if (lngDelta > 180 && !nearPole) {
      if (current.length > 1) segments.push(current);
      current = [pt];
    } else {
      current.push(pt);
    }
  }

  if (current.length > 1) segments.push(current);
  return segments;
}

export function subsampleTrack(track: TrackPoint[], maxPoints: number): TrackPoint[] {
  if (track.length <= maxPoints) return track;
  const out: TrackPoint[] = [];
  const step = (track.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    out.push(track[Math.round(i * step)]!);
  }
  return out;
}

export function trackToPathData(segments: TrackPoint[][]): Array<{ id: string; coords: TrackPoint[] }> {
  return segments.map((coords, i) => ({ id: `seg-${i}`, coords }));
}

export function prepareGroundTrackForGlobe(raw: TrackPoint[]): Array<{ id: string; coords: TrackPoint[] }> {
  const surface = toSurfaceTrack(raw);
  const sampled = subsampleTrack(surface, MAX_GROUND_TRACK_POINTS);
  const segments = splitTrackAtAntimeridian(sampled).filter((segment) => segment.length >= 2);
  return trackToPathData(segments);
}
