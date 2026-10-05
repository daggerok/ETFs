// =========================================================================
// 3f. Categories dropdown: replaces the category tabs; every category is selected by default (= All ETFs)
// =========================================================================

const HIDDEN_CATEGORIES_KEY = `${FILTER_STORAGE_PREFIX}-hidden-categories`;

let hiddenCategories: Set<string> = new Set();
let categoriesDd: Dropdown | null = null;
let categoriesRoot: any = null;

function loadHiddenCategories(): void {
  try {
    const saved = JSON.parse(localStorage.getItem(HIDDEN_CATEGORIES_KEY) || '[]');
    if (Array.isArray(saved)) hiddenCategories = new Set(saved.filter(name => typeof name === 'string'));
  } catch {
    hiddenCategories = new Set();
  }
}

function persistHiddenCategories(): void {
  try {
    localStorage.setItem(HIDDEN_CATEGORIES_KEY, JSON.stringify([...hiddenCategories]));
  } catch {
    // Storage is blocked: the choice lasts for this page only.
  }
}

/** True while some, but not all, asset classes are checked: only then the table is narrowed (all or none checked = All ETFs). */
function categoryFilterActive(): boolean {
  const all = uniqueCategories();
  const shown = all.filter(category => !hiddenCategories.has(category)).length;
  return shown > 0 && shown < all.length;
}

function categoryAllowed(category: string): boolean {
  return !categoryFilterActive() || !hiddenCategories.has(category);
}

function categoryItems(): DropdownItem[] {
  return uniqueCategories().map(category => ({
    id: category,
    label: categoryLabel(category),
    count: state.funds.filter(fund => fund.category === category && !state.blacklist.has(fund.ticker)).length,
    selected: !hiddenCategories.has(category),
  }));
}

function applyCategorySelection(selected: Set<string>): void {
  hiddenCategories = new Set(uniqueCategories().filter(category => !selected.has(category)));
  persistHiddenCategories();
  renderBusy();
}

function renderCategoriesButton(): void {
  const summary: any = document.getElementById('categories-summary');
  const badge: any = document.getElementById('categories-badge');
  const button: any = document.getElementById('categories-btn');
  if (!summary || !badge || !button) return;
  const all = uniqueCategories();
  const shown = all.filter(category => !hiddenCategories.has(category));
  const filtered = categoryFilterActive();
  summary.textContent = !filtered ? 'All' : shown.length === 1 ? categoryLabel(shown[0]) : `${shown.length} selected`;
  badge.hidden = !filtered;
  badge.textContent = `${shown.length}/${all.length}`;
  button.classList.toggle('is-filtered', filtered);
  if (categoriesRoot) categoriesRoot.hidden = all.length < 2;
}

/** Builds the Categories button and its panel once, right after the All ETFs pill. */
function ensureCategoriesMenu(): void {
  if (categoriesRoot) return;
  const anchor: any = document.getElementById('tabs-bar');
  if (!anchor || !anchor.parentNode) return;
  categoriesRoot = document.createElement('div');
  categoriesRoot.className = 'dd-root';
  categoriesRoot.hidden = true;
  categoriesRoot.innerHTML = `<button type="button" id="categories-btn" class="dd-trigger" aria-haspopup="dialog" aria-expanded="false" aria-controls="categories-panel" title="Show only some asset classes (All = every ETF)"><span class="dd-label">Asset classes:</span><span class="dd-value" id="categories-summary">...</span><span class="dd-badge" id="categories-badge" hidden></span><svg class="dd-chev" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 8 5 5 5-5"/></svg></button><div id="categories-panel" class="dd-panel dd-panel-wide" hidden></div>`;
  anchor.parentNode.insertBefore(categoriesRoot, anchor.nextSibling);
  categoriesDd = createDropdown({
    trigger: document.getElementById('categories-btn'),
    panel: document.getElementById('categories-panel'),
    title: 'Asset classes',
    noun: 'asset classes',
    unit: 'ETFs',
    getItems: categoryItems,
    onChange: applyCategorySelection,
  });
}

loadHiddenCategories();
