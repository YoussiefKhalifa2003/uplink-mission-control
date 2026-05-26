import type { FastifyReply, FastifyRequest } from "fastify";
import { getCurrentWeather, setAlertCallback } from "../services/weather.js";
import { refreshTles } from "../services/tle.js";

interface SseClient {
  id: number;
  reply: FastifyReply;
}

let clientId = 0;
const clients = new Map<number, SseClient>();

function sendEvent(reply: FastifyReply, event: string, data: unknown, id?: string): void {
  if (id) reply.raw.write(`id: ${id}\n`);
  reply.raw.write(`event: ${event}\n`);
  reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function broadcast(event: string, data: unknown): void {
  for (const client of clients.values()) {
    sendEvent(client.reply, event, data);
  }
}

export function initSseCallbacks(): void {
  setAlertCallback((alert, type) => {
    if (alert.alertId === "weather") {
      const weather = getCurrentWeather();
      if (weather) broadcast("weather.update", weather);
      return;
    }
    broadcast(type === "fired" ? "alert.fired" : "alert.cleared", alert);
  });
}

export async function streamHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": process.env.CORS_ORIGIN ?? "*",
  });

  const id = ++clientId;
  clients.set(id, { id, reply });

  const weather = getCurrentWeather();
  if (weather) {
    sendEvent(reply, "weather.update", weather, "init");
  }

  request.raw.on("close", () => {
    clients.delete(id);
  });

  const keepAlive = setInterval(() => {
    reply.raw.write(": keepalive\n\n");
  }, 30000);

  request.raw.on("close", () => clearInterval(keepAlive));

  await new Promise<void>(() => {});
}

export function notifyTleRefreshed(count: number): void {
  broadcast("tle.refreshed", { count, at: new Date().toISOString() });
}

export async function runTleRefreshWithNotify(): Promise<number> {
  const count = await refreshTles();
  notifyTleRefreshed(count);
  return count;
}
