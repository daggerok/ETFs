# Brief: port the column types and column filters to one ETF brand app

Tool names are case-sensitive: `Bash`, `Read`, `Write`, `Edit`.

## Context

The owner (Maksim) asked for the same column type auto-detection and per-column filters that already work in the
`Stocks` app (github.com/daggerok/Stocks) in all 29 ETF brand apps and in the ETFs hub. Every brand repo is a
single-brand static app (`app.tsx` compiled in the browser by Babel standalone, `index.html`, `api/<slug>/` feed).
The feature: a type badge in every table header (`ABC` text, `123` number, `%` percentage, `$` money, `D` date,
`DT` date and time, `T` time), detected from the cell texts and overridable by clicking the badge, and a row of
filter inputs under the headers with a small expression grammar (space AND, comma OR, `!` NOT, `?` empty, ranges,
`K M B T` suffixes, partial dates like `2024`, relative dates like `-7d..`). It applies to the ETF catalog, the
Watchlist, and the Holdings, History and Distributions tabs.

A verified reference port exists on Schwab: read `git -C <ROLLOUT>/Schwab show HEAD` (commit "feat(app): detect
column types and add per-column filters") and the files in `<PORTREF>/` (`filter-engine.tsx`, `filter-ui.tsx`,
`apply-port.py`, `brand-uitest.ts`, `readme-block.md`). The result must behave EXACTLY like the Schwab port.

Paths (substitute): `ROLLOUT=<SCRATCH>/rollout`,
`PORTREF=<ETFs>/.claude/tools/ui-std`, `STD=/Users/maksim.kostromin/Documents/code/private/ETFs/.claude/tools/etf-std`.

## Rules that must hold

- Work ONLY in your own clone `<ROLLOUT>/<Repo>` (already on branch `feat/column-types-and-filters`, created from the freshly fetched `origin/main`). Never touch `/Users/maksim.kostromin/Documents/code/private/ETFs/<Repo>` (the owner's checkouts), never `git checkout -- .` outside your clone, never push, never open or merge a PR: the lead ships. Commit locally only.
- `app.tsx` is compiled by Babel standalone in the browser: no `as` casts, no non-null `!`, no interfaces or enums, plain `byId()`/`document.getElementById`. Keep the `/// <reference types="bun" />` line untouched at its position.
- Bun only: never add `tsconfig.json` or `typescript`. Do not touch `scripts/`, `.github/`, `api/`, `package.json` or `bun.lock`.
- Commit message: Conventional Commits, exactly `feat(app): detect column types and add per-column filters`. Prose in files and in your report: plain hyphen `-` instead of em/en dashes, `->` instead of arrows, no trailing period at the end of paragraphs or list items.
- The engine block (3b) and the filter UI block (3c) must stay byte-identical to `<PORTREF>/filter-engine.tsx` and `<PORTREF>/filter-ui.tsx` (except the one `FILTER_STORAGE_PREFIX` line, which is the repo's localStorage prefix). Only the repo-specific block 3d (`FUND_FILTER_COLUMNS`, `WATCHLIST_FILTER_COLUMNS`, `filteredCatalogFunds`, `sheetView`) and the integration edits may differ.

## Steps

1. `cd <ROLLOUT>/<Repo> && git status --short && git branch --show-current` (must be clean, on `feat/column-types-and-filters`). Run `git fetch origin && git log --oneline origin/main -1` and confirm `origin/main` is an ancestor of HEAD (`git merge-base --is-ancestor origin/main HEAD`); if not, `git rebase origin/main`.
2. `python3 <PORTREF>/apply-port.py .` It prints OK or SKIPPED per edit. Do every SKIPPED edit by hand, mirroring the Schwab diff (`git -C <ROLLOUT>/Schwab show HEAD -- app.tsx index.html`). Where this repo's code differs from Schwab (other columns, other tab structure, other helper names, extra tables), adapt the integration so that EVERY table that has sortable column headers gets: `applyColumnFilters(scope, ...)` before the head is rendered, header badges via `filterBadgeFor`, the filter row via `appendFilterRow()`, and exports/Copy Tickers/select-all scopes that follow the filtered rows. Scopes: `catalog`, `watchlist`, `holdings`, `history`, `distributions` (use the same names).
3. REVIEW the derived block 3d: `FUND_FILTER_COLUMNS` must list exactly the columns of this repo's catalog table in header order, each `key` equal to the key passed to `sortHeader`, `text` equal to what the row cell displays, `value` the raw number for numeric columns. Fix any wrong derived entry (for example a column whose cell is built with a helper the script could not read).
4. `bun build --target=bun app.tsx --outfile=/dev/null` must succeed.
5. Add the README block: insert the contents of `<PORTREF>/readme-block.md` immediately before the `## Updating the static` heading of `README.md` (adjust the words ETF/Watchlist/tab names only if this repo's tabs differ). Then `bun $STD/check-readme.ts .` must print `ok`.
6. Browser verification: `bun <PORTREF>/brand-uitest.ts <ROLLOUT>/<Repo> <PORT> <ROLLOUT>/../<repo>-ui.png` (the port is given in your task; run it from your clone directory). It must end with `N passed, 0 failed; console errors: none`. If a check fails because of a repo difference (a missing column, no holdings for the first funds, different state names), fix the app if the app is wrong; if the harness assumption is wrong, run a corrected COPY of the harness and say exactly what you changed. Also open the screenshot (`Read` the png) and check the layout: type badges in every header, the filter row under it, nothing overlapping.
7. Gates in your clone: `bun install --frozen-lockfile`, `bun test` (exit code 0, check `echo $?`), `bun build --target=bun scripts/update-data.ts --outfile=/dev/null`, `git diff --check`, `bun $STD/check-workflow.ts .`, `bun $STD/check-scripts.ts .`.
8. `git add -A` (only `app.tsx`, `index.html`, `README.md` may change; `git status --short` must show nothing else) and commit locally.

## Report (final message, under 25 lines)

Repo, final `git log --oneline -2`, which apply-port edits were SKIPPED and how you handled them, differences from Schwab you had to handle (columns, tabs, helpers), the final line of the browser test (`N passed, 0 failed ...`), the gate results, and anything suspicious you noticed (bugs unrelated to this task are only reported, never fixed).
