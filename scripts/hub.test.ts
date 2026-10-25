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

// Six brands (Franklin, Global-X, Neos, ProShares, Themes, VanEck) publish distribution rows as objects keyed by the header;
// the Distributions tab and its export threw on row.join(' ') for every fund of those brands. sheetRows() is cut out of
// main.tsx and run here, because main.tsx itself needs a DOM.
describe('distributions sheet', () => {
  const start = main.indexOf('const sheetRowsCache');
  const end = main.indexOf('/** Filtered + sorted view of a sheet');
  const source = start > 0 && end > start ? new Bun.Transpiler({ loader: 'ts' }).transformSync(main.slice(start, end)) : '';
  const sheetRows: (headers: string[], raw: unknown) => string[][] = source
    ? new Function(`${source}; return sheetRows;`)()
    : () => { throw new Error('sheetRows() not found in src/main.tsx'); };

  test('object rows become string arrays in header order, array rows pass through unchanged', () => {
    // VanEck AFK and Themes AGMI (keys in another order than the headers, Franklin adds a searchIndex key)
    const vaneck = [{ 'Ex-Date': 'Dec 22 2025', 'Payable Date': 'Dec 26 2025', Dividend: '$0.2716' }];
    expect(sheetRows(['Ex-Date', 'Payable Date', 'Dividend'], vaneck)).toEqual([['Dec 22 2025', 'Dec 26 2025', '$0.2716']]);
    const themes = [{ Amount: '$2.8700', 'Ex-Date': '2025-12-18', searchIndex: 'x' }, { 'Ex-Date': '2024-12-18', Amount: null }];
    expect(sheetRows(['Ex-Date', 'Amount'], themes)).toEqual([['2025-12-18', '$2.8700'], ['2024-12-18', '']]);
    // ARK ARKK publishes arrays: the very same array comes back
    const ark = [['2025-12-18', '0.5']];
    expect(sheetRows(['Ex-Date', 'Amount'], ark)).toBe(ark);
    expect(sheetRows(['Ex-Date'], undefined)).toEqual([]);
  });

  test('the normalized rows keep one identity per published array, so the grid cache is reused', () => {
    const raw = [{ 'Ex-Date': '2026-06-29', 'Amount ($)': '$0.155500' }];
    const first = sheetRows(['Ex-Date', 'Amount ($)'], raw);
    expect(sheetRows(['Ex-Date', 'Amount ($)'], raw)).toBe(first);
    expect(first.map((row) => row.join(' '))).toEqual(['2026-06-29 $0.155500']);
  });
});
