/// <reference types="bun" />
// usage: bun check-readme.ts <repoDir>...  - README structure of the Stocks repo (same order as the ETF standard, "Exchanges table" instead of "Brands table")
import { existsSync, readFileSync } from 'node:fs';
const ORDER = ['Using Bun', 'Updating the static', 'Data sources', 'Metrics and caveats', 'Update controls', 'Examples', 'TypeScript and verification', 'Exchanges table', 'Sibling applications', 'License'];
let bad = 0;
for (const d of process.argv.slice(2)) {
  const f = `${d}/README.md`; const errs: string[] = [];
  if (!existsSync(f)) { console.log(`FAIL ${d}: no README`); bad++; continue; }
  const t = readFileSync(f, 'utf8');
  let last = -1;
  for (const h of ORDER) { const i = t.search(new RegExp(`^#{2,3} .*${h}`, 'm')); if (i < 0) errs.push(`missing section: ${h}`); else if (i < last) errs.push(`section out of order: ${h}`); else last = i; }
  const sec = (name: string) => (t.match(new RegExp(`## ${name}\\n([\\s\\S]*?)(\\n## |$)`)) ?? [])[1] ?? '';
  const exchanges = sec('Exchanges table').split('\n').filter((l) => l.startsWith('|')).slice(2);
  for (const name of ['Nasdaq', 'NYSE', 'Cboe']) if (!exchanges.some((r) => r.includes(`**${name}**`))) errs.push(`Exchanges table: ${name} missing`);
  if (!sec('Sibling applications').includes('github.com/daggerok/ETFs')) errs.push('Sibling applications must link the ETFs hub');
  const lic = (t.match(/^## License\n([\s\S]*)$/m) ?? [])[1] ?? '';
  if (!/MIT/.test(lic) || !/trademark|not affiliated/i.test(lic)) errs.push('License section must name MIT and carry the independence disclaimer');
  const ver = (t.match(/^## TypeScript and verification\n([\s\S]*?)(?=\n## |$(?![\s\S]))/m) ?? [])[1] ?? '';
  const cmds = [...ver.matchAll(/```(?:bash|sh)?\n([\s\S]*?)```/g)].flatMap((m) => m[1].split('\n').map((l) => l.trim())).filter((c) => /^(bun|git) /.test(c));
  const want = ['bun install --frozen-lockfile', 'bun test', 'bun build --target=bun scripts/update-data.ts --outfile=/dev/null', 'git diff --check'];
  if ([...cmds].sort().join('\n') !== [...want].sort().join('\n')) errs.push(`verification commands must be exactly: ${want.join(' | ')}`);
  console.log(errs.length ? `FAIL ${d}: ${errs.join('; ')}` : `ok   ${d}`); bad += errs.length ? 1 : 0;
}
process.exit(bad ? 1 : 0);
