#!/usr/bin/env bash
# Shared guards for the per-repo tools. Source it: `. "$(dirname "$0")/lib.sh"; require_repo "${1:-}"`.
# - ROOT is the hub folder (derived from this file, no absolute paths), STD the etf-std folder
# - require_repo refuses an empty or odd repo name, so an empty argument can never resolve to the hub itself
# - require_clean refuses a dirty working tree (only untracked .idea/ and node_modules/ are ignored): the tools then
#   only ever modify a tree they created, and may safely discard their own edits on a failed gate

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STD="$ROOT/.claude/tools/etf-std"
TOOLS="$ROOT/.claude/tools"

require_repo() {
  REPO="${1:-}"
  case "$REPO" in
    ''|.|..|*/*|*..*) echo "usage: $(basename "$0") <repo-folder-name> ...  (a non-empty repo name is required)" >&2; exit 2 ;;
  esac
  [ -d "$ROOT/$REPO/.git" ] || { echo "$REPO: not a cloned repo under $ROOT" >&2; exit 2; }
  cd "$ROOT/$REPO" || exit 1
}

# prints the dirty paths (empty when clean); fails closed when git itself errors
dirty_paths() {
  local out
  out="$(git status --porcelain 2>&1)" || { echo "git status failed: $out"; return 0; }
  printf '%s\n' "$out" | grep -v -e '^$' -e '^?? \.idea/$' -e '^?? node_modules/$'
  return 0
}

require_clean() {
  local d
  d="$(dirty_paths)"
  [ -z "$d" ] || { echo "$REPO DIRTY (refusing to touch a tree with uncommitted changes):" >&2; printf '%s\n' "$d" | head -5 >&2; exit 3; }
}
