#!/usr/bin/env bash
# Download the pinned Pyodide v0.29.3 runtime files for @vp-code-runner/vitepress.
#
# These are the files the Vite plugin (codeRunnerAssets) serves/emits and that
# the worker loads at runtime. Pin matches the version the engine was validated
# against. Idempotent: skips files that already exist.
#
# Usage:
#   bash scripts/download-pyodide.sh [DEST_DIR]
#
# DEST_DIR defaults to ./public/pyodide (relative to the current working dir).
# Point codeRunnerAssets({ pyodideDir: DEST_DIR }) at the same directory.

set -euo pipefail

PYODIDE_VERSION="0.29.3"
BASE_URL="https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full"
DEST="${1:-$(pwd)/public/pyodide}"

FILES=(
  "pyodide.mjs"
  "pyodide.asm.js"
  "pyodide.asm.wasm"
  "python_stdlib.zip"
  "pyodide-lock.json"
)

mkdir -p "$DEST"

for FILE in "${FILES[@]}"; do
  TARGET="$DEST/$FILE"
  if [ -f "$TARGET" ]; then
    echo "ok   $FILE already exists, skipping"
  else
    echo "get  $FILE ..."
    curl -fsSL --retry 3 --retry-delay 2 "$BASE_URL/$FILE" -o "$TARGET"
    echo "done $FILE"
  fi
done

echo ""
echo "Pyodide v${PYODIDE_VERSION} ready at $DEST"
