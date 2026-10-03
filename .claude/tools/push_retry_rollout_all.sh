#!/usr/bin/env bash
# usage: push_retry_rollout_all.sh <repo>... - run push_retry_rollout.sh for the given repos, retrying transient failures, then print a summary
[ "$#" -gt 0 ] || { echo "usage: $(basename "$0") <repo>..." >&2; exit 2; }
. "$(dirname "$0")/lib.sh"
cd "$ROOT" || exit 1
for r in "$@"; do
  for try in 1 2 3; do
    git -C "$r" fetch -q origin
    if git -C "$r" show origin/main:.github/workflows/update-data.yml | grep -q 'pull --rebase'; then echo "$r ALREADY"; break; fi
    out=$(bash "$TOOLS/push_retry_rollout.sh" "$r" 2>&1); echo "$out" | tail -3
    echo "$out" | grep -q MERGED && break
    echo "$out" | grep -q -e PATTERN-NOT-FOUND -e DIRTY && break # not transient
    sleep 20
  done
done
echo FINISHED
