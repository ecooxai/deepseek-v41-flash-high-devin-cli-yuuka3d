#!/usr/bin/env bash
# Normalised silhouette comparison.
#
#   tools/profile.sh <image> [steps]
#
# Prints, for `steps` evenly spaced heights between the top and the bottom of
# the subject, the left/right extent of the silhouette expressed as a fraction
# of the subject's total height. Everything is normalised by height, so the
# reference and a render can be compared even though they are framed
# completely differently.
#
# The reference is an RGBA cut-out. A render needs a magenta backdrop, which is
# keyed out here (`?bg=magenta` in the app).
set -euo pipefail

IMG="${1:?usage: profile.sh <image> [steps]}"
STEPS="${2:-24}"
W=260

magick "$IMG" -resize ${W}x -fuzz 18% -transparent '#ff00ff' -alpha extract -depth 8 txt:- 2>/dev/null |
  awk -v steps="$STEPS" -v w="$W" '
    NR > 1 {
      n = split($1, p, ",")
      x = p[1] + 0; y = p[2] + 0
      hex = ""
      for (i = 2; i <= NF; i++) if (substr($i, 1, 1) == "#") hex = $i
      if (hex == "") next
      v = strtonum("0x" substr(hex, 2, 2))
      if (v > 128) {
        if (!(y in mn) || x < mn[y]) mn[y] = x
        if (!(y in mx) || x > mx[y]) mx[y] = x
        if (!seen) { top = y; seen = 1 }
        bot = y
      }
    }
    END {
      h = bot - top
      if (h <= 0) { print "empty silhouette"; exit 1 }
      # axis = mean centre of the silhouette, so the two images share a spine
      n = 0; sum = 0
      for (yy in mn) { sum += (mn[yy] + mx[yy]) / 2; n++ }
      axis = sum / n
      for (s = 0; s < steps; s++) {
        y = top + int(h * s / (steps - 1) + 0.5)
        if (!(y in mn)) { printf "%4.2f  -\n", s / (steps - 1); continue }
        printf "%4.2f  l=%6.3f  r=%6.3f  w=%6.3f  c=%6.3f\n",
          s / (steps - 1),
          (mn[y] - axis) / h, (mx[y] - axis) / h, (mx[y] - mn[y]) / h,
          ((mn[y] + mx[y]) / 2 - axis) / h
      }
    }'
