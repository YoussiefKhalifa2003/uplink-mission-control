# UPLINK

**Live orbital operations and space weather mission control**

An interactive 3D Earth dashboard that propagates satellites using SGP4/SDP4 orbital mechanics, predicts visible passes over any city, and reacts to live NOAA space weather with mission-control alerts.

![UPLINK Mission Control](https://img.shields.io/badge/status-portfolio-cyan)

## Demo

- **Mission Control:** `/` — 3D globe, live satellites, pass predictions, space weather
- **Shareable passes:** `/pass/dubai/25544` — ISS passes over Dubai
- **Weather dashboard:** `/weather` — Kp index, solar wind, comms degradation

## Globe Controls

| Action | Result |
|--------|--------|
| **Search a city** (right panel) | Camera flies to your **observer site** — passes & overhead sats recalculate |
| **Click land / country** | Set observer to that location |
| **Click satellite dot** | Track that satellite + show orbit path (camera follows sat) |
| **Drag / scroll** | Rotate and zoom — zoom in for regional view with country borders |

**Data scope:** Top bar metrics (Kp, solar wind) are **global**. Pass times, azimuth, elevation change per city.

## Features

- Real-time satellite propagation via **SGP4/SDP4** (`satellite.js`)
- Pass prediction with AOS/LOS refinement over any ground location
- Live **NOAA SWPC** space weather ingestion (Kp, solar wind, IMF Bz)
- Event-driven alert engine with **SSE** push to clients
- WebGL globe (`react-globe.gl`) with Web Worker offloaded orbital ticks
- 130+ bundled cities + Nominatim geocode search
- Shareable deep links for pass cards

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, react-globe.gl, Three.js |
| Backend | Node.js, Fastify, node:sqlite (Node 22+) |
| Propagation | satellite.js SGP4/SDP4 (shared package) |
| Real-time | Server-Sent Events (SSE) |
| Monorepo | pnpm workspaces + Turborepo |

## Architecture

```
Browser (React + Web Worker)
    │ REST + SSE
    ▼
Fastify API ──► SQLite (node:sqlite)
    │
    ├── CelesTrak TLE (6h refresh)
    └── NOAA SWPC (60s poll)
```

See [docs/architecture.md](docs/architecture.md) for full details.

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 10+

### Install & Run

```bash
pnpm install
pnpm build
pnpm dev
```

- Web: http://localhost:5173
- API: http://localhost:3001

### Environment

Copy example env files:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start API + web in dev mode |
| `pnpm build` | Build all packages |
| `pnpm test` | Run unit tests |
| `pnpm typecheck` | TypeScript check |
| `pnpm e2e` | Playwright E2E tests |

## Data Sources

- [CelesTrak](https://celestrak.org) — NORAD TLE data
- [NOAA SWPC](https://www.swpc.noaa.gov) — Space weather products
- [OpenStreetMap Nominatim](https://nominatim.openstreetmap.org) — Geocoding

## Deployment

- **Web:** Vercel — set `VITE_API_URL` to your API URL
- **API:** Railway — provision Postgres (optional) or use SQLite volume; set `CORS_ORIGIN`

## Author

**Youssief Khalifa** — RIT Computing and Information Technologies

## License

MIT — See [LICENSE](LICENSE)

Not affiliated with NASA, NOAA, or CelesTrak.
