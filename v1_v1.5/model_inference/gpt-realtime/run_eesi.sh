#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Usage: $0 /path/to/v1.0-or-v1.5 [max_samples]" >&2
  exit 2
fi
DATA_ROOT="$1"
MAX_SAMPLES="${2:-0}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_ROOT="$(cd "$DATA_ROOT" && pwd)"
cd "$SCRIPT_DIR"
count=0
while IFS= read -r input; do
  folder="$(dirname "$input")"
  if [[ -f "$folder/output.wav" && ( ! -f "$folder/clean_input.wav" || -f "$folder/clean_output.wav" ) ]]; then
    continue
  fi
  if [[ ! -f "$folder/output.wav" ]]; then
    node "$SCRIPT_DIR/eesi_inference.js" --input "$input" --output "$folder/output.wav"
  fi
  if [[ -f "$folder/clean_input.wav" && ! -f "$folder/clean_output.wav" ]]; then
    node "$SCRIPT_DIR/eesi_inference.js" --input "$folder/clean_input.wav" --output "$folder/clean_output.wav"
  fi
  count=$((count + 1))
  if [[ "$MAX_SAMPLES" -gt 0 && "$count" -ge "$MAX_SAMPLES" ]]; then break; fi
done < <(find "$DATA_ROOT" -name input.wav -print | sort)
echo "Completed $count samples."
