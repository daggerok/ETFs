# ETFs

One page that works as every brand's ETF holdings-to-watchlist app at once. It reads the public static feeds of the 29 sibling applications at runtime and shows the union of all brands in one table with the same look, feel, columns and business logic as a sibling app, so you can, for example, sort every ETF of every brand by TR 1Y descending and build a Watchlist that mixes funds of different brands. Selecting funds of several brands aggregates their holdings together: the Watchlist shows how many of the selected funds hold each ticker and the summed and maximum weights, so overlapping exposure across issuers becomes visible. A single-file client-side tool: `index.html`, `app.tsx` (compiled in the browser by Babel standalone, Tailwind from a CDN) and `favicon.ico`, with no build step, no bundler, no dependencies, no data files and no aggregator

## Using Bun

```bash
git clone https://github.com/daggerok/ETFs && cd ETFs
./scripts/install.sh --depth 1
bunx serve . -p 1234
open http://0:1234
```

The app is live at <https://daggerok.github.io/ETFs/> (GitHub Pages, deployed from the `main` branch)

`./scripts/install.sh` clones the 29 sibling repositories next to the hub, into subfolders of this folder, and ignores them in this repository's `.gitignore`:

- no arguments clones all of them with full history; `--depth 1` (`-d 1`) is the fastest and smallest way to just run the app
- repositories can be listed positionally, separated by spaces and/or commas, case-insensitive: `./scripts/install.sh VanEck Tema` or `./scripts/install.sh VanEck,Tema`
- `-s` / `--ssh` clones over SSH instead of HTTPS, `-p N` / `--parallel N` sets the parallel clones (default 4), `-h` / `--help` prints the usage

`./scripts/update.sh` fetches and fast-forwards `main` of every cloned repository to get fresh data. It takes the same style of arguments: no arguments updates every cloned repository, repositories can be listed positionally (`./scripts/update.sh VanEck Tema` or `VanEck,Tema`), `-p N` / `--parallel N` sets how many are updated in parallel (default 4) and `-h` / `--help` prints the usage. Output is printed per repository as one block and the exit code is non-zero if any repository failed. Both scripts resolve the hub root from their own location, so they work from any working directory

Every cloned repository stays an independent git repository, so you can develop, commit and open pull requests in any of them separately

To serve the hub together with the siblings, run `bunx serve . -p 1234` from the folder that contains the sibling repositories, that is the hub folder after `install.sh`

### Where the data comes from

Each brand repository publishes a standard feed: `api/<slug>/index.json` plus per-fund `funds/<TICKER>/meta.json`, `holdings/NNN.json` and `history/NNN.json` pages. The hub chooses the base URL of every brand like this:

| Situation | Base URL |
| --- | --- |
| `location.hostname` ends with `github.io` | `https://daggerok.github.io/<Repo>/api/<slug>/` |
| anything else, such as local `bunx serve . -p 1234` | `./<Repo>/api/<slug>/` (the sibling folder next to the hub) |
| `?api=remote` | forces `https://daggerok.github.io/<Repo>/api/<slug>/`, so local development can test production data |
| `?api=local` | forces `./<Repo>/api/<slug>/` |

GitHub Pages serves every site with `access-control-allow-origin: *`, so reading the feeds of 29 sites from the hub (or from `localhost` with `?api=remote`) needs no proxy

### How it works

- Startup: the 29 brand indexes are fetched in parallel by a pool of 8 workers with a progress counter. A brand that fails (404, network, 25 s timeout) is marked unavailable with a small badge and everything else keeps working
- Cache: every brand index is stored in IndexedDB keyed by origin, api mode and repo together with its `generatedAt`, and revalidated with `fetch(url, { cache: 'no-cache' })`. The first paint comes from the cache when one exists; a brand that cannot be revalidated keeps serving its cached copy. Every storage access is wrapped in try/catch, so the page also works with storage blocked
- Memory: rows are normalized once into compact structures: Float64Arrays for the sortable numerics (NaN means unavailable), integer dictionary ids for brand, category and returns basis, and a lowercase search string per fund. About 2,500 funds sort and filter in a few milliseconds. The DOM is windowed: 200 rows are mounted and more are appended while you scroll
- Sorting: unavailable values (`null` in the feed) always sort last, in both directions, and are shown as a dash, never as `0`
- Filters: search (ticker, name, brand, category), brand multi-select, category select and the `Hide stale returns (older than N days)` toggle, which hides funds whose `performanceAsOf` is older than N days (default 45) or unknown; it is off by default
- Source badge: each row shows `metrics.returnsBasis` as a badge (`NAV` official, `mixed` official with derived gaps, `derived` computed from price or NAV history, `n/a`) and the `performanceAsOf` date as Return As Of
- Watchlist: the Use checkboxes (persisted in `localStorage` per brand and ticker, so `VanEck:GDX` and `iShares:IVV` can sit together) select funds across brands; their holdings pages are loaded on demand from each fund's own brand base and aggregated by ticker (CUSIP, ISIN, identifier or name when a position has no ticker), with Copy Tickers and CSV and TXT export
- Detail tabs: Overview, Holdings, History and Distributions of the active fund are loaded on demand from its brand

### Metrics and caveats

Returns come from different sources and different dates: an issuer's official NAV table, a month-end or quarter-end series, or an estimate derived from Yahoo Finance prices. Compare funds with the source badge and the Return As Of column in view, and use the stale toggle to drop old figures. Unavailable values are never published as zero: they are a dash in the table and sort last. The hub shows exactly what each brand feed publishes (the `metrics` contract is the same for all brands: `ytd`, `tr1y`, `tr3y`, `tr5y`, `tr10y`, `cagr3y`, `cagr5y`, `cagr10y`, `siAnn`, `dividendYield`, `secYield`, `returnsBasis`, `performanceAsOf`), so it is only as fresh as the latest run of each brand's updater. Selecting very many funds at once loads holdings of every selected fund (several requests each), so selecting more than 150 at once asks for confirmation

## TypeScript and verification

The browser app is intentionally build-free: `index.html` carries the markup, styles and bootstrap, and `app.tsx` is TypeScript compiled in the browser with Babel standalone, with no `tsconfig.json` and no TypeScript dependency. The hub has no updater, tests, workflows or data files

Verification before every publish:

```bash
bun build --target=bun app.tsx --outfile=/dev/null
git diff --check
```

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
| Invesco | invesco.com CSV downloads + Yahoo Finance | [Invesco](https://github.com/daggerok/Invesco) |
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
