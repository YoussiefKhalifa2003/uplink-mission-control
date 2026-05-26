import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSseUrl } from "../lib/api";
import { useUplinkStore } from "../stores/uplinkStore";
import type { Alert, WeatherCurrent } from "@uplink/shared";

export function useUplinkStream(): void {
  const queryClient = useQueryClient();
  const setCommsScore = useUplinkStore((s) => s.setCommsScore);
  const addAlert = useUplinkStore((s) => s.addAlert);
  const setLive = useUplinkStore((s) => s.setLive);
  const setWeatherPulseAt = useUplinkStore((s) => s.setWeatherPulseAt);

  useEffect(() => {
    const url = getSseUrl();
    let es: EventSource | null = new EventSource(url);

    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);

    es.addEventListener("weather.update", (ev) => {
      const data = JSON.parse(ev.data) as WeatherCurrent;
      queryClient.setQueryData(["weather", "current"], data);
      queryClient.invalidateQueries({ queryKey: ["weather", "history"] });
      queryClient.invalidateQueries({ queryKey: ["observer", "brief"] });
      setCommsScore(data.commsScore);
      setWeatherPulseAt(Date.now());
    });

    es.addEventListener("alert.fired", (ev) => {
      const data = JSON.parse(ev.data) as Alert;
      if (data.alertId !== "weather") addAlert(data);
    });

    es.addEventListener("alert.cleared", () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    });

    es.addEventListener("tle.refreshed", () => {
      queryClient.invalidateQueries({ queryKey: ["satellites"] });
      queryClient.invalidateQueries({ queryKey: ["passes"] });
      queryClient.invalidateQueries({ queryKey: ["observer", "brief"] });
    });

    return () => {
      es?.close();
      es = null;
      setLive(false);
    };
  }, [queryClient, setCommsScore, addAlert, setLive, setWeatherPulseAt]);
}
