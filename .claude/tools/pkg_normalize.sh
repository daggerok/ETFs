#!/usr/bin/env bash
# normalize package.json scripts to {"test":"bun test","update":"bun scripts/update-data.ts"}; PR + squash merge
cd /Users/maksim.kostromin/Documents/code/private/ETFs/$1 || exit 1
git checkout -q main && git pull -q --ff-only origin main || { echo "$1 pull-fail"; exit 1; }
cur=$(bun -e "const p=JSON.parse(await Bun.file('package.json').text()); console.log(JSON.stringify(p.scripts||{}))")
want='{"test":"bun test","update":"bun scripts/update-data.ts"}'
[ "$cur" = "$want" ] && { echo "$1 already ok"; exit 0; }
git checkout -q -b chore/package-scripts
bun -e "const p=JSON.parse(await Bun.file('package.json').text()); p.scripts={test:'bun test',update:'bun scripts/update-data.ts'}; await Bun.write('package.json', JSON.stringify(p,null,2)+'\n')"
bun install --frozen-lockfile >/dev/null 2>&1 || { echo "$1 install-fail"; git checkout -q -- . ; git checkout -q main; git branch -q -D chore/package-scripts; exit 1; }
bun test 2>&1 | grep -qE '^ *0 fail' || { echo "$1 test-fail"; git checkout -q -- . ; git checkout -q main; git branch -q -D chore/package-scripts; exit 1; }
git add package.json && git commit -q -m "chore(package): use the same npm scripts everywhere" && git push -q -u origin chore/package-scripts || { echo "$1 push-fail"; exit 1; }
pr=$(gh pr create -R daggerok/$1 --base main --head chore/package-scripts --title "chore(package): use the same npm scripts everywhere" --body "Standard scripts: test = bun test, update = bun scripts/update-data.ts." 2>/dev/null | tail -1 | grep -o '[0-9]*$')
gh pr merge $pr -R daggerok/$1 --squash >/dev/null 2>&1 && echo "$1 MERGED #$pr" || echo "$1 MERGE-FAILED #$pr"
git checkout -q main; git pull -q --ff-only origin main; git branch -q -D chore/package-scripts
