# Project GAKIT Client

Public-facing flood hazard reporting client for Project GAKIT. Built with Next.js, React, Tailwind CSS, and MapLibre GL.

## Requirements

- Node.js 20.9 or newer
- npm

## Setup

Install dependencies:

```powershell
npm install
```

## Run Locally

Start the development server:

```powershell
npm run dev
```

Open:

```text
http://localhost:3000
```

## Build

Create a production build:

```powershell
npm run build
```

Start the production server after building:

```powershell
npm run start
```

## Useful Scripts

```powershell
npm run dev
npm run build
npm run start
npm run lint
npm test
```

## Regenerating the hazard overlays

`public/data/lanao-del-norte-flood-zones.pmtiles` and
`public/data/lanao-del-norte-landslide.pmtiles` are PMTiles archives built from
the Project NOAH hazard layers. The source files are distributed via this Google
Drive folder (provided by NOAH):

https://drive.google.com/drive/folders/1K2z1FYNCGPzhcGIgT1Y2nKKLUojxxIa3?usp=drive_link

Point assessments read the archive's **maximum-zoom** tiles
(`lib/map/floodHazard.ts`, `lib/map/geohazardQuery.ts`), so those tiles must stay
at full fidelity:

- flood: max zoom 16, layer `flood-zones`, `risk_level` (`low` / `medium` / `high`)
- landslide: max zoom 14, layer `landslide`, `LH` (`1` / `2` / `3`)

Display zooms below z13 can be simplified without changing any assessment
answer. Run the rebuild from WSL/Linux (requires tippecanoe 2.x and python3):

```bash
bash scripts/rebuild-hazard-pmtiles.sh
```

The script re-tiles display zooms up to z12 with simplification, keeps the
original z13+ tiles from the NOAH `.mbtiles` sources, and merges both halves with
`tile-join -pk`. `-pk` is required so large but valid tiles are not dropped.

If rebuilding by hand, the important flags are:

```bash
tippecanoe -o flood-low.pmtiles -l flood-zones -Z1 -z12 \
  --simplification=10 --simplification-at-maximum-zoom=10 \
  --tiny-polygon-size=6 --no-simplification-of-shared-nodes \
  --no-tile-size-limit --no-feature-limit --force flood_zones.geojson
```

`--tiny-polygon-size=6` collapses sub-pixel slivers (the flood source alone has
~150k polygons) into squares smaller than one screen pixel. Without it, low
zooms keep hundreds of thousands of vertices that cannot be seen.

The map's vector sources expect layer names `flood-zones` and `landslide` (see
`lib/map/overlayLayers.ts`).

## Project Structure

```text
app/                     Next.js App Router pages and server actions
  api/                   Route handlers (elevation proxy, Himawari image proxy)
  public-view/           Public hazard-map page (components in public-view/components/)
  monitoring/            Staff portal (features/reports, features/alerts, …)
  admin/                 Admin portal
  login/                 Sign-in page
components/              Shared cross-portal UI (headers, modals, map, ui/)
constants/               Shared constants and camera/basemap configuration
hooks/                   Reusable React hooks (map layers, polling, sorting)
lib/                     Domain logic, grouped by domain
  backend/               Backend access helpers (cache, errors, warm-up status)
  map/                   Map domain (color scales, markers, overlay layers)
  notifications/         Notification mappers and read receipts
  reports/               Report formatting helpers
  weather/  auth/  supabase/
types/                   Shared TypeScript types
scripts/                 Maintenance scripts (MapLibre worker sync)
tests/                   Vitest unit tests
public/                  Static assets served from site root
  data/                  lanao-del-norte-flood-zones.pmtiles archive
  vendor/maplibre-gl/    MapLibre worker bundle (synced via postinstall)
```

Tests run with:

```powershell
npm test
```

## Static Assets

Files in `public/` are served from the site root.

Example:

```text
public/images/flooded-image1.jpg
```

is available in the app as:

```text
/images/flooded-image1.jpg
```

## Troubleshooting

If Next.js serves `/_next/static/...` chunks with `500` errors, stop the dev server, delete the generated `.next` folder, then restart:

```powershell
Remove-Item -LiteralPath .next -Recurse -Force
npm run dev
```

If browser geolocation does not work, check that location permission is allowed in the browser. Some browsers require HTTPS for geolocation outside localhost.
