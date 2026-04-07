#!/bin/bash
# Generate all PWA icons from a source image
# Usage: ./scripts/generate-icons.sh path/to/icon.png

set -e

SOURCE="${1:-public/icon.png}"
OUTDIR="$(dirname "$SOURCE")"

if [ ! -f "$SOURCE" ]; then
    echo "Error: Source image not found at $SOURCE"
    exit 1
fi

echo "Generating icons from $SOURCE..."

# Apple icons
for size in 57 60 72 76 114 120 144 152 180; do
    sips -z "$size" "$size" "$SOURCE" --out "$OUTDIR/apple-icon-${size}x${size}.png"
done
sips -z 180 180 "$SOURCE" --out "$OUTDIR/apple-icon-precomposed.png"
sips -z 180 180 "$SOURCE" --out "$OUTDIR/apple-icon.png"

# Android icons
for size in 36 48 72 96 144 192; do
    sips -z "$size" "$size" "$SOURCE" --out "$OUTDIR/android-icon-${size}x${size}.png"
done

# Favicons
for size in 16 32 96; do
    sips -z "$size" "$size" "$SOURCE" --out "$OUTDIR/favicon-${size}x${size}.png"
done

# MS icons
for size in 70 144 150 310; do
    sips -z "$size" "$size" "$SOURCE" --out "$OUTDIR/ms-icon-${size}x${size}.png"
done

# Mobile icon
sips -z 192 192 "$SOURCE" --out "$OUTDIR/mobile-icon.png"

echo "Done! All icons generated."
