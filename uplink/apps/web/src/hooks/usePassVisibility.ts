import { useMemo } from "react";
import type { Pass } from "@uplink/shared";
import { useLiveClock } from "./useLiveClock";

/** Recomputes pass visibility flags every second from AOS/LOS timestamps. */
export function usePassVisibility(passes: Pass[]): Pass[] {
  const now = useLiveClock(1000);

  return useMemo(() => {
    const t = now.getTime();
    return passes.map((p) => ({
      ...p,
      isVisibleNow: t >= new Date(p.aos).getTime() && t <= new Date(p.los).getTime(),
    }));
  }, [passes, now]);
}
