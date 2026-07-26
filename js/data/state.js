// Shared DGP state — single source of truth consumed by all tabs
// The Data tab writes; other tabs subscribe and re-run their own regression/viz

import { generateBeforeDuringData } from './datagen.js';

const DEFAULT_PARAMS = {
  // ── Timeline ──────────────────────────────────────────────────────────
  n:            132,    // Jan 2013 – Dec 2023
  cartelStart:   24,    // Jan 2015 (month index from Jan 2013)
  cartelEnd:     72,    // Jan 2019 (exclusive)
  basePrice:    600,    // £/tonne wholesale apples baseline

  // ── True overcharge ───────────────────────────────────────────────────
  overcharge:    75,    // £/tonne (~12.5%)

  // ── Complexity feature flags (toggled in Tab 1) ───────────────────────
  trendEnabled:        false,
  seasonalityEnabled:  false,
  confoundEnabled:     false,
  macroShockEnabled:   false,
  rampUpEnabled:       false,
  runOffEnabled:       false,
  noiseEnabled:        false,

  // ── Component magnitudes ───────────────────────────────────────────────
  // trend is deliberately steep enough (0.8 £/t/mo ≈ £105 over the sample)
  // that the Regression tab's single best-fit line still tilts visibly
  // upward despite the cartel jump dragging its slope down
  trend:              0.8,    // £/t per month
  trendSq:            0,
  seasonality:        12,     // £/t peak amplitude
  confounderEffect:   2,      // coefficient on input-cost-index confounder
  macroShock:         40,     // £/t step change
  macroShockTiming:   48,     // month 48 = Jan 2017
  rampUp:             6,      // months to reach full overcharge
  runOff:             6,      // months of elevated price post-cartel
  noise:              8,      // £/t std dev of white noise
  ar1:                0,

  seed: 42,
};

export const state = {
  params: { ...DEFAULT_PARAMS },
  data:   null,
  subscribers: new Set(),

  init() {
    this.data = generateBeforeDuringData(this.params);
    return this;
  },

  // Merge patch, regenerate, notify all subscribers
  update(patch) {
    Object.assign(this.params, patch);
    this.data = generateBeforeDuringData(this.params);
    this.subscribers.forEach(fn => fn(this.data, this.params));
  },

  // Merge patch only if something actually differs; returns whether an
  // update (and subscriber notification) happened. Lets story tabs pin the
  // DGP they need on every step render without redundant regenerates.
  ensure(patch) {
    const changed = Object.keys(patch).some(k => this.params[k] !== patch[k]);
    if (changed) this.update(patch);
    return changed;
  },

  // Reseed without changing other params
  reseed(newSeed) {
    this.update({ seed: newSeed });
  },

  subscribe(fn) {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }
};

// The canonical "simplest interesting" DGP for the story tabs (3–5): only
// the time trend on, everything else — including noise — off. Regression
// ends on it and the comparator tabs start from it, so the narrative flows
// tab to tab over the same picture.
export const DGP_TREND_ONLY = {
  trendEnabled:        true,
  seasonalityEnabled:  false,
  confoundEnabled:     false,
  macroShockEnabled:   false,
  rampUpEnabled:       false,
  runOffEnabled:       false,
  noiseEnabled:        false,
};

// Helper: convert month index to label string (e.g. 0 → "2013", 24 → "Jan 2015")
export function monthToLabel(m, format = 'year') {
  const year  = 2013 + Math.floor(m / 12);
  const month = m % 12;
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (format === 'year')      return String(year);
  if (format === 'monthYear') return `${MONTHS[month]} ${year}`;
  return `${MONTHS[month]} ${year}`;
}

// Year-tick values for x-axis (Jan of each year + last month)
export const YEAR_TICKS = [0, 12, 24, 36, 48, 60, 72, 84, 96, 108, 120, 131];

// Tick label for the full 132-month axis (The Data / Regression / Time
// Comparator tabs). Every tick except the last is Jan-of-that-year, so
// `monthToLabel` labels it correctly; the last tick is Dec 2023 (one month
// short of a year boundary), which would otherwise repeat "2023" right next
// to the Jan-2023 tick. Label it as the year it's the edge of instead.
export function yearTickFormat(m) {
  return m === YEAR_TICKS[YEAR_TICKS.length - 1] ? monthToLabel(m + 1) : monthToLabel(m);
}

// Fixed £/tonne Y-axis bounds, shared by every price chart in the app (Tabs
// 2-5) so the scale never jumps between resamples, complexity toggles, or
// story steps. Sized to comfortably contain basePrice (600) plus the worst
// case stack of every complexity component and the overcharge at once,
// with headroom to spare — see js/data/state.js DEFAULT_PARAMS for the
// magnitudes this was checked against.
export const PRICE_Y_DOMAIN = [480, 870];
