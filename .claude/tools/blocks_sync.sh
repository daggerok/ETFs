#!/usr/bin/env bash
# usage: blocks_sync.sh <repo> - re-apply the canonical shared README tables to one repo via PR + squash merge (only if README changes)
# Refuses an empty repo name and a dirty tree; its own failed-gate cleanup only discards edits it made itself.
. "$(dirname "$0")/lib.sh"; require_repo "${1:-}"; require_clean
git checkout -q main && git pull -q --ff-only origin main || { echo "$REPO pull-fail"; exit 1; }
bun "$STD/apply-shared-blocks.ts" . >/dev/null
[ -z "$(git status --porcelain README.md)" ] && { echo "$REPO unchanged"; exit 0; }
git checkout -q -b docs/shared-tables
bun "$STD/check-readme.ts" . >/dev/null 2>&1 || { echo "$REPO readme-check-fail"; git checkout -q -- . ; git checkout -q main; git branch -q -D docs/shared-tables; exit 1; }
bun test 2>&1 | grep -qE '^ *0 fail' || { echo "$REPO test-fail"; git checkout -q -- . ; git checkout -q main; git branch -q -D docs/shared-tables; exit 1; }
git add README.md && git commit -q -m "docs(readme): refresh the shared brand tables" && git push -q -u origin docs/shared-tables || { echo "$REPO push-fail"; exit 1; }
pr=$(gh pr create -R "daggerok/$REPO" --base main --head docs/shared-tables --title "docs(readme): refresh the shared brand tables" --body "Canonical shared tables regenerated from registry.json." 2>/dev/null | tail -1 | grep -o '[0-9]*$')
[ -n "$pr" ] || { echo "$REPO PR-CREATE-FAILED"; git checkout -q main; exit 1; }
gh pr merge "$pr" -R "daggerok/$REPO" --squash >/dev/null 2>&1 && echo "$REPO MERGED #$pr" || echo "$REPO MERGE-FAILED #$pr"
git checkout -q main; git pull -q --ff-only origin main; git branch -q -D docs/shared-tables
