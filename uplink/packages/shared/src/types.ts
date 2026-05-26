import { z } from "zod";

export const ObserverSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  elevationM: z.number().default(0),
});

export type Observer = z.infer<typeof ObserverSchema>;

export const SatelliteSchema = z.object({
  noradId: z.number(),
  name: z.string(),
  tleLine1: z.string(),
  tleLine2: z.string(),
  epoch: z.string(),
  fetchedAt: z.string(),
  groupTag: z.string().optional(),
  stale: z.boolean().optional(),
});

export type Satellite = z.infer<typeof SatelliteSchema>;

export const PositionSchema = z.object({
  noradId: z.number(),
  lat: z.number(),
  lng: z.number(),
  alt: z.number(),
  velocityKms: z.number().optional(),
  timestamp: z.string(),
});

export type Position = z.infer<typeof PositionSchema>;

export const PassSchema = z.object({
  noradId: z.number(),
  aos: z.string(),
  los: z.string(),
  durationSec: z.number(),
  maxElevationDeg: z.number(),
  maxElevationTime: z.string(),
  isVisibleNow: z.boolean().optional(),
});

export type Pass = z.infer<typeof PassSchema>;

export const LookAnglesSchema = z.object({
  azimuthDeg: z.number(),
  elevationDeg: z.number(),
  rangeKm: z.number(),
  timestamp: z.string(),
  visible: z.boolean().optional(),
  observerLat: z.number().optional(),
  observerLon: z.number().optional(),
});

export type LookAngles = z.infer<typeof LookAnglesSchema>;

export const AlertSeveritySchema = z.enum(["INFO", "WARNING", "CRITICAL"]);
export type AlertSeverity = z.infer<typeof AlertSeveritySchema>;

export const AlertSchema = z.object({
  id: z.number().optional(),
  alertId: z.string(),
  severity: AlertSeveritySchema,
  message: z.string(),
  commsScore: z.number().optional(),
  firedAt: z.string(),
  clearedAt: z.string().nullable().optional(),
});

export type Alert = z.infer<typeof AlertSchema>;

export const KpForecastPointSchema = z.object({
  time: z.string(),
  kp: z.number(),
  kind: z.enum(["observed", "estimated", "predicted"]),
  noaaScale: z.string().nullable().optional(),
});

export type KpForecastPoint = z.infer<typeof KpForecastPointSchema>;

export const SpaceWeatherEventSchema = z.object({
  type: z.string(),
  begin: z.string(),
  peak: z.string().nullable().optional(),
  end: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

export type SpaceWeatherEvent = z.infer<typeof SpaceWeatherEventSchema>;

export const WeatherCurrentSchema = z.object({
  kp: z.number().nullable(),
  protonSpeed: z.number().nullable(),
  bzGsm: z.number().nullable(),
  bt: z.number().nullable(),
  commsScore: z.number(),
  recordedAt: z.string(),
  // Solar wind plasma
  protonDensity: z.number().nullable().optional(),
  protonTemperature: z.number().nullable().optional(),
  windSource: z.string().nullable().optional(),
  windTimeTag: z.string().nullable().optional(),
  // IMF vector (GSM)
  bxGsm: z.number().nullable().optional(),
  byGsm: z.number().nullable().optional(),
  lonGsm: z.number().nullable().optional(),
  latGsm: z.number().nullable().optional(),
  magSource: z.string().nullable().optional(),
  magTimeTag: z.string().nullable().optional(),
  // GOES particle & X-ray
  xrayClass: z.string().nullable().optional(),
  xrayFluxLong: z.number().nullable().optional(),
  xrayFluxRatio: z.number().nullable().optional(),
  protonFlux1MeV: z.number().nullable().optional(),
  protonFlux10MeV: z.number().nullable().optional(),
  protonFlux100MeV: z.number().nullable().optional(),
  electronFlux2MeV: z.number().nullable().optional(),
  // Solar indices
  f107: z.number().nullable().optional(),
  f107_90dayMean: z.number().nullable().optional(),
  // Storm scales
  gScale: z.number().optional(),
  sScale: z.number().optional(),
  rScale: z.number().optional(),
  kpStormLabel: z.string().optional(),
  // Forecast & events
  kpForecast: z.array(KpForecastPointSchema).optional(),
  recentEvents: z.array(SpaceWeatherEventSchema).optional(),
  // Aurora (OVATION)
  auroraPowerMax: z.number().nullable().optional(),
  auroraObservationTime: z.string().nullable().optional(),
});

export type WeatherCurrent = z.infer<typeof WeatherCurrentSchema>;

export const WeatherSnapshotSchema = z.object({
  id: z.number().optional(),
  recordedAt: z.string(),
  kp: z.number().nullable(),
  protonSpeed: z.number().nullable(),
  bzGsm: z.number().nullable(),
  bt: z.number().nullable(),
});

export type WeatherSnapshot = z.infer<typeof WeatherSnapshotSchema>;

export const CitySchema = z.object({
  id: z.string(),
  name: z.string(),
  country: z.string(),
  lat: z.number(),
  lon: z.number(),
  timezone: z.string(),
});

export type City = z.infer<typeof CitySchema>;

export const GeocodeResultSchema = z.object({
  displayName: z.string(),
  lat: z.number(),
  lon: z.number(),
});

export type GeocodeResult = z.infer<typeof GeocodeResultSchema>;

export const GroundTrackPointSchema = z.tuple([z.number(), z.number(), z.number()]);
export type GroundTrackPoint = z.infer<typeof GroundTrackPointSchema>;

export const SseEventTypeSchema = z.enum([
  "weather.update",
  "alert.fired",
  "alert.cleared",
  "tle.refreshed",
]);

export type SseEventType = z.infer<typeof SseEventTypeSchema>;

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  tleAgeMinutes: z.number().nullable(),
  lastWeatherPoll: z.string().nullable(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const ObserverBriefSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  nextIssPass: PassSchema.nullable(),
  passesNext24h: z.number(),
  auroraProbability: z.number().nullable(),
  sunElevationDeg: z.number(),
  overheadCount: z.number(),
  issLookAngles: LookAnglesSchema.nullable().optional(),
  briefing: z.string(),
});

export type ObserverBrief = z.infer<typeof ObserverBriefSchema>;

export const ISS_NORAD_ID = 25544;

export function computeCommsScore(
  kp: number | null,
  protonSpeed: number | null,
  bzGsm: number | null,
): number {
  let score = 0;
  if (kp !== null) score += kp * 8;
  if (protonSpeed !== null && protonSpeed > 500) score += 15;
  if (bzGsm !== null && bzGsm < -5) score += 20;
  return Math.min(100, Math.max(0, Math.round(score)));
}
