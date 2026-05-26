# UPLINK API Reference

Base URL: `http://localhost:3001` (dev) / `https://api.uplink.app` (prod)

## Health

```
GET /health
→ { status: "ok", tleAgeMinutes: number | null, lastWeatherPoll: string | null }
```

## Satellites

```
GET /v1/satellites
→ Satellite[]

GET /v1/satellites/:noradId
→ Satellite & { position?: Position }

GET /v1/satellites/:noradId/ground-track
→ { noradId, track: [lat, lng, alt][] }
```

## Passes

```
GET /v1/passes?noradId=25544&lat=25.2&lon=55.3&days=7&minEl=10
→ { noradId, lat, lon, passes: Pass[] }

GET /v1/passes/iss?lat=25.2&lon=55.3
→ { noradId: 25544, lat, lon, passes: Pass[] }
```

## Look Angles

```
GET /v1/look-angles?noradId=25544&lat=25.2&lon=55.3&at=ISO8601
→ { azimuthDeg, elevationDeg, rangeKm, timestamp }
```

## Weather

```
GET /v1/weather/current
→ { kp, protonSpeed, bzGsm, bt, commsScore, recordedAt }

GET /v1/weather/history?hours=24
→ WeatherSnapshot[]
```

## Alerts

```
GET /v1/alerts/active
→ Alert[]

GET /v1/alerts/history?days=7
→ Alert[]
```

## Geocoding

```
GET /v1/geocode/search?q=dubai
→ GeocodeResult[]

GET /v1/cities
→ City[]
```

## SSE Stream

```
GET /v1/stream
Events: weather.update | alert.fired | alert.cleared | tle.refreshed
```

Errors: `{ error: string, code: string }` with appropriate HTTP status.
