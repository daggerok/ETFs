#!/usr/bin/env bash
# usage: final_check.sh <repo> - fresh main, every gate, no extra files or workflows, SEC contact (missing or example.com = failure)
. "$(dirname "$0")/lib.sh"; require_repo "${1:-}"; require_clean
git checkout -q main && git pull -q --ff-only origin main || { echo "$REPO PULL-FAIL"; exit 1; }
f=()
bun install --frozen-lockfile >/dev/null 2>&1 || f+=(install)
bun test 2>&1 | grep -qE '^ *0 fail' || f+=(test)
bun build --target=bun scripts/update-data.ts --outfile=/dev/null >/dev/null 2>&1 || f+=(build)
bun "$STD/check-readme.ts" . >/dev/null 2>&1 || f+=(readme)
bun "$STD/check-workflow.ts" . >/dev/null 2>&1 || f+=(workflow)
bun "$STD/check-pages.ts" . >/dev/null 2>&1 || f+=(pages)
bun run build >/dev/null 2>&1 || f+=(parcel-build)
bun "$STD/check-scripts.ts" . >/dev/null 2>&1 || f+=(scripts)
[ "$(ls .github/workflows 2>/dev/null | tr "\n" " ")" = "github-pages.yml update-data.yml " ] || f+=(extra-workflows)
[ "$(ls -A .github | tr '\n' ' ')" = "dependabot.yml workflows " ] || f+=(github-extra)
cmp -s .github/dependabot.yml "$TOOLS/dependabot.ref" || f+=(dependabot)
[ "$(git ls-tree HEAD scripts/update-data.ts | cut -c1-6)" = 100755 ] || f+=(execbit)
[ "$(head -1 scripts/update-data.ts)" = '#!/usr/bin/env bun' ] || f+=(shebang)
grep -q '<reference types=' scripts/update-data.ts || f+=(reftypes)
[ -e tsconfig.json ] && f+=(tsconfig)
grep -q '"typescript"' package.json && f+=(typescript-dep)
for p in .worklog.txt .prompt.txt evidence research .plans COMPLETION.md scripts/fixtures; do [ -e "$p" ] && f+=("has:$p"); done
# SEC contact: required wherever the provider uses SEC (iShares, SPDR and ProShares have none, see STANDARD.md section 12)
case "$REPO" in
  iShares|SPDR|ProShares) ;;
  *) grep -q 'daggerok ETF feed daggerok@gmail.com' scripts/update-data.config.json 2>/dev/null || f+=(sec-contact-missing) ;;
esac
[ -z "$(grep -rl 'example\.com' scripts 2>/dev/null)" ] || f+=(example.com)
[ "${#f[@]}" = 0 ] && echo "$REPO OK" || { echo "$REPO PROBLEMS: ${f[*]}"; exit 1; }
