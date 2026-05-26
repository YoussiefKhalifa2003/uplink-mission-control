export type TrackPoint = [number, number, number];

/** Split at the antimeridian so three-globe does not draw wrap-around chords across the globe. */
export function splitTrackAtAntimeridian(track: TrackPoint[]): TrackPoint[][] {
  if (track.length < 2) return track.length ? [track] : [];

  const segments: TrackPoint[][] = [];
  let current: TrackPoint[] = [track[0]!];

  for (let i = 1; i < track.length; i++) {
    const prev = track[i - 1]!;
    const pt = track[i]!;
    if (Math.abs(pt[1] - prev[1]) > 180) {
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
