import {



  createSatrecFromLines,



  propagateToGeodetic,



  computeLiveGroundTrack,
  computeLookAngles,



} from "@uplink/propagation";



import type { SatRec } from "satellite.js";







interface TleEntry {



  noradId: number;



  name: string;



  line1: string;



  line2: string;



}







interface ObserverContext {



  lat: number;



  lon: number;



  selectedNoradId: number | null;



}







const satrecs = new Map<number, SatRec>();



const satNames = new Map<number, string>();



let observer: ObserverContext | null = null;

let lastGroundTrackNoradId: number | null = null;
let lastGroundTrackAt = 0;
let cachedGroundTrack: {
  noradId: number;
  past: Array<[number, number, number]>;
  future: Array<[number, number, number]>;
} | null = null;
const GROUND_TRACK_REFRESH_MS = 3000;

function buildLiveGroundTrack(noradId: number, date: Date) {
  const satrec = satrecs.get(noradId);
  if (!satrec) return null;
  const { past, future } = computeLiveGroundTrack(satrec, date);
  return { noradId, past, future };
}







self.onmessage = (ev: MessageEvent) => {



  const msg = ev.data as



    | { type: "INIT_TLES"; tles: TleEntry[] }



    | { type: "SET_OBSERVER"; lat: number; lon: number; selectedNoradId: number | null }



    | { type: "TICK"; timestamp: string }



    | { type: "COMPUTE_GROUND_TRACK"; noradId: number; timestamp?: string };







  if (msg.type === "INIT_TLES") {



    satrecs.clear();



    satNames.clear();



    lastGroundTrackNoradId = null;
    lastGroundTrackAt = 0;
    cachedGroundTrack = null;



    for (const tle of msg.tles) {



      satrecs.set(tle.noradId, createSatrecFromLines(tle.line1, tle.line2));



      satNames.set(tle.noradId, tle.name);



    }



    self.postMessage({ type: "INIT_DONE", count: satrecs.size });



    return;



  }







  if (msg.type === "SET_OBSERVER") {



    observer = {



      lat: msg.lat,



      lon: msg.lon,



      selectedNoradId: msg.selectedNoradId,



    };



    return;



  }







  if (msg.type === "TICK") {



    const date = new Date(msg.timestamp);



    const positions: Array<{ noradId: number; lat: number; lng: number; alt: number }> = [];



    for (const [noradId, satrec] of satrecs) {



      const pos = propagateToGeodetic(satrec, date);



      if (pos) {



        positions.push({ noradId, lat: pos.lat, lng: pos.lng, alt: pos.alt });



      }



    }







    let lookAngles: {



      noradId: number;



      azimuthDeg: number;



      elevationDeg: number;



      rangeKm: number;



      visible: boolean;



      timestamp: string;



    } | null = null;







    const overhead: Array<{



      noradId: number;



      name: string;



      elevationDeg: number;



      azimuthDeg: number;



      rangeKm: number;



    }> = [];







    if (observer) {



      const obs = { lat: observer.lat, lon: observer.lon, elevationM: 0 };



      for (const [noradId, satrec] of satrecs) {



        const look = computeLookAngles(satrec, obs, date);



        if (!look) continue;



        if (look.elevationDeg >= 10) {



          overhead.push({



            noradId,



            name: satNames.get(noradId) ?? String(noradId),



            elevationDeg: look.elevationDeg,



            azimuthDeg: look.azimuthDeg,



            rangeKm: look.rangeKm,



          });



        }



        if (observer.selectedNoradId === noradId) {



          lookAngles = {



            noradId,



            azimuthDeg: look.azimuthDeg,



            elevationDeg: look.elevationDeg,



            rangeKm: look.rangeKm,



            visible: look.elevationDeg >= 0,



            timestamp: msg.timestamp,



          };



        }



      }



      overhead.sort((a, b) => b.elevationDeg - a.elevationDeg);



    }



    let groundTrack = cachedGroundTrack;
    const selectedId = observer?.selectedNoradId ?? null;
    if (selectedId != null) {
      const nowMs = Date.now();
      if (selectedId !== lastGroundTrackNoradId || nowMs - lastGroundTrackAt >= GROUND_TRACK_REFRESH_MS) {
        const built = buildLiveGroundTrack(selectedId, date);
        if (built) {
          cachedGroundTrack = built;
          groundTrack = built;
          lastGroundTrackNoradId = selectedId;
          lastGroundTrackAt = nowMs;
        }
      }
    } else {
      cachedGroundTrack = null;
      groundTrack = null;
      lastGroundTrackNoradId = null;
    }







    self.postMessage({ type: "TICK_RESULT", positions, lookAngles, overhead, groundTrack });



    return;



  }







  if (msg.type === "COMPUTE_GROUND_TRACK") {



    const satrec = satrecs.get(msg.noradId);



    if (!satrec) {



      self.postMessage({ type: "GROUND_TRACK", noradId: msg.noradId, track: [] });



      return;



    }



    const now = msg.timestamp ? new Date(msg.timestamp) : new Date();
    const built = buildLiveGroundTrack(msg.noradId, now);
    if (!built) {
      self.postMessage({ type: "GROUND_TRACK", noradId: msg.noradId, past: [], future: [] });
      return;
    }

    cachedGroundTrack = built;
    lastGroundTrackNoradId = msg.noradId;
    lastGroundTrackAt = Date.now();

    self.postMessage({ type: "GROUND_TRACK", noradId: msg.noradId, past: built.past, future: built.future });



  }



};







export {};



