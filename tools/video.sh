#!/usr/bin/env bash
# Render + brand + encode the showcase video.
#
#   tools/video.sh [out.mp4]
#
# 1. `tools/video.mjs` drives the camera through the shot list and writes PNG
#    frames.
# 2. Each frame gets a full-width black caption bar across the bottom with the
#    model name in large white type — the credit the brief asks for.
# 3. ffmpeg encodes the sequence to H.264 (plus a webm for browsers that
#    prefer it).
set -euo pipefail

cd "$(dirname "$0")/.."

OUT="showcase/yuuka-turnaround.mp4"
FPS="${FPS:-30}"
W=900
H=1200

FONT=/usr/share/fonts/TTF/DejaVuSans-Bold.ttf
FONT_REG=/usr/share/fonts/noto/NotoSans-Regular.ttf

MODEL="DeepSeek V4.1 Flash High"
TOOL="Devin CLI  ·  three.js  ·  Yuuka — Pajama Ver."

if [ "${1:-}" = "--encode-only" ]; then
  OUT="${2:-showcase/yuuka-turnaround.mp4}"
else
  echo "[video] rendering frames…"
  node tools/video.mjs --w $W --h $H
fi

echo "[video] encoding…"
mkdir -p "$(dirname "$OUT")"

# The caption bar is 168 px tall on a 1200 px frame (~14%), which keeps the
# model name dominant without eating the character.
ffmpeg -y -loglevel error \
  -framerate "$FPS" -i video/frames/%05d.png \
  -vf "\
drawbox=x=0:y=ih-168:w=iw:h=168:color=black@1:t=fill,\
drawtext=fontfile=${FONT}:text='${MODEL}':fontcolor=white:fontsize=54:x=(w-text_w)/2:y=h-136,\
drawtext=fontfile=${FONT_REG}:text='${TOOL}':fontcolor=0xb9c6e6:fontsize=26:x=(w-text_w)/2:y=h-62" \
  -c:v libx264 -pix_fmt yuv420p -crf 18 -preset slow -movflags +faststart \
  "$OUT"

echo "[video] wrote $OUT"
ffprobe -v error -show_entries format=duration,size -show_entries stream=width,height,nb_frames -of default=nw=1 "$OUT"
