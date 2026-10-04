# UI standard tooling (ETF brand apps, ETFs hub, Stocks)

One shared look and behavior for the 29 brand apps, the hub (`../../app.tsx`) and Stocks (`../Stocks`). The rules live in `.claude/rules/ui-standard.md`; this folder holds the code blocks, the scripted ports and the browser tests that produced them. Everything runs with Bun only, no tsconfig, no typescript

## Blocks (copied verbatim into every `app.tsx`)

| File | What it is | Marker in app.tsx |
| --- | --- | --- |
| `filter-engine.tsx` | column types, auto-detection, filter grammar (pure, no DOM) | `3b. Column types, auto-detection` |
| `filter-ui.tsx` | type badges, filter row, toolbar events | `3c. Column filters` |
| `dropdown.tsx` | multi-select popover (search, All, Clear, Toggle, Reset, Only, locked rows) | inside `3e` |
| `columns-engine.tsx` | the Columns menu (hides cells with CSS by position, state in localStorage) | `3e. Columns menu` |
| `categories-block.tsx` | the Asset classes dropdown that replaces the category tabs | `3f. Categories dropdown` |
| `columns.css` | CSS of the dropdown and the trigger buttons, inserted before `</style>` | `.dd-trigger` |
| `readme-block.md` | the `### Column types and filters` README section | |

The engine and UI blocks must stay byte-identical across repos except the one `FILTER_STORAGE_PREFIX` line. Block 3d (`FUND_FILTER_COLUMNS`, `sheetView`, ...) is derived per repo by `apply-port.py`

## Ports (idempotent, print OK or SKIPPED per edit, do SKIPPED ones by hand)

- `apply-port.py <repo>` - filters: blocks 3b-3d, header badges, filter row, README
- `apply-columns.py <repo>` - Columns menu (needs the filters port), toolbar wrap, README paragraph
- `apply-toolbar.py <repo>` - Asset classes dropdown instead of category tabs, Filters/Columns after it, Copy Tickers before Upload, README paragraph

Run them on a fresh clone on a feature branch off `origin/main`, never in the owner's checkout. Where an app is indented (Fidelity, Franklin, Invesco) the scripts accept an indented `init();`

## Browser tests (headless Chrome over CDP, serve the repo with `bunx serve`)

- `brand-uitest.ts <repoDir> <port> <png>` - filters of a brand app against its real feed; repo variants `brand-uitest-{proshares,spdr,vaneck,globalx,invesco}.ts`, `{fidelity,franklin,neos,themes}-uitest.ts`
- `columns-uitest.ts`, `categories-uitest.ts` - same arguments; Columns menu and Asset classes dropdown (a single-category repo only checks that the dropdown is hidden)
- `hub-uitest.ts`, `hub-columns-test.ts` (+ `lib.ts`) - the hub: `bun hub-columns-test.ts <hubDir> <port> <png>`
- `stocks-filters-uitest.ts <url>`, `stocks-columns-uitest.ts <url>` - Stocks, served e.g. at `http://localhost:1370/`
- `stocks-columns-uitest.ts` also checks the locked rows and the aligned numbers

A test must end with `N passed, 0 failed; console errors: none`. Kill stray `cdp-*` Chrome and `serve` processes between runs and retry a flaky CDN load once

## Rollout scripts

`ETF_SCRATCH=<tmp dir with rollout/<Repo> clones> bash ship-tb.sh <Repo> <port>` applies a port, runs every gate (install, `bun test` exit 0, both builds, `git diff --check`, check-readme, check-workflow, check-scripts, exec bit) and the three browser tests, pushes, opens the PR and squash-merges it. `ship-cols.sh` and `cols-prep.sh` are the Columns variants. Run at most 3 in parallel with `xargs -P3 -L1`, ports 5 apart. Agents only commit locally, the lead ships (see `etf-working-lessons.md`)

## Cleaning up after a rollout

`../cleanup-branches.sh <dir> <GitHub repo name> dry|do` lists and deletes local and remote branches whose work is already in `main` (every patch present, or a MERGED PR with the same tip). It keeps open PRs and anything unmerged, and never touches a branch checked out in a worktree
