# Stocks repo (sibling of the ETF repos)

`/Users/maksim.kostromin/Documents/code/private/Stocks` (github.com/daggerok/Stocks) is a separate repo next to `ETFs`, not one of the 29 brand repos and not part of `registry.json` (adding it would change every ETF README block, the hub brand list and the hard-coded brand counts in tests). It follows the same updater contract, layout (`scripts/` with exactly three files, `.github/` with only `workflows/update-data.yml` and `dependabot.yml`), Bun-only rule and Pages setting (deploy from `main` `/`, no Actions). Its standard and checks live in `.claude/tools/stocks-std/` (`STANDARD.md`, `spec.json`, `check-readme.ts`); the workflow is generated from `spec.json` with `etf-std/gen-workflow.ts`, never hand-edited

**Why:** the owner wanted the same look, feel and functionality for stocks as for ETFs (2026-10-03), without disturbing the 29 ETF repos

**How to apply:** after any change to the Stocks updater run `bun test`, `bun build --target=bun scripts/update-data.ts --outfile=/dev/null`, `git diff --check` and the three checks above; after changing the controls regenerate the workflow and update the README controls table (a test keeps config, `CONTROL_NAMES`, README and `--help` in sync); never commit data from a test run (the published feed is the 97-stock watchlist from `scio-examples/target/watchlist/All Stocks.txt`)
