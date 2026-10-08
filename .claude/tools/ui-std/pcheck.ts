// usage: bun pcheck.ts <repoDir> <port> <pngPrefix>
const [dir, port, prefix] = process.argv.slice(2);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const server = Bun.spawn(['bunx', 'serve', `${dir}/dist`, '-p', port, '--no-clipboard'], { stdout: 'ignore', stderr: 'ignore' });
const dbg = String(22000 + Number(port) - 1500);
const proc = Bun.spawn([CHROME, '--headless=new', `--remote-debugging-port=${dbg}`, '--window-size=1500,900', '--no-first-run', `--user-data-dir=/tmp/cdp-pc-${port}`, 'about:blank'], { stdout: 'ignore', stderr: 'ignore' });
let wsUrl = '';
for (let i = 0; i < 60 && !wsUrl; i++) { await Bun.sleep(250); try { const t = await (await fetch(`http://localhost:${dbg}/json`)).json(); wsUrl = t.find((x: any) => x.type === 'page')?.webSocketDebuggerUrl ?? ''; } catch {} }
const ws = new WebSocket(wsUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map<number, (v: any) => void>(); const errs: string[] = [];
ws.onmessage = (m) => { const d = JSON.parse(String(m.data)); if (d.id && pending.has(d.id)) pending.get(d.id)!(d.result ?? d.error); if (d.method === 'Runtime.exceptionThrown') errs.push(d.params.exceptionDetails.text); if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errs.push('console.error'); };
const send = (method: string, params: any = {}) => new Promise<any>((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e: string) => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.value;
await send('Runtime.enable'); await send('Page.enable');
for (let i = 0; i < 40; i++) { try { if ((await fetch(`http://localhost:${port}/`)).ok) break; } catch {} await Bun.sleep(250); }
const R = `(() => { const q = (s) => document.querySelector(s); const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; }; const tb = [...document.querySelectorAll('#top-panels > div')].find(d => d.querySelector('#search-input')) || q('#search-input')?.closest('div[class*="rounded-xl"]'); return { header: !!q('header'), nav: r(q('#selected-tabs-panel')), toolbar: r(tb), title: r(q('h1')), count: r(q('#ticker-count')), theme: r(q('#theme-toggle')), tabs: r(q('#selected-tabs-bar')), table: r(q('#table-scroll')), footer: r(q('footer')), scrollY: Math.round(scrollY), docH: document.scrollingElement.scrollHeight, innerH: innerHeight, hscroll: document.scrollingElement.scrollWidth - innerWidth }; })()`;
const out: any = {};
for (const [w, h] of [[1500, 900], [1024, 800], [390, 800]]) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 });
  await send('Page.navigate', { url: `http://localhost:${port}/` });
  for (let i = 0; i < 40; i++) { await Bun.sleep(500); if (await ev(`document.querySelectorAll('#table-body tr').length > 3`)) break; }
  await Bun.sleep(800);
  const top = await ev(R);
  const shot = await send('Page.captureScreenshot', { format: 'png' }); await Bun.write(`${prefix}-${w}.png`, Buffer.from(shot.data, 'base64'));
  await ev(`window.scrollTo(0, 400)`); await Bun.sleep(400);
  const scrolled = await ev(R);
  const shot2 = await send('Page.captureScreenshot', { format: 'png' }); await Bun.write(`${prefix}-${w}-scrolled.png`, Buffer.from(shot2.data, 'base64'));
  out[w] = { top, scrolled: { scrollY: scrolled.scrollY, nav: scrolled.nav, toolbar: scrolled.toolbar } };
}
out.errors = errs;
console.log(JSON.stringify(out));
proc.kill(); server.kill();
