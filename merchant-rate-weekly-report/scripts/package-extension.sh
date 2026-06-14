#!/usr/bin/env bash
# Build a distributable zip of the Chrome extension (Load unpacked: unzip, pick the folder).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VER="$(python3 -c "import json; print(json.load(open('$ROOT/extension/manifest.json'))['version'])")"
OUT_DIR="$ROOT/dist"
OUT_ZIP="$OUT_DIR/merchant-rate-weekly-audit-v${VER}.zip"
mkdir -p "$OUT_DIR"
rm -f "$OUT_ZIP"
(
  cd "$ROOT/extension"
  zip -r "$OUT_ZIP" . \
    -x "*.pem" \
    -x ".DS_Store" \
    -x "**/.DS_Store" \
    -x "**/__pycache__/*"
)
echo "Built: $OUT_ZIP ($(wc -c < "$OUT_ZIP" | tr -d ' ') bytes)"
