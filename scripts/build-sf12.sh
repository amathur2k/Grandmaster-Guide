#!/usr/bin/env bash
set -e

ENGINES_DIR="$(pwd)/engines"
SF12_BIN="$ENGINES_DIR/stockfish12"
SF12_SOURCE_URL="https://github.com/official-stockfish/Stockfish/archive/refs/tags/sf_12.tar.gz"
BUILD_EXTRACT_DIR="/tmp/Stockfish-sf_12"
BUILD_SRC_DIR="$BUILD_EXTRACT_DIR/src"

if [ -f "$SF12_BIN" ] && [ "$(stat -c%s "$SF12_BIN" 2>/dev/null || stat -f%z "$SF12_BIN")" -gt 100000 ]; then
  echo "[build-sf12] Binary already exists at $SF12_BIN — skipping build"
  exit 0
fi

mkdir -p "$ENGINES_DIR"

echo "[build-sf12] Downloading Stockfish 12 source (~11 MB)..."
curl -fsSL -o /tmp/sf12.tar.gz "$SF12_SOURCE_URL"

echo "[build-sf12] Extracting..."
tar -xzf /tmp/sf12.tar.gz -C /tmp/

echo "[build-sf12] Compiling SF12 in classical (no-NNUE) mode — may take 3-5 minutes..."
LDFLAGS="-Wl,--dynamic-linker=/lib64/ld-linux-x86-64.so.2 -Wl,-rpath,/lib/x86_64-linux-gnu -Wl,-rpath,/usr/lib/x86_64-linux-gnu" \
  make -C "$BUILD_SRC_DIR" build ARCH=x86-64 COMP=gcc EXE="$SF12_BIN" -j4

chmod +x "$SF12_BIN"

SIZE=$(stat -c%s "$SF12_BIN" 2>/dev/null || stat -f%z "$SF12_BIN")
echo "[build-sf12] Done — binary at $SF12_BIN ($SIZE bytes)"
