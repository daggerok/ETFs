#!/usr/bin/env bash
# One-off type check that mirrors the owner's IntelliJ (no tsconfig: no automatic @types, only what a file
# itself references with /// <reference types=...>). Lives OUTSIDE every repo: nothing is added to a repo.
# usage: .claude/tools/tc/check.sh <repo-dir> [file ...]   (default files: scripts/update-data.ts, scripts/update-data.test.ts, src/main.tsx)
# prints the `error TS` lines; exit 0 = no errors. First use: cd .claude/tools/tc && bun install (creates node_modules and a local bun.lock, both ignored by the standard)
HERE="$(cd "$(dirname "$0")" && pwd)"
R=$1; shift
FILES=("$@"); [ ${#FILES[@]} -eq 0 ] && FILES=(scripts/update-data.ts scripts/update-data.test.ts src/main.tsx)
cd "$R" || exit 2
fail=0
for f in "${FILES[@]}"; do
  [ -f "$f" ] || continue
  out=$(bun "$HERE/node_modules/typescript/bin/tsc" --noEmit --strict --target esnext --module esnext --moduleResolution bundler --skipLibCheck --allowImportingTsExtensions --typeRoots "$HERE/empty-types" --types "" --pretty false "$f" 2>&1 | grep "error TS")
  [ -n "$out" ] && { echo "$out"; fail=1; }
done
exit $fail
