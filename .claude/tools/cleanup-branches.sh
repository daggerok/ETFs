#!/usr/bin/env bash
# usage: cleanup.sh <repo dir> <github repo> <dry|do>
d="$1"; gr="$2"; mode="$3"
git -C "$d" fetch -q --prune origin 2>/dev/null
cur=$(git -C "$d" branch --show-current)
prs=$(gh pr list --repo "daggerok/$gr" --state all --limit 400 --json headRefName,headRefOid,state 2>/dev/null)
merged_tip() { echo "$prs" | python3 -c "import sys,json; b,t=sys.argv[1],sys.argv[2]; print(any(p['headRefName']==b and p['headRefOid']==t and p['state']=='MERGED' for p in json.load(sys.stdin)))" "$1" "$2"; }
open_pr() { echo "$prs" | python3 -c "import sys,json; b=sys.argv[1]; print(any(p['headRefName']==b and p['state']=='OPEN' for p in json.load(sys.stdin)))" "$1"; }
decide() { # ref name -> prints KEEP:<why> or DEL
  local ref="$1" b="$2" tip; tip=$(git -C "$d" rev-parse "$ref")
  [ "$(open_pr "$b")" = True ] && { echo "KEEP:open-pr"; return; }
  if ! git -C "$d" cherry origin/main "$ref" | grep -q '^+'; then echo DEL; return; fi
  [ "$(merged_tip "$b" "$tip")" = True ] && { echo DEL; return; }
  echo "KEEP:unmerged($(git -C "$d" cherry origin/main "$ref" | grep -c '^+') commits)"
}
git -C "$d" branch --format='%(refname:short)' | grep -v '^main$' | while read b; do
  [ "$b" = "$cur" ] && { echo "$gr local $b KEEP:current"; continue; }
  v=$(decide "$b" "$b"); echo "$gr local $b $v"
  [ "$v" = DEL ] && [ "$mode" = do ] && git -C "$d" branch -D -q "$b" >/dev/null
done
git -C "$d" ls-remote --heads origin 2>/dev/null | awk '{print $2}' | sed 's#refs/heads/##' | grep -v '^main$' | while read b; do
  v=$(decide "origin/$b" "$b"); echo "$gr remote $b $v"
  [ "$v" = DEL ] && [ "$mode" = do ] && git -C "$d" push -q origin --delete "$b" 2>&1 | tail -1
done
