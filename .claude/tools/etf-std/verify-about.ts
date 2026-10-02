/// <reference types="bun" />
import { readFileSync } from 'node:fs';
const rows = Bun.spawnSync(['bun', new URL('./about.ts', import.meta.url).pathname]).stdout.toString().trim().split('\n').map(l => JSON.parse(l));
const common = 'css csv etf finance github-pages holdings html json static-api typescript watchlist'.split(' ');
let bad = 0;
for (const r of rows) {
  const p = Bun.spawnSync(['gh', 'api', `repos/daggerok/${r.repo}`, '--jq', '{d:.description,h:.homepage,t:.topics}']);
  const g = JSON.parse(p.stdout.toString());
  const miss = common.filter(t => !g.t.includes(t));
  const ok = g.d === r.desc && g.h === r.home && !miss.length && g.d.length <= 350;
  if (!ok) { bad++; console.log('MISMATCH', r.repo, g.d === r.desc, g.h, miss); }
}
console.log(bad ? `${bad} mismatches` : `all ${rows.length} verified`);
