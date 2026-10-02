#!/usr/bin/env bash
# Run the hub locally in the background: bunx serve . -p PORT  ->  http://localhost:PORT
# The process id is kept in .serve.pid and the output in .serve.log; stop it with ./scripts/stop.sh

set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

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

if [ -f .serve.pid ] && kill -0 "$(cat .serve.pid)" 2>/dev/null; then
  echo "already running (pid $(cat .serve.pid)): $(grep -m1 -o 'http://localhost:[0-9]*' .serve.log 2>/dev/null || echo "http://localhost:$PORT")"
  exit 0
fi

nohup bunx serve . -p "$PORT" > .serve.log 2>&1 &
echo $! > .serve.pid
sleep 2
if kill -0 "$(cat .serve.pid)" 2>/dev/null; then
  echo "started (pid $(cat .serve.pid)): $(grep -m1 -o 'http://localhost:[0-9]*' .serve.log || echo "http://localhost:$PORT")"
  echo "log: .serve.log   stop with: ./scripts/stop.sh"
else
  echo "start.sh: the server failed to start, see .serve.log:" >&2
  cat .serve.log >&2
  rm -f .serve.pid
  exit 1
fi
