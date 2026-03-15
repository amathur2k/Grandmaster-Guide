#!/usr/bin/env bash
set -e

echo "[deploy-build] Step 1: Building application..."
npm run build

echo "[deploy-build] Step 2: Compiling Stockfish 12..."
bash scripts/build-sf12.sh

echo "[deploy-build] Build complete."
