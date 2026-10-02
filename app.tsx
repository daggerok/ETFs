/// <reference types="bun" />

/**
 * @file ETFs Hub Application
 * One page that works as every brand's ETF holdings-to-watchlist app at once.
 * It fetches the public static feeds (api/<slug>/**) of the 29 sibling
 * repositories at runtime, normalizes them into compact typed arrays and
 * offers the same columns, Watchlist aggregation and detail tabs as a
 * sibling app, over the union of all brands. No build step, no bundler.
 *
 * Babel standalone note: the inline pipeline strips type annotations, but it
 * does not accept every TypeScript-only expression. Follow the sibling dev
 * style: plain `byId()` instead of DOM casts, no `as` casts, no non-null
 * `!`, no interfaces or enums.
 */

// =========================================================================
// 1. Types, constants, brand registry & column tooltips
// =========================================================================

type ActiveTab = string;
type SortDirection = 'asc' | 'desc';
type TabInfo = { id: ActiveTab; label: string; count: number | string };
type BrandStatus = 'pending' | 'ok' | 'cached' | 'error';
type Brand = { repo: string; brand: string; slug: string; issuerLabel: string; issuerUrl: string };

type WatchlistRow = Record<string, any> & {
  key: string;
  symbol: string;
  name: string;
  funds: string[];
  fundCount: number;
  weightSum: number;
  maxWeight: number;
  cusips: string[];
  identifier: string;
  searchIndex: string;
};

// Brand registry: repo folder, display name and feed slug (api/<slug>/index.json).
// Generated from .claude/tools/etf-std/registry.json and the real api/<slug> folder names.
const BRANDS: Brand[] = [
  { repo: "AAM", brand: "AAM", slug: "aam", issuerLabel: "aamlive.com", issuerUrl: "https://www.aamlive.com/ETF" },
  { repo: "aberdeen", brand: "abrdn (Aberdeen)", slug: "aberdeen", issuerLabel: "aberdeeninvestments.com", issuerUrl: "https://www.aberdeeninvestments.com/en-us/investor/funds/etfs" },
  { repo: "Amplify", brand: "Amplify", slug: "amplify", issuerLabel: "amplifyetfs.com", issuerUrl: "https://amplifyetfs.com/" },
  { repo: "ARK", brand: "ARK Invest", slug: "ark", issuerLabel: "ark-funds.com", issuerUrl: "https://www.ark-funds.com/our-etfs/" },
  { repo: "Capital-Group", brand: "Capital Group", slug: "capital-group", issuerLabel: "capitalgroup.com", issuerUrl: "https://www.capitalgroup.com/advisor/investments/exchange-traded-funds.html" },
  { repo: "Fidelity", brand: "Fidelity", slug: "fidelity", issuerLabel: "fidelity.com", issuerUrl: "https://www.fidelity.com/etfs" },
  { repo: "First-Trust", brand: "First Trust", slug: "firsttrust", issuerLabel: "ftportfolios.com", issuerUrl: "https://www.ftportfolios.com/Retail/etf/etflist.aspx" },
  { repo: "Franklin", brand: "Franklin Templeton", slug: "franklin", issuerLabel: "franklintempleton.com", issuerUrl: "https://www.franklintempleton.com/investments/options/exchange-traded-funds" },
  { repo: "Global-X", brand: "Global X", slug: "globalx", issuerLabel: "globalxetfs.com/explore", issuerUrl: "https://www.globalxetfs.com/explore" },
  { repo: "Goldman-Sachs", brand: "Goldman Sachs", slug: "goldmansachs", issuerLabel: "am.gs.com", issuerUrl: "https://am.gs.com/en-us/individual/funds?locale=en-us&audience=individual&sf=funds&filters=funds%7CETF&limit=100" },
  { repo: "Invesco", brand: "Invesco", slug: "invesco", issuerLabel: "invesco.com", issuerUrl: "https://www.invesco.com/us/en/financial-products/etfs.html" },
  { repo: "iShares", brand: "iShares", slug: "ishares", issuerLabel: "ishares.com", issuerUrl: "https://www.ishares.com/" },
  { repo: "JPMorgan", brand: "JPMorgan", slug: "jpmorgan", issuerLabel: "am.jpmorgan.com", issuerUrl: "https://am.jpmorgan.com/us/en/asset-management/adv/products/fund-explorer/etf" },
  { repo: "Neos", brand: "NEOS", slug: "neos", issuerLabel: "neosfunds.com", issuerUrl: "https://neosfunds.com/#explore-etfs" },
  { repo: "Northern-Trust", brand: "Northern Trust", slug: "northerntrust", issuerLabel: "etfs.ntam.northerntrust.com", issuerUrl: "https://etfs.ntam.northerntrust.com/us/en/individual/funds" },
  { repo: "Pacer", brand: "Pacer ETFs", slug: "pacer", issuerLabel: "paceretfs.com", issuerUrl: "https://www.paceretfs.com/products/" },
  { repo: "Parametric", brand: "Parametric", slug: "parametric", issuerLabel: "eatonvance.com", issuerUrl: "https://www.eatonvance.com/products/etfs.html" },
  { repo: "ProShares", brand: "ProShares", slug: "proshares", issuerLabel: "proshares.com", issuerUrl: "https://www.proshares.com/our-etfs/find-proshares-etfs" },
  { repo: "Schwab", brand: "Schwab", slug: "schwab", issuerLabel: "schwabassetmanagement.com", issuerUrl: "https://www.schwabassetmanagement.com/products" },
  { repo: "SP-Funds", brand: "SP Funds", slug: "spfunds", issuerLabel: "sp-funds.com", issuerUrl: "https://www.sp-funds.com/" },
  { repo: "SPDR", brand: "SPDR", slug: "spdr", issuerLabel: "ssga.com", issuerUrl: "https://www.ssga.com/us/en/intermediary/etfs/fund-finder" },
  { repo: "Sprott", brand: "Sprott ETFs", slug: "sprott", issuerLabel: "sprottetfs.com", issuerUrl: "https://sprottetfs.com/" },
  { repo: "Tema", brand: "Tema ETFs", slug: "tema", issuerLabel: "temaetfs.com", issuerUrl: "https://temaetfs.com/funds" },
  { repo: "Themes", brand: "Themes ETFs", slug: "themes", issuerLabel: "themesetfs.com/etfs", issuerUrl: "https://themesetfs.com/etfs" },
  { repo: "VanEck", brand: "VanEck", slug: "vaneck", issuerLabel: "vaneck.com", issuerUrl: "https://www.vaneck.com/us/en/etf-mutual-fund-finder/" },
  { repo: "Vanguard", brand: "Vanguard", slug: "vanguard", issuerLabel: "investor.vanguard.com", issuerUrl: "https://investor.vanguard.com/etf/list" },
  { repo: "VictoryShares", brand: "VictoryShares", slug: "victoryshares", issuerLabel: "vcm.com VictoryShares ETFs", issuerUrl: "https://www.vcm.com/products/victoryshares-etfs/victoryshares-etfs-list" },
  { repo: "WisdomTree", brand: "WisdomTree", slug: "wisdomtree", issuerLabel: "wisdomtree.com", issuerUrl: "https://www.wisdomtree.com/investments" },
  { repo: "Xtrackers", brand: "Xtrackers", slug: "xtrackers", issuerLabel: "etf.dws.com", issuerUrl: "https://etf.dws.com/en-us/etf-products/" },
];

const DASH = '–'; // placeholder for null / unavailable values, never 0
const THEME_KEY = 'etf-hub-theme';
const SELECTED_KEY = 'etf-hub-selected-etfs';
const BLACKLIST_KEY = 'etf-hub-blacklisted-etfs';
const ACTIVE_FUND_KEY = 'etf-hub-active-fund';
const FILTERS_KEY = 'etf-hub-tab-filters';
const SORTS_KEY = 'etf-hub-tab-sorts';
const SITE_STATE_KEY = 'etf-hub-site-state';
const VIEW_FILTERS_KEY = 'etf-hub-view-filters';
const GITHUB_PAGES_ORIGIN = 'https://daggerok.github.io/';
const BRAND_CONCURRENCY = 8; // parallel brand index requests at startup
const BRAND_TIMEOUT_MS = 25000;
const HOLDINGS_CONCURRENCY = 6; // bounded whole-selection aggregation workers
const WATCHLIST_CHUNK = 250; // rows per rendered Watchlist DOM chunk
const CATALOG_CHUNK = 200; // rows per rendered catalog DOM chunk
const LARGE_SELECTION = 150; // ask before selecting more funds than this at once
const DEFAULT_STALE_DAYS = 45;
const IDB_NAME = 'etf-hub';
const IDB_STORE = 'indexes';
const DAY_MS = 86400000;

const DETAIL_TABS: Array<{ key: string; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'holdings', label: 'Holdings' },
  { key: 'history', label: 'History' },
  { key: 'distributions', label: 'Distributions' },
];

const NUMERIC_SHEET_HEADERS = ['Weight', 'Weight (%)', 'Market Weight', 'Shares Held', 'Shares Outstanding', 'Total Net Assets', 'Par Value', 'Market Value', 'Coupon', 'NAV'];

// Sortable numeric columns of the catalog: the metrics block of every feed row
// plus a few top level numbers. NaN means unavailable (always sorts last).
const METRIC_KEYS = ['ytd', 'tr1y', 'tr3y', 'tr5y', 'tr10y', 'cagr3y', 'cagr5y', 'cagr10y', 'siAnn', 'dividendYield', 'secYield'];
const FUND_NUM_KEYS = ['aumValue', 'terValue', 'navValue'];
const STRING_SORT_KEYS = ['ticker', 'name', 'brand', 'category', 'dividendFrequency'];
const ASC_FIRST_KEYS = ['ticker', 'name', 'brand', 'category', 'dividendFrequency', 'symbol', 'section', 'metric', 'identifier', 'label'];

// Hover explanations for table headers (native `title` tooltips).
const COLUMN_TOOLTIPS: Record<string, string> = {
  '#': 'Row index in current table view.',
  Use: 'Use / Multi-ETF Selection - check this box to include this ETF\'s underlying holdings in the combined Watchlist tab. Funds of different brands mix freely.',
  Ticker: 'Ticker Symbol - unique stock market identifier. For holdings: the exchange ticker resolved by the issuing brand\'s feed. A dash means the position has no exchange ticker (bond, private debt); then the Identifier is the key.',
  Brand: 'Brand - the ETF issuer whose sibling repository publishes this fund\'s static feed.',
  'Fund Name': 'Fund Name - official legal name of the exchange-traded fund (ETF), as published by the issuer.',
  Type: 'Category - the issuer\'s own grouping (asset class or strategy). Categories differ between brands.',
  Name: 'Security Name - full registered legal name of the company or underlying financial asset.',
  Identifier: 'CUSIP / ISIN / SEDOL - security identifier as published in the holdings sheet. Positions without an exchange ticker (bonds, cash, futures) are identified in the Watchlist by this.',
  SEDOL: 'SEDOL - Stock Exchange Daily Official List identifier.',
  NAV: 'NAV (Net Asset Value) - per-share dollar value of the fund.',
  'Net Assets': 'Net Assets (AUM) - total market value of all fund assets minus liabilities.',
  Expense: 'Expense Ratio (TER) - total annual fund operating expenses as a % of assets, as published by the issuer.',
  Weight: 'Weight - position weight as a percentage of the fund\'s total net assets.',
  'Weight (%)': 'Weight - position weight as a percentage of the fund\'s total net assets.',
  'Weight Sum': 'Weight Sum - summed weight of this holding across all selected ETFs (%).',
  'Max Weight': 'Max Weight - highest single-fund weight for this holding across selected ETFs (%).',
  '# ETFs': 'Number of selected ETFs (of any brand) that currently hold this security.',
  ETFs: 'Selected ETFs holding this security.',
  'Dividend Yield': 'Dividend Yield - as published by the brand feed (trailing 12-month yield or the indicated rate from the latest distribution), in %.',
  'SEC Yield': 'SEC Yield (30-Day) - the 30-day SEC yield when the issuer publishes one; a dash otherwise.',
  Frequency: 'Frequency - sortable payment cadence from the published distribution schedule: 01 - Monthly, 04 - Quarterly, 06 - Semi-annually, 12 - Annually; 00 denotes unavailable and 99 irregular.',
  'YTD Return': 'YTD Return - total return since the start of the year. Source and as-of date differ per brand: see the Source badge and Return As Of.',
  'TR 1Y': 'TR 1Y (1-Year Total Return) - cumulative total return over the past year, including reinvested distributions. Official NAV return when the issuer publishes one, otherwise derived or estimated (see Source).',
  'TR 3Y': 'TR 3Y (3-Year Total Return) - cumulative total return over 3 years, published or derived exactly from the 3Y CAGR.',
  'TR 5Y': 'TR 5Y (5-Year Total Return) - cumulative total return over 5 years, published or derived exactly from the 5Y CAGR.',
  'TR 10Y': 'TR 10Y (10-Year Total Return) - cumulative total return over 10 years, published or derived exactly from the 10Y CAGR.',
  'CAGR 3Y': 'CAGR 3Y - annualized total return over 3 years.',
  'CAGR 5Y': 'CAGR 5Y - annualized total return over 5 years.',
  'CAGR 10Y': 'CAGR 10Y - annualized total return over 10 years.',
  'SI Ann.': 'Since-inception annualized total return (blank when the issuer publishes none and the available history is insufficient).',
  Source: 'Source of the returns (metrics.returnsBasis). NAV = official issuer NAV total returns; mixed = official with gaps derived or estimated; derived = computed from price or NAV history (an estimate, not a standardized figure); n/a = unavailable. Hover a badge for the full text.',
  'Return As Of': 'performanceAsOf - the date the returns are calculated as of (issuer table date, or the last price date for derived returns). Not the NAV date. A dash means unknown.',
  Inception: 'Fund inception date.',
  Exchange: 'Primary listing exchange.',
  Close: 'Most recent closing market price.',
  'Prem/Disc': 'Premium / Discount - closing price versus NAV (%).',
  Holdings: 'Rows in the fund\'s latest holdings file.',
  History: 'Rows in the fund\'s NAV / price history file.',
  'As Of': 'NAV / AUM as-of date.',
  'Ex-Date': 'Ex-dividend date of the latest distribution.',
  Dividend: 'Latest dividend per share.',
  Coupon: 'Bond annual coupon rate (%).',
  Maturity: 'Bond maturity date.',
  'Market Value': 'Position market value in local currency.',
  Section: 'Section - grouping of the overview metric (Fund, Cost, Price, Assets, Returns, Distributions, Holdings).',
  Metric: 'Metric - overview metric name.',
  Value: 'Overview metric value.',
  Date: 'History date.',
  'Market Price': 'Closing market price on that date.',
  'Premium/Discount': 'Premium / Discount - closing market price versus NAV on that date (%).',
  'Shares Outstanding': 'Fund shares outstanding on that date.',
  'Total Net Assets': 'Fund total net assets on that date (USD).',
};

// =========================================================================
// 2. DOM references, application state & compact catalog store
// =========================================================================

function byId(id: string): any {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element;
}

const el = {
  themeToggle: byId('theme-toggle'),
  tickerCount: byId('ticker-count'),
  subtitle: byId('app-subtitle'),
  brandWarning: byId('brand-warning'),
  searchInput: byId('search-input'),
  searchClearBtn: byId('search-clear-btn'),
  searchSuggest: byId('search-suggest'),
  tabsBar: byId('tabs-bar'),
  selectedTabsPanel: byId('selected-tabs-panel'),
  selectedTabsBar: byId('selected-tabs-bar'),
  copyBtn: byId('copy-btn'),
  exportCsvBtn: byId('export-csv-btn'),
  exportTxtBtn: byId('export-txt-btn'),
  resetBtn: byId('reset-btn'),
  blacklistBtn: byId('blacklist-btn'),
  blacklistPanel: byId('blacklist-panel'),
  blacklistInput: byId('blacklist-input'),
  blacklistAddBtn: byId('blacklist-add-btn'),
  blacklistClearBtn: byId('blacklist-clear-btn'),
  blacklistChips: byId('blacklist-chips'),
  blacklistEmpty: byId('blacklist-empty'),
  brandBtn: byId('brand-btn'),
  brandPanel: byId('brand-panel'),
  brandSummary: byId('brand-summary'),
  brandBadge: byId('brand-badge'),
  categoryBtn: byId('category-btn'),
  categoryPanel: byId('category-panel'),
  categorySummary: byId('category-summary'),
  categoryBadge: byId('category-badge'),
  staleToggle: byId('stale-toggle'),
  staleDays: byId('stale-days'),
  loadProgress: byId('load-progress'),
  tableHead: byId('table-head'),
  tableBody: byId('table-body'),
  tableScroll: byId('table-scroll'),
  staticLoadSentinel: byId('static-load-sentinel'),
  staticLoadStatus: byId('static-load-status'),
};

type AppState = {
  selected: Set<string>; // fund keys "Repo:TICKER"
  blacklist: Set<string>;
  hiddenBrands: Set<string>; // repos unchecked in the brand filter
  hiddenCategories: Set<string>; // categories unchecked in the category filter (empty = no category filtering)
  hideStale: boolean;
  staleDays: number;
  activeTab: ActiveTab;
  activeFundKey: string | null;
  queryByTab: Record<string, string>;
  sortKey: string;
  sortDir: SortDirection;
  // Last sort the user explicitly chose (column-header click) per tab.
  sortByTab: Record<string, { key: string; dir: SortDirection }>;
  loading: boolean;
  loadDone: number;
};

const state: AppState = {
  selected: new Set(),
  blacklist: new Set(),
  hiddenBrands: new Set(),
  hiddenCategories: new Set(),
  hideStale: false,
  staleDays: DEFAULT_STALE_DAYS,
  activeTab: 'All',
  activeFundKey: null,
  queryByTab: {},
  sortKey: 'rank',
  sortDir: 'asc',
  sortByTab: {},
  loading: true,
  loadDone: 0,
};

// Per-brand loading bookkeeping (indexed like BRANDS).
const brandFunds: any[][] = BRANDS.map(() => []);
const brandGeneratedAt: Array<string | null> = BRANDS.map(() => null);
const brandStatus: BrandStatus[] = BRANDS.map(() => 'pending');
const brandError: string[] = BRANDS.map(() => '');

/**
 * Compact in-memory catalog. Sortable numerics live in Float64Arrays (NaN =
 * unavailable); brand, category, frequency and returns-basis class are small
 * integer dictionary ids. Rebuilt whenever a brand index changes; the raw feed
 * rows stay referenced only for the overview tab and display strings.
 */
type Store = {
  version: number;
  n: number;
  raw: any[];
  brandIdx: Uint8Array;
  catId: Uint16Array;
  categories: string[];
  basisCls: Float64Array; // 1 official, 2 mixed, 3 derived, NaN none
  num: Record<string, Float64Array>;
  ticker: string[];
  name: string[];
  keys: string[];
  search: string[];
  brandText: string[];
  categoryText: string[];
  freqText: string[];
  fields: Record<SearchField, string[]>; // lower-cased text per searchable field (field:value syntax)
  keyIndex: Map<string, number>;
  tickerIndex: Map<string, number[]>;
  rankCache: Record<string, Float64Array>;
};

let store: Store | null = null;
let storeVersion = 0;
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

// Holdings pipeline bookkeeping: per-fund in-flight meta.json dedupe, one
// serialized page-load chain per fund, per-fund completion flags powering the
// Watchlist "Loading... / N+" label, and the chunked rendering cursors.
const metaInFlight: Map<string, Promise<any>> = new Map();
const holdingsChains: Map<string, Promise<void>> = new Map();
const holdingsComplete = new Set<string>();
const holdingsInFlight = new Set<string>();
let watchlistChunkSig = '';
let watchlistRenderedCount = 0;
let watchlistRefreshTimer: any = null;
let catalogChunkSig = '';
let catalogRenderedCount = 0;
let catalogVisibleIds: number[] = [];

type SheetEntry = {
  headers: string[];
  rows: string[][];
  nextPage: number;
  manifest: any;
  loading: boolean;
};

const fundMetaCache: Map<string, any> = new Map();
const sheetState: Map<string, SheetEntry> = new Map();
let sheetGeneration = 0;

// =========================================================================
// 3. Theme, storage & small helpers
// =========================================================================

function applyTheme(dark: boolean): void {
  document.documentElement.classList.toggle('dark', dark);
  el.themeToggle.textContent = dark ? '☀️' : '🌙';
}

function lsGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function lsSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* quota, private mode or blocked storage */ }
}

function lsRemove(key: string): void {
  try { localStorage.removeItem(key); } catch { /* blocked storage */ }
}

function lsGetJson(key: string, fallback: any): any {
  try {
    const raw = lsGet(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char] || char));
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '' || value.trim() === '-') return null;
  const parsed = Number(value.replace(/[$,%\s,]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function numberCell(value: unknown): string {
  const parsed = numberOrNull(value);
  return parsed === null ? '' : String(parsed);
}

function nanToNull(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

function formatPercent(value: unknown): string {
  const parsed = numberOrNull(value);
  return parsed === null ? DASH : `${parsed.toFixed(2)}%`;
}

function formatDividendFrequency(value: unknown): string {
  const raw = String(value ?? '').trim();
  const normalized = raw.toLowerCase().replace(/[‐‑‒–—]/g, '-').replace(/\s+/g, ' ');
  if (!normalized || /^[\s-]+$/.test(normalized) || /^00\s*-\s*-+$/.test(normalized)) return '00 - None';
  if (normalized === 'monthly') return '01 - Monthly';
  if (normalized === 'quarterly') return '04 - Quarterly';
  if (normalized === 'semi-annual' || normalized === 'semi-annually' || normalized === 'semiannual' || normalized === 'semiannually') return '06 - Semi-annually';
  if (normalized === 'annual' || normalized === 'annually') return '12 - Annually';
  if (normalized === 'weekly') return '52 - Weekly';
  if (normalized === 'none') return '00 - None';
  if (normalized === 'unknown') return '00 - Unknown';
  if (normalized === 'irregular') return '99 - Irregular';
  return raw;
}

function formatInteger(value: unknown): string {
  const parsed = numberOrNull(value);
  return parsed === null || parsed === 0 ? DASH : parsed.toLocaleString('en-US');
}

function formatMoney(value: unknown): string {
  const parsed = numberOrNull(value);
  if (parsed === null) return DASH;
  if (Math.abs(parsed) >= 1e12) return `$${(parsed / 1e12).toFixed(2)}T`;
  if (Math.abs(parsed) >= 1e9) return `$${(parsed / 1e9).toFixed(2)}B`;
  if (Math.abs(parsed) >= 1e6) return `$${(parsed / 1e6).toFixed(2)}M`;
  if (Math.abs(parsed) >= 1e3) return `$${(parsed / 1e3).toFixed(2)}K`;
  return `$${parsed.toFixed(2)}`;
}

function sanitizeTicker(value: unknown): string {
  return String(value ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}

function parseDateTs(value: unknown): number {
  if (typeof value !== 'string' || !/\d/.test(value)) return NaN;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? NaN : parsed;
}

function fundKey(repo: string, ticker: string): string {
  return `${repo}:${ticker}`;
}

function keyTicker(key: string): string {
  return key.slice(key.indexOf(':') + 1);
}

function keyRepo(key: string): string {
  return key.slice(0, key.indexOf(':'));
}

function brandByRepo(repo: string): Brand | null {
  return BRANDS.find(brand => brand.repo === repo) || null;
}

function getHeaderTooltip(header: string): string {
  if (!header) return '';
  if (COLUMN_TOOLTIPS[header]) return COLUMN_TOOLTIPS[header];
  const clean = String(header).trim();
  const keys = Object.keys(COLUMN_TOOLTIPS);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (key.toLowerCase() === clean.toLowerCase()) return COLUMN_TOOLTIPS[key];
  }
  return clean;
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Fall through to the legacy path.
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

function downloadText(text: string, fileName: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toCsv(rows: string[][]): string {
  return rows
    .map(row => row.map(cell => {
      const value = String(cell ?? '');
      return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    }).join(','))
    .join('\n');
}

function exportFileName(scope: string, extension: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `etfs-hub-${scope.toLowerCase().replace(/\s+/g, '-')}-${stamp}.${extension}`;
}

function setStatus(message: string, tone: 'info' | 'success' | 'error'): void {
  console.debug(`[${tone}] ${message}`);
}

// =========================================================================
// 4. Feed base URLs, brand index loading, IndexedDB cache & store build
// =========================================================================

/**
 * Where the feeds live. On github.io (or with ?api=remote) every brand is read
 * from its own GitHub Pages site, which serves access-control-allow-origin: *.
 * Anywhere else (local `bunx serve .` from the folder that holds the cloned
 * sibling repos) the feeds are read from the sibling folders next to the hub.
 * ?api=local forces the sibling folders, ?api=remote forces GitHub Pages.
 */
function resolveApiMode(): 'remote' | 'local' {
  try {
    const forced = new URLSearchParams(location.search).get('api');
    if (forced === 'remote' || forced === 'local') return forced;
  } catch {
    /* fall through to the hostname rule */
  }
  return /(^|\.)github\.io$/i.test(location.hostname) ? 'remote' : 'local';
}

const API_MODE = resolveApiMode();
// Fallback to GitHub Pages applies only to the automatic local mode, never to an explicit ?api=local.
const LOCAL_FALLBACK = API_MODE === 'local' && !/(^|[?&])api=local(&|$)/.test(location.search);

// Brands served from GitHub Pages although the page runs in local mode (the
// sibling folder is missing, e.g. after `bunx degit daggerok/ETFs`). Remembered
// per brand so its per-fund files use the base that worked.
const remoteFallback = new Set<string>();

function remoteBase(brand: Brand): string {
  return `${GITHUB_PAGES_ORIGIN}${encodeURIComponent(brand.repo)}/api/${brand.slug}/`;
}

function localBase(brand: Brand): string {
  return `./${encodeURIComponent(brand.repo)}/api/${brand.slug}/`;
}

function brandBase(brand: Brand): string {
  return API_MODE === 'remote' || remoteFallback.has(brand.repo) ? remoteBase(brand) : localBase(brand);
}

async function fetchJson(url: string, timeoutMs = 0): Promise<any> {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller && timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-cache', signal: controller ? controller.signal : undefined });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

let idbPromise: Promise<any> | null = null;

function openDb(): Promise<any> {
  if (idbPromise) return idbPromise;
  idbPromise = new Promise(resolve => {
    try {
      if (typeof indexedDB === 'undefined') { resolve(null); return; }
      const request = indexedDB.open(IDB_NAME, 1);
      request.onupgradeneeded = () => {
        try { request.result.createObjectStore(IDB_STORE); } catch { /* already exists */ }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return idbPromise;
}

function idbGet(key: string): Promise<any> {
  return openDb().then(db => new Promise(resolve => {
    if (!db) { resolve(null); return; }
    try {
      const request = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  }));
}

function idbPut(key: string, value: any): Promise<void> {
  return openDb().then(db => new Promise<void>(resolve => {
    if (!db) { resolve(); return; }
    try {
      const request = db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    } catch {
      resolve();
    }
  }));
}

/** Cache key: origin + api mode + repo (local and remote data differ). */
function cacheKey(brandIndex: number): string {
  return `${location.origin}|${API_MODE}|${BRANDS[brandIndex].repo}`;
}

function classifyBasis(text: unknown): number {
  const t = String(text ?? '').trim().toLowerCase();
  if (!t || t === 'unavailable' || t === '-' || t.startsWith('none')) return NaN;
  const official = t.startsWith('official');
  const derived = /(derived|estimat|yahoo|adjusted market|market-price)/.test(t);
  if (official && derived) return 2;
  if (official) return 1;
  return 3;
}

/** Plain-language words of the returns basis, so a search for "official" or "estimate" finds those funds. */
function basisSearchWords(cls: number): string {
  if (cls === 1) return 'official';
  if (cls === 2) return 'official derived estimate mixed';
  if (cls === 3) return 'derived estimate';
  return '';
}

// ---- main search syntax: words are ANDed; field:value / field:"two words" restrict a word to one field ----

type SearchField = 'ticker' | 'name' | 'brand' | 'category' | 'basis' | 'exchange';
type SearchTerm = { field: SearchField | ''; value: string; start: number; end: number };

const SEARCH_FIELD_ALIASES: Record<string, SearchField> = {
  ticker: 'ticker', symbol: 'ticker', name: 'name', fund: 'name', brand: 'brand', issuer: 'brand',
  category: 'category', cat: 'category', type: 'category', basis: 'basis', source: 'basis', exchange: 'exchange',
};

/** Splits the search text into terms; unknown prefixes stay part of a plain word, quotes keep spaces together. */
function parseSearchTerms(text: string): SearchTerm[] {
  const terms: SearchTerm[] = [];
  const re = /(?:([A-Za-z]+):)?(?:"([^"]*)"?|(\S+))/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const alias = match[1] ? SEARCH_FIELD_ALIASES[match[1].toLowerCase()] : undefined;
    let field: SearchTerm['field'] = alias || '';
    let value = match[2] !== undefined ? match[2] : (match[3] ?? '');
    if (match[1] && !alias) { field = ''; value = `${match[1]}:${value}`; }
    value = value.trim().toLowerCase();
    if (value) terms.push({ field, value, start: match.index, end: match.index + match[0].length });
  }
  return terms;
}

function frequencyOf(fund: any): string {
  const fromDistributions = fund.distributions && typeof fund.distributions === 'object' ? fund.distributions.frequency : '';
  return formatDividendFrequency(fromDistributions || fund.distributionFrequency || '');
}

function buildStore(): Store {
  const items: Array<{ fund: any; b: number }> = [];
  const seen = new Set<string>();
  brandFunds.forEach((list, b) => {
    list.forEach(fund => {
      if (!fund || typeof fund.ticker !== 'string' || !fund.ticker) return;
      const key = fundKey(BRANDS[b].repo, fund.ticker);
      if (seen.has(key)) return;
      seen.add(key);
      items.push({ fund, b });
    });
  });
  items.sort((x, y) => collator.compare(x.fund.ticker, y.fund.ticker) || x.b - y.b);

  const n = items.length;
  const num: Record<string, Float64Array> = {};
  const newArray = (): Float64Array => new Float64Array(n).fill(NaN);
  [...METRIC_KEYS, ...FUND_NUM_KEYS, 'holdings', 'history', 'perfTs', 'asOfTs', 'inceptionTs'].forEach(key => { num[key] = newArray(); });
  const basisCls = newArray();
  const brandIdx = new Uint8Array(n);
  const catId = new Uint16Array(n);
  const categoryDict = new Map<string, number>();
  const categories: string[] = [];
  const result: Store = {
    version: ++storeVersion,
    n,
    raw: new Array(n),
    brandIdx,
    catId,
    categories,
    basisCls,
    num,
    ticker: new Array(n),
    name: new Array(n),
    keys: new Array(n),
    search: new Array(n),
    brandText: new Array(n),
    categoryText: new Array(n),
    freqText: new Array(n),
    fields: { ticker: new Array(n), name: new Array(n), brand: new Array(n), category: new Array(n), basis: new Array(n), exchange: new Array(n) },
    keyIndex: new Map(),
    tickerIndex: new Map(),
    rankCache: {},
  };

  for (let i = 0; i < n; i++) {
    const fund = items[i].fund;
    const b = items[i].b;
    const brand = BRANDS[b];
    const metrics = fund.metrics && typeof fund.metrics === 'object' ? fund.metrics : {};
    const category = String(fund.category || '');
    let cid = categoryDict.get(category);
    if (cid === undefined) {
      cid = categories.length;
      categories.push(category);
      categoryDict.set(category, cid);
    }
    result.raw[i] = fund;
    brandIdx[i] = b;
    catId[i] = cid;
    result.ticker[i] = fund.ticker;
    result.name[i] = String(fund.name || '');
    result.keys[i] = fundKey(brand.repo, fund.ticker);
    result.brandText[i] = brand.brand;
    result.categoryText[i] = category;
    result.freqText[i] = frequencyOf(fund);
    for (let k = 0; k < METRIC_KEYS.length; k++) {
      const value = numberOrNull(metrics[METRIC_KEYS[k]]);
      if (value !== null) num[METRIC_KEYS[k]][i] = value;
    }
    for (let k = 0; k < FUND_NUM_KEYS.length; k++) {
      const value = numberOrNull(fund[FUND_NUM_KEYS[k]]);
      if (value !== null) num[FUND_NUM_KEYS[k]][i] = value;
    }
    if (fund.holdings) num.holdings[i] = Number(fund.holdings);
    if (fund.history) num.history[i] = Number(fund.history);
    num.perfTs[i] = parseDateTs(metrics.performanceAsOf);
    num.asOfTs[i] = parseDateTs(fund.asOfDate);
    num.inceptionTs[i] = parseDateTs(fund.inceptionDate);
    basisCls[i] = classifyBasis(metrics.returnsBasis);
    const basisWords = basisSearchWords(basisCls[i]);
    result.fields.ticker[i] = String(fund.ticker).toLowerCase();
    result.fields.name[i] = String(fund.name ?? '').toLowerCase();
    result.fields.brand[i] = `${brand.brand} ${brand.repo}`.toLowerCase();
    result.fields.category[i] = category.toLowerCase();
    result.fields.basis[i] = `${BASIS_BADGES[Number.isFinite(basisCls[i]) ? String(basisCls[i]) : 'none'].label} ${basisWords} ${String(metrics.returnsBasis ?? '')}`.toLowerCase();
    result.fields.exchange[i] = String(fund.exchange ?? '').toLowerCase();
    result.search[i] = [
      fund.ticker, fund.name, brand.brand, brand.repo, category, fund.cusip, fund.isin, fund.exchange, basisWords,
    ].map(value => String(value ?? '').toLowerCase()).join(' ');
    result.keyIndex.set(result.keys[i], i);
    const clean = sanitizeTicker(fund.ticker);
    const list = result.tickerIndex.get(clean);
    if (list) list.push(i);
    else result.tickerIndex.set(clean, [i]);
  }
  return result;
}

let rebuildTimer: any = null;
let rebuildDirty = false;

/** Coalesces rebuilds while many brand indexes stream in (~150 ms). */
function scheduleRebuild(): void {
  rebuildDirty = true;
  if (rebuildTimer !== null) return;
  rebuildTimer = setTimeout(() => {
    rebuildTimer = null;
    rebuildNow();
  }, 150);
}

function rebuildNow(): void {
  if (rebuildTimer !== null) { clearTimeout(rebuildTimer); rebuildTimer = null; }
  if (!rebuildDirty && store) return;
  rebuildDirty = false;
  store = buildStore();
  viewCache = null;
  onStoreChanged();
}

function onStoreChanged(): void {
  if (!store) return;
  if (legacyCategory && store.categories.includes(legacyCategory)) {
    // Older versions saved one category name; keep exactly that one visible.
    state.hiddenCategories = new Set(store.categories.filter(name => name !== legacyCategory));
    legacyCategory = '';
  }
  const active = state.activeFundKey;
  if (!active || !state.selected.has(active) || !store.keyIndex.has(active)) {
    state.activeFundKey = selectedKeys()[0] || null;
  }
  el.searchInput.disabled = false;
  [el.copyBtn, el.exportCsvBtn, el.exportTxtBtn, el.resetBtn].forEach(button => { button.disabled = false; });
  applyRestoredTab();
  render();
  void ensureHoldingsForSelection();
}

function loadedBrandCount(): number {
  return brandStatus.filter(status => status === 'ok' || status === 'cached').length;
}

function renderLoadProgress(): void {
  const failed = brandStatus.map((status, i) => (status === 'error' ? i : -1)).filter(i => i >= 0);
  const cachedOnly = brandStatus.filter(status => status === 'cached').length;
  const fromPages = API_MODE === 'local' ? remoteFallback.size : 0;
  if (state.loading) {
    el.loadProgress.textContent = `Loading brand feeds ${state.loadDone}/${BRANDS.length}${store ? ` · ${store.n.toLocaleString('en-US')} ETFs so far` : ''}…`;
  } else {
    el.loadProgress.textContent = `${loadedBrandCount()} of ${BRANDS.length} brands loaded${cachedOnly ? ` (${cachedOnly} from cache only)` : ''}${fromPages ? ` · ${fromPages} remote (github.io)` : ''}${failed.length ? ` · ${failed.length} unavailable` : ''}`;
  }
  el.brandWarning.hidden = failed.length === 0;
  if (failed.length) {
    el.brandWarning.textContent = `${failed.length} brand${failed.length === 1 ? '' : 's'} unavailable`;
    el.brandWarning.title = failed.map(i => `${BRANDS[i].brand}: ${brandError[i]}`).join('\n');
  }
  renderBrandList();
}

/**
 * Startup prework: cached indexes first (first paint), then every brand index
 * is revalidated over the network by a pool of BRAND_CONCURRENCY workers. A
 * brand that fails is marked unavailable (or keeps serving its cache) and
 * never blocks the others.
 */
async function loadCatalog(): Promise<void> {
  el.tableBody.innerHTML = `<tr><td colspan="10" class="py-12 text-center text-slate-400 dark:text-slate-500">Loading ETF catalogs of ${BRANDS.length} brands…</td></tr>`;
  const cached: any[] = await Promise.race([
    Promise.all(BRANDS.map((_, i) => idbGet(cacheKey(i)))),
    new Promise<any[]>(resolve => setTimeout(() => resolve([]), 1500)),
  ]);
  let anyCached = false;
  cached.forEach((record, i) => {
    if (record && record.data && Array.isArray(record.data.funds)) {
      brandFunds[i] = record.data.funds;
      brandGeneratedAt[i] = record.generatedAt || record.data.generatedAt || null;
      brandStatus[i] = 'cached';
      if (API_MODE === 'local' && record.remote === true) remoteFallback.add(BRANDS[i].repo);
      anyCached = true;
    }
  });
  if (anyCached) {
    rebuildDirty = true;
    rebuildNow(); // first paint from cache
  }
  renderLoadProgress();

  const queue = BRANDS.map((_, i) => i);
  const workers = Array.from({ length: Math.min(BRAND_CONCURRENCY, queue.length) }, async () => {
    for (;;) {
      const next = queue.shift();
      if (next === undefined) break;
      await loadBrandIndex(next, cached[next]);
      state.loadDone += 1;
      renderLoadProgress();
    }
  });
  await Promise.all(workers);
  state.loading = false;
  rebuildDirty = rebuildDirty || !store;
  rebuildNow();
  if (!store) onStoreChanged();
  renderLoadProgress();
  renderSubtitle();
  const active = state.activeFundKey;
  if (active) {
    void loadFundMeta(active).then(meta => {
      if (meta && state.activeTab === 'detail:holdings') void ensureSheet('holdings', meta.holdings);
    });
  }
}

async function loadBrandIndex(i: number, record: any): Promise<void> {
  const brand = BRANDS[i];
  try {
    let data: any = null;
    const readIndex = async (base: string): Promise<any> => {
      const loaded = await fetchJson(`${base}index.json`, BRAND_TIMEOUT_MS);
      if (!loaded || !Array.isArray(loaded.funds)) throw new Error('malformed index.json');
      return loaded;
    };
    if (API_MODE === 'remote') {
      data = await readIndex(remoteBase(brand));
    } else {
      try {
        data = await readIndex(localBase(brand));
        remoteFallback.delete(brand.repo);
      } catch (localError) {
        // ?api=local stays strict; the default local mode falls back to GitHub Pages per brand.
        if (!LOCAL_FALLBACK) throw localError;
        data = await readIndex(remoteBase(brand));
        remoteFallback.add(brand.repo);
      }
    }
    const unchanged = Boolean(record && record.generatedAt && record.generatedAt === data.generatedAt && brandFunds[i].length);
    if (!unchanged) {
      brandFunds[i] = data.funds;
      brandGeneratedAt[i] = data.generatedAt || null;
      void idbPut(cacheKey(i), { generatedAt: data.generatedAt || null, savedAt: Date.now(), remote: remoteFallback.has(brand.repo), data });
      scheduleRebuild();
    }
    brandStatus[i] = 'ok';
    brandError[i] = '';
  } catch (error) {
    const message = error instanceof Error ? (error.name === 'AbortError' ? 'timeout' : error.message) : String(error);
    brandError[i] = message;
    brandStatus[i] = brandFunds[i].length ? 'cached' : 'error';
    console.warn(`Brand ${brand.brand} (${brand.repo}) unavailable: ${message}`);
  }
}

// =========================================================================
// 5. Lazy per-fund data (meta.json, paginated sheets) from the fund's brand
// =========================================================================

function fundBaseUrl(key: string): string {
  const brand = brandByRepo(keyRepo(key));
  return brand ? brandBase(brand) : '';
}

function fundRaw(key: string): any {
  if (!store) return null;
  const id = store.keyIndex.get(key);
  return id === undefined ? null : store.raw[id];
}

function selectedKeys(): string[] {
  if (!store) return [];
  const present = store.keyIndex;
  return [...state.selected].filter(key => present.has(key));
}

/**
 * meta.json requests are deduplicated per fund while in flight: the detail
 * view and the background Watchlist loader share one request. Catalog-only
 * funds (no holdings, no history) short-circuit to null; failed fetches are
 * not cached so they can retry.
 */
async function loadFundMeta(key: string): Promise<any> {
  const cached = fundMetaCache.get(key);
  if (cached !== undefined) return cached;
  const inflight = metaInFlight.get(key);
  if (inflight) return inflight;
  const known = fundRaw(key);
  if (!known) return null;
  if (!known.holdings && !known.history) {
    fundMetaCache.set(key, null);
    return null;
  }
  const request = (async () => {
    try {
      const meta = await fetchJson(`${fundBaseUrl(key)}funds/${encodeURIComponent(keyTicker(key))}/meta.json`);
      fundMetaCache.set(key, meta);
      return meta;
    } catch (error) {
      console.warn(`Failed to load meta.json for ${key}:`, error);
      return null;
    }
  })();
  metaInFlight.set(key, request.finally(() => metaInFlight.delete(key)));
  return metaInFlight.get(key);
}

function sheetKey(sheet: string): string {
  return `${state.activeFundKey}:${sheet}`;
}

function resetSheetPaging(): void {
  sheetGeneration += 1;
}

async function fetchPage(key: string, pagePath: string): Promise<{ headers: string[]; rows: string[][] }> {
  const path = String(pagePath).replace(/^\.?\//, '');
  const page = await fetchJson(`${fundBaseUrl(key)}funds/${encodeURIComponent(keyTicker(key))}/${path}`);
  const headers: string[] = Array.isArray(page.headers) ? page.headers : [];
  const rows: any[] = Array.isArray(page.rows) ? page.rows : [];
  return { headers, rows: rows.map(row => headers.map(header => String(row[header] ?? ''))) };
}

/** Loads the first page of a paginated sheet and prepares lazy appending. */
async function ensureSheet(sheet: 'holdings' | 'history', manifest: any): Promise<void> {
  const key = sheetKey(sheet);
  if (sheetState.has(key) || !manifest || !Array.isArray(manifest.pages) || !manifest.pages.length) return;
  sheetState.set(key, { headers: [], rows: [], nextPage: 0, manifest, loading: false });
  await loadNextSheetPage(sheet);
}

/**
 * Serializes page-load work per fund: the detail-view pager and the
 * background Watchlist loader enqueue onto the same chain, and each unit of
 * work re-checks `nextPage` while holding the chain, so two rapid selection
 * updates can never fetch the same holdings page twice or skip one.
 */
function withFundChain<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = holdingsChains.get(key) ?? Promise.resolve();
  const work = previous.then(fn, fn);
  holdingsChains.set(key, work.then(() => undefined, () => undefined));
  return work;
}

async function fetchNextSheetPage(key: string, entry: SheetEntry): Promise<void> {
  if (entry.nextPage >= entry.manifest.pages.length) return;
  const page = await fetchPage(key, entry.manifest.pages[entry.nextPage]);
  if (!entry.headers.length && page.headers.length) entry.headers = page.headers;
  entry.rows = entry.rows.concat(page.rows);
  entry.nextPage += 1;
}

function appendSheetPage(key: string, entry: SheetEntry): Promise<void> {
  return withFundChain(key, () => fetchNextSheetPage(key, entry));
}

async function loadNextSheetPage(sheet: 'holdings' | 'history'): Promise<void> {
  const key = sheetKey(sheet);
  const entry = sheetState.get(key);
  const fund = state.activeFundKey;
  if (!entry || !fund || entry.loading || entry.nextPage >= entry.manifest.pages.length) return;
  entry.loading = true;
  renderStaticLoadSentinel();
  try {
    const generation = sheetGeneration;
    await appendSheetPage(fund, entry);
    if (generation !== sheetGeneration) return;
    if (state.activeTab === `detail:${sheet}`) render();
  } catch (error) {
    console.error(`Failed to load ${fund} ${sheet} page:`, error);
  } finally {
    entry.loading = false;
    renderStaticLoadSentinel();
  }
}

/** True while any selected ETF's holdings have not finished loading. */
function isHoldingsLoading(): boolean {
  for (const key of selectedKeys()) {
    if (!holdingsComplete.has(key)) return true;
  }
  return false;
}

/** Loads every holdings page of one fund inside its chain (no duplicate or skipped pages). */
async function loadAllHoldingsForFund(key: string): Promise<void> {
  await withFundChain(key, async () => {
    if (!state.selected.has(key)) return; // deselected while queued: skip
    const meta = await loadFundMeta(key);
    if (!meta || !meta.holdings || !Array.isArray(meta.holdings.pages) || !meta.holdings.pages.length) return;
    const sheet = `${key}:holdings`;
    let entry = sheetState.get(sheet);
    if (!entry) {
      entry = { headers: [], rows: [], nextPage: 0, manifest: meta.holdings, loading: false };
      sheetState.set(sheet, entry);
    }
    while (entry.nextPage < entry.manifest.pages.length) {
      if (!state.selected.has(key)) return; // deselected mid-load: skip the rest
      await fetchNextSheetPage(key, entry); // chain already held: no re-queue
    }
  });
}

/**
 * Watchlist aggregation needs every holdings page of every selected ETF.
 * Runs with bounded concurrency so a big cross-brand selection cannot
 * overload the static feeds; holdings are cached under each fund's own key.
 */
async function ensureHoldingsForSelection(): Promise<void> {
  const queue = selectedKeys().filter(key => !holdingsComplete.has(key) && !holdingsInFlight.has(key));
  if (!queue.length) return;
  queue.forEach(key => holdingsInFlight.add(key));
  const workers = Array.from({ length: Math.min(HOLDINGS_CONCURRENCY, queue.length) }, async () => {
    for (;;) {
      const key = queue.shift();
      if (!key) break;
      try {
        await loadAllHoldingsForFund(key);
        holdingsComplete.add(key);
      } catch (error) {
        console.error(`Failed to load ${key} holdings:`, error);
        holdingsComplete.add(key);
      } finally {
        holdingsInFlight.delete(key);
        if (state.selected.size > 0) {
          if (state.activeTab === 'watchlist') scheduleWatchlistRefresh();
          else renderTabs();
        }
      }
    }
  });
  await Promise.all(workers);
  if (state.selected.size > 0) {
    renderTabs();
    if (state.activeTab === 'watchlist') renderWatchlistTable();
  }
}

function scheduleWatchlistRefresh(): void {
  if (state.activeTab !== 'watchlist') return;
  if (watchlistRefreshTimer !== null) return;
  watchlistRefreshTimer = setTimeout(() => {
    watchlistRefreshTimer = null;
    if (state.activeTab === 'watchlist') { renderTabs(); renderWatchlistTable(); }
  }, 150);
}

function activeSheetTab(): 'holdings' | 'history' | null {
  if (state.activeTab === 'detail:holdings') return 'holdings';
  if (state.activeTab === 'detail:history') return 'history';
  return null;
}

function maybeLoadMoreRows(): void {
  const sheet = activeSheetTab();
  if (!sheet) return;
  void loadNextSheetPage(sheet);
}

function renderStaticLoadSentinel(): void {
  const sheet = activeSheetTab();
  if (!sheet || !state.activeFundKey) {
    el.staticLoadSentinel.classList.add('hidden');
    return;
  }
  const entry = sheetState.get(sheetKey(sheet));
  if (!entry) {
    el.staticLoadSentinel.classList.add('hidden');
    return;
  }
  const more = entry.nextPage < entry.manifest.pages.length;
  el.staticLoadSentinel.classList.toggle('hidden', !more);
  el.staticLoadStatus.textContent = entry.loading ? 'Loading more rows…' : more ? 'Scroll or click to load more rows…' : '';
}

// =========================================================================
// 6. Navigation tabs, filters & catalog view (filter + sort over typed arrays)
// =========================================================================

type FundRef = { key: string; id: number; ticker: string; name: string; brand: string; raw: any };

let viewCache: { sig: string; ids: number[] } | null = null;
let blacklistVersion = 0;
let filtersSig = '';
let legacyCategory = ''; // single category saved by an older version, applied once the catalog is built
let brandListSig = '';

function fundRefById(id: number): FundRef | null {
  if (!store) return null;
  return { key: store.keys[id], id, ticker: store.ticker[id], name: store.name[id], brand: store.brandText[id], raw: store.raw[id] };
}

function getActiveFund(): FundRef | null {
  const key = state.activeFundKey;
  if (!key || !store || !state.selected.has(key)) return null;
  const id = store.keyIndex.get(key);
  return id === undefined ? null : fundRefById(id);
}

function catalogQuery(): string {
  return state.queryByTab.All || '';
}

function brandAllowedFlags(): Uint8Array {
  const flags = new Uint8Array(BRANDS.length);
  BRANDS.forEach((brand, i) => { flags[i] = state.hiddenBrands.has(brand.repo) ? 0 : 1; });
  return flags;
}

function hiddenCategoriesSig(): string {
  return [...state.hiddenCategories].sort().join(',');
}

function hiddenBrandsSig(): string {
  return [...state.hiddenBrands].sort().join(',');
}

function isStaleId(id: number): boolean {
  if (!store) return true;
  const ts = store.num.perfTs[id];
  return !(ts >= Date.now() - state.staleDays * DAY_MS); // NaN (unknown date) counts as stale
}

/** Brand filter + blacklist only: the scope of the All ETFs pill and of the category counts. */
function baseIds(): number[] {
  if (!store) return [];
  const allowed = brandAllowedFlags();
  const out: number[] = [];
  for (let i = 0; i < store.n; i++) {
    if (!allowed[store.brandIdx[i]]) continue;
    if (state.blacklist.has(store.keys[i])) continue;
    out.push(i);
  }
  return out;
}

function nonBlacklistedIds(): number[] {
  if (!store) return [];
  const out: number[] = [];
  for (let i = 0; i < store.n; i++) if (!state.blacklist.has(store.keys[i])) out.push(i);
  return out;
}

function filterCatalogIds(): number[] {
  if (!store) return [];
  const s = store;
  const allowed = brandAllowedFlags();
  const terms = parseSearchTerms(catalogQuery());
  const catAllowed = state.hiddenCategories.size ? Uint8Array.from(s.categories, (name: string) => (state.hiddenCategories.has(name) ? 0 : 1)) : null;
  const staleCut = Date.now() - state.staleDays * DAY_MS;
  const out: number[] = [];
  for (let i = 0; i < s.n; i++) {
    if (!allowed[s.brandIdx[i]]) continue;
    if (state.blacklist.has(s.keys[i])) continue;
    if (catAllowed && !catAllowed[s.catId[i]]) continue;
    if (state.hideStale && !(s.num.perfTs[i] >= staleCut)) continue; // unknown date is stale too
    if (terms.length) {
      let ok = true;
      for (let t = 0; t < terms.length; t++) {
        const text = terms[t].field ? s.fields[terms[t].field as SearchField][i] : s.search[i];
        if (!text.includes(terms[t].value)) { ok = false; break; }
      }
      if (!ok) continue;
    }
    out.push(i);
  }
  return out;
}

/** Sort key -> Float64Array (numeric columns directly, text columns via cached ranks); NaN sorts last. */
function sortArrayFor(key: string): Float64Array | null {
  if (!store) return null;
  const s = store;
  if (key === 'basisCls') return s.basisCls;
  if (s.num[key]) return s.num[key];
  if (!STRING_SORT_KEYS.includes(key)) return null;
  const cached = s.rankCache[key];
  if (cached) return cached;
  const texts = key === 'ticker' ? s.ticker : key === 'name' ? s.name : key === 'brand' ? s.brandText : key === 'category' ? s.categoryText : s.freqText;
  const order = Array.from({ length: s.n }, (_, i) => i).sort((a, b) => collator.compare(texts[a], texts[b]) || a - b);
  const ranks = new Float64Array(s.n).fill(NaN);
  let rank = -1;
  let last: string | null = null;
  for (let k = 0; k < order.length; k++) {
    const id = order[k];
    const text = texts[id];
    if (!text) continue;
    if (last === null || collator.compare(last, text) !== 0) { rank += 1; last = text; }
    ranks[id] = rank;
  }
  s.rankCache[key] = ranks;
  return ranks;
}

/** Null / unavailable values ALWAYS sort last, in both directions. */
function sortIds(ids: number[], key: string, dir: SortDirection): number[] {
  const array = key === 'rank' ? null : sortArrayFor(key);
  if (!array) return ids;
  const direction = dir === 'asc' ? 1 : -1;
  return ids.slice().sort((a, b) => {
    const x = array[a];
    const y = array[b];
    const xn = x !== x;
    const yn = y !== y;
    if (xn || yn) return xn && yn ? a - b : xn ? 1 : -1;
    if (x === y) return a - b;
    return (x < y ? -1 : 1) * direction;
  });
}

/** Filtered + sorted catalog ids, memoized on every input that affects them. */
function catalogIds(): number[] {
  if (!store) return [];
  const sig = [
    store.version, hiddenBrandsSig(), blacklistVersion, hiddenCategoriesSig(), catalogQuery(),
    state.hideStale ? state.staleDays : 'off', state.sortKey, state.sortDir,
    state.hideStale ? Math.floor(Date.now() / DAY_MS) : '',
  ].join('|');
  if (viewCache && viewCache.sig === sig) return viewCache.ids;
  const ids = sortIds(filterCatalogIds(), state.sortKey, state.sortDir);
  viewCache = { sig, ids };
  return ids;
}

function getTabs(): TabInfo[] {
  return [{ id: 'All', label: 'All ETFs', count: nonBlacklistedIds().length }];
}

function getSelectedTabs(): TabInfo[] {
  const tabs: TabInfo[] = [];
  const activeFund = getActiveFund();

  if (activeFund) {
    DETAIL_TABS.forEach(tab => {
      tabs.push({
        id: `detail:${tab.key}`,
        label: tab.key === 'overview' ? `${activeFund.ticker} ${tab.label}` : tab.label,
        count: getDetailCount(tab.key),
      });
    });
  }

  if (selectedKeys().length > 0) {
    const rowCount = getDedupedWatchlistRows().length;
    // While holdings are still loading, never show a misleading exact count.
    const count = isHoldingsLoading() ? (rowCount ? `${rowCount}+` : 'Loading…') : rowCount;
    tabs.push({ id: 'watchlist', label: 'Watchlist', count });
  }

  return tabs;
}

function getAllTabIds(): ActiveTab[] {
  return [...getTabs(), ...getSelectedTabs()].map(tab => tab.id);
}

function getDetailCount(key: string): number {
  const activeFund = getActiveFund();
  if (!activeFund) return 0;
  if (key === 'holdings') return Number(activeFund.raw.holdings) || 0;
  if (key === 'history') return Number(activeFund.raw.history) || 0;
  if (key === 'distributions') {
    const meta = fundMetaCache.get(activeFund.key);
    return meta && meta.distributions && Array.isArray(meta.distributions.rows) ? meta.distributions.rows.length : 0;
  }
  return 0;
}

function ensureValidTab(): void {
  if (state.loading && state.selected.size > 0) return; // restored tab waits for its brands
  const tabIds = getAllTabIds();
  if (!tabIds.includes(state.activeTab)) {
    state.activeTab = 'All';
    applySortForTab(state.activeTab);
  }
}

function applyRestoredTab(): void {
  if (state.loading && state.selected.size > 0) { syncSearchInput(); return; }
  const tabIds = getAllTabIds();
  if (!tabIds.includes(state.activeTab)) state.activeTab = 'All';
  applySortForTab(state.activeTab);
  syncSearchInput();
}

function renderTabs(): void {
  renderTabButtons(el.tabsBar, getTabs(), true);
  const selectedTabs = getSelectedTabs();
  el.selectedTabsPanel.classList.toggle('is-visible', selectedTabs.length > 0);
  renderTabButtons(el.selectedTabsBar, selectedTabs, false);
}

function renderTabButtons(container: any, tabs: TabInfo[], alwaysShow: boolean): void {
  container.classList.toggle('hidden', !alwaysShow && tabs.length <= 1);
  // All ETFs pill checkbox: checked iff EVERY non-blacklisted ETF of every brand is selected.
  const everyone = nonBlacklistedIds();
  const allSelected = store !== null && everyone.length > 0 && everyone.every(id => state.selected.has(store ? store.keys[id] : ''));
  container.innerHTML = tabs.map(tab => {
    const isActive = tab.id === state.activeTab;
    const activeClasses = 'bg-blue-600 text-white font-medium border-blue-500 shadow-sm';
    const inactiveClasses = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700';
    if (tab.id === 'All') {
      return `
        <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs transition border whitespace-nowrap ${isActive ? activeClasses : inactiveClasses}">
          <input type="checkbox" id="select-all-toggle" ${allSelected ? 'checked' : ''} class="w-3.5 h-3.5 accent-blue-600 cursor-pointer" title="Select / Deselect all ETFs of all brands" />
          <button data-tab="All" class="font-medium hover:underline focus:outline-none">
            ${escapeHtml(tab.label)} (${tab.count})
          </button>
        </div>
      `;
    }
    return `
      <button
        data-tab="${escapeHtml(tab.id)}"
        class="px-3.5 py-1.5 rounded-full text-xs transition border whitespace-nowrap ${isActive ? activeClasses : inactiveClasses}">
        ${escapeHtml(tab.label)} (${tab.count})
      </button>
    `;
  }).join('');

  container.querySelectorAll('button[data-tab]').forEach((button: any) => {
    button.addEventListener('click', () => {
      const next = button.dataset.tab || 'All';
      if (state.activeTab && state.activeTab !== next) saveActiveTabQuery();
      state.activeTab = next;
      applySortForTab(state.activeTab);
      resetSheetPaging();
      syncSearchInput();
      persistSiteState();
      render();
      maybeLoadMoreRows();
    });
  });

  const selectAllToggle = container.querySelector('#select-all-toggle');
  if (selectAllToggle) {
    selectAllToggle.addEventListener('change', (event: any) => {
      event.stopPropagation();
      toggleAllCatalogEtfs(Boolean(event.target.checked));
    });
    selectAllToggle.addEventListener('click', (event: any) => event.stopPropagation());
  }
}

function applyDefaultSortForTab(tab: ActiveTab): void {
  if (tab === 'watchlist') {
    state.sortKey = 'weightSum';
    state.sortDir = 'desc';
  } else if (tab === 'detail:overview') {
    state.sortKey = 'section';
    state.sortDir = 'asc';
  } else {
    // Catalog (ticker order), Holdings, History and Distributions keep source order by default.
    state.sortKey = 'rank';
    state.sortDir = 'asc';
  }
}

function applySortForTab(tab: ActiveTab): void {
  const remembered = state.sortByTab[tab];
  if (remembered) {
    state.sortKey = remembered.key;
    state.sortDir = remembered.dir;
    return;
  }
  applyDefaultSortForTab(tab);
}

function rememberSortForCurrentTab(): void {
  state.sortByTab[state.activeTab] = { key: state.sortKey, dir: state.sortDir };
  persistTabSorts();
}

function tabLabel(tab: ActiveTab): string {
  const match = /^detail:(.+)$/.exec(tab);
  if (match) {
    const found = DETAIL_TABS.find(item => item.key === match[1]);
    return found ? found.label : tab;
  }
  return tab === 'watchlist' ? 'Watchlist' : 'All ETFs';
}

function isEtfCatalogTab(tab: ActiveTab): boolean {
  return tab === 'All';
}

function isDetailTab(tab: ActiveTab): boolean {
  return /^detail:(overview|holdings|history|distributions)$/.test(tab);
}

function detailTabKey(tab: ActiveTab): string {
  const match = /^detail:(.+)$/.exec(tab);
  return match ? match[1] : 'overview';
}

// ---- filters bar: brand multi-select, category, hide stale returns --------

let brandDd: Dropdown | null = null;
let categoryDd: Dropdown | null = null;
let categoryItems: DropdownItem[] = [];

function applyBrandSelection(selected: Set<string>): void {
  state.hiddenBrands = new Set(BRANDS.map(brand => brand.repo).filter(repo => !selected.has(repo)));
  persistViewFilters();
  render();
}

function applyCategorySelection(selected: Set<string>): void {
  state.hiddenCategories = new Set(categoryItems.map(item => item.id).filter(name => !selected.has(name)));
  persistViewFilters();
  render();
}

function filterSummary(selected: number, total: number): string {
  return selected === total ? `${selected} of ${total}` : `${selected} selected`;
}

function renderFilters(): void {
  const brandCount = BRANDS.length - state.hiddenBrands.size;
  const brandsFiltered = brandCount < BRANDS.length;
  el.brandSummary.textContent = filterSummary(brandCount, BRANDS.length);
  el.brandBadge.hidden = !brandsFiltered;
  el.brandBadge.textContent = `${brandCount}/${BRANDS.length}`;
  el.brandBtn.classList.toggle('is-filtered', brandsFiltered);
  if (document.activeElement !== el.staleDays) el.staleDays.value = String(state.staleDays);
  el.staleToggle.checked = state.hideStale;

  const sig = [store ? store.version : 0, hiddenBrandsSig(), blacklistVersion, hiddenCategoriesSig()].join('|');
  if (sig === filtersSig) return;
  filtersSig = sig;
  const items: DropdownItem[] = [];
  if (store) {
    const counts = new Map<number, number>();
    baseIds().forEach(id => counts.set(store ? store.catId[id] : 0, (counts.get(store ? store.catId[id] : 0) || 0) + 1));
    store.categories.forEach((name: string, cid: number) => {
      items.push({ id: name, label: name || '(no category)', count: counts.get(cid) || 0, selected: !state.hiddenCategories.has(name) });
    });
    items.sort((a, b) => collator.compare(a.id || '~', b.id || '~'));
  }
  categoryItems = items;
  const selected = items.filter(item => item.selected);
  const filtered = selected.length < items.length;
  el.categoryBtn.classList.toggle('is-filtered', filtered);
  el.categoryBadge.hidden = !filtered;
  el.categoryBadge.textContent = `${selected.length}/${items.length}`;
  el.categorySummary.textContent = items.length ? (selected.length === 1 ? selected[0].label : filterSummary(selected.length, items.length)) : '...';
  categoryDd?.refresh();
}

function brandDropdownItems(): DropdownItem[] {
  return BRANDS.map((brand, i) => {
    const status = brandStatus[i];
    const badge = status === 'error'
      ? `<span class="text-[0.65rem] px-1.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-700/50" title="${escapeHtml(brandError[i])}">unavailable</span>`
      : status === 'cached'
        ? `<span class="text-[0.65rem] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50" title="${escapeHtml(brandError[i] || 'showing cached data, revalidation pending')}">cached</span>`
        : status === 'pending'
          ? '<span class="text-[0.65rem] text-slate-400">loading…</span>'
          : '';
    const remoteBadge = API_MODE === 'local' && remoteFallback.has(brand.repo)
      ? '<span class="text-[0.65rem] px-1.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-700/50" title="Sibling folder not found locally; served from GitHub Pages">remote</span>'
      : '';
    return {
      id: brand.repo,
      label: brand.brand,
      count: brandFunds[i].length,
      selected: !state.hiddenBrands.has(brand.repo),
      badges: remoteBadge + badge,
    };
  });
}

function renderBrandList(): void {
  const sig = [
    brandStatus.join(','), brandFunds.map(list => list.length).join(','), hiddenBrandsSig(), [...remoteFallback].join(','),
  ].join('|');
  if (sig === brandListSig) return;
  brandListSig = sig;
  brandDd?.refresh();
}

// ---- filter dropdowns: one reusable MultiSelect (brands, categories) -------

type DropdownItem = { id: string; label: string; count: number; selected: boolean; badges?: string };

type Dropdown = { refresh(): void; open(query?: string): void; close(restoreFocus?: boolean): void; isOpen(): boolean };

type DropdownConfig = {
  trigger: any;
  panel: any;
  title: string; // "Brands"
  noun: string; // "brands", used in the search placeholder and the empty state
  unit: string; // what the row number counts: "funds" or "ETFs"
  getItems(): DropdownItem[];
  /** Receives the complete new selection; the owner persists it and re-renders. */
  onChange(selected: Set<string>): void;
};

const DD_TICK = '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7"/></svg>';

/**
 * Accessible multi-select popover. Layout, top to bottom: search field (first
 * line, autofocused), bulk actions (All / Clear / Toggle / Reset),
 * counts + "Selected only", the scrollable option list. The selection lives in
 * the owner's state and is independent of the search text: the search only
 * decides which rows are visible, bulk actions touch only the visible rows and
 * merge with the rest, Reset restores "everything selected".
 * Keyboard (focus stays in the search input; combobox + aria-activedescendant):
 * Up/Down/PageUp/PageDown move, Enter toggles the active row (Shift+Enter =
 * Only), Space toggles while the search is empty, Ctrl/Cmd+A selects all visible,
 * Esc clears the search, then closes and refocuses the trigger. Typing on the
 * closed trigger opens the list with that text as the query. Under 640px the
 * panel is a bottom sheet with a backdrop (see .dd-panel in index.html).
 */
function createDropdown(cfg: DropdownConfig): Dropdown {
  const { trigger, panel } = cfg;
  const uid = panel.id;
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', cfg.title);
  panel.innerHTML = `
    <div class="dd-search">
      <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="9" cy="9" r="5.5"/><path d="m13.5 13.5 3.5 3.5"/></svg>
      <input type="text" class="dd-input" role="combobox" aria-expanded="true" aria-autocomplete="list" aria-controls="${uid}-list" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Search ${escapeHtml(cfg.noun)}..." aria-label="Search ${escapeHtml(cfg.noun)}" />
      <button type="button" class="dd-qclear" hidden aria-label="Clear search" tabindex="-1">✕</button>
      <button type="button" class="dd-close" aria-label="Close ${escapeHtml(cfg.title)}">✕</button>
    </div>
    <div class="dd-actions" role="group" aria-label="Bulk actions for the shown ${escapeHtml(cfg.noun)}">
      <button type="button" class="dd-act" data-act="all" title="Select every shown row (Ctrl/Cmd+A)">All</button>
      <button type="button" class="dd-act" data-act="none" title="Deselect every shown row">Clear</button>
      <button type="button" class="dd-act" data-act="toggle" title="Invert the selection of the shown rows">Toggle</button>
      <button type="button" class="dd-act" data-act="reset" title="Back to the default: everything selected, whatever the search">Reset</button>
    </div>
    <div class="dd-meta">
      <span class="dd-count" aria-live="polite"></span>
      <button type="button" class="dd-seltoggle" aria-pressed="false" title="Show only the rows selected so far">Selected only</button>
    </div>
    <div class="dd-list themed-scroll" id="${uid}-list" tabindex="-1" role="listbox" aria-multiselectable="true" aria-label="${escapeHtml(cfg.title)}"></div>`;
  const backdrop = document.createElement('div');
  backdrop.className = 'dd-backdrop';
  // Portal both to <body>: no ancestor stacking context or overflow can cover or clip the popover.
  document.body.appendChild(backdrop);
  document.body.appendChild(panel);
  const input: any = panel.querySelector('.dd-input');
  const list: any = panel.querySelector('.dd-list');
  const count: any = panel.querySelector('.dd-count');
  const qClear: any = panel.querySelector('.dd-qclear');
  const selToggle: any = panel.querySelector('.dd-seltoggle');

  let isOpen = false;
  let query = '';
  let selectedOnly = false;
  let activeId: string | null = null;
  let shown: DropdownItem[] = [];
  let closeTimer: any = 0;

  const optionId = (index: number) => `${uid}-o${index}`;
  const inRoot = (node: any) => Boolean(node && (panel.contains(node) || trigger.contains(node) || backdrop.contains(node)));

  function matches(item: DropdownItem): boolean {
    if (selectedOnly && !item.selected) return false;
    const tokens = normalizeSearchText(query).split(/\s+/).filter(Boolean);
    if (!tokens.length) return true;
    const text = normalizeSearchText(item.label);
    return tokens.every(token => text.includes(token));
  }

  function paintActive(scroll: boolean): void {
    const rows: any[] = [...list.querySelectorAll('.dd-opt')];
    let activeEl: any = null;
    rows.forEach(row => {
      const on = row.dataset.id === activeId;
      row.classList.toggle('is-active', on);
      if (on) activeEl = row;
    });
    if (activeEl) input.setAttribute('aria-activedescendant', activeEl.id);
    else input.removeAttribute('aria-activedescendant');
    if (scroll && activeEl) {
      const top = activeEl.offsetTop - list.offsetTop;
      if (top < list.scrollTop) list.scrollTop = top - 6;
      else if (top + activeEl.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = top + activeEl.offsetHeight - list.clientHeight + 6;
    }
  }

  function refresh(): void {
    const all = cfg.getItems();
    shown = all.filter(matches);
    if (!shown.some(item => item.id === activeId)) activeId = shown.length ? shown[0].id : null;
    const keepScroll = list.scrollTop;
    list.innerHTML = shown.length
      ? shown.map((item, i) => `
        <div class="dd-opt${item.count === 0 ? ' dd-zero' : ''}" role="option" id="${optionId(i)}" data-id="${escapeHtml(item.id)}" aria-selected="${item.selected}">
          <span class="dd-check">${DD_TICK}</span>
          <span class="dd-name" title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</span>
          ${item.badges || ''}
          <span class="dd-num" title="${escapeHtml(cfg.unit)}">${item.count}</span>
          <button type="button" class="dd-only" data-only tabindex="-1" aria-label="Only ${escapeHtml(item.label)}">Only</button>
        </div>`).join('')
      : `<div class="dd-empty">${selectedOnly && !query.trim() ? `Nothing selected` : `No ${escapeHtml(cfg.noun)} match “${escapeHtml(query.trim())}”`}</div>`;
    list.scrollTop = keepScroll;
    const selectedTotal = all.filter(item => item.selected).length;
    const narrowed = Boolean(query.trim()) || selectedOnly;
    count.textContent = `${selectedTotal} of ${all.length} selected${narrowed ? ` · ${shown.filter(item => item.selected).length} of ${shown.length} shown` : ''}`;
    qClear.hidden = !query;
    selToggle.setAttribute('aria-pressed', String(selectedOnly));
    selToggle.classList.toggle('is-on', selectedOnly);
    paintActive(false);
  }

  function apply(op: 'all' | 'none' | 'toggle' | 'reset' | 'flip' | 'only', id = ''): void {
    const all = cfg.getItems();
    let next = new Set(all.filter(item => item.selected).map(item => item.id));
    const visible = shown.map(item => item.id);
    if (op === 'all') visible.forEach(v => next.add(v));
    else if (op === 'none') visible.forEach(v => next.delete(v));
    else if (op === 'toggle') visible.forEach(v => { if (next.has(v)) next.delete(v); else next.add(v); });
    else if (op === 'reset') next = new Set(all.map(item => item.id));
    else if (op === 'flip') { if (next.has(id)) next.delete(id); else next.add(id); }
    else if (op === 'only') next = new Set([id]);
    cfg.onChange(next);
    refresh();
  }

  function place(): void {
    panel.style.left = '';
    panel.style.top = '';
    panel.style.bottom = '';
    panel.style.maxHeight = '';
    if (window.matchMedia('(max-width: 639px)').matches) return; // bottom sheet, positioned by CSS
    const rect = trigger.getBoundingClientRect();
    const width = panel.offsetWidth;
    const natural = panel.offsetHeight;
    const below = window.innerHeight - rect.bottom - 16;
    const above = rect.top - 16;
    const flip = below < Math.min(natural, 360) && above > below;
    panel.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
    panel.style.maxHeight = `${Math.max(180, flip ? above : below) - 8}px`;
    if (flip) {
      panel.style.top = 'auto';
      panel.style.bottom = `${window.innerHeight - rect.top + 8}px`;
      panel.style.transformOrigin = 'bottom left';
    } else {
      panel.style.top = `${rect.bottom + 8}px`;
      panel.style.transformOrigin = 'top left';
    }
  }

  function open(initialQuery = ''): void {
    if (isOpen) return;
    isOpen = true;
    clearTimeout(closeTimer);
    query = initialQuery;
    selectedOnly = false;
    input.value = initialQuery;
    const firstSelected = cfg.getItems().find(item => item.selected && matches(item));
    activeId = firstSelected ? firstSelected.id : null;
    refresh();
    panel.hidden = false;
    place();
    void panel.offsetWidth; // reflow so the transition starts from the closed state
    panel.classList.add('is-open');
    backdrop.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    input.focus({ preventScroll: true });
    input.setSelectionRange(input.value.length, input.value.length);
    const row: any = [...list.querySelectorAll('.dd-opt')].find((r: any) => r.dataset.id === activeId);
    if (row) list.scrollTop = Math.max(0, row.offsetTop - list.offsetTop - list.clientHeight / 3);
    paintActive(false);
  }

  function close(restoreFocus = false): void {
    if (!isOpen) return;
    isOpen = false;
    panel.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) trigger.focus({ preventScroll: true });
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => { if (!isOpen) panel.hidden = true; }, reduceMotion() ? 0 : 200);
  }

  function move(delta: number): void {
    if (!shown.length) return;
    const index = shown.findIndex(item => item.id === activeId);
    const next = index < 0 ? (delta > 0 ? 0 : shown.length - 1) : (index + delta + shown.length) % shown.length;
    activeId = shown[next].id;
    paintActive(true);
  }

  function setQuery(value: string): void {
    query = value;
    list.scrollTop = 0;
    refresh();
  }

  trigger.addEventListener('click', () => { if (isOpen) close(); else open(); });
  trigger.addEventListener('keydown', (event: any) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); open(); }
    else if (event.key.length === 1 && event.key !== ' ') { event.preventDefault(); open(event.key); }
  });
  input.addEventListener('input', () => setQuery(input.value));
  input.addEventListener('keydown', (event: any) => {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      apply('all');
      return;
    }
    switch (event.key) {
      case 'ArrowDown': event.preventDefault(); move(1); break;
      case 'ArrowUp': event.preventDefault(); move(-1); break;
      case 'PageDown': event.preventDefault(); move(8); break;
      case 'PageUp': event.preventDefault(); move(-8); break;
      case 'Enter':
        event.preventDefault();
        if (activeId !== null && shown.some(item => item.id === activeId)) apply(event.shiftKey ? 'only' : 'flip', activeId);
        break;
      case ' ':
        if (!input.value && activeId !== null) { event.preventDefault(); apply('flip', activeId); }
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        if (input.value) { input.value = ''; setQuery(''); } else close(true);
        break;
      default:
    }
  });
  panel.addEventListener('keydown', (event: any) => {
    if (event.key === 'Escape' && event.target !== input) { event.preventDefault(); event.stopPropagation(); close(true); }
  });
  list.addEventListener('mousedown', (event: any) => event.preventDefault()); // keep focus in the search field
  list.addEventListener('pointermove', (event: any) => {
    const row = event.target.closest && event.target.closest('.dd-opt');
    if (row && row.dataset.id !== activeId) { activeId = row.dataset.id; paintActive(false); }
  });
  list.addEventListener('click', (event: any) => {
    const row = event.target.closest && event.target.closest('.dd-opt');
    if (!row) return;
    apply(event.target.closest('[data-only]') ? 'only' : 'flip', row.dataset.id);
  });
  qClear.addEventListener('mousedown', (event: any) => event.preventDefault());
  qClear.addEventListener('click', () => { input.value = ''; setQuery(''); input.focus(); });
  panel.querySelector('.dd-close').addEventListener('click', () => close(true));
  backdrop.addEventListener('click', () => close());
  selToggle.addEventListener('click', () => { selectedOnly = !selectedOnly; list.scrollTop = 0; refresh(); input.focus({ preventScroll: true }); });
  panel.querySelectorAll('[data-act]').forEach((button: any) => {
    button.addEventListener('click', () => apply(button.dataset.act));
  });
  panel.addEventListener('focusout', (event: any) => {
    if (isOpen && event.relatedTarget && !inRoot(event.relatedTarget)) close();
  });
  document.addEventListener('pointerdown', (event: any) => {
    if (isOpen && !inRoot(event.target)) close();
  });
  window.addEventListener('resize', () => { if (isOpen) place(); });
  window.addEventListener('scroll', () => { if (isOpen) place(); }, { passive: true, capture: true });
  // The panel lives at the end of <body>, so Tab at its edges hands focus back to the page order around the trigger.
  panel.addEventListener('keydown', (event: any) => {
    if (event.key !== 'Tab') return;
    const focusable = [...panel.querySelectorAll('input, button')].filter((node: any) => node.tabIndex >= 0 && node.offsetParent !== null);
    if (!focusable.length) return;
    const edge = event.shiftKey ? focusable[0] : focusable[focusable.length - 1];
    if (event.target !== edge) return;
    event.preventDefault();
    close();
    if (event.shiftKey) { trigger.focus({ preventScroll: true }); return; }
    const page = [...document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')]
      .filter((node: any) => !panel.contains(node) && node.tabIndex >= 0 && !node.disabled && (node.offsetParent !== null || node === trigger));
    const next: any = page[page.indexOf(trigger) + 1];
    if (next) next.focus();
  });

  return { refresh, open, close, isOpen: () => isOpen };
}

// ---- one custom tooltip for the whole app (top layer) -------------------------

/**
 * Replaces native `title` tooltips (which the layout can neither style nor keep
 * above popovers) with a single fixed element appended to <body> and sitting at
 * the highest z-index. Works by delegation, so rows and headers that re-render
 * need no wiring: on first hover or keyboard focus a `title` moves to `data-tip`
 * (and becomes the aria-label of an icon-only control). Shown after a short
 * hover delay or immediately on keyboard focus, flipped above the element when
 * there is no room below, clamped to the viewport, hidden on Esc, scroll or press.
 */
function initTooltips(): void {
  const tip = document.createElement('div');
  tip.id = 'hub-tooltip';
  tip.className = 'hub-tip';
  tip.setAttribute('role', 'tooltip');
  document.body.appendChild(tip);
  let current: any = null;
  let timer: any = 0;
  let pointerX = 0;

  const textOf = (node: any): string => {
    const title = node.getAttribute('title');
    if (title) {
      node.setAttribute('data-tip', title);
      node.removeAttribute('title');
      if (!node.hasAttribute('aria-label') && !(node.textContent || '').trim()) node.setAttribute('aria-label', title);
    }
    return node.getAttribute('data-tip') || '';
  };
  const targetOf = (node: any): any => (node && typeof node.closest === 'function' ? node.closest('[title], [data-tip]') : null);

  function hide(): void {
    clearTimeout(timer);
    if (current) current.removeAttribute('aria-describedby');
    current = null;
    tip.classList.remove('is-open');
  }

  function show(node: any): void {
    const text = textOf(node);
    if (!text || !document.contains(node)) { hide(); return; }
    current = node;
    node.setAttribute('aria-describedby', 'hub-tooltip');
    tip.textContent = text;
    tip.style.left = '0px';
    tip.style.top = '0px';
    const rect = node.getBoundingClientRect();
    const width = tip.offsetWidth;
    const height = tip.offsetHeight;
    const anchor = rect.width > 240 && pointerX >= rect.left && pointerX <= rect.right ? pointerX : rect.left + rect.width / 2;
    const left = Math.max(8, Math.min(anchor - width / 2, window.innerWidth - width - 8));
    let top = rect.bottom + 8;
    if (top + height > window.innerHeight - 8) top = rect.top - height - 8;
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(8, top)}px`;
    tip.classList.add('is-open');
  }

  document.addEventListener('pointerover', (event: any) => {
    if (event.pointerType === 'touch') return;
    pointerX = event.clientX;
    const node = targetOf(event.target);
    if (node === current && tip.classList.contains('is-open')) return;
    hide();
    if (node) { textOf(node); timer = setTimeout(() => show(node), 350); }
  });
  document.addEventListener('pointerout', (event: any) => {
    if (current && !current.contains(event.relatedTarget)) hide();
    else if (!current) clearTimeout(timer);
  });
  document.addEventListener('focusin', (event: any) => {
    const node = targetOf(event.target);
    if (node && typeof node.matches === 'function' && node.matches(':focus-visible')) { hide(); show(node); }
  });
  document.addEventListener('focusout', hide);
  document.addEventListener('keydown', (event: any) => { if (event.key === 'Escape') hide(); });
  document.addEventListener('pointerdown', hide);
  // A scroll hides an open tooltip but must not cancel one still waiting for its hover delay (layout code scrolls on its own).
  window.addEventListener('scroll', () => { if (tip.classList.contains('is-open')) hide(); }, { passive: true, capture: true });
  window.addEventListener('resize', hide);
}

// ---- facet suggestions under the main search input ---------------------------

type Suggestion = { kind: 'brand' | 'category'; id: string; label: string; count: number; selected: boolean };

/**
 * While the user types a word in the catalog search, offers the matching brand
 * and category values (with fund counts). Picking one adds it to the same
 * selection the checkbox dropdowns edit (or selects only it while nothing is
 * filtered yet; Shift+Enter or the "Only" button always means only it) and
 * removes the typed word. Down/Up move (nothing is active until then, so plain
 * typing and Enter are untouched), Enter picks, Esc closes.
 */
function initSearchSuggest(): void {
  const input = el.searchInput;
  const panel = el.searchSuggest;
  let items: Suggestion[] = [];
  let term: SearchTerm | null = null;
  let active = -1;

  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', 'search-suggest');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('title', 'Words are ANDed across ticker, name, brand, category, basis and exchange. Use brand:vaneck, category:"fixed income", ticker:spy, basis:official to target one field.');

  const isOpen = () => !panel.hidden;
  function close(): void {
    items = [];
    active = -1;
    panel.hidden = true;
    panel.classList.remove('is-open');
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  function paint(): void {
    panel.innerHTML = items.map((item, i) => `
      <div class="dd-opt${i === active ? ' is-active' : ''}" role="option" id="sg-o${i}" data-i="${i}" aria-selected="${item.selected}">
        <span class="sg-kind sg-${item.kind}">${item.kind === 'brand' ? 'Brand' : 'Category'}</span>
        <span class="dd-name" title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</span>
        <span class="dd-num" title="${item.kind === 'brand' ? 'funds' : 'ETFs'}">${item.count}</span>
        <button type="button" class="dd-only" data-only tabindex="-1" aria-label="Only ${escapeHtml(item.label)}">Only</button>
      </div>`).join('') + '<div class="sg-hint">Enter adds to the selection, Shift+Enter shows only this</div>';
    if (active >= 0) input.setAttribute('aria-activedescendant', `sg-o${active}`);
    else input.removeAttribute('aria-activedescendant');
  }

  function update(): void {
    close();
    if (!isEtfCatalogTab(state.activeTab) || !store || document.activeElement !== input) return;
    const terms = parseSearchTerms(input.value);
    const last = terms[terms.length - 1];
    if (!last || last.end !== input.value.trimEnd().length) return; // only the word being typed
    if (last.field && last.field !== 'brand' && last.field !== 'category') return;
    const needle = last.value;
    const rank = (label: string) => (label.toLowerCase().startsWith(needle) ? 0 : 1);
    const pool: Suggestion[] = [];
    if (!last.field || last.field === 'brand') {
      brandDropdownItems().forEach(item => pool.push({ kind: 'brand', id: item.id, label: item.label, count: item.count, selected: item.selected }));
    }
    if (!last.field || last.field === 'category') {
      categoryItems.filter(item => item.id).forEach(item => pool.push({ kind: 'category', id: item.id, label: item.label, count: item.count, selected: item.selected }));
    }
    const matched = pool.filter(item => item.label.toLowerCase().includes(needle));
    const pick = (kind: string) => matched.filter(item => item.kind === kind).sort((a, b) => rank(a.label) - rank(b.label) || b.count - a.count || collator.compare(a.label, b.label)).slice(0, 5);
    items = [...pick('brand'), ...pick('category')];
    if (!items.length) return;
    term = last;
    paint();
    panel.hidden = false;
    void panel.offsetWidth;
    panel.classList.add('is-open');
    input.setAttribute('aria-expanded', 'true');
  }

  function choose(index: number, only: boolean): void {
    const item = items[index];
    if (!item || !term) return;
    const kindItems = item.kind === 'brand' ? brandDropdownItems() : categoryItems;
    const current = new Set(kindItems.filter(entry => entry.selected).map(entry => entry.id));
    const everything = current.size === kindItems.length;
    const next = only || everything ? new Set([item.id]) : new Set([...current, item.id]);
    const value = input.value;
    input.value = `${value.slice(0, term.start)}${value.slice(term.end)}`.replace(/\s{2,}/g, ' ').trimStart();
    setCurrentQuery(input.value.trim());
    updateSearchClearBtn();
    close();
    if (item.kind === 'brand') applyBrandSelection(next);
    else applyCategorySelection(next);
    brandDd?.refresh();
    categoryDd?.refresh();
    input.focus();
  }

  input.addEventListener('input', update);
  input.addEventListener('focus', update);
  input.addEventListener('blur', () => close());
  input.addEventListener('keydown', (event: any) => {
    if (!isOpen()) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); active = (active + 1) % items.length; paint(); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); active = active <= 0 ? items.length - 1 : active - 1; paint(); }
    else if (event.key === 'Enter' && active >= 0) { event.preventDefault(); choose(active, event.shiftKey); }
    else if (event.key === 'Escape') { event.preventDefault(); close(); }
    else if (event.key === 'Tab') close();
  });
  panel.addEventListener('mousedown', (event: any) => event.preventDefault()); // keep focus in the input
  panel.addEventListener('pointermove', (event: any) => {
    const row = event.target.closest && event.target.closest('.dd-opt');
    if (row && Number(row.dataset.i) !== active) { active = Number(row.dataset.i); paint(); }
  });
  panel.addEventListener('click', (event: any) => {
    const row = event.target.closest && event.target.closest('.dd-opt');
    if (row) choose(Number(row.dataset.i), Boolean(event.target.closest('[data-only]')));
  });
  el.searchClearBtn.addEventListener('click', close);
}


// =========================================================================
// 7. Table rendering, sorting & tooltips
// =========================================================================

function render(): void {
  ensureValidTab();
  updateSearchClearBtn();
  renderTabs();
  renderFilters();
  renderBrandList();
  renderBlacklistPanel();
  animateTableUpdate();
  if (state.activeTab === 'watchlist') renderWatchlistTable();
  else if (isDetailTab(state.activeTab)) renderDetailTable(detailTabKey(state.activeTab));
  else renderFundsTable();
  fitTableHeight();
  renderStaticLoadSentinel();
}

function animateTableUpdate(): void {
  el.tableBody.classList.remove('table-content-enter');
  void el.tableBody.offsetWidth; // reflow to restart the animation
  el.tableBody.classList.add('table-content-enter');
}

function currentQuery(): string {
  return state.queryByTab[state.activeTab] || '';
}

function setCurrentQuery(value: string): void {
  if (value) state.queryByTab[state.activeTab] = value;
  else delete state.queryByTab[state.activeTab];
  persistSearches();
}

function saveActiveTabQuery(): void {
  const query = (el.searchInput.value || '').trim();
  if (query) state.queryByTab[state.activeTab] = query;
  else delete state.queryByTab[state.activeTab];
  persistSearches();
}

function updateSearchClearBtn(): void {
  el.searchClearBtn.classList.toggle('hidden', !el.searchInput.value);
}

function syncSearchInput(): void {
  const query = currentQuery();
  if (document.activeElement !== el.searchInput && el.searchInput.value !== query) {
    el.searchInput.value = query;
  }
  el.searchInput.placeholder = isEtfCatalogTab(state.activeTab)
    ? 'Search ticker, name, brand, category... or brand:vaneck'
    : `Search ${tabLabel(state.activeTab)}...`;
  updateSearchClearBtn();
}

function filterRows(rows: any[]): any[] {
  const tokens = normalizeSearchText(currentQuery()).split(/\s+/).filter(Boolean);
  if (!tokens.length) return rows;
  return rows.filter(row => {
    const text = String(row.searchIndex || '');
    return tokens.every(token => text.includes(token));
  });
}

function isEmptyValue(value: unknown): boolean {
  return value === null || value === undefined || value === '' || value === DASH || value === '—' || value === '-' || (typeof value === 'number' && Number.isNaN(value));
}

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const an = numberOrNull(a);
  const bn = numberOrNull(b);
  if (an !== null && bn !== null) return an - bn;
  const as = String(a ?? '');
  const bs = String(b ?? '');
  // History dates ("21-Aug-2026") sort chronologically.
  if (/^\d{1,2}-[A-Za-z]{3}-\d{4}$/.test(as) || /^\d{1,2}-[A-Za-z]{3}-\d{4}$/.test(bs)) {
    const ad = Date.parse(as.replace(/-/g, ' '));
    const bd = Date.parse(bs.replace(/-/g, ' '));
    if (!Number.isNaN(ad) && !Number.isNaN(bd)) return ad - bd;
  }
  return as.localeCompare(bs, undefined, { numeric: true });
}

/** Generic sort for the small tabs (Watchlist, detail sheets); empty values always sort last. */
function sortRows(rows: any[]): any[] {
  if (state.sortKey === 'rank') return rows;
  const direction = state.sortDir === 'asc' ? 1 : -1;
  const key = state.sortKey;
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    const ae = isEmptyValue(av);
    const be = isEmptyValue(bv);
    if (ae || be) return ae && be ? 0 : ae ? 1 : -1;
    return compareValues(av, bv) * direction;
  });
}

function sortHeader(label: string, key: string, numeric = false, extraClass = ''): string {
  const active = state.sortKey === key;
  const arrow = active ? (state.sortDir === 'asc' ? ' ↑' : ' ↓') : '';
  const align = numeric ? ' text-right' : '';
  const tooltip = getHeaderTooltip(label);
  return `<th class="py-3.5 px-4${align}${extraClass ? ' ' + extraClass : ''}" title="${escapeHtml(tooltip)}"><button data-sort="${escapeHtml(key)}" title="${escapeHtml(tooltip)}" class="uppercase tracking-wider hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus:text-blue-600 dark:focus:text-blue-400">${escapeHtml(label)}${arrow}</button></th>`;
}

function indexHeader(): string {
  return `<th class="py-3.5 px-4 w-12 text-center" title="${escapeHtml(getHeaderTooltip('#'))}">#</th>`;
}

function useHeader(): string {
  const ids = catalogIds();
  const keys = store ? store.keys : [];
  const allSelected = ids.length > 0 && ids.every(id => state.selected.has(keys[id]));
  return `<th class="catalog-sticky-col catalog-sticky-use py-3.5 px-4 w-20 text-center" title="${escapeHtml(getHeaderTooltip('Use'))}">
    <div class="inline-flex items-center justify-center gap-1">
      <input type="checkbox" id="select-all-checkbox" ${allSelected ? 'checked' : ''} class="w-4 h-4 accent-blue-600 cursor-pointer" title="Select / Deselect all visible ETFs" />
      <span>Use</span>
    </div>
  </th>`;
}

function bindSortHeaders(): void {
  el.tableHead.querySelectorAll('button[data-sort]').forEach((button: any) => {
    button.addEventListener('click', () => {
      const key = button.dataset.sort || 'rank';
      if (state.sortKey === key) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      else {
        state.sortKey = key;
        state.sortDir = ASC_FIRST_KEYS.includes(key) ? 'asc' : 'desc';
      }
      rememberSortForCurrentTab();
      render();
    });
  });
}

function bindSelectAllCheckbox(): void {
  const checkbox = el.tableHead.querySelector('#select-all-checkbox');
  if (!checkbox) return;
  checkbox.addEventListener('change', (event: any) => {
    event.stopPropagation();
    toggleVisibleSelection(Boolean(event.target.checked));
  });
  checkbox.addEventListener('click', (event: any) => event.stopPropagation());
}

const BASIS_BADGES: Record<string, { label: string; cls: string }> = {
  '1': { label: 'NAV', cls: 'src-official' },
  '2': { label: 'mixed', cls: 'src-mixed' },
  '3': { label: 'derived', cls: 'src-estimate' },
  none: { label: 'n/a', cls: 'src-none' },
};

function sourceBadge(id: number): string {
  if (!store) return '';
  const cls = store.basisCls[id];
  const badge = BASIS_BADGES[Number.isFinite(cls) ? String(cls) : 'none'];
  const metrics = store.raw[id].metrics || {};
  const title = `${metrics.returnsBasis || 'unavailable'}${metrics.performanceAsOf ? ` (as of ${metrics.performanceAsOf})` : ''}`;
  return `<span class="src-badge ${badge.cls}" title="${escapeHtml(title)}">${badge.label}</span>`;
}

function fundRowHtml(id: number, index: number): string {
  const s = store;
  if (!s) return '';
  const raw = s.raw[id];
  const key = s.keys[id];
  const selected = state.selected.has(key);
  const metrics = raw.metrics || {};
  const num = s.num;
  const numCls = 'py-2.5 px-4 text-right font-mono text-slate-700 dark:text-slate-300';
  const pct = (name: string): string => `<td class="${numCls}">${formatPercent(num[name][id])}</td>`;
  const stale = isStaleId(id);
  const asOf = metrics.performanceAsOf || '';
  return `
        <tr data-key="${escapeHtml(key)}" class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition border-b border-slate-100 dark:border-slate-700/30 ${selected ? 'selected-row' : ''}">
          <td class="py-2.5 px-4 text-slate-400 dark:text-slate-500 text-xs text-center font-mono">${index + 1}</td>
          <td class="catalog-sticky-col catalog-sticky-use py-2.5 px-4 text-center">
            <div class="inline-flex items-center justify-center gap-1.5">
              <input data-checkbox="${escapeHtml(key)}" type="checkbox" ${selected ? 'checked' : ''} class="w-4 h-4 accent-blue-600 cursor-pointer" aria-label="Use ${escapeHtml(s.ticker[id])}" />
              <button data-blacklist="${escapeHtml(key)}" class="w-4 h-4 rounded text-slate-300 dark:text-slate-600 hover:text-rose-500 dark:hover:text-rose-400 leading-none transition" title="Blacklist ${escapeHtml(s.ticker[id])} - hide it from All ETFs">✕</button>
            </div>
          </td>
          <td class="catalog-sticky-col catalog-sticky-ticker py-2.5 px-4 font-mono font-semibold text-blue-600 dark:text-blue-400">${escapeHtml(s.ticker[id])}</td>
          <td class="py-2.5 px-4 text-slate-600 dark:text-slate-300" title="${escapeHtml(BRANDS[s.brandIdx[id]].repo)}">${escapeHtml(s.brandText[id])}</td>
          <td class="py-2.5 px-4 text-slate-700 dark:text-slate-300 font-medium" title="${escapeHtml(s.name[id])}">${escapeHtml(s.name[id])}</td>
          <td class="py-2.5 px-4 text-slate-600 dark:text-slate-300">${escapeHtml(s.categoryText[id] || DASH)}</td>
          <td class="${numCls}">${escapeHtml(raw.nav || DASH)}</td>
          <td class="${numCls}">${formatMoney(num.aumValue[id])}</td>
          <td class="${numCls}">${escapeHtml(raw.ter || DASH)}</td>
          ${pct('dividendYield')}
          ${pct('secYield')}
          <td class="py-2.5 px-4 text-slate-700 dark:text-slate-300">${escapeHtml(s.freqText[id] || DASH)}</td>
          ${pct('ytd')}
          ${pct('tr1y')}
          ${pct('tr3y')}
          ${pct('tr5y')}
          ${pct('tr10y')}
          ${pct('cagr3y')}
          ${pct('cagr5y')}
          ${pct('cagr10y')}
          ${pct('siAnn')}
          <td class="py-2.5 px-4">${sourceBadge(id)}</td>
          <td class="py-2.5 px-4 font-mono ${stale ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400'}"${stale ? ` title="${asOf ? 'Returns are older than ' + state.staleDays + ' days' : 'Return as-of date is unknown'}"` : ''}>${escapeHtml(asOf || DASH)}</td>
          <td class="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400">${escapeHtml(raw.inceptionDate || DASH)}</td>
          <td class="${numCls}">${formatInteger(num.holdings[id])}</td>
          <td class="${numCls}">${formatInteger(num.history[id])}</td>
          <td class="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400">${escapeHtml(raw.asOfDate || DASH)}</td>
        </tr>
      `;
}

const CATALOG_COLSPAN = 27;

function catalogMoreRowHtml(remaining: number): string {
  return `<tr id="catalog-more-row" class="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition"><td colspan="${CATALOG_COLSPAN}" class="py-3 text-center text-xs text-slate-400 dark:text-slate-500">Scroll or click to load more rows… (${remaining.toLocaleString('en-US')} remaining)</td></tr>`;
}

/** Scroll/click extension of the mounted catalog chunk (bounded DOM, rows appended in place). */
function growCatalogChunk(): void {
  if (state.activeTab !== 'All') return;
  const ids = catalogVisibleIds;
  const from = Math.min(ids.length, catalogRenderedCount);
  if (from >= ids.length) return;
  const to = Math.min(ids.length, from + CATALOG_CHUNK);
  catalogRenderedCount = to;
  const more = el.tableBody.querySelector('#catalog-more-row');
  if (more) more.remove();
  let html = '';
  for (let i = from; i < to; i++) html += fundRowHtml(ids[i], i);
  if (to < ids.length) html += catalogMoreRowHtml(ids.length - to);
  el.tableBody.insertAdjacentHTML('beforeend', html);
}

function renderFundsTable(): void {
  const ids = catalogIds();
  catalogVisibleIds = ids;
  const sig = [state.sortKey, state.sortDir, catalogQuery(), hiddenCategoriesSig(), hiddenBrandsSig(), state.hideStale, state.staleDays, store ? store.version : 0, blacklistVersion].join('|');
  if (sig !== catalogChunkSig) {
    catalogChunkSig = sig;
    catalogRenderedCount = CATALOG_CHUNK;
  }
  const mounted = Math.min(ids.length, catalogRenderedCount);

  el.tableHead.innerHTML = `
    <tr>
      ${indexHeader()}
      ${useHeader()}
      ${sortHeader('Ticker', 'ticker', false, 'catalog-sticky-col catalog-sticky-ticker')}
      ${sortHeader('Brand', 'brand')}
      ${sortHeader('Fund Name', 'name')}
      ${sortHeader('Type', 'category')}
      ${sortHeader('NAV', 'navValue', true)}
      ${sortHeader('Net Assets', 'aumValue', true)}
      ${sortHeader('Expense', 'terValue', true)}
      ${sortHeader('Dividend Yield', 'dividendYield', true)}
      ${sortHeader('SEC Yield', 'secYield', true)}
      ${sortHeader('Frequency', 'dividendFrequency')}
      ${sortHeader('YTD Return', 'ytd', true)}
      ${sortHeader('TR 1Y', 'tr1y', true)}
      ${sortHeader('TR 3Y', 'tr3y', true)}
      ${sortHeader('TR 5Y', 'tr5y', true)}
      ${sortHeader('TR 10Y', 'tr10y', true)}
      ${sortHeader('CAGR 3Y', 'cagr3y', true)}
      ${sortHeader('CAGR 5Y', 'cagr5y', true)}
      ${sortHeader('CAGR 10Y', 'cagr10y', true)}
      ${sortHeader('SI Ann.', 'siAnn', true)}
      ${sortHeader('Source', 'basisCls')}
      ${sortHeader('Return As Of', 'perfTs')}
      ${sortHeader('Inception', 'inceptionTs')}
      ${sortHeader('Holdings', 'holdings', true)}
      ${sortHeader('History', 'history', true)}
      ${sortHeader('As Of', 'asOfTs')}
    </tr>
  `;
  bindSortHeaders();
  bindSelectAllCheckbox();

  if (!ids.length) {
    const message = !store
      ? (state.loading ? `Loading ETF catalogs of ${BRANDS.length} brands…` : 'No brand feed could be loaded. Check the network or serve this folder next to the cloned sibling repositories (bunx serve . -p 1234).')
      : 'No ETFs match your search and filters.';
    el.tableBody.innerHTML = `<tr><td colspan="${CATALOG_COLSPAN}" class="py-12 text-center text-slate-400 dark:text-slate-500">${escapeHtml(message)}</td></tr>`;
  } else {
    let html = '';
    for (let i = 0; i < mounted; i++) html += fundRowHtml(ids[i], i);
    if (mounted < ids.length) html += catalogMoreRowHtml(ids.length - mounted);
    el.tableBody.innerHTML = html;
  }

  const selected = selectedKeys().length;
  const queryText = catalogQuery() ? ` matching “${catalogQuery()}”` : '';
  setStatus(`Showing ${ids.length} ETF${ids.length === 1 ? '' : 's'}${queryText}.${selected ? ` ${selected} selected.` : ' No ETFs selected yet.'}`, selected ? 'success' : 'info');
  el.tickerCount.textContent = `${ids.length.toLocaleString('en-US')} ETFs`;
  renderSubtitle();
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

type HoldingPosition = { fund: string; name: string; identifier: string; weight: number; cells: Record<string, unknown> };

const MISSING_TOKENS = new Set(['', '-', '--', '—', '–', 'N/A', 'NA', 'NONE', 'NULL']);

/**
 * Treats blank / dash / N/A-style placeholders as missing. All-zero CUSIPs
 * also count as missing, so identifier-less rows fall through to the name
 * instead of collapsing into one garbage key.
 */
function cleanKeyPart(value: unknown): string {
  const text = String(value ?? '').trim();
  if (!text || MISSING_TOKENS.has(text.toUpperCase())) return '';
  if (/^0+$/.test(text)) return '';
  return text.toUpperCase();
}

/** First cell among `names` whose value is not blank or a dash placeholder. */
function firstCell(cells: Record<string, unknown>, names: string[]): unknown {
  for (const name of names) {
    const value = cells[name];
    if (value !== undefined && value !== null && !MISSING_TOKENS.has(String(value).trim().toUpperCase())) return value;
  }
  return '';
}

/**
 * Dedupe key fallback order: Ticker -> CUSIP -> ISIN -> Identifier/Security ID
 * -> SEDOL/FIGI -> Name. Keys are namespaced (T:/C:/I:/D:/S:/N:) so identifier
 * values can never collide with tickers. The same ticker held by funds of
 * different brands lands in one Watchlist row.
 */
function positionDedupeKey(row: Record<string, unknown>): { key: string; shown: string } | null {
  const first = (...values: unknown[]): string => {
    for (const value of values) {
      const clean = cleanKeyPart(value);
      if (clean) return clean;
    }
    return '';
  };
  const ticker = first(row.Ticker, row.Symbol);
  if (ticker) return { key: `T:${ticker}`, shown: ticker };
  const cusip = first(row.CUSIP);
  if (cusip) return { key: `C:${cusip}`, shown: cusip };
  const isin = first(row.ISIN);
  if (isin) return { key: `I:${isin}`, shown: isin };
  const identifier = first(row.Identifier, row['Security ID']);
  if (identifier) return { key: `D:${identifier}`, shown: identifier };
  const sedol = first(row.SEDOL, row.FIGI);
  if (sedol) return { key: `S:${sedol}`, shown: sedol };
  const name = String(row.Name ?? row['Security Name'] ?? '').trim();
  if (name) return { key: `N:${name.toUpperCase()}`, shown: name };
  return null;
}

function sheetPositions(key: string): HoldingPosition[] {
  const entry = sheetState.get(`${key}:holdings`);
  if (!entry || !entry.headers.length) return [];
  return entry.rows.map(row => {
    const cells: Record<string, unknown> = {};
    entry.headers.forEach((header, index) => {
      if (header) cells[header] = row[index] ?? '';
    });
    // Brands name the weight column differently ('Weight', 'Weight (%)', 'Market Weight').
    const weight = numberOrNull(firstCell(cells, ['Weight', 'Weight (%)', 'Market Weight', 'Market Value Percentage']));
    const rawIdentifier = String(firstCell(cells, ['Identifier', 'CUSIP', 'ISIN', 'SEDOL', 'Security ID'])).trim();
    return {
      fund: key,
      name: String(firstCell(cells, ['Name', 'Security Name', 'Description'])).trim(),
      identifier: cleanKeyPart(rawIdentifier) ? rawIdentifier : '',
      weight: weight === null ? 0 : weight,
      cells,
    };
  });
}

let watchlistCache: { signature: string; rows: WatchlistRow[] } | null = null;

function getDedupedWatchlistRows(): WatchlistRow[] {
  // Memoized: recomputed only when the selection or the loaded row counts change.
  const keys = selectedKeys().sort();
  const signature =
    keys.join('|') +
    '#' +
    keys.map(key => (sheetState.get(`${key}:holdings`)?.rows.length ?? 0)).join(',');
  if (watchlistCache && watchlistCache.signature === signature) return watchlistCache.rows;

  const map: Map<string, WatchlistRow> = new Map();
  keys.forEach(fundKeyValue => {
    sheetPositions(fundKeyValue).forEach(position => {
      const resolved = positionDedupeKey(position.cells);
      if (!resolved) return;
      let row = map.get(resolved.key);
      if (!row) {
        row = {
          key: resolved.key,
          symbol: resolved.shown,
          name: position.name,
          funds: [],
          fundCount: 0,
          weightSum: 0,
          maxWeight: 0,
          cusips: [],
          identifier: '',
          searchIndex: '',
        };
        map.set(resolved.key, row);
      }
      if (!row.funds.includes(position.fund)) row.funds.push(position.fund);
      row.weightSum += position.weight;
      row.maxWeight = Math.max(row.maxWeight, position.weight);
      if (position.identifier && !row.cusips.includes(position.identifier)) row.cusips.push(position.identifier);
      if (position.name) row.name = position.name;
    });
  });
  map.forEach(row => {
    row.fundCount = row.funds.length;
    row.funds.sort((a, b) => collator.compare(keyTicker(a), keyTicker(b)));
    row.cusips.sort();
    row.identifier = row.cusips[0] || '';
    row.searchIndex = [row.symbol, row.name, row.cusips.join(' '), row.funds.map(keyTicker).join(' ')].join(' ').toLowerCase();
  });
  const rows = [...map.values()];
  watchlistCache = { signature, rows };
  return rows;
}

function getVisibleWatchlistRows(): WatchlistRow[] {
  return sortRows(filterRows(getDedupedWatchlistRows()));
}

function watchlistChunkSignature(rows: WatchlistRow[]): string {
  return [state.sortKey, state.sortDir, currentQuery(), rows.length, rows.length ? rows[0].key : ''].join('|');
}

function growWatchlistChunk(): void {
  const rows = getVisibleWatchlistRows();
  if (watchlistRenderedCount + WATCHLIST_CHUNK >= rows.length) return;
  watchlistRenderedCount += WATCHLIST_CHUNK;
  renderWatchlistTable();
}

function fundChip(key: string): string {
  const brand = brandByRepo(keyRepo(key));
  const ticker = keyTicker(key);
  return `<a href="javascript:void(0)" data-activate-fund="${escapeHtml(key)}" title="Open ${escapeHtml(ticker)} (${escapeHtml(brand ? brand.brand : keyRepo(key))}) detail tabs" class="font-mono text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800 rounded-full px-2 py-0.5 hover:underline">${escapeHtml(ticker)}</a>`;
}

function renderWatchlistTable(): void {
  const rows = getVisibleWatchlistRows();
  const signature = watchlistChunkSignature(rows);
  if (signature !== watchlistChunkSig) {
    watchlistChunkSig = signature;
    watchlistRenderedCount = 0;
  }
  const visibleRows = rows.slice(0, watchlistRenderedCount + WATCHLIST_CHUNK);
  const hasMore = rows.length > visibleRows.length;
  const selectedCount = selectedKeys().length;
  const loading = selectedCount > 0 && isHoldingsLoading();

  el.tableHead.innerHTML = `
    <tr>
      ${indexHeader()}
      ${sortHeader('Ticker', 'symbol', false, 'watchlist-sticky-col watchlist-sticky-ticker')}
      ${sortHeader('Name', 'name')}
      ${sortHeader('ETFs', 'funds')}
      ${sortHeader('# ETFs', 'fundCount', true)}
      ${sortHeader('Weight Sum', 'weightSum', true)}
      ${sortHeader('Max Weight', 'maxWeight', true)}
      ${sortHeader('Identifier', 'identifier')}
    </tr>
  `;
  bindSortHeaders();

  if (!selectedCount) {
    el.tableBody.innerHTML = `<tr><td colspan="8" class="py-12 text-center text-slate-400 dark:text-slate-500">${state.loading ? 'Loading brand feeds…' : 'Select ETFs (of any brands) in All ETFs to build the aggregated Watchlist.'}</td></tr>`;
  } else if (!rows.length) {
    el.tableBody.innerHTML = `<tr><td colspan="8" class="py-12 text-center text-slate-400 dark:text-slate-500">${
      loading
        ? `Loading holdings of ${selectedCount} selected ETF${selectedCount === 1 ? '' : 's'}…`
        : 'Holdings data is not available for the selected ETFs.'
    }${currentQuery() ? ' No rows match your search.' : ''}</td></tr>`;
  } else {
    let html = visibleRows.map((row, index) => `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition border-b border-slate-100 dark:border-slate-700/30">
        <td class="py-2.5 px-4 text-slate-400 dark:text-slate-500 text-xs text-center font-mono">${index + 1}</td>
        <td class="watchlist-sticky-col watchlist-sticky-ticker py-2.5 px-4 font-mono font-semibold text-blue-600 dark:text-blue-400">${escapeHtml(row.symbol)}</td>
        <td class="py-2.5 px-4 text-slate-700 dark:text-slate-300 font-medium" title="${escapeHtml(row.name)}">${escapeHtml(row.name || DASH)}</td>
        <td class="py-2.5 px-4 text-slate-700 dark:text-slate-300">
          <div class="flex flex-wrap gap-1 max-w-md">
            ${row.funds.slice(0, 12).map((key: string) => fundChip(key)).join('')}${row.funds.length > 12 ? `<span class="text-xs text-slate-400" title="${escapeHtml(row.funds.map(keyTicker).join(', '))}">+${row.funds.length - 12}</span>` : ''}
          </div>
        </td>
        <td class="py-2.5 px-4 text-right font-mono text-slate-700 dark:text-slate-300">${row.fundCount}</td>
        <td class="py-2.5 px-4 text-right font-mono text-slate-700 dark:text-slate-300">${row.weightSum.toFixed(3)}%</td>
        <td class="py-2.5 px-4 text-right font-mono text-slate-700 dark:text-slate-300">${row.maxWeight.toFixed(3)}%</td>
        <td class="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400 text-xs">${escapeHtml(row.identifier || DASH)}</td>
      </tr>
    `).join('');
    if (loading) {
      html += `<tr><td colspan="8" class="py-3 text-center text-xs text-slate-400 dark:text-slate-500">Loading holdings of the remaining selected ETFs…</td></tr>`;
    }
    if (hasMore) {
      html += `<tr id="watchlist-more-row" class="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition"><td colspan="8" class="py-3 text-center text-xs text-slate-400 dark:text-slate-500">Scroll or click to load more rows… (${rows.length - visibleRows.length} remaining)</td></tr>`;
    }
    el.tableBody.innerHTML = html;
  }

  const queryText = currentQuery() ? ` matching “${currentQuery()}”` : '';
  setStatus(`Watchlist built from ${selectedCount} selected ETF${selectedCount === 1 ? '' : 's'}: ${rows.length} ticker${rows.length === 1 ? '' : 's'}${queryText}. Deduplicated by ticker, or by identifier for bond rows.`, 'success');
  el.tickerCount.textContent = `${rows.length} tickers`;
  renderSubtitle();
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function renderDetailTable(key: string): void {
  const activeFund = getActiveFund();
  if (!activeFund) {
    renderEmptyDetail(state.loading ? 'Loading brand feeds…' : 'Select an ETF row to see ETF details.');
    return;
  }

  if (key === 'overview') return renderOverviewTable(activeFund);
  if (key === 'distributions') return renderDistributionsTable(activeFund);
  return renderSheetTable(activeFund, key === 'history' ? 'history' : 'holdings');
}

function renderEmptyDetail(message: string): void {
  el.tableHead.innerHTML = `<tr>${indexHeader()}<th class="py-3.5 px-4">Details</th></tr>`;
  el.tableBody.innerHTML = `<tr><td colspan="2" class="py-12 text-center text-slate-400 dark:text-slate-500">${escapeHtml(message)}</td></tr>`;
  el.tickerCount.textContent = state.activeFundKey ? keyTicker(state.activeFundKey) : '0 ETFs';
}

function renderSheetTable(fund: FundRef, sheet: 'holdings' | 'history'): void {
  const catalogCount = Number(sheet === 'holdings' ? fund.raw.holdings : fund.raw.history) || 0;
  const entry = sheetState.get(sheetKey(sheet));

  if (!catalogCount) {
    el.tableHead.innerHTML = `<tr>${indexHeader()}<th class="py-3.5 px-4">${escapeHtml(fund.ticker)}</th></tr>`;
    el.tableBody.innerHTML = `<tr><td colspan="2" class="py-12 text-center text-slate-400 dark:text-slate-500">${escapeHtml(fund.ticker)} has no published static ${sheet === 'holdings' ? 'holdings sheet' : 'NAV history sheet'} yet (catalog-only until the brand's next feed refresh).</td></tr>`;
    el.tickerCount.textContent = fund.ticker;
    renderSubtitle(`${fund.ticker} (${fund.brand}) has no current static ${sheet} sheet.`);
    return;
  }

  if (!entry) {
    el.tableHead.innerHTML = `<tr>${indexHeader()}<th class="py-3.5 px-4">Loading…</th></tr>`;
    el.tableBody.innerHTML = `<tr><td colspan="2" class="py-12 text-center text-slate-400 dark:text-slate-500">Loading ${escapeHtml(fund.ticker)} ${sheet}…</td></tr>`;
    el.tickerCount.textContent = fund.ticker;
    void loadFundMeta(fund.key).then(meta => {
      if (state.activeTab !== `detail:${sheet}` || state.activeFundKey !== fund.key) return;
      if (!meta) {
        el.tableBody.innerHTML = `<tr><td colspan="2" class="py-12 text-center text-rose-500">Could not load ${escapeHtml(fund.ticker)} data: its meta.json is unavailable from ${escapeHtml(fund.brand)}. Reload to retry.</td></tr>`;
        return;
      }
      void ensureSheet(sheet, sheet === 'holdings' ? meta.holdings : meta.history).then(() => render());
    });
    return;
  }

  const headers = entry.headers;
  const rows = sortRows(filterRows(entry.rows.map((row, sourceIndex) => {
    const cells: Record<string, unknown> = { values: row, searchIndex: row.join(' ').toLowerCase() };
    headers.forEach((header, index) => { cells[`col${index}`] = row[index] ?? ''; });
    cells.rank = sourceIndex;
    return cells;
  })));

  el.tableHead.innerHTML = `
    <tr>
      ${indexHeader()}
      ${headers.map((header, index) => sortHeader(header || `Col ${index + 1}`, `col${index}`, NUMERIC_SHEET_HEADERS.includes(header))).join('')}
    </tr>
  `;
  bindSortHeaders();

  if (!rows.length) {
    el.tableBody.innerHTML = `<tr><td colspan="${headers.length + 1}" class="py-12 text-center text-slate-400 dark:text-slate-500">No rows match your search${entry.loading ? ' (still loading…)' : ''}.</td></tr>`;
  } else {
    el.tableBody.innerHTML = rows.map((row, index) => {
      const values: string[] = row.values || [];
      return `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition border-b border-slate-100 dark:border-slate-700/30">
        <td class="py-2.5 px-4 text-slate-400 dark:text-slate-500 text-xs text-center font-mono">${index + 1}</td>
        ${values.map((cell, columnIndex) => `
          <td class="py-2.5 px-4 ${NUMERIC_SHEET_HEADERS.includes(headers[columnIndex]) ? 'text-right font-mono text-slate-700 dark:text-slate-300' : 'text-slate-700 dark:text-slate-300'}">${escapeHtml(cell === '' ? DASH : cell)}</td>
        `).join('')}
      </tr>
    `;}).join('');
  }

  el.tickerCount.textContent = fund.ticker;
  renderSubtitle(`${fund.ticker} (${fund.brand}) ${sheet === 'holdings' ? 'Holdings' : 'History'} · ${entry.rows.length.toLocaleString('en-US')} of ${(entry.manifest.totalRows || 0).toLocaleString('en-US')} rows loaded${entry.manifest.asOfDate ? ` (as of ${entry.manifest.asOfDate})` : ''}.`);
}

function overviewRows(fund: FundRef): Array<{ section: string; metric: string; value: unknown }> {
  const raw = fund.raw;
  const meta = fundMetaCache.get(fund.key);
  const metrics = raw.metrics || {};
  const monthEnd = (raw.returns && raw.returns.monthEnd) || {};
  const quarterEnd = (raw.returns && raw.returns.quarterEnd) || {};
  const ident = meta && meta.identifiers ? meta.identifiers : {};
  const source = meta && meta.source ? meta.source : {};
  const yields = meta && meta.yields ? meta.yields : {};
  const id = fund.id;
  const num = store ? store.num : {};
  const pct = (name: string): string => formatPercent(num[name] ? num[name][id] : null);
  const rows: Array<{ section: string; metric: string; value: unknown }> = [
    { section: 'Fund', metric: 'Ticker', value: fund.ticker },
    { section: 'Fund', metric: 'Fund Name', value: fund.name },
    { section: 'Fund', metric: 'Brand', value: fund.brand },
    { section: 'Fund', metric: 'Category', value: raw.category },
    { section: 'Fund', metric: 'Inception', value: raw.inceptionDate },
    { section: 'Fund', metric: 'Exchange', value: raw.exchange },
    { section: 'Fund', metric: 'Fund Page', value: raw.fundPage },
    { section: 'Fund', metric: 'CUSIP', value: ident.cusip || raw.cusip },
    { section: 'Fund', metric: 'ISIN', value: ident.isin || raw.isin },
    { section: 'Fund', metric: 'Benchmark Index', value: ident.indexTicker || raw.indexName },
    { section: 'Fund', metric: 'Holdings Source', value: source.holdingsSource || (meta && meta.holdings ? meta.holdings.source : null) },
    { section: 'Fund', metric: 'History Source', value: source.historySource || (meta && meta.history ? meta.history.source : null) },
    { section: 'Fund', metric: 'Provider', value: source.provider },
    { section: 'Cost', metric: 'TER (Expense Ratio)', value: raw.ter },
    { section: 'Price', metric: 'NAV', value: raw.nav },
    { section: 'Price', metric: 'Close Price', value: raw.closePrice },
    { section: 'Price', metric: 'Premium / Discount', value: raw.premiumDiscount },
    { section: 'Price', metric: 'As Of', value: raw.asOfDate },
    { section: 'Assets', metric: 'Net Assets', value: formatMoney(num.aumValue ? num.aumValue[id] : null) },
    { section: 'Assets', metric: 'Net Assets (published)', value: raw.aum },
    { section: 'Returns', metric: 'Returns Source', value: metrics.returnsBasis },
    { section: 'Returns', metric: 'Return As Of', value: metrics.performanceAsOf },
    { section: 'Returns', metric: 'YTD', value: pct('ytd') },
    { section: 'Returns', metric: 'TR 1Y', value: pct('tr1y') },
    { section: 'Returns', metric: 'TR 3Y', value: pct('tr3y') },
    { section: 'Returns', metric: 'TR 5Y', value: pct('tr5y') },
    { section: 'Returns', metric: 'TR 10Y', value: pct('tr10y') },
    { section: 'Returns', metric: 'CAGR 3Y', value: pct('cagr3y') },
    { section: 'Returns', metric: 'CAGR 5Y', value: pct('cagr5y') },
    { section: 'Returns', metric: 'CAGR 10Y', value: pct('cagr10y') },
    { section: 'Returns', metric: 'SI Ann.', value: pct('siAnn') },
  ];
  if (monthEnd.asOfDate) {
    rows.push({ section: 'Returns', metric: 'Month-End As Of', value: monthEnd.asOfDate });
    ['ytd', 'yr1', 'yr3', 'yr5', 'yr10', 'sinceInception'].forEach(name => {
      if (name in monthEnd) rows.push({ section: 'Returns', metric: `${name} (ME)`, value: formatPercent(monthEnd[name]) });
    });
  }
  if (quarterEnd.asOfDate) {
    rows.push({ section: 'Returns', metric: 'Quarter-End As Of', value: quarterEnd.asOfDate });
    ['ytd', 'yr1', 'yr3', 'yr5', 'yr10', 'sinceInception'].forEach(name => {
      if (name in quarterEnd) rows.push({ section: 'Returns', metric: `${name} (QE)`, value: formatPercent(quarterEnd[name]) });
    });
  }
  rows.push(
    { section: 'Distributions', metric: 'Frequency', value: raw.distributions ? raw.distributions.frequency : null },
    { section: 'Distributions', metric: 'Ex-Date', value: raw.distributions ? raw.distributions.exDate : null },
    { section: 'Distributions', metric: 'Latest Dividend', value: raw.distributions ? raw.distributions.dividend : null },
    { section: 'Distributions', metric: 'Dividend Yield', value: pct('dividendYield') },
    { section: 'Distributions', metric: 'SEC Yield (30-day)', value: yields.secYieldText || pct('secYield') },
    { section: 'Distributions', metric: 'Dividend Yield Basis', value: yields.dividendYieldKind },
    { section: 'Distributions', metric: 'SEC Yield Basis', value: yields.secYieldKind },
    { section: 'Holdings', metric: 'Holdings Rows', value: raw.holdings },
    { section: 'Holdings', metric: 'Holdings As Of', value: meta && meta.holdings ? meta.holdings.asOfDate : null },
    { section: 'Holdings', metric: 'History Rows', value: raw.history },
  );
  return rows;
}

function renderOverviewTable(fund: FundRef): void {
  const overview = overviewRows(fund);
  const rows = sortRows(filterRows(overview.map(item => ({
    section: item.section,
    metric: item.metric,
    value: item.value === null || item.value === undefined || item.value === '' ? DASH : item.value,
    searchIndex: `${item.section} ${item.metric} ${item.value}`.toLowerCase(),
  }))));

  el.tableHead.innerHTML = `
    <tr>
      ${indexHeader()}
      ${sortHeader('Section', 'section')}
      ${sortHeader('Metric', 'metric')}
      ${sortHeader('Value', 'value')}
    </tr>
  `;
  bindSortHeaders();

  if (!rows.length) {
    el.tableBody.innerHTML = `<tr><td colspan="4" class="py-12 text-center text-slate-400 dark:text-slate-500">No overview metrics match your search.</td></tr>`;
  } else {
    el.tableBody.innerHTML = rows.map((row, index) => `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition border-b border-slate-100 dark:border-slate-700/30">
        <td class="py-2.5 px-4 text-slate-400 dark:text-slate-500 text-xs text-center font-mono">${index + 1}</td>
        <td class="py-2.5 px-4 text-slate-500 dark:text-slate-400">${escapeHtml(row.section)}</td>
        <td class="py-2.5 px-4 text-slate-700 dark:text-slate-300 font-medium">${escapeHtml(row.metric)}</td>
        <td class="py-2.5 px-4 text-slate-700 dark:text-slate-300 font-mono">${
          /^https?:\/\//.test(String(row.value))
            ? `<a class="text-blue-600 dark:text-blue-400 hover:underline" href="${escapeHtml(row.value)}" target="_blank" rel="noopener noreferrer">open link</a>`
            : escapeHtml(row.value)
        }</td>
      </tr>
    `).join('');
  }

  el.tickerCount.textContent = fund.ticker;
  renderSubtitle(`${fund.ticker} (${fund.brand}) overview · ${rows.length} metrics. Returns come from the brand's feed; see Returns Source and Return As Of for how and when they were calculated.`);
}

function renderDistributionsTable(fund: FundRef): void {
  const meta = fundMetaCache.get(fund.key);
  const worksheet = meta && meta.distributions ? meta.distributions : { headers: [], rows: [] };
  const headers: string[] = Array.isArray(worksheet.headers) ? worksheet.headers : [];
  const sourceRows: string[][] = Array.isArray(worksheet.rows) ? worksheet.rows : [];
  const rows = sortRows(filterRows(sourceRows.map((row, sourceIndex) => {
    const cells: Record<string, unknown> = { values: row, searchIndex: row.join(' ').toLowerCase(), rank: sourceIndex };
    headers.forEach((header, index) => { cells[`col${index}`] = row[index] ?? ''; });
    return cells;
  })));

  el.tableHead.innerHTML = `
    <tr>
      ${indexHeader()}
      ${headers.map((header, index) => sortHeader(header, `col${index}`)).join('')}
    </tr>
  `;
  bindSortHeaders();

  if (!rows.length) {
    el.tableBody.innerHTML = `<tr><td colspan="${headers.length + 1}" class="py-12 text-center text-slate-400 dark:text-slate-500">${meta ? `No published distribution for ${escapeHtml(fund.ticker)}.` : `Loading ${escapeHtml(fund.ticker)} distributions…`}</td></tr>`;
    if (!meta) {
      void loadFundMeta(fund.key).then(() => {
        if (state.activeTab === 'detail:distributions' && state.activeFundKey === fund.key) render();
      });
    }
  } else {
    el.tableBody.innerHTML = rows.map((row, index) => {
      const values: string[] = row.values || [];
      return `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition border-b border-slate-100 dark:border-slate-700/30">
        <td class="py-2.5 px-4 text-slate-400 dark:text-slate-500 text-xs text-center font-mono">${index + 1}</td>
        ${values.map(cell => `<td class="py-2.5 px-4 text-slate-700 dark:text-slate-300 font-mono">${escapeHtml(cell || DASH)}</td>`).join('')}
      </tr>
    `;}).join('');
  }

  el.tickerCount.textContent = fund.ticker;
  renderSubtitle(`${fund.ticker} (${fund.brand}) distributions · the dividend schedule published by the brand's feed (ex-date, amount); frequency inferred from the payment cadence.`);
}

// =========================================================================
// 8. Subtitle & header summary
// =========================================================================

const SUBTITLE_TICKER_CAP = 8;

function renderHeaderSummary(subtitle: HTMLElement, keys: Iterable<string>, activeKey: string | null, activate: (key: string) => void): void {
  const panel = document.getElementById('app-summary');
  if (!panel) return;
  // Move existing nodes: provenance links and their handlers remain intact.
  panel.replaceChildren(...Array.from(subtitle.childNodes));
  subtitle.replaceChildren();
  const selected = [...keys].sort((a, b) => collator.compare(keyTicker(a), keyTicker(b)));
  if (!selected.length) return;
  subtitle.append(document.createTextNode(`${selected.length} selected: `));
  selected.slice(0, SUBTITLE_TICKER_CAP).forEach((key, index) => {
    if (index) subtitle.append(document.createTextNode(', '));
    const link = document.createElement('a');
    link.href = '#';
    link.dataset.headerFund = key;
    link.title = `View ${keyTicker(key)} details`;
    link.className = `font-semibold ${key === activeKey ? 'text-blue-700 dark:text-blue-300 underline' : 'text-blue-600 dark:text-blue-400 hover:underline'}`;
    link.textContent = keyTicker(key);
    link.addEventListener('click', event => { event.preventDefault(); activate(key); });
    subtitle.append(link);
  });
  if (selected.length > SUBTITLE_TICKER_CAP) subtitle.append(document.createTextNode(` and ${selected.length - SUBTITLE_TICKER_CAP} more`));
}

function latestGeneratedAt(): string {
  let latest = 0;
  brandGeneratedAt.forEach(value => {
    const ts = value ? Date.parse(value) : NaN;
    if (Number.isFinite(ts) && ts > latest) latest = ts;
  });
  return latest ? new Date(latest).toLocaleString() : '';
}

function renderSubtitleDetails(text?: string): void {
  const baseText = text ? String(text) : 'Search every ETF of every brand, select ETFs via the “Use” checkbox, then use the Watchlist tab.';
  const viewLabel = tabLabel(state.activeTab);
  const contextText = text ? baseText : `${baseText} ${viewLabel}: ${el.tickerCount.textContent || ''}.`;
  const keys = selectedKeys();
  let selectionItem = '';
  if (keys.length > 0 && store) {
    const everyone = nonBlacklistedIds();
    if (everyone.length === keys.length && everyone.every(id => state.selected.has(store ? store.keys[id] : ''))) {
      selectionItem = ` · All ${everyone.length} ETFs selected`;
    } else if (keys.length <= 12) {
      const badges = keys.sort((a, b) => collator.compare(keyTicker(a), keyTicker(b))).map(key => {
        const isActive = key === state.activeFundKey;
        return `<a href="javascript:void(0)" data-activate-fund="${escapeHtml(key)}" title="View ${escapeHtml(keyTicker(key))} details" class="font-semibold ${isActive ? 'text-blue-700 dark:text-blue-300 underline' : 'text-blue-600 dark:text-blue-400 hover:underline'}">${escapeHtml(keyTicker(key))}</a>`;
      }).join(', ');
      selectionItem = ` · ${keys.length} selected: ${badges}`;
    } else {
      selectionItem = ` · ${keys.length} selected`;
    }
  }
  const generated = latestGeneratedAt();
  const total = store ? store.n : 0;
  const modeText = API_MODE === 'remote'
    ? `read from each brand's GitHub Pages (${GITHUB_PAGES_ORIGIN}&lt;Repo&gt;/api/&lt;slug&gt;/)`
    : 'read from the sibling folders next to this page (./&lt;Repo&gt;/api/&lt;slug&gt;/), falling back to GitHub Pages per brand when a folder is missing';
  const brandLinks = BRANDS.map((brand, i) => {
    const mark = brandStatus[i] === 'error' ? ' (unavailable)' : '';
    return `<a href="${GITHUB_PAGES_ORIGIN}${encodeURIComponent(brand.repo)}/" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline" title="${escapeHtml(brand.brand)} app (GitHub Pages)">${escapeHtml(brand.brand)}</a>${mark} <a href="https://github.com/daggerok/${encodeURIComponent(brand.repo)}" target="_blank" rel="noopener noreferrer" class="text-slate-400 hover:underline" title="${escapeHtml(brand.repo)} repository">[repo]</a>`;
  }).join(' · ');
  el.subtitle.innerHTML = `
    <span class="block sm:inline">${escapeHtml(contextText)}${selectionItem}</span>
    <span class="block sm:inline">· ${total.toLocaleString('en-US')} ETFs from ${loadedBrandCount()} of ${BRANDS.length} brands${generated ? ` · feeds updated ${escapeHtml(generated)}` : ''}. Data: public static feeds of the sibling repositories, ${modeText}, generated from the issuers' public pages, SEC EDGAR and Yahoo Finance. Independent, unofficial tool; not affiliated with any issuer.</span>
    <span class="block mt-2">${brandLinks}</span>
  `;
  el.subtitle.querySelectorAll('a[data-activate-fund]').forEach((link: any) => {
    link.addEventListener('click', () => activateFund(link.dataset.activateFund || ''));
  });
}

function renderSubtitle(text?: string): void {
  renderSubtitleDetails(text);
  renderHeaderSummary(el.subtitle, selectedKeys(), state.activeFundKey, activateFund);
}

function renderFooterBrands(): void {
  const target = document.getElementById('footer-brands');
  if (!target) return;
  target.innerHTML = 'Brands: ' + BRANDS.map(brand =>
    `<a href="${GITHUB_PAGES_ORIGIN}${encodeURIComponent(brand.repo)}/" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">${escapeHtml(brand.brand)}</a> (<a href="https://github.com/daggerok/${encodeURIComponent(brand.repo)}" target="_blank" rel="noopener noreferrer" class="hover:underline">repo</a>)`
  ).join(' · ');
}

// =========================================================================
// 9. Selection & blacklist (keyed by brand + ticker)
// =========================================================================

function updateActiveFundFallback(): void {
  const keys = selectedKeys();
  if (!state.activeFundKey || !keys.includes(state.activeFundKey)) {
    state.activeFundKey = keys[0] || null;
  }
}

/** Shared trailer for every selection writer: keeps localStorage, tabs, subtitle and the Watchlist in sync. */
function afterSelectionChange(): void {
  updateActiveFundFallback();
  persistSelection();
  ensureValidTab();
  render();
  void ensureHoldingsForSelection();
}

function toggleFund(key: string): void {
  if (!store || !store.keyIndex.has(key)) return;
  if (state.selected.has(key)) {
    state.selected.delete(key);
  } else {
    state.selected.add(key);
    state.activeFundKey = key;
  }

  afterSelectionChange();
  const activeKey = state.activeFundKey;
  if (activeKey && state.activeTab.startsWith('detail:')) {
    void loadFundMeta(activeKey).then(meta => {
      if (meta && state.activeFundKey === activeKey && state.activeTab.startsWith('detail:')) render();
    });
  }
}

/** Asks before a bulk selection that would load holdings of a very large number of funds. */
function confirmBulk(newKeys: number): boolean {
  if (newKeys <= LARGE_SELECTION || typeof confirm !== 'function') return true;
  return confirm(`Select ${newKeys.toLocaleString('en-US')} more ETFs? Their holdings will be loaded from the brand feeds in the background (several requests per fund).`);
}

function toggleVisibleSelection(selectAll: boolean): void {
  if (!store) return;
  const ids = catalogIds();
  if (selectAll) {
    const fresh = ids.filter(id => !state.selected.has(store ? store.keys[id] : '')).length;
    if (!confirmBulk(fresh)) { render(); return; }
  }
  ids.forEach(id => {
    const key = store ? store.keys[id] : '';
    if (selectAll) state.selected.add(key);
    else state.selected.delete(key);
  });
  afterSelectionChange();
}

/** All ETFs pill checkbox: every non-blacklisted ETF of every brand, from any tab. */
function toggleAllCatalogEtfs(selectAll: boolean): void {
  if (!store) return;
  const ids = nonBlacklistedIds();
  if (selectAll) {
    const fresh = ids.filter(id => !state.selected.has(store ? store.keys[id] : '')).length;
    if (!confirmBulk(fresh)) { render(); return; }
  }
  ids.forEach(id => {
    const key = store ? store.keys[id] : '';
    if (selectAll) state.selected.add(key);
    else state.selected.delete(key);
  });
  afterSelectionChange();
}

function activateFund(key: string): void {
  if (!key || !state.selected.has(key)) return;
  state.activeFundKey = key;
  persistSelection();
  if (state.activeTab.startsWith('detail:')) {
    resetSheetPaging();
    render();
    maybeLoadMoreRows();
  } else {
    render();
  }
}

function clearSelectionAndSearch(): void {
  state.selected.clear();
  state.activeFundKey = null;
  state.queryByTab = {};
  state.activeTab = 'All';
  applySortForTab('All');
  persistSelection();
  lsRemove(ACTIVE_FUND_KEY);
  el.searchInput.value = '';
  updateSearchClearBtn();
  persistSearches();
  persistSiteState();
  render();
}

function blacklistTickers(rawTickers: string[]): void {
  if (!store) return;
  rawTickers
    .flatMap(raw => String(raw || '').split(/[\s,;]+/))
    .map(sanitizeTicker)
    .filter(Boolean)
    .forEach(ticker => {
      (store ? store.tickerIndex.get(ticker) || [] : []).forEach(id => state.blacklist.add(store ? store.keys[id] : ''));
    });
  blacklistVersion += 1;
  [...state.selected].forEach(key => { if (state.blacklist.has(key)) state.selected.delete(key); });
  if (state.activeFundKey && state.blacklist.has(state.activeFundKey)) {
    state.activeFundKey = selectedKeys()[0] || null;
  }
  persistBlacklist();
  persistSelection();
  ensureValidTab();
  render();
  void ensureHoldingsForSelection();
}

function submitBlacklistInput(): void {
  blacklistTickers([el.blacklistInput.value || '']);
  el.blacklistInput.value = '';
  fitTableHeight();
}

function unblacklistKey(key: string): void {
  state.blacklist.delete(key);
  blacklistVersion += 1;
  persistBlacklist();
  render();
}

function clearBlacklist(): void {
  state.blacklist.clear();
  blacklistVersion += 1;
  persistBlacklist();
  render();
}

function renderBlacklistPanel(): void {
  el.blacklistChips.innerHTML = '';
  const keys = [...state.blacklist].sort((a, b) => collator.compare(keyTicker(a), keyTicker(b)));
  keys.forEach(key => {
    const brand = brandByRepo(keyRepo(key));
    const chip = document.createElement('span');
    chip.className = 'inline-flex items-center gap-1.5 bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-700/50 rounded-full pl-3 pr-1.5 py-1 text-xs font-medium';
    chip.title = brand ? brand.brand : keyRepo(key);
    chip.innerHTML = `${escapeHtml(keyTicker(key))}<button data-unblacklist="${escapeHtml(key)}" class="w-5 h-5 rounded-full hover:bg-rose-200 dark:hover:bg-rose-800 transition" title="Remove ${escapeHtml(keyTicker(key))} from blacklist">✕</button>`;
    el.blacklistChips.appendChild(chip);
  });
  el.blacklistEmpty.classList.toggle('hidden', keys.length > 0);
  el.blacklistChips.querySelectorAll('button[data-unblacklist]').forEach((button: any) => {
    button.addEventListener('click', () => unblacklistKey(button.dataset.unblacklist || ''));
  });
  syncBlacklistPanelHeight();
}

function syncBlacklistPanelHeight(): void {
  el.blacklistPanel.style.maxHeight = el.blacklistPanel.classList.contains('is-visible')
    ? `${el.blacklistPanel.scrollHeight}px`
    : '';
}

// =========================================================================
// 10. Actions & exports (CSV, TXT, Copy Tickers)
// =========================================================================

function currentExportRows(): { headers: string[]; rows: string[][]; scope: string } {
  if (state.activeTab === 'watchlist') {
    return {
      headers: ['Ticker', 'Name', 'ETFs', '# ETFs', 'Weight Sum (%)', 'Max Weight (%)', 'Identifiers'],
      rows: getVisibleWatchlistRows().map(row => [
        row.symbol,
        row.name,
        row.funds.map(keyTicker).join('|'),
        String(row.fundCount),
        row.weightSum.toFixed(6),
        row.maxWeight.toFixed(6),
        row.cusips.join('|'),
      ]),
      scope: 'watchlist',
    };
  }

  if (state.activeTab === 'detail:overview') {
    const fund = getActiveFund();
    const rows = fund ? overviewRows(fund) : [];
    return {
      headers: ['Section', 'Metric', 'Value'],
      rows: rows.map(row => [row.section, row.metric, String(row.value ?? '')]),
      scope: fund ? `${fund.ticker}-overview` : 'overview',
    };
  }

  if (state.activeTab === 'detail:distributions') {
    const fund = getActiveFund();
    const meta = fund ? fundMetaCache.get(fund.key) : null;
    const worksheet = meta && meta.distributions ? meta.distributions : { headers: [], rows: [] };
    return {
      headers: worksheet.headers || [],
      rows: worksheet.rows || [],
      scope: fund ? `${fund.ticker}-distributions` : 'distributions',
    };
  }

  if (state.activeTab === 'detail:holdings' || state.activeTab === 'detail:history') {
    const sheet = state.activeTab === 'detail:history' ? 'history' : 'holdings';
    const fund = getActiveFund();
    const entry = fund ? sheetState.get(sheetKey(sheet)) : null;
    if (entry) {
      return {
        headers: entry.headers,
        rows: filterRows(entry.rows.map(row => ({ values: row, searchIndex: row.join(' ').toLowerCase() }))).map((row: any) => row.values),
        scope: fund ? `${fund.ticker}-${sheet}` : sheet,
      };
    }
    return { headers: [], rows: [], scope: sheet };
  }

  const s = store;
  const ids = catalogIds();
  const cell = (name: string, id: number): string => (s ? numberCell(nanToNull(s.num[name][id])) : '');
  return {
    headers: ['Selected', 'Ticker', 'Brand', 'Fund Name', 'Type', 'NAV', 'Net Assets ($)', 'Expense (%)', 'Dividend Yield (%)', 'SEC Yield (%)', 'Frequency', 'YTD Return (%)', 'TR 1Y (%)', 'TR 3Y (%)', 'TR 5Y (%)', 'TR 10Y (%)', 'CAGR 3Y (%)', 'CAGR 5Y (%)', 'CAGR 10Y (%)', 'SI Ann. (%)', 'Returns Source', 'Return As Of', 'Inception', 'Holdings', 'History', 'As Of'],
    rows: s ? ids.map(id => {
      const raw = s.raw[id];
      const metrics = raw.metrics || {};
      return [
        state.selected.has(s.keys[id]) ? 'yes' : 'no',
        s.ticker[id],
        s.brandText[id],
        s.name[id],
        s.categoryText[id],
        raw.nav || '',
        cell('aumValue', id),
        cell('terValue', id),
        cell('dividendYield', id),
        cell('secYield', id),
        s.freqText[id] || '',
        cell('ytd', id),
        cell('tr1y', id),
        cell('tr3y', id),
        cell('tr5y', id),
        cell('tr10y', id),
        cell('cagr3y', id),
        cell('cagr5y', id),
        cell('cagr10y', id),
        cell('siAnn', id),
        String(metrics.returnsBasis || ''),
        String(metrics.performanceAsOf || ''),
        raw.inceptionDate || '',
        String(raw.holdings || 0),
        String(raw.history || 0),
        raw.asOfDate || '',
      ];
    }) : [],
    scope: 'etfs',
  };
}

function copyTickers(): void {
  let values: string[] = [];
  if (state.activeTab === 'watchlist') values = getVisibleWatchlistRows().map(row => row.symbol);
  else if (isDetailTab(state.activeTab)) values = currentExportRows().rows.map(row => String(row[0] ?? '')).filter(Boolean);
  else values = catalogIds().map(id => (store ? store.ticker[id] : ''));
  values = values.sort((a, b) => collator.compare(a, b));
  if (!values.length) return;
  void copyText(values.join(', ')).then(() => {
    const oldText = el.copyBtn.textContent;
    el.copyBtn.textContent = 'Copied!';
    setTimeout(() => { el.copyBtn.textContent = oldText || 'Copy Tickers'; }, 1000);
  });
}

function exportCsv(): void {
  const exportData = currentExportRows();
  if (!exportData.rows.length) return;
  downloadText(
    toCsv([exportData.headers, ...exportData.rows.map(row => row.map(cell => String(cell ?? '')))]),
    exportFileName(exportData.scope, 'csv'),
    'text/csv;charset=utf-8;',
  );
}

function exportTxt(): void {
  const exportData = currentExportRows();
  if (!exportData.rows.length) return;
  downloadText(exportData.rows.map(row => row.join('\t')).join('\n'), exportFileName(exportData.scope, 'txt'), 'text/plain;charset=utf-8;');
}

// =========================================================================
// 11. Scroll fix: only the table scrolls
// =========================================================================

function fitTableHeight(): void {
  const rect = el.tableScroll.getBoundingClientRect();
  const bottomPad = window.innerWidth < 640 ? 12 : 24;
  const max = Math.max(240, window.innerHeight - rect.top - bottomPad);
  el.tableScroll.style.maxHeight = `${max}px`;
}

// =========================================================================
// 12. State persistence (every storage access is wrapped in try/catch)
// =========================================================================

function persistSelection(): void {
  lsSet(SELECTED_KEY, JSON.stringify([...state.selected]));
  if (state.activeFundKey) lsSet(ACTIVE_FUND_KEY, state.activeFundKey);
  else lsRemove(ACTIVE_FUND_KEY);
}

function persistBlacklist(): void {
  lsSet(BLACKLIST_KEY, JSON.stringify([...state.blacklist]));
}

function persistViewFilters(): void {
  lsSet(VIEW_FILTERS_KEY, JSON.stringify({
    hiddenBrands: [...state.hiddenBrands],
    hiddenCategories: [...state.hiddenCategories],
    hideStale: state.hideStale,
    staleDays: state.staleDays,
  }));
}

function cleanFilterMap(source: Record<string, unknown>): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const [tab, query] of Object.entries(source)) {
    if (typeof query === 'string' && query.length > 0) clean[tab] = query;
  }
  return clean;
}

function persistSearches(): void {
  const clean = cleanFilterMap(state.queryByTab);
  if (Object.keys(clean).length > 0) lsSet(FILTERS_KEY, JSON.stringify(clean));
  else lsRemove(FILTERS_KEY);
}

function persistSiteState(): void {
  lsSet(SITE_STATE_KEY, JSON.stringify({ activeTab: state.activeTab }));
}

function persistTabSorts(): void {
  lsSet(SORTS_KEY, JSON.stringify(state.sortByTab));
}

function restoreTabSorts(): void {
  const saved = lsGetJson(SORTS_KEY, {});
  const sorts: Record<string, { key: string; dir: SortDirection }> = {};
  if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
    Object.keys(saved).forEach(tab => {
      const entry = saved[tab];
      if (entry && typeof entry.key === 'string' && entry.key !== '' && (entry.dir === 'asc' || entry.dir === 'desc')) {
        sorts[tab] = { key: entry.key, dir: entry.dir };
      }
    });
  }
  state.sortByTab = sorts;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(item => typeof item === 'string' && item.includes(':')) : [];
}

function restoreSelectedEtfs(): void {
  state.selected = new Set(stringList(lsGetJson(SELECTED_KEY, [])));
  const savedActive = lsGet(ACTIVE_FUND_KEY) || '';
  state.activeFundKey = savedActive && state.selected.has(savedActive) ? savedActive : ([...state.selected][0] || null);
}

function restoreBlacklist(): void {
  state.blacklist = new Set(stringList(lsGetJson(BLACKLIST_KEY, [])));
}

function restoreViewFilters(): void {
  const saved = lsGetJson(VIEW_FILTERS_KEY, {});
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return;
  const repos = new Set(BRANDS.map(brand => brand.repo));
  if (Array.isArray(saved.hiddenBrands)) state.hiddenBrands = new Set(saved.hiddenBrands.filter((repo: unknown) => typeof repo === 'string' && repos.has(repo)));
  if (Array.isArray(saved.hiddenCategories)) state.hiddenCategories = new Set(saved.hiddenCategories.filter((name: unknown) => typeof name === 'string'));
  else if (typeof saved.category === 'string' && saved.category) legacyCategory = saved.category;
  state.hideStale = saved.hideStale === true;
  const days = Number(saved.staleDays);
  if (Number.isFinite(days) && days >= 1 && days <= 3650) state.staleDays = Math.floor(days);
}

function restoreSiteState(): string | null {
  const saved = lsGetJson(SITE_STATE_KEY, null);
  return saved && typeof saved === 'object' && typeof saved.activeTab === 'string' && saved.activeTab ? saved.activeTab : null;
}

function restoreSearches(): void {
  const saved = lsGetJson(FILTERS_KEY, {});
  state.queryByTab = saved && typeof saved === 'object' && !Array.isArray(saved) ? cleanFilterMap(saved) : {};
}

// =========================================================================
// 13. Bootstrap lifecycle
// =========================================================================

function bindEvents(): void {
  el.themeToggle.addEventListener('click', () => {
    const dark = !document.documentElement.classList.contains('dark');
    lsSet(THEME_KEY, dark ? 'dark' : 'light');
    applyTheme(dark);
  });

  el.searchInput.addEventListener('input', () => {
    setCurrentQuery(el.searchInput.value.trim());
    updateSearchClearBtn();
    render();
  });

  el.searchClearBtn.addEventListener('click', () => {
    el.searchInput.value = '';
    delete state.queryByTab[state.activeTab];
    persistSearches();
    updateSearchClearBtn();
    if (typeof el.searchInput.focus === 'function') el.searchInput.focus();
    render();
  });

  el.copyBtn.addEventListener('click', copyTickers);
  el.exportCsvBtn.addEventListener('click', exportCsv);
  el.exportTxtBtn.addEventListener('click', exportTxt);
  el.resetBtn.addEventListener('click', clearSelectionAndSearch);

  el.blacklistBtn.addEventListener('click', () => {
    const visible = el.blacklistPanel.classList.toggle('is-visible');
    el.blacklistBtn.setAttribute('aria-expanded', String(visible));
    renderBlacklistPanel();
    fitTableHeight();
  });
  el.blacklistAddBtn.addEventListener('click', submitBlacklistInput);
  el.blacklistInput.addEventListener('keydown', (event: any) => {
    if (event.key === 'Enter') submitBlacklistInput();
  });
  el.blacklistClearBtn.addEventListener('click', clearBlacklist);

  initTooltips();
  initSearchSuggest();

  // Filters bar: brand and category multi-select popovers, hide stale returns.
  brandDd = createDropdown({
    trigger: el.brandBtn,
    panel: el.brandPanel,
    title: 'Brands',
    noun: 'brands',
    unit: 'funds',
    getItems: brandDropdownItems,
    onChange: applyBrandSelection,
  });
  categoryDd = createDropdown({
    trigger: el.categoryBtn,
    panel: el.categoryPanel,
    title: 'Categories',
    noun: 'categories',
    unit: 'ETFs',
    getItems: () => categoryItems,
    onChange: applyCategorySelection,
  });
  el.staleToggle.addEventListener('change', () => {
    state.hideStale = Boolean(el.staleToggle.checked);
    persistViewFilters();
    render();
  });
  el.staleDays.addEventListener('input', () => {
    const days = Math.floor(Number(el.staleDays.value));
    if (!Number.isFinite(days) || days < 1 || days > 3650) return;
    state.staleDays = days;
    persistViewFilters();
    render();
  });

  // Delegated table events (the catalog mounts hundreds of rows).
  el.tableBody.addEventListener('change', (event: any) => {
    const target = event.target;
    if (target && target.dataset && target.dataset.checkbox) {
      event.stopPropagation();
      toggleFund(target.dataset.checkbox);
    }
  });
  el.tableBody.addEventListener('click', (event: any) => {
    const target = event.target;
    if (!target || typeof target.closest !== 'function') return;
    const blacklistButton = target.closest('button[data-blacklist]');
    if (blacklistButton) {
      event.stopPropagation();
      const key = blacklistButton.dataset.blacklist || '';
      blacklistTickers([keyTicker(key)]);
      return;
    }
    const link = target.closest('a[data-activate-fund]');
    if (link) {
      event.stopPropagation();
      activateFund(link.dataset.activateFund || '');
      return;
    }
    if (target.closest('#watchlist-more-row')) growWatchlistChunk();
    else if (target.closest('#catalog-more-row')) growCatalogChunk();
  });

  // Paginated sheets: append more rows as the sentinel scrolls into view.
  if (typeof IntersectionObserver === 'function') {
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) maybeLoadMoreRows();
      },
      { root: el.tableScroll, rootMargin: '600px 0px' },
    );
    observer.observe(el.staticLoadSentinel);
  }
  el.staticLoadSentinel.addEventListener('click', () => maybeLoadMoreRows());
  el.tableScroll.addEventListener('scroll', () => {
    const distanceToBottom = el.tableScroll.scrollHeight - el.tableScroll.scrollTop - el.tableScroll.clientHeight;
    if (state.activeTab === 'watchlist') {
      if (distanceToBottom < 600) growWatchlistChunk();
      return;
    }
    if (state.activeTab === 'All') {
      if (distanceToBottom < 600) growCatalogChunk();
      return;
    }
    const sheet = activeSheetTab();
    if (!sheet || !state.activeFundKey) return;
    const entry = sheetState.get(sheetKey(sheet));
    if (!entry || entry.loading || entry.nextPage >= entry.manifest.pages.length) return;
    if (distanceToBottom < 600) void loadNextSheetPage(sheet);
  }, { passive: true });

  window.addEventListener('resize', fitTableHeight);
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(() => fitTableHeight()).observe(document.body);
  }
}

function init(): void {
  restoreSelectedEtfs();
  restoreBlacklist();
  restoreViewFilters();
  const savedTab = restoreSiteState();
  if (savedTab) state.activeTab = savedTab;
  restoreSearches();
  restoreTabSorts();
  applySortForTab(state.activeTab);
  applyTheme(lsGet(THEME_KEY) === 'dark');
  bindEvents();
  syncSearchInput();
  fitTableHeight();
  renderFooterBrands();
  renderFilters();
  renderBrandList();
  renderSubtitle();
  void loadCatalog().catch(error => {
    const message = error instanceof Error ? error.message : String(error);
    state.loading = false;
    el.tickerCount.textContent = 'Error';
    el.tableBody.innerHTML = `<tr><td colspan="10" class="py-12 text-center text-rose-500 dark:text-rose-300">${escapeHtml(`Unable to load the brand feeds: ${message}`)}</td></tr>`;
  });
}

init();
