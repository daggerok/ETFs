/// <reference types="bun" />
// usage: bun check-readme.ts <repoDir>...   - verifies both shared tables equal the canonical shared-blocks.md and structure
import { readFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
const S = dirname(new URL(import.meta.url).pathname);
const canon = readFileSync(`${S}/shared-blocks.md`, 'utf8').trimEnd();
const reg = JSON.parse(readFileSync(`${S}/registry.json`, 'utf8'));
const ORDER = ['Using Bun', 'Updating the static', 'Data sources', 'Metrics and caveats', 'Update controls', 'Examples', 'TypeScript and verification', 'Brands table', 'Sibling applications', 'License'];
let bad = 0;
for (const d of process.argv.slice(2)) {
  const f = `${d}/README.md`; const errs: string[] = [];
  if (!existsSync(f)) { console.log(`FAIL ${d}: no README`); bad++; continue; }
  const t = readFileSync(f, 'utf8');
  if (!t.includes(canon)) errs.push('shared Brands+Sibling block differs from canonical');
  for (const [h, cols] of [['Brands table', 2], ['Sibling applications', 3]] as const) {
    const sec = (t.match(new RegExp(`## ${h}\\n([\\s\\S]*?)(\\n## |$)`)) ?? [])[1] ?? '';
    const rows = sec.split('\n').filter(l => l.startsWith('|')).slice(2);
    if (rows.length !== reg.length) errs.push(`${h}: ${rows.length} rows != ${reg.length}`);
    for (const r of rows) if (r.split(/(?<!\\)\|/).length - 2 !== cols) errs.push(`${h}: bad column count`);
    for (const e of reg) if (rows.filter(r => r.includes(`/daggerok/${e.repo})`) || r.includes(`/daggerok.github.io/${e.repo}/)`) || r.includes(`github.io/${e.repo}/)`)).length !== 1) errs.push(`${h}: ${e.repo} missing/duplicated`);
  }
  let last = -1;
  for (const h of ORDER) { const i = t.search(new RegExp(`^#{2,3} .*${h}`, 'm')); if (i < 0) errs.push(`missing section: ${h}`); else if (i < last) errs.push(`section out of order: ${h}`); else last = i; }
  // the License section must carry MIT and the independence disclaimer (not just any mention elsewhere in the file)
  const lic = (t.match(/^## License\n([\s\S]*)$/m) ?? [])[1] ?? '';
  if (!/MIT/.test(lic) || !/trademark|not affiliated/i.test(lic)) errs.push('License section must name MIT and carry the independence disclaimer');
  // the verification section lists exactly the four standard commands
  const ver = (t.match(/^## TypeScript and verification\n([\s\S]*?)(?=\n## |$(?![\s\S]))/m) ?? [])[1] ?? '';
  // commands are inline `code` spans (or fenced lines) that start with bun or git
  const cmds = [...[...ver.matchAll(/`([^`\n]+)`/g)].map(m => m[1].trim()), ...[...ver.matchAll(/```(?:bash|sh)?\n([\s\S]*?)```/g)].flatMap(m => m[1].split('\n').map(l => l.trim()))].filter(c => /^(bun|git) /.test(c) && !/^bun (x|run) /.test(c));
  const order = new Map<string, number>(); // prose may mention `bun test` again: each distinct command counts once, order is free
  cmds.forEach((c, i) => { if (!order.has(c)) order.set(c, i); });
  const found = [...order.entries()].sort((a, b) => a[1] - b[1]).map(e => e[0]);
  const want = ['bun install --frozen-lockfile', 'bun test', 'bun build --target=bun scripts/update-data.ts --outfile=/dev/null', 'git diff --check'];
  if ([...found].sort().join('\n') !== [...want].sort().join('\n')) errs.push(`verification commands must be exactly this set: ${want.join(' | ')} (found: ${found.join(' | ') || 'none'})`);
  console.log(errs.length ? `FAIL ${d}: ${errs.join('; ')}` : `ok   ${d}`); bad += errs.length ? 1 : 0;
}
process.exit(bad ? 1 : 0);
