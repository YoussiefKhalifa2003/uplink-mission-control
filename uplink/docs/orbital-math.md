# Orbital Math Deep Dive

## SGP4 Propagation

UPLINK uses the **Simplified General Perturbations 4** model via `satellite.js`, implementing the NORAD standard for near-Earth satellites (period < 225 minutes).

Given a Two-Line Element (TLE) set:

```
1 25544U 98067A   24159.48562572  .00016172  00000-0  29073-3 0  9994
2 25544  51.6417 172.1719 0003774 151.2943 290.8590 15.50208158103443
```

We compute ECI position at time `t`, convert to geodetic coordinates (lat, lng, height), and normalize altitude for the globe as `height / 6371 km`.

## Look Angles

From observer geodetic position:

1. `geodeticToEcf(observer)` → observer ECF position
2. `propagate(satrec, t)` → satellite ECI → `eciToEcf` → satellite ECF
3. `ecfToLookAngles(observerEcf, satelliteEcf)` → azimuth, elevation, slant range

Elevation ≥ 10° is the default visibility threshold (standard for amateur satellite spotting).

## Pass Prediction

**Phase 1 — Coarse scan:** Sample elevation every 30 seconds over 7 days.

**Phase 2 — Refine:** Binary search each threshold crossing to 1-second precision.

**Phase 3 — Metadata:** Scan pass window at 5s intervals for max elevation.

Expected performance: ISS 7-day prediction completes in < 50ms on modern hardware.

## TLE Staleness

TLE epoch older than 72 hours triggers a "Stale TLE" badge. CelesTrak recommends updating at least daily; we refresh every 6 hours.

## Interview Talking Points

1. **Why SGP4?** — Industry standard, used by NORAD, handles perturbations (J2, drag) without full numerical integration.

2. **Why Web Worker?** — Propagating 20–40 satellites at 1 Hz on the main thread causes frame drops with WebGL.

3. **Why SSE over WebSocket?** — V1 is server→client only (weather + alerts). SSE is simpler, auto-reconnects, works through HTTP/1.1 proxies.

4. **Accuracy limits** — SGP4 error grows with TLE age; pass times accurate to ~±1 minute with fresh TLEs.
