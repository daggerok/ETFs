// usage: bun clear.ts <repoDir>
// Replaces the instant Clear button of an ETF app with the Clear dialog of Stocks: a checklist of what to reset, remembered between visits.
// Keeps the repo's own RESET_ITEMS (adds an id each, capitalizes the label, adds a Blacklist item) and its own tail of the old clear function.
import { readFileSync, writeFileSync } from 'node:fs';
const dir = process.argv[2];
const here = import.meta.dir;
const tsxPath = `${dir}/src/main.tsx`, cssPath = `${dir}/src/index.css`, htmlPath = `${dir}/src/index.html`;
let t = readFileSync(tsxPath, 'utf8');

const start = t.search(/\/\*\*\n \* Everything the Clear button resets/);
const fnAt = t.indexOf('function clearSelectionAndSearch(): void {');
if (start < 0 || fnAt < start) throw new Error('clear section not found (already converted?)');
const end = t.indexOf('\n}\n', fnAt) + 3;
const oldFn = t.slice(fnAt, end);
const arrAt = t.indexOf('const RESET_ITEMS', start), arrEnd = t.indexOf('\n];', arrAt);
if (arrAt < 0 || arrEnd < 0 || arrAt > fnAt) throw new Error('RESET_ITEMS not found');
const itemLines = t.slice(t.indexOf('\n', arrAt) + 1, arrEnd).split('\n').filter((l) => l.trim());
const removeFn = /item\.keys\.forEach\((\w+)\)/.exec(oldFn)?.[1];
if (!removeFn) throw new Error('remove function not found');

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const items = itemLines.map((l) => {
  const m = /^(\s*)\{ label: '([^']+)',(.*)$/.exec(l);
  if (!m) throw new Error('item line: ' + l);
  const label = m[2][0].toUpperCase() + m[2].slice(1);
  return `${m[1]}{ id: '${slug(m[2])}', label: '${label}',${m[3]}`;
});
if (!/\bBLACKLIST_KEY\b/.test(t) || !/\bstate\.blacklist\b/.test(t)) throw new Error('no blacklist state');
const bump = /\blet blacklistVersion\b/.test(t) ? ' blacklistVersion += 1;' : '';
items.push(`  { id: 'blacklist', label: 'Blacklist', keys: [BLACKLIST_KEY], reset: () => { state.blacklist.clear();${bump} } },`);
const sharedView = itemLines.some((l) => l.includes('keys: [VIEW_FILTERS_KEY]'));

// tail of the old function: everything after the RESET_ITEMS.forEach line
const bodyLines = oldFn.split('\n').slice(1, -2);
const forEachAt = bodyLines.findIndex((l) => l.includes('RESET_ITEMS.forEach'));
if (forEachAt !== 0) throw new Error('unexpected first line: ' + bodyLines[0]);
let tail = bodyLines.slice(1).join('\n');
const viewsId = items.map((l) => /id: '([^']+)'/.exec(l)?.[1] ?? '').find((id) => id.endsWith('views'));
if (!viewsId) throw new Error('views item');
if (!tail.includes("el.searchInput.value = '';")) throw new Error('searchInput line');
tail = tail.replace("  el.searchInput.value = '';", "  if (ids.has('searches')) el.searchInput.value = '';");
tail = tail.replace(/  el\.tableScroll\.scrollTop = 0;\n  el\.tableScroll\.scrollLeft = 0;/, `  if (ids.has('${viewsId}')) {\n    el.tableScroll.scrollTop = 0;\n    el.tableScroll.scrollLeft = 0;\n  }`);
if (!tail.includes(`ids.has('${viewsId}')`)) throw new Error('scroll lines');
if (/function renderBlacklistPanel\(/.test(t) && !tail.includes('renderBlacklistPanel')) tail = tail.replace(/\n  render\(false\);$/, '\n  renderBlacklistPanel();\n  render(false);');

const keyRemoval = sharedView
  ? `  picked.forEach(item => { if (item.keys[0] !== VIEW_FILTERS_KEY) item.keys.forEach(${removeFn}); });
  const viewFilterIds = RESET_ITEMS.filter(item => item.keys[0] === VIEW_FILTERS_KEY).map(item => item.id);
  if (viewFilterIds.some(id => ids.has(id))) {
    if (viewFilterIds.every(id => ids.has(id))) ${removeFn}(VIEW_FILTERS_KEY);
    else persistViewFilters();
  }`
  : `  picked.forEach(item => { item.keys.forEach(${removeFn}); });`;

const block = `/**
 * Everything the Clear dialog can reset. Each item has a stable id (the remembered choice is stored by id), the saved keys that
 * are removed (a reload shows the first-visit view) and reset(), which puts the state back to its default. The theme is not
 * listed, so it is always kept.
 */
type ResetItem = { id: string; label: string; keys: string[]; reset(): void };
const CLEAR_CHOICES_KEY = \`\${THEME_KEY.replace(/-theme$/, '')}-clear-choices\`; // what the Clear dialog had ticked at the last OK (not reset by Clear itself)
const RESET_ITEMS: ResetItem[] = [
${items.join('\n')}
];

/** Resets the chosen items to the first-visit state at once. */
function applyClear(ids: Set<string>): void {
  const picked = RESET_ITEMS.filter(item => ids.has(item.id));
  if (!picked.length) return;
  picked.forEach(item => item.reset());
${keyRemoval}
${tail}
}

${readFileSync(`${here}/clear-dialog.tsx`, 'utf8')}`;
t = t.slice(0, start) + block + t.slice(end);
writeFileSync(tsxPath, t);

let css = readFileSync(cssPath, 'utf8');
if (css.includes('.clear-backdrop')) throw new Error('css already has the dialog');
writeFileSync(cssPath, css.replace(/\n*$/, '\n\n') + readFileSync(`${here}/clear.css`, 'utf8'));

let h = readFileSync(htmlPath, 'utf8');
const title = /(id="reset-btn"[^>]*title=")[^"]*"/;
if (!title.test(h)) throw new Error('reset button title');
h = h.replace(title, '$1Choose what to reset to the first-visit view (the choice is remembered, the theme is kept)"');
writeFileSync(htmlPath, h);

// README: the sentence about the Clear button (also in the shared readme-block.md)
const oldSentence = 'The red `Clear` button forgets everything saved in the browser without asking, except the blacklist and the theme, so the page looks like a first visit (also after a reload)';
const newSentence = 'The red `Clear` button opens a dialog that lists what can be reset (the selection, searches, sort order, open tab, shown columns, column filters, remembered table views and the blacklist), all ticked the first time and afterwards as they were left at the last OK; `Enter` confirms, `Esc` or a click outside cancels, the theme is always kept, so the page looks like a first visit (also after a reload)';
for (const f of [`${dir}/README.md`]) {
  try {
    const r = readFileSync(f, 'utf8');
    if (r.includes(oldSentence)) writeFileSync(f, r.replace(oldSentence, newSentence));
    else console.warn('README sentence not found in', f);
  } catch { console.warn('no README at', f); }
}
