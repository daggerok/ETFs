# ETFs

One of the app's features lets you select ETFs of any brand in the Watchlist and aggregate their holdings to see how often each ticker appears across the selected funds. Repeated holdings make overlapping exposure visible: the more selected funds include a ticker, the greater its potential influence on the portfolio; gains in that holding may help, while declines may hurt, and actual impact also depends on each fund's position size. Another feature makes it faster and easier to find funds with stronger growth over different periods, higher dividend yields or distributions, greater Total Return (price performance plus dividends), and other key performance metrics, across all brands at once: for example, sort every ETF of every brand by TR 1Y descending and build a Watchlist that mixes funds of different brands. A single-file client-side tool that reads the generated `api/<slug>` static feeds of the 29 sibling applications at runtime into one searchable ETF catalog with per-fund tabs, cross-brand watchlist aggregation, ticker copy and CSV/TXT export - the same look, feel, columns and business logic as the sibling applications, with no build step, no bundler, no dependencies, no data files and no aggregator

## Using Bun

```bash
bunx degit daggerok/ETFs#main ./12345 && cd $_
bunx serve . -p 1234
open http://0:1234
```

The application is published at <https://daggerok.github.io/ETFs/>. The Pages deployment comes only from `main`.

The degit quick start gives only the hub files, so the data is loaded from the sibling applications' GitHub Pages feeds. For fully local data, clone the hub and the sibling repositories next to it:

```bash
git clone https://github.com/daggerok/ETFs && cd ETFs
./scripts/install.sh --depth 1
bunx serve . -p 1234
```

`./scripts/install.sh` clones the 29 sibling repositories into subfolders of the hub folder (they are ignored by the hub's `.gitignore`):

- no arguments clones all of them with full history; `--depth 1` (`-d 1`) is the fastest and smallest way to just run the app
- repositories can be listed positionally, separated by spaces and/or commas, case-insensitive: `./scripts/install.sh VanEck Tema` or `./scripts/install.sh VanEck,Tema`
- `-s` / `--ssh` clones over SSH instead of HTTPS, `-p N` / `--parallel N` sets the parallel clones (default 1), `-h` / `--help` prints the usage

`./scripts/update.sh` fetches (with prune and tags) and fast-forwards `main` (or `master`) of every cloned repository to get fresh data. It switches every repository to that branch first: a clone sitting on a feature branch is moved off it (the checkout fails instead of overwriting when uncommitted changes conflict), so commit or stash work in progress before running it. It takes the same style of arguments: no arguments updates every cloned repository, repositories can be listed positionally (`./scripts/update.sh VanEck Tema` or `VanEck,Tema`), `-p N` / `--parallel N` sets how many are updated in parallel (default 1) and `-h` / `--help` prints the usage. Git output streams live (with several parallel jobs each repository's block is printed as soon as it finishes) and the exit code is non-zero if any repository failed. All three scripts resolve the hub root from their own location, so they work from any working directory. Every cloned repository stays an independent git repository, so you can develop, commit and open pull requests in any of them separately.

`./scripts/clean.sh` removes the cloned sibling repositories again (all of them, or only the listed ones: `./scripts/clean.sh VanEck Tema` or `VanEck,Tema`; `-p N` / `--parallel N`, default 1). A repository with uncommitted changes, ignored files, unpushed commits, a detached-HEAD commit or stash entries is never removed, and neither is one on which git itself fails (a broken clone is reported, not deleted): it is kept with a message, so no work is lost. A repository listed twice is handled once. Only the known ETF repositories are touched, never the hub files.

`./scripts/install.sh` first checks that git is installed (it fails if it is not), installs bun with the official script when bun is missing, runs `bun i -E` for the hub packages and then clones the repositories.

### Data sources

Each brand repository publishes the standard feed `api/<slug>/index.json` plus per-fund `funds/<TICKER>/meta.json`, `holdings/NNN.json` and `history/NNN.json` pages; the hub only reads them. The base URL of every brand is chosen like this:

| Situation | Base URL |
| --- | --- |
| `location.hostname` ends with `github.io` | `https://daggerok.github.io/<Repo>/api/<slug>/` |
| anything else, such as local `bunx serve . -p 1234` | `./<Repo>/api/<slug>/`, the sibling folder next to the hub; when that brand's `index.json` is missing or fails (for example after `degit`, where no sibling folders exist) the brand is retried from `https://daggerok.github.io/<Repo>/api/<slug>/`, and that base is then used for the brand's per-fund files too; such brands get a small `remote` badge in the brand filter |
| `?api=remote` | always `https://daggerok.github.io/<Repo>/api/<slug>/`, so local development can test production data |
| `?api=local` | strictly `./<Repo>/api/<slug>/`, no fallback |

GitHub Pages serves every site with `access-control-allow-origin: *`, so reading the feeds from the hub or from `localhost` needs no proxy. The feeds themselves come from the issuers' public pages, SEC EDGAR and Yahoo Finance.

How it works:

- Startup: the 29 brand indexes are fetched in parallel by a pool of 8 workers with a progress counter; a brand that fails (404, network, 25 s timeout) is marked unavailable with a small badge and everything else keeps working
- Cache: every brand index is stored in IndexedDB keyed by origin, api mode and repo together with its `generatedAt`, and revalidated with `fetch(url, { cache: 'no-cache' })`; the first paint comes from the cache when one exists. Every storage access is wrapped in try/catch
- Memory: rows are normalized once into Float64Arrays for the sortable numerics (NaN means unavailable) and small integer dictionaries for brand, category and returns basis, so about 2,500 funds sort and filter in a few milliseconds; the DOM is windowed (200 rows, more are appended while you scroll)
- Sorting: unavailable values always sort last, in both directions, and are shown as a dash, never as `0`
- Filters: search (words are ANDed across ticker, name, brand, category, returns basis and exchange; `brand:vaneck`, `category:"fixed income"`, `ticker:spy`, `basis:official` target one field; typing a brand or category also suggests it, and picking a suggestion edits the same selection as the dropdowns), brand and category multi-selects (search, All, Clear, Toggle, Reset, per-row Only; bulk actions act on the rows shown, the selection accumulates across searches) and `Hide stale returns (older than N days)`, which hides funds whose `performanceAsOf` is older than N days (default 45) or unknown; it is off by default
- Source badge: each row shows `metrics.returnsBasis` as a badge (`NAV` official, `mixed` official with derived gaps, `derived` computed from price or NAV history, `n/a`) and `performanceAsOf` as Return As Of
- Yield Basis column (right after SEC Yield): a short badge for `metrics.dividendYieldBasis` (`12M` official trailing 12-month, `DIST` official distribution rate, `OFFC` official other definition, `CALC` computed trailing 12-month, `IND` indicated); hovering the badge or the Dividend Yield value shows the full label, a dash and `Basis not in the feed yet` mean the feed does not carry the key. The column sorts, filters as text (the label, e.g. `trailing`) and is exported as the label
- Watchlist: Use checkboxes (persisted in `localStorage` per brand and ticker) select funds across brands; their holdings pages are loaded on demand from each fund's own brand base and aggregated by ticker (CUSIP, ISIN, identifier or name when a position has no ticker); detail tabs (Overview, Holdings, History, Distributions) load on demand the same way

### Column types and filters

Every column of the ETF catalog and of the Watchlist, Holdings, History and Distributions tabs has a type: text (`ABC`), number (`123`), percentage (`%`), money (`$`), date (`D`), date and time (`DT`) or time of day (`T`). The type is detected from the texts the column shows (80% of the filled cells must agree, otherwise text) and is written in the badge next to the column title: click it to cycle the type, Shift+click to return to auto-detection. Dates are read as `2024-06-15`, `6/15/2024`, `15.06.2024`, `Jun 15, 2024` or `15-Jun-2024`, date and time as `2024-06-15T09:30:00Z` or `2024-06-15 09:30`, time as `09:30`, `16:00:00` or `9:30 PM`

A row of filter inputs sits under the column headers (the `Column filters` button hides it, `Clear filters` empties it). Filters of different columns are combined with AND, the search box, the Brands and Categories dropdowns, the stale toggle and the blacklist apply on top, and Copy Tickers, the CSV and TXT exports and the `Use` select-all checkbox follow the filtered rows. Filters and type overrides are remembered in the browser (`etf-hub-column-filters`, `etf-hub-column-types`, `etf-hub-show-filters`); the Holdings, History and Distributions filters are keyed by the column title, because the sheets differ between brands

The `Columns` menu (next to Brands and Categories) lists every column of the catalog table from the first to the last, all shown by default, with a search box and the `All`, `Clear`, `Toggle` and `Reset` buttons. `Use` and `Ticker` are listed but locked. Hiding a column only removes it from the table: the filters, the sorting, the exports and Copy Tickers still use it. The choice is remembered in the browser (`hiddenCols` in `etf-hub-view-filters`, never the data) and the menu is shown on the catalog tabs only

Inside one filter: a space means AND, a comma means OR, a leading `!` means NOT, `?` matches an empty or unavailable value and `!?` a value that is there; a value that is unavailable matches only `?` and negated conditions. An unquoted space ends the value, so quote values that contain one (`>="2024-06-15 09:30"`)

| Type | Examples |
| --- | --- |
| Text | `bank` contains, `"two words"`, `!bank`, `=exact`, `^starts`, `ends$`, `/regex/`, `tech, health` |
| Number, percentage, money | `>10`, `>=10 <50`, `=22` (matches what rounds to 22), `!=22`, `10..50`, `..50`, `10..`, `>1B` and `K` `M` `B` `T` suffixes, an optional `$` or `%` |
| Date, date and time | `>2024-06-01`, `2024` (the whole year), `2024-06` (the whole month), `2024-01..2024-06`, `today`, `yesterday`, `-7d..` (the last 7 days), `+2w`, `-3m`, `-1y` |
| Time | `>09:30`, `09:30..16:00`, `=12:00` (the whole minute) |

### Metrics and caveats

Returns come from different sources and different dates: an issuer's official NAV table, a month-end or quarter-end series, or an estimate derived from Yahoo Finance prices. Compare funds with the source badge and the Return As Of column in view, and use the stale toggle to drop old figures. Unavailable data is never published as zero: it is a dash in the table and sorts last.

The hub shows exactly what each brand feed publishes under the shared `metrics` contract (`ytd`, `tr1y`, `tr3y`, `tr5y`, `tr10y`, `cagr3y`, `cagr5y`, `cagr10y`, `siAnn`, `dividendYield`, `secYield`, `returnsBasis`, `performanceAsOf`), so it is only as fresh as the latest run of each brand's updater. Selecting more than 150 funds at once asks for confirmation, because holdings of every selected fund are loaded (several requests each).

Expense ratio: the Expense column shows the NET ratio (`terValue`, after waivers) and the tooltip shows the GROSS ratio (`terGrossValue`) when a brand publishes it; the CSV carries both. A fund whose feed row has `dataFile: null` (no per-fund files) only gets the Overview tab. Holdings of a fund count as loaded only when every page arrived: a failed request marks that fund as failed (the Watchlist count shows `N+`) and selecting it again retries; meta.json and page requests time out after 30 s. A holding without a published weight stays a dash in the Watchlist, never `0.000%`.

Exports (CSV and TXT) contain exactly the rows the table shows, in the same filter and sort, with a header row; the CSV is UTF-8 with a BOM, quotes CR/LF, commas and quotes, and prefixes text cells that start with `=`, `+`, `-` or `@` with an apostrophe. When the data is incomplete (a holdings or history sheet with unloaded pages, a Watchlist still loading) the export asks for confirmation first. Copy Tickers copies exchange tickers only (Watchlist rows keyed by CUSIP, ISIN or name are skipped) and the shown fund's ticker on detail tabs.

The Source badge reads `metrics.returnsBasis`: `NAV` when it starts with `official` and names no gap filling, `mixed` when official figures have gaps filled from Yahoo or estimates, `derived` for everything else that is not official, `n/a` when none. Wording that negates a source (`no Yahoo or market-price estimates`, `not derived from Yahoo`) and exact math on official figures (`derived from the published annualized values`) stay `NAV`.

## TypeScript and verification

The browser app is intentionally build-free: `index.html` carries the markup, styles and bootstrap, and `app.tsx` is TypeScript compiled in the browser with Babel standalone - no build step, no bundler, no `tsconfig.json` needed. Bun runs TypeScript out of the box.

Verification before every publish:

```bash
bun build --target=bun app.tsx --outfile=/dev/null
git diff --check
```

The hub has no updater, tests, workflows or data files; the data is updated in the sibling repositories.

## Brands table

| Brand | Where to get the data |
| --- | --- |
| **AAM** | [aamlive.com](https://www.aamlive.com/ETF) \| [AAM](https://daggerok.github.io/AAM/) |
| **abrdn (Aberdeen)** | [aberdeeninvestments.com](https://www.aberdeeninvestments.com/en-us/investor/funds/etfs) \| [aberdeen](https://daggerok.github.io/aberdeen/) |
| **Amplify** | [amplifyetfs.com](https://amplifyetfs.com/) \| [Amplify](https://daggerok.github.io/Amplify/) |
| **ARK Invest** | [ark-funds.com](https://www.ark-funds.com/our-etfs/) \| [ARK](https://daggerok.github.io/ARK/) |
| **Capital Group** | [capitalgroup.com](https://www.capitalgroup.com/advisor/investments/exchange-traded-funds.html) \| [Capital-Group](https://daggerok.github.io/Capital-Group/) |
| **Fidelity** | [fidelity.com](https://www.fidelity.com/etfs) \| [Fidelity](https://daggerok.github.io/Fidelity/) |
| **First Trust** | [ftportfolios.com](https://www.ftportfolios.com/Retail/etf/etflist.aspx) \| [First-Trust](https://daggerok.github.io/First-Trust/) |
| **Franklin Templeton** | [franklintempleton.com](https://www.franklintempleton.com/investments/options/exchange-traded-funds) \| [Franklin](https://daggerok.github.io/Franklin/) |
| **Global X** | [globalxetfs.com/explore](https://www.globalxetfs.com/explore) \| [Global-X](https://daggerok.github.io/Global-X/) |
| **Goldman Sachs** | [am.gs.com](https://am.gs.com/en-us/individual/funds?locale=en-us&audience=individual&sf=funds&filters=funds%7CETF&limit=100) \| [Goldman-Sachs](https://daggerok.github.io/Goldman-Sachs/) |
| **Invesco** | [invesco.com](https://www.invesco.com/us/en/financial-products/etfs.html) \| [Invesco](https://daggerok.github.io/Invesco/) |
| **iShares** | [ishares.com](https://www.ishares.com/) \| [iShares](https://daggerok.github.io/iShares/) |
| **JPMorgan** | [am.jpmorgan.com](https://am.jpmorgan.com/us/en/asset-management/adv/products/fund-explorer/etf) \| [JPMorgan](https://daggerok.github.io/JPMorgan/) |
| **NEOS** | [neosfunds.com](https://neosfunds.com/#explore-etfs) \| [Neos](https://daggerok.github.io/Neos/) |
| **Northern Trust** | [etfs.ntam.northerntrust.com](https://etfs.ntam.northerntrust.com/us/en/individual/funds) \| [Northern-Trust](https://daggerok.github.io/Northern-Trust/) |
| **Pacer ETFs** | [paceretfs.com](https://www.paceretfs.com/products/) \| [Pacer](https://daggerok.github.io/Pacer/) |
| **Parametric** | [eatonvance.com](https://www.eatonvance.com/products/etfs.html) \| [Parametric](https://daggerok.github.io/Parametric/) |
| **ProShares** | [proshares.com](https://www.proshares.com/our-etfs/find-proshares-etfs) \| [ProShares](https://daggerok.github.io/ProShares/) |
| **Schwab** | [schwabassetmanagement.com](https://www.schwabassetmanagement.com/products) \| [Schwab](https://daggerok.github.io/Schwab/) |
| **SP Funds** | [sp-funds.com](https://www.sp-funds.com/) \| [SP-Funds](https://daggerok.github.io/SP-Funds/) |
| **SPDR** | [ssga.com](https://www.ssga.com/us/en/intermediary/etfs/fund-finder) \| [SPDR](https://daggerok.github.io/SPDR/) |
| **Sprott ETFs** | [sprottetfs.com](https://sprottetfs.com/) \| [Sprott](https://daggerok.github.io/Sprott/) |
| **Tema ETFs** | [temaetfs.com](https://temaetfs.com/funds) \| [Tema](https://daggerok.github.io/Tema/) |
| **Themes ETFs** | [themesetfs.com/etfs](https://themesetfs.com/etfs) \| [Themes](https://daggerok.github.io/Themes/) |
| **VanEck** | [vaneck.com](https://www.vaneck.com/us/en/etf-mutual-fund-finder/) \| [VanEck](https://daggerok.github.io/VanEck/) |
| **Vanguard** | [investor.vanguard.com](https://investor.vanguard.com/etf/list) \| [Vanguard](https://daggerok.github.io/Vanguard/) |
| **VictoryShares** | [vcm.com VictoryShares ETFs](https://www.vcm.com/products/victoryshares-etfs/victoryshares-etfs-list) \| [VictoryShares](https://daggerok.github.io/VictoryShares/) |
| **WisdomTree** | [wisdomtree.com](https://www.wisdomtree.com/investments) \| [WisdomTree](https://daggerok.github.io/WisdomTree/) |
| **Xtrackers** | [etf.dws.com](https://etf.dws.com/en-us/etf-products/) \| [Xtrackers](https://daggerok.github.io/Xtrackers/) |

## Sibling applications

| Application | Data provider | Repository |
| --- | --- | --- |
| AAM | Official AAM catalog/detail HTML + full holdings XLS + SEC N-PORT holdings fallback + Yahoo market history/dividends | [AAM](https://github.com/daggerok/AAM) |
| abrdn (Aberdeen) | Official Aberdeen gateway + SEC N-PORT holdings fallback + Yahoo history/dividends | [aberdeen](https://github.com/daggerok/aberdeen) |
| Amplify | Amplify ETFs Firestore data feed + SEC EDGAR N-PORT-P holdings fallback + Yahoo Finance history/dividends | [Amplify](https://github.com/daggerok/Amplify) |
| ARK Invest | ark-funds.com fund pages + overview/NAV-history/performance JSON + official daily holdings CSV + SEC EDGAR N-PORT-P holdings fallback + Yahoo Finance distributions/history fallback | [ARK](https://github.com/daggerok/ARK) |
| Capital Group | Official Capital Group fund data + SEC N-PORT holdings fallback + Yahoo history fallback | [Capital-Group](https://github.com/daggerok/Capital-Group) |
| Fidelity | SEC EDGAR N-PORT-P + Yahoo Finance | [Fidelity](https://github.com/daggerok/Fidelity) |
| First Trust | ftportfolios.com official ETF list + fund summary, holdings, distribution and price-history export pages + SEC EDGAR N-PORT-P holdings fallback + Yahoo Finance history fallback | [First-Trust](https://github.com/daggerok/First-Trust) |
| Franklin Templeton | franklintempleton.com ETF listings + product pages + SEC EDGAR N-PORT-P | [Franklin](https://github.com/daggerok/Franklin) |
| Global X | globalxetfs.com Next.js catalog and fund pages + dated full-holdings CSV | [Global-X](https://github.com/daggerok/Global-X) |
| Goldman Sachs | am.gs.com fund finder + detail pages + SEC EDGAR N-PORT-P | [Goldman-Sachs](https://github.com/daggerok/Goldman-Sachs) |
| Invesco | invesco.com fund pages and sitemap + official Invesco fund API (monthly returns, NAV, AUM, yields, daily holdings, expense ratio) + SEC EDGAR N-PORT-P holdings fallback + Yahoo Finance history/dividends | [Invesco](https://github.com/daggerok/Invesco) |
| iShares | iShares (BlackRock) product workbooks | [iShares](https://github.com/daggerok/iShares) |
| JPMorgan | am.jpmorgan.com fund explorer + product-data JSON | [JPMorgan](https://github.com/daggerok/JPMorgan) |
| NEOS | neosfunds.com lineup table + official fund pages + daily holdings CSV | [Neos](https://github.com/daggerok/Neos) |
| Northern Trust | etfs.ntam.northerntrust.com funds list + per-fund CSV/JSON downloads | [Northern-Trust](https://github.com/daggerok/Northern-Trust) |
| Pacer ETFs | paceretfs.com product catalog and fund pages (Cloudflare WAF; r.jina.ai proxy fallback) + SEC EDGAR N-PORT-P (Pacer Funds Trust) + Yahoo Finance history/dividends | [Pacer](https://github.com/daggerok/Pacer) |
| Parametric | eatonvance.com ETF catalog and Parametric product pages + SEC EDGAR N-PORT-P holdings + Yahoo Finance history/dividends | [Parametric](https://github.com/daggerok/Parametric) |
| ProShares | proshares.com ETF finder + fund pages + official data host | [ProShares](https://github.com/daggerok/ProShares) |
| Schwab | schwabassetmanagement.com product pages + CSV exports | [Schwab](https://github.com/daggerok/Schwab) |
| SP Funds | sp-funds.com homepage catalog, fund pages and daily holdings CSV + SEC EDGAR N-PORT-P holdings fallback + Yahoo Finance history/dividends | [SP-Funds](https://github.com/daggerok/SP-Funds) |
| SPDR | SSGA / State Street public feeds | [SPDR](https://github.com/daggerok/SPDR) |
| Sprott ETFs | sprottetfs.com fund pages + SEC EDGAR N-PORT-P (Sprott Funds Trust) + Yahoo Finance history/dividends | [Sprott](https://github.com/daggerok/Sprott) |
| Tema ETFs | Tema official fund pages + dated daily holdings CSV; SEC EDGAR N-PORT-P holdings fallback only + Yahoo Finance price/history/dividend fallback | [Tema](https://github.com/daggerok/Tema) |
| Themes ETFs | themesetfs.com catalog + daily holdings CSV + Yahoo Finance history/dividends + SEC N-PORT-P holdings fallback | [Themes](https://github.com/daggerok/Themes) |
| VanEck | vaneck.com ETF finder + product pages | [VanEck](https://github.com/daggerok/VanEck) |
| Vanguard | Vanguard product pages + SEC EDGAR N-PORT-P | [Vanguard](https://github.com/daggerok/Vanguard) |
| VictoryShares | VCM VictoryShares catalog and product JSON + SEC EDGAR N-PORT-P holdings fallback + Yahoo Finance adjusted-market-price history | [VictoryShares](https://github.com/daggerok/VictoryShares) |
| WisdomTree | WisdomTree product table + SEC EDGAR N-PORT-P + Yahoo Finance | [WisdomTree](https://github.com/daggerok/WisdomTree) |
| Xtrackers | Official DWS catalog/US sitemap + PDP/XLSX + SEC N-PORT-P holdings fallback + Yahoo Finance daily prices/history/dividends | [Xtrackers](https://github.com/daggerok/Xtrackers) |

## License

[MIT - same as all sibling ETF repositories.](./LICENSE)

ETFs is an independent, unofficial tool; it is not affiliated with, endorsed by, or sponsored by any ETF issuer. It only combines the public static feeds of the sibling repositories, which are generated from the issuers' public pages and downloads, public SEC EDGAR filings and Yahoo Finance. Fund names, tickers and brand names are trademarks of their respective owners. Nothing here is investment advice
