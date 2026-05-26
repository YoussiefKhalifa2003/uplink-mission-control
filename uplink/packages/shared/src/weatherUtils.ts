export function kpToGScale(kp: number | null): number {
  if (kp === null) return 0;
  if (kp >= 9) return 5;
  if (kp >= 8) return 4;
  if (kp >= 7) return 3;
  if (kp >= 6) return 2;
  if (kp >= 5) return 1;
  return 0;
}

export function kpStormLabel(kp: number | null): string {
  if (kp === null) return "Unknown";
  if (kp >= 9) return "Extreme (G5)";
  if (kp >= 8) return "Severe (G4)";
  if (kp >= 7) return "Strong (G3)";
  if (kp >= 6) return "Moderate (G2)";
  if (kp >= 5) return "Minor (G1)";
  if (kp >= 4) return "Active";
  if (kp >= 3) return "Unsettled";
  return "Quiet";
}

/** NOAA S-scale from GOES >=10 MeV proton flux (pfu). */
export function protonFluxToSScale(flux10MeV: number | null): number {
  if (flux10MeV === null) return 0;
  if (flux10MeV >= 100000) return 5;
  if (flux10MeV >= 10000) return 4;
  if (flux10MeV >= 1000) return 3;
  if (flux10MeV >= 100) return 2;
  if (flux10MeV >= 10) return 1;
  return 0;
}

/** NOAA R-scale from current X-ray class string (e.g. C1.0, M2.3, X1.1). */
export function xrayClassToRScale(xrayClass: string | null): number {
  if (!xrayClass) return 0;
  const match = xrayClass.match(/^([A-Z])(\d+(?:\.\d+)?)/i);
  if (!match) return 0;
  const band = match[1]!.toUpperCase();
  const value = parseFloat(match[2]!);
  if (band === "X") {
    if (value >= 10) return 5;
    if (value >= 1) return 3;
    return 2;
  }
  if (band === "M") {
    if (value >= 5) return 2;
    return 1;
  }
  return 0;
}

export function formatAge(iso: string | undefined, nowMs = Date.now()): string {
  if (!iso) return "—";
  const sec = Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 1000));
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}
