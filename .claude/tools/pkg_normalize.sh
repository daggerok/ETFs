#!/usr/bin/env bash
# usage: pkg_normalize.sh <repo> - normalize package.json scripts to {"test":"bun test","update":"bun scripts/update-data.ts"}; PR + squash merge
# Refuses an empty repo name and a dirty tree; its own failed-gate cleanup only discards edits it made itself.
. "$(dirname "$0")/lib.sh"; require_repo "${1:-}"; require_clean
git checkout -q main && git pull -q --ff-only origin main || { echo "$REPO pull-fail"; exit 1; }
cur=$(bun -e "const p=JSON.parse(await Bun.file('package.json').text()); console.log(JSON.stringify(p.scripts||{}))")
want='{"test":"bun test","update":"bun scripts/update-data.ts"}'
[ "$cur" = "$want" ] && { echo "$REPO already ok"; exit 0; }
git checkout -q -b chore/package-scripts
bun -e "const p=JSON.parse(await Bun.file('package.json').text()); p.scripts={test:'bun test',update:'bun scripts/update-data.ts'}; await Bun.write('package.json', JSON.stringify(p,null,2)+'\n')"
bun install --frozen-lockfile >/dev/null 2>&1 || { echo "$REPO install-fail"; git checkout -q -- . ; git checkout -q main; git branch -q -D chore/package-scripts; exit 1; }
bun test 2>&1 | grep -qE '^ *0 fail' || { echo "$REPO test-fail"; git checkout -q -- . ; git checkout -q main; git branch -q -D chore/package-scripts; exit 1; }
git add package.json && git commit -q -m "chore(package): use the same npm scripts everywhere" && git push -q -u origin chore/package-scripts || { echo "$REPO push-fail"; exit 1; }
pr=$(gh pr create -R "daggerok/$REPO" --base main --head chore/package-scripts --title "chore(package): use the same npm scripts everywhere" --body "Standard scripts: test = bun test, update = bun scripts/update-data.ts." 2>/dev/null | tail -1 | grep -o '[0-9]*$')
[ -n "$pr" ] || { echo "$REPO PR-CREATE-FAILED"; git checkout -q main; exit 1; }
gh pr merge "$pr" -R "daggerok/$REPO" --squash >/dev/null 2>&1 && echo "$REPO MERGED #$pr" || echo "$REPO MERGE-FAILED #$pr"
git checkout -q main; git pull -q --ff-only origin main; git branch -q -D chore/package-scripts
