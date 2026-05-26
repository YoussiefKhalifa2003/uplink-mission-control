import { lazy, Suspense, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useUplinkStore, getDefaultObserver } from "../stores/uplinkStore";
import { ObserverPanel } from "../features/observer/ObserverPanel";
import { AlertBanner, AlertTicker } from "../features/alerts/AlertBanner";
import { ISS_NORAD_ID } from "@uplink/shared";
import type { City } from "@uplink/shared";
import styles from "./MissionControl.module.css";

const GlobeView = lazy(() =>
  import("../features/globe/GlobeView").then((m) => ({ default: m.GlobeView })),
);

export function MissionControlPage() {
  const queryClient = useQueryClient();

  const observer = useUplinkStore((s) => s.observer) ?? getDefaultObserver();
  const selectedNoradId = useUplinkStore((s) => s.selectedNoradId);
  const alerts = useUplinkStore((s) => s.alerts);
  const commsScore = useUplinkStore((s) => s.commsScore);
  const liveLookAngles = useUplinkStore((s) => s.liveLookAngles);
  const propagationTickAt = useUplinkStore((s) => s.propagationTickAt);
  const setObserver = useUplinkStore((s) => s.setObserver);

  const { data: weather } = useQuery({
    queryKey: ["weather", "current"],
    queryFn: () => api.weatherCurrent(),
    refetchInterval: 60000,
  });

  const { data: satellites = [] } = useQuery({
    queryKey: ["satellites"],
    queryFn: () => api.satellites(),
    staleTime: 300000,
  });

  const { data: cities = [] } = useQuery({
    queryKey: ["cities"],
    queryFn: () => api.cities(),
    staleTime: Infinity,
  });

  const observerLat = observer.lat;
  const observerLon = observer.lon;

  const {
    data: passData,
    isLoading: passesLoading,
    isFetching: passesFetching,
    dataUpdatedAt: passesUpdatedAt,
  } = useQuery({
    queryKey: ["passes", ISS_NORAD_ID, observerLat, observerLon],
    queryFn: () => api.issPasses(observerLat, observerLon),
    enabled: !!observer,
    staleTime: 0,
    refetchInterval: 60000,
  });

  const selectedSat = satellites.find((s) => s.noradId === selectedNoradId);

  const handleSelectCity = useCallback(
    (city: City) => {
      setObserver(city);
      void queryClient.invalidateQueries({ queryKey: ["passes"] });
      void queryClient.invalidateQueries({ queryKey: ["observer", "brief"] });
    },
    [setObserver, queryClient],
  );

  const handleSearch = async (query: string) => {
    const geo = await api.geocode(query);
    return geo.map((g, i) => ({
      id: `geo-${g.lat.toFixed(4)}-${g.lon.toFixed(4)}-${i}`,
      name: g.displayName.split(",")[0] ?? g.displayName,
      country: g.displayName.split(",").slice(-1)[0]?.trim() ?? "",
      lat: g.lat,
      lon: g.lon,
      timezone: "UTC",
    })) as City[];
  };

  const trackingAngles =
    liveLookAngles?.noradId === selectedNoradId ? liveLookAngles : undefined;

  return (
    <div className={styles.layout}>
      <AlertBanner alerts={alerts} />
      <div className={styles.main}>
        <div className={styles.globeArea}>
          <Suspense fallback={<div className={styles.globeLoading}>Initializing globe...</div>}>
            <GlobeView satellites={satellites} commsScore={weather?.commsScore ?? commsScore} />
          </Suspense>
        </div>
        <ObserverPanel
          cities={cities}
          observer={observer}
          onSelectCity={handleSelectCity}
          onSearch={handleSearch}
          passes={passData?.passes ?? []}
          passesLoading={passesLoading || passesFetching}
          passesUpdatedAt={passesUpdatedAt}
          selectedSat={selectedSat}
          lookAngles={trackingAngles ?? undefined}
          propagationTickAt={propagationTickAt}
        />
      </div>
      <AlertTicker alerts={alerts} />
    </div>
  );
}
