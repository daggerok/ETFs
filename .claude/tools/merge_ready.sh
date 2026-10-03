#!/usr/bin/env bash
# usage: merge_ready.sh <branch> - merge every repo's open PR from the given branch through the gates (verify_merge.sh)
br="${1:-}"
[ -n "$br" ] || { echo "usage: $(basename "$0") <branch>" >&2; exit 2; }
. "$(dirname "$0")/lib.sh"
cd "$ROOT" || exit 1
for d in */; do d=${d%/}; [ -d "$d/.git" ] || continue
  n=$(gh pr list -R "daggerok/$d" --head "$br" --state open --json number -q length 2>/dev/null)
  [ "$n" = 1 ] && bash "$TOOLS/verify_merge.sh" "$d" "$br" 2>&1 | cut -c1-170
done
