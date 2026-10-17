#!/usr/bin/env bash
# Render + brand + encode a showcase video.
#
#   tools/video.sh [--w 1600] [--h 1200] [--out showcase/yuuka-4x3.mp4]
#   tools/video.sh --encode-only [--w .. --h .. --out ..]
#
# 1. `tools/video.mjs` drives the camera through the shot list and writes PNG
#    frames into `video/frames-<W>x<H>/`.
# 2. Every frame gets a full-width black caption bar across the bottom with the
#    model name in large white type — the credit the brief asks for.
# 3. ffmpeg encodes H.264 (plus a VP9 webm for browsers that prefer it).
#
# The caption is sized as a fraction of the frame height, so it reads the same
# on a 900-tall 16:9 frame as on a 1200-tall 4:3 one.
set -euo pipefail

cd "$(dirname "$0")/.."

W=1600
H=1200
OUT=showcase/yuuka-4x3.mp4
ENCODE_ONLY=0

while [ $# -gt 0 ]; do
  case "$1" in
    --encode-only) ENCODE_ONLY=1; shift ;;
    --w) W="$2"; shift 2 ;;
    --h) H="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

FPS="${FPS:-30}"
FRAMES="video/frames-${W}x${H}"

FONT=/usr/share/fonts/TTF/DejaVuSans-Bold.ttf
FONT_REG=/usr/share/fonts/noto/NotoSans-Regular.ttf

MODEL="DeepSeek V4.1 Flash High"
TOOL="Devin CLI  ·  three.js  ·  Yuuka — Pajama Ver."

# caption geometry, proportional to the frame
BAR=$((H * 14 / 100))
BIG=$((H * 45 / 1000))
SMALL=$((H * 22 / 1000))

if [ "$ENCODE_ONLY" = "0" ]; then
  echo "[video] rendering ${W}x${H} frames…"
  node tools/video.mjs --w "$W" --h "$H" --out "$FRAMES"
fi

if [ ! -d "$FRAMES" ]; then
  echo "[video] no frames in $FRAMES — run without --encode-only first" >&2
  exit 1
fi

echo "[video] encoding $OUT…"
mkdir -p "$(dirname "$OUT")"

VF="drawbox=x=0:y=ih-${BAR}:w=iw:h=${BAR}:color=black@1:t=fill,\
drawtext=fontfile=${FONT}:text='${MODEL}':fontcolor=white:fontsize=${BIG}:x=(w-text_w)/2:y=h-$((BAR - BIG / 5)),\
drawtext=fontfile=${FONT_REG}:text='${TOOL}':fontcolor=0xb9c6e6:fontsize=${SMALL}:x=(w-text_w)/2:y=h-$((SMALL + BAR / 5))"

ffmpeg -y -loglevel error -framerate "$FPS" -i "$FRAMES/%05d.png" -vf "$VF" \
  -c:v libx264 -pix_fmt yuv420p -crf 18 -preset slow -movflags +faststart "$OUT"

WEBM="${OUT%.mp4}.webm"
ffmpeg -y -loglevel error -framerate "$FPS" -i "$FRAMES/%05d.png" -vf "$VF" \
  -c:v libvpx-vp9 -crf 34 -b:v 0 -pix_fmt yuv420p "$WEBM"

echo "[video] wrote $OUT and $WEBM"
for f in "$OUT" "$WEBM"; do
  ffprobe -v error -show_entries format=duration,size -show_entries stream=width,height,nb_frames -of default=nw=1 "$f" | sed "s|^|  $(basename "$f"): |"
done
