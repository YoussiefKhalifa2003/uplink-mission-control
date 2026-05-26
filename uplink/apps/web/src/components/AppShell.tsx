import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { api } from "../lib/api";
import { useUplinkStream } from "../hooks/useUplinkStream";
import { StatusBar } from "../features/weather/StatusBar";
import { GuidedTour } from "../features/ui/GuidedTour";
import { useUplinkStore, resolveObserverFromQuery } from "../stores/uplinkStore";
import styles from "./AppShell.module.css";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  useUplinkStream();
  const [searchParams] = useSearchParams();
  const setObserver = useUplinkStore((s) => s.setObserver);
  const observer = useUplinkStore((s) => s.observer);
  const toastMessage = useUplinkStore((s) => s.toastMessage);
  const setToastMessage = useUplinkStore((s) => s.setToastMessage);

  const { data: weather, isError: weatherError } = useQuery({
    queryKey: ["weather", "current"],
    queryFn: () => api.weatherCurrent(),
    refetchInterval: 60000,
    retry: 3,
  });

  const { data: cities = [] } = useQuery({
    queryKey: ["cities"],
    queryFn: () => api.cities(),
    staleTime: Infinity,
  });

  useEffect(() => {
    const cityParam = searchParams.get("city");
    if (!cityParam || cities.length === 0) return;
    const match = resolveObserverFromQuery(cities, cityParam);
    if (match) setObserver(match);
  }, [searchParams, cities, setObserver]);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 4000);
    return () => clearTimeout(t);
  }, [toastMessage, setToastMessage]);

  return (
    <div className={styles.shell}>
      <StatusBar weather={weather} observer={observer ?? undefined} />
      {weatherError ? (
        <div className={styles.apiWarning}>
          API unreachable — start the backend with <code>pnpm --filter @uplink/api dev</code>
        </div>
      ) : null}
      {toastMessage ? <div className={styles.toast}>{toastMessage}</div> : null}
      <main className={styles.main}>{children}</main>
      <GuidedTour />
    </div>
  );
}
