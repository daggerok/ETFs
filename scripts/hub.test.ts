/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');

// main.tsx reads its elements with byId('...') and throws at start when one is missing, so a moved or renamed element
// in index.html breaks the whole page. Only that contract is tested here: the hub updates no data.
describe('hub page', () => {
  test('every element main.tsx reads by id exists in index.html', () => {
    const wanted = [...new Set([...main.matchAll(/\bbyId\('([^']+)'\)/g)].map((m) => m[1]))];
    expect(wanted.length).toBeGreaterThan(10);
    const missing = wanted.filter((id) => !html.includes(`id="${id}"`));
    expect(missing).toEqual([]);
  });

  test('no page header; the title, count chip and theme toggle live in the first panel above the toolbar', () => {
    expect(html).not.toContain('<header');
    const top = html.indexOf('id="top-panels"');
    const panel = html.indexOf('id="selected-tabs-panel"');
    const toolbar = html.indexOf('id="search-input"');
    expect(top).toBeGreaterThan(0);
    expect(panel).toBeGreaterThan(top);
    expect(toolbar).toBeGreaterThan(panel);
    const panelHtml = html.slice(panel, toolbar);
    for (const id of ['ticker-count', 'theme-toggle', 'app-subtitle']) expect(panelHtml).toContain(`id="${id}"`);
    expect(panelHtml).toContain('<h1');
  });
});
