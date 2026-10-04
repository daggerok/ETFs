#!/usr/bin/env python3
"""usage: apply-toolbar.py <repo dir> - asset class dropdown instead of the category tabs + toolbar order (Columns/Filters after the dropdown, Copy Tickers before Upload)"""
import re, sys, pathlib

PORT = pathlib.Path(__file__).parent
repo = pathlib.Path(sys.argv[1])
app_path, html_path, readme_path = repo / 'app.tsx', repo / 'index.html', repo / 'README.md'
app, html, readme = app_path.read_text(), html_path.read_text(), readme_path.read_text()
report = []
ok = lambda n: report.append(f'OK       {n}')
skip = lambda n, w: report.append(f'SKIPPED  {n}: {w}')

if '3f. Categories dropdown' in app:
    print('already ported'); sys.exit(1)
if '3e. Columns menu' not in app:
    print('the Columns port is missing'); sys.exit(1)


def sub(name, pattern, repl, text, flags=re.S):
    new, n = re.subn(pattern, lambda m: repl, text, count=1, flags=flags)
    if n:
        ok(name); return new
    skip(name, 'pattern not found'); return text

block = (PORT / 'categories-block.tsx').read_text()
m = re.search(r'loadHiddenColumns\(\);\n', app)
if m:
    app = app[:m.end()] + '\n' + block + app[m.end():]
    ok('block 3f inserted after loadHiddenColumns()')
else:
    skip('block 3f', 'loadHiddenColumns(); not found')

app = sub('visibleFunds ignores the tab, uses the asset class selection',
          r"const tab = isEtfCatalogTab\(state\.activeTab\) \? state\.activeTab : 'All';\s*return state\.funds\.filter\(fund => \(tab === 'All' \|\| fund\.category === tab\) && !state\.blacklist\.has\(fund\.ticker\)\);",
          "return state.funds.filter(fund => categoryAllowed(fund.category) && !state.blacklist.has(fund.ticker));", app)
app = sub('getTabs returns only All ETFs',
          r"tabs\.push\(\{ id: 'All', label: 'All ETFs', count: [^\n]*\}\);\s*uniqueCategories\(\)\.forEach\(category => \{\s*tabs\.push\(\{.*?\}\);\s*\}\);\s*return tabs;",
          "// The asset classes are a multi-select dropdown (3f), not tabs: All ETFs is the only catalog tab.\n  tabs.push({ id: 'All', label: 'All ETFs', count: state.funds.filter(fund => categoryAllowed(fund.category) && !state.blacklist.has(fund.ticker)).length });\n  return tabs;", app)
app = sub('renderTabs builds the dropdown',
          r"renderTabButtons\(el\.tabsBar, getTabs\(\)\);",
          "renderTabButtons(el.tabsBar, getTabs(), 0);\n  ensureCategoriesMenu();\n  renderCategoriesButton();\n  categoriesDd?.refresh();", app)
app = sub('renderTabButtons minTabs',
          r"function renderTabButtons\(container: any, tabs: TabInfo\[\]\): void \{\n(\s*)container\.classList\.toggle\('hidden', tabs\.length <= 1\);",
          "function renderTabButtons(container: any, tabs: TabInfo[], minTabs = 1): void {\n  container.classList.toggle('hidden', tabs.length <= minTabs);", app)
app = sub('All ETFs pill lit only while nothing narrows the table',
          r"const isActive = tab\.id === state\.activeTab;",
          "// The All ETFs pill is lit only while no asset class narrows the table\n    const isActive = tab.id === state.activeTab && (tab.id !== 'All' || !categoryFilterActive());", app)
clear_stmt = "if (hiddenCategories.size) { hiddenCategories = new Set(); persistHiddenCategories(); } // All ETFs clears the asset class selection"
m = re.search(r"( *)state\.activeTab = (next|destination);\n", app)
if m:
    app = app[:m.end()] + m.group(1) + f"if ({m.group(2)} === 'All' && hiddenCategories.size) {{ hiddenCategories = new Set(); persistHiddenCategories(); }} // All ETFs clears the asset class selection\n" + app[m.end():]
    ok('All ETFs click clears the asset class selection')
else:
    m = re.search(r"( *)switchTab\(button\.dataset\.tab \|\| 'All'\);\n", app)
    if m:
        app = app[:m.start()] + m.group(1) + "if ((button.dataset.tab || 'All') === 'All' && hiddenCategories.size) { hiddenCategories = new Set(); persistHiddenCategories(); } // All ETFs clears the asset class selection\n" + app[m.start():]
        ok('All ETFs click clears the asset class selection (switchTab)')
    else:
        m = re.search(r"( *)state\.activeTab = button\.dataset\.tab \|\| 'All';\n", app)
        if m:
            app = app[:m.end()] + m.group(1) + "if (state.activeTab === 'All' && hiddenCategories.size) { hiddenCategories = new Set(); persistHiddenCategories(); } // All ETFs clears the asset class selection\n" + app[m.end():]
            ok('All ETFs click clears the asset class selection (dataset.tab)')
        else:
            skip('All ETFs click clears the asset class selection', 'no known tab click pattern found')

# ---- index.html
old = 'id="tabs-bar" class="hidden flex flex-wrap items-center justify-center gap-1.5 overflow-x-auto py-1 w-full max-w-full flex-1 themed-scroll"'
if old in html:
    html = html.replace(old, 'id="tabs-bar" class="hidden flex flex-wrap items-center justify-center gap-1.5 overflow-x-auto py-1 w-full max-w-full lg:w-auto lg:flex-none themed-scroll"', 1); ok('tabs-bar shrinks to its content')
else:
    skip('tabs-bar classes', 'class string not found')
bar = 'class="flex flex-col lg:flex-row lg:flex-wrap justify-between items-center gap-4 bg-white'
if bar in html:
    html = html.replace(bar, 'class="flex flex-col lg:flex-row lg:flex-wrap lg:justify-start justify-between items-center gap-4 bg-white', 1); ok('toolbar left-aligned')
else:
    skip('toolbar classes', 'class string not found')
act = 'class="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-end shrink-0"'
if html.count(act) == 1:
    html = html.replace(act, 'class="flex flex-wrap items-center gap-2.5 w-full lg:w-auto lg:ml-auto justify-end shrink-0"'); ok('actions pushed right')
else:
    skip('actions container', f'class string found {html.count(act)} times')
fm = re.search(r'\n *<button id="filters-btn".*?</button>\n *<button id="clear-filters-btn".*?</button>\n', html, re.S)
tm = re.search(r'<div id="tabs-bar"[^>]*></div>\n', html)
if fm and tm and fm.start() > tm.end():
    blk = fm.group(0)
    html = html.replace(blk, '\n', 1)
    tm = re.search(r'<div id="tabs-bar"[^>]*></div>\n', html)
    html = html[:tm.end()] + blk.lstrip('\n') + html[tm.end():]
    ok('Filters and Clear filters moved after the tabs bar')
else:
    skip('Filters buttons', 'filters-btn/clear-filters-btn or tabs-bar not found in the expected order')
cm = re.search(r'\n *<button[^>]*id="copy-btn".*?</button>\n', html, re.S)
dm = re.search(r'\n *<!-- Integrated Drag & Drop Upload', html)
if cm and dm and cm.start() > dm.start():
    blk = cm.group(0)
    html = html.replace(blk, '\n', 1)
    dm = re.search(r'\n *<!-- Integrated Drag & Drop Upload', html)
    html = html[:dm.start()] + blk.rstrip('\n') + '\n' + html[dm.start():]
    ok('Copy Tickers moved before Upload')
elif not dm:
    ok('no upload zone in this app: Copy Tickers stays first')
else:
    skip('Copy Tickers', 'already before the upload zone or not found')

para = ("The asset classes are one `Asset classes` multi-select next to the `All ETFs` pill instead of one tab per class: every class is selected by default (= all ETFs), `Only` or unchecking narrows the table, and the `All ETFs` pill is lit only while nothing narrows it (all or none of the classes checked); clicking the pill clears the selection. The choice is remembered in the browser (localStorage, never the data)\n\n")
rm = re.search(r'\n## Updating the static', readme)
if rm and 'The asset classes are one' not in readme:
    readme = readme[:rm.start() + 1] + para + readme[rm.start() + 1:]; ok('README paragraph added')
else:
    skip('README', 'heading not found or paragraph present')

app_path.write_text(app); html_path.write_text(html); readme_path.write_text(readme)
print('\n'.join(report))
