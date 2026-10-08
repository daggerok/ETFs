// usage: bun subcheck.ts <repoDir> <port>: selects every row, prints heights/positions before and after
const [dir, port] = process.argv.slice(2);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const server = Bun.spawn(['bunx', 'serve', `${dir}/dist`, '-p', port, '--no-clipboard'], { stdout: 'ignore', stderr: 'ignore' });
const dbg = String(23000 + Number(port) - 1500);
const proc = Bun.spawn([CHROME, '--headless=new', `--remote-debugging-port=${dbg}`, '--window-size=1500,900', '--no-first-run', `--user-data-dir=/tmp/cdp-sc-${port}`, 'about:blank'], { stdout: 'ignore', stderr: 'ignore' });
let wsUrl = '';
for (let i = 0; i < 60 && !wsUrl; i++) { await Bun.sleep(250); try { const t = await (await fetch(`http://localhost:${dbg}/json`)).json(); wsUrl = t.find((x: any) => x.type === 'page')?.webSocketDebuggerUrl ?? ''; } catch {} }
const ws = new WebSocket(wsUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map<number, (v: any) => void>();
ws.onmessage = (m) => { const d = JSON.parse(String(m.data)); if (d.id && pending.has(d.id)) pending.get(d.id)!(d.result ?? d.error); };
const send = (method: string, params: any = {}) => new Promise<any>((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e: string) => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.value;
await send('Runtime.enable'); await send('Page.enable');
for (let i = 0; i < 40; i++) { try { if ((await fetch(`http://localhost:${port}/`)).ok) break; } catch {} await Bun.sleep(250); }
const M = `(() => { const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; }; return { nav: r('#selected-tabs-panel'), h1: r('h1'), sub: r('#app-subtitle'), tabs: r('#selected-tabs-bar'), text: document.getElementById('app-subtitle').innerText, subScrollW: document.getElementById('app-subtitle').scrollWidth, subClientW: document.getElementById('app-subtitle').clientWidth }; })()`;
const out: any = {};
for (const [w, h] of [[1500, 900], [1280, 800], [1024, 800], [390, 800]]) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 });
  await send('Page.navigate', { url: `http://localhost:${port}/` });
  await send('Runtime.evaluate', { expression: 'localStorage.clear()' });
  await send('Page.navigate', { url: `http://localhost:${port}/` });
  for (let i = 0; i < 40; i++) { await Bun.sleep(500); if (await ev(`document.querySelectorAll('#table-body tr').length > 3`)) break; }
  await Bun.sleep(800);
  await ev(`window.confirm = () => true`);
  const before = await ev(M);
  await ev(`(() => { const c = document.querySelector('#table-head input[type=checkbox]'); c && c.click(); return 1; })()`); for (let i = 0; i < 60; i++) { await Bun.sleep(500); if (await ev(`/selected/.test(document.getElementById('app-subtitle').innerText)`)) break; } await Bun.sleep(500);
  const after = await ev(M);
  const shot = await send('Page.captureScreenshot', { format: 'png' }); await Bun.write(`${process.argv[4] ?? '/tmp/sub'}-${w}.png`, Buffer.from(shot.data, 'base64'));
  const bad: string[] = [];
  const hb = before.nav[3] - before.nav[1], ha = after.nav[3] - after.nav[1];
  if (ha !== hb) bad.push(`nav height ${hb} -> ${ha}`);
  if (!after.text.includes('selected')) bad.push('no selected text');
  if (w >= 1280 && Math.abs(after.sub[1] - after.h1[1]) > 12) bad.push(`subtitle not on the title row (sub top ${after.sub[1]}, h1 top ${after.h1[1]})`);
  if (w >= 1280 && after.sub[2] > after.tabs[0]) bad.push(`subtitle reaches the tabs (${after.sub[2]} > ${after.tabs[0]})`);
  out[w] = { hb, ha, text: after.text.slice(0, 70), trunc: after.subScrollW > after.subClientW, bad };
}
console.log(JSON.stringify(out)); proc.kill(); server.kill();
