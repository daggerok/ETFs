#!/usr/bin/env bash
# run push_retry_rollout.sh for the given repos, retrying transient failures, then print a summary
cd /Users/maksim.kostromin/Documents/code/private/ETFs || exit 1
for r in "$@"; do
  for try in 1 2 3; do
    git -C "$r" fetch -q origin
    if git -C "$r" show origin/main:.github/workflows/update-data.yml | grep -q 'pull --rebase'; then echo "$r ALREADY"; break; fi
    out=$(bash .claude/tools/push_retry_rollout.sh "$r" 2>&1); echo "$out" | tail -3
    echo "$out" | grep -q MERGED && break
    sleep 20
  done
done
echo FINISHED
