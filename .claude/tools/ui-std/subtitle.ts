// usage: bun subtitle.ts <repoDir> - keeps "N selected: ..." on the title row (one line, ellipsis) so the sticky top panel never changes height
import { readFileSync, writeFileSync } from 'node:fs';
const dir = process.argv[2];
const must = (s: string, a: string, b: string) => { if (!s.includes(a)) throw new Error('missing: ' + a); return s.replace(a, b); };
let h = readFileSync(`${dir}/src/index.html`, 'utf8');
h = must(h, 'flex flex-1 lg:flex-none flex-wrap items-center gap-x-3 gap-y-1.5 min-w-0', 'flex flex-1 flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-1.5 min-w-0');
h = must(h, '<div class="flex items-start gap-3 min-w-0">', '<div class="flex items-start gap-3 min-w-0 sm:shrink-0">');
h = must(h, 'id="app-subtitle" class="basis-full sm:basis-auto text-sm', 'id="app-subtitle" class="basis-full sm:basis-auto sm:flex-1 sm:min-w-0 truncate text-sm');
writeFileSync(`${dir}/src/index.html`, h);

let t = readFileSync(`${dir}/src/main.tsx`, 'utf8');
if (t.includes('const SUBTITLE_TICKER_CAP = 8;')) {
  t = must(t, 'const SUBTITLE_TICKER_CAP = 8;', 'const SUBTITLE_TICKER_CAP = 1;');
} else {
  const fn = t.indexOf('function renderHeaderSummary(');
  if (fn < 0) throw new Error('renderHeaderSummary');
  const end = t.indexOf('\n}\n', fn) + 3;
  let body = t.slice(fn, end);
  const each = /selected\.forEach\(\((\w+), index\) => \{/;
  if (!each.test(body)) throw new Error('forEach');
  body = body.replace(each, 'selected.slice(0, SUBTITLE_TICKER_CAP).forEach(($1, index) => {');
  const more = '\n  if (selected.length > SUBTITLE_TICKER_CAP) subtitle.append(document.createTextNode(` and ${selected.length - SUBTITLE_TICKER_CAP} more`));\n}\n';
  if (!/\n  \}\);\n\}\n$/.test(body)) throw new Error('tail');
  body = body.replace(/\n  \}\);\n\}\n$/, '\n  });' + more);
  t = t.slice(0, fn) + 'const SUBTITLE_TICKER_CAP = 1;\n\n' + body + t.slice(end);
}
writeFileSync(`${dir}/src/main.tsx`, t);

// second pass: fixed panel height - tabs never wrap (they scroll), the subtitle row is hidden on phones, grid columns give the tabs room
let h2 = readFileSync(`${dir}/src/index.html`, 'utf8');
h2 = must(h2, 'lg:grid-cols-[minmax(0,1fr)_minmax(0,auto)_minmax(0,1fr)]', 'lg:grid-cols-[minmax(11rem,1.5fr)_minmax(0,auto)_minmax(min-content,1fr)]');
h2 = must(h2, 'id="selected-tabs-bar" class="flex flex-wrap items-center justify-center gap-1.5 overflow-x-auto', 'id="selected-tabs-bar" class="flex flex-nowrap items-center [justify-content:safe_center] [&>*]:shrink-0 [&>*]:whitespace-nowrap gap-1.5 overflow-x-auto');
h2 = must(h2, 'id="app-subtitle" class="basis-full sm:basis-auto sm:flex-1', 'id="app-subtitle" class="hidden xl:block xl:flex-1');
writeFileSync(`${dir}/src/index.html`, h2);
let h3 = readFileSync(`${dir}/src/index.html`, 'utf8');
h3 = h3.replace(/(id="ticker-count" class=")/, '$1whitespace-nowrap ');
if (!h3.includes('id="ticker-count" class="whitespace-nowrap')) throw new Error('chip');
writeFileSync(`${dir}/src/index.html`, h3);
