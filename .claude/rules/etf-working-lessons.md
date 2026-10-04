# Lessons from the 29-repo standardization (mistakes not to repeat)

## Process
- Re-survey before acting: other sessions ("arena" runs, the owner) merge, close and rewrite repos while you work. Check `gh pr list --state all`, `git log origin/main` and Pages state first. Pacer and Sprott were rebuilt and merged by someone else and made earlier work obsolete
- Never touch a working tree with uncommitted changes you did not make (Pacer had some): use `git worktree` instead. Untracked `.idea/` and `node_modules` are the owner's
- Use a git-tracked check, not memory: run the check scripts on every repo after any shared change. Pass repo lists as bash arrays or scripts; in zsh an unquoted `$VAR` list is not word-split and the checkers silently failed
- `sleep` followed by commands is blocked here: use `Monitor` with an until-loop, or run in the background
- At most 20 subagents run at once: launch the rest as slots free up, and read each report for deviations (agents quietly dropped controls, deleted workflows, hand-edited YAML)
- In `sed`/JS replacement strings `$1` is a capture group: a shell snippet containing `"$1"` was corrupted. Verify the diff of generated YAML after scripted edits
- Tests that hard-code a count (27 brands) or a file list (pages.yml) break when the registry or workflows change: after any such change run `bun test` in every repo before merging
- Merge only after gates pass (install, test, build, diff --check, readme/workflow/scripts checks, exec bit). `gh pr merge --squash`. Dependabot bumps: comment `@dependabot rebase`, then test and merge; close PRs for removed workflows
- After merging, check main and dispatch `update-data.yml` with one ticker per repo to prove the CI path (resolver step, GITHUB_ENV, commit/push)

## Facts worth remembering
- Do not weaken security when regenerating files: round 1 silently lost `persist-credentials: false`, `timeout-minutes` and token-scoped push in two repos
- "0 funds updated" is often a correct `unchanged`; SEC returns 403 without a contact in the User-Agent
- Live API data in `api/` must never be committed by a test or acceptance run: `git checkout -- api/` and delete created files
- Commit messages follow Conventional Commits; the owner's prose style uses plain hyphens and `->`, no trailing periods

## Branch hygiene (after the 2026-10-04 cleanup)
- Merge with `gh pr merge --squash --delete-branch` (Stocks: `--rebase --delete-branch`) so no remote branch survives, then `git switch main && git pull --ff-only` and delete the local branch
- Squash and rebase merges leave the local branch looking unmerged (`git branch --merged` is empty): verify with `git cherry origin/main <branch>` (no `+` lines) or a MERGED PR whose head SHA equals the branch tip before `git branch -D`
- `.claude/tools/cleanup-branches.sh <dir> <repo> dry|do` does exactly that for local and remote branches; run it per repo after every rollout (`for d in ETFs/*/; do ...; done`)
- Never delete a branch that is checked out in a git worktree or whose worktree has uncommitted changes (a stale overnight worktree held real uncommitted work); report it to the owner instead
- A command like `cat > file` without a heredoc waits on stdin forever and hangs a background run: always give it input
