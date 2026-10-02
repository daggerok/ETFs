#!/usr/bin/env bash

set -euo pipefail

# Work from the hub root (the parent of scripts/) no matter where this script is started from:
# it fast-forwards main of every sibling ETF repo cloned next to the hub (see scripts/install.sh).
cd "$(dirname "$0")/.."

for dir in */; do
  if [ -d "$dir/.git" ]; then
    echo "========================================"
    echo "Processing repository: ${dir%/}"
    echo "========================================"

    (
      cd "$dir" || exit 1

      echo "Fetching with prune and tags..."
      git fetch -pat

      # Определяем дефолтную ветку
      TARGET_BRANCH=""
      if git show-ref --verify --quiet refs/heads/main || git show-ref --verify --quiet refs/remotes/origin/main; then
        TARGET_BRANCH="main"
      elif git show-ref --verify --quiet refs/heads/master || git show-ref --verify --quiet refs/remotes/origin/master; then
        TARGET_BRANCH="master"
      fi

      if [ -n "$TARGET_BRANCH" ]; then
        echo "Checking out $TARGET_BRANCH..."
        git checkout "$TARGET_BRANCH"

        echo "Fast-forwarding $TARGET_BRANCH..."
        git merge --ff-only "origin/$TARGET_BRANCH" || git pull origin "$TARGET_BRANCH"
      else
        echo "Warning: Neither main nor master found in ${dir%/}. Skipping."
      fi
    ) || echo "Error processing ${dir%/}, moving to next..."

    echo ""
  fi
done

echo "Done!"