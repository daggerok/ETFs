#!/usr/bin/env bash
# usage: prep.sh <repo> [branch] - prep one repo branch: shared blocks, remove extra workflows, exec bit, checks, commit, push
set -u
. "$(dirname "$0")/lib.sh"; require_repo "${1:-}"; require_clean
br="${2:-chore/standardize-config}"
git checkout -q "$br" && git pull -q --ff-only origin "$br" || { echo "$REPO CHECKOUT FAIL"; exit 1; }
require_clean
msgs=()
for f in .github/workflows/*.yml; do [ -e "$f" ] || continue; [ "$(basename "$f")" = update-data.yml ] || { git rm -q "$f"; msgs+=("workflow $(basename "$f")"); }; done
head -1 scripts/update-data.ts | grep -q '^#!/usr/bin/env bun' || echo "$REPO NOSHEBANG: $(head -1 scripts/update-data.ts | cut -c1-40)"
git update-index --chmod=+x scripts/update-data.ts
bun "$STD/apply-shared-blocks.ts" . >/dev/null
out=$(bun "$STD/check-readme.ts" . 2>&1 | tail -1); echo "$REPO readme: $out | removed: ${msgs[*]:-none}"
if [ -n "$(dirty_paths)" ]; then
  git add -A . ':!.idea' 2>/dev/null
  git commit -q -m "chore(repo): sync 29-brand tables, keep only update-data workflow and executable updater" && git push -q origin "$br" && echo "$REPO pushed $(git rev-parse --short HEAD)"
fi
