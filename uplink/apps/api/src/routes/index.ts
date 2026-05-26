import type { FastifyInstance } from "fastify";
import { ISS_NORAD_ID } from "@uplink/shared";
import { initDb } from "../db/index.js";
import {
  listSatellites,
  getSatellite,
  ensureTlesLoaded,
  getLastTleRefresh,
} from "../services/tle.js";
import {
  getPasses,
  getLookAngles,
  getSatellitePosition,
  getGroundTrack,
} from "../services/passes.js";
import {
  pollWeather,
  getCurrentWeather,
  getWeatherHistory,
  getActiveAlerts,
  getAlertHistory,
  getLastWeatherPoll,
} from "../services/weather.js";
import { searchGeocode } from "../services/geocode.js";
import { getObserverBrief } from "../services/observer.js";
import { streamHandler, initSseCallbacks, runTleRefreshWithNotify } from "./stream.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import cron from "node-cron";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadCities() {
  try {
    const citiesPath = path.join(__dirname, "../../../web/public/data/cities.json");
    return JSON.parse(readFileSync(citiesPath, "utf-8"));
  } catch {
    return [];
  }
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  initDb();
  initSseCallbacks();
  await ensureTlesLoaded();

  try {
    await pollWeather();
  } catch {
    app.log.warn("Initial weather poll failed — will retry on schedule");
  }

  const tleCron = process.env.TLE_REFRESH_CRON ?? "0 */6 * * *";
  cron.schedule(tleCron, () => {
    runTleRefreshWithNotify().catch((err) => app.log.error(err));
  });

  const weatherInterval = parseInt(process.env.WEATHER_POLL_INTERVAL_MS ?? "60000", 10);
  setInterval(() => {
    pollWeather().catch((err) => app.log.error(err));
  }, weatherInterval);

  app.get("/health", async () => {
    const tleRefresh = getLastTleRefresh();
    const tleAgeMinutes = tleRefresh
      ? Math.round((Date.now() - tleRefresh.getTime()) / 60000)
      : null;
    return {
      status: "ok" as const,
      tleAgeMinutes,
      lastWeatherPoll: getLastWeatherPoll()?.toISOString() ?? null,
    };
  });

  app.get("/v1/satellites", async () => listSatellites());

  app.get<{ Params: { noradId: string } }>("/v1/satellites/:noradId", async (req, reply) => {
    const noradId = parseInt(req.params.noradId, 10);
    const sat = await getSatellite(noradId);
    if (!sat) return reply.status(404).send({ error: "Satellite not found", code: "NOT_FOUND" });
    const position = await getSatellitePosition(noradId);
    return { ...sat, position };
  });

  app.get<{ Params: { noradId: string } }>(
    "/v1/satellites/:noradId/ground-track",
    async (req, reply) => {
      const noradId = parseInt(req.params.noradId, 10);
      const track = await getGroundTrack(noradId);
      if (track.length === 0) {
        return reply.status(404).send({ error: "Satellite not found", code: "NOT_FOUND" });
      }
      return { noradId, track };
    },
  );

  app.get<{
    Querystring: { noradId?: string; lat?: string; lon?: string; days?: string; minEl?: string };
  }>("/v1/passes", async (req, reply) => {
    const noradId = parseInt(req.query.noradId ?? String(ISS_NORAD_ID), 10);
    const lat = parseFloat(req.query.lat ?? "0");
    const lon = parseFloat(req.query.lon ?? "0");
    const days = parseInt(req.query.days ?? "7", 10);
    const minEl = parseFloat(req.query.minEl ?? "10");

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return reply.status(400).send({ error: "Invalid lat/lon", code: "BAD_REQUEST" });
    }

    const passes = await getPasses(noradId, lat, lon, days, minEl);
    return { noradId, lat, lon, passes };
  });

  app.get<{ Querystring: { lat?: string; lon?: string } }>("/v1/passes/iss", async (req, reply) => {
    const lat = parseFloat(req.query.lat ?? "25.2048");
    const lon = parseFloat(req.query.lon ?? "55.2708");
    const passes = await getPasses(ISS_NORAD_ID, lat, lon);
    return { noradId: ISS_NORAD_ID, lat, lon, passes };
  });

  app.get<{
    Querystring: { noradId?: string; lat?: string; lon?: string; at?: string };
  }>("/v1/look-angles", async (req, reply) => {
    const noradId = parseInt(req.query.noradId ?? String(ISS_NORAD_ID), 10);
    const lat = parseFloat(req.query.lat ?? "0");
    const lon = parseFloat(req.query.lon ?? "0");
    const look = await getLookAngles(noradId, lat, lon, req.query.at);
    if (!look) return reply.status(404).send({ error: "Not found", code: "NOT_FOUND" });
    return look;
  });

  app.get("/v1/weather/current", async () => {
    const current = getCurrentWeather();
    if (!current) {
      return pollWeather();
    }
    return current;
  });

  app.get<{ Querystring: { hours?: string } }>("/v1/weather/history", async (req) => {
    const hours = parseInt(req.query.hours ?? "24", 10);
    const rows = await getWeatherHistory(hours);
    return rows.map((r) => ({
      recordedAt: r.recorded_at,
      kp: r.kp,
      protonSpeed: r.proton_speed,
      bzGsm: r.bz_gsm,
      bt: r.bt,
    }));
  });

  app.get("/v1/alerts/active", async () => getActiveAlerts());
  app.get<{ Querystring: { days?: string } }>("/v1/alerts/history", async (req) => {
    const days = parseInt(req.query.days ?? "7", 10);
    return getAlertHistory(days);
  });

  app.get<{ Querystring: { q?: string } }>("/v1/geocode/search", async (req, reply) => {
    const q = req.query.q?.trim();
    if (!q) return reply.status(400).send({ error: "Query required", code: "BAD_REQUEST" });
    return searchGeocode(q);
  });

  app.get("/v1/cities", async () => loadCities());

  app.get<{ Querystring: { lat?: string; lon?: string; city?: string } }>(
    "/v1/observer/brief",
    async (req, reply) => {
      const lat = parseFloat(req.query.lat ?? "0");
      const lon = parseFloat(req.query.lon ?? "0");
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return reply.status(400).send({ error: "Invalid lat/lon", code: "BAD_REQUEST" });
      }
      return getObserverBrief(lat, lon, req.query.city);
    },
  );

  app.get("/v1/stream", streamHandler);
}
