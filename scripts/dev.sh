#!/usr/bin/env bash
# Run all dev services in parallel with colored, prefixed output.
# Each line is tagged with the service it came from so the combined
# stream stays readable. Ctrl-C cleanly tears down every child.
set -uo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"

# Color codes
CYAN='\033[36m'
GREEN='\033[32m'
YELLOW='\033[33m'
MAGENTA='\033[35m'
GRAY='\033[90m'
RESET='\033[0m'

# Suppress dotenv noise (only for processes that read it via dotenv@17+).
export DOTENV_CONFIG_QUIET=true
# Disable pnpm's update banner.
export DISABLE_OPENCOLLECTIVE=1
export ADBLOCK=1

pids=()

# Run a command in the background, prefixing each line of its merged
# stdout+stderr with a colored service tag. awk's fflush() keeps output
# line-buffered on both macOS (BSD awk) and Linux (gawk).
run_prefixed() {
  local label="$1"; shift
  local color="$1"; shift
  (
    "$@" 2>&1 | awk -v c="$color" -v r="$RESET" -v label="$label" \
      '{printf "%s[%s]%s %s\n", c, label, r, $0; fflush()}'
  ) &
  pids+=("$!")
}

cleanup() {
  trap '' SIGINT SIGTERM
  echo
  printf "${GRAY}→ stopping services...${RESET}\n"
  # Send SIGTERM to entire process group of each child.
  for pid in "${pids[@]}"; do
    kill -TERM "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null
  exit 0
}
trap cleanup SIGINT SIGTERM

printf "${GREEN}Starting ScanOrbit (native)${RESET}\n"
printf "  ${CYAN}api${RESET}      http://localhost:4000\n"
printf "  ${GREEN}app${RESET}      http://localhost:5173 (Vite redirects from :3000)\n"
printf "  ${YELLOW}scanner${RESET}  background worker\n"
printf "  ${MAGENTA}analyzer${RESET} background worker\n"
printf "${GRAY}Press Ctrl-C to stop all services.${RESET}\n\n"

run_prefixed "api"      "$CYAN"    pnpm --silent --filter @scanorbit/api dev
run_prefixed "app"      "$GREEN"   pnpm --silent --filter @scanorbit/app dev
run_prefixed "scanner"  "$YELLOW"  bash -c "cd '$ROOT/workers' && go run ./cmd/scanner"
run_prefixed "analyzer" "$MAGENTA" bash -c "cd '$ROOT/workers' && go run ./cmd/analyzer"

wait
