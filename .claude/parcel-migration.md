# Parcel migration (2026-10-05): the 29 brand repos, the hub and Stocks

Babel standalone + Tailwind Play CDN replaced by Parcel + Tailwind v4, deployed by `.github/workflows/github-pages.yml` (Pages source = GitHub Actions, `build_type: workflow`). Stocks was the proof (PR #19, #21), AAM the brand pilot, then every brand repo got one PR (squash) and the hub PR #46 with fixes #47 and #48

## Why
- The Play CDN re-scans the whole DOM on every mutation (about 50 ms per change at 1200 rows), Babel standalone compiles about 3900 lines of TypeScript in the browser on every load
- Stocks result: `dist/` 97 kB JS + 48 kB CSS, built in about 3 s

## Result
- Layout, scripts and workflow: `rules/etf-repo-standard.md`, `tools/etf-std/STANDARD.md` (sections 2 and 8); check: `bun tools/etf-std/check-pages.ts <repoDir>...`
- `bun run build` runs `clean` first and copies `api/` into `dist/api` last (`ncp`): the data is part of the Pages artifact, a site is limited to 1 GB. Sizes: iShares `dist` 789 MB (the only one near the limit, the rule was to stop and ask above 900 MB), the other brands far below
- The shared browser tests need app functions on `window`: the module scope hides top-level names, so `src/main.tsx` ends with an `Object.assign(window, {...})` hook block (a getter for reassigned `let` variables). Tests serve `dist`, see `tools/ui-std/README.md`
- Anchors with a relative `./api/...` href break the Parcel build (it resolves them as dependencies): they are `href="#" data-feed-link="api/..."` and `main.tsx` sets the real URL at run time
- Tailwind v3 -> v4 differences were found by pixel diff (0% after the fixes): `space-y`/`space-x` compat rules, renamed utilities (`shadow-sm` -> `shadow-xs`, `rounded` -> `rounded-sm`, `outline-none` -> `outline-hidden`, `ring` -> `ring-3`, `flex-shrink-*` -> `shrink-*`), default border color `currentColor`, buttons lost `cursor: pointer`, class based `dark:` via `@custom-variant`

## The Jekyll overwrite race (the order that works)
The push of the merge also starts the OLD "pages build and deployment" run (event `dynamic`, Jekyll). If it finishes after our workflow it overwrites the deployment and `github.io/<Repo>/` shows the README instead of the app. Order per repo:
1. merge the PR
2. switch the source: `gh api -X PUT repos/daggerok/<Repo>/pages -f build_type=workflow`
3. wait until no run of the repo is queued or in progress, dispatch `github-pages.yml`, wait for success
4. check the live site (rows shown, no console errors, no CDN, not the Jekyll README) and check it a second time later: a stale queued Jekyll run can still land. If the page is the README, dispatch again

## GitHub Actions incident of 2026-10-05
Hosted runners were not acquired for hours: deploy jobs sat queued 15-47 min and were cancelled without steps (Sprott, aberdeen, Northern-Trust, Xtrackers, Franklin, Global-X, JPMorgan and others needed 2-3 dispatches). A merged repo with `build_type: workflow` and no successful deploy keeps showing the old site (or the Jekyll README): re-dispatch `github-pages.yml` until it succeeds, nothing in the repo needs to change. Cancelling queued runs through the API was rate-limited once

## Hub gotcha
The hub `.gitignore` starts with `/*/` (every top-level folder is a sibling repo) and then whitelists the hub folders. `src/` was missing from the whitelist, so the stylesheet never reached the repository and the first deploy had no CSS (fix #48: `!/src/`). Any new top-level hub folder needs a `!/<name>/` line
