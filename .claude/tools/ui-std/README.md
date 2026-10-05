# UI standard tooling (ETF brand apps, ETFs hub, Stocks)

One shared look and behavior for the 29 brand apps, the hub (`../../src/main.tsx`) and Stocks (`../Stocks`). The rules live in `.claude/rules/ui-standard.md`; this folder holds the code blocks, and the browser tests that produced them. Everything runs with Bun only, no tsconfig, no typescript

## Blocks (copied verbatim into every `src/main.tsx`)

| File | What it is | Marker in main.tsx |
| --- | --- | --- |
| `filter-engine.tsx` | column types, auto-detection, filter grammar (pure, no DOM) | `3b. Column types, auto-detection` |
| `filter-ui.tsx` | type badges, filter row, toolbar events | `3c. Column filters` |
| `dropdown.tsx` | multi-select popover (search, All, Clear, Toggle, Reset, Only, locked rows) | inside `3e` |
| `columns-engine.tsx` | the Columns menu (hides cells with CSS by position, state in localStorage) | `3e. Columns menu` |
| `categories-block.tsx` | the Asset classes dropdown that replaces the category tabs | `3f. Categories dropdown` |
| `columns.css` | CSS of the dropdown and the trigger buttons, inserted into `src/index.css` | `.dd-trigger` |
| `readme-block.md` | the `### Column types and filters` README section | |

The engine and UI blocks must stay byte-identical across repos except the one `FILTER_STORAGE_PREFIX` line. Block 3d (`FUND_FILTER_COLUMNS`, `sheetView`, ...) is derived per repo (the Python port scripts are deleted)

## Browser tests (headless Chrome over CDP, serve the BUILT site with `bunx serve`)

The apps are Parcel builds: run `bun run build` first and pass `<repoDir>/dist` (not the repo root) as the directory argument; the tests keep `?api=remote` for the hub. Check the port is free (`lsof -nP -iTCP:<port> -sTCP:LISTEN | wc -l` = 0), otherwise `serve` fails silently and the test hits another site

- `brand-uitest.ts <repoDir> <port> <png>` - filters of a brand app against its real feed; repo variants `brand-uitest-{proshares,spdr,vaneck,globalx,invesco}.ts`, `{fidelity,franklin,neos,themes}-uitest.ts`
- `columns-uitest.ts`, `categories-uitest.ts` - same arguments; Columns menu and Asset classes dropdown (a single-category repo only checks that the dropdown is hidden)
- `hub-uitest.ts`, `hub-columns-test.ts` (+ `lib.ts`) - the hub: `bun hub-columns-test.ts <hubDir> <port> <png>`
- `stocks-filters-uitest.ts <url>`, `stocks-columns-uitest.ts <url>` - Stocks, served e.g. at `http://localhost:1370/`
- `stocks-columns-uitest.ts` also checks the locked rows and the aligned numbers

A test must end with `N passed, 0 failed; console errors: none`. Kill stray `cdp-*` Chrome and `serve` processes between runs and retry a flaky CDN load once


## Cleaning up after a rollout

`../cleanup-branches.sh <dir> <GitHub repo name> dry|do` lists and deletes local and remote branches whose work is already in `main` (every patch present, or a MERGED PR with the same tip). It keeps open PRs and anything unmerged, and never touches a branch checked out in a worktree
