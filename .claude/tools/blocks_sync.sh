#!/usr/bin/env bash
# re-apply the canonical shared README tables to one repo via PR + squash merge (only if README changes)
STD=/Users/maksim.kostromin/Documents/code/private/ETFs/.claude/tools/etf-std
cd /Users/maksim.kostromin/Documents/code/private/ETFs/$1 || exit 1
git checkout -q main && git pull -q --ff-only origin main || { echo "$1 pull-fail"; exit 1; }
bun $STD/apply-shared-blocks.ts . >/dev/null
[ -z "$(git status --porcelain README.md)" ] && { echo "$1 unchanged"; exit 0; }
git checkout -q -b docs/shared-tables
bun $STD/check-readme.ts . >/dev/null 2>&1 || { echo "$1 readme-check-fail"; git checkout -q -- . ; git checkout -q main; git branch -q -D docs/shared-tables; exit 1; }
bun test 2>&1 | grep -qE '^ *0 fail' || { echo "$1 test-fail"; git checkout -q -- . ; git checkout -q main; git branch -q -D docs/shared-tables; exit 1; }
git add README.md && git commit -q -m "docs(readme): refresh the shared brand tables" && git push -q -u origin docs/shared-tables || { echo "$1 push-fail"; exit 1; }
pr=$(gh pr create -R daggerok/$1 --base main --head docs/shared-tables --title "docs(readme): refresh the shared brand tables" --body "Canonical shared tables regenerated from registry.json." 2>/dev/null | tail -1 | grep -o '[0-9]*$')
gh pr merge $pr -R daggerok/$1 --squash >/dev/null 2>&1 && echo "$1 MERGED #$pr" || echo "$1 MERGE-FAILED #$pr"
git checkout -q main; git pull -q --ff-only origin main; git branch -q -D docs/shared-tables
