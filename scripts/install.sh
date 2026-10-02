#!/usr/bin/env bash
# Clone every sibling ETF repo into the hub folder (the parent of scripts/), so the hub app works
# locally with all the data: bunx serve . -p 1234  ->  http://localhost:1234
# Safe to re-run: repos that are already cloned are skipped, nothing existing is touched.
#
#   ./scripts/install.sh                 clone all 29 repos (shallow, HTTPS: fast, small, enough to run the app)
#   ./scripts/install.sh --full          clone with the full git history (for developing the repos)
#   ./scripts/install.sh --ssh           clone over SSH (git@github.com:...) instead of HTTPS
#   ./scripts/install.sh --only A,B      clone only the listed repos, e.g. --only VanEck,Tema
#   ./scripts/install.sh -j 8            number of parallel clones (default 4)
# Update later with ./scripts/update.sh

set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

OWNER=daggerok
REPOS=(AAM aberdeen Amplify ARK Capital-Group Fidelity First-Trust Franklin Global-X Goldman-Sachs Invesco iShares JPMorgan Neos Northern-Trust Pacer Parametric ProShares Schwab SP-Funds SPDR Sprott Tema Themes VanEck Vanguard VictoryShares WisdomTree Xtrackers)

PREFIX="https://github.com/$OWNER/"
SUFFIX=".git"
DEPTH_FLAG="--depth=1"
JOBS=4
ONLY=""

while [ $# -gt 0 ]; do
  case "$1" in
    --ssh) PREFIX="git@github.com:$OWNER/" ;;
    --full) DEPTH_FLAG="" ;;
    --only) shift; ONLY="${1:-}" ;;
    -j) shift; JOBS="${1:-4}" ;;
    -h|--help) sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $1 (see ./scripts/install.sh --help)" >&2; exit 2 ;;
  esac
  shift
done

command -v git >/dev/null 2>&1 || { echo "git is required" >&2; exit 1; }
case "$JOBS" in ''|*[!0-9]*) echo "-j expects a positive number" >&2; exit 2 ;; esac

if [ -n "$ONLY" ]; then
  LIST=()
  IFS=',' read -r -a wanted <<< "$ONLY"
  for w in "${wanted[@]}"; do
    found=0
    for r in "${REPOS[@]}"; do [ "$r" = "$w" ] && found=1 && break; done
    [ $found = 1 ] || { echo "unknown repo: $w (names are case-sensitive: ${REPOS[*]})" >&2; exit 2; }
    LIST+=("$w")
  done
else
  LIST=("${REPOS[@]}")
fi

clone_one() {
  repo="$1"
  if [ -d "$repo/.git" ]; then echo "skip    $repo (already cloned)"; return 0; fi
  if [ -e "$repo" ]; then echo "FAILED  $repo (a non-git path with this name exists)"; return 1; fi
  # shellcheck disable=SC2086
  if git clone -q $DEPTH_FLAG "$PREFIX$repo$SUFFIX" "$repo" 2>/dev/null; then echo "cloned  $repo"; else rm -rf "$repo"; echo "FAILED  $repo ($PREFIX$repo$SUFFIX)"; return 1; fi
}
export -f clone_one
export PREFIX SUFFIX DEPTH_FLAG

LOG="$(mktemp)"; trap 'rm -f "$LOG"' EXIT
echo "Cloning ${#LIST[@]} repo(s) into $(pwd) with $JOBS parallel job(s)${DEPTH_FLAG:+ (shallow)} ..."
printf '%s\n' "${LIST[@]}" | xargs -P "$JOBS" -I{} bash -c 'clone_one {}' | tee "$LOG"

cloned=$(grep -c '^cloned ' "$LOG"); skipped=$(grep -c '^skip ' "$LOG"); failed=$(grep -c '^FAILED ' "$LOG")
echo
echo "Done: $cloned cloned, $skipped skipped, $failed failed."
if [ "$failed" -gt 0 ]; then echo "Re-run ./scripts/install.sh to retry the failed ones (needs network access to github.com)." >&2; exit 1; fi
echo "Next: bunx serve . -p 1234   (open http://localhost:1234)   |   ./scripts/update.sh pulls fresh data later"
