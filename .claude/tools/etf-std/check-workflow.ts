/// <reference types="bun" />
// usage: bun check-workflow.ts <repoDir>...  - static checks of .github/workflows/update-data.yml
import { readFileSync, existsSync } from 'node:fs';
let bad = 0;
for (const d of process.argv.slice(2)) {
  const f = `${d}/.github/workflows/update-data.yml`; const errs: string[] = [];
  if (!existsSync(f)) { console.log(`FAIL ${d}: no workflow`); bad++; continue; }
  const txt = readFileSync(f, 'utf8'); const y = (Bun as any).YAML.parse(txt);
  const on = y.on ?? y.true; const inp = on?.workflow_dispatch?.inputs ?? {}; const names = Object.keys(inp);
  if (names.length > 25) errs.push(`${names.length} inputs > 25`);
  if (inp.advanced?.default !== '{}' || inp.advanced?.type !== 'string') errs.push('advanced input missing/not string default {}');
  for (const [k, v] of Object.entries<any>(inp)) if (k !== 'advanced' && (v.default ?? '') !== '') errs.push(`input ${k} default must be blank`);
  if (!on?.schedule?.some((s: any) => s.cron === '0 0 * * 0')) errs.push('weekly schedule missing');
  if (y.permissions?.contents !== 'write') errs.push('permissions.contents != write');
  if (y.concurrency?.['cancel-in-progress'] !== false || !y.concurrency?.group) errs.push('concurrency not serialized');
  if (!txt.includes('bun install --frozen-lockfile')) errs.push('no frozen lockfile install');
  if (txt.indexOf('bun test') < 0 || txt.indexOf('bun test') > txt.indexOf('bun ./scripts/update-data.ts')) errs.push('tests must run before update');
  if (!txt.includes('resolveControls') || !txt.includes('toJSON(inputs)') || !txt.includes('update-data.config.json')) errs.push('advanced/config resolver step missing');
  if (/\beval\s*\(/.test(txt.replace(/bun --eval/g, '')) ) errs.push('eval() used');
  if (/\$\{\{\s*(inputs|github\.event\.inputs)\./.test(txt)) errs.push('direct input interpolation in workflow');
  const add = txt.match(/git add (api\/[a-z0-9-]+)\b/); if (!add) errs.push('git add api/<slug> missing'); else if (!txt.includes(`git diff --cached --quiet -- ${add[1]}`)) errs.push('commit step not scoped/no-op-safe');
  if (/(^|\s)(OUTPUT_DIR|OUT_DIR)\s*:/m.test(txt) || names.some(n => /out(put)?_?dir/i.test(n))) errs.push('output dir must not be exposed as input');
  if (!/persist-credentials: false/.test(txt)) errs.push('checkout must set persist-credentials: false');
  if (!/timeout-minutes: 30/.test(txt)) errs.push('timeout-minutes: 30 missing');
  if (!txt.includes("credential.helper='!f()") || !txt.includes('GITHUB_TOKEN: ${{ github.token }}')) errs.push('runtime-only token push missing');
  if (!txt.includes('git pull --rebase')) errs.push('push must rebase and retry when main moved');
  console.log(errs.length ? `FAIL ${d}: ${errs.join('; ')}` : `ok   ${d} (${names.length} inputs)`); bad += errs.length ? 1 : 0;
}
process.exit(bad ? 1 : 0);
