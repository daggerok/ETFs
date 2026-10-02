#!/usr/bin/env bash
STD=/Users/maksim.kostromin/Documents/code/private/ETFs/.claude/tools/etf-std
cd /Users/maksim.kostromin/Documents/code/private/ETFs/$1 || exit 1
git checkout -q main && git pull -q --ff-only origin main || { echo "$1 PULL-FAIL"; exit 1; }
f=()
[ -z "$(git status --porcelain | grep -v .idea)" ] || f+=(dirty)
bun install --frozen-lockfile >/dev/null 2>&1 || f+=(install)
bun test 2>&1 | grep -qE '^ *0 fail' || f+=(test)
bun build --target=bun scripts/update-data.ts --outfile=/dev/null >/dev/null 2>&1 || f+=(build)
bun $STD/check-readme.ts . >/dev/null 2>&1 || f+=(readme)
bun $STD/check-workflow.ts . >/dev/null 2>&1 || f+=(workflow)
bun $STD/check-scripts.ts . >/dev/null 2>&1 || f+=(scripts)
[ "$(ls .github/workflows)" = update-data.yml ] || f+=(extra-workflows)
cmp -s .github/dependabot.yml /Users/maksim.kostromin/Documents/code/private/ETFs/.claude/tools/dependabot.ref || f+=(dependabot)
[ "$(git ls-tree HEAD scripts/update-data.ts | cut -c1-6)" = 100755 ] || f+=(execbit)
head -1 scripts/update-data.ts | grep -q '^#!/usr/bin/env' || f+=(shebang)
grep -q '<reference types=' scripts/update-data.ts || f+=(reftypes)
for p in .worklog.txt .prompt.txt evidence research .plans scripts/fixtures; do [ -e $p ] && f+=("has:$p"); done
sec=$(grep -c 'daggerok@gmail.com' scripts/update-data.config.json); ex=$(grep -rl 'example\.com' scripts 2>/dev/null | wc -l | tr -d ' ')
[ "${#f[@]}" = 0 ] && echo "$1 OK (sec_in_config=$sec example.com_files=$ex)" || echo "$1 PROBLEMS: ${f[*]}"
