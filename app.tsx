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
  weightSum: number | null;
  maxWeight: number | null;
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
const FETCH_TIMEOUT_MS = 30000; // meta.json and holdings/history pages (headers and body)
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
const FUND_NUM_KEYS = ['aumValue', 'terValue', 'terGrossValue', 'navValue'];
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
  Expense: 'Expense Ratio (TER), NET - total annual fund operating expenses after waivers as a % of assets, as published by the issuer. Hover a value for the gross ratio when published.',
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
  filterBar: byId('filter-bar'),
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
const holdingsFailed = new Set<string>(); // fetch failed: not complete, retried after the fund is selected again
const metaFailures = new Set<string>();
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

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
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
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  textarea.remove();
  return ok;
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
  setTimeout(() => URL.revokeObjectURL(url), 10000); // revoking at once can abort the download in Safari and Firefox
}

const PLAIN_NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?%?$/i;

/** Spreadsheet formula injection guard: a text cell that starts with = + - @ TAB or CR gets a leading apostrophe (plain numbers are left alone). */
function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) && !PLAIN_NUMBER.test(value) ? `'${value}` : value;
}

function toCsv(rows: string[][]): string {
  return rows
    .map(row => row.map(cell => {
      const value = neutralizeFormula(String(cell ?? ''));
      return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    }).join(','))
    .join('\r\n');
}

/** One TXT line cell: tabs and line breaks would break the columns. */
function txtCell(cell: unknown): string {
  return String(cell ?? '').replace(/[\t\r\n]+/g, ' ');
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

async function fetchJson(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<any> {
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

/**
 * returnsBasis class: 1 official, 2 mixed (official with gaps filled from Yahoo or estimates),
 * 3 derived/estimate (not official), NaN none. Texts that merely NEGATE a source ("no Yahoo or
 * market-price estimates", "not derived from Yahoo", "Yahoo ... is not used") do not count as
 * gap filling, and exact math on official figures ("derived from the published annualized
 * values") stays official.
 */
function classifyBasis(text: unknown): number {
  const t = String(text ?? '').trim().toLowerCase();
  if (!t || t === 'unavailable' || t === '-' || t.startsWith('none')) return NaN;
  if (!/^(last published )?official/.test(t)) return 3;
  const positive = t
    .replace(/\bnot derived from yahoo[^;]*/g, '')
    .replace(/\byahoo[^;]*\bis not used[^;]*/g, '')
    .replace(/\bno yahoo[^;]*/g, '');
  return /(filled|missing|omits|where published|yahoo|estimat|does not publish|did not publish)/.test(positive) ? 2 : 1;
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
    // the Brands dropdown already says 'Brands: 29 of 29': only report what is worth knowing
    const parts: string[] = [];
    if (loadedBrandCount() < BRANDS.length) parts.push(`${loadedBrandCount()} of ${BRANDS.length} brands loaded`);
    if (cachedOnly) parts.push(`${cachedOnly} from cache only`);
    if (fromPages) parts.push(`${fromPages} remote (github.io)`);
    if (failed.length) parts.push(`${failed.length} unavailable`);
    el.loadProgress.textContent = parts.join(' · ');
  }
  el.loadProgress.hidden = !el.loadProgress.textContent;
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
  if (known.dataFile === null || (!known.holdings && !known.history)) { // no per-fund files published
    fundMetaCache.set(key, null);
    return null;
  }
  const request = (async () => {
    try {
      const meta = await fetchJson(`${fundBaseUrl(key)}funds/${encodeURIComponent(keyTicker(key))}/meta.json`);
      if (!meta || typeof meta !== 'object') throw new Error('malformed meta.json');
      metaFailures.delete(key);
      fundMetaCache.set(key, meta);
      return meta;
    } catch (error) {
      metaFailures.add(key);
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
  if (!page || typeof page !== 'object') throw new Error('malformed page');
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
    await appendSheetPage(fund, entry);
    if (state.activeFundKey === fund && state.activeTab === `detail:${sheet}`) render();
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
    if (!holdingsComplete.has(key) && !holdingsFailed.has(key)) return true;
  }
  return false;
}

/**
 * Loads every holdings page of one fund inside its chain (no duplicate or skipped pages).
 * Resolves true only when the fund's holdings are really complete (or the fund honestly has
 * none); false when it was deselected midway (the partial entry is kept and resumed later).
 * Throws when meta.json or a page could not be fetched.
 */
async function loadAllHoldingsForFund(key: string): Promise<boolean> {
  return withFundChain(key, async () => {
    if (!state.selected.has(key)) return false; // deselected while queued: skip
    const meta = await loadFundMeta(key);
    if (!meta) {
      if (metaFailures.has(key)) throw new Error('meta.json unavailable');
      return true; // catalog-only fund: no holdings published
    }
    if (!meta.holdings || !Array.isArray(meta.holdings.pages) || !meta.holdings.pages.length) return true;
    const sheet = `${key}:holdings`;
    let entry = sheetState.get(sheet);
    if (!entry) {
      entry = { headers: [], rows: [], nextPage: 0, manifest: meta.holdings, loading: false };
      sheetState.set(sheet, entry);
    }
    while (entry.nextPage < entry.manifest.pages.length) {
      if (!state.selected.has(key)) return false; // deselected mid-load: resume on the next selection
      await fetchNextSheetPage(key, entry); // chain already held: no re-queue
    }
    return true;
  });
}

/**
 * Watchlist aggregation needs every holdings page of every selected ETF.
 * Runs with bounded concurrency so a big cross-brand selection cannot
 * overload the static feeds; holdings are cached under each fund's own key.
 */
async function ensureHoldingsForSelection(): Promise<void> {
  holdingsFailed.forEach(key => { if (!state.selected.has(key)) holdingsFailed.delete(key); }); // deselect clears a failure: re-select retries
  const queue = selectedKeys().filter(key => !holdingsComplete.has(key) && !holdingsInFlight.has(key) && !holdingsFailed.has(key));
  if (!queue.length) return;
  queue.forEach(key => holdingsInFlight.add(key));
  const workers = Array.from({ length: Math.min(HOLDINGS_CONCURRENCY, queue.length) }, async () => {
    for (;;) {
      const key = queue.shift();
      if (!key) break;
      try {
        if (await loadAllHoldingsForFund(key)) holdingsComplete.add(key);
      } catch (error) {
        console.error(`Failed to load ${key} holdings:`, error);
        holdingsFailed.add(key);
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
  const colPreds = catalogColumnPredicates();
  const colCount = colPreds.length;
  let before = 0;
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
    before += 1;
    let colOk = true;
    for (let k = 0; k < colCount; k++) if (!colPreds[k](i)) { colOk = false; break; }
    if (!colOk) continue;
    out.push(i);
  }
  if (colCount) colStats.All = { before, after: out.length };
  else delete colStats.All;
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
    state.hideStale ? Math.floor(Date.now() / DAY_MS) : '', colFilterSig('All'),
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
    const hasFiles = activeFund.raw.dataFile !== null; // dataFile null: no per-fund meta.json, only the overview
    DETAIL_TABS.filter(tab => hasFiles || tab.key === 'overview').forEach(tab => {
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
    const incomplete = isHoldingsLoading() || selectedKeys().some(key => !holdingsComplete.has(key));
    const count = incomplete ? (rowCount ? `${rowCount}+` : isHoldingsLoading() ? 'Loading…' : 0) : rowCount;
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
  const known = new Set(categoryItems.map(item => item.id));
  const unseen = [...state.hiddenCategories].filter(name => !known.has(name)); // categories of brands not loaded yet stay hidden
  state.hiddenCategories = new Set([...categoryItems.map(item => item.id).filter(name => !selected.has(name)), ...unseen]);
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
// 6b. Column filters: type detection, filter engine, header popover, chips
// =========================================================================

/**
 * Every column header of All ETFs, Watchlist and the Holdings / History /
 * Distributions tabs has a funnel button that opens a type-aware filter
 * popover. A column is a `ColData`: numbers, percents, dates, datetimes and
 * times live in a Float64Array (NaN = empty), strings are plain text or a small
 * integer dictionary. A filter is compiled once per change into a closure over
 * those arrays, so applying it allocates nothing per row. Columns combine with
 * AND; the conditions of one column combine with AND or OR (user's choice) and
 * with the column's multi-select values via AND. NaN / empty never matches a
 * comparison, only "is empty".
 *
 * Type detection (adapted from daggerok/csv): typed catalog columns take their
 * type from column metadata (number, percent, date) refined by the values (a
 * date column holding times becomes datetime); text columns (detail sheets) are
 * detected from up to TYPE_SAMPLE_SIZE non-empty values and a column needs
 * TYPE_MATCH_RATIO of them to match a type, otherwise it stays a string.
 */

type ColType = 'string' | 'number' | 'percent' | 'date' | 'datetime' | 'time';
type FilterCond = { op: string; a: string; b: string };
type ColFilter = { join: 'and' | 'or'; conds: FilterCond[]; picks: string[] };
type ColData = {
  key: string;
  label: string;
  type: ColType;
  n: number;
  num: Float64Array | null; // number / percent / date / datetime (UTC ms) / time (seconds); NaN = empty
  ids: Uint8Array | Uint16Array | null; // dictionary-encoded strings
  dict: string[] | null;
  text: string[] | null;
  lower: string[] | null; // lazily lower-cased `text`
  distinct: any; // lazily computed: Array<{ value, label, count }> | null (too many values)
  distinctDone: boolean;
};
type ColStat = { before: number; after: number };

const COL_FILTERS_KEY = 'etf-hub-column-filters';
const TYPE_SAMPLE_SIZE = 400;
const TYPE_MATCH_RATIO = 0.8;
const MULTI_MAX_DISTINCT = 200; // multi-select of values only for low-cardinality string columns
const MAX_CONDS = 5;
const COL_TYPE_LABELS: Record<ColType, string> = { string: 'text', number: 'number', percent: 'percent', date: 'date', datetime: 'datetime', time: 'time' };

const STRING_OPS: Array<[string, string]> = [
  ['contains', 'contains'], ['not_contains', 'does not contain'], ['equals', 'equals'], ['not_equals', 'does not equal'],
  ['starts', 'starts with'], ['ends', 'ends with'], ['regex', 'matches regex'], ['empty', 'is empty'], ['notempty', 'is not empty'],
];
const NUMBER_OPS: Array<[string, string]> = [
  ['eq', '='], ['ne', '!='], ['gt', '>'], ['ge', '>='], ['lt', '<'], ['le', '<='], ['between', 'between'], ['empty', 'is empty'], ['notempty', 'is not empty'],
];
const DATE_OPS: Array<[string, string]> = [
  ['on', 'on'], ['before', 'before'], ['after', 'after'], ['onorbefore', 'on or before'], ['onorafter', 'on or after'], ['between', 'between'],
  ['last', 'in the last N days'], ['older', 'older than N days'], ['empty', 'is empty'], ['notempty', 'is not empty'],
];
const TIME_OPS: Array<[string, string]> = [
  ['on', 'at'], ['before', 'before'], ['after', 'after'], ['onorbefore', 'at or before'], ['onorafter', 'at or after'], ['between', 'between'], ['empty', 'is empty'], ['notempty', 'is not empty'],
];
const ALL_OPS = new Set([...STRING_OPS, ...NUMBER_OPS, ...DATE_OPS, ...TIME_OPS].map(pair => pair[0]));
const OP_CHIP_TEXT: Record<string, string> = Object.fromEntries([...STRING_OPS, ...NUMBER_OPS, ...DATE_OPS, ...TIME_OPS]);

function opsFor(type: ColType): Array<[string, string]> {
  if (type === 'string') return STRING_OPS;
  if (type === 'number' || type === 'percent') return NUMBER_OPS;
  if (type === 'time') return TIME_OPS;
  return DATE_OPS;
}

function defaultOp(type: ColType): string {
  return type === 'string' ? 'contains' : type === 'number' || type === 'percent' ? 'gt' : 'after';
}

function opInputs(op: string): number {
  return op === 'empty' || op === 'notempty' ? 0 : op === 'between' ? 2 : 1;
}

// ---- parsing ------------------------------------------------------------

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const NUM_TEXT_RE = /^([+-]?)\$?([+-]?)(\d[\d,]*\.?\d*|\.\d+)(e[+-]?\d+)?([kmbt%]?)$/i;
const SUFFIX_MULT: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 };
const ISO_RE = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?)?$/i;
const US_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)?)?$/i;
const YMD_SLASH_RE = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/;
const DMON_RE = /^(\d{1,2})[\s-]+([A-Za-z]{3,9})\.?[\s,-]+(\d{4})$/;
const MOND_RE = /^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/;
const TIME_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)?$/i;
let tpTime = false; // side channel of parseTemporalTs: the text had a time part
let tpSecs = false; // ... and seconds

function isBlankText(text: string): boolean {
  const t = text.trim();
  return t === '' || t === DASH || t === '—' || t === '-' || t === '--';
}

function isPlaceholderText(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t === '' || t === DASH || t === '—' || t === '-' || t === '--' || t === 'n/a' || t === 'na' || t === 'null' || t === 'nan';
}

/** "1,234.5", "$12", "(5)", "1.5b" (suffixes only when allowed), "12.5%" (only when allowed) -> number, NaN when invalid. */
function parseNumberText(raw: string, allowSuffix: boolean, allowPct: boolean): number {
  let s = raw.replace(/\s+/g, '');
  if (!s) return NaN;
  let neg = false;
  if (s[0] === '(' && s[s.length - 1] === ')') { neg = true; s = s.slice(1, -1); }
  const m = NUM_TEXT_RE.exec(s);
  if (!m) return NaN;
  const suffix = m[5].toLowerCase();
  if (suffix === '%' ? !allowPct : (suffix !== '' && !allowSuffix)) return NaN;
  let v = parseFloat(m[3].replace(/,/g, '') + (m[4] || ''));
  if (v !== v) return NaN;
  if (suffix && suffix !== '%') v *= SUFFIX_MULT[suffix];
  if (m[1] === '-' || m[2] === '-') neg = !neg;
  return neg ? -v : v;
}

function utcMs(y: number, mo: number, d: number, h: number, mi: number, s: number): number {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return NaN;
  const ts = Date.UTC(y, mo - 1, d, h, mi, s);
  const check = new Date(ts);
  return check.getUTCMonth() === mo - 1 && check.getUTCDate() === d ? ts : NaN;
}

function monthIndex(name: string): number {
  return MONTH_NAMES.indexOf(name.slice(0, 3).toLowerCase()) + 1;
}

function hour12(h: number, ap: string | undefined): number {
  if (!ap) return h;
  const pm = ap.toLowerCase() === 'pm';
  return (h % 12) + (pm ? 12 : 0);
}

/**
 * Dates and datetimes -> UTC milliseconds (wall clock, timezone independent unless an offset is given).
 * Supported: 2026-08-21, 2026-08-21 14:30[:05], 2026-08-21T14:30Z, 08/21/2026 (US; day first when the first number is > 12),
 * 2026/08/21, 21-Aug-2026, 21 Aug 2026, Aug 21, 2026.
 */
function parseTemporalTs(raw: string): number {
  tpTime = false;
  tpSecs = false;
  const s = raw.trim();
  if (s.length < 8 || s.length > 40) return NaN;
  let m = ISO_RE.exec(s);
  if (m) {
    const h = m[4] !== undefined ? Number(m[4]) : 0;
    const mi = m[5] !== undefined ? Number(m[5]) : 0;
    const sec = m[6] !== undefined ? Number(m[6]) : 0;
    let ts = utcMs(Number(m[1]), Number(m[2]), Number(m[3]), h, mi, sec);
    if (ts !== ts) return NaN;
    tpTime = m[4] !== undefined;
    tpSecs = m[6] !== undefined;
    if (m[7] && m[7].toUpperCase() !== 'Z') {
      const sign = m[7][0] === '-' ? -1 : 1;
      const digits = m[7].slice(1).replace(':', '');
      ts -= sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2))) * 60000;
    }
    return ts;
  }
  m = US_RE.exec(s);
  if (m) {
    let month = Number(m[1]);
    let day = Number(m[2]);
    if (month > 12 && day <= 12) { const t = month; month = day; day = t; }
    const h = m[4] !== undefined ? hour12(Number(m[4]), m[7]) : 0;
    const ts = utcMs(Number(m[3]), month, day, h, m[5] !== undefined ? Number(m[5]) : 0, m[6] !== undefined ? Number(m[6]) : 0);
    tpTime = m[4] !== undefined;
    tpSecs = m[6] !== undefined;
    return ts;
  }
  m = YMD_SLASH_RE.exec(s);
  if (m) return utcMs(Number(m[1]), Number(m[2]), Number(m[3]), 0, 0, 0);
  m = DMON_RE.exec(s);
  if (m) { const mo = monthIndex(m[2]); return mo ? utcMs(Number(m[3]), mo, Number(m[1]), 0, 0, 0) : NaN; }
  m = MOND_RE.exec(s);
  if (m) { const mo = monthIndex(m[1]); return mo ? utcMs(Number(m[3]), mo, Number(m[2]), 0, 0, 0) : NaN; }
  return NaN;
}

/** "14:30", "14:30:05", "2:30 PM" -> seconds since midnight, NaN when invalid. */
function parseTimeText(raw: string): number {
  tpSecs = false;
  const m = TIME_RE.exec(raw.trim());
  if (!m) return NaN;
  const h = hour12(Number(m[1]), m[4]);
  const mi = Number(m[2]);
  const s = m[3] !== undefined ? Number(m[3]) : 0;
  if (h > 23 || mi > 59 || s > 59 || (m[4] && Number(m[1]) > 12)) return NaN;
  tpSecs = m[3] !== undefined;
  return h * 3600 + mi * 60 + s;
}

/** Text of an input of a filter condition -> number (percent numbers stay percent numbers: 12.5 and 12.5% both mean 12.5). */
function parseNumberInput(text: string, type: ColType): number {
  return parseNumberText(text, type === 'number', type === 'percent');
}

function parseTemporalInput(text: string, type: ColType): { v: number; unit: number } | null {
  const s = text.trim();
  if (!s) return null;
  if (type === 'time') {
    const t = parseTimeText(s);
    return t === t ? { v: t, unit: tpSecs ? 1 : 60 } : null;
  }
  const ts = parseTemporalTs(s);
  if (ts !== ts) return null;
  return { v: ts, unit: !tpTime ? DAY_MS : tpSecs ? 1000 : 60000 };
}

// ---- type detection -------------------------------------------------------

type CellKind = 'datetime' | 'date' | 'time' | 'percent' | 'number' | 'string';

function classifyCell(text: string): CellKind {
  const s = text.trim();
  const ts = parseTemporalTs(s);
  if (ts === ts) return tpTime ? 'datetime' : 'date';
  const t = parseTimeText(s);
  if (t === t) return 'time';
  if (/%\s*$/.test(s)) {
    const p = parseNumberText(s, false, true);
    return p === p ? 'percent' : 'string';
  }
  const v = parseNumberText(s, true, false);
  if (v !== v) return 'string';
  if (/^[+-]?0\d/.test(s)) return 'string'; // leading zeros: an identifier, not a quantity
  return 'number';
}

/** Detects the type of a text column from its values (see the block comment). */
function detectTextType(texts: string[], header: string): ColType {
  const stride = Math.max(1, Math.floor(texts.length / TYPE_SAMPLE_SIZE));
  const counts: Record<string, number> = { datetime: 0, date: 0, time: 0, percent: 0, number: 0, string: 0 };
  let total = 0;
  let digitsLen = -1; // common length of the all-digit samples (-1 none yet, 0 mixed lengths)
  let digitsOnly = 0;
  for (let i = 0; i < texts.length && total < TYPE_SAMPLE_SIZE; i += stride) {
    if (isPlaceholderText(texts[i])) continue;
    const kind = classifyCell(texts[i]);
    counts[kind] += 1;
    total += 1;
    if (kind === 'number' && /^\d+$/.test(texts[i].trim())) {
      digitsOnly += 1;
      const len = texts[i].trim().length;
      digitsLen = digitsLen === -1 || digitsLen === len ? len : 0;
    }
  }
  if (total === 0) return 'string';
  const need = total * TYPE_MATCH_RATIO;
  // Fixed-width all-digit values (CUSIP, SEDOL, account numbers) are identifiers, not quantities.
  if (digitsOnly === counts.number && digitsLen >= 6 && counts.number >= need && !/shares|volume|assets|amount|value|count|quantity|price|nav|par/i.test(header)) return 'string';
  if (counts.date + counts.datetime >= need) return counts.datetime > 0 ? 'datetime' : 'date';
  if (counts.time >= need) return 'time';
  if (counts.percent + counts.number >= need) {
    const percentHeader = /%|\b(weight|coupon|yield|premium|discount|return)\b/i.test(header);
    return percentHeader || (counts.percent > 0 && counts.percent >= counts.number) ? 'percent' : 'number';
  }
  return 'string';
}

function newColData(key: string, label: string, type: ColType, n: number): ColData {
  return { key, label, type, n, num: null, ids: null, dict: null, text: null, lower: null, distinct: null, distinctDone: false };
}

function numberCol(key: string, label: string, hint: 'number' | 'percent' | 'date', values: Float64Array): ColData {
  let type: ColType = hint;
  if (hint === 'date') {
    // A date column whose values carry a time of day is a datetime column (checked on the values, not on the hint).
    for (let i = 0; i < values.length; i++) {
      const x = values[i];
      if (x === x && x % DAY_MS !== 0) { type = 'datetime'; break; }
    }
  }
  const col = newColData(key, label, type, values.length);
  col.num = values;
  return col;
}

/** Date column of the catalog parsed from the feed's own text (UTC calendar date, so filters are timezone independent). */
function catalogDateValues(s: Store, key: string): Float64Array {
  const out = new Float64Array(s.n).fill(NaN);
  for (let i = 0; i < s.n; i++) {
    const raw = s.raw[i];
    const text = key === 'perfTs' ? (raw.metrics ? raw.metrics.performanceAsOf : '') : key === 'inceptionTs' ? raw.inceptionDate : raw.asOfDate;
    if (typeof text === 'string' && text) out[i] = parseTemporalTs(text);
  }
  return out;
}

function dictCol(key: string, label: string, ids: Uint8Array | Uint16Array, dict: string[]): ColData {
  const col = newColData(key, label, 'string', ids.length);
  col.ids = ids;
  col.dict = dict;
  return col;
}

function textCol(key: string, label: string, texts: string[]): ColData {
  const col = newColData(key, label, 'string', texts.length);
  col.text = texts;
  return col;
}

/** Text column of unknown type (detail sheets): detect the type from the values, then parse every cell once. */
function detectedCol(key: string, label: string, texts: string[]): ColData {
  const type = detectTextType(texts, label);
  if (type === 'string') return textCol(key, label, texts);
  const values = new Float64Array(texts.length).fill(NaN);
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i];
    if (isPlaceholderText(t)) continue;
    let v = NaN;
    if (type === 'number' || type === 'percent') v = parseNumberText(t, true, true);
    else if (type === 'time') v = parseTimeText(t);
    else v = parseTemporalTs(t);
    values[i] = v;
  }
  const col = newColData(key, label, type, texts.length);
  col.num = values;
  return col;
}

// ---- column sets of every filterable table ---------------------------------

type CatalogColSpec = { key: string; label: string; kind: 'text' | 'dict' | 'number' | 'percent' | 'date' };

const CATALOG_COLS: CatalogColSpec[] = [
  { key: 'ticker', label: 'Ticker', kind: 'text' },
  { key: 'brand', label: 'Brand', kind: 'dict' },
  { key: 'name', label: 'Fund Name', kind: 'text' },
  { key: 'category', label: 'Type', kind: 'dict' },
  { key: 'navValue', label: 'NAV', kind: 'number' },
  { key: 'aumValue', label: 'Net Assets', kind: 'number' },
  { key: 'terValue', label: 'Expense', kind: 'percent' },
  { key: 'dividendYield', label: 'Dividend Yield', kind: 'percent' },
  { key: 'secYield', label: 'SEC Yield', kind: 'percent' },
  { key: 'dividendFrequency', label: 'Frequency', kind: 'dict' },
  { key: 'ytd', label: 'YTD Return', kind: 'percent' },
  { key: 'tr1y', label: 'TR 1Y', kind: 'percent' },
  { key: 'tr3y', label: 'TR 3Y', kind: 'percent' },
  { key: 'tr5y', label: 'TR 5Y', kind: 'percent' },
  { key: 'tr10y', label: 'TR 10Y', kind: 'percent' },
  { key: 'cagr3y', label: 'CAGR 3Y', kind: 'percent' },
  { key: 'cagr5y', label: 'CAGR 5Y', kind: 'percent' },
  { key: 'cagr10y', label: 'CAGR 10Y', kind: 'percent' },
  { key: 'siAnn', label: 'SI Ann.', kind: 'percent' },
  { key: 'basisCls', label: 'Source', kind: 'dict' },
  { key: 'perfTs', label: 'Return As Of', kind: 'date' },
  { key: 'inceptionTs', label: 'Inception', kind: 'date' },
  { key: 'holdings', label: 'Holdings', kind: 'number' },
  { key: 'history', label: 'History', kind: 'number' },
  { key: 'asOfTs', label: 'As Of', kind: 'date' },
];

const WATCHLIST_COLS: Array<{ key: string; label: string; kind: 'text' | 'number' | 'percent' }> = [
  { key: 'symbol', label: 'Ticker', kind: 'text' },
  { key: 'name', label: 'Name', kind: 'text' },
  { key: 'funds', label: 'ETFs', kind: 'text' },
  { key: 'fundCount', label: '# ETFs', kind: 'number' },
  { key: 'weightSum', label: 'Weight Sum', kind: 'percent' },
  { key: 'maxWeight', label: 'Max Weight', kind: 'percent' },
  { key: 'identifier', label: 'Identifier', kind: 'text' },
];

/** Builds a dictionary column (id per row + distinct texts) from a text array. */
function dictFromTexts(key: string, label: string, texts: string[]): ColData {
  const map = new Map<string, number>();
  const dict: string[] = [];
  const ids = new Uint16Array(texts.length);
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i];
    let id = map.get(t);
    if (id === undefined) { id = dict.length; dict.push(t); map.set(t, id); }
    ids[i] = id;
  }
  return dictCol(key, label, ids, dict);
}

let catalogColsCache: { version: number; cols: ColData[] } | null = null;

function catalogCols(): ColData[] {
  if (!store) return [];
  const s = store;
  if (catalogColsCache && catalogColsCache.version === s.version) return catalogColsCache.cols;
  const cols = CATALOG_COLS.map(spec => {
    const { key, label } = spec;
    if (key === 'ticker') return textCol(key, label, s.ticker);
    if (key === 'name') return textCol(key, label, s.name);
    if (key === 'brand') return dictCol(key, label, s.brandIdx, BRANDS.map(brand => brand.brand));
    if (key === 'category') return dictCol(key, label, s.catId, s.categories);
    if (key === 'dividendFrequency') return dictFromTexts(key, label, s.freqText);
    if (key === 'basisCls') {
      const ids = new Uint8Array(s.n);
      for (let i = 0; i < s.n; i++) { const c = s.basisCls[i]; ids[i] = c === 1 ? 0 : c === 2 ? 1 : c === 3 ? 2 : 3; }
      return dictCol(key, label, ids, [BASIS_BADGES['1'].label, BASIS_BADGES['2'].label, BASIS_BADGES['3'].label, BASIS_BADGES.none.label]);
    }
    if (spec.kind === 'date') return numberCol(key, label, 'date', catalogDateValues(s, key));
    if (spec.kind === 'number' || spec.kind === 'percent') return numberCol(key, label, spec.kind, s.num[key]);
    return textCol(key, label, []);
  });
  catalogColsCache = { version: s.version, cols };
  return cols;
}

let watchlistColsCache: { rows: WatchlistRow[]; cols: ColData[] } | null = null;

function watchlistCols(): ColData[] {
  const rows = getDedupedWatchlistRows();
  if (watchlistColsCache && watchlistColsCache.rows === rows) return watchlistColsCache.cols;
  const n = rows.length;
  const numeric = (field: string): Float64Array => {
    const out = new Float64Array(n).fill(NaN);
    for (let i = 0; i < n; i++) { const v = rows[i][field]; if (typeof v === 'number' && Number.isFinite(v)) out[i] = v; }
    return out;
  };
  const cols = WATCHLIST_COLS.map(spec => {
    if (spec.kind === 'number' || spec.kind === 'percent') return numberCol(spec.key, spec.label, spec.kind, numeric(spec.key));
    const texts = rows.map(row => (spec.key === 'funds' ? row.funds.map(keyTicker).join(' ') : String(row[spec.key] ?? '')));
    return textCol(spec.key, spec.label, texts);
  });
  watchlistColsCache = { rows, cols };
  return cols;
}

/** Headers + rows behind the active Holdings / History / Distributions tab, or null while not loaded. */
function sheetSource(scope: string): { headers: string[]; rows: string[][] } | null {
  const fund = getActiveFund();
  if (!fund) return null;
  if (scope === 'detail:distributions') {
    const meta = fundMetaCache.get(fund.key);
    const worksheet = meta && meta.distributions ? meta.distributions : null;
    if (!worksheet || !Array.isArray(worksheet.headers) || !Array.isArray(worksheet.rows)) return null;
    return { headers: worksheet.headers, rows: worksheet.rows };
  }
  const entry = sheetState.get(sheetKey(scope === 'detail:history' ? 'history' : 'holdings'));
  return entry ? { headers: entry.headers, rows: entry.rows } : null;
}

let sheetColsCache: { rows: string[][]; len: number; sig: string; cols: ColData[] } | null = null;

function sheetCols(headers: string[], rows: string[][]): ColData[] {
  const sig = headers.join('\u0001');
  if (sheetColsCache && sheetColsCache.rows === rows && sheetColsCache.len === rows.length && sheetColsCache.sig === sig) return sheetColsCache.cols;
  const cols = headers.map((header, index) => {
    const texts = new Array(rows.length);
    for (let r = 0; r < rows.length; r++) texts[r] = String(rows[r][index] ?? '');
    return detectedCol(sheetFilterKey(index, header), header || `Col ${index + 1}`, texts);
  });
  sheetColsCache = { rows, len: rows.length, sig, cols };
  return cols;
}

/** Persistent key of a sheet column: position plus header, so another fund with other headers never inherits it. */
function sheetFilterKey(index: number, header: string): string {
  return `c${index}:${header}`;
}

function filterScope(): string | null {
  const tab = state.activeTab;
  return tab === 'All' || tab === 'watchlist' || tab === 'detail:holdings' || tab === 'detail:history' || tab === 'detail:distributions' ? tab : null;
}

function scopeCols(scope: string): ColData[] {
  if (scope === 'All') return catalogCols();
  if (scope === 'watchlist') return watchlistCols();
  const source = sheetSource(scope);
  return source ? sheetCols(source.headers, source.rows) : [];
}

function scopeNoun(scope: string): string {
  return scope === 'All' ? 'ETFs' : scope === 'watchlist' ? 'tickers' : 'rows';
}

// ---- filter state --------------------------------------------------------

let colFilters: Record<string, Record<string, ColFilter>> = {};
const colStats: Record<string, ColStat> = {};

function colFilterSig(scope: string): string {
  const map = colFilters[scope];
  return map ? JSON.stringify(map) : '';
}

function persistColFilters(): void {
  if (Object.keys(colFilters).length) lsSet(COL_FILTERS_KEY, JSON.stringify(colFilters));
  else lsRemove(COL_FILTERS_KEY);
}

function restoreColFilters(): void {
  const saved = lsGetJson(COL_FILTERS_KEY, {});
  const clean: Record<string, Record<string, ColFilter>> = {};
  if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
    Object.keys(saved).forEach(scope => {
      const map = saved[scope];
      if (!map || typeof map !== 'object' || Array.isArray(map)) return;
      Object.keys(map).forEach(key => {
        const f = map[key];
        if (!f || typeof f !== 'object' || !Array.isArray(f.conds)) return;
        const conds: FilterCond[] = f.conds
          .filter((c: any) => c && typeof c.op === 'string' && ALL_OPS.has(c.op))
          .slice(0, MAX_CONDS)
          .map((c: any) => ({ op: c.op, a: typeof c.a === 'string' ? c.a.slice(0, 500) : '', b: typeof c.b === 'string' ? c.b.slice(0, 500) : '' }));
        const picks: string[] = Array.isArray(f.picks) ? f.picks.filter((p: unknown) => typeof p === 'string').slice(0, 1000) : [];
        if (!conds.length && !picks.length) return;
        if (!clean[scope]) clean[scope] = {};
        clean[scope][key] = { join: f.join === 'or' ? 'or' : 'and', conds, picks };
      });
    });
  }
  colFilters = clean;
}

// ---- compiling ----------------------------------------------------------------

type StringTest = (text: string, lower: string) => boolean;

function compileStringCond(c: FilterCond): StringTest | null {
  if (c.op === 'empty') return (t: string) => isBlankText(t);
  if (c.op === 'notempty') return (t: string) => !isBlankText(t);
  const raw = c.a.trim();
  if (!raw) return null;
  const q = raw.toLowerCase();
  switch (c.op) {
    case 'contains': return (t: string, l: string) => l.includes(q);
    case 'not_contains': return (t: string, l: string) => !l.includes(q);
    case 'equals': return (t: string, l: string) => l.trim() === q;
    case 'not_equals': return (t: string, l: string) => l.trim() !== q;
    case 'starts': return (t: string, l: string) => l.startsWith(q);
    case 'ends': return (t: string, l: string) => l.trimEnd().endsWith(q);
    case 'regex':
      try {
        const re = new RegExp(raw, 'i'); // no g flag: test() is stateless
        return (t: string) => re.test(t);
      } catch { return null; }
    default: return null;
  }
}

function localTodayUtc(): number {
  const d = new Date();
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

function compileNumericCond(type: ColType, c: FilterCond): ((x: number) => boolean) | null {
  if (c.op === 'empty') return (x: number) => x !== x;
  if (c.op === 'notempty') return (x: number) => x === x;
  if (type === 'number' || type === 'percent') {
    const a = parseNumberInput(c.a, type);
    if (a !== a) return null;
    const tol = 1e-9 * Math.max(1, Math.abs(a));
    switch (c.op) {
      case 'eq': return (x: number) => Math.abs(x - a) <= tol;
      case 'ne': return (x: number) => x === x && Math.abs(x - a) > tol;
      case 'gt': return (x: number) => x > a;
      case 'ge': return (x: number) => x >= a;
      case 'lt': return (x: number) => x < a;
      case 'le': return (x: number) => x <= a;
      case 'between': {
        const b = parseNumberInput(c.b, type);
        if (b !== b) return null;
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        return (x: number) => x >= lo && x <= hi;
      }
      default: return null;
    }
  }
  // date / datetime / time: compare on the precision the user typed (day, minute or second)
  if (c.op === 'last' || c.op === 'older') {
    if (type === 'time' || !/^\d{1,5}$/.test(c.a.trim())) return null;
    const from = localTodayUtc() - Number(c.a.trim()) * DAY_MS;
    return c.op === 'last' ? (x: number) => x >= from && x < localTodayUtc() + DAY_MS : (x: number) => x < from;
  }
  const first = parseTemporalInput(c.a, type);
  if (!first) return null;
  const v = first.v;
  const end = first.v + first.unit;
  switch (c.op) {
    case 'on': return (x: number) => x >= v && x < end;
    case 'before': return (x: number) => x < v;
    case 'after': return (x: number) => x >= end;
    case 'onorbefore': return (x: number) => x < end;
    case 'onorafter': return (x: number) => x >= v;
    case 'between': {
      const second = parseTemporalInput(c.b, type);
      if (!second) return null;
      const lo = Math.min(v, second.v);
      const hi = Math.max(end, second.v + second.unit);
      return (x: number) => x >= lo && x < hi;
    }
    default: return null;
  }
}

function condIsValid(col: ColData, c: FilterCond): boolean {
  return (col.type === 'string' ? compileStringCond(c) : compileNumericCond(col.type, c)) !== null;
}

function lowerOf(col: ColData): string[] {
  if (col.lower) return col.lower;
  const text = col.text || [];
  const lower = new Array(text.length);
  for (let i = 0; i < text.length; i++) lower[i] = text[i].toLowerCase();
  col.lower = lower;
  return lower;
}

/** Compiles one column filter into `(rowIndex) => boolean`, or null when it has no valid condition. Allocation-free per row. */
function compileColFilter(col: ColData, f: ColFilter): ((i: number) => boolean) | null {
  const or = f.join === 'or';
  if (col.type === 'string') {
    const tests: StringTest[] = [];
    f.conds.forEach(c => { const t = compileStringCond(c); if (t) tests.push(t); });
    const picks = f.picks.length ? new Set(f.picks) : null;
    if (!tests.length && !picks) return null;
    const test = (t: string, l: string): boolean => {
      if (picks && !picks.has(isBlankText(t) ? '' : t)) return false;
      if (!tests.length) return true;
      if (or) {
        for (let k = 0; k < tests.length; k++) if (tests[k](t, l)) return true;
        return false;
      }
      for (let k = 0; k < tests.length; k++) if (!tests[k](t, l)) return false;
      return true;
    };
    if (col.ids && col.dict) {
      // Dictionary column: evaluate each distinct text once, a row costs one array lookup.
      const ids = col.ids;
      const flags = new Uint8Array(col.dict.length);
      col.dict.forEach((text, id) => { flags[id] = test(text, text.toLowerCase()) ? 1 : 0; });
      return (i: number) => flags[ids[i]] === 1;
    }
    const text = col.text || [];
    const lower = lowerOf(col);
    return (i: number) => test(text[i], lower[i]);
  }
  const tests: Array<(x: number) => boolean> = [];
  f.conds.forEach(c => { const t = compileNumericCond(col.type, c); if (t) tests.push(t); });
  if (!tests.length) return null;
  const num = col.num || new Float64Array(0);
  if (tests.length === 1) {
    const only = tests[0];
    return (i: number) => only(num[i]);
  }
  if (or) {
    return (i: number) => {
      const x = num[i];
      for (let k = 0; k < tests.length; k++) if (tests[k](x)) return true;
      return false;
    };
  }
  return (i: number) => {
    const x = num[i];
    for (let k = 0; k < tests.length; k++) if (!tests[k](x)) return false;
    return true;
  };
}

/** Keeps only the conditions that compile (complete and valid) and the picked values; null when nothing is left. */
function normalizeFilter(col: ColData, draft: ColFilter): ColFilter | null {
  const conds = draft.conds.filter(c => condIsValid(col, c)).map(c => ({ op: c.op, a: opInputs(c.op) ? c.a.trim() : '', b: opInputs(c.op) === 2 ? c.b.trim() : '' }));
  const picks = col.type === 'string' ? draft.picks.slice() : [];
  if (!conds.length && !picks.length) return null;
  return { join: draft.join, conds, picks };
}

/** Predicates of every active filter of the scope that matches a column in `cols`. */
function scopePredicates(scope: string, cols: ColData[]): Array<(i: number) => boolean> {
  const map = colFilters[scope];
  const out: Array<(i: number) => boolean> = [];
  if (!map) return out;
  cols.forEach(col => {
    const f = map[col.key];
    if (!f) return;
    const p = compileColFilter(col, f);
    if (p) out.push(p);
  });
  return out;
}

/** Applies the scope's column filters to row objects (Watchlist, sheets); `indexOf` maps an item to its position in the column arrays. */
function applyRowColumnFilters(scope: string, items: any[], cols: ColData[], indexOf: (item: any) => number): any[] {
  const preds = scopePredicates(scope, cols);
  if (!preds.length) { delete colStats[scope]; return items; }
  const out: any[] = [];
  for (let r = 0; r < items.length; r++) {
    const i = indexOf(items[r]);
    let ok = true;
    for (let k = 0; k < preds.length; k++) if (!preds[k](i)) { ok = false; break; }
    if (ok) out.push(items[r]);
  }
  colStats[scope] = { before: items.length, after: out.length };
  return out;
}

/** The catalog predicates, compiled once per `filterCatalogIds` call. */
function catalogColumnPredicates(): Array<(i: number) => boolean> {
  return scopePredicates('All', catalogCols());
}

// ---- distinct values (multi-select) -----------------------------------------

function distinctValues(col: ColData): Array<{ value: string; label: string; count: number }> | null {
  if (col.distinctDone) return col.distinct;
  col.distinctDone = true;
  const counts = new Map<string, number>();
  if (col.ids && col.dict) {
    const per = new Uint32Array(col.dict.length);
    for (let i = 0; i < col.ids.length; i++) per[col.ids[i]] += 1;
    col.dict.forEach((text, id) => {
      const value = isBlankText(text) ? '' : text;
      counts.set(value, (counts.get(value) || 0) + per[id]);
    });
  } else if (col.text) {
    for (let i = 0; i < col.text.length; i++) {
      const value = isBlankText(col.text[i]) ? '' : col.text[i];
      counts.set(value, (counts.get(value) || 0) + 1);
      if (counts.size > MULTI_MAX_DISTINCT) { col.distinct = null; return null; }
    }
  }
  if (counts.size > MULTI_MAX_DISTINCT || (counts.size > 30 && counts.size > col.n / 2)) { col.distinct = null; return null; }
  const list = [...counts.entries()].map(([value, count]) => ({ value, label: value || '(empty)', count }));
  list.sort((a, b) => collator.compare(a.value || '~', b.value || '~'));
  col.distinct = list;
  return list;
}

// ---- chips + header buttons ------------------------------------------------------

const FUNNEL_SVG = '<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M1.5 2.5h13l-5 6v4.2l-3 1.6V8.5l-5-6z"/></svg>';

function describeFilter(f: ColFilter, type: ColType): string {
  const parts: string[] = [];
  if (f.picks.length) {
    const shown = f.picks.slice(0, 2).map(p => p || '(empty)').join(', ');
    parts.push(f.picks.length > 2 ? `${shown} +${f.picks.length - 2}` : shown);
  }
  const conds = f.conds.map(c => {
    const word = OP_CHIP_TEXT[c.op] || c.op;
    const n = opInputs(c.op);
    if (n === 0) return word;
    if (c.op === 'between') return `between ${c.a} and ${c.b}`;
    if (c.op === 'last') return `in the last ${c.a} days`;
    if (c.op === 'older') return `older than ${c.a} days`;
    return type === 'string' ? `${word} "${c.a}"` : `${word} ${c.a}`;
  });
  if (conds.length) parts.push(conds.join(f.join === 'or' ? ' OR ' : ' AND '));
  return parts.join(' · ');
}

/** The funnel button inside a column header; empty when the active tab has no filterable column with this key. */
function filterButton(fKey: string): string {
  const scope = filterScope();
  if (!scope) return '';
  const col = scopeCols(scope).find(c => c.key === fKey);
  if (!col) return '';
  const active = Boolean(colFilters[scope] && colFilters[scope][fKey]);
  const hint = col.type === 'percent'
    ? ' Percent values: type 12.5 or 12.5% (both mean 12.5%); fractions such as 0.125 are NOT converted.'
    : col.type === 'number' ? ' Numbers accept k, m, b, t suffixes (1.5b).' : '';
  const tip = `${active ? 'Filter active - ' : ''}Filter ${col.label} (${COL_TYPE_LABELS[col.type]} column).${hint}`;
  return `<button type="button" data-filter="${escapeHtml(fKey)}" data-coltype="${col.type}" class="cf-btn${active ? ' is-active' : ''}" aria-haspopup="dialog" aria-label="Filter ${escapeHtml(col.label)}" title="${escapeHtml(tip)}">${FUNNEL_SVG}</button>`;
}

function renderFilterBar(): void {
  const scope = filterScope();
  const map = scope ? colFilters[scope] : null;
  const keys = map ? Object.keys(map) : [];
  const bar = el.filterBar;
  if (!scope || !keys.length) {
    bar.hidden = true;
    bar.innerHTML = '';
    return;
  }
  const cols = scopeCols(scope);
  const chips = keys.map(key => {
    const col = cols.find(c => c.key === key);
    const f = map ? map[key] : null;
    if (!f) return '';
    const label = col ? col.label : key.replace(/^c\d+:/, '');
    const text = describeFilter(f, col ? col.type : 'string');
    return `<span class="cf-chip" data-chip="${escapeHtml(key)}" tabindex="0" role="button" title="Edit the ${escapeHtml(label)} filter"><span class="cf-chip-label">${escapeHtml(label)}</span><span class="cf-chip-text">${escapeHtml(text)}</span><button type="button" class="cf-chip-x" data-chip-x="${escapeHtml(key)}" aria-label="Remove the ${escapeHtml(label)} filter" title="Remove the ${escapeHtml(label)} filter">✕</button></span>`;
  }).join('');
  const stat = colStats[scope];
  const counts = stat ? `<span class="cf-count" aria-live="polite">${stat.before.toLocaleString('en-US')} -&gt; ${stat.after.toLocaleString('en-US')} ${scopeNoun(scope)}</span>` : '';
  bar.hidden = false;
  bar.innerHTML = `${chips}<button type="button" class="dd-act" data-clear-all title="Remove every column filter of this tab (search, brand and category filters stay)">Clear all filters</button>${counts}`;
}

function removeColFilter(scope: string, key: string): void {
  const map = colFilters[scope];
  if (!map) return;
  delete map[key];
  if (!Object.keys(map).length) delete colFilters[scope];
  persistColFilters();
  render();
}

function clearColumnFilters(scope: string): void {
  delete colFilters[scope];
  persistColFilters();
  render();
}

// ---- the popover ----------------------------------------------------------------------

type PopoverCtx = { scope: string; key: string; col: ColData };

let cfPanel: any = null;
let cfBackdrop: any = null;
let cfCtx: PopoverCtx | null = null;
let cfDraft: ColFilter = { join: 'and', conds: [], picks: [] };
let cfValueQuery = '';
let cfCommitTimer: any = 0;
let cfCloseTimer: any = 0;
let cfAnchor: any = null;

function emptyCond(type: ColType): FilterCond {
  return { op: defaultOp(type), a: '', b: '' };
}

function cfInputType(type: ColType, op: string): string {
  if (op === 'last' || op === 'older') return 'number';
  if (type === 'date') return 'date';
  if (type === 'datetime') return 'datetime-local';
  if (type === 'time') return 'time';
  return 'text';
}

function cfPlaceholder(type: ColType, op: string): string {
  if (type === 'percent') return '12.5 or 12.5%';
  if (type === 'number') return 'e.g. 1000 or 1.5b';
  if (type === 'string') return op === 'regex' ? 'e.g. ^(iShares|Vanguard)' : 'text';
  return op === 'last' || op === 'older' ? 'days' : '';
}

function cfCondHtml(ctx: PopoverCtx, c: FilterCond, index: number): string {
  const type = ctx.col.type;
  const n = opInputs(c.op);
  const inType = cfInputType(type, c.op);
  const mode = inType === 'text' ? ' inputmode="decimal"' : '';
  const ph = escapeHtml(cfPlaceholder(type, c.op));
  const modeAttr = type === 'string' ? '' : mode;
  const input = (field: string, value: string) => `<input type="${inType}" class="dd-input cf-in" data-f="${field}" value="${escapeHtml(value)}" placeholder="${ph}" autocomplete="off" spellcheck="false"${modeAttr}${inType === 'number' ? ' min="0" step="1"' : ''} aria-label="${field === 'a' ? 'Value' : 'Second value'}" />`;
  const options = opsFor(type).map(([op, label]) => `<option value="${op}"${op === c.op ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('');
  const presets = c.op === 'last' || c.op === 'older'
    ? `<div class="cf-presets">${[7, 30, 90, 365].map(d => `<button type="button" class="dd-act" data-preset="${d}">${d === 365 ? '1y' : `${d}d`}</button>`).join('')}</div>`
    : '';
  return `<div class="cf-cond" data-ci="${index}">
    <div class="cf-row"><select class="dd-input cf-sel" data-f="op" aria-label="Operator">${options}</select><button type="button" class="cf-del" data-del aria-label="Remove condition" title="Remove condition">✕</button></div>
    ${n ? `<div class="cf-row">${input('a', c.a)}${n === 2 ? `<span class="cf-and">and</span>${input('b', c.b)}` : ''}</div>` : ''}
    ${presets}
    <div class="cf-err" hidden></div>
  </div>`;
}

function cfEnsurePanel(): void {
  if (cfPanel) return;
  cfPanel = document.createElement('div');
  cfPanel.id = 'filter-panel';
  cfPanel.className = 'dd-panel cf-panel';
  cfPanel.hidden = true;
  cfPanel.setAttribute('role', 'dialog');
  cfBackdrop = document.createElement('div');
  cfBackdrop.className = 'dd-backdrop';
  document.body.appendChild(cfBackdrop); // portaled like the dropdowns: no ancestor can clip or cover it
  document.body.appendChild(cfPanel);
  cfBackdrop.addEventListener('click', () => closeColumnFilter());
  cfPanel.addEventListener('input', cfOnInput);
  cfPanel.addEventListener('change', cfOnChange);
  cfPanel.addEventListener('click', cfOnClick);
  cfPanel.addEventListener('keydown', (event: any) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeColumnFilter(true); return; }
    if (event.key === 'Enter' && event.target && event.target.matches && event.target.matches('.cf-in')) { event.preventDefault(); closeColumnFilter(true); }
  });
  document.addEventListener('pointerdown', (event: any) => {
    if (!cfCtx) return;
    const t = event.target;
    if (cfPanel.contains(t) || cfBackdrop.contains(t)) return;
    if (t && t.closest && (t.closest('[data-filter]') || t.closest('[data-chip]'))) return; // their click handlers toggle / retarget the popover
    closeColumnFilter();
  });
  window.addEventListener('resize', () => { if (cfCtx) cfPlace(); });
  window.addEventListener('scroll', (event: any) => { if (cfCtx && !(cfPanel.contains(event.target))) cfPlace(); }, { passive: true, capture: true });
}

function cfAnchorEl(): any {
  if (!cfCtx) return null;
  const sel = `[data-filter="${cfCtx.key.replace(/["\\]/g, '\\$&')}"]`;
  const button = el.tableHead.querySelector(sel);
  if (button) return button;
  return el.filterBar.querySelector(`[data-chip="${cfCtx.key.replace(/["\\]/g, '\\$&')}"]`);
}

function cfPlace(): void {
  if (!cfPanel || !cfCtx) return;
  cfPanel.style.left = '';
  cfPanel.style.top = '';
  cfPanel.style.bottom = '';
  cfPanel.style.maxHeight = '';
  if (window.matchMedia('(max-width: 639px)').matches) return; // bottom sheet, positioned by CSS
  const anchor = cfAnchorEl();
  if (!anchor) return;
  cfAnchor = anchor;
  const rect = anchor.getBoundingClientRect();
  const width = cfPanel.offsetWidth;
  const natural = cfPanel.offsetHeight;
  const below = window.innerHeight - rect.bottom - 16;
  const above = rect.top - 16;
  const flip = below < Math.min(natural, 360) && above > below;
  cfPanel.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
  cfPanel.style.maxHeight = `${Math.max(220, flip ? above : below) - 8}px`;
  if (flip) {
    cfPanel.style.top = 'auto';
    cfPanel.style.bottom = `${window.innerHeight - rect.top + 8}px`;
    cfPanel.style.transformOrigin = 'bottom left';
  } else {
    cfPanel.style.top = `${rect.bottom + 8}px`;
    cfPanel.style.transformOrigin = 'top left';
  }
}

function cfHint(col: ColData): string {
  if (col.type === 'percent') return 'Percent column: values are percent numbers. Type 12.5 or 12.5% (both mean 12.5%). Fractions such as 0.125 are NOT converted to 12.5%. Empty values match only "is empty".';
  if (col.type === 'number') return 'Number column: 1,234.5 and the suffixes k, m, b, t (1.5b) are understood. Empty values match only "is empty".';
  if (col.type === 'date') return 'Date column: pick a date (compared by day, UTC calendar date). Empty values match only "is empty".';
  if (col.type === 'datetime') return 'Datetime column: a date compares by day, a date with time by the minute (or second). Empty values match only "is empty".';
  if (col.type === 'time') return 'Time column: HH:mm or HH:mm:ss. Empty values match only "is empty".';
  return 'Text is matched case-insensitively. Several conditions combine with AND or OR; values picked above combine with them by AND.';
}

function cfRenderShell(ctx: PopoverCtx): void {
  const col = ctx.col;
  const multi = col.type === 'string' && distinctValues(col) !== null;
  cfPanel.setAttribute('aria-label', `Filter ${col.label}`);
  cfPanel.innerHTML = `
    <div class="cf-head">
      <span class="cf-title" title="${escapeHtml(col.label)}">${escapeHtml(col.label)}</span>
      <span class="cf-type cf-type-${col.type}">${COL_TYPE_LABELS[col.type]}</span>
      <button type="button" class="cf-x" data-close aria-label="Close filter" title="Close (Esc)">✕</button>
    </div>
    <div class="cf-body themed-scroll">
      ${multi ? `<div class="cf-sec" data-sec="values">
        <div class="cf-sec-title">Values</div>
        <div class="dd-search cf-vsearch">
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="9" cy="9" r="5.5"/><path d="m13.5 13.5 3.5 3.5"/></svg>
          <input type="text" class="dd-input cf-vq" placeholder="Search values..." aria-label="Search values" autocomplete="off" spellcheck="false" />
        </div>
        <div class="dd-actions" role="group" aria-label="Bulk actions for the shown values">
          <button type="button" class="dd-act" data-vact="all" title="Pick every shown value">All shown</button>
          <button type="button" class="dd-act" data-vact="none" title="Unpick every shown value">Clear</button>
          <span class="dd-count cf-vcount" aria-live="polite"></span>
        </div>
        <div class="dd-list themed-scroll cf-vlist" role="listbox" aria-multiselectable="true" aria-label="Values of ${escapeHtml(col.label)}"></div>
      </div>` : ''}
      <div class="cf-sec" data-sec="conds">
        <div class="cf-sec-title">Conditions<span class="cf-join" data-join-wrap hidden>match <button type="button" data-join="and" class="dd-seltoggle" aria-pressed="true">all</button><button type="button" data-join="or" class="dd-seltoggle" aria-pressed="false">any</button></span></div>
        <div class="cf-conds"></div>
        <button type="button" class="dd-act cf-add" data-add>+ Add condition</button>
        <p class="cf-hint">${escapeHtml(cfHint(col))}</p>
      </div>
    </div>
    <div class="cf-foot">
      <button type="button" class="dd-act" data-clear-col title="Remove the filter of this column">Clear column</button>
      <span class="cf-foot-count" aria-live="polite"></span>
      <button type="button" class="cf-done" data-close>Done</button>
    </div>`;
}

function cfRenderConds(): void {
  if (!cfCtx) return;
  const ctx = cfCtx;
  const box: any = cfPanel.querySelector('.cf-conds');
  box.innerHTML = cfDraft.conds.map((c, i) => cfCondHtml(ctx, c, i)).join('');
  const joinWrap: any = cfPanel.querySelector('[data-join-wrap]');
  joinWrap.hidden = cfDraft.conds.length < 2;
  cfPanel.querySelectorAll('[data-join]').forEach((button: any) => {
    const on = button.dataset.join === cfDraft.join;
    button.classList.toggle('is-on', on);
    button.setAttribute('aria-pressed', String(on));
  });
  cfPanel.querySelector('[data-add]').hidden = cfDraft.conds.length >= MAX_CONDS;
  cfDraft.conds.forEach((c, i) => cfMarkInvalid(i));
}

/** Red state for a typed value that does not parse (the condition is ignored until it does). */
function cfMarkInvalid(index: number): void {
  if (!cfCtx) return;
  const c = cfDraft.conds[index];
  const row: any = cfPanel.querySelector(`.cf-cond[data-ci="${index}"]`);
  if (!row || !c) return;
  const needs = opInputs(c.op);
  const typed = needs > 0 && (c.a.trim() !== '' || c.b.trim() !== '');
  const bad = typed && !condIsValid(cfCtx.col, c);
  row.querySelectorAll('.cf-in').forEach((input: any) => input.classList.toggle('cf-bad', bad));
  const err: any = row.querySelector('.cf-err');
  err.hidden = !bad;
  err.textContent = bad ? (c.op === 'regex' ? 'Invalid regular expression - ignored' : needs === 2 && (!c.a.trim() || !c.b.trim()) ? 'Both values are needed' : 'Not a valid value - ignored') : '';
}

function cfRenderValues(): void {
  if (!cfCtx) return;
  const list: any = cfPanel.querySelector('.cf-vlist');
  if (!list) return;
  const all = distinctValues(cfCtx.col) || [];
  const tokens = normalizeSearchText(cfValueQuery).split(/\s+/).filter(Boolean);
  const shown = all.filter(item => !tokens.length || tokens.every(token => item.label.toLowerCase().includes(token)));
  const picked = new Set(cfDraft.picks);
  list.innerHTML = shown.length
    ? shown.map(item => `<div class="dd-opt" role="option" data-v="${escapeHtml(item.value)}" aria-selected="${picked.has(item.value)}">
        <span class="dd-check">${DD_TICK}</span>
        <span class="dd-name" title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</span>
        <span class="dd-num">${item.count.toLocaleString('en-US')}</span>
        <button type="button" class="dd-only" data-vonly tabindex="-1" aria-label="Only ${escapeHtml(item.label)}">Only</button>
      </div>`).join('')
    : `<div class="dd-empty">No values match “${escapeHtml(cfValueQuery.trim())}”</div>`;
  const pickedCount = cfDraft.picks.length;
  cfPanel.querySelector('.cf-vcount').textContent = pickedCount ? `${pickedCount} of ${all.length} picked` : `${all.length} values, none picked`;
}

function cfUpdateFooter(): void {
  if (!cfCtx || !cfPanel) return;
  const stat = colStats[cfCtx.scope];
  const text: any = cfPanel.querySelector('.cf-foot-count');
  const active = Boolean(colFilters[cfCtx.scope] && colFilters[cfCtx.scope][cfCtx.key]);
  text.textContent = stat && Object.keys(colFilters[cfCtx.scope] || {}).length ? `${stat.after.toLocaleString('en-US')} of ${stat.before.toLocaleString('en-US')} ${scopeNoun(cfCtx.scope)}` : '';
  cfPanel.querySelector('[data-clear-col]').disabled = !active && !cfDraft.picks.length && !cfDraft.conds.some(c => c.a || c.b || opInputs(c.op) === 0);
}

function cfCommit(): void {
  if (!cfCtx) return;
  clearTimeout(cfCommitTimer);
  const { scope, key, col } = cfCtx;
  const next = normalizeFilter(col, cfDraft);
  const map = colFilters[scope] || (colFilters[scope] = {});
  const before = JSON.stringify(map[key] || null);
  if (next) map[key] = next;
  else delete map[key];
  if (!Object.keys(map).length) delete colFilters[scope];
  if (JSON.stringify(next) === before) { cfUpdateFooter(); return; }
  persistColFilters();
  render();
  cfUpdateFooter();
}

function cfScheduleCommit(): void {
  clearTimeout(cfCommitTimer);
  cfCommitTimer = setTimeout(cfCommit, 160);
}

function cfOnInput(event: any): void {
  const t = event.target;
  if (!cfCtx || !t) return;
  if (t.classList.contains('cf-vq')) { cfValueQuery = t.value; cfRenderValues(); return; }
  const row = t.closest('.cf-cond');
  if (!row || !t.dataset.f || t.dataset.f === 'op') return;
  const index = Number(row.dataset.ci);
  const c = cfDraft.conds[index];
  if (!c) return;
  if (t.dataset.f === 'a') c.a = t.value;
  else c.b = t.value;
  cfMarkInvalid(index);
  cfScheduleCommit();
}

function cfOnChange(event: any): void {
  const t = event.target;
  if (!cfCtx || !t || !t.classList.contains('cf-sel')) return;
  const row = t.closest('.cf-cond');
  const index = Number(row.dataset.ci);
  const c = cfDraft.conds[index];
  if (!c) return;
  c.op = t.value;
  if (opInputs(c.op) < 2) c.b = '';
  if (opInputs(c.op) === 0) c.a = '';
  cfRenderConds();
  const focusTarget: any = cfPanel.querySelector(`.cf-cond[data-ci="${index}"] .cf-in`);
  if (focusTarget) focusTarget.focus({ preventScroll: true });
  cfCommit();
}

function cfOnClick(event: any): void {
  const t = event.target;
  if (!cfCtx || !t || !t.closest) return;
  if (t.closest('[data-close]')) { closeColumnFilter(true); return; }
  if (t.closest('[data-clear-col]')) {
    cfDraft = { join: 'and', conds: [emptyCond(cfCtx.col.type)], picks: [] };
    cfValueQuery = '';
    const q: any = cfPanel.querySelector('.cf-vq');
    if (q) q.value = '';
    cfRenderConds();
    cfRenderValues();
    cfCommit();
    return;
  }
  const join = t.closest('[data-join]');
  if (join) { cfDraft.join = join.dataset.join === 'or' ? 'or' : 'and'; cfRenderConds(); cfCommit(); return; }
  if (t.closest('[data-add]')) {
    if (cfDraft.conds.length < MAX_CONDS) cfDraft.conds.push(emptyCond(cfCtx.col.type));
    cfRenderConds();
    const inputs = cfPanel.querySelectorAll('.cf-cond');
    const last: any = inputs[inputs.length - 1];
    const focusTarget: any = last && last.querySelector('.cf-in');
    if (focusTarget) focusTarget.focus({ preventScroll: true });
    return;
  }
  const del = t.closest('[data-del]');
  if (del) {
    const index = Number(del.closest('.cf-cond').dataset.ci);
    cfDraft.conds.splice(index, 1);
    if (!cfDraft.conds.length) cfDraft.conds.push(emptyCond(cfCtx.col.type));
    cfRenderConds();
    cfCommit();
    return;
  }
  const preset = t.closest('[data-preset]');
  if (preset) {
    const index = Number(preset.closest('.cf-cond').dataset.ci);
    const c = cfDraft.conds[index];
    if (c) { c.a = preset.dataset.preset; cfRenderConds(); cfCommit(); }
    return;
  }
  const act = t.closest('[data-vact]');
  if (act) {
    const all = distinctValues(cfCtx.col) || [];
    const tokens = normalizeSearchText(cfValueQuery).split(/\s+/).filter(Boolean);
    const shown = all.filter(item => !tokens.length || tokens.every(token => item.label.toLowerCase().includes(token))).map(item => item.value);
    const next = new Set(cfDraft.picks);
    if (act.dataset.vact === 'all') shown.forEach(v => next.add(v));
    else shown.forEach(v => next.delete(v));
    cfDraft.picks = [...next];
    cfRenderValues();
    cfCommit();
    return;
  }
  const row = t.closest('.dd-opt');
  if (row && row.dataset.v !== undefined) {
    const value = row.dataset.v;
    if (t.closest('[data-vonly]')) cfDraft.picks = [value];
    else cfDraft.picks = cfDraft.picks.includes(value) ? cfDraft.picks.filter(p => p !== value) : [...cfDraft.picks, value];
    cfRenderValues();
    cfCommit();
  }
}

function openColumnFilter(fKey: string): void {
  const scope = filterScope();
  if (!scope) return;
  const col = scopeCols(scope).find(c => c.key === fKey);
  if (!col) return;
  cfEnsurePanel();
  if (cfCtx && cfCtx.scope === scope && cfCtx.key === fKey) { closeColumnFilter(true); return; }
  if (cfCtx) cfCommit();
  const ctx: PopoverCtx = { scope, key: fKey, col };
  cfCtx = ctx;
  const saved = colFilters[scope] && colFilters[scope][fKey];
  cfDraft = saved
    ? { join: saved.join, conds: saved.conds.map(c => ({ op: c.op, a: c.a, b: c.b })), picks: saved.picks.slice() }
    : { join: 'and', conds: [], picks: [] };
  if (!cfDraft.conds.length) cfDraft.conds.push(emptyCond(col.type));
  cfValueQuery = '';
  clearTimeout(cfCloseTimer);
  cfRenderShell(ctx);
  cfRenderConds();
  cfRenderValues();
  cfUpdateFooter();
  cfPanel.hidden = false;
  cfPlace();
  void cfPanel.offsetWidth; // reflow so the transition starts from the closed state
  cfPanel.classList.add('is-open');
  cfBackdrop.classList.add('is-open');
  const first: any = cfPanel.querySelector('.cf-in') || cfPanel.querySelector('.cf-vq') || cfPanel.querySelector('.cf-sel');
  if (first) first.focus({ preventScroll: true });
  const button: any = cfAnchorEl();
  if (button && button.setAttribute) button.setAttribute('aria-expanded', 'true');
}

function closeColumnFilter(restoreFocus = false): void {
  if (!cfCtx || !cfPanel) return;
  cfCommit();
  const key = cfCtx.key;
  cfCtx = null;
  cfPanel.classList.remove('is-open');
  cfBackdrop.classList.remove('is-open');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  clearTimeout(cfCloseTimer);
  cfCloseTimer = setTimeout(() => { if (!cfCtx) cfPanel.hidden = true; }, reduce ? 0 : 200);
  if (restoreFocus) {
    const button: any = el.tableHead.querySelector(`[data-filter="${key.replace(/["\\]/g, '\\$&')}"]`);
    if (button) button.focus({ preventScroll: true });
  }
}

/** Called at the end of render(): keeps an open popover in sync with the new header and the new counts. */
function syncColumnFilterUi(): void {
  renderFilterBar();
  if (!cfCtx) return;
  if (filterScope() !== cfCtx.scope) { closeColumnFilter(); return; }
  cfUpdateFooter();
  cfPlace();
}

function bindColumnFilterEvents(): void {
  el.tableHead.addEventListener('click', (event: any) => {
    const target = event.target;
    if (!target || typeof target.closest !== 'function') return;
    const button = target.closest('[data-filter]');
    if (!button) return;
    event.stopPropagation();
    openColumnFilter(button.dataset.filter || '');
  });
  el.filterBar.addEventListener('click', (event: any) => {
    const target = event.target;
    if (!target || typeof target.closest !== 'function') return;
    const scope = filterScope();
    if (!scope) return;
    if (target.closest('[data-clear-all]')) { closeColumnFilter(); clearColumnFilters(scope); return; }
    const x = target.closest('[data-chip-x]');
    if (x) { event.stopPropagation(); if (cfCtx && cfCtx.key === x.dataset.chipX) closeColumnFilter(); removeColFilter(scope, x.dataset.chipX); return; }
    const chip = target.closest('[data-chip]');
    if (chip) openColumnFilter(chip.dataset.chip);
  });
  el.filterBar.addEventListener('keydown', (event: any) => {
    const chip = event.target && event.target.matches && event.target.matches('[data-chip]') ? event.target : null;
    if (chip && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openColumnFilter(chip.dataset.chip); }
  });
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
  syncColumnFilterUi();
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

function sortHeader(label: string, key: string, numeric = false, extraClass = '', fKey = key): string {
  const active = state.sortKey === key;
  const arrow = active ? (state.sortDir === 'asc' ? ' ↑' : ' ↓') : '';
  const align = numeric ? ' text-right' : '';
  const tooltip = getHeaderTooltip(label);
  return `<th class="py-3.5 px-4${align}${extraClass ? ' ' + extraClass : ''}" title="${escapeHtml(tooltip)}"><div class="inline-flex items-center gap-1"><button data-sort="${escapeHtml(key)}" title="${escapeHtml(tooltip)}" class="uppercase tracking-wider hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus:text-blue-600 dark:focus:text-blue-400">${escapeHtml(label)}${arrow}</button>${filterButton(fKey)}</div></th>`;
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
          ${terCell(id)}
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

/** Expense ratio cell: NET (terValue) shown, GROSS (terGrossValue) in the tooltip when published. */
function terCell(id: number): string {
  const s = store;
  if (!s) return '';
  const net = s.num.terValue[id];
  const gross = s.num.terGrossValue[id];
  const text = Number.isFinite(net) ? `${net.toFixed(2)}%` : (s.raw[id].ter || DASH);
  const tip = Number.isFinite(gross) ? ` title="Net expense ratio. Gross (before waivers): ${gross.toFixed(2)}%"` : '';
  return `<td class="py-2.5 px-4 text-right font-mono text-slate-700 dark:text-slate-300"${tip}>${escapeHtml(text)}</td>`;
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
  const sig = [state.sortKey, state.sortDir, catalogQuery(), hiddenCategoriesSig(), hiddenBrandsSig(), state.hideStale, state.staleDays, store ? store.version : 0, blacklistVersion, colFilterSig('All')].join('|');
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
    const message = !store || (store.n === 0 && !state.loading && loadedBrandCount() === 0)
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

type HoldingPosition = { fund: string; name: string; identifier: string; weight: number | null; cells: Record<string, unknown> };

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
      weight,
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
          weightSum: null,
          maxWeight: null,
          cusips: [],
          identifier: '',
          searchIndex: '',
        };
        map.set(resolved.key, row);
      }
      if (!row.funds.includes(position.fund)) row.funds.push(position.fund);
      if (position.weight !== null) { // an unpublished weight stays unavailable, never 0
        row.weightSum = (row.weightSum ?? 0) + position.weight;
        row.maxWeight = row.maxWeight === null ? position.weight : Math.max(row.maxWeight, position.weight);
      }
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
  rows.forEach((row, index) => { row.idx = index; }); // position in the column arrays of the column filters
  watchlistCache = { signature, rows };
  return rows;
}

function getVisibleWatchlistRows(): WatchlistRow[] {
  const searched = filterRows(getDedupedWatchlistRows());
  return sortRows(applyRowColumnFilters('watchlist', searched, watchlistCols(), (row: any) => row.idx));
}

function watchlistChunkSignature(rows: WatchlistRow[]): string {
  return [state.sortKey, state.sortDir, currentQuery(), colFilterSig('watchlist')].join('|'); // not the row count: rows stream in while loading
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
        <td class="py-2.5 px-4 text-right font-mono text-slate-700 dark:text-slate-300">${row.weightSum === null ? DASH : `${row.weightSum.toFixed(3)}%`}</td>
        <td class="py-2.5 px-4 text-right font-mono text-slate-700 dark:text-slate-300">${row.maxWeight === null ? DASH : `${row.maxWeight.toFixed(3)}%`}</td>
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

/** Filtered + sorted view of a sheet exactly as the table shows it (also used by the exports). */
function sheetView(headers: string[], sourceRows: string[][]): any[] {
  const searched = filterRows(sourceRows.map((row, sourceIndex) => {
    const cells: Record<string, unknown> = { values: row, searchIndex: row.join(' ').toLowerCase(), rank: sourceIndex };
    headers.forEach((header, index) => { cells[`col${index}`] = row[index] ?? ''; });
    return cells;
  }));
  const scope = filterScope();
  const filtered = scope && scope !== 'All' && scope !== 'watchlist' && colFilters[scope]
    ? applyRowColumnFilters(scope, searched, sheetCols(headers, sourceRows), (item: any) => item.rank)
    : searched;
  if (!scope || !colFilters[scope]) delete colStats[scope || ''];
  return sortRows(filtered);
}

/** Overview rows exactly as the table shows them (filtered + sorted). */
function overviewView(fund: FundRef): any[] {
  return sortRows(filterRows(overviewRows(fund).map(item => ({
    section: item.section,
    metric: item.metric,
    value: item.value === null || item.value === undefined || item.value === '' ? DASH : item.value,
    searchIndex: `${item.section} ${item.metric} ${item.value}`.toLowerCase(),
  }))));
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
  const rows = sheetView(headers, entry.rows);

  el.tableHead.innerHTML = `
    <tr>
      ${indexHeader()}
      ${headers.map((header, index) => sortHeader(header || `Col ${index + 1}`, `col${index}`, NUMERIC_SHEET_HEADERS.includes(header), '', sheetFilterKey(index, header))).join('')}
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
    { section: 'Cost', metric: 'TER (Expense Ratio, net)', value: raw.ter },
    { section: 'Cost', metric: 'TER Gross', value: store && Number.isFinite(store.num.terGrossValue[fund.id]) ? `${store.num.terGrossValue[fund.id].toFixed(2)}%` : raw.terGross },
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
  const rows = overviewView(fund);

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
  const rows = sheetView(headers, sourceRows);

  el.tableHead.innerHTML = `
    <tr>
      ${indexHeader()}
      ${headers.map((header, index) => sortHeader(header, `col${index}`, false, '', sheetFilterKey(index, header))).join('')}
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

/** Rows are exactly the visible (filtered + sorted) table rows; `warning` is set when they are not the whole data. */
function currentExportRows(): { headers: string[]; rows: string[][]; scope: string; warning?: string } {
  if (state.activeTab === 'watchlist') {
    const loading = selectedKeys().some(key => !holdingsComplete.has(key));
    return {
      warning: loading ? 'Holdings of some selected ETFs are still loading or failed to load, so the Watchlist is incomplete. Export it anyway?' : undefined,
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
    const rows = fund ? overviewView(fund) : [];
    return {
      headers: ['Section', 'Metric', 'Value'],
      rows: rows.map(row => [row.section, row.metric, row.value === DASH ? '' : String(row.value ?? '')]),
      scope: fund ? `${fund.ticker}-overview` : 'overview',
    };
  }

  if (state.activeTab === 'detail:distributions') {
    const fund = getActiveFund();
    const meta = fund ? fundMetaCache.get(fund.key) : null;
    const worksheet = meta && meta.distributions ? meta.distributions : { headers: [], rows: [] };
    const dHeaders: string[] = Array.isArray(worksheet.headers) ? worksheet.headers : [];
    return {
      headers: dHeaders,
      rows: sheetView(dHeaders, Array.isArray(worksheet.rows) ? worksheet.rows : []).map((row: any) => row.values),
      scope: fund ? `${fund.ticker}-distributions` : 'distributions',
    };
  }

  if (state.activeTab === 'detail:holdings' || state.activeTab === 'detail:history') {
    const sheet = state.activeTab === 'detail:history' ? 'history' : 'holdings';
    const fund = getActiveFund();
    const entry = fund ? sheetState.get(sheetKey(sheet)) : null;
    if (entry) {
      const partial = entry.nextPage < entry.manifest.pages.length;
      return {
        headers: entry.headers,
        rows: sheetView(entry.headers, entry.rows).map((row: any) => row.values),
        scope: fund ? `${fund.ticker}-${sheet}` : sheet,
        warning: partial ? `Only ${entry.rows.length.toLocaleString('en-US')} of ${(entry.manifest.totalRows || 0).toLocaleString('en-US')} rows are loaded (scroll the table to load more). Export the loaded rows only?` : undefined,
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
  if (state.activeTab === 'watchlist') values = getVisibleWatchlistRows().filter(row => row.key.startsWith('T:')).map(row => row.symbol); // only real tickers, not CUSIP/ISIN/name keys
  else if (isDetailTab(state.activeTab)) { const fund = getActiveFund(); values = fund ? [fund.ticker] : []; } // detail sheets have no ticker column: copy the shown fund's ticker
  else values = catalogIds().map(id => (store ? store.ticker[id] : ''));
  values = values.sort((a, b) => collator.compare(a, b));
  if (!values.length) return;
  void copyText(values.join(', ')).then(ok => {
    const oldText = el.copyBtn.textContent;
    el.copyBtn.textContent = ok ? 'Copied!' : 'Copy failed';
    setTimeout(() => { el.copyBtn.textContent = oldText || 'Copy Tickers'; }, 1000);
  });
}

/** False when the rows are incomplete and the user declined the warning. */
function confirmExport(warning?: string): boolean {
  return !warning || typeof confirm !== 'function' || confirm(warning);
}

function exportCsv(): void {
  const exportData = currentExportRows();
  if (!exportData.rows.length || !confirmExport(exportData.warning)) return;
  downloadText(
    '﻿' + toCsv([exportData.headers, ...exportData.rows.map(row => row.map(cell => String(cell ?? '')))]), // BOM: Excel reads UTF-8
    exportFileName(exportData.scope, 'csv'),
    'text/csv;charset=utf-8;',
  );
}

function exportTxt(): void {
  const exportData = currentExportRows();
  if (!exportData.rows.length || !confirmExport(exportData.warning)) return;
  downloadText([exportData.headers, ...exportData.rows].map(row => row.map(txtCell).join('\t')).join('\n'), exportFileName(exportData.scope, 'txt'), 'text/plain;charset=utf-8;');
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
  bindColumnFilterEvents();

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
  restoreColFilters();
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
