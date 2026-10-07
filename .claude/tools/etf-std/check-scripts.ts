/// <reference types="bun" />
// usage: bun check-scripts.ts <repoDir>... - scripts/ must hold exactly the 3 standard files; no worklog/prompt/evidence/research/fixtures; no top-level data/ folder (static tables live inside update-data.ts, updater state in api/<feed>/); no root app.tsx/index.html (they live in src/); .github/workflows = github-pages.yml + update-data.yml
import { existsSync, readdirSync, readFileSync } from 'node:fs';
let bad = 0;
for (const d of process.argv.slice(2)) {
  const errs: string[] = [];
  if (!existsSync(`${d}/scripts`)) { console.log(`FAIL ${d}: no scripts/ folder`); bad++; continue; }
  const have = readdirSync(`${d}/scripts`).sort(); const want = ['update-data.config.json', 'update-data.test.ts', 'update-data.ts'];
  const extra = have.filter(f => !want.includes(f)), missing = want.filter(f => !have.includes(f));
  if (extra.length) errs.push(`extra in scripts/: ${extra.join(', ')}`); if (missing.length) errs.push(`missing: ${missing.join(', ')}`);
  for (const f of ['.worklog.txt', '.prompt.txt', 'evidence', 'research', '.plans', 'COMPLETION.md', 'tsconfig.json', 'data', 'app.tsx', 'index.html', 'favicon.ico']) if (existsSync(`${d}/${f}`)) errs.push(`${f} present`);
  try { if (JSON.parse(readFileSync(`${d}/package.json`, 'utf8')).devDependencies?.typescript !== undefined || JSON.parse(readFileSync(`${d}/package.json`, 'utf8')).dependencies?.typescript !== undefined) errs.push('typescript must not be a dependency'); } catch { errs.push('package.json unreadable'); }
  if (existsSync(`${d}/.github`)) { const gh = readdirSync(`${d}/.github`).sort().join(','); if (gh !== 'dependabot.yml,workflows') errs.push(`.github must hold only workflows/ and dependabot.yml (found: ${gh})`); else { const wf = readdirSync(`${d}/.github/workflows`).sort().join(','); if (wf !== 'github-pages.yml,pull-request.yml,update-data.yml') errs.push(`.github/workflows must hold only github-pages.yml, pull-request.yml and update-data.yml (found: ${wf})`); } }
  console.log(errs.length ? `FAIL ${d}: ${errs.join('; ')}` : `ok   ${d}`); bad += errs.length ? 1 : 0;
}
process.exit(bad ? 1 : 0);
