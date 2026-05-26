import {



  createSatrecFromLines,



  propagateToGeodetic,



  computeGroundTrackSegments,
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







self.onmessage = (ev: MessageEvent) => {



  const msg = ev.data as



    | { type: "INIT_TLES"; tles: TleEntry[] }



    | { type: "SET_OBSERVER"; lat: number; lon: number; selectedNoradId: number | null }



    | { type: "TICK"; timestamp: string }



    | { type: "COMPUTE_GROUND_TRACK"; noradId: number; timestamp?: string };







  if (msg.type === "INIT_TLES") {



    satrecs.clear();



    satNames.clear();



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







    self.postMessage({ type: "TICK_RESULT", positions, lookAngles, overhead });



    return;



  }







  if (msg.type === "COMPUTE_GROUND_TRACK") {



    const satrec = satrecs.get(msg.noradId);



    if (!satrec) {



      self.postMessage({ type: "GROUND_TRACK", noradId: msg.noradId, track: [] });



      return;



    }



    const now = msg.timestamp ? new Date(msg.timestamp) : new Date();
    const { past, future } = computeGroundTrackSegments(satrec, now);
    const track = past.length ? [...past, ...future.slice(1)] : future;



    self.postMessage({ type: "GROUND_TRACK", noradId: msg.noradId, track });



  }



};







export {};



