#!/usr/bin/env bash
# roll the rebase-and-retry push into one repo's workflow via PR + gates + squash merge
cd /Users/maksim.kostromin/Documents/code/private/ETFs/$1 || exit 1
git checkout -q main && git pull -q --ff-only origin main || { echo "$1 pull-fail"; exit 1; }
git checkout -q -b fix/push-rebase-retry
python3 ../.claude/tools/push_retry.py .github/workflows/update-data.yml >/dev/null || { echo "$1 PATTERN-NOT-FOUND"; git checkout -q -- .; git checkout -q main; git branch -q -D fix/push-rebase-retry; exit 1; }
git add .github/workflows/update-data.yml && git commit -q -m "ci(workflow): rebase and retry the data push when main moved during the run" && git push -q -u origin fix/push-rebase-retry 2>/dev/null
git checkout -q main
pr=$(gh pr create -R daggerok/$1 --base main --head fix/push-rebase-retry --title "ci(workflow): rebase and retry the data push when main moved during the run" --body "A run that takes minutes can find main moved (merges, Dependabot); the data push was rejected and the week's data lost. The commit step now rebases onto origin/main and retries up to 4 times." 2>/dev/null | tail -1 | grep -o '[0-9]*$')
bash ../.claude/tools/verify_merge.sh $1 fix/push-rebase-retry 2>&1 | cut -c1-150
git branch -D fix/push-rebase-retry -q 2>/dev/null
