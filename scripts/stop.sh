#!/usr/bin/env bash
# Stop the server started by ./scripts/start.sh (the whole process tree behind .serve.pid)

set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

case "${1:-}" in
  "") ;;
  -h|--help) printf 'Usage: ./scripts/stop.sh\n\nStops the server started by ./scripts/start.sh.\n'; exit 0 ;;
  *) echo "stop.sh: unknown argument: $1 (see ./scripts/stop.sh --help)" >&2; exit 2 ;;
esac

if [ ! -f .serve.pid ]; then echo "not running (no .serve.pid)"; exit 0; fi

pid="$(cat .serve.pid)"
kill_tree() {
  for child in $(pgrep -P "$1" 2>/dev/null); do kill_tree "$child"; done
  kill "$1" 2>/dev/null
}
if kill -0 "$pid" 2>/dev/null; then
  kill_tree "$pid"
  echo "stopped (pid $pid)"
else
  echo "not running (stale .serve.pid removed)"
fi
rm -f .serve.pid .serve.log
