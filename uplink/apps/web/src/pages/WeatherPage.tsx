import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useLiveClock } from "../hooks/useLiveClock";
import { useUplinkStore, getDefaultObserver } from "../stores/uplinkStore";
import { formatAge } from "@uplink/shared";
import { DataScopeBadge, GlobalMetricHelp } from "../features/ui/DataScopeBadge";
import { WeatherLocalImpact } from "../features/weather/WeatherLocalImpact";
import styles from "./WeatherPage.module.css";



export function WeatherPage() {

  const live = useUplinkStore((s) => s.live);
  const observer = useUplinkStore((s) => s.observer) ?? getDefaultObserver();
  const setObserver = useUplinkStore((s) => s.setObserver);
  const weatherPulseAt = useUplinkStore((s) => s.weatherPulseAt);

  const now = useLiveClock(1000);



  const { data: current } = useQuery({

    queryKey: ["weather", "current"],

    queryFn: () => api.weatherCurrent(),

    refetchInterval: 60000,

  });



  const { data: history = [] } = useQuery({

    queryKey: ["weather", "history"],

    queryFn: () => api.weatherHistory(24),

  });



  const { data: alerts = [] } = useQuery({

    queryKey: ["alerts", "active"],

    queryFn: () => api.alertsActive(),

    refetchInterval: 60000,

  });

  const { data: cities = [] } = useQuery({
    queryKey: ["cities"],
    queryFn: () => api.cities(),
    staleTime: Infinity,
  });



  const maxKp = Math.max(...history.map((h) => h.kp ?? 0), 1);

  const maxWind = Math.max(...history.map((h) => h.protonSpeed ?? 0), 1);

  const pulseClass = weatherPulseAt && Date.now() - weatherPulseAt < 1500 ? styles.pulse : "";



  return (

    <div className={styles.page}>

      <header className={styles.header}>

        <div className={styles.headerRow}>

          <div>

            <h1>Space Weather Operations</h1>

            <p className={styles.sub}>

              NOAA SWPC live feed · {live ? "Streaming" : "Polling"} ·{" "}

              {current?.recordedAt ? `Last update ${formatAge(current.recordedAt, now.getTime())}` : "Loading…"}

            </p>

          </div>

          <div className={styles.headerBadges}>
            <DataScopeBadge scope="global" />
            <div className={`${styles.streamBadge} ${live ? styles.streamLive : ""}`}>

              {live ? "● LIVE SSE" : "○ OFFLINE"}

            </div>
          </div>

        </div>

      </header>



      <div className={styles.split}>

        <div className={styles.globalColumn}>

      {current ? (

        <>

          <section className={styles.hero}>

            <HeroCard label="Planetary K-index (global)" value={fmt(current.kp, 1)} detail={current.kpStormLabel ?? "—"} pulseClass={pulseClass} />

            <HeroCard label="G-Scale (global)" value={String(current.gScale ?? 0)} detail={gScaleLabel(current.gScale ?? 0)} pulseClass={pulseClass} />

            <HeroCard label="S-Scale (global)" value={String(current.sScale ?? 0)} detail={sScaleLabel(current.sScale ?? 0)} pulseClass={pulseClass} />

            <HeroCard label="R-Scale (global)" value={String(current.rScale ?? 0)} detail={rScaleLabel(current.rScale ?? 0)} pulseClass={pulseClass} />

            <HeroCard

              label="Comms degradation (global model)"

              value={`${current.commsScore}%`}

              detail={`${100 - current.commsScore}% link health`}

              critical={current.commsScore > 60}
              pulseClass={pulseClass}

            />

          </section>

          <GlobalMetricHelp />



          <Section title="Solar Wind Plasma (ACE/DSCOVR L1)" badge="global">

            <Grid>

              <DataCell label="Proton speed" value={current.protonSpeed != null ? `${Math.round(current.protonSpeed)} km/s` : "—"} source={current.windSource} time={current.windTimeTag} />

              <DataCell label="Proton density" value={current.protonDensity != null ? `${current.protonDensity.toFixed(2)} p/cm³` : "—"} />

              <DataCell label="Proton temperature" value={current.protonTemperature != null ? `${Math.round(current.protonTemperature).toLocaleString()} K` : "—"} />

              <DataCell label="Dynamic pressure est." value={dynamicPressure(current.protonSpeed, current.protonDensity)} />

            </Grid>

          </Section>



          <Section title="Interplanetary Magnetic Field (IMF GSM)">

            <Grid>

              <DataCell label="Btotal (Bt)" value={fmtNt(current.bt)} />

              <DataCell label="Bx GSM" value={fmtNt(current.bxGsm)} />

              <DataCell label="By GSM" value={fmtNt(current.byGsm)} />

              <DataCell label="Bz GSM" value={fmtNt(current.bzGsm)} highlight={current.bzGsm != null && current.bzGsm < -5 ? "warn" : undefined} />

              <DataCell label="Clock angle (φ)" value={current.lonGsm != null ? `${current.lonGsm.toFixed(1)}°` : "—"} />

              <DataCell label="Lat angle (θ)" value={current.latGsm != null ? `${current.latGsm.toFixed(1)}°` : "—"} source={current.magSource} time={current.magTimeTag} />

            </Grid>

          </Section>



          <Section title="GOES Space Environment">

            <Grid>

              <DataCell label="X-ray class (1–8 Å)" value={current.xrayClass ?? "—"} />

              <DataCell label="X-ray flux (long)" value={current.xrayFluxLong != null ? current.xrayFluxLong.toExponential(2) : "—"} />

              <DataCell label="X-ray flux ratio" value={current.xrayFluxRatio != null ? current.xrayFluxRatio.toFixed(3) : "—"} />

              <DataCell label="Protons ≥1 MeV" value={fmtFlux(current.protonFlux1MeV)} />

              <DataCell label="Protons ≥10 MeV" value={fmtFlux(current.protonFlux10MeV)} highlight={current.sScale != null && current.sScale >= 1 ? "warn" : undefined} />

              <DataCell label="Protons ≥100 MeV" value={fmtFlux(current.protonFlux100MeV)} />

              <DataCell label="Electrons ≥2 MeV" value={fmtFlux(current.electronFlux2MeV)} />

            </Grid>

          </Section>



          <Section title="Solar Indices">

            <Grid>

              <DataCell label="F10.7 cm flux" value={current.f107 != null ? `${current.f107.toFixed(1)} sfu` : "—"} />

              <DataCell label="F10.7 90-day mean" value={current.f107_90dayMean != null ? `${current.f107_90dayMean.toFixed(1)} sfu` : "—"} />

              <DataCell label="Aurora max power (OVATION)" value={current.auroraPowerMax != null ? `${current.auroraPowerMax} GW` : "—"} />

              <DataCell label="Aurora observation" value={current.auroraObservationTime ? new Date(current.auroraObservationTime).toLocaleString() : "—"} />

            </Grid>

          </Section>



          {(current.kpForecast?.length ?? 0) > 0 && (

            <Section title="Kp Forecast (NOAA)">

              <div className={styles.forecastRow}>

                {current.kpForecast!.slice(-12).map((f) => (

                  <div key={f.time} className={styles.forecastCell} title={f.time}>

                    <span className={styles.forecastKp}>{f.kp.toFixed(1)}</span>

                    <span className={styles.forecastTime}>{new Date(f.time).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit" })}</span>

                    <span className={styles.forecastKind}>{f.kind}</span>

                  </div>

                ))}

              </div>

            </Section>

          )}



          <div className={styles.chartGrid}>

            <ChartSection title="Kp — Last 24 Hours" history={history} field="kp" max={maxKp} unit="" />

            <ChartSection title="Solar Wind Speed — Last 24 Hours" history={history} field="protonSpeed" max={maxWind} unit=" km/s" />

            <ChartSection title="Bz IMF — Last 24 Hours" history={history} field="bzGsm" max={Math.max(...history.map((h) => Math.abs(h.bzGsm ?? 0)), 1)} unit=" nT" signed />

          </div>



          {(current.recentEvents?.length ?? 0) > 0 && (

            <Section title="Recent SWPC Events (7 days)">

              <ul className={styles.eventList}>

                {current.recentEvents!.map((ev, i) => (

                  <li key={`${ev.type}-${ev.begin}-${i}`}>

                    <span className={styles.eventType}>{ev.type}</span>

                    <span className={styles.eventTime}>{new Date(ev.begin).toLocaleString()}</span>

                    {ev.location ? <span className={styles.eventLoc}>{ev.location}</span> : null}

                  </li>

                ))}

              </ul>

            </Section>

          )}



          {alerts.length > 0 && (

            <Section title="Active Alerts">

              <ul className={styles.alertList}>

                {alerts.map((a) => (

                  <li key={a.id ?? a.alertId} className={styles[`alert_${a.severity}`]}>

                    <span className={styles.alertSev}>{a.severity}</span>

                    <span>{a.message}</span>

                    <span className={styles.alertTime}>{new Date(a.firedAt).toLocaleString()}</span>

                  </li>

                ))}

              </ul>

            </Section>

          )}



          <Section title="Comms Impact Model">

            <div className={styles.commsBreakdown}>

              <CommsFactor label="Kp contribution" value={current.kp != null ? current.kp * 8 : 0} max={72} />

              <CommsFactor label="Solar wind >500 km/s" value={current.protonSpeed != null && current.protonSpeed > 500 ? 15 : 0} max={15} />

              <CommsFactor label="Southward Bz < −5 nT" value={current.bzGsm != null && current.bzGsm < -5 ? 20 : 0} max={20} />

              <div className={styles.commsTotal}>

                Total degradation score: <strong>{current.commsScore}%</strong>

              </div>

            </div>

          </Section>

        </>

      ) : (

        <div className={styles.loading}>Loading NOAA space weather data…</div>

      )}

        </div>

        <WeatherLocalImpact
          observer={observer}
          cities={cities}
          weather={current}
          onSelectCity={setObserver}
        />

      </div>

    </div>

  );

}



function Section({ title, children, badge }: { title: string; children: ReactNode; badge?: "global" }) {

  return (

    <section className={styles.section}>

      <div className={styles.sectionTitleRow}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {badge === "global" ? <DataScopeBadge scope="global" /> : null}
      </div>

      {children}

    </section>

  );

}



function Grid({ children }: { children: ReactNode }) {

  return <div className={styles.grid}>{children}</div>;

}



function HeroCard({

  label,

  value,

  detail,

  critical,

  pulseClass,

}: {

  label: string;

  value: string;

  detail: string;

  critical?: boolean;

  pulseClass?: string;

}) {

  return (

    <div className={`${styles.heroCard} ${critical ? styles.heroCritical : ""}`}>

      <span className={styles.heroLabel}>{label}</span>

      <span className={`${styles.heroValue} ${pulseClass ?? ""}`}>{value}</span>

      <span className={styles.heroDetail}>{detail}</span>

    </div>

  );

}



function DataCell({

  label,

  value,

  source,

  time,

  highlight,

}: {

  label: string;

  value: string;

  source?: string | null;

  time?: string | null;

  highlight?: "warn";

}) {

  return (

    <div className={`${styles.cell} ${highlight === "warn" ? styles.cellWarn : ""}`}>

      <span className={styles.cellLabel}>{label}</span>

      <span className={styles.cellValue}>{value}</span>

      {source || time ? (

        <span className={styles.cellMeta}>

          {[source, time ? new Date(time).toLocaleTimeString() : null].filter(Boolean).join(" · ")}

        </span>

      ) : null}

    </div>

  );

}



function ChartSection({

  title,

  history,

  field,

  max,

  unit,

  signed,

}: {

  title: string;

  history: Array<Record<string, unknown>>;

  field: string;

  max: number;

  unit: string;

  signed?: boolean;

}) {

  return (

    <section className={styles.chartSection}>

      <h2>{title}</h2>

      <div className={styles.chart}>

        {[...history].reverse().map((h, i) => {

          const v = h[field] as number | null | undefined;

          const height = signed && v != null ? (Math.abs(v) / max) * 100 : ((v ?? 0) / max) * 100;

          return (

            <div

              key={(h.recordedAt as string) ?? i}

              className={`${styles.bar} ${signed && v != null && v < 0 ? styles.barNeg : ""}`}

              style={{ height: `${Math.min(100, height)}%` }}

              title={`${v ?? "?"}${unit} at ${h.recordedAt as string}`}

            />

          );

        })}

      </div>

    </section>

  );

}



function CommsFactor({ label, value, max }: { label: string; value: number; max: number }) {

  return (

    <div className={styles.commsFactor}>

      <div className={styles.commsFactorHead}>

        <span>{label}</span>

        <span>{value} / {max}</span>

      </div>

      <div className={styles.commsBar}>

        <div className={styles.commsBarFill} style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />

      </div>

    </div>

  );

}



function fmt(v: number | null | undefined, digits: number): string {

  return v != null ? v.toFixed(digits) : "—";

}



function fmtNt(v: number | null | undefined): string {

  return v != null ? `${v.toFixed(2)} nT` : "—";

}



function fmtFlux(v: number | null | undefined): string {

  return v != null ? `${v.toFixed(2)} pfu` : "—";

}



function dynamicPressure(speed: number | null | undefined, density: number | null | undefined): string {

  if (speed == null || density == null) return "—";

  const n = density * 1.6726219e-6;

  const pd = n * speed * speed * 1.6726e-6 * 1e9;

  return `${pd.toFixed(2)} nPa`;

}



function gScaleLabel(g: number): string {

  const labels = ["None", "Minor storm", "Moderate storm", "Strong storm", "Severe storm", "Extreme storm"];

  return labels[g] ?? "—";

}



function sScaleLabel(s: number): string {

  const labels = ["None", "Minor", "Moderate", "Strong", "Severe", "Extreme"];

  return labels[s] ?? "—";

}



function rScaleLabel(r: number): string {

  const labels = ["None", "Minor HF fade", "Wide HF blackout", "Strong HF blackout"];

  return labels[r] ?? r >= 4 ? "Severe" : "—";

}

