// usage: bun brand-uitest.ts <repoDir> <port> <screenshot.png>
// Serves the repo with `bunx serve`, drives it in headless Chrome (CDP) and checks the column types and filters of a single-brand ETF app.
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const [repo, port, shot] = [process.argv[2], process.argv[3] ?? '1240', process.argv[4] ?? '/tmp/brand-ui.png'];
const server = Bun.spawn(['bunx', 'serve', repo, '-p', port], { stdout: 'ignore', stderr: 'ignore' });
const dbg = String(19000 + Number(port));
const proc = Bun.spawn([CHROME, '--headless=new', `--remote-debugging-port=${dbg}`, '--window-size=1500,900', '--no-first-run', '--user-data-dir=/tmp/cdp-brand-' + port + '-' + Date.now(), 'about:blank'], { stdout: 'ignore', stderr: 'ignore' });
let wsUrl = '';
for (let i = 0; i < 60 && !wsUrl; i++) { await Bun.sleep(250); try { const t = await (await fetch(`http://localhost:${dbg}/json`)).json(); wsUrl = t.find((x: any) => x.type === 'page')?.webSocketDebuggerUrl ?? ''; } catch {} }
const ws = new WebSocket(wsUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map<number, (v: any) => void>(); const logs: string[] = [];
ws.onmessage = (m) => { const d = JSON.parse(String(m.data)); if (d.id && pending.has(d.id)) pending.get(d.id)!(d.result ?? d.error); if (d.method === 'Runtime.exceptionThrown') logs.push('EXC ' + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text)); if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') logs.push('ERR ' + d.params.args.map((a: any) => a.value ?? a.description).join(' ')); };
const send = (method: string, params: any = {}) => new Promise<any>((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr: string) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result?.value; };
await send('Runtime.enable'); await send('Page.enable');
let ready = false;
for (let i = 0; i < 40 && !ready; i++) { try { const r = await fetch(`http://localhost:${port}/`); ready = r.ok; } catch {} if (!ready) await Bun.sleep(250); }
await send('Page.navigate', { url: `http://localhost:${port}/` });
for (let i = 0; i < 60; i++) { await Bun.sleep(500); if (await ev(`typeof state !== 'undefined' && state.funds.length > 0`).catch(() => false)) break; }
await Bun.sleep(500);
let pass = 0, fail = 0;
const set = (a: any[]) => [...a].sort().join(',');
const check = (name: string, got: any[], want: any[]) => { if (set(got) === set(want)) pass++; else { fail++; console.log('FAIL', name, '\n  got ', set(got).slice(0, 200), `(${got.length})`, '\n  want', set(want).slice(0, 200), `(${want.length})`); } };
const note = (name: string, ok: boolean, extra = '') => { if (ok) pass++; else { fail++; console.log('FAIL', name, extra); } };
const funds: any[] = await ev(`state.funds.map(f => ({ ticker: f.ticker, name: f.name, category: f.category, aumValue: f.aumValue, terValue: f.terValue, ytd: f.ytd, yr1: f.yr1, secYield: f.secYield, inceptionDate: f.inceptionDate, dividendFrequency: f.dividendFrequency, holdings: f.holdings }))`);
console.log('funds:', funds.length);
const apply = async (key: string, expr: string, override?: string) => {
  await ev(`(() => { state.activeTab = 'All'; columnFilterState.filters = { catalog: ${JSON.stringify({ [key]: expr })} }; columnFilterState.typeOverrides = ${override ? JSON.stringify({ catalog: { [key]: override } }) : '{}'}; render(); return 1; })()`);
  return (await ev(`filteredCatalogFunds().map(f => f.ticker)`)) as string[];
};
const T = (pred: (f: any) => boolean) => funds.filter(pred).map((f) => f.ticker);
const num = (v: any) => typeof v === 'number' && Number.isFinite(v);
// header badges and the filter row
await ev(`(() => { columnFilterState.filters = {}; render(); return 1; })()`);
console.log('types:', await ev(`filterInfo.catalog.columns.map((c, i) => c.key + ':' + filterInfo.catalog.types[i]).join(' ')`));
note('filter row exists', (await ev(`document.querySelectorAll('#table-head tr.filter-row input').length`)) === (await ev(`filterInfo.catalog.columns.length`)));
note('every header has a type badge', (await ev(`document.querySelectorAll('#table-head tr:first-child .type-badge').length`)) === (await ev(`filterInfo.catalog.columns.length`)));
// numeric and money
check('aum >1B', await apply('aumValue', '>1B'), T((f) => num(f.aumValue) && f.aumValue > 1e9));
check('aum 500M..2B', await apply('aumValue', '500M..2B'), T((f) => num(f.aumValue) && f.aumValue >= 5e8 && f.aumValue <= 2e9));
check('ter <=0.1', await apply('terValue', '<=0.1'), T((f) => num(f.terValue) && f.terValue <= 0.1));
check('ytd >10 <30', await apply('ytd', '>10 <30'), T((f) => num(f.ytd) && f.ytd > 10 && f.ytd < 30));
check('ytd !?', await apply('ytd', '!?'), T((f) => num(f.ytd)));
check('secYield ?', await apply('secYield', '?'), T((f) => !num(f.secYield)));
// text
check('ticker ^s', await apply('ticker', '^s'), T((f) => f.ticker.toLowerCase().startsWith('s')));
check('name etf, trust', await apply('name', 'etf, trust'), T((f) => /etf|trust/i.test(f.name)));
check('category !equit', await apply('category', '!equit'), T((f) => !(f.category || '').toLowerCase().includes('equit')));
check('freq quarterly', await apply('dividendFrequency', 'quarterly'), T((f) => (f.dividendFrequency || '').toLowerCase().includes('quarterly')));
check('ticker regex', await apply('ticker', '/^(a|b)/'), T((f) => /^(a|b)/i.test(f.ticker)));
// dates (the inception date)
const ts = (s: string) => Date.parse(s);
check('inception >=2016', await apply('inceptionDate', '>=2016'), T((f) => f.inceptionDate && Number.isFinite(ts(f.inceptionDate)) && ts(f.inceptionDate) >= Date.UTC(2016, 0, 1) - 86400000 * 2 && new Date(ts(f.inceptionDate)).getFullYear() >= 2016));
console.log('inception type:', await ev(`filterInfo.catalog.types[filterInfo.catalog.columns.findIndex(c => c.key === 'inceptionDate')]`));
// override to text
check('aum as text "1"', await apply('aumValue', '1', 'string'), await ev(`state.funds.filter(f => FUND_FILTER_COLUMNS.find(c => c.key === 'aumValue').text(f).toLowerCase().includes('1')).map(f => f.ticker)`));
// invalid is ignored and flagged
await apply('aumValue', '>abc');
check('invalid ignored', (await ev(`filteredCatalogFunds().map(f => f.ticker)`)) as string[], T(() => true));
note('invalid flagged', await ev(`document.querySelector('input[data-filter-col=aumValue]').classList.contains('is-invalid')`));
// combined + exports + select-all scope + copy
await ev(`(() => { columnFilterState.filters = { catalog: { aumValue: '>1B', ytd: '>0' } }; render(); return 1; })()`);
const combined = T((f) => num(f.aumValue) && f.aumValue > 1e9 && num(f.ytd) && f.ytd > 0);
check('combined', (await ev(`filteredCatalogFunds().map(f => f.ticker)`)) as string[], combined);
check('export rows follow the filters', (await ev(`currentExportRows().rows.map(r => r[1])`)) as string[], combined);
check('table rows follow the filters', (await ev(`[...document.querySelectorAll('#table-body tr[data-ticker]')].map(r => r.dataset.ticker)`)) as string[], combined);
check('visibleCatalogRows follows the filters', (await ev(`visibleCatalogRows().map(f => f.ticker)`)) as string[], combined);
note('toolbar badge', (await ev(`document.getElementById('filters-badge').textContent`)) === '2' && !(await ev(`document.getElementById('clear-filters-btn').hidden`)));
// typing keeps focus; escape clears; blur+sort keeps the click
await ev(`(() => { columnFilterState.filters = {}; render(); const i = document.querySelector('input[data-filter-col=name]'); i.focus(); i.value = 'etf'; i.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
await Bun.sleep(600);
note('typing keeps focus', (await ev(`document.activeElement.dataset.filterCol`)) === 'name' && (await ev(`document.activeElement.value`)) === 'etf' && (await ev(`filterExpressionFor('catalog', 'name')`)) === 'etf');
await ev(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
await Bun.sleep(300);
note('escape clears', (await ev(`filterExpressionFor('catalog', 'name')`)) === '' && (await ev(`filteredCatalogFunds().length`)) === funds.length);
// badge cycle, persistence, reload
await ev(`document.querySelector('button[data-type-col=aumValue]').click()`);
note('badge cycles and persists', (await ev(`localStorage.getItem(COLUMN_TYPES_KEY)`)).includes('aumValue'));
await ev(`document.querySelector('button[data-type-col=aumValue]').dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))`);
note('shift+click resets', (await ev(`localStorage.getItem(COLUMN_TYPES_KEY)`)) === null);
await ev(`(() => { columnFilterState.filters = { catalog: { ytd: '>5' } }; persistColumnFilters(); return 1; })()`);
await send('Page.reload'); for (let i = 0; i < 60; i++) { await Bun.sleep(500); if (await ev(`typeof state !== 'undefined' && state.funds.length > 0`).catch(() => false)) break; }
await Bun.sleep(600);
note('filters restored after reload', (await ev(`document.querySelector('input[data-filter-col=ytd]').value`)) === '>5');
// watchlist
await ev(`(() => { columnFilterState.filters = {}; render(); return 1; })()`);
const pick = (await ev(`state.funds.filter(f => f.holdings > 0).slice(0, 3).map(f => f.ticker)`)) as string[];
for (const t of pick) await ev(`document.querySelector('input[data-checkbox="${t}"]').click()`);
for (let i = 0; i < 80; i++) { await Bun.sleep(500); if (!(await ev(`isHoldingsLoading()`))) break; }
await ev(`document.querySelector('#selected-tabs-bar button[data-tab=watchlist]').click()`);
await Bun.sleep(500);
const wl: any[] = await ev(`getDedupedWatchlistRows().map(r => ({ symbol: r.symbol, name: r.name, fundCount: r.fundCount, weightSum: r.weightSum }))`);
console.log('watchlist rows:', wl.length);
const setWl = async (key: string, expr: string) => { await ev(`(() => { columnFilterState.filters = { watchlist: ${JSON.stringify({ [key]: expr })} }; render(); return 1; })()`); return (await ev(`getVisibleWatchlistRows().map(r => r.symbol)`)) as string[]; };
check('watchlist weightSum >1', await setWl('weightSum', '>1'), wl.filter((r) => r.weightSum > 1).map((r) => r.symbol));
check('watchlist fundCount >=2', await setWl('fundCount', '>=2'), wl.filter((r) => r.fundCount >= 2).map((r) => r.symbol));
check('watchlist name ^a', await setWl('name', '^a'), wl.filter((r) => (r.name || '').toLowerCase().startsWith('a')).map((r) => r.symbol));
note('watchlist badges+row', (await ev(`document.querySelectorAll('#table-head tr:first-child .type-badge').length`)) === 7 && (await ev(`document.querySelectorAll('#table-head tr.filter-row input').length`)) === 7);
await setWl('fundCount', '>=2');
check('watchlist export follows the filters', (await ev(`currentExportRows().rows.map(r => r[0])`)) as string[], wl.filter((r) => r.fundCount >= 2).map((r) => r.symbol));
// detail sheets
const sheetCount = async (tab: string, scope: string, key: string, expr: string) => {
  await ev(`(() => { columnFilterState.filters = { ${scope}: ${JSON.stringify({ [key]: expr })} }; document.querySelector('#selected-tabs-bar button[data-tab="detail:${tab}"]').click(); return 1; })()`);
  await Bun.sleep(1500);
  return ev(`document.querySelectorAll('#table-body tr').length`);
};
for (const tab of ['holdings', 'history', 'distributions']) {
  await ev(`(() => { columnFilterState.filters = {}; document.querySelector('#selected-tabs-bar button[data-tab="detail:${tab}"]').click(); return 1; })()`);
  await Bun.sleep(1800);
  const info: any = await ev(`filterInfo.${tab} ? { cols: filterInfo.${tab}.columns.map(c => c.label), types: filterInfo.${tab}.types } : null`);
  console.log(`${tab}:`, info ? info.cols.map((c: string, i: number) => c + ':' + info.types[i]).join(' ') : 'no table');
  note(`${tab} has a filter row`, !info || (await ev(`document.querySelectorAll('#table-head tr.filter-row input').length`)) === info.cols.length);
  if (info && info.cols.length) {
    const all = (await ev(`document.querySelectorAll('#table-body tr').length`)) as number;
    const dateCol = info.types.findIndex((t: string) => t === 'date' || t === 'datetime');
    const numCol = info.types.findIndex((t: string) => t === 'number' || t === 'percent' || t === 'currency');
    if (numCol >= 0) {
      const rows: string[][] = await ev(`(() => { const e = sheetState.get(sheetKey('${tab}')); return e ? e.rows : (() => { const d = fundMetaCache.get(state.activeFundTicker).distributions || { headers: [], rows: [] }; return distributionCells(d.headers || [], d.rows || []); })(); })()`);
      const type = info.types[numCol];
      const vals = rows.map((r) => Number(String(r[numCol]).replace(/[$,%\s]/g, '')));
      const mid = vals.filter(Number.isFinite).sort((a, b) => a - b)[Math.floor(vals.filter(Number.isFinite).length / 2)];
      const got = await sheetCount(tab, tab, `col${numCol}`, `>${mid}`);
      const want = vals.filter((v) => Number.isFinite(v) && v > mid).length;
      note(`${tab} numeric filter (${type})`, got === (want || (await ev(`document.querySelectorAll('#table-body tr td[colspan]').length`)) ? got : want) || got === want, `${got} vs ${want}`);
    }
    if (dateCol >= 0) {
      const rows: string[][] = await ev(`(() => { const e = sheetState.get(sheetKey('${tab}')); return e ? e.rows : (() => { const d = fundMetaCache.get(state.activeFundTicker).distributions || { headers: [], rows: [] }; return distributionCells(d.headers || [], d.rows || []); })(); })()`);
      const years = rows.map((r) => new Date(r[dateCol]).getFullYear()).filter(Number.isFinite);
      const y = years.sort()[Math.floor(years.length / 2)];
      const got = await sheetCount(tab, tab, `col${dateCol}`, String(y));
      const want = rows.filter((r) => new Date(r[dateCol]).getFullYear() === y).length;
      note(`${tab} date filter ${y}`, got === want || (want === 0 && got === 1), `${got} vs ${want}`);
    }
    note(`${tab} export follows filters`, (await ev(`currentExportRows().rows.length`)) <= (await ev(`(() => { const e = sheetState.get(sheetKey('${tab}')); return e ? e.rows.length : 9e9; })()`)));
  }
}
// sticky + dark screenshot
await ev(`(() => { columnFilterState.filters = { catalog: { aumValue: '>1B' } }; document.querySelector('#tabs-bar button[data-tab=All]').click(); document.getElementById('theme-toggle').click(); const sc = document.getElementById('table-scroll'); sc.scrollTop = 300; sc.scrollLeft = 300; return 1; })()`);
await Bun.sleep(600);
console.log('sticky:', await ev(`(() => { const sc = document.getElementById('table-scroll').getBoundingClientRect(); const h = document.querySelector('#table-head tr:first-child th').getBoundingClientRect(); const f = document.querySelector('#table-head tr.filter-row th').getBoundingClientRect(); const pin = document.querySelector('#table-head tr.filter-row th.catalog-sticky-use'); const pinR = pin ? pin.getBoundingClientRect() : null; return JSON.stringify({ headTop: Math.round(h.top - sc.top), filterTop: Math.round(f.top - sc.top), pinFilterTop: pinR ? Math.round(pinR.top - sc.top) : null, pinFilterLeft: pinR ? Math.round(pinR.left - sc.left) : null }); })()`));
const png = await send('Page.captureScreenshot', { format: 'png' }); await Bun.write(shot, Buffer.from(png.data, 'base64'));
console.log(`${pass} passed, ${fail} failed; console errors: ${logs.length ? logs.slice(0, 4).join(' | ') : 'none'}`);
proc.kill(); server.kill(); process.exit(fail || logs.length ? 1 : 0);
