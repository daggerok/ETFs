/// <reference types="bun" />
// usage: bun apply-shared-blocks.ts <repoDir>  - replaces/creates "## Brands table" + "## Sibling applications" with the canonical block, placed before "## License"
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
const S = dirname(new URL(import.meta.url).pathname);
const canon = readFileSync(`${S}/shared-blocks.md`, 'utf8').trimEnd();
for (const d of process.argv.slice(2)) {
  const f = `${d}/README.md`; let t = readFileSync(f, 'utf8');
  const strip = (h: string) => { t = t.replace(new RegExp(`## ${h}\\n[\\s\\S]*?(?=\\n## |$)`), ''); };
  const at = t.search(/^## License/m);
  strip('Brands table'); strip('Sibling applications');
  const i = t.search(/^## License/m);
  t = i < 0 ? `${t.trimEnd()}\n\n${canon}\n` : `${t.slice(0, i).trimEnd()}\n\n${canon}\n\n${t.slice(i)}`;
  writeFileSync(f, t.replace(/\n{3,}/g, '\n\n'));
  console.log(`applied to ${d}`);
}
