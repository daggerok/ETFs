const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const base = process.argv[2];
const proc = Bun.spawn([CHROME, '--headless=new', '--remote-debugging-port=9334', '--window-size=1500,900', '--no-first-run', '--user-data-dir=/tmp/cdp-ui-' + Date.now(), 'about:blank'], { stdout: 'ignore', stderr: 'ignore' });
let wsUrl = '';
for (let i = 0; i < 50 && !wsUrl; i++) { await Bun.sleep(200); try { const t = await (await fetch('http://localhost:9334/json')).json(); wsUrl = t.find((x: any) => x.type === 'page')?.webSocketDebuggerUrl ?? ''; } catch {} }
const ws = new WebSocket(wsUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map<number, (v: any) => void>(); const logs: string[] = [];
ws.onmessage = (m) => { const d = JSON.parse(String(m.data)); if (d.id && pending.has(d.id)) pending.get(d.id)!(d.result ?? d.error); if (d.method === 'Runtime.exceptionThrown') logs.push('EXC ' + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text)); if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') logs.push('ERR ' + d.params.args.map((a: any) => a.value ?? a.description).join(' ')); };
const send = (method: string, params: any = {}) => new Promise<any>((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr: string) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result?.value; };
await send('Runtime.enable'); await send('Page.enable'); await send('Page.navigate', { url: base });
await Bun.sleep(8000);
const index = await (await fetch(base + 'api/stocks/index.json')).json();
const rows: any[] = index.companies;
const set = (a: string[]) => [...a].sort().join(',');
let pass = 0, fail = 0;
const check = (name: string, got: string[], want: string[]) => { if (set(got) === set(want)) pass++; else { fail++; console.log('FAIL', name, '\n  got ', set(got), '\n  want', set(want)); } };
const shown = async () => (await ev('catalogIds().map(i => store.ticker[i])')) as string[];
const apply = async (key: string, expr: string, override?: string) => {
  await ev(`(() => { state.filters = { catalog: ${JSON.stringify({ [key]: expr })} }; state.typeOverrides = ${override ? JSON.stringify({ catalog: { [key]: override } }) : '{}'}; render(); return 1; })()`);
  return shown();
};
const T = (pred: (r: any) => boolean) => rows.filter(pred).map((r) => r.ticker);
const m = (r: any, k: string) => r.metrics[k];
const today = Math.floor(Date.now() / 86400000) * 86400000;
const iso = (d: string) => Date.parse(d + 'T00:00:00Z');
// numeric / money / percent
check('marketCap >1T', await apply('marketCap', '>1T'), T((r) => m(r, 'marketCap') > 1e12));
check('marketCap 500B..1T', await apply('marketCap', '500B..1T'), T((r) => m(r, 'marketCap') >= 5e11 && m(r, 'marketCap') <= 1e12));
check('marketCap ..100B', await apply('marketCap', '..100B'), T((r) => m(r, 'marketCap') <= 1e11));
check('pe >20 <30', await apply('pe', '>20 <30'), T((r) => m(r, 'pe') > 20 && m(r, 'pe') < 30));
check('pe <10, >100', await apply('pe', '<10, >100'), T((r) => m(r, 'pe') !== null && (m(r, 'pe') < 10 || m(r, 'pe') > 100)));
check('pe ?', await apply('pe', '?'), T((r) => m(r, 'pe') === null));
check('pFcf !?', await apply('pFcf', '!?'), T((r) => m(r, 'pFcf') !== null));
check('dividendYield >=2', await apply('dividendYield', '>=2'), T((r) => m(r, 'dividendYield') >= 2));
check('dividendYield =0', await apply('dividendYield', '=0'), T((r) => m(r, 'dividendYield') !== null && Math.abs(m(r, 'dividendYield')) < 0.5));
check('tr1y >50%', await apply('tr1y', '>50%'), T((r) => m(r, 'tr1y') > 50));
check('revenueGrowth !<10', await apply('revenueGrowth', '!<10'), T((r) => !(m(r, 'revenueGrowth') < 10)));
check('hidden column filter is not applied', await apply('netMarginDelta', '>0'), T(() => true)); // netMarginDelta is in a hidden column group
// the previous check hides nothing: netMarginDelta is in a hidden group, so no filter is applied
// text
check('sector financial', await apply('sector', 'financial'), T((r) => (r.sector || '').toLowerCase().includes('financial')));
check('sector !tech', await apply('sector', '!tech'), T((r) => !(r.sector || '').toLowerCase().includes('tech')));
check('name ^micro', await apply('name', '^micro'), T((r) => r.name.toLowerCase().startsWith('micro')));
check('name inc$', await apply('name', 'inc.$'), T((r) => r.name.toLowerCase().endsWith('inc.')));
check('exchange =nyse', await apply('exchange', '=nyse'), T((r) => r.exchange.toLowerCase() === 'nyse'));
check('ticker regex', await apply('ticker', '/^(aapl|msft|nvda)$/'), T((r) => ['AAPL', 'MSFT', 'NVDA'].includes(r.ticker)));
check('industry "semiconductors"', await apply('industry', '"semiconductors"'), T((r) => (r.industry || '').toLowerCase().includes('semiconductors')));
check('industry a, b', await apply('industry', 'banks, insurance'), T((r) => /banks|insurance/i.test(r.industry || '')));
// dates
check('fyTs >=2026', await apply('fyTs', '>=2026'), T((r) => r.fundamentalsAsOf && iso(r.fundamentalsAsOf) >= iso('2026-01-01')));
check('fyTs 2025-12', await apply('fyTs', '2025-12'), T((r) => r.fundamentalsAsOf && r.fundamentalsAsOf.startsWith('2025-12')));
check('fyTs <2025-10', await apply('fyTs', '<2025-10-01'), T((r) => r.fundamentalsAsOf && iso(r.fundamentalsAsOf) < iso('2025-10-01')));
check('fyTs range', await apply('fyTs', '2025-09..2025-11'), T((r) => r.fundamentalsAsOf && iso(r.fundamentalsAsOf) >= iso('2025-09-01') && iso(r.fundamentalsAsOf) < iso('2025-12-01')));
check('perfTs relative -7d..', await apply('perfTs', '-7d..'), T((r) => r.metrics.performanceAsOf && iso(r.metrics.performanceAsOf) >= today - 7 * 86400000));
// type override: P/E as text
check('pe as text "29"', await apply('pe', '29', 'string'), T((r) => m(r, 'pe') !== null && m(r, 'pe').toFixed(2).includes('29')));
// multi-column AND
await ev(`(() => { state.filters = { catalog: { sector: 'tech', marketCap: '>500B', pe: '<35' } }; state.typeOverrides = {}; render(); return 1; })()`);
check('combined', await shown(), T((r) => (r.sector || '').toLowerCase().includes('tech') && m(r, 'marketCap') > 5e11 && m(r, 'pe') !== null && m(r, 'pe') < 35));
// invalid expression is ignored and flagged
await apply('pe', '>abc');
check('invalid ignored', await shown(), T(() => true));
console.log('invalid flag:', await ev(`document.querySelector('input[data-filter-col=pe]').classList.contains('is-invalid')`), '| title:', (await ev(`document.querySelector('input[data-filter-col=pe]').getAttribute('data-tip') || document.querySelector('input[data-filter-col=pe]').title`)).slice(0, 70));
// detected types of the real columns
console.log('types:', await ev(`catalogFilterColumns().map(c => c.key + ':' + detectedCatalogType(c)).join(' ')`));
// UI path: typing with the debounce keeps focus and the caret
await ev(`(() => { state.filters = {}; state.typeOverrides = {}; render(); const i = document.querySelector('input[data-filter-col=name]'); i.focus(); i.value = 'apple'; i.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
await Bun.sleep(600);
console.log('typing:', await ev(`JSON.stringify({ rows: catalogIds().length, focus: document.activeElement.dataset.filterCol, value: document.activeElement.value })`));
// typing and clicking a sort header at once must not lose the click
await ev(`(() => { state.filters = {}; render(); const i = document.querySelector('input[data-filter-col=name]'); i.focus(); i.value = 'inc'; i.dispatchEvent(new Event('input', { bubbles: true })); const sort = document.querySelector('button[data-sort=marketCap]'); sort.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); i.blur(); sort.click(); return 1; })()`);
await Bun.sleep(500);
console.log('blur+sort:', await ev(`JSON.stringify({ sortKey: state.sortKey, dir: state.sortDir, filter: filterExpressionFor('catalog', 'name') })`));
await ev(`(() => { state.filters = {}; state.sortKey = 'marketCap'; state.sortDir = 'desc'; render(); const i = document.querySelector('input[data-filter-col=name]'); i.focus(); i.value = 'apple'; i.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
await Bun.sleep(600);
// Escape clears, badge click cycles and persists
await ev(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
await Bun.sleep(300);
console.log('escape:', await ev(`JSON.stringify({ rows: catalogIds().length, stored: localStorage.getItem('stocks-column-filters') })`));
await ev(`document.querySelector('button[data-type-col=pe]').click()`);
console.log('badge cycle:', await ev(`document.querySelector('button[data-type-col=pe]').textContent + ' ' + localStorage.getItem('stocks-column-types')`));
await ev(`document.querySelector('button[data-type-col=pe]').dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))`);
console.log('badge reset:', await ev(`document.querySelector('button[data-type-col=pe]').textContent + ' ' + localStorage.getItem('stocks-column-types')`));
// detail grids
await ev(`(() => { state.filters = {}; document.querySelector('input[data-checkbox=AAPL]').click(); return 1; })()`);
await Bun.sleep(1500);
await ev(`document.querySelector('#selected-tabs-bar button[data-tab="detail:history"]').click()`);
await Bun.sleep(1500);
const meta = await (await fetch(base + 'api/stocks/companies/AAPL/history/001.json')).json();
const hist = meta.rows as any[];
const gridCount = async (key: string, expr: string) => { await ev(`(() => { state.filters = { history: ${JSON.stringify({ [key]: expr })} }; render(); return 1; })()`); return ev(`document.querySelectorAll('#table-body tr').length`); };
let g = await gridCount('c0', '>=2026-09');
if (g === hist.filter((r) => r.Date >= '2026-09-01').length) pass++; else { fail++; console.log('FAIL history date', g, hist.filter((r) => r.Date >= '2026-09-01').length); }
g = await gridCount('c0', '2025');
if (g === hist.filter((r) => r.Date.startsWith('2025')).length) pass++; else { fail++; console.log('FAIL history year', g); }
g = await gridCount('c1', '>300');
if (g === hist.filter((r) => Number(r.Close) > 300).length) pass++; else { fail++; console.log('FAIL history close', g, hist.filter((r) => Number(r.Close) > 300).length); }
console.log('history types:', await ev(`JSON.stringify(gridTypeCache.history)`));
await ev(`document.querySelector('#selected-tabs-bar button[data-tab="detail:fundamentals"]').click()`);
await Bun.sleep(800);
const full = await (await fetch(base + 'api/stocks/companies/AAPL/meta.json')).json();
const ann = full.fundamentals.annual as any[];
g = await (async () => { await ev(`(() => { state.filters = { fundamentals: { c0: '>=2020', c1: '>300B' } }; render(); return 1; })()`); return ev(`document.querySelectorAll('#table-body tr').length`); })();
const wantF = ann.filter((a) => a.end >= '2020-01-01' && a.revenue > 3e11).length;
if (g === wantF) pass++; else { fail++; console.log('FAIL fundamentals', g, wantF); }
console.log('fund types:', await ev(`JSON.stringify(gridTypeCache.fundamentals.types)`));
await ev(`(() => { state.filters = { catalog: { marketCap: '>200B' } }; state.activeTab = 'All'; document.getElementById('tabs-bar').querySelector('button[data-tab=All]').click(); return 1; })()`);
await Bun.sleep(400);
await ev(`(() => { document.getElementById('theme-toggle').click(); const sc = document.getElementById('table-scroll'); sc.scrollTop = 300; sc.scrollLeft = 400; return 1; })()`);
await Bun.sleep(600);
console.log('sticky:', await ev(`(() => { const sc = document.getElementById('table-scroll').getBoundingClientRect(); const h = document.querySelector('#table-head tr:first-child th').getBoundingClientRect(); const f = document.querySelector('#table-head tr.filter-row th').getBoundingClientRect(); const pin = document.querySelector('#table-head tr.filter-row th.catalog-sticky-use').getBoundingClientRect(); const pinH = document.querySelector('#table-head tr:first-child th.catalog-sticky-use').getBoundingClientRect(); return JSON.stringify({ scrollTop: sc.top, headTop: Math.round(h.top - sc.top), filterTop: Math.round(f.top - sc.top), pinFilterTop: Math.round(pin.top - sc.top), pinHeadTop: Math.round(pinH.top - sc.top), pinFilterLeft: Math.round(pin.left - sc.left), dark: document.documentElement.classList.contains('dark') }); })()`));
const shot = await send('Page.captureScreenshot', { format: 'png' }); await Bun.write(process.argv[3] ?? '/tmp/ui.png', Buffer.from(shot.data, 'base64'));
console.log(`${pass} passed, ${fail} failed; console errors: ${logs.length ? logs.join(' | ') : 'none'}`);
proc.kill(); process.exit(fail ? 1 : 0);
