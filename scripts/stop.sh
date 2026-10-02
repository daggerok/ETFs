#!/usr/bin/env bash
# Stop the server started by ./scripts/start.sh (the whole process tree behind the pid file in the hub .tmp folder)

set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

# same git-ignored .tmp folder as start.sh
STATE_DIR="$(pwd)/.tmp"
PID_FILE="$STATE_DIR/.etfs.pid"; LOG_FILE="$STATE_DIR/.etfs.log"

case "${1:-}" in
  "") ;;
  -h|--help) printf 'Usage: ./scripts/stop.sh\n\nStops the server started by ./scripts/start.sh.\n'; exit 0 ;;
  *) echo "stop.sh: unknown argument: $1 (see ./scripts/stop.sh --help)" >&2; exit 2 ;;
esac

if [ ! -f $PID_FILE ]; then echo "not running (no pid file)"; exit 0; fi

pid="$(cat $PID_FILE)"
kill_tree() {
  for child in $(pgrep -P "$1" 2>/dev/null); do kill_tree "$child"; done
  kill "$1" 2>/dev/null
}
if kill -0 "$pid" 2>/dev/null; then
  kill_tree "$pid"
  echo "stopped (pid $pid)"
else
  echo "not running (stale pid file removed)"
fi
rm -f "$PID_FILE" "$LOG_FILE"
