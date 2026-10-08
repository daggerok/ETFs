# ETF repos: one small test suite, the same in every repo

Owner's words: "simplify tests as much as possible - we should have everything similar, but all should work".
`scripts/update-data.test.ts` is the only test file. Goal: short, readable, identical in shape across the 29 repos,
green on macOS AND on the GitHub Linux runner (the workflow runs `bun test` before every update and a failing test
blocks the data refresh).

## The hub has one small test file (2026-10-08)
- The hub (`ETFs`) updates no data, so it has no data tests. Its only test file is `scripts/hub.test.ts`: every `byId(...)` main.tsx reads exists in `src/index.html` (a missing id breaks the whole page at start, and moving panels around makes that easy), plus the top panel layout (no `<header>`, title, count chip and theme toggle in the first panel above the toolbar). Why it is needed: the UI is otherwise only checked by hand and by the browser scripts in `.claude/tools/ui-std`
- `bunfig.toml` sets `[test] root = "scripts"`, so `bun test` in the hub root never walks into the 29 brand folders (each its own git repo, ignored by the hub). Without it bun ran all their `scripts/update-data.test.ts` in one process and 28 pipeline, network and metrics tests failed, because they expect their own cwd and a clean environment. Run the data tests inside each brand repo
- Keep it small: add a hub test only for a contract whose break takes the page down

## Scope: only the data update is tested (owner, 2026-10-07)
Tests are strict for the data update only (`scripts/update-data.ts`: controls, parsing, metrics, pipeline, network). Everything else is less important and has no test: the workflow YAML, the README, the repo layout, package.json, the UI and the build are checked by the hub scripts (`check-scripts.ts`, `check-pages.ts`, `check-workflow.ts`, `check-readme.ts`) or by looking at the page. A test that reads a workflow file, the README or the file list of the repo breaks on harmless changes (a new `pull-request.yml` turned SP-Funds red) and is deleted, never patched. Add a non-data test only when it is really needed and say why.

## Required groups (same `describe` names in every repo, one to five tests each)
1. `controls` - resolver precedence (file < advanced < inputs < env < protected), strict validation (bad range,
   bad HISTORY_RANGE, unknown TICKERS, CR/LF/NUL), brand env aliases; table-driven, no network
2. `parsing` - one tiny inline sample per provider payload (catalog, fund page, holdings, distributions); checks
   the fields the hub reads and that missing values become null, never 0
3. `metrics` - null for horizons the fund is too young for, same key set on every row, `returnsBasis` and
   `performanceAsOf` travel together, TER net/gross mapping
4. `pipeline` - mocked fetch, a 3-fund catalog: a one-ticker run keeps all rows, a second identical run writes
   nothing (zero diff), a failed source keeps the fund exactly as published, a row without meta has `dataFile: null`
5. `network` - timeout covers the body, retries are bounded, in-flight counter (peak 1 at CONCURRENCY=1, N at N),
   the HISTORY_RANGE request URL has explicit period1/period2

Provider-specific cases go under the closest group, not into new groups. Drop tests that only repeat another test,
snapshot whole documents, or assert implementation details (log text, internal helper names).

## Portability rules (each one caused or can cause a CI-only failure)
- Never depend on directory order: `readdirSync(...).sort()` (APFS sorts, ext4 does not; Amplify failed on CI for this)
- No wall-clock thresholds below ~1 s; use a fake clock or compare ordering, not milliseconds
- Pin the time zone in date tests (`TZ` set per test or `Date.UTC`); never rely on the machine zone
- Start from a clean environment: tests must not read control variables the workflow exports (`CONCURRENCY`,
  `HOLDINGS_PAGE_SIZE`, ...); build env explicitly per test and restore `globalThis.fetch` and `process.exitCode`
  in `afterEach`
- `bun test` must exit 0, not only print `0 fail`; check `echo $?`
- No network, no fixtures, no files outside a per-test temp dir that is removed in `finally`

## Definition of done for a test change
`bun test` exit 0 locally, and the same file run with the workflow's control variables exported
(`env $(python3 -c ...config.json -> K=V) bun test`) exit 0; the hub gates still pass.
- And `.claude/tools/tc/check.sh <repo>` prints nothing (no IDE type errors in the updater, its test or `src/main.tsx`; see `ts-ide-errors.md`)
