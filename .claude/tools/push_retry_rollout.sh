#!/usr/bin/env bash
# usage: push_retry_rollout.sh <repo> - roll the rebase-and-retry push into one repo's workflow via PR + gates + squash merge
. "$(dirname "$0")/lib.sh"; require_repo "${1:-}"; require_clean
git checkout -q main && git pull -q --ff-only origin main || { echo "$REPO pull-fail"; exit 1; }
git checkout -q -b fix/push-rebase-retry
python3 "$TOOLS/push_retry.py" .github/workflows/update-data.yml >/dev/null || { echo "$REPO PATTERN-NOT-FOUND"; git checkout -q -- .; git checkout -q main; git branch -q -D fix/push-rebase-retry; exit 1; }
git add .github/workflows/update-data.yml && git commit -q -m "ci(workflow): rebase and retry the data push when main moved during the run" && git push -q -u origin fix/push-rebase-retry 2>/dev/null
git checkout -q main
pr=$(gh pr create -R "daggerok/$REPO" --base main --head fix/push-rebase-retry --title "ci(workflow): rebase and retry the data push when main moved during the run" --body "A run that takes minutes can find main moved (merges, Dependabot); the data push was rejected and the week's data lost. The commit step now rebases onto origin/main and retries up to 4 times." 2>/dev/null | tail -1 | grep -o '[0-9]*$')
[ -n "$pr" ] || { echo "$REPO PR-CREATE-FAILED"; exit 1; }
bash "$TOOLS/verify_merge.sh" "$REPO" fix/push-rebase-retry 2>&1 | cut -c1-150
git branch -D fix/push-rebase-retry -q 2>/dev/null
