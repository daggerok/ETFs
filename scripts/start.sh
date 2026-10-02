#!/usr/bin/env bash
# Run the hub locally in the background: bunx serve . -p PORT  ->  http://localhost:PORT
# The process id and the output are kept in the git-ignored .tmp folder of the hub (.etfs.pid, .etfs.log);
# stop it with ./scripts/stop.sh

set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

# server state lives in the git-ignored .tmp folder of the hub
STATE_DIR="$(pwd)/.tmp"
PID_FILE="$STATE_DIR/.etfs.pid"; LOG_FILE="$STATE_DIR/.etfs.log"

usage() {
  cat <<USAGE
Usage: ./scripts/start.sh [options]

Options:
  -p, --port N              port to serve on (default 1234)
  -h, --help                show this help

Stop the server with ./scripts/stop.sh
USAGE
}

die() { echo "start.sh: $*" >&2; exit 2; }
is_number() { case "$1" in ''|*[!0-9]*|0) return 1 ;; *) return 0 ;; esac; }

PORT=1234
while [ $# -gt 0 ]; do
  case "$1" in
    -p|--port) [ $# -ge 2 ] || die "$1 expects a number"; PORT="$2"; shift ;;
    --port=*) PORT="${1#*=}" ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown argument: $1 (see ./scripts/start.sh --help)" ;;
  esac
  shift
done
is_number "$PORT" || die "--port expects a positive number, got '$PORT'"

export PATH="$HOME/.bun/bin:$PATH"
command -v bun >/dev/null 2>&1 || { echo "start.sh: bun is not installed; run ./scripts/install.sh first" >&2; exit 1; }

if [ -f $PID_FILE ] && kill -0 "$(cat $PID_FILE)" 2>/dev/null; then
  echo "already running (pid $(cat $PID_FILE)): $(grep -m1 -o 'http://localhost:[0-9]*' $LOG_FILE 2>/dev/null || echo "http://localhost:$PORT")"
  exit 0
fi

mkdir -p "$STATE_DIR" || { echo "start.sh: cannot create $STATE_DIR" >&2; exit 1; }
nohup bunx serve . -p "$PORT" > $LOG_FILE 2>&1 &
echo $! > $PID_FILE
sleep 2
if kill -0 "$(cat $PID_FILE)" 2>/dev/null; then
  echo "started (pid $(cat $PID_FILE)): $(grep -m1 -o 'http://localhost:[0-9]*' $LOG_FILE || echo "http://localhost:$PORT")"
  echo "log: $LOG_FILE"; echo "stop with: ./scripts/stop.sh"
else
  echo "start.sh: the server failed to start, see $LOG_FILE:" >&2
  cat $LOG_FILE >&2
  rm -f $PID_FILE
  exit 1
fi
