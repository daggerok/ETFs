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
  if (!/trademark|not affiliated/i.test(t)) errs.push('missing independence disclaimer');
  console.log(errs.length ? `FAIL ${d}: ${errs.join('; ')}` : `ok   ${d}`); bad += errs.length ? 1 : 0;
}
process.exit(bad ? 1 : 0);
