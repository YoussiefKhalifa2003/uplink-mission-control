export type TrackPoint = [number, number, number];

const POLE_GUARD_LAT = 85;
const GROUND_TRACK_SURFACE_ALT = 0.016;
const MAX_GROUND_TRACK_POINTS = 48;

export type TrackPathRole = "past" | "future";

export interface GlobeTrackPath {
  id: string;
  coords: TrackPoint[];
  role: TrackPathRole;
  noradId: number;
}

export function normalizeLongitude(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

/** Ground tracks render on the surface — not at orbital altitude. */
export function toSurfaceTrack(track: TrackPoint[]): TrackPoint[] {
  return track.map(([lat, lng]) => [lat, lng, GROUND_TRACK_SURFACE_ALT]);
}

function interpolateAntimeridianCrossing(prev: TrackPoint, pt: TrackPoint): TrackPoint {
  const prevLng = prev[1];
  let ptLng = pt[1];
  if (ptLng < prevLng) ptLng += 360;

  const crossLng = prevLng >= 0 ? 180 : -180;
  const frac = (crossLng - prevLng) / (ptLng - prevLng);
  const crossLat = prev[0] + frac * (pt[0] - prev[0]);

  return [crossLat, crossLng, prev[2]];
}

/**
 * Split at the antimeridian with boundary interpolation so three-globe does not
 * draw wrap-around chords across the globe.
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
      const cross = interpolateAntimeridianCrossing(prev, pt);
      current.push(cross);
      if (current.length > 1) segments.push(current);
      current = [[cross[0], -cross[1], cross[2]], pt];
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

export function prepareLiveGroundTrackPaths(
  noradId: number,
  past: TrackPoint[],
  future: TrackPoint[],
): GlobeTrackPath[] {
  const paths: GlobeTrackPath[] = [];

  for (const [role, raw] of [
    ["past", past],
    ["future", future],
  ] as const) {
    if (raw.length < 2) continue;
    const segments = splitTrackAtAntimeridian(subsampleTrack(toSurfaceTrack(raw), MAX_GROUND_TRACK_POINTS));
    segments.forEach((coords, index) => {
      if (coords.length < 2) return;
      paths.push({
        id: `${noradId}-${role}-${index}`,
        noradId,
        role,
        coords,
      });
    });
  }

  return paths;
}

/** @deprecated Use prepareLiveGroundTrackPaths */
export function prepareGroundTrackForGlobe(raw: TrackPoint[]): Array<{ id: string; coords: TrackPoint[] }> {
  const segments = splitTrackAtAntimeridian(subsampleTrack(toSurfaceTrack(raw), MAX_GROUND_TRACK_POINTS)).filter(
    (segment) => segment.length >= 2,
  );
  return trackToPathData(segments);
}
