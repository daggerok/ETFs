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
