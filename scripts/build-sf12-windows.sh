#!/usr/bin/env bash
# build-sf12-windows.sh
# Compiles Stockfish 12 (classical HCE) for Windows x64 using portable MinGW-w64.
# No admin rights required — MinGW is downloaded to a temp directory and discarded.
#
# Usage: bash scripts/build-sf12-windows.sh
# Output: engines/stockfish12.exe

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$REPO_ROOT/engines/stockfish12.exe"

if [ -f "$OUT" ]; then
  echo "[build-sf12] engines/stockfish12.exe already exists — skipping build."
  echo "[build-sf12] Delete it and re-run this script to force a rebuild."
  exit 0
fi

# ── Detect temp dir ────────────────────────────────────────────────────────────
WIN_TEMP="$(cmd //c "echo %TEMP%" 2>/dev/null | tr -d '\r\n')"
if [ -z "$WIN_TEMP" ]; then
  WIN_TEMP="$TEMP"
fi
BASH_TEMP="$(cygpath -u "$WIN_TEMP" 2>/dev/null || echo "/tmp")"

MINGW_ZIP="$BASH_TEMP/mingw_portable.zip"
MINGW_DIR="$BASH_TEMP/mingw_portable"
SF12_ZIP="$BASH_TEMP/sf12_src.zip"
SF12_SRC="$BASH_TEMP/sf12_src/Stockfish-sf_12/src"

# ── Download MinGW-w64 portable ────────────────────────────────────────────────
MINGW_URL="https://github.com/brechtsanders/winlibs_mingw/releases/download/15.2.0posix-13.0.0-ucrt-r6/winlibs-x86_64-posix-seh-gcc-15.2.0-mingw-w64ucrt-13.0.0-r6.zip"

if [ ! -f "$MINGW_DIR/mingw64/bin/gcc.exe" ]; then
  echo "[build-sf12] Downloading portable MinGW-w64 GCC 15.2 (~167 MB)..."
  curl -L -o "$MINGW_ZIP" "$MINGW_URL" --progress-bar

  echo "[build-sf12] Extracting MinGW-w64..."
  WIN_MINGW_ZIP="$(cygpath -w "$MINGW_ZIP" 2>/dev/null || echo "$MINGW_ZIP")"
  WIN_MINGW_DIR="$(cygpath -w "$MINGW_DIR" 2>/dev/null || echo "$MINGW_DIR")"
  powershell -Command "\$ProgressPreference='SilentlyContinue'; Expand-Archive -LiteralPath '$WIN_MINGW_ZIP' -DestinationPath '$WIN_MINGW_DIR' -Force"
  echo "[build-sf12] MinGW-w64 ready."
else
  echo "[build-sf12] MinGW-w64 already cached at $MINGW_DIR"
fi

export PATH="$MINGW_DIR/mingw64/bin:$PATH"

# ── Download SF12 source ───────────────────────────────────────────────────────
SF12_URL="https://github.com/official-stockfish/Stockfish/archive/refs/tags/sf_12.zip"

if [ ! -d "$(dirname "$SF12_SRC")" ]; then
  echo "[build-sf12] Downloading Stockfish 12 source (~220 KB)..."
  curl -L -o "$SF12_ZIP" "$SF12_URL" --progress-bar

  echo "[build-sf12] Extracting SF12 source..."
  WIN_SF12_ZIP="$(cygpath -w "$SF12_ZIP" 2>/dev/null || echo "$SF12_ZIP")"
  WIN_SF12_DIR="$(cygpath -w "$(dirname "$SF12_SRC")/.." 2>/dev/null || echo "$(dirname "$SF12_SRC")/..")"
  mkdir -p "$(dirname "$SF12_SRC")"
  powershell -Command "\$ProgressPreference='SilentlyContinue'; Expand-Archive -LiteralPath '$WIN_SF12_ZIP' -DestinationPath '$WIN_SF12_DIR' -Force"
  echo "[build-sf12] Source ready."
else
  echo "[build-sf12] SF12 source already cached."
fi

# ── Compile ────────────────────────────────────────────────────────────────────
echo "[build-sf12] Compiling Stockfish 12 (classical HCE, x86-64)..."
echo "[build-sf12] This takes about 1–3 minutes on a modern machine."

WIN_OUT="$(cygpath -w "$OUT" 2>/dev/null || echo "$OUT")"

cd "$SF12_SRC"
mingw32-make -j4 build ARCH=x86-64 COMP=mingw EXE="$WIN_OUT"

echo ""
echo "[build-sf12] ✓ Build complete: engines/stockfish12.exe"
echo "[build-sf12] Smoke test..."

echo -e "uci\nquit" | "$OUT" | grep "^id name"
echo "[build-sf12] ✓ Binary is working."
