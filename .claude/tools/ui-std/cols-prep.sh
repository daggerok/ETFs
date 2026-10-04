#!/usr/bin/env bash
# usage: cols-prep.sh <repo> <port> - fresh branch off origin/main in the rollout clone, apply the Columns port, build and browser-test it (no push)
UI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
S="${ETF_SCRATCH:?set ETF_SCRATCH to a temp dir that holds rollout/<Repo> clones (fresh git clones of daggerok/<Repo>)}"
R="${1:?repo}"; PORT="${2:?port}"
cd "$S/rollout/$R" || exit 2
git fetch -q origin || { echo "$R PREP-FAIL fetch"; exit 1; }
git reset -q --hard HEAD && git clean -fdq -e node_modules
git switch -q -C feat/column-visibility origin/main || { echo "$R PREP-FAIL switch"; exit 1; }
out=$(python3 "$UI/apply-columns.py" . 2>&1)
echo "$out" | grep -q SKIPPED && echo "$R SKIPPED-EDITS: $(echo "$out" | grep SKIPPED | tr '\n' ';')"
echo "$out" | grep -q "^OK       block 3e" || { echo "$R PREP-FAIL apply: $out" | head -3; exit 1; }
bun build --target=bun app.tsx --outfile=/dev/null >/dev/null 2>&1 || { echo "$R PREP-FAIL build"; exit 1; }
r=$(bun "$UI/columns-uitest.ts" . "$PORT" "$S/cols-$R.png" 2>&1 | tail -6)
echo "$R UI: $(echo "$r" | tail -1)"
echo "$r" | grep FAIL
