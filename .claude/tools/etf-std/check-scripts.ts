/// <reference types="bun" />
// usage: bun check-scripts.ts <repoDir>... - scripts/ must hold exactly the 3 standard files; no worklog/prompt/evidence/research/fixtures
import { existsSync, readdirSync } from 'node:fs';
let bad = 0;
for (const d of process.argv.slice(2)) {
  const errs: string[] = [];
  const have = readdirSync(`${d}/scripts`).sort(); const want = ['update-data.config.json', 'update-data.test.ts', 'update-data.ts'];
  const extra = have.filter(f => !want.includes(f)), missing = want.filter(f => !have.includes(f));
  if (extra.length) errs.push(`extra in scripts/: ${extra.join(', ')}`); if (missing.length) errs.push(`missing: ${missing.join(', ')}`);
  for (const f of ['.worklog.txt', '.prompt.txt', 'evidence', 'research', '.plans']) if (existsSync(`${d}/${f}`)) errs.push(`${f} present`);
  console.log(errs.length ? `FAIL ${d}: ${errs.join('; ')}` : `ok   ${d}`); bad += errs.length ? 1 : 0;
}
process.exit(bad ? 1 : 0);
