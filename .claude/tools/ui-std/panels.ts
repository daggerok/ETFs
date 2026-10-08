// usage: bun panels.ts <repoDir>   (brand layout; hub/Stocks need review)
// Moves the header items into the detail-tabs panel, deletes the header, puts that panel above the toolbar, wraps both in #top-panels.
import { readFileSync, writeFileSync } from 'node:fs';
const dir = process.argv[2];
const htmlPath = `${dir}/src/index.html`, cssPath = `${dir}/src/index.css`, tsxPath = `${dir}/src/main.tsx`;
let lines = readFileSync(htmlPath, 'utf8').split('\n');
const idx = (re: RegExp, from = 0) => { const i = lines.findIndex((l, n) => n >= from && re.test(l)); if (i < 0) throw new Error('missing ' + re); return i; };
// header
const h0 = idx(/^ {4}<header /), h1 = idx(/^ {4}<\/header>/);
const headComment = lines[h0 - 1].includes('<!--') ? h0 - 1 : h0;
const hdr = lines.slice(h0 + 1, h1);
const blocks: string[][] = [];
for (let i = 0; i < hdr.length; i++) {
  if (/^ {6}<div /.test(hdr[i])) { let j = i; while (!/^ {6}<\/div>/.test(hdr[j])) j++; blocks.push(hdr.slice(i, j + 1)); i = j; }
}
if (blocks.length !== 2) throw new Error('header blocks ' + blocks.length);
const [left, right] = blocks;
left[0] = left[0].replace('flex flex-1 flex-wrap', 'flex flex-1 lg:flex-none flex-wrap').replace(/class="/, 'class="order-1 lg:min-w-0 ');
right[0] = right[0].replace('flex items-center gap-3 shrink-0', 'order-2 lg:order-3 flex items-center gap-3 shrink-0 ml-auto lg:ml-0 lg:justify-self-end');
// nav
const n0 = idx(/^ {6}<nav id="selected-tabs-panel"/), n1 = idx(/^ {6}<\/nav>/, n0);
const navComment = lines[n0 - 1].includes('<!--') ? n0 - 1 : n0;
const bar = lines.slice(n0 + 1, n1);
if (bar.length !== 1 || !bar[0].includes('id="selected-tabs-bar"')) throw new Error('tabs bar');
bar[0] = bar[0].replace(/^ {8}<div /, '        <div ').replace('w-full max-w-full', 'order-3 lg:order-2 basis-full lg:basis-auto max-w-full').replace('py-1', 'py-0.5');
const pad = (b: string[], n = 4) => b.map((l) => ' '.repeat(n) + l);
const navOpen = '        <nav id="selected-tabs-panel" class="bg-white dark:bg-slate-800/80 max-lg:dark:bg-slate-800 px-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs backdrop-blur-sm flex flex-wrap items-center gap-x-3 gap-y-2 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,auto)_minmax(0,1fr)] max-lg:sticky max-lg:top-0 max-lg:z-40 max-lg:mb-6" aria-label="Selected ETF detail views">';
const nav = ['        <!-- Top panel: brand, detail tabs, ETF count and theme (was the page header). Sticky on every width. -->', navOpen, ...pad(left), ...pad(bar, 2), ...pad(right), '        </nav>'];
// toolbar block: from its comment to the line before the blacklist comment
const t0 = idx(/^ {6}<!-- Search, Tabs & Action Bar -->/); let t1 = idx(/^ {6}<div id="blacklist-panel"/); while (lines[t1 - 1].trim() === "" || /^ {6}<!--.*-->$/.test(lines[t1 - 1])) t1--;
let tool = lines.slice(t0, t1).map((l) => (l.length ? '  ' + l : l));
while (tool.length && tool[tool.length - 1] === '') tool.pop();
{ const k = tool.findIndex((l, i) => i > 0 && /^ {8}<div /.test(l)); tool[k] = tool[k].replace('class="', 'class="max-lg:mb-6 '); }
const wrapper = ['      <div id="top-panels" class="max-lg:contents lg:sticky lg:top-0 lg:z-40 lg:space-y-6 lg:pt-8 lg:bg-slate-50 lg:dark:bg-slate-900">', ...nav, '', ...tool, '      </div>', ''];
// assemble: remove header, remove nav+comment, replace toolbar block
const out: string[] = [];
for (let i = 0; i < lines.length; i++) {
  if (i === headComment) { i = h1; if (lines[i + 1] === '') i++; continue; }
  if (i === t0) { out.push(...wrapper); i = t1; continue; }
  if (i === navComment) { i = n1; if (lines[i + 1] === '') i++; continue; }
  out.push(lines[i]);
}
let html = out.join('\n').replace(/<main class="([^"]*)p-4 sm:p-8 pb-0 sm:pb-0([^"]*)"/, '<main class="$1p-4 sm:p-8 pb-0 sm:pb-0 lg:pt-0$2"');
writeFileSync(htmlPath, html);
// css
let css = readFileSync(cssPath, 'utf8');
const re = /main\.space-y-6 > #selected-tabs-panel\{margin-top:1\.5rem;padding-top:1rem;padding-bottom:1rem(;border-color:[^}]*)?\}/;
if (!re.test(css)) throw new Error("css rule");
css = css.replace(re, "#selected-tabs-panel{padding-top:.75rem;padding-bottom:.75rem$1}").replace(".dark main.space-y-6 > #selected-tabs-panel{", ".dark #selected-tabs-panel{");
writeFileSync(cssPath, css);
// tsx
let t = readFileSync(tsxPath, 'utf8');
const o = "document.querySelectorAll('main > *').forEach(child => {";
if (!t.includes(o)) throw new Error('observer');
writeFileSync(tsxPath, t.replace(o, "document.querySelectorAll('main > *, #top-panels > *').forEach(child => {"));
