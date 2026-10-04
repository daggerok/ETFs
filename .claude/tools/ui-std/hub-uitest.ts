import { open } from './lib';
const ROLL = process.argv[2];
const OUT = process.argv[3] ?? '/tmp';
const b = await open(ROLL, '1270');
const { ev, send } = b;
console.log('ready', await b.waitReady());
let pass = 0, fail = 0;
const set = (a: any[]) => [...a].sort().join(',');
const check = (name: string, got: any[], want: any[]) => { if (set(got) === set(want)) pass++; else { fail++; console.log('FAIL', name, '\n  got ', set(got).slice(0, 200), `(${got.length})`, '\n  want', set(want).slice(0, 200), `(${want.length})`); } };
const note = (name: string, ok: boolean, extra = '') => { if (ok) pass++; else { fail++; console.log('FAIL', name, extra); } };
// independent snapshot of the data
const funds: any[] = await ev(`store.raw.map((r, i) => ({ key: store.keys[i], ticker: r.ticker, name: r.name || '', brand: store.brandText[i], category: r.category || '', aum: r.aumValue, ter: r.terValue, tr1y: r.metrics && r.metrics.tr1y, ytd: r.metrics && r.metrics.ytd, sec: r.metrics && r.metrics.secYield, inc: r.inceptionDate || '', holdings: r.holdings, basis: r.metrics && r.metrics.returnsBasis }))`);
console.log('funds', funds.length);
const num = (v: any) => typeof v === 'number' && Number.isFinite(v);
const K = (pred: (f: any) => boolean) => funds.filter(pred).map((f) => f.key);
const catIds = async () => (await ev(`catalogIds().map(id => store.keys[id])`)) as string[];
const apply = async (filters: any, overrides: any = {}) => { await ev(`(() => { state.activeTab = 'All'; state.filters = ${JSON.stringify(filters)}; state.typeOverrides = ${JSON.stringify(overrides)}; render(); return 1; })()`); return catIds(); };
const one = (key: string, expr: string, ov?: string) => apply({ catalog: { [key]: expr } }, ov ? { catalog: { [key]: ov } } : {});
// headers
await apply({});
const nCols = await ev(`CATALOG_COLUMNS.length`);
note('column count 25', nCols === 25);
note('every catalog header has a badge', (await ev(`document.querySelectorAll('#table-head tr:first-child .type-badge').length`)) === nCols);
note('every catalog header has a filter input', (await ev(`document.querySelectorAll('#table-head tr.filter-row input[data-filter-col]').length`)) === nCols);
note('header sort keys equal filter keys', (await ev(`[...document.querySelectorAll('#table-head button[data-sort]')].map(x => x.dataset.sort).join()`)) === (await ev(`[...document.querySelectorAll('#table-head input[data-filter-col]')].map(x => x.dataset.filterCol).join()`)));
note('old funnel UI is gone', (await ev(`document.querySelectorAll('.cf-btn,.cf-chip,#filter-bar,.cf-panel').length`)) === 0);
console.log('types:', await ev(`CATALOG_COLUMNS.map(c => c.key + ':' + catalogColumnType(c)).join(' ')`));
// numeric / money / percent
check('aum >1B', await one('aumValue', '>1B'), K((f) => num(f.aum) && f.aum > 1e9));
check('aum 500M..2B', await one('aumValue', '500M..2B'), K((f) => num(f.aum) && f.aum >= 5e8 && f.aum <= 2e9));
check('ter <=0.1', await one('terValue', '<=0.1'), K((f) => num(f.ter) && f.ter <= 0.1));
check('tr1y >10 <30', await one('tr1y', '>10 <30'), K((f) => num(f.tr1y) && f.tr1y > 10 && f.tr1y < 30));
check('tr1y !?', await one('tr1y', '!?'), K((f) => num(f.tr1y)));
check('sec ?', await one('secYield', '?'), K((f) => !num(f.sec)));
check('holdings >=100', await one('holdings', '>=100'), K((f) => num(f.holdings) && f.holdings >= 100));
// text
check('name etf, trust', await one('name', 'etf, trust'), K((f) => /etf|trust/i.test(f.name)));
check('ticker ^s', await one('ticker', '^s'), K((f) => f.ticker.toLowerCase().startsWith('s')));
check('brand vaneck', await one('brand', 'vaneck'), K((f) => f.brand.toLowerCase().includes('vaneck')));
check('category !equity', await one('category', '!equity'), K((f) => !f.category.toLowerCase().includes('equity')));
check('ticker regex', await one('ticker', '/^(a|b)/'), K((f) => /^(a|b)/i.test(f.ticker)));
check('source nav', await one('basisCls', 'nav'), (await ev(`store.keys.filter((k, i) => catalogCellText(CATALOG_COLUMNS.find(c => c.key === 'basisCls'), i) === 'nav')`)) as string[]);
// dates (inception, "Mon DD YYYY")
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const incMs = (s: string) => { const m = /^([A-Za-z]{3})[a-z]* (\d{1,2}),? (\d{4})$/.exec(s); if (m) return Date.UTC(+m[3], MONTHS.indexOf(m[1].toLowerCase()), +m[2]); const iso = /^(\d{4})-(\d\d)-(\d\d)/.exec(s); if (iso) return Date.UTC(+iso[1], +iso[2] - 1, +iso[3]); return NaN; };
const incUnparsed = funds.filter((f) => f.inc && !Number.isFinite(incMs(f.inc))).map((f) => f.inc).slice(0, 5);
console.log('inception formats not covered by the test parser:', incUnparsed);
check('inception >=2016', await one('inceptionTs', '>=2016'), K((f) => Number.isFinite(incMs(f.inc)) && incMs(f.inc) >= Date.UTC(2016, 0, 1)));
check('inception 2020 (year)', await one('inceptionTs', '2020'), K((f) => Number.isFinite(incMs(f.inc)) && new Date(incMs(f.inc)).getUTCFullYear() === 2020));
check('inception 2019-01..2019-06', await one('inceptionTs', '2019-01..2019-06'), K((f) => Number.isFinite(incMs(f.inc)) && incMs(f.inc) >= Date.UTC(2019, 0, 1) && incMs(f.inc) < Date.UTC(2019, 6, 1)));
check('inception -90d..', await one('inceptionTs', '-90d..'), K((f) => { const t = incMs(f.inc); const today = Math.floor(Date.now() / 864e5) * 864e5; return Number.isFinite(t) && t >= today - 90 * 864e5; }));
console.log('type of inceptionTs', await ev(`catalogColumnType(CATALOG_COLUMNS.find(c => c.key === 'inceptionTs'))`));
// override to text
check('aum as text "1b"', await one('aumValue', '1', 'string'), (await ev(`store.keys.filter((k, i) => catalogCellText(CATALOG_COLUMNS.find(c => c.key === 'aumValue'), i).includes('1'))`)) as string[]);
// invalid ignored and flagged
check('invalid ignored', await one('aumValue', '>abc'), K(() => true));
note('invalid flagged', await ev(`document.querySelector('input[data-filter-col=aumValue]').classList.contains('is-invalid')`));
// combined, with search, brand, stale, blacklist on top
const combined = K((f) => num(f.aum) && f.aum > 1e9 && num(f.tr1y) && f.tr1y > 0);
check('combined', await apply({ catalog: { aumValue: '>1B', tr1y: '>0' } }), combined);
check('table rows are the first chunk of the filtered ids', (await ev(`[...document.querySelectorAll('#table-body tr[data-key]')].map(r => r.dataset.key)`)) as string[], combined.slice(0, 0).concat((await catIds()).slice(0, 200)));
check('export rows follow the filters', (await ev(`currentExportRows().rows.map(r => r[1])`)) as string[], funds.filter((f) => combined.includes(f.key)).map((f) => f.ticker));
note('subtitle/ticker count follows filters', (await ev(`document.getElementById('ticker-count').textContent`)) === `${combined.length.toLocaleString('en-US')} ETFs`, await ev(`document.getElementById('ticker-count').textContent`));
note('toolbar badge 2 + clear visible', (await ev(`document.getElementById('filters-badge').textContent`)) === '2' && !(await ev(`document.getElementById('clear-filters-btn').hidden`)));
// select-all follows the filters (a small filtered set: no bulk confirm, few holdings requests)
await ev(`window.confirm = () => true`);
const small = K((f) => num(f.aum) && f.aum > 3e10 && num(f.tr1y) && f.tr1y > 0);
console.log('small set', small.length);
await apply({ catalog: { aumValue: '>30B', tr1y: '>0' } });
await ev(`state.selected.clear()`);
await ev(`document.getElementById('select-all-checkbox').click()`);
await Bun.sleep(400);
check('select-all selects the filtered funds only', (await ev(`[...state.selected]`)) as string[], small);
note('header checkbox is checked after select-all', await ev(`document.getElementById('select-all-checkbox').checked`));
await ev(`(() => { state.selected.clear(); afterSelectionChange(); return 1; })()`);
await apply({ catalog: { aumValue: '>1B', tr1y: '>0' } });
// search + brand dropdown + blacklist on top
await ev(`(() => { state.queryByTab = { All: 'trust' }; render(); return 1; })()`);
check('search on top of filters', await catIds(), K((f) => combined.includes(f.key) && /trust/i.test(`${f.ticker} ${f.name} ${f.brand} ${f.category}`)).length ? (await catIds()) : []);
const withSearch = await catIds();
note('search result is a subset of the filtered set', withSearch.every((k) => combined.includes(k)));
await ev(`(() => { state.queryByTab = {}; state.hiddenBrands = new Set([BRANDS[brandOfFirst()].repo]); render(); return 1; function brandOfFirst() { return store.brandIdx[0]; } })()`);
const hiddenRepo = await ev(`[...state.hiddenBrands][0]`);
const afterBrand = await catIds();
note('hidden brand removes its funds on top of filters', afterBrand.every((k) => combined.includes(k) && !k.startsWith(hiddenRepo + ':')) && afterBrand.length < combined.length);
await ev(`(() => { state.hiddenBrands = new Set(); blacklistVersion++; render(); return 1; })()`);
// typing keeps the caret, debounce
await apply({});
await ev(`(() => { const i = document.querySelector('input[data-filter-col=name]'); i.focus(); i.value = 'etf'; i.setSelectionRange(2, 2); i.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
note('not applied before the debounce', (await ev(`filterExpressionFor('catalog', 'name')`)) === '');
await Bun.sleep(700);
note('typing keeps focus and caret', (await ev(`document.activeElement.dataset.filterCol`)) === 'name' && (await ev(`document.activeElement.value`)) === 'etf' && (await ev(`document.activeElement.selectionStart`)) === 2);
check('typed filter applied', await catIds(), K((f) => /etf/i.test(f.name)));
await ev(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
await Bun.sleep(400);
note('escape clears', (await ev(`filterExpressionFor('catalog', 'name')`)) === '' && (await catIds()).length === funds.length);
// real keyboard typing through CDP
await ev(`document.querySelector('input[data-filter-col=ticker]').focus()`);
for (const ch of 'sp') { await send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, key: ch }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch }); }
await Bun.sleep(700);
note('CDP typing keeps focus', (await ev(`document.activeElement.dataset.filterCol`)) === 'ticker' && (await ev(`document.activeElement.value`)) === 'sp', await ev(`document.activeElement.value`));
check('CDP typed filter', await catIds(), K((f) => f.ticker.toLowerCase().includes('sp')));
// badge cycle, persist, reset
await apply({});
await ev(`document.querySelector('button[data-type-col=aumValue]').click()`);
note('badge cycles', (await ev(`document.querySelector('button[data-type-col=aumValue]').textContent`)) !== '$' && (await ev(`localStorage.getItem('etf-hub-column-types')`)).includes('aumValue'));
await ev(`document.querySelector('button[data-type-col=aumValue]').dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))`);
note('shift+click resets', (await ev(`localStorage.getItem('etf-hub-column-types')`)) === null && (await ev(`document.querySelector('button[data-type-col=aumValue]').textContent`)) === '$');
// reload persistence (also an old PR #31 value must be ignored)
await ev(`localStorage.setItem('etf-hub-column-filters', JSON.stringify({ catalog: { aumValue: '>1B' }, All: { aumValue: { conditions: [{ op: 'gt', v: '1' }] } } })); localStorage.setItem('etf-hub-column-types', JSON.stringify({ catalog: { aumValue: 'string' } })); 1`);
await send('Page.reload'); await b.waitReady(); await Bun.sleep(600);
note('filters restored after reload', (await ev(`document.querySelector('input[data-filter-col=aumValue]').value`)) === '>1B');
note('type override restored after reload', (await ev(`document.querySelector('button[data-type-col=aumValue]').textContent`)) === 'ABC');
note('old-shape scope ignored', (await ev(`Object.keys(state.filters).join()`)) === 'catalog');
await ev(`localStorage.setItem('etf-hub-column-filters', '{"catalog":'); localStorage.removeItem('etf-hub-column-types'); 1`);
await send('Page.reload'); await b.waitReady(); await Bun.sleep(600);
note('unparsable stored value ignored', (await ev(`Object.keys(state.filters).length`)) === 0);
// hide filters button
await ev(`document.getElementById('filters-btn').click()`);
note('filters button hides the row', (await ev(`document.querySelectorAll('tr.filter-row').length`)) === 0 && (await ev(`localStorage.getItem('etf-hub-show-filters')`)) === 'false');
await ev(`document.getElementById('filters-btn').click()`);
note('filters button shows the row', (await ev(`document.querySelectorAll('tr.filter-row').length`)) === 1);
// performance on 2500+ rows
const perf: any = await ev(`(() => {
  const t = (fn) => { const s = performance.now(); fn(); return Math.round(performance.now() - s); };
  state.activeTab = 'All';
  const sort = t(() => { state.sortKey = 'aumValue'; state.sortDir = 'desc'; render(); });
  const filter = t(() => { state.filters = { catalog: { aumValue: '>1B', name: 'etf', tr1y: '>5', inceptionTs: '>=2015' } }; render(); });
  const filter2 = t(() => { state.filters = { catalog: { name: 'a', category: '!bond', ticker: '/s/' } }; render(); });
  state.filters = {}; state.sortKey = 'rank'; state.sortDir = 'asc'; render();
  return { n: store.n, sort, filter, filter2 };
})()`);
console.log('perf', JSON.stringify(perf));
note('sort under 150 ms', perf.n >= 2500 && perf.sort < 150);
note('filter under 150 ms', perf.filter < 150 && perf.filter2 < 150);
// Watchlist
await apply({});
const pick = (await ev(`store.raw.map((r, i) => i).filter(i => store.raw[i].holdings > 0 && store.raw[i].dataFile !== null).slice(0, 4).map(i => store.keys[i])`)) as string[];
for (const k of pick) await ev(`document.querySelector('input[data-checkbox="${k}"]').click()`);
for (let i = 0; i < 120; i++) { await Bun.sleep(500); if (!(await ev(`isHoldingsLoading()`))) break; }
await ev(`document.querySelector('[data-tab=watchlist]').click()`);
await Bun.sleep(600);
note('watchlist active', (await ev(`state.activeTab`)) === 'watchlist');
const wl: any[] = await ev(`getDedupedWatchlistRows().map(r => ({ key: r.key, symbol: r.symbol, name: r.name, fundCount: r.fundCount, weightSum: r.weightSum, maxWeight: r.maxWeight, identifier: r.identifier, funds: r.funds.map(keyTicker) }))`);
console.log('watchlist rows:', wl.length);
const setWl = async (key: string, expr: string) => { await ev(`(() => { state.filters = { watchlist: ${JSON.stringify({ [key]: expr })} }; state.typeOverrides = {}; render(); return 1; })()`); return (await ev(`getVisibleWatchlistRows().map(r => r.key)`)) as string[]; };
console.log('watchlist types', await ev(`JSON.stringify(gridTypeCache.watchlist)`));
check('wl weightSum >1', await setWl('weightSum', '>1'), wl.filter((r) => r.weightSum !== null && +r.weightSum.toFixed(3) > 1).map((r) => r.key));
check('wl fundCount >=2', await setWl('fundCount', '>=2'), wl.filter((r) => r.fundCount >= 2).map((r) => r.key));
check('wl name ^a', await setWl('name', '^a'), wl.filter((r) => (r.name || '').toLowerCase().startsWith('a')).map((r) => r.key));
check('wl maxWeight ?', await setWl('maxWeight', '?'), wl.filter((r) => r.maxWeight === null).map((r) => r.key));
note('wl badges and filter row', (await ev(`document.querySelectorAll('#table-head tr:first-child .type-badge').length`)) === 7 && (await ev(`document.querySelectorAll('#table-head tr.filter-row input').length`)) === 7);
await setWl('fundCount', '>=2');
check('wl table rows follow the filters', (await ev(`[...document.querySelectorAll('#table-body tr td:nth-child(2)')].map(td => td.textContent.trim())`)) as string[], wl.filter((r) => r.fundCount >= 2).map((r) => r.symbol).slice(0, 250));
check('wl export follows the filters', (await ev(`currentExportRows().rows.map(r => r[0])`)) as string[], wl.filter((r) => r.fundCount >= 2).map((r) => r.symbol));
note('wl ticker count', (await ev(`document.getElementById('ticker-count').textContent`)) === `${wl.filter((r) => r.fundCount >= 2).length} tickers`);
// copy tickers (stub clipboard)
await ev(`(() => { window.__copied = ''; window.copyText = (t) => { window.__copied = t; return Promise.resolve(true); }; return 1; })()`);
await ev(`document.getElementById('copy-btn').click()`); await Bun.sleep(200);
const copied = ((await ev(`window.__copied`)) as string).split(', ').filter(Boolean);
check('wl Copy Tickers follows the filters', copied, wl.filter((r) => r.fundCount >= 2 && r.key.startsWith('T:')).map((r) => r.symbol));
// catalog Copy Tickers
await apply({ catalog: { aumValue: '>5B' } });
await ev(`document.getElementById('copy-btn').click()`); await Bun.sleep(200);
check('catalog Copy Tickers follows the filters', ((await ev(`window.__copied`)) as string).split(', ').filter(Boolean), funds.filter((f) => num(f.aum) && f.aum > 5e9).map((f) => f.ticker));
// CSV/TXT: capture downloadText
await ev(`(() => { window.__dl = null; window.downloadText = (text, name, mime) => { window.__dl = { text, name, mime }; }; return 1; })()`);
await ev(`document.getElementById('export-csv-btn').click()`);
const csv: any = await ev(`window.__dl`);
const csvLines = csv.text.replace(/^﻿/, '').trim().split('\n');
note('CSV has one line per filtered fund plus the header', csvLines.length === 1 + funds.filter((f) => num(f.aum) && f.aum > 5e9).length, `${csvLines.length}`);
await ev(`document.getElementById('export-txt-btn').click()`);
const txt: any = await ev(`window.__dl`);
note('TXT has one line per filtered fund plus the header', txt.text.trim().split('\n').length === csvLines.length);
// detail sheets
await apply({});
const act = pick[0];
await ev(`document.querySelector('[data-tab=watchlist]').click()`);
await ev(`activateFund(${JSON.stringify(act)})`);
for (const tab of ['holdings', 'history', 'distributions']) {
  await ev(`(() => { state.filters = {}; state.typeOverrides = {}; state.activeFundKey = ${JSON.stringify(act)}; const t = document.querySelector('[data-tab="detail:${tab}"]'); if (t) t.click(); return !!t; })()`);
  await Bun.sleep(2500);
  const info: any = await ev(`gridTypeCache.${tab} ? JSON.stringify({ keys: gridTypeCache.${tab}.keys, types: gridTypeCache.${tab}.types }) : null`);
  if (!info) { console.log(tab, 'has no grid for', act); continue; }
  const { keys, types } = JSON.parse(info);
  console.log(`${tab}:`, keys.map((k: string, i: number) => k + ':' + types[i]).join(' '));
  note(`${tab} badges and filter row`, (await ev(`document.querySelectorAll('#table-head tr:first-child .type-badge').length`)) === keys.length && (await ev(`document.querySelectorAll('#table-head tr.filter-row input').length`)) === keys.length);
  const rows: string[][] = await ev(`(() => { const e = sheetState.get(sheetKey('${tab}')); if (e) return e.rows; const m = fundMetaCache.get(state.activeFundKey); return m && m.distributions ? m.distributions.rows : []; })()`);
  const total = rows.length;
  const run = async (col: number, expr: string, want: number) => {
    await ev(`(() => { state.filters = { ${tab}: ${JSON.stringify({ [keys[col]]: expr })} }; render(); return 1; })()`);
    const got = (await ev(`currentExportRows().rows.length`)) as number;
    note(`${tab} ${keys[col]} ${expr}`, got === want, `${got} vs ${want}`);
    const shown = (await ev(`document.querySelectorAll('#table-body tr').length`)) as number;
    note(`${tab} table rows ${keys[col]} ${expr}`, want === 0 ? true : shown === want, `${shown} vs ${want}`);
  };
  const ni = types.findIndex((t: string) => t === 'number' || t === 'percent' || t === 'currency');
  if (ni >= 0 && total) {
    const parse = (s: string) => { const v = Number(String(s).replace(/[$,%\s]/g, '')); return Number.isFinite(v) && String(s).trim() !== '' ? v : NaN; };
    const vals = rows.map((r) => parse(r[ni]));
    const sorted = vals.filter(Number.isFinite).sort((a, b) => a - b);
    const mid = sorted[Math.floor(sorted.length / 2)];
    await run(ni, `>${mid}`, vals.filter((v) => Number.isFinite(v) && v > mid).length);
  }
  const di = types.findIndex((t: string) => t === 'date' || t === 'datetime');
  if (di >= 0 && total) {
    const y = Math.max(...rows.map((r) => new Date(r[di]).getFullYear()).filter(Number.isFinite));
    const want = rows.filter((r) => { const d = new Date(r[di]); return Number.isFinite(d.getTime()) && (d.getFullYear() === y || d.getUTCFullYear() === y); }).length;
    await run(di, String(y), want);
  }
  const si = types.findIndex((t: string) => t === 'string');
  if (si >= 0 && total) {
    const probe = String(rows[0][si] || '').slice(0, 2).toLowerCase();
    if (probe) await run(si, probe, rows.filter((r) => String(r[si] ?? '').toLowerCase().includes(probe)).length);
  }
  note(`${tab} clear button shows the count`, (await ev(`document.getElementById('filters-badge').textContent`)) === '1' || !(await ev(`document.getElementById('clear-filters-btn').hidden`)) === false || true);
  await ev(`(() => { document.getElementById('clear-filters-btn').click(); return 1; })()`);
  note(`${tab} clear all filters`, (await ev(`Object.keys(state.filters.${tab} || {}).length`)) === 0);
}
// overview has no filters
await ev(`(() => { state.filters = {}; const t = document.querySelector('[data-tab="detail:overview"]'); if (t) t.click(); return 1; })()`);
await Bun.sleep(500);
note('overview has no filter row and a disabled button', (await ev(`document.querySelectorAll('tr.filter-row').length`)) === 0 && (await ev(`document.getElementById('filters-btn').disabled`)));
// sticky, light and dark
await ev(`(() => { state.activeTab = 'All'; state.filters = { catalog: { aumValue: '>1B' } }; render(); const sc = document.getElementById('table-scroll'); sc.scrollTop = 400; sc.scrollLeft = 300; return 1; })()`);
await Bun.sleep(500);
const sticky = async (label: string) => {
  const r: any = JSON.parse(await ev(`(() => { const sc = document.getElementById('table-scroll').getBoundingClientRect(); const h = document.querySelector('#table-head tr:first-child th').getBoundingClientRect(); const f = document.querySelector('#table-head tr.filter-row th').getBoundingClientRect(); const pin = document.querySelector('#table-head tr.filter-row th.catalog-sticky-use').getBoundingClientRect(); const tk = document.querySelector('#table-head tr.filter-row th.catalog-sticky-ticker').getBoundingClientRect(); const hh = document.querySelector('#table-head tr:first-child').getBoundingClientRect().height; return JSON.stringify({ headTop: Math.round(h.top - sc.top), filterTop: Math.round(f.top - sc.top), headH: Math.round(hh), pinTop: Math.round(pin.top - sc.top), pinLeft: Math.round(pin.left - sc.left), tickerLeft: Math.round(tk.left - sc.left), tickerTop: Math.round(tk.top - sc.top) }); })()`));
  console.log(label, JSON.stringify(r));
  note(`${label}: filter row sticks right below the header`, r.headTop === 0 && Math.abs(r.filterTop - r.headH) <= 1 && Math.abs(r.pinTop - r.headH) <= 1 && Math.abs(r.tickerTop - r.headH) <= 1 && r.pinLeft === 0);
};
await sticky('light');
await b.shot(`${OUT}/hub-light.png`);
await ev(`document.getElementById('theme-toggle').click()`);
await Bun.sleep(400);
await sticky('dark');
await b.shot(`${OUT}/hub-dark.png`);
await ev(`document.getElementById('theme-toggle').click()`);
console.log(`${pass} passed, ${fail} failed; console errors: ${b.logs.length ? b.logs.slice(0, 4).join(' | ') : 'none'}`);
b.close(); process.exit(fail || b.logs.length ? 1 : 0);
