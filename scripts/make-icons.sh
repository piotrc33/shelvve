#!/usr/bin/env bash
# Rasterizes public/icons/icon.svg into the PNG sizes listed in public/manifest.webmanifest (keep in sync).
set -euo pipefail
cd "$(dirname "$0")/../public"
for size in 72 96 128 144 152 192 384 512; do
  rsvg-convert -w "$size" -h "$size" icons/icon.svg -o "icons/icon-${size}x${size}.png"
done
rsvg-convert -w 32 -h 32 icons/icon.svg -o /tmp/shelvve-favicon.png
magick /tmp/shelvve-favicon.png favicon.ico
