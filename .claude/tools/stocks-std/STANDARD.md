# Stocks repo standard

`Stocks` (github.com/daggerok/Stocks, folder `../Stocks` next to `ETFs`) is the stocks counterpart of the ETF apps. It follows the ETF standard (`../etf-std/STANDARD.md`) and the updater contract (`.claude/rules/etf-updater-contract.md`) with these differences

- It is NOT in `etf-std/registry.json`: that file drives the 29 ETF brand tables, the hub `BRANDS` list and tests that hard-code the brand count. Stocks has its own README tables (`## Exchanges table` instead of `## Brands table`, a one-row `## Sibling applications` pointing at the ETFs hub)
- Feed: `api/stocks/index.json` with a `companies` array and `companies/<TICKER>/{meta.json,history/NNN.json}`; the row key is `metrics` with the stock metric set (see the README), plus mandatory `returnsBasis` and `performanceAsOf`
- Controls: the ETF surface minus the fund-only ones (`AUM`, `TER`, `SEC_YIELD`, holdings and EDGAR controls), plus `EXCHANGES` and `MARKET_CAP`; `PERFORMANCE_*` is cumulative price change and `TOTAL_RETURN_*` cumulative adjusted return
- Pages: GitHub Actions (`build_type: workflow`, `.github/workflows/github-pages.yml`, Parcel build), About topics `css csv finance github-pages html json static-api stocks typescript watchlist`

## Regenerate and check

```bash
cd .claude/tools/stocks-std
bun ../etf-std/gen-workflow.ts spec.json > ../../../../Stocks/.github/workflows/update-data.yml   # never hand-edit the YAML
bun ../etf-std/check-workflow.ts ../../../../Stocks
bun ../etf-std/check-pages.ts ../../../../Stocks
bun ../etf-std/check-scripts.ts ../../../../Stocks
bun check-readme.ts ../../../../Stocks
```

`spec.json` lists the 22 individual workflow inputs (24 max, `advanced` is added by the generator); `SEC_UA` and `USE_SYSTEM_CA` go through `advanced`
