#!/usr/bin/env python3
"""usage: apply-columns.py <repo dir> - adds the Columns menu (block 3e) to a brand app that already has the filters port"""
import re, sys, pathlib

PORT = pathlib.Path(__file__).parent
repo = pathlib.Path(sys.argv[1])
app_path, html_path, readme_path = repo / 'app.tsx', repo / 'index.html', repo / 'README.md'
app, html, readme = app_path.read_text(), html_path.read_text(), readme_path.read_text()
report = []
ok = lambda n: report.append(f'OK       {n}')
skip = lambda n, w: report.append(f'SKIPPED  {n}: {w}')

if '3e. Columns menu' in app:
    print('already ported'); sys.exit(1)
if '3b. Column types, auto-detection' not in app:
    print('the filters port is missing'); sys.exit(1)

block = (PORT / 'columns-engine.tsx').read_text()
m = re.search(r'^[ \t]*init\(\);[ \t]*$', app, re.M)
if m:
    app = app[:m.start()] + block + '\n' + app[m.start():]
    ok('block 3e inserted before init();')
else:
    skip('block 3e', 'top-level init(); not found')

# the header must be: # cell, Use cell, then FUND_FILTER_COLUMNS in order (the CSS hides cells by position)
fm = re.search(r'function renderFundsTable\(\): void \{\n', app)
if fm:
    head = app[fm.end():fm.end() + 900]
    if re.search(r'\$\{indexHeader\(\)\}\s*\$\{useHeader\(\)\}\s*\$\{sortHeader\(.Ticker.', head):
        ok('header starts with indexHeader, useHeader, Ticker')
    else:
        skip('header order', 'renderFundsTable does not start with indexHeader/useHeader/Ticker - check the positions by hand')
    app = app[:fm.end()] + '  setCatalogColumnStyle(true);\n' + app[fm.end():]
    ok('renderFundsTable switches the column style on')
else:
    skip('renderFundsTable hook', 'function not found')

rm = re.search(r'function render\(\): void \{\n', app)
if rm:
    app = app[:rm.end()] + '  setCatalogColumnStyle(false);\n' + app[rm.end():]
    ok('render() resets the column style')
else:
    skip('render() hook', 'function not found')

css = (PORT / 'columns.css').read_text().rstrip('\n')
sm = re.search(r'\n  </style>', html)
if sm and '.dd-trigger' not in html:
    html = html[:sm.start()] + '\n' + css + html[sm.start():]
    ok('index.html CSS inserted')
else:
    skip('index.html CSS', '</style> not found or dd CSS already present')

bar = 'class="flex flex-col lg:flex-row justify-between items-center gap-4 bg-white'
if bar in html and 'lg:flex-wrap justify-between' not in html:
    html = html.replace(bar, 'class="flex flex-col lg:flex-row lg:flex-wrap justify-between items-center gap-4 bg-white', 1)
    ok('action bar may wrap (the extra Columns button no longer overflows the card)')
else:
    skip('action bar wrap', 'toolbar class string not found - check the layout at 1500 px by hand')

para = ("The `Columns` menu next to `Filters` lists every column of the ETF table from the first to the last, all of them shown by default, with a search box and the `All`, `Clear`, `Toggle` and `Reset` buttons. `Use` and `Ticker` are listed but locked. "
        "Hiding a column only removes it from the table: the filters, the sorting, the exports and Copy Tickers still use it. The choice is remembered in the browser (localStorage, never the data) and the menu is shown on the ETF catalog only\n\n")
rm2 = re.search(r'\n## Updating the static', readme)
if rm2 and 'The `Columns` menu' not in readme:
    readme = readme[:rm2.start() + 1] + para + readme[rm2.start() + 1:]
    ok('README paragraph added')
else:
    skip('README', 'heading not found or paragraph present')

app_path.write_text(app); html_path.write_text(html); readme_path.write_text(readme)
print('\n'.join(report))
