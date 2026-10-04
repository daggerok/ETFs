const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export async function open(repo: string, port: string, query = '?api=remote', size = '1500,900') {
  const server = Bun.spawn(['bunx', 'serve', repo, '-p', port], { stdout: 'ignore', stderr: 'ignore' });
  const dbg = String(19000 + Number(port));
  const proc = Bun.spawn([CHROME, '--headless=new', `--remote-debugging-port=${dbg}`, `--window-size=${size}`, '--no-first-run', '--user-data-dir=/tmp/cdp-hub-' + port + '-' + Date.now(), 'about:blank'], { stdout: 'ignore', stderr: 'ignore' });
  let wsUrl = '';
  for (let i = 0; i < 60 && !wsUrl; i++) { await Bun.sleep(250); try { const t = await (await fetch(`http://localhost:${dbg}/json`)).json(); wsUrl = t.find((x: any) => x.type === 'page')?.webSocketDebuggerUrl ?? ''; } catch {} }
  const ws = new WebSocket(wsUrl); await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = new Map<number, (v: any) => void>(); const logs: string[] = [];
  ws.onmessage = (m) => { const d = JSON.parse(String(m.data)); if (d.id && pending.has(d.id)) pending.get(d.id)!(d.result ?? d.error); if (d.method === 'Runtime.exceptionThrown') logs.push('EXC ' + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text)); if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') logs.push('ERR ' + d.params.args.map((a: any) => a.value ?? a.description).join(' ')); };
  const send = (method: string, params: any = {}) => new Promise<any>((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr: string) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result?.value; };
  await send('Runtime.enable'); await send('Page.enable');
  let ready = false;
  for (let i = 0; i < 40 && !ready; i++) { try { ready = (await fetch(`http://localhost:${port}/`)).ok; } catch {} if (!ready) await Bun.sleep(250); }
  await send('Page.navigate', { url: `http://localhost:${port}/${query}` });
  const waitReady = async () => { for (let i = 0; i < 120; i++) { await Bun.sleep(500); if (await ev(`typeof state !== 'undefined' && store && store.n > 1000 && !state.loading`).catch(() => false)) return true; } return false; };
  const shot = async (file: string) => { const png = await send('Page.captureScreenshot', { format: 'png' }); await Bun.write(file, Buffer.from(png.data, 'base64')); };
  const close = () => { proc.kill(); server.kill(); };
  return { send, ev, logs, waitReady, shot, close };
}
