// usage: bun categories-uitest.ts <repoDir> <port> <screenshot.png>
// Serves the repo with `bunx serve`, drives it in headless Chrome (CDP) and checks the column types and filters of a single-brand ETF app.
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const [repo, port, shot] = [process.argv[2], process.argv[3] ?? '1240', process.argv[4] ?? '/tmp/brand-ui.png'];
const server = Bun.spawn(['bunx', 'serve', repo, '-p', port], { stdout: 'ignore', stderr: 'ignore' });
const dbg = String(19000 + Number(port));
const proc = Bun.spawn([CHROME, '--headless=new', `--remote-debugging-port=${dbg}`, '--window-size=1500,900', '--no-first-run', '--user-data-dir=/tmp/cdp-cats-' + port + '-' + Date.now(), 'about:blank'], { stdout: 'ignore', stderr: 'ignore' });
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
await ev(`localStorage.removeItem(HIDDEN_CATEGORIES_KEY); hiddenCategories = new Set(); state.activeTab = 'All'; render(); 1`); await Bun.sleep(500);
const cats: string[] = await ev(`uniqueCategories()`);
const total = await ev(`state.funds.filter(f => !state.blacklist.has(f.ticker)).length`);
if (cats.length < 2) {
  // a single asset class: no dropdown is needed, the pill is the whole toolbar group
  ok('single class: dropdown hidden', await ev(`document.getElementById('categories-btn').closest('.dd-root').hidden`));
  ok('single class: pill lit', await ev(`document.querySelector('#tabs-bar button[data-tab="All"]').parentElement.className.includes('bg-blue-600')`));
  ok('single class: all rows shown', (await ev(`filteredCatalogFunds().length`)) === total);
  console.log(`${pass} passed, ${fail} failed; console errors: ${logs.length ? logs.slice(0, 4).join(' | ') : 'none'}`);
  proc.kill(); server.kill(); process.exit(fail || logs.length ? 1 : 0);
}
ok('more than one category', cats.length > 1, cats);
ok('only the All ETFs pill remains', (await ev(`[...document.querySelectorAll('#tabs-bar button[data-tab]')].map(b => b.dataset.tab).join()`)) === 'All');
ok('pill shows the total', (await ev(`document.querySelector('#tabs-bar button[data-tab="All"]').textContent.replace(/\\s+/g, ' ').trim()`)) === `All ETFs (${total})`);
ok('dropdown visible with All', (await ev(`!document.getElementById('categories-btn').closest('.dd-root').hidden && document.getElementById('categories-summary').textContent`)) === 'All');
ok('all rows shown', (await ev(`filteredCatalogFunds().length`)) === total);
await ev(`document.getElementById('categories-btn').click()`); await Bun.sleep(400);
ok('one row per category', (await ev(`document.querySelectorAll('#categories-panel .dd-opt').length`)) === cats.length);
ok('counts add up', (await ev(`[...document.querySelectorAll('#categories-panel .dd-opt .dd-num')].reduce((a, n) => a + Number(n.textContent), 0)`)) === total);
const first = cats[0];
const firstCount = await ev(`state.funds.filter(f => f.category === ${JSON.stringify(first)} && !state.blacklist.has(f.ticker)).length`);
await ev(`document.querySelector('#categories-panel .dd-opt[data-id=${JSON.stringify(first)}] .dd-only').click()`); await Bun.sleep(500);
ok('Only keeps one category', (await ev(`filteredCatalogFunds().length`)) === firstCount, await ev(`filteredCatalogFunds().length`));
ok('table rows match', (await ev(`[...document.querySelectorAll('#table-body > tr')].filter(r => r.children.length > 3).length`)) === firstCount);
ok('summary names the category', (await ev(`document.getElementById('categories-summary').textContent`)) === (await ev(`categoryLabel(${JSON.stringify(first)})`)));
ok('pill count follows', (await ev(`document.querySelector('#tabs-bar button[data-tab="All"]').textContent.replace(/\\s+/g, ' ').trim()`)) === `All ETFs (${firstCount})`);
await nav();
const lit = () => ev(`document.querySelector('#tabs-bar button[data-tab="All"]').parentElement.className.includes('bg-blue-600')`);
ok('pill is not lit while a class is selected', (await lit()) === false);
ok('selection persisted after reload', (await ev(`hiddenCategories.size`)) === cats.length - 1 && (await ev(`filteredCatalogFunds().length`)) === firstCount);
await ev(`document.getElementById('categories-btn').click()`); await Bun.sleep(400);
await ev(`document.querySelector('#categories-panel [data-act="reset"]').click()`); await Bun.sleep(500);
ok('Reset shows everything', (await ev(`filteredCatalogFunds().length`)) === total && (await ev(`document.getElementById('categories-summary').textContent`)) === 'All');

// the All ETFs pill: lit when nothing narrows the table, a click clears the asset class selection
await ev(`document.querySelector('#tabs-bar button[data-tab="All"]').click()`); await Bun.sleep(500);
ok('All ETFs click clears the selection', (await ev(`hiddenCategories.size`)) === 0 && (await ev(`filteredCatalogFunds().length`)) === total && (await lit()) === true);
await ev(`document.getElementById('categories-btn').click()`); await Bun.sleep(400);
await ev(`document.querySelector('#categories-panel [data-act="none"]').click()`); await Bun.sleep(500);
ok('nothing selected = All ETFs', (await ev(`filteredCatalogFunds().length`)) === total && (await lit()) === true);
await ev(`document.querySelector('#categories-panel .dd-opt[data-id=${JSON.stringify(cats[0])}]').click()`); await Bun.sleep(400);
await ev(`document.querySelector('#categories-panel .dd-opt[data-id=${JSON.stringify(cats[1])}]').click()`); await Bun.sleep(500);
if (cats.length >= 3) ok('two classes narrow the table and unlight the pill', (await lit()) === false && (await ev(`filteredCatalogFunds().length`)) < total);
await ev(`document.querySelector('#categories-panel [data-act="all"]').click()`); await Bun.sleep(500);
ok('everything selected = All ETFs again', (await lit()) === true && (await ev(`filteredCatalogFunds().length`)) === total);
await ev(`document.getElementById('categories-btn').click()`); await Bun.sleep(300);
const bar = await ev(`(() => { const b = document.getElementById('categories-btn').closest('.rounded-xl').getBoundingClientRect(); return b.height; })()`);
ok('toolbar is compact (at most two rows)', bar < 170, bar);
const png = await send('Page.captureScreenshot', { format: 'png' }); await Bun.write(shot, Buffer.from(png.data, 'base64'));
console.log(`${pass} passed, ${fail} failed; console errors: ${logs.length ? logs.slice(0, 4).join(' | ') : 'none'}`);
proc.kill(); server.kill(); process.exit(fail || logs.length ? 1 : 0);
