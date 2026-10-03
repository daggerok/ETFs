#!/usr/bin/env bash
# usage: verify_merge.sh <repo> <branch> - run all gates on the branch, squash-merge its PR if green
. "$(dirname "$0")/lib.sh"; require_repo "${1:-}"; require_clean
br="${2:-chore/standardize-config}"
git fetch -q origin main "$br" || { echo "$REPO FAIL fetch"; exit 1; }
git checkout -q "$br" && git pull -q --ff-only origin "$br" || { echo "$REPO FAIL checkout"; exit 1; }
fail=()
bun install --frozen-lockfile >/dev/null 2>&1 || fail+=(install)
t=$(bun test 2>&1); echo "$t" | grep -qE '^ *0 fail' || fail+=("test: $(echo "$t" | grep -E '^ *[0-9]+ fail' | head -1)")
bun build --target=bun scripts/update-data.ts --outfile=/dev/null >/dev/null 2>&1 || fail+=(build)
git diff --check origin/main...HEAD >/dev/null 2>&1 || fail+=(diffcheck)
bun "$STD/check-readme.ts" . >/dev/null 2>&1 || fail+=(readme)
bun "$STD/check-workflow.ts" . >/dev/null 2>&1 || fail+=(workflow)
bun "$STD/check-scripts.ts" . >/dev/null 2>&1 || fail+=(scripts)
grep -q '<reference types=' scripts/update-data.ts || fail+=(reftypes)
[ "$(git ls-tree HEAD scripts/update-data.ts | cut -c1-6)" = 100755 ] || fail+=(execbit)
[ "$(head -1 scripts/update-data.ts)" = '#!/usr/bin/env bun' ] || fail+=(shebang)
cmp -s .github/dependabot.yml "$TOOLS/dependabot.ref" || fail+=(dependabot)
[ -e tsconfig.json ] && fail+=(tsconfig)
grep -q '"typescript"' package.json && fail+=(typescript-dep)
if [ ${#fail[@]} -gt 0 ]; then echo "$REPO NOT-MERGED gates: ${fail[*]}"; git checkout -q main; exit 1; fi
pr=$(gh pr list -R "daggerok/$REPO" --head "$br" --state open --json number -q '.[0].number')
[ -n "$pr" ] || { echo "$REPO no open PR"; git checkout -q main; exit 1; }
gh pr merge "$pr" -R "daggerok/$REPO" --squash >/dev/null 2>&1 && echo "$REPO MERGED #$pr" || echo "$REPO MERGE-FAILED #$pr"
git checkout -q main; git pull -q --ff-only origin main
