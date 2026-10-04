#!/usr/bin/env bash
# usage: ship-tb.sh <repo> <port> - lead-only: apply the toolbar/categories port, commit it, run every gate and both browser tests, push, open the PR, squash-merge it
UI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
S="${ETF_SCRATCH:?set ETF_SCRATCH to a temp dir that holds rollout/<Repo> clones (fresh git clones of daggerok/<Repo>)}"
STD="$UI/../etf-std"
R="${1:?repo}"; PORT="${2:?port}"; BR=feat/toolbar-categories; MSG="feat(app): replace the asset class tabs with one dropdown and tidy the toolbar"
cd "$S/rollout/$R" || exit 2
fail=()
git reset -q --hard HEAD; git clean -fdq -e node_modules
git fetch -q origin && git switch -q -C "$BR" origin/main || { echo "$R NOT-SHIPPED: switch"; exit 1; }
out=$(python3 "$UI/apply-toolbar.py" . 2>&1)
if echo "$out" | grep -q SKIPPED; then echo "$R NOT-SHIPPED: skipped edits: $(echo "$out" | grep SKIPPED | tr '\n' ';')"; exit 1; fi
echo "$out" | grep -q "^OK       block 3f" || { echo "$R NOT-SHIPPED: apply: $out" | head -3; exit 1; }
git add -A && git commit -q -m "$MSG"
git fetch -q origin || { echo "$R NOT-SHIPPED: fetch"; exit 1; }
if ! git merge-base --is-ancestor origin/main HEAD; then git rebase -q origin/main || { git rebase --abort; echo "$R NOT-SHIPPED: rebase conflict"; exit 1; }; fi
[ "$(git rev-list --count origin/main..HEAD)" = 1 ] || fail+=("commits:$(git rev-list --count origin/main..HEAD)")
files=$(git diff --name-only origin/main...HEAD | sort | tr '\n' ' ')
[ "$files" = "README.md app.tsx index.html " ] || fail+=("files:$files")
[ "$(git log -1 --format=%s)" = "$MSG" ] || fail+=(commit-message)
bun install --frozen-lockfile >/dev/null 2>&1 || fail+=(install)
t=$(bun test > /tmp/shipc-$R.log 2>&1; echo $?); [ "$t" = 0 ] && grep -qE '^ *0 fail' /tmp/shipc-$R.log || fail+=(test)
bun build --target=bun scripts/update-data.ts --outfile=/dev/null >/dev/null 2>&1 || fail+=(build-updater)
bun build --target=bun app.tsx --outfile=/dev/null >/dev/null 2>&1 || fail+=(build-app)
bun "$STD/check-readme.ts" . >/dev/null 2>&1 || fail+=(readme)
bun "$STD/check-workflow.ts" . >/dev/null 2>&1 || fail+=(workflow)
bun "$STD/check-scripts.ts" . >/dev/null 2>&1 || fail+=(scripts)
[ "$(git ls-tree HEAD scripts/update-data.ts | cut -c1-6)" = 100755 ] || fail+=(execbit)
git diff --check origin/main...HEAD >/dev/null 2>&1 || fail+=(diffcheck)
if git show origin/main:app.tsx | head -40 | grep -q '<reference types='; then head -40 app.tsx | grep -q '<reference types=' || fail+=(reftypes); fi
h1="$UI/brand-uitest.ts"
case "$R" in
  ProShares) h1="$UI/brand-uitest-proshares.ts";; SPDR) h1="$UI/brand-uitest-spdr.ts";; VanEck) h1="$UI/brand-uitest-vaneck.ts";;
  Fidelity) h1="$UI/fidelity-uitest.ts";; Franklin) h1="$UI/franklin-uitest.ts";; Global-X) h1="$UI/brand-uitest-globalx.ts";;
  Neos) h1="$UI/neos-uitest.ts";; Themes) h1="$UI/themes-uitest.ts";; Invesco) h1="$UI/brand-uitest-invesco.ts";;
esac
run() { bun "$1" "$S/rollout/$R" "$2" "$S/shipc-$R.png" 2>&1 | grep -E "[0-9]+ passed, [0-9]+ failed" | tail -1; }
ok='0 failed; console errors: none'
u1=$(run "$h1" "$PORT"); echo "$u1" | grep -q "$ok" || u1=$(run "$h1" "$PORT"); echo "$u1" | grep -q "$ok" || fail+=("filters-ui: $u1")
u2=$(run "$UI/columns-uitest.ts" "$((PORT+1))"); echo "$u2" | grep -q "$ok" || u2=$(run "$UI/columns-uitest.ts" "$((PORT+1))"); echo "$u2" | grep -q "$ok" || fail+=("columns-ui: $u2")
u3=$(run "$UI/categories-uitest.ts" "$((PORT+2))"); echo "$u3" | grep -q "$ok" || u3=$(run "$UI/categories-uitest.ts" "$((PORT+2))"); echo "$u3" | grep -q "$ok" || fail+=("categories-ui: $u3")
if [ ${#fail[@]} -gt 0 ]; then echo "$R NOT-SHIPPED gates: ${fail[*]}"; exit 1; fi
git push -q -f -u origin "$BR" 2>&1 | tail -1
body="## Summary

- the asset class pills are replaced by one \`Asset classes\` multi-select next to the \`All ETFs\` pill (same component as the Columns menu); every class is checked by default, \`All ETFs\` is lit only while nothing narrows the table, clicking it clears the selection, unchecking every class is the All ETFs view; the choice is remembered in localStorage (never the data)
- toolbar order: search, All ETFs, Asset classes, Columns, Filters on the first row; Copy Tickers, Upload / Drop N-PORT XML (where the app has it), exports, Clear and Blacklist on the right
- README paragraph in \`Column types and filters\`

## Verification

- \`bun install --frozen-lockfile\`, \`bun test\` (exit 0), both builds, \`git diff --check\`, check-readme, check-workflow, check-scripts: all pass
- headless Chrome against this repo's real feed: the existing filter test, the Columns test and a new asset classes test (pill states, Only, persistence, counts, compact toolbar): all pass, no console errors"
url=$(gh pr create --repo "daggerok/$R" --base main --head "$BR" --title "$MSG" --body "$body" 2>&1 | tail -1)
echo "$R PR $url"
n=$(echo "$url" | grep -oE '[0-9]+$')
[ -n "$n" ] || { echo "$R PR-FAILED"; exit 1; }
gh pr merge "$n" --repo "daggerok/$R" --squash --delete-branch >/dev/null 2>&1 && echo "$R MERGED #$n" || { echo "$R MERGE-FAILED #$n"; exit 1; }
