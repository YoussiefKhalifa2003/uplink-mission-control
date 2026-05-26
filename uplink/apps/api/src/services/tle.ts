import { sqlite, dbGet, dbAll } from "../db/index.js";
import { parseTleCatalog, isTleStale } from "@uplink/propagation";
import type { Satellite } from "@uplink/shared";

const TLE_GROUPS = [
  { tag: "stations", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=TLE" },
  { tag: "visual", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=TLE" },
  { tag: "weather", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=weather&FORMAT=TLE" },
  { tag: "resource", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=resource&FORMAT=TLE" },
];

const ISS_FALLBACK_URL =
  "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE";

const MAX_SATELLITES = 40;

let lastTleRefresh: Date | null = null;

export function getLastTleRefresh(): Date | null {
  return lastTleRefresh;
}

async function fetchTleText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

interface SatelliteRow {
  norad_id: number;
  name: string;
  tle_line1: string;
  tle_line2: string;
  epoch: string;
  fetched_at: string;
  group_tag: string | null;
}

function rowToSatellite(row: SatelliteRow): Satellite {
  return {
    noradId: row.norad_id,
    name: row.name,
    tleLine1: row.tle_line1,
    tleLine2: row.tle_line2,
    epoch: row.epoch,
    fetchedAt: row.fetched_at,
    groupTag: row.group_tag ?? undefined,
    stale: isTleStale(new Date(row.epoch)),
  };
}

export async function refreshTles(): Promise<number> {
  const allParsed = new Map<
    number,
    { name: string; line1: string; line2: string; epoch: Date; groupTag: string }
  >();

  for (const group of TLE_GROUPS) {
    const text = await fetchTleText(group.url);
    if (!text) continue;
    for (const tle of parseTleCatalog(text)) {
      if (!allParsed.has(tle.noradId)) {
        allParsed.set(tle.noradId, {
          name: tle.name,
          line1: tle.line1,
          line2: tle.line2,
          epoch: tle.epoch,
          groupTag: group.tag,
        });
      }
    }
  }

  if (!allParsed.has(25544)) {
    const issText = await fetchTleText(ISS_FALLBACK_URL);
    if (issText) {
      for (const tle of parseTleCatalog(issText)) {
        allParsed.set(tle.noradId, {
          name: tle.name,
          line1: tle.line1,
          line2: tle.line2,
          epoch: tle.epoch,
          groupTag: "stations",
        });
      }
    }
  }

  const entries = Array.from(allParsed.entries()).slice(0, MAX_SATELLITES);
  const now = new Date().toISOString();

  const upsert = sqlite.prepare(`
    INSERT INTO satellites (norad_id, name, tle_line1, tle_line2, epoch, fetched_at, group_tag)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(norad_id) DO UPDATE SET
      name = excluded.name,
      tle_line1 = excluded.tle_line1,
      tle_line2 = excluded.tle_line2,
      epoch = excluded.epoch,
      fetched_at = excluded.fetched_at,
      group_tag = excluded.group_tag
  `);

  for (const [noradId, data] of entries) {
    upsert.run(
      noradId,
      data.name,
      data.line1,
      data.line2,
      data.epoch.toISOString(),
      now,
      data.groupTag,
    );
  }

  lastTleRefresh = new Date();
  return entries.length;
}

export async function listSatellites(): Promise<Satellite[]> {
  const rows = dbAll<SatelliteRow>("SELECT * FROM satellites");
  return rows.map(rowToSatellite);
}

export async function getSatellite(noradId: number): Promise<Satellite | null> {
  const row = dbGet<SatelliteRow>("SELECT * FROM satellites WHERE norad_id = ?", noradId);
  return row ? rowToSatellite(row) : null;
}

export async function ensureTlesLoaded(): Promise<void> {
  const row = dbGet<{ c: number }>("SELECT COUNT(*) as c FROM satellites");
  if (!row || row.c === 0) {
    await refreshTles();
  }
}
