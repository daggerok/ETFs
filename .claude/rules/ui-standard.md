# UI standard: ETF brand apps, ETFs hub and Stocks look and behave the same

Applies to every `src/main.tsx` / `src/index.html` / `src/index.css` in the 29 brand repos, the ETFs hub and `../Stocks`. Code blocks, scripted ports and browser tests live in `.claude/tools/ui-std/` (README there); never re-implement a feature by hand in one repo, change the block and re-port

## Table features (all three families)
- Column types (`ABC` text, `123` number, `%` percentage, `$` money, `D` date, `DT` date and time, `T` time) are detected from the cell texts, a badge in the header cycles them, Shift+click resets
- A row of filter inputs sits under the headers (space AND, comma OR, `!` NOT, `?` empty, ranges, `K M B T` suffixes, text `=exact ^starts ends$ /regex/`, partial and relative dates). Filters apply to every column, also to columns hidden in the Columns menu
- The `Columns` menu lists every column first to last, all selected by default, with search and All, Clear, Toggle, Reset, Only. `Use` and `Ticker` are listed but locked (no Only button, an invisible placeholder keeps the position numbers aligned). The choice is saved in localStorage (never the data)
- Hiding a column only hides its cells (brand apps: CSS by cell position) so sorting, filters, exports and Copy Tickers keep working
- Brand apps: the category tabs are one `Asset classes` multi-select next to the `All ETFs` pill. All classes checked by default, unchecking every class is the All ETFs view, the pill is lit only while nothing narrows the table, clicking it clears the selection. A single-category app hides the dropdown

## Labels and toolbar order
- Short labels: `Filters: on` / `Filters: off` (never `Column filters: shown`), `Columns: 24 of 24`, `Asset classes: All`
- Toolbar, first row: search, All ETFs pill, Asset classes (hub: Brands, Categories), Columns, Filters (and Clear filters). Action buttons on the right: Copy Tickers, then Upload / Drop N-PORT XML where the app has it, Export .csv, Export .txt, Clear, Blacklist. The action bar may wrap, nothing may poke out of the card at 1500 px

## Footer (all ETF repos, Stocks and gex, owner 2026-10-07)
- Same footer as the `gex` repo: a centered link `daggerok &copy; <current year>` (the year is set at run time by an inline script, id `footer-year`) that opens the repository of the app (`https://github.com/daggerok/<Repo>`), 10px text, `text-slate-400`, dotted underline
- Spacing follows the side gutter of the site (header and `main` use `px-4 sm:px-8`): the footer uses the same side padding, and its text line plus the bottom padding add up to one gutter (`pb-[3.5px] sm:pb-[19.5px]` for a 12.5px line: 16px, 32px from `sm`). Whatever the footer content is (the hub keeps its disclaimer above the link line), the box model stays the same. In `gex` the footer shows on Desk and GEX, the Chart tab keeps the TradingView notice
- Brand apps: the footer sits right after `</main>` inside the page container; `bun .claude/tools/...` has no script for it any more, edit `src/index.html` in every repo when it changes

## Wide catalog tables
Fidelity, SPDR and WisdomTree have `min-width:max-content` in the `#table-scroll table{...}` rule of `src/index.css` (without it their columns squeeze and overlap). Do NOT add it to the other brands: it widens their columns and pushes columns out of the view (measured on AAM and Schwab, 3-4% of the pixels change). Everything else in `src/index.css` is the same file in all repos.

## Code rules for the Parcel build
- `src/main.tsx` is built by Parcel (`bun run build`, no longer compiled in the browser): keep the old style anyway (no `as` casts, no non-null `!`, no interfaces or enums) so ported blocks stay byte-identical; keep the `/// <reference types=...>` line (see `reference-types.md`)
- Blocks go before the top-level (or indented) `init();` so no `const` is read before its declaration

## Change process
- Change the block in `.claude/tools/ui-std`, prove it on one brand (Schwab) with the browser tests, ask the owner to look, then roll it out with a script of your own (3 in parallel, the old `ship-*.sh` and `apply-*.py` ports of the browser-compiled layout are deleted) and ship every repo through its own PR (squash for ETF repos, rebase-merge for Stocks). Update the hub and Stocks in the same round, they are not covered by the brand scripts
- Every UI change needs a browser test result ending `0 failed; console errors: none`; `bun test` must exit 0

**Why:** the owner asked for the same filters, Columns menu and toolbar everywhere (2026-10-03/04) and corrected labels and button order several times; Stocks is outside `registry.json`, so it needs this rule explicitly

**How to apply:** when asked for any UI change in one of the families, ask whether the others need it too and port it with the tools above
