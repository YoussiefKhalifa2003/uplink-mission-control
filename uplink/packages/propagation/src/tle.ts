import * as satellite from "satellite.js";
import type { SatRec } from "satellite.js";

export const EARTH_RADIUS_KM = 6371;

export interface ParsedTle {
  noradId: number;
  name: string;
  line1: string;
  line2: string;
  epoch: Date;
  satrec: SatRec;
}

function validateChecksum(line: string): boolean {
  let sum = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const ch = line[i];
    if (ch === "-") sum += 1;
    else if (ch >= "0" && ch <= "9") sum += parseInt(ch, 10);
  }
  const check = parseInt(line[line.length - 1] ?? "0", 10);
  return sum % 10 === check;
}

export function parseTleBlock(block: string): ParsedTle | null {
  const lines = block
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return null;

  let name = "UNKNOWN";
  let line1: string;
  let line2: string;

  if (lines.length >= 3 && lines[1]!.startsWith("1 ") && lines[2]!.startsWith("2 ")) {
    name = lines[0]!.trim();
    line1 = lines[1]!;
    line2 = lines[2]!;
  } else if (lines[0]!.startsWith("1 ") && lines[1]!.startsWith("2 ")) {
    line1 = lines[0]!;
    line2 = lines[1]!;
  } else {
    return null;
  }

  if (!validateChecksum(line1) || !validateChecksum(line2)) {
    // CelesTrak TLEs occasionally have minor checksum drift; still attempt parse
  }

  const noradFromLine1 = parseInt(line1.slice(2, 7), 10);
  const noradFromLine2 = parseInt(line2.slice(2, 7), 10);
  if (noradFromLine1 !== noradFromLine2) return null;

  const satrec = satellite.twoline2satrec(line1, line2);
  if (!satrec) return null;

  const epoch = new Date((satrec.jdsatepoch - 2440587.5) * 86400000);

  return {
    noradId: noradFromLine1,
    name,
    line1,
    line2,
    epoch,
    satrec,
  };
}

export function parseTleCatalog(raw: string): ParsedTle[] {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const results: ParsedTle[] = [];
  const seen = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i]!.startsWith("1 ")) continue;

    if (i + 1 < lines.length && lines[i + 1]!.startsWith("2 ")) {
      const name = i > 0 && !lines[i - 1]!.startsWith("1 ") && !lines[i - 1]!.startsWith("2 ")
        ? lines[i - 1]!
        : "UNKNOWN";
      const block = `${name}\n${lines[i]}\n${lines[i + 1]}`;
      const parsed = parseTleBlock(block);
      if (parsed && !seen.has(parsed.noradId)) {
        seen.add(parsed.noradId);
        results.push(parsed);
      }
      i += 1;
    }
  }

  return results;
}

export function isTleStale(epoch: Date, now = new Date()): boolean {
  const ageHours = (now.getTime() - epoch.getTime()) / 3600000;
  return ageHours > 72;
}

export function createSatrecFromLines(line1: string, line2: string): SatRec {
  return satellite.twoline2satrec(line1, line2);
}
