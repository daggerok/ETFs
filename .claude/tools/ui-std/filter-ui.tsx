// =========================================================================
// 3c. Column filters: state, header badges, the filter row and its events
//     (the expression grammar and the type detection are in 3b above)
// =========================================================================

/**
 * One filterable column of a table. `key` is the sort key of the column header (the key passed to
 * sortHeader), `text` the cell text as the table shows it (also the sample for the type detection),
 * `value` the exact number behind a numeric cell (so a filter compares full precision, not the
 * rounded text) and `extraClass` the classes of a horizontally pinned column.
 */
type FilterColumn = {
  key: string;
  label: string;
  numeric: boolean;
  text: (row: any) => string;
  value?: (row: any) => number | null | undefined;
  extraClass?: string;
};

const FILTER_STORAGE_PREFIX = 'schwab'; // the app's localStorage prefix: the same words that start THEME_KEY
const COLUMN_FILTERS_KEY = `${FILTER_STORAGE_PREFIX}-column-filters`;
const COLUMN_TYPES_KEY = `${FILTER_STORAGE_PREFIX}-column-types`;
const SHOW_FILTERS_KEY = `${FILTER_STORAGE_PREFIX}-show-filters`;
const FILTER_DEBOUNCE_MS = 250;

/** scope (catalog, watchlist, holdings, history, distributions) -> column key -> expression / type chosen with the header badge */
const columnFilterState: { filters: Record<string, Record<string, string>>; typeOverrides: Record<string, Record<string, ColType>>; show: boolean } = { filters: {}, typeOverrides: {}, show: true };

/** What the last render of a scope computed: the columns, the types in use and the detected types (header badges read it). */
const filterInfo: Record<string, { columns: FilterColumn[]; types: ColType[]; detected: ColType[] }> = {};

const filterTimers: Map<string, any> = new Map();
let suppressTableAnimation = false;

function filterStorageGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function filterStorageSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* quota or private mode */ }
}

function filterStorageRemove(key: string): void {
  try { localStorage.removeItem(key); } catch { /* blocked storage */ }
}

/** Which set of filters belongs to the shown table; none for the overview and the empty states. */
function currentFilterScope(): string {
  if (state.activeTab === 'watchlist') return 'watchlist';
  if (isEtfCatalogTab(state.activeTab)) return 'catalog';
  const key = detailTabKey(state.activeTab);
  return isDetailTab(state.activeTab) && (key === 'holdings' || key === 'history' || key === 'distributions') ? key : '';
}

function filterExpressionFor(scope: string, key: string): string {
  const map = columnFilterState.filters[scope];
  return map && typeof map[key] === 'string' ? map[key] : '';
}

function typeOverrideFor(scope: string, key: string): ColType | undefined {
  const map = columnFilterState.typeOverrides[scope];
  return map ? map[key] : undefined;
}

/** Signature of a scope's filters and type overrides, for the memoized views. */
function columnFilterSig(scope: string): string {
  return JSON.stringify([columnFilterState.filters[scope] || {}, columnFilterState.typeOverrides[scope] || {}, Math.floor(Date.now() / 86400000)]);
}

/**
 * Applies the column filters of a scope to rows and records the column types for the header. The
 * types are detected from `sample` (the rows before any search or filter), so a filter never changes
 * the type of its own column. A filter whose expression does not parse is ignored (the input shows why).
 */
function applyColumnFilters(scope: string, rows: any[], columns: FilterColumn[], sample: any[] = rows): any[] {
  const detected = columns.map(col => {
    const texts: string[] = [];
    for (let i = 0; i < sample.length && texts.length < TYPE_SAMPLE_SIZE; i++) {
      const text = col.text(sample[i]);
      if (!isEmptyCell(text)) texts.push(text);
    }
    return detectColType(texts);
  });
  const types = columns.map((col, i) => typeOverrideFor(scope, col.key) || detected[i]);
  filterInfo[scope] = { columns, types, detected };
  const active: Array<{ col: FilterColumn; type: ColType; test: (num: number, text: string) => boolean }> = [];
  columns.forEach((col, i) => {
    const expression = filterExpressionFor(scope, col.key);
    if (!expression.trim()) return;
    const compiled = compileFilter(expression, types[i]);
    if (compiled && compiled.ok) active.push({ col, type: types[i], test: compiled.test });
  });
  if (!active.length) return rows;
  return rows.filter(row => active.every(filter => {
    if (filter.type === 'string') return filter.test(NaN, filter.col.text(row).toLowerCase());
    const numeric = filter.type === 'number' || filter.type === 'percent' || filter.type === 'currency';
    if (numeric && filter.col.value) {
      const raw = filter.col.value(row);
      return filter.test(typeof raw === 'number' && Number.isFinite(raw) ? raw : NaN, '');
    }
    return filter.test(parseCellValue(filter.col.text(row), filter.type), '');
  }));
}

/** Columns of a header-driven sheet (holdings, history, distributions): the cells are the row's `col0..colN` strings. */
function sheetFilterColumns(headers: string[], numericHeaders: string[]): FilterColumn[] {
  return headers.map((header, index) => ({
    key: `col${index}`,
    label: header || `Col ${index + 1}`,
    numeric: numericHeaders.includes(header),
    text: (row: any) => String(row[`col${index}`] ?? ''),
  }));
}

function activeFilterCount(scope: string): number {
  const info = filterInfo[scope];
  const keys = info ? info.columns.map(col => col.key) : Object.keys(columnFilterState.filters[scope] || {});
  return keys.filter(key => filterExpressionFor(scope, key).trim() !== '').length;
}

/** Header badge with the column type (auto-detected or set by the user); click cycles the type, Shift+click returns to auto-detection. */
function typeBadgeHtml(scope: string, key: string, type: ColType, detected: ColType): string {
  const overridden = type !== detected;
  const title = `Column type: ${COL_TYPE_NAMES[type]} (${overridden ? 'set by you, detected: ' + COL_TYPE_NAMES[detected] : 'auto-detected'}). Click to cycle the type, Shift+click to return to auto-detection.`;
  return `<button type="button" data-type-col="${escapeHtml(key)}" data-filter-scope="${escapeHtml(scope)}" title="${escapeHtml(title)}" class="type-badge ${COL_TYPE_CLASSES[type]}${overridden ? ' is-override' : ''}">${COL_TYPE_LABELS[type]}</button>`;
}

/** The type badge of a column of the table being rendered (empty for tables without filters). */
function filterBadgeFor(key: string): string {
  const scope = currentFilterScope();
  const info = filterInfo[scope];
  if (!info) return '';
  const index = info.columns.findIndex(col => col.key === key);
  return index < 0 ? '' : typeBadgeHtml(scope, key, info.types[index], info.detected[index]);
}

/** The row of filter inputs under the column headers; a column whose expression does not parse shows the reason in red. */
function filterRowHtml(scope: string, info: { columns: FilterColumn[]; types: ColType[] }, leading: string): string {
  return `<tr class="filter-row">${leading}${info.columns.map((col, i) => {
    const expression = filterExpressionFor(scope, col.key);
    const active = expression.trim() !== '';
    const compiled = active ? compileFilter(expression, info.types[i]) : null;
    const error = compiled && !compiled.ok ? compiled.error : '';
    const help = `${error ? 'Cannot apply this filter: ' + error + '. ' : ''}${COL_TYPE_HELP[info.types[i]]}`;
    return `<th class="filter-cell${col.extraClass ? ' ' + col.extraClass : ''}"><div class="filter-wrap"><input type="text" data-filter-col="${escapeHtml(col.key)}" data-filter-scope="${escapeHtml(scope)}" value="${escapeHtml(expression)}" placeholder="${escapeHtml(COL_TYPE_PLACEHOLDERS[info.types[i]])}" spellcheck="false" autocomplete="off" aria-label="Filter ${escapeHtml(col.label)}" title="${escapeHtml(help)}" class="filter-input${active ? ' is-active' : ''}${error ? ' is-invalid' : ''}" />${active ? `<button type="button" data-clear-filter="${escapeHtml(col.key)}" data-filter-scope="${escapeHtml(scope)}" class="filter-clear" title="Clear this filter" aria-label="Clear the ${escapeHtml(col.label)} filter">✕</button>` : ''}</div></th>`;
  }).join('')}</tr>`;
}

/** Called after a table head is written: adds the filter row for the shown scope (the catalog has the # and Use cells in front). */
function appendFilterRow(): void {
  const scope = currentFilterScope();
  const info = filterInfo[scope];
  if (!info || !columnFilterState.show) return;
  const leading = scope === 'catalog'
    ? '<th class="filter-cell"></th><th class="filter-cell catalog-sticky-col catalog-sticky-use"><div class="flex items-center justify-center gap-1 text-slate-400 dark:text-slate-500 text-[0.65rem] uppercase tracking-wider"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h18l-7 8v6l-4 2v-8z"/></svg>filter</div></th>'
    : '<th class="filter-cell"></th>';
  el.tableHead.insertAdjacentHTML('beforeend', filterRowHtml(scope, info, leading));
}

function renderFilterControls(): void {
  const button: any = document.getElementById('filters-btn');
  const clear: any = document.getElementById('clear-filters-btn');
  const badge: any = document.getElementById('filters-badge');
  const summary: any = document.getElementById('filters-summary');
  if (!button || !clear || !badge || !summary) return;
  const scope = currentFilterScope();
  const count = scope ? activeFilterCount(scope) : 0;
  button.disabled = !scope;
  button.setAttribute('aria-pressed', String(columnFilterState.show));
  summary.textContent = columnFilterState.show ? 'on' : 'off';
  badge.hidden = count === 0;
  badge.textContent = String(count);
  clear.hidden = count === 0;
}

/** The filter row sticks right below the header row: tell the CSS how tall the first row is. */
function syncHeadHeight(): void {
  const first = el.tableHead.querySelector('tr');
  if (first) el.tableScroll.style.setProperty('--head-h', `${first.getBoundingClientRect().height}px`);
}

/** Re-renders after a filter change and puts the caret back into the filter input that was being edited. */
function rerenderKeepingFilterFocus(): void {
  withBusy('Applying the filter…', () => {
    const active: any = document.activeElement; // read when the work runs, so a key typed meanwhile keeps its caret
    const key = active && active.dataset ? active.dataset.filterCol : undefined;
    const scope = active && active.dataset ? active.dataset.filterScope : undefined;
    const caret = key !== undefined && typeof active.selectionStart === 'number' ? active.selectionStart : 0;
    suppressTableAnimation = true;
    render();
    suppressTableAnimation = false;
    if (key === undefined) return;
    const next: any = [...el.tableHead.querySelectorAll('input[data-filter-col]')].find((node: any) => node.dataset.filterCol === key && node.dataset.filterScope === scope);
    if (next) { next.focus(); try { next.setSelectionRange(caret, caret); } catch { /* not a text input */ } }
  });
}

function persistColumnFilters(): void {
  const clean: Record<string, Record<string, string>> = {};
  Object.keys(columnFilterState.filters).forEach(scope => {
    const map = columnFilterState.filters[scope] || {};
    const keys = Object.keys(map).filter(key => typeof map[key] === 'string' && map[key].trim() !== '');
    if (keys.length) clean[scope] = Object.fromEntries(keys.map(key => [key, map[key]]));
  });
  if (Object.keys(clean).length) filterStorageSet(COLUMN_FILTERS_KEY, JSON.stringify(clean));
  else filterStorageRemove(COLUMN_FILTERS_KEY);
}

function persistColumnTypes(): void {
  const clean: Record<string, Record<string, ColType>> = {};
  Object.keys(columnFilterState.typeOverrides).forEach(scope => { if (Object.keys(columnFilterState.typeOverrides[scope] || {}).length) clean[scope] = columnFilterState.typeOverrides[scope]; });
  if (Object.keys(clean).length) filterStorageSet(COLUMN_TYPES_KEY, JSON.stringify(clean));
  else filterStorageRemove(COLUMN_TYPES_KEY);
}

function restoreColumnFilters(): void {
  const parse = (key: string): any => { try { return JSON.parse(filterStorageGet(key) || '{}') || {}; } catch { return {}; } };
  const saved = parse(COLUMN_FILTERS_KEY);
  const filters: Record<string, Record<string, string>> = {};
  if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
    Object.keys(saved).forEach(scope => {
      const map = saved[scope];
      if (!map || typeof map !== 'object' || Array.isArray(map)) return;
      const clean: Record<string, string> = {};
      Object.keys(map).forEach(key => { if (typeof map[key] === 'string' && map[key].trim() !== '') clean[key] = map[key]; });
      if (Object.keys(clean).length) filters[scope] = clean;
    });
  }
  columnFilterState.filters = filters;
  const savedTypes = parse(COLUMN_TYPES_KEY);
  const overrides: Record<string, Record<string, ColType>> = {};
  if (savedTypes && typeof savedTypes === 'object' && !Array.isArray(savedTypes)) {
    Object.keys(savedTypes).forEach(scope => {
      const map = savedTypes[scope];
      if (!map || typeof map !== 'object' || Array.isArray(map)) return;
      const clean: Record<string, ColType> = {};
      Object.keys(map).forEach(key => { if (ALL_COL_TYPES.includes(map[key])) clean[key] = map[key]; });
      if (Object.keys(clean).length) overrides[scope] = clean;
    });
  }
  columnFilterState.typeOverrides = overrides;
  columnFilterState.show = filterStorageGet(SHOW_FILTERS_KEY) !== 'false';
}

function setFilter(scope: string, key: string, value: string): void {
  const next = { ...(columnFilterState.filters[scope] || {}) };
  if (value.trim() === '') delete next[key];
  else next[key] = value;
  columnFilterState.filters[scope] = next;
  persistColumnFilters();
  rerenderKeepingFilterFocus();
}

/** Typing applies the filter after a short pause (FILTER_DEBOUNCE_MS), also when the input loses focus meanwhile; Enter applies it at once (a re-render on blur would swallow the click on a header). */
function scheduleFilter(scope: string, key: string, value: string): void {
  const id = `${scope}:${key}`;
  const pending = filterTimers.get(id);
  if (pending !== undefined) clearTimeout(pending);
  filterTimers.set(id, setTimeout(() => { filterTimers.delete(id); if (filterExpressionFor(scope, key) !== value) setFilter(scope, key, value); }, FILTER_DEBOUNCE_MS));
}

function flushFilter(scope: string, key: string, value: string): void {
  const id = `${scope}:${key}`;
  const pending = filterTimers.get(id);
  if (pending !== undefined) { clearTimeout(pending); filterTimers.delete(id); }
  if (filterExpressionFor(scope, key) !== value) setFilter(scope, key, value);
}

function clearAllFilters(scope: string): void {
  filterTimers.forEach(timer => clearTimeout(timer));
  filterTimers.clear();
  columnFilterState.filters[scope] = {};
  persistColumnFilters();
  renderBusy();
}

/** Header badge click: next type in the cycle; Shift+click returns to auto-detection. */
function cycleColumnType(scope: string, key: string, reset: boolean): void {
  const info = filterInfo[scope];
  const index = info ? info.columns.findIndex(col => col.key === key) : -1;
  const detected: ColType = info && index >= 0 ? info.detected[index] : 'string';
  const current = typeOverrideFor(scope, key) || detected;
  const next = reset ? detected : ALL_COL_TYPES[(ALL_COL_TYPES.indexOf(current) + 1) % ALL_COL_TYPES.length];
  const map = { ...(columnFilterState.typeOverrides[scope] || {}) };
  if (next === detected) delete map[key];
  else map[key] = next;
  columnFilterState.typeOverrides[scope] = map;
  persistColumnTypes();
  renderBusy();
}

/** Filter inputs and type badges live in the table header (delegated: the header is rebuilt on every render). */
function bindColumnFilterEvents(): void {
  const filtersBtn: any = document.getElementById('filters-btn');
  const clearBtn: any = document.getElementById('clear-filters-btn');
  if (filtersBtn) {
    filtersBtn.addEventListener('click', () => {
      columnFilterState.show = !columnFilterState.show;
      filterStorageSet(SHOW_FILTERS_KEY, String(columnFilterState.show));
      renderBusy();
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      const scope = currentFilterScope();
      if (scope) clearAllFilters(scope);
    });
  }
  el.tableHead.addEventListener('input', (event: any) => {
    const target = event.target;
    if (target && target.dataset && target.dataset.filterCol !== undefined) scheduleFilter(target.dataset.filterScope, target.dataset.filterCol, target.value);
  });
  el.tableHead.addEventListener('keydown', (event: any) => {
    const target = event.target;
    if (!target || !target.dataset || target.dataset.filterCol === undefined) return;
    if (event.key === 'Enter') { event.preventDefault(); flushFilter(target.dataset.filterScope, target.dataset.filterCol, target.value); }
    else if (event.key === 'Escape' && target.value !== '') { event.preventDefault(); event.stopPropagation(); flushFilter(target.dataset.filterScope, target.dataset.filterCol, ''); }
  });
  el.tableHead.addEventListener('click', (event: any) => {
    const target = event.target;
    if (!target || typeof target.closest !== 'function') return;
    const clear = target.closest('button[data-clear-filter]');
    if (clear) { event.stopPropagation(); flushFilter(clear.dataset.filterScope, clear.dataset.clearFilter, ''); return; }
    const badge = target.closest('button[data-type-col]');
    if (badge) { event.stopPropagation(); cycleColumnType(badge.dataset.filterScope, badge.dataset.typeCol, Boolean(event.shiftKey)); }
  });
}

