/// <reference types="bun" />
// usage: bun check-pages.ts <repoDir>...  - static checks of the Parcel layout and .github/workflows/github-pages.yml (brand repos and the hub)
import { readFileSync, existsSync } from 'node:fs';
let bad = 0;
for (const d of process.argv.slice(2)) {
  const errs: string[] = []; const f = `${d}/.github/workflows/github-pages.yml`;
  for (const p of ['src/index.html', 'src/main.tsx', 'src/index.css', 'src/favicon.ico']) if (!existsSync(`${d}/${p}`)) errs.push(`missing ${p}`);
  for (const p of ['app.tsx', 'index.html', 'favicon.ico']) if (existsSync(`${d}/${p}`)) errs.push(`${p} must live in src/ (found in the root)`);
  try {
    const pkg = JSON.parse(readFileSync(`${d}/package.json`, 'utf8')); const s = pkg.scripts ?? {};
    if (pkg.source !== 'src/index.html') errs.push('package.json source must be src/index.html');
    if (!/parcel build .*--dist-dir \.\/dist/.test(s.build ?? '')) errs.push('scripts.build must be a parcel build into ./dist');
    if (!/--public-url=\/[^/]+\/$/.test(s['build-github-pages'] ?? '')) errs.push('scripts.build-github-pages must pass --public-url=/<Repo>/');
    if (Object.keys(pkg.dependencies ?? {}).length) errs.push('dependencies must stay empty (build tooling goes to devDependencies)');
  } catch { errs.push('package.json unreadable'); }
  if (!existsSync(f)) { errs.push('no github-pages.yml'); console.log(`FAIL ${d}: ${errs.join('; ')}`); bad++; continue; }
  const txt = readFileSync(f, 'utf8'); const y = (Bun as any).YAML.parse(txt); const on = y.on ?? y.true ?? {};
  const upd = `${d}/.github/workflows/update-data.yml`; const hasUpd = existsSync(upd);
  if (y.name !== 'GitHub Pages') errs.push('workflow name must be "GitHub Pages"');
  if (!on.push?.branches?.includes('main') || !('workflow_dispatch' in on)) errs.push('push to main and workflow_dispatch triggers required');
  if (hasUpd) {
    const want = (Bun as any).YAML.parse(readFileSync(upd, 'utf8')).name; const wr = on.workflow_run;
    if (!wr || wr.workflows?.length !== 1 || wr.workflows[0] !== want) errs.push(`workflow_run.workflows must be ["${want}"] (the name of update-data.yml)`);
    if (wr && (!wr.types?.includes('completed') || !wr.branches?.includes('main'))) errs.push('workflow_run needs types [completed] and branches [main]');
    if (!txt.includes("github.event_name != 'workflow_run' || github.event.workflow_run.conclusion == 'success'")) errs.push('deploy job must skip a failed data run (if: workflow_run success guard)');
  } else if (on.workflow_run) errs.push('workflow_run without update-data.yml');
  if (y.permissions?.contents !== 'read' || y.permissions?.pages !== 'write' || y.permissions?.['id-token'] !== 'write') errs.push('permissions must be contents: read, pages: write, id-token: write');
  if (y.concurrency?.group !== 'pages' || y.concurrency?.['cancel-in-progress'] !== false) errs.push('concurrency group pages, cancel-in-progress false required');
  if (!/ref: main/.test(txt)) errs.push('checkout must use ref: main (the data run commits during the run)');
  for (const need of ['oven-sh/setup-bun@v2', 'bun install -E', 'bun run build-github-pages', "path: './dist'", 'actions/configure-pages', 'actions/upload-pages-artifact', 'actions/deploy-pages']) if (!txt.includes(need)) errs.push(`template step missing: ${need}`);
  console.log(errs.length ? `FAIL ${d}: ${errs.join('; ')}` : `ok   ${d}`); bad += errs.length ? 1 : 0;
}
process.exit(bad ? 1 : 0);
