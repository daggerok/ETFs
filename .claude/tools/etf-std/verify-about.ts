/// <reference types="bun" />
import { readFileSync } from 'node:fs';
const rows = Bun.spawnSync(['bun', new URL('./about.ts', import.meta.url).pathname]).stdout.toString().trim().split('\n').map(l => JSON.parse(l));
const common = 'css csv etf finance github-pages holdings html json static-api typescript watchlist'.split(' ').sort();
let bad = 0;
for (const r of rows) {
  const p = Bun.spawnSync(['gh', 'api', `repos/daggerok/${r.repo}`, '--jq', '{d:.description,h:.homepage,t:.topics}']);
  if (p.exitCode !== 0) { bad++; console.log('GH-FAILED', r.repo, p.stderr.toString().trim().split('\n')[0]); continue; }
  let g: any;
  try { g = JSON.parse(p.stdout.toString()); } catch { bad++; console.log('GH-BAD-JSON', r.repo); continue; }
  const topics: string[] = Array.isArray(g.t) ? [...g.t].sort() : [];
  const miss = common.filter(t => !topics.includes(t));
  const extra = topics.filter(t => !common.includes(t)); // the standard says exactly these topics
  const ok = g.d === r.desc && g.h === r.home && !miss.length && !extra.length && typeof g.d === 'string' && g.d.length <= 350;
  if (!ok) { bad++; console.log('MISMATCH', r.repo, { description: g.d === r.desc, homepage: g.h, missingTopics: miss, extraTopics: extra }); }
}
console.log(bad ? `${bad} mismatches` : `all ${rows.length} verified`);
process.exit(bad ? 1 : 0);
