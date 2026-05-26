import { create } from "zustand";
import type { City, Alert, LookAngles } from "@uplink/shared";
import { ISS_NORAD_ID } from "@uplink/shared";

export interface OverheadSat {
  noradId: number;
  name: string;
  elevationDeg: number;
  azimuthDeg: number;
  rangeKm: number;
}

interface LiveLookAngles extends LookAngles {
  noradId: number;
}

interface UplinkState {
  observer: City | null;
  selectedNoradId: number;
  alerts: Alert[];
  commsScore: number;
  live: boolean;
  liveLookAngles: LiveLookAngles | null;
  propagationTickAt: string | null;
  weatherPulseAt: number | null;
  overheadSats: OverheadSat[];
  globeAltitude: number;
  toastMessage: string | null;
  flyToObserverSeq: number;
  flyToSatelliteSeq: number;
  setObserver: (city: City) => void;
  setSelectedNoradId: (id: number) => void;
  requestFlyToObserver: () => void;
  requestFlyToSatellite: () => void;
  setAlerts: (alerts: Alert[]) => void;
  addAlert: (alert: Alert) => void;
  setCommsScore: (score: number) => void;
  setLive: (live: boolean) => void;
  setLiveLookAngles: (look: LiveLookAngles | null) => void;
  setPropagationTickAt: (iso: string) => void;
  setWeatherPulseAt: (ts: number) => void;
  setOverheadSats: (sats: OverheadSat[]) => void;
  setGlobeAltitude: (alt: number) => void;
  setToastMessage: (msg: string | null) => void;
}

const OBSERVER_STORAGE_KEY = "uplink_observer";

export function getDefaultObserver(): City {
  return {
    id: "dubai",
    name: "Dubai",
    country: "UAE",
    lat: 25.2048,
    lon: 55.2708,
    timezone: "Asia/Dubai",
  };
}

function loadStoredObserver(): City {
  try {
    const raw = sessionStorage.getItem(OBSERVER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as City;
      if (
        typeof parsed.lat === "number" &&
        typeof parsed.lon === "number" &&
        typeof parsed.name === "string" &&
        typeof parsed.id === "string"
      ) {
        return parsed;
      }
    }
  } catch {
    /* ignore */
  }
  return getDefaultObserver();
}

function persistObserver(city: City) {
  try {
    sessionStorage.setItem(OBSERVER_STORAGE_KEY, JSON.stringify(city));
  } catch {
    /* ignore */
  }
}

export const useUplinkStore = create<UplinkState>((set) => ({
  observer: loadStoredObserver(),
  selectedNoradId: ISS_NORAD_ID,
  alerts: [],
  commsScore: 0,
  live: false,
  liveLookAngles: null,
  propagationTickAt: null,
  weatherPulseAt: null,
  overheadSats: [],
  globeAltitude: 2.5,
  toastMessage: null,
  flyToObserverSeq: 0,
  flyToSatelliteSeq: 0,
  setObserver: (city) => {
    persistObserver(city);
    set((s) => ({ observer: city, flyToObserverSeq: s.flyToObserverSeq + 1 }));
  },
  setSelectedNoradId: (id) => set({ selectedNoradId: id }),
  requestFlyToObserver: () => set((s) => ({ flyToObserverSeq: s.flyToObserverSeq + 1 })),
  requestFlyToSatellite: () => set((s) => ({ flyToSatelliteSeq: s.flyToSatelliteSeq + 1 })),
  setAlerts: (alerts) => set({ alerts }),
  addAlert: (alert) =>
    set((s) => ({
      alerts: alert.alertId === "weather" ? s.alerts : [alert, ...s.alerts].slice(0, 20),
    })),
  setCommsScore: (score) => set({ commsScore: score }),
  setLive: (live) => set({ live }),
  setLiveLookAngles: (look) => set({ liveLookAngles: look }),
  setPropagationTickAt: (iso) => set({ propagationTickAt: iso }),
  setWeatherPulseAt: (ts) => set({ weatherPulseAt: ts }),
  setOverheadSats: (sats) => set({ overheadSats: sats }),
  setGlobeAltitude: (alt) => set({ globeAltitude: alt }),
  setToastMessage: (msg) => set({ toastMessage: msg }),
}));

export function resolveObserverFromQuery(cities: City[], citySlug: string | null): City | null {
  if (!citySlug) return null;
  const normalized = citySlug.toLowerCase();
  return (
    cities.find((c) => c.id.toLowerCase() === normalized) ??
    cities.find((c) => c.name.toLowerCase().replace(/\s+/g, "-") === normalized) ??
    null
  );
}
