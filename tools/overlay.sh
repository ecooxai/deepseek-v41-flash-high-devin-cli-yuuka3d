#!/usr/bin/env bash
# Aligned side-by-side + overlay of the reference and a render.
#
#   tools/overlay.sh <render.png> <out.png>
#
# Both images are trimmed to their own silhouette (the reference is an RGBA
# cut-out; the render must have been taken with `?bg=magenta&hud=0`), scaled to
# the same height, and written out as reference | render | blended overlay.
# Because both are normalised to the same figure height, proportions can be
# compared directly instead of by eye.
set -euo pipefail

RENDER="${1:?usage: overlay.sh <render.png> <out.png>}"
OUT="${2:?usage: overlay.sh <render.png> <out.png>}"
H="${3:-1100}"
BG='#cfe4f7'

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

magick docs/reference/yuukapa.png -alpha extract -threshold 40% "$tmp/refmask.png"
magick docs/reference/yuukapa.png -background "$BG" -alpha remove -alpha off "$tmp/ref.png"

magick "$RENDER" -fuzz 18% -transparent '#ff00ff' -alpha extract -threshold 40% "$tmp/rndmask.png"
magick "$RENDER" -background "$BG" -alpha remove -alpha off "$tmp/rnd.png"

# trim each to its silhouette, then scale to a common height
for k in ref rnd; do
  box=$(magick "$tmp/$k.png" "$tmp/${k}mask.png" -alpha off -compose copy_opacity -composite -format "%@" info:)
  magick "$tmp/$k.png" -crop "$box" +repage -resize x$H "$tmp/${k}_t.png"
done

magick "$tmp/ref_t.png" "$tmp/rnd_t.png" -background "$BG" +append "$tmp/sbs.png"
magick "$tmp/ref_t.png" "$tmp/rnd_t.png" -compose dissolve -define compose:args=50 -composite "$tmp/ovl.png"
magick "$tmp/sbs.png" "$tmp/ovl.png" -background "$BG" -gravity north -append "$OUT"
echo "wrote $OUT"
