#!/usr/bin/env bash
# Update the sibling ETF repos cloned in the hub folder (the parent of scripts/):
# fetch with prune and tags, switch to main (or master) and fast-forward it.
# Repos are updated in parallel; each repo's output is printed as one block.

set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

usage() {
  cat <<USAGE
Usage: ./scripts/update.sh [options] [repo ...]

  (no arguments)            update every cloned repo
  repo ...                  update only these repos, separated by spaces and/or commas:
                              ./scripts/update.sh VanEck Tema
                              ./scripts/update.sh VanEck,Tema
                              ./scripts/update.sh VanEck,Tema SPDR      (names are case-insensitive)

Options:
  -p, --parallel N          number of repos updated in parallel (default 1)
  -h, --help                show this help

Clone missing repos first with ./scripts/install.sh
USAGE
}

die() { echo "update.sh: $*" >&2; exit 2; }
is_number() { case "$1" in ''|*[!0-9]*|0) return 1 ;; *) return 0 ;; esac; }

JOBS=1
SELECTED=()
while [ $# -gt 0 ]; do
  case "$1" in
    -p|--parallel) [ $# -ge 2 ] || die "$1 expects a number"; JOBS="$2"; shift ;;
    --parallel=*) JOBS="${1#*=}" ;;
    -h|--help) usage; exit 0 ;;
    -*) die "unknown option: $1 (see ./scripts/update.sh --help)" ;;
    *)
      IFS=',' read -r -a parts <<< "$1"
      for part in ${parts[@]+"${parts[@]}"}; do
        [ -n "$part" ] && SELECTED+=("$part")
      done
      ;;
  esac
  shift
done
is_number "$JOBS" || die "--parallel expects a positive number, got '$JOBS'"
command -v git >/dev/null 2>&1 || die "git is required"

# every cloned repo in the hub folder
CLONED=()
for dir in */; do
  dir="${dir%/}"
  [ -d "$dir/.git" ] && CLONED+=("$dir")
done
[ ${#CLONED[@]} -gt 0 ] || die "no cloned repos here: run ./scripts/install.sh first"

if [ ${#SELECTED[@]} -gt 0 ]; then
  LIST=()
  for want in "${SELECTED[@]}"; do
    lower="$(printf '%s' "$want" | tr '[:upper:]' '[:lower:]')"
    match=""
    for repo in "${CLONED[@]}"; do
      [ "$(printf '%s' "$repo" | tr '[:upper:]' '[:lower:]')" = "$lower" ] && match="$repo" && break
    done
    [ -n "$match" ] || die "not cloned: $want (cloned: ${CLONED[*]}); run ./scripts/install.sh $want"
    LIST+=("$match")
  done
else
  LIST=("${CLONED[@]}")
fi

OUT="$(mktemp -d)"; trap 'rm -rf "$OUT"' EXIT
export OUT

update_one() {
  repo="$1"
  (
    echo "========================================"
    echo "Processing repository: $repo"
    echo "========================================"
    (
      cd "$repo" || exit 1
      echo "Fetching with prune and tags..."
      git fetch -pat || exit 1
      target=""
      if git show-ref --verify --quiet refs/heads/main || git show-ref --verify --quiet refs/remotes/origin/main; then target="main"
      elif git show-ref --verify --quiet refs/heads/master || git show-ref --verify --quiet refs/remotes/origin/master; then target="master"; fi
      if [ -z "$target" ]; then echo "Warning: neither main nor master found, skipping."; exit 0; fi
      echo "Checking out $target..."
      git checkout "$target" || exit 1
      echo "Fast-forwarding $target..."
      git merge --ff-only "origin/$target" || git pull origin "$target"
    )
    code=$?
    if [ $code -eq 0 ]; then echo "OK: $repo"; else echo "FAILED: $repo (exit $code)"; fi
    echo
    exit $code
  ) > "$OUT/$repo.log" 2>&1
  code=$?
  cat "$OUT/$repo.log"
  return $code
}
export -f update_one

echo "Updating ${#LIST[@]} repo(s) with $JOBS parallel job(s) ..."
printf '%s\n' "${LIST[@]}" | xargs -P "$JOBS" -I{} bash -c 'update_one {}' > "$OUT/all.log"
cat "$OUT/all.log"

failed=$(grep -c '^FAILED: ' "$OUT/all.log")
ok=$(grep -c '^OK: ' "$OUT/all.log")
echo "Done: $ok updated, $failed failed."
[ "$failed" -eq 0 ] || exit 1
