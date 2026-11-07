#!/usr/bin/env bash
# Rebuild the flood and landslide PMTiles overlays.
#
# Display zooms (<= 12) are re-tiled with simplification so the overlay loads
# quickly. Max-zoom tiles are copied from the original NOAH .mbtiles sources,
# so point assessments keep using the exact geometry they use today.
#
# Requires tippecanoe 2.x (tile-join is part of it) and python3.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
noah_dir="${NOAH_DIR:-$repo_root/../downloads/noah_hazards_data}"
work_dir="${HAZARD_WORK_DIR:-$repo_root/.cache/hazard-rebuild}"
out_dir="$repo_root/public/data"

for command in tippecanoe tile-join python3; do
  command -v "$command" >/dev/null || { echo "Missing $command" >&2; exit 1; }
done

mkdir -p "$work_dir" "$out_dir"

slice_high_zooms() {
  local source="$1" target="$2" min_zoom="$3"
  cp "$source" "$target"
  python3 - "$target" "$min_zoom" <<'PY'
import sqlite3
import sys

path, min_zoom = sys.argv[1], int(sys.argv[2])
connection = sqlite3.connect(path)
tiles_type = connection.execute(
    "select type from sqlite_master where name = 'tiles'"
).fetchone()[0]

if tiles_type == 'view':
    # Tippecanoe writes the normalized mbtiles schema (map + images).
    connection.execute('delete from map where zoom_level < ?', (min_zoom,))
    connection.execute(
        'delete from images where zoom_level < ? and tile_id not in (select tile_id from map)',
        (min_zoom,),
    )
else:
    connection.execute('delete from tiles where zoom_level < ?', (min_zoom,))

connection.execute(
    'update metadata set value = ? where name = ?', (str(min_zoom), 'minzoom')
)
connection.commit()
connection.execute('vacuum')
connection.close()
PY
}

build_hazard() {
  local name="$1" layer="$2" geojson="$3" mbtiles="$4" min_zoom="$5" max_zoom="$6" output="$7"
  local input="$work_dir/$name.geojson"
  local low="$work_dir/$name-low.pmtiles"
  local high="$work_dir/$name-high.mbtiles"
  local merged="$work_dir/$name.pmtiles"

  cp "$geojson" "$input"

  echo "== $name: tiling display zooms $min_zoom-$max_zoom"
  tippecanoe -o "$low" -l "$layer" -Z"$min_zoom" -z"$max_zoom" \
    --simplification=10 --simplification-at-maximum-zoom=10 \
    --tiny-polygon-size=6 --no-simplification-of-shared-nodes \
    --no-tile-size-limit --no-feature-limit --force "$input"

  echo "== $name: keeping original zoom $((max_zoom + 1))+ tiles"
  slice_high_zooms "$mbtiles" "$high" $((max_zoom + 1))

  echo "== $name: merging display and assessment tiles"
  tile-join -pk -f -o "$merged" "$low" "$high"
  cp "$merged" "$output"
  ls -lh "$output"
}

build_hazard flood flood-zones "$noah_dir/flood/flood_zones.geojson" \
  "$noah_dir/flood/flood_zones.mbtiles" 1 12 \
  "$out_dir/lanao-del-norte-flood-zones.pmtiles"

build_hazard landslide landslide "$noah_dir/landslide/landslide.geojson" \
  "$noah_dir/landslide/landslide.mbtiles" 0 12 \
  "$out_dir/lanao-del-norte-landslide.pmtiles"
