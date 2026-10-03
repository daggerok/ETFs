#!/usr/bin/env bash
# usage: dep_merge.sh <repo> - for each open dependabot PR: test the PR head, squash-merge if green
. "$(dirname "$0")/lib.sh"; require_repo "${1:-}"; require_clean
git checkout -q main && git pull -q --ff-only origin main || { echo "$REPO pull-fail"; exit 1; }
for pr in $(gh pr list -R "daggerok/$REPO" --state open --json number,headRefName -q '.[]|select(.headRefName|startswith("dependabot"))|.number'); do
  m=$(gh pr view "$pr" -R "daggerok/$REPO" --json mergeable -q .mergeable)
  if [ "$m" != MERGEABLE ]; then echo "$REPO #$pr $m (skipped)"; continue; fi
  git fetch -q origin "pull/$pr/head:dep-$pr" 2>/dev/null && git checkout -q "dep-$pr" || { echo "$REPO #$pr fetch-fail"; continue; }
  ok=1
  bun install --frozen-lockfile >/dev/null 2>&1 || ok=0
  bun test 2>&1 | grep -qE '^ *0 fail' || ok=0
  bun build --target=bun scripts/update-data.ts --outfile=/dev/null >/dev/null 2>&1 || ok=0
  git checkout -q main; git branch -q -D "dep-$pr"
  if [ $ok = 1 ]; then gh pr merge "$pr" -R "daggerok/$REPO" --squash >/dev/null 2>&1 && echo "$REPO #$pr MERGED" || echo "$REPO #$pr MERGE-FAILED"; else echo "$REPO #$pr TESTS-FAILED"; fi
done
git pull -q --ff-only origin main
