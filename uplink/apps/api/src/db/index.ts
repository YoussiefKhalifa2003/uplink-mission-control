import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveDbPath(): string {
  const envUrl = process.env.DATABASE_URL;
  if (envUrl?.startsWith("file:")) {
    return envUrl.replace("file:", "");
  }
  return path.join(__dirname, "../../dev.db");
}

const dbPath = resolveDbPath();
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

export const sqlite = new DatabaseSync(dbPath);

export function initDb(): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS satellites (
      norad_id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      tle_line1 TEXT NOT NULL,
      tle_line2 TEXT NOT NULL,
      epoch TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      group_tag TEXT
    );
    CREATE TABLE IF NOT EXISTS space_weather_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recorded_at TEXT NOT NULL,
      kp REAL,
      proton_speed REAL,
      bz_gsm REAL,
      bt REAL,
      raw_json TEXT
    );
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_id TEXT NOT NULL,
      severity TEXT NOT NULL,
      message TEXT NOT NULL,
      comms_score INTEGER,
      fired_at TEXT NOT NULL,
      cleared_at TEXT
    );
    CREATE TABLE IF NOT EXISTS geocode_cache (
      query_key TEXT PRIMARY KEY,
      results_json TEXT NOT NULL,
      cached_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pass_cache (
      cache_key TEXT PRIMARY KEY,
      passes_json TEXT NOT NULL,
      computed_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
  `);
}

export function dbGet<T>(sql: string, ...params: (string | number | null)[]): T | undefined {
  return sqlite.prepare(sql).get(...params) as T | undefined;
}

export function dbAll<T>(sql: string, ...params: (string | number | null)[]): T[] {
  return sqlite.prepare(sql).all(...params) as T[];
}
