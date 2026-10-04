#!/usr/bin/env python3
"""
Applies the column types + column filters port to one ETF brand app (the single-brand apps, not the hub).

usage: apply-port.py <repo-dir>

It edits <repo-dir>/app.tsx and <repo-dir>/index.html in place and prints one line per edit:
  OK       the edit was applied
  SKIPPED  the anchor was not found (the repo differs from the reference); the edit must be done by hand
Run it once on a clean checkout. It refuses to run twice (it looks for the 3b marker).
The repo-specific table columns (FUND_FILTER_COLUMNS) are derived from the renderFundsTable header and
row cells and MUST be reviewed by a human/agent afterwards.
"""
import re
import sys
from pathlib import Path

PORT = Path(__file__).resolve().parent
repo = Path(sys.argv[1]).resolve()
app_path = repo / 'app.tsx'
html_path = repo / 'index.html'
app = app_path.read_text()
html = html_path.read_text()
report = []


def ok(name):
    report.append(f'OK       {name}')


def skip(name, why):
    report.append(f'SKIPPED  {name}: {why}')


if '3b. Column types, auto-detection' in app:
    print('already ported')
    sys.exit(1)

# ---- the app's localStorage prefix: the words that start THEME_KEY ('schwab-theme' -> 'schwab')
m = re.search(r"const THEME_KEY = '([a-z0-9-]+)-theme';", app)
slug = m.group(1) if m else None
if not slug:
    skip('storage prefix', "THEME_KEY = '<slug>-theme' not found")
    slug = 'app'

engine = (PORT / 'filter-engine.tsx').read_text()
ui = (PORT / 'filter-ui.tsx').read_text().replace("const FILTER_STORAGE_PREFIX = 'schwab';", f"const FILTER_STORAGE_PREFIX = '{slug}';")


# ---- derive the catalog columns from renderFundsTable (header sortHeader calls + the row cells)
def derive_fund_columns(src):
    fn = re.search(r'function renderFundsTable\(\): void \{(.*?)\n\}\n', src, re.S)
    if not fn:
        return None, 'renderFundsTable not found'
    body = fn.group(1)
    heads = re.findall(r"\$\{sortHeader\('([^']*)', '([^']*)'(?:, (true|false))?(?:, '([^']*)')?\)\}", body)
    row = re.search(r'rows\.map\(\((\w+), index\) => \{(.*?)\n\s*\}\)\.join', body, re.S)
    if not heads or not row:
        return None, 'could not read the header or the row template'
    var = row.group(1)
    tds = re.findall(r'<td class="([^"]*)"[^>]*>(.*?)</td>', row.group(2), re.S)
    # the first cells are # and Use (and Ticker when it has the pinned class); align from the end
    cells = tds[len(tds) - len(heads):]
    if len(cells) != len(heads):
        return None, f'{len(heads)} headers but {len(tds)} cells'
    cols = []
    for (label, key, numeric, extra), (_cls, inner) in zip(heads, cells):
        expr = inner.strip()
        expr = re.sub(r'^\$\{(.*)\}$', r'\1', expr, flags=re.S)
        expr = re.sub(r'^escapeHtml\((.*)\)$', r'\1', expr, flags=re.S)
        is_numeric = numeric == 'true'
        text = f"String(({expr}) ?? '')"
        value = f", value: ({var}: any) => {var}.{key}" if is_numeric else ''
        extra_cls = f", extraClass: '{extra}'" if extra else ''
        cols.append(f"  {{ key: '{key}', label: '{label}', numeric: {str(is_numeric).lower()}, text: ({var}: any) => {text}{value}{extra_cls} }},")
    return var, '\n'.join(cols)


var, cols_or_error = derive_fund_columns(app)
if var is None:
    skip('FUND_FILTER_COLUMNS', cols_or_error)
    fund_cols = '  // TODO: one { key, label, numeric, text, value } entry per header of renderFundsTable\n'
else:
    fund_cols = cols_or_error + '\n'
    ok('FUND_FILTER_COLUMNS derived from renderFundsTable')

repo_specific = f'''// =========================================================================
// 3d. Column filters of this app's tables (the keys are the sort keys of the column headers)
// =========================================================================

const FUND_FILTER_COLUMNS: FilterColumn[] = [
{fund_cols}];

const WATCHLIST_FILTER_COLUMNS: FilterColumn[] = [
  {{ key: 'symbol', label: 'Ticker', numeric: false, text: (row: any) => String(row.symbol ?? ''), extraClass: 'watchlist-sticky-col watchlist-sticky-ticker' }},
  {{ key: 'name', label: 'Name', numeric: false, text: (row: any) => String(row.name ?? '') }},
  {{ key: 'funds', label: 'ETFs', numeric: false, text: (row: any) => (Array.isArray(row.funds) ? row.funds.join(' ') : '') }},
  {{ key: 'fundCount', label: '# ETFs', numeric: true, text: (row: any) => String(row.fundCount ?? ''), value: (row: any) => row.fundCount }},
  {{ key: 'weightSum', label: 'Weight Sum', numeric: true, text: (row: any) => (typeof row.weightSum === 'number' ? `${{row.weightSum.toFixed(3)}}%` : ''), value: (row: any) => row.weightSum }},
  {{ key: 'maxWeight', label: 'Max Weight', numeric: true, text: (row: any) => (typeof row.maxWeight === 'number' ? `${{row.maxWeight.toFixed(3)}}%` : ''), value: (row: any) => row.maxWeight }},
  {{ key: 'identifier', label: 'Identifier', numeric: false, text: (row: any) => String(row.identifier ?? '') }},
];

/** Catalog rows after the tab, the blacklist, the search and the column filters (no sorting). */
function filteredCatalogFunds(): FundRow[] {{
  const base = visibleFunds();
  return applyColumnFilters('catalog', filterRows(base), FUND_FILTER_COLUMNS, base);
}}

/** Sheet rows (holdings, history, distributions) as objects with the cells in col0..colN, after the search and the column filters (no sorting). */
function sheetView(scope: string, headers: string[], sourceRows: string[][], numericHeaders: string[]): any[] {{
  const all = sourceRows.map((row, sourceIndex) => {{
    const cells: Record<string, unknown> = {{ values: row, searchIndex: row.join(' ').toLowerCase(), rank: sourceIndex }};
    headers.forEach((header, index) => {{ cells[`col${{index}}`] = row[index] ?? ''; }});
    return cells;
  }});
  return applyColumnFilters(scope, filterRows(all), sheetFilterColumns(headers, numericHeaders), all);
}}

'''


def sub_once(name, pattern, repl, text, flags=re.S):
    new, n = re.subn(pattern, repl, text, count=1, flags=flags)
    if n != 1:
        skip(name, 'anchor not found')
        return text
    ok(name)
    return new


# ---- A. engine + UI + repo-specific block, immediately before the top-level init(); call
m_init = re.search(r'^init\(\);\s*$', app, re.M)
if m_init:
    app = app[:m_init.start()] + engine + '\n' + ui + '\n' + repo_specific + app[m_init.start():]
    ok('engine, filter UI and table columns inserted before init();')
else:
    skip('engine insertion', 'top-level init(); not found')

# ---- B. no fade animation while typing in a filter
app = sub_once('animateTableUpdate guard', r'(function animateTableUpdate\(\): void \{\n)', r'\1  if (suppressTableAnimation) return;\n', app)

# ---- C. render(): controls and head height
m_render = re.search(r'function render\(\): void \{.*?\n\}\n', app, re.S)
if m_render and 'renderStaticLoadSentinel();\n}' in m_render.group(0):
    body = m_render.group(0).replace('renderStaticLoadSentinel();\n}', 'renderStaticLoadSentinel();\n  renderFilterControls();\n  syncHeadHeight();\n}')
    app = app[:m_render.start()] + body + app[m_render.end():]
    ok('render() hooks')
else:
    skip('render() hooks', 'render() body not as expected')

# ---- D. sortHeader: the type badge next to the sort button
app = sub_once(
    'sortHeader badge',
    r'return `<th class="py-3\.5 px-4\$\{align\}\$\{extraClass \? \' \' \+ extraClass : \'\'\}" title="\$\{escapeHtml\(tooltip\)\}"><button data-sort="\$\{escapeHtml\(key\)\}" title="\$\{escapeHtml\(tooltip\)\}" class="([^"]*)">\$\{escapeHtml\(label\)\}\$\{arrow\}</button></th>`;',
    lambda mo: ('return `<th class="py-3.5 px-4${align}${extraClass ? \' \' + extraClass : \'\'}" title="${escapeHtml(tooltip)}"><div class="flex items-center gap-1.5${numeric ? \' justify-end\' : \'\'}"><button data-sort="${escapeHtml(key)}" title="${escapeHtml(tooltip)}" class="' + mo.group(1) + '">${escapeHtml(label)}${arrow}</button>${filterBadgeFor(key)}</div></th>`;'),
    app,
)

# ---- E. bindSortHeaders: the filter row goes under every header that has filter info
app = sub_once('bindSortHeaders filter row', r'(function bindSortHeaders\(\): void \{\n)', r'\1  appendFilterRow();\n', app)

# ---- F. catalog
app = sub_once('visibleCatalogRows uses the column filters', r'(function visibleCatalogRows\(\): FundRow\[\] \{\n  return )filterRows\(visibleFunds\(\)\);', r'\1filteredCatalogFunds();', app)
app = sub_once('renderFundsTable rows', r'const rows = sortRows\(filterRows\(visibleFunds\(\)\)\);\n  el\.tableHead\.innerHTML', r'const rows = sortRows(filteredCatalogFunds());\n  el.tableHead.innerHTML', app)
app = sub_once('catalog export rows', r'rows: filterRows\(visibleFunds\(\)\)\.map\(fund => \[', r'rows: filteredCatalogFunds().map(fund => [', app)
app = sub_once('copyTickers catalog', r"else values = filterRows\(visibleFunds\(\)\)\.map\(fund => fund\.ticker\);", r"else values = filteredCatalogFunds().map(fund => fund.ticker);", app)

# ---- G. watchlist
app = sub_once(
    'watchlist rows',
    r'function getVisibleWatchlistRows\(\): WatchlistRow\[\] \{\n  return sortRows\(filterRows\(getDedupedWatchlistRows\(\)\)\);\n\}',
    "function getVisibleWatchlistRows(): WatchlistRow[] {\n  const base = getDedupedWatchlistRows();\n  return sortRows(applyColumnFilters('watchlist', filterRows(base), WATCHLIST_FILTER_COLUMNS, base));\n}",
    app,
)
app = sub_once(
    'watchlist chunk signature',
    r"return \[state\.sortKey, state\.sortDir, currentQuery\(\), rows\.length, rows\.length \? rows\[0\]\.key : ''\]\.join\('\|'\);",
    "return [state.sortKey, state.sortDir, currentQuery(), columnFilterSig('watchlist'), rows.length, rows.length ? rows[0].key : ''].join('|');",
    app,
)

# ---- H. holdings / history sheet
app = sub_once(
    'sheet rows',
    r"const rows = sortRows\(filterRows\(entry\.rows\.map\(\(row, sourceIndex\) => \{\n    const cells: Record<string, unknown> = \{ values: row, searchIndex: row\.join\(' '\)\.toLowerCase\(\) \};\n    headers\.forEach\(\(header, index\) => \{ cells\[`col\$\{index\}`\] = row\[index\] \?\? ''; \}\);\n    cells\.rank = sourceIndex;\n    return cells;\n  \}\)\)\);",
    "const rows = sortRows(sheetView(sheet, headers, entry.rows, NUMERIC_SHEET_HEADERS));",
    app,
)
app = sub_once(
    'sheet export rows',
    r"rows: filterRows\(entry\.rows\.map\(row => \(\{ values: row, searchIndex: row\.join\(' '\)\.toLowerCase\(\) \}\)\)\)\.map\(\(row: any\) => row\.values\),",
    "rows: sheetView(sheet, entry.headers, entry.rows, NUMERIC_SHEET_HEADERS).map((row: any) => row.values),",
    app,
)

# ---- I. distributions
app = sub_once(
    'distributions rows',
    r"const rows = sortRows\(filterRows\(sourceRows\.map\(\(row, sourceIndex\) => \{\n    const cells: Record<string, unknown> = \{ values: row, searchIndex: row\.join\(' '\)\.toLowerCase\(\), rank: sourceIndex \};\n    headers\.forEach\(\(header, index\) => \{ cells\[`col\$\{index\}`\] = row\[index\] \?\? ''; \}\);\n    return cells;\n  \}\)\)\);",
    "const rows = sortRows(sheetView('distributions', headers, sourceRows, []));",
    app,
)
app = sub_once(
    'distributions export rows',
    r"headers: worksheet\.headers \|\| \[\],\n      rows: worksheet\.rows \|\| \[\],",
    "headers: worksheet.headers || [],\n      rows: sheetView('distributions', worksheet.headers || [], worksheet.rows || [], []).map((row: any) => row.values),",
    app,
)

# ---- J. boot and events
app = sub_once('init restoreColumnFilters', r'(function init\(\): void \{\n(?:  .*\n)*?  restoreBlacklist\(\);\n)', r'\1  restoreColumnFilters();\n', app)
app = sub_once('bindEvents bindColumnFilterEvents', r"(  el\.copyBtn\.addEventListener\('click', copyTickers\);)", r'  bindColumnFilterEvents();\n\1', app)

# ---- index.html: toolbar buttons and CSS
buttons = '''          <button id="filters-btn" type="button" aria-pressed="true" class="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-lg text-sm font-medium transition active:scale-95 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed" title="Show or hide the row of filter inputs under the column headers">Filters: <span id="filters-summary">on</span><span id="filters-badge" hidden class="ml-1.5 text-[0.7rem] leading-none font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700/50"></span></button>
          <button id="clear-filters-btn" type="button" hidden class="bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700/50 px-3 py-2 rounded-lg text-sm font-medium transition active:scale-95 hover:bg-blue-100 dark:hover:bg-blue-900/50" title="Clear every column filter of the shown table">Clear filters</button>
'''
m_copy = re.search(r'^( *)<button id="copy-btn"', html, re.M)
if m_copy:
    html = html[:m_copy.start()] + buttons + html[m_copy.start():]
    ok('index.html toolbar buttons')
else:
    skip('index.html toolbar buttons', 'copy-btn not found')

css = '''
    /* Column filters: the type badge in a header and a row of filter inputs under the headers */
    .type-badge{flex:none;padding:0 .35rem;border-radius:.3rem;font-size:.6rem;line-height:1rem;font-weight:700;letter-spacing:.03em;border:1px solid transparent;cursor:pointer;opacity:.75;transition:opacity .12s,border-color .12s}
    .type-badge:hover,.type-badge.is-override{opacity:1;border-color:#94a3b8}
    .dark .type-badge:hover,.dark .type-badge.is-override{border-color:#64748b}
    .filter-row th{padding:.3rem .5rem;background:#f8fafc;font-weight:400;text-transform:none;letter-spacing:normal;border-top:1px solid #e2e8f0}
    .dark .filter-row th{background:#0f172a;border-top-color:#1e293b}
    #table-scroll .filter-row .catalog-sticky-col,#table-scroll .filter-row .watchlist-sticky-col{top:var(--head-h,2.75rem)}
    .filter-wrap{position:relative;display:flex;align-items:center}
    .filter-input{width:100%;min-width:6.5rem;box-sizing:border-box;padding:.2rem 1.4rem .2rem .45rem;border-radius:.4rem;border:1px solid #e2e8f0;background:#fff;color:#334155;font-size:.72rem;line-height:1.1rem;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
    .filter-input::placeholder{color:#94a3b8}
    .filter-input:focus{outline:none;border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.18)}
    .filter-input.is-active{border-color:#93c5fd;background:#eff6ff;color:#1d4ed8}
    .filter-input.is-invalid{border-color:#fda4af;background:#fff1f2;color:#be123c}
    .filter-clear{position:absolute;right:.3rem;width:1rem;height:1rem;display:flex;align-items:center;justify-content:center;border-radius:9999px;color:#94a3b8;font-size:.65rem;line-height:1;cursor:pointer}
    .filter-clear:hover{color:#334155;background:#e2e8f0}
    .dark .filter-input{background:#020617;border-color:#334155;color:#e2e8f0}
    .dark .filter-input::placeholder{color:#64748b}
    .dark .filter-input.is-active{background:rgba(30,64,175,.28);border-color:rgba(59,130,246,.5);color:#93c5fd}
    .dark .filter-input.is-invalid{background:rgba(190,18,60,.18);border-color:rgba(244,63,94,.5);color:#fda4af}
    .dark .filter-clear:hover{color:#e2e8f0;background:#1e293b}
'''
m_style = re.search(r'\n  </style>', html)
if m_style:
    html = html[:m_style.start()] + '\n' + css.rstrip('\n') + html[m_style.start():]
    ok('index.html CSS')
else:
    skip('index.html CSS', '</style> not found')

app_path.write_text(app)
html_path.write_text(html)
print('\n'.join(report))
print(f'{sum(1 for r in report if r.startswith("OK"))} applied, {sum(1 for r in report if r.startswith("SKIPPED"))} skipped')
