#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT="$SCRIPT_DIR/../electron/resources/accessibility-helper"

mkdir -p "$(dirname "$OUTPUT")"

swiftc "$SCRIPT_DIR/main.swift" \
  -framework ApplicationServices \
  -framework AppKit \
  -framework Foundation \
  -o "$OUTPUT"

echo "✅ ビルド完了: $OUTPUT"
