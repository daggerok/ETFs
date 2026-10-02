/// <reference types="bun" />
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
const S = dirname(new URL(import.meta.url).pathname);
const out = JSON.parse(readFileSync(`${S}/registry.json`, 'utf8'));
const cell = (s: string) => s.replace(/\|/g, '\\|');
const pend = (r: any) => (r.pagesPending ? ' (deployment pending)' : '');
const brands = ['| Brand | Where to get the data |', '| --- | --- |', ...out.map((r: any) => `| **${r.brand}** | [${r.issuerLabel}](${r.issuerUrl}) \\| [${r.repo}](${r.pagesUrl})${pend(r)} |`)];
const sibs = ['| Application | Data provider | Repository |', '| --- | --- | --- |', ...out.map((r: any) => `| ${r.brand} | ${cell(r.source)} | [${r.repo}](${r.githubUrl}) |`)];
writeFileSync(`${S}/shared-blocks.md`, `## Brands table\n\n${brands.join('\n')}\n\n## Sibling applications\n\n${sibs.join('\n')}\n`);
console.log(out.length, 'rows; pending:', out.filter((r: any) => r.pagesPending).map((r: any) => r.repo).join(','));
