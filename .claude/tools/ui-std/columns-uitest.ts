// usage: bun columns-uitest.ts <repoDir> <port> <screenshot.png>
// Serves the repo with `bunx serve`, drives it in headless Chrome (CDP) and checks the column types and filters of a single-brand ETF app.
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const [repo, port, shot] = [process.argv[2], process.argv[3] ?? '1240', process.argv[4] ?? '/tmp/brand-ui.png'];
const server = Bun.spawn(['bunx', 'serve', repo, '-p', port], { stdout: 'ignore', stderr: 'ignore' });
const dbg = String(19000 + Number(port));
const proc = Bun.spawn([CHROME, '--headless=new', `--remote-debugging-port=${dbg}`, '--window-size=1500,900', '--no-first-run', '--user-data-dir=/tmp/cdp-cols-' + port + '-' + Date.now(), 'about:blank'], { stdout: 'ignore', stderr: 'ignore' });
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
const ok = (name: string, cond: boolean, extra: any = '') => { if (cond) pass++; else { fail++; console.log('FAIL', name, extra); } };
const nav = async () => { await send('Page.navigate', { url: `http://localhost:${port}/` }); for (let i = 0; i < 60; i++) { await Bun.sleep(500); if (await ev(`typeof state !== 'undefined' && state.funds.length > 0`).catch(() => false)) break; } await Bun.sleep(600); };
const open = async () => { await ev(`document.getElementById('columns-btn').click()`); await Bun.sleep(400); };
const click = async (id: string) => { await ev(`document.querySelector('#columns-panel .dd-opt[data-id="${id}"]').click()`); await Bun.sleep(400); };
const cells = async () => ({ head: await ev(`document.querySelector('#table-head tr').children.length`), body: await ev(`(() => { const r = [...document.querySelectorAll('#table-body > tr')].find(t => t.children.length > 3); return r ? r.children.length : -1; })()`) });
const visibleHeads = async () => (await ev(`[...document.querySelectorAll('#table-head tr:first-child th')].filter(th => getComputedStyle(th).display !== 'none').length`));
await ev(`localStorage.removeItem(COLUMN_VISIBILITY_KEY); state.activeTab = 'All'; render(); 1`); await Bun.sleep(500);
const keys: string[] = await ev(`menuColumns().map(c => c.key)`);
const total = keys.length;
ok('menu has use, ticker first', keys[0] === 'use' && keys[1] === 'ticker', keys.slice(0, 3));
ok('menu visible on the catalog', (await ev(`!document.getElementById('columns-btn').closest('.dd-root').hidden`)));
ok('summary all', (await ev(`document.getElementById('columns-summary').textContent`)) === `${total} of ${total}`);
const c0 = await cells(); ok('cells match at start', c0.head === c0.body && c0.head === total + 1, c0);
await open();
ok('one row per column', (await ev(`document.querySelectorAll('#columns-panel .dd-opt').length`)) === total);
ok('two locked rows', (await ev(`document.querySelectorAll('#columns-panel .dd-locked[aria-disabled="true"]').length`)) === 2);
ok('numbers are aligned', (await ev(`new Set([...document.querySelectorAll('#columns-panel .dd-opt .dd-num')].slice(0, 6).map(n => Math.round(n.getBoundingClientRect().right))).size`)) === 1);
await click('ticker'); await ev(`document.querySelector('#columns-panel [data-act="none"]').click()`); await Bun.sleep(500);
ok('Clear keeps use and ticker', (await ev(`hiddenColumns.size`)) === total - 2, await ev(`hiddenColumns.size`));
ok('ticker header stays', await ev(`[...document.querySelectorAll('#table-head tr:first-child th')].some(th => getComputedStyle(th).display !== 'none' && /Ticker/i.test(th.textContent))`));
await ev(`document.querySelector('#columns-panel [data-act="reset"]').click()`); await Bun.sleep(400);
ok('Reset shows all', (await ev(`hiddenColumns.size`)) === 0);
// hide a middle and the last column
const mid = keys[3], last = keys[total - 1];
await click(mid); await click(last);
const h1 = await visibleHeads(); const c1 = await cells();
ok('two columns hidden in the header', h1 === total + 1 - 2, h1);
ok('cells still match', c1.head === c1.body, c1);
ok('hidden cell is not displayed', (await ev(`(() => { const r = [...document.querySelectorAll('#table-body > tr')].find(t => t.children.length > 3); return getComputedStyle(r.children[${3 + 1}]).display; })()`)) === 'none');
// filters work on hidden columns
const numKeys: string[] = await ev(`FUND_FILTER_COLUMNS.filter(c => c.numeric && c.key !== 'ticker').map(c => c.key)`);
let numKey = numKeys[0];
for (const k of numKeys) { await ev(`hiddenColumns = new Set(); columnFilterState.filters = { catalog: { ${k}: '>0' } }; render(); 1`); if ((await ev(`filteredCatalogFunds().length`)) > 0) { numKey = k; break; } }
const expr = '>0';
await ev(`hiddenColumns = new Set(); document.getElementById('column-visibility-style').textContent = ''; columnFilterState.filters = { catalog: { ${numKey}: '${expr}' } }; render(); 1`); await Bun.sleep(400);
const shownRows = await ev(`filteredCatalogFunds().length`);
await ev(`hiddenColumns = new Set(['${numKey}']); columnFilterState.filters = { catalog: { ${numKey}: '${expr}' } }; render(); 1`); await Bun.sleep(400);
ok('filter on a hidden column gives the same rows', (await ev(`filteredCatalogFunds().length`)) === shownRows && shownRows > 0, shownRows);
await ev(`columnFilterState.filters = {}; hiddenColumns = new Set(); render(); 1`);
// persistence
await open(); await click(mid); await nav();
ok('hidden column persisted after reload', (await ev(`hiddenColumns.has('${mid}') && hiddenColumns.size === 1`)));
ok('summary after reload', (await ev(`document.getElementById('columns-summary').textContent`)) === `${total - 1} selected`);
const c2 = await cells(); ok('cells match after reload', c2.head === c2.body, c2);
// other tabs show every cell and no menu
const tabOk = await ev(`(() => { try { state.selected.add(state.funds[0].ticker); state.activeTab = 'watchlist'; render(); return document.getElementById('column-visibility-style').textContent === '' && document.getElementById('columns-btn').closest('.dd-root').hidden; } catch (e) { return String(e); } })()`);
ok('watchlist: no hidden cells, no menu', tabOk === true, tabOk);
await ev(`state.selected.clear(); state.activeTab = 'All'; render(); 1`); await Bun.sleep(400);
ok('back on the catalog the column stays hidden', (await ev(`document.getElementById('column-visibility-style').textContent.length > 0`)));
await ev(`hiddenColumns = new Set(); persistHiddenColumns(); setCatalogColumnStyle(true); 1`);
const png = await send('Page.captureScreenshot', { format: 'png' }); await Bun.write(shot, Buffer.from(png.data, 'base64'));
console.log(`${pass} passed, ${fail} failed; console errors: ${logs.length ? logs.slice(0, 4).join(' | ') : 'none'}`);
proc.kill(); server.kill(); process.exit(fail || logs.length ? 1 : 0);
