// usage: bun clear-uitest.ts <repoDir> <port> <png>  (serves <repoDir>/dist; Stocks too)
// Checks the Clear dialog: items listed and ticked, Cancel keeps everything, a partial OK resets only the ticked items, the choice is remembered after a reload, Esc / Enter / None behave.
const [dir, port, shot] = process.argv.slice(2);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const server = Bun.spawn(['bunx', 'serve', `${dir}/dist`, '-p', port, '--no-clipboard'], { stdout: 'ignore', stderr: 'ignore' });
const dbg = String(24000 + Number(port) - 1500);
const proc = Bun.spawn([CHROME, '--headless=new', `--remote-debugging-port=${dbg}`, '--window-size=1500,900', '--no-first-run', `--user-data-dir=/tmp/cdp-clr-${port}`, 'about:blank'], { stdout: 'ignore', stderr: 'ignore' });
let wsUrl = '';
for (let i = 0; i < 60 && !wsUrl; i++) { await Bun.sleep(250); try { const t = await (await fetch(`http://localhost:${dbg}/json`)).json(); wsUrl = t.find((x: any) => x.type === 'page')?.webSocketDebuggerUrl ?? ''; } catch {} }
const ws = new WebSocket(wsUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map<number, (v: any) => void>(); const errs: string[] = [];
ws.onmessage = (m) => { const d = JSON.parse(String(m.data)); if (d.id && pending.has(d.id)) pending.get(d.id)!(d.result ?? d.error); if (d.method === 'Runtime.exceptionThrown') errs.push(d.params.exceptionDetails.text + ' ' + (d.params.exceptionDetails.exception?.description ?? '').slice(0, 120)); };
const send = (method: string, params: any = {}) => new Promise<any>((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e: string) => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.value;
const key = async (k: string, code: string) => { for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: k === 'Escape' ? 27 : 13 }); await Bun.sleep(300); };
await send('Runtime.enable'); await send('Page.enable');
for (let i = 0; i < 40; i++) { try { if ((await fetch(`http://localhost:${port}/`)).ok) break; } catch {} await Bun.sleep(250); }
const load = async () => { await send('Page.navigate', { url: `http://localhost:${port}/` }); for (let i = 0; i < 40; i++) { await Bun.sleep(500); if (await ev(`document.querySelectorAll('#table-body tr').length > 3 && !document.getElementById('reset-btn').disabled && typeof state !== 'undefined'`)) break; } await Bun.sleep(900); };
await send('Page.navigate', { url: `http://localhost:${port}/` }); await send('Runtime.evaluate', { expression: 'localStorage.clear()' }); await load();
let pass = 0, fail = 0; const bad: string[] = [];
const ok = (name: string, cond: any, extra = '') => { if (cond) pass++; else { fail++; bad.push(name + (extra ? ' ' + extra : '')); } };
const dlg = () => ev(`!!document.getElementById('clear-dialog')`);
const search = () => ev(`document.getElementById('search-input').value`);
const selected = () => ev(`state.selected.size`);
const setSearch = async (v: string) => { await ev(`(() => { const i = document.getElementById('search-input'); i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`); await Bun.sleep(700); };
const click = async (sel: string) => { await ev(`document.querySelector(${JSON.stringify(sel)}).click()`); await Bun.sleep(500); };
const baseSel = await selected();
await setSearch('a');
await ev(`document.querySelector('#table-body input[type=checkbox]').click()`); await Bun.sleep(500);
const selWith = await selected();
ok('a row got selected', selWith !== baseSel, `${baseSel} -> ${selWith}`);
// open
await click('#reset-btn');
ok('dialog opens', await dlg());
const n = await ev(`document.querySelectorAll('#clear-dialog input[data-clear-id]').length`);
ok('lists 10+ items', n >= 10, String(n));
ok('all ticked the first time', (await ev(`[...document.querySelectorAll('#clear-dialog input[data-clear-id]')].every(b => b.checked)`)) === true);
const labels = await ev(`[...document.querySelectorAll('#clear-dialog .clear-row span')].map(s => s.textContent).join(' | ')`);
ok('has a Blacklist item', /Blacklist/.test(labels), labels);
await Bun.write(shot, Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
// cancel keeps
await click('[data-clear-cancel]');
ok('cancel closes', !(await dlg()));
ok('cancel keeps search and selection', (await search()) === 'a' && (await selected()) === selWith);
// esc keeps
await click('#reset-btn'); await key('Escape', 'Escape');
ok('esc closes', !(await dlg()));
ok('esc keeps search', (await search()) === 'a');
// None disables OK
await click('#reset-btn'); await click('[data-clear-none]');
ok('None disables OK', (await ev(`document.querySelector('[data-clear-ok]').disabled`)) === true);
await click('[data-clear-all]');
ok('All enables OK', (await ev(`document.querySelector('[data-clear-ok]').disabled`)) === false);
// partial: untick Searches, OK
await ev(`document.querySelector('#clear-dialog input[data-clear-id="searches"]').click()`);
await click('[data-clear-ok]');
ok('partial OK closes', !(await dlg()));
ok('partial OK kept the search', (await search()) === 'a', await search());
ok('partial OK reset the selection', (await selected()) === baseSel, `${await selected()} vs ${baseSel}`);
// remembered after reload
await load();
await click('#reset-btn');
ok('choice remembered after reload (Searches unticked)', (await ev(`document.querySelector('#clear-dialog input[data-clear-id="searches"]').checked`)) === false);
ok('others still ticked', (await ev(`[...document.querySelectorAll('#clear-dialog input[data-clear-id]')].filter(b => b.dataset.clearId !== 'searches').every(b => b.checked)`)) === true);
// enter = OK with Searches ticked
await ev(`document.querySelector('#clear-dialog input[data-clear-id="searches"]').click()`);
await ev(`document.querySelector('#clear-dialog input[data-clear-id="searches"]').blur()`);
await key('Enter', 'Enter');
ok('Enter confirms', !(await dlg()));
ok('Enter reset the search too', (await search()) === '', await search());
ok('no page errors', errs.length === 0, errs.join(' / '));
console.log(`${pass} passed, ${fail} failed; console errors: ${errs.length ? errs.join(' / ') : 'none'}`);
if (fail) console.log('FAILED: ' + bad.join('; '));
proc.kill(); server.kill(); process.exit(fail ? 1 : 0);
