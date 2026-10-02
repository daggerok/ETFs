#!/usr/bin/env bash
# prep one repo branch: shared blocks (29 rows), remove extra workflows, exec bit, checks, commit, push
set -u
STD=/Users/maksim.kostromin/Documents/code/private/ETFs/.claude/tools/etf-std
cd /Users/maksim.kostromin/Documents/code/private/ETFs/$1 || exit 1
git checkout -q chore/standardize-config && git pull -q --ff-only origin chore/standardize-config || { echo "$1 CHECKOUT FAIL"; exit 1; }
[ -z "$(git status --porcelain | grep -v .idea)" ] || { echo "$1 DIRTY"; exit 1; }
msgs=()
for f in .github/workflows/*.yml; do [ "$(basename $f)" = update-data.yml ] || { git rm -q "$f"; msgs+=("workflow $(basename $f)"); }; done
head -1 scripts/update-data.ts | grep -q '^#!/usr/bin/env bun' || echo "$1 NOSHEBANG: $(head -1 scripts/update-data.ts | cut -c1-40)"
git update-index --chmod=+x scripts/update-data.ts
bun $STD/apply-shared-blocks.ts . >/dev/null
out=$(bun $STD/check-readme.ts . 2>&1 | tail -1); echo "$1 readme: $out | removed: ${msgs[*]:-none}"
if [ -n "$(git status --porcelain | grep -v .idea)" ]; then
  git add -A . ':!.idea' 2>/dev/null
  git commit -q -m "chore(repo): sync 29-brand tables, keep only update-data workflow and executable updater" && git push -q origin chore/standardize-config && echo "$1 pushed $(git rev-parse --short HEAD)"
fi
