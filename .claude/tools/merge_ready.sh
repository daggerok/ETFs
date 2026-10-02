#!/usr/bin/env bash
# merge every repo's open PR from the given branch (default feat/metrics-as-of) through the gates
br=${1:-feat/metrics-as-of}
cd /Users/maksim.kostromin/Documents/code/private/ETFs || exit 1
for d in */; do d=${d%/}; [ -d $d/.git ] || continue
  n=$(gh pr list -R daggerok/$d --head $br --state open --json number -q length 2>/dev/null)
  [ "$n" = 1 ] && bash .claude/tools/verify_merge.sh $d $br 2>&1 | cut -c1-170
done
