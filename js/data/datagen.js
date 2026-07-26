// Data-generating process for the shared apple-growers' cartel scenario
//
// p_t = basePrice
//       + trend * t                                (if trendEnabled)
//       + seasonality * cos(2πt/12)               (if seasonalityEnabled)
//       + confounderEffect * (Z_t − 50)           (if confoundEnabled — input cost index)
//       + macroShock * I(t >= macroShockTiming)   (if macroShockEnabled — import cost shock)
//       + overchargeEff(t)                         (cartel effect with optional ramp/run-off)
//       + ε_t                                      (if noiseEnabled)

import { seedableRNG, normalRandom, ar1Process } from '../math/distributions.js';

export function generateBeforeDuringData(params = {}) {
  const {
    n            = 132,
    cartelStart  = 24,
    cartelEnd    = 72,
    basePrice    = 120,
    trend        = 0.08,
    trendSq      = 0,
    seasonality  = 5,
    overcharge   = 15,
    confounderEffect = 0.8,
    noise        = 5,
    ar1          = 0,
    seed         = 42,

    // Feature flags
    trendEnabled       = true,
    seasonalityEnabled = true,
    confoundEnabled    = false,
    macroShockEnabled  = false,
    macroShock         = 8,
    macroShockTiming   = 48,
    rampUpEnabled      = false,
    rampUp             = 6,
    runOffEnabled      = false,
    runOff             = 6,
    noiseEnabled       = true,
  } = params;

  const effectiveTrend    = trendEnabled       ? trend           : 0;
  const effectiveSeason   = seasonalityEnabled ? seasonality     : 0;
  const effectiveConf     = confoundEnabled    ? confounderEffect : 0;
  const effectiveNoise    = noiseEnabled       ? noise           : 0.3;

  const rng = seedableRNG(seed);

  const errors = ar1 > 0
    ? ar1Process(n, ar1, effectiveNoise, rng)
    : Array.from({ length: n }, () => normalRandom(rng) * effectiveNoise);

  // Input-cost-index confounder (fertiliser/energy/packaging): rises with trend, bumps during cartel period
  const confounder = new Float64Array(n);
  const confRng = seedableRNG(seed + 1000);
  for (let t = 0; t < n; t++) {
    const base = 50 + 0.2 * t + normalRandom(confRng) * 1.5;
    const bump = (t >= cartelStart && t < cartelEnd) ? 10 : 0;
    confounder[t] = base + bump;
  }

  const time             = new Float64Array(n);
  const price            = new Float64Array(n);
  const cartelDummy      = new Float64Array(n);
  const trueCounterfactual  = new Float64Array(n);
  const seasonalComponent   = new Float64Array(n);
  const trendComponent      = new Float64Array(n);
  const overchargeComponent = new Float64Array(n);

  for (let t = 0; t < n; t++) {
    time[t]       = t;
    cartelDummy[t] = (t >= cartelStart && t < cartelEnd) ? 1 : 0;

    trendComponent[t]  = effectiveTrend * t + trendSq * t * t / n;
    seasonalComponent[t] = effectiveSeason * Math.cos(2 * Math.PI * t / 12);
    const confContrib  = effectiveConf * (confounder[t] - 50);
    const macroContrib = (macroShockEnabled && t >= macroShockTiming) ? macroShock : 0;

    // Overcharge with optional ramp-up during cartel and run-off after
    let overchargeEff = 0;
    if (t >= cartelStart && t < cartelEnd) {
      if (rampUpEnabled && rampUp > 0) {
        overchargeEff = overcharge * Math.min(1, (t - cartelStart + 1) / rampUp);
      } else {
        overchargeEff = overcharge;
      }
    } else if (runOffEnabled && runOff > 0 && t >= cartelEnd && t < cartelEnd + runOff) {
      overchargeEff = overcharge * Math.max(0, 1 - (t - cartelEnd) / runOff);
    }
    overchargeComponent[t] = overchargeEff;

    const butFor = basePrice + trendComponent[t] + seasonalComponent[t] + confContrib + macroContrib;
    trueCounterfactual[t] = butFor;
    price[t]              = butFor + overchargeEff + errors[t];
  }

  return {
    t: Array.from(time),
    price: Array.from(price),
    cartelDummy: Array.from(cartelDummy),
    confounder: Array.from(confounder),
    trueCounterfactual: Array.from(trueCounterfactual),
    seasonalComponent: Array.from(seasonalComponent),
    trendComponent: Array.from(trendComponent),
    overchargeComponent: Array.from(overchargeComponent),
    trueParams: {
      ...params, overcharge, n, cartelStart, cartelEnd, basePrice,
      trend, trendSq, seasonality, confounderEffect, noise, ar1
    }
  };
}

// Individual cartel-member price series around the plotted average.
// Offsets and idiosyncratic noise are de-meaned per month so the member
// mean equals data.price exactly — toggling members must not move the
// average line. Deterministic in params.seed so Resample stays coherent.
//
// Offsets are scaled down during the cartel period (coordination compresses
// the spread between members) and back up outside it — so the growers look
// more visibly distinct from one another before/after the cartel than they
// do while colluding.
const RAW_OFFSETS = [28, 10.5, -14, -24.5];
const CARTEL_OFFSET_MULT = 0.4;

export function generateMemberSeries(data, params = {}, nMembers = 4) {
  const { seed = 42 } = params;
  const n = data.price.length;

  const offsets = Array.from({ length: nMembers }, (_, m) => RAW_OFFSETS[m % RAW_OFFSETS.length]);

  const noiseScale = 4;
  const rngs  = Array.from({ length: nMembers }, (_, m) => seedableRNG(seed + 2000 + m));
  const noise = rngs.map(rng => Array.from({ length: n }, () => normalRandom(rng) * noiseScale));

  const series = Array.from({ length: nMembers }, () => new Array(n));
  for (let t = 0; t < n; t++) {
    const mult = data.cartelDummy[t] === 1 ? CARTEL_OFFSET_MULT : 1;
    const offsetsAtT = offsets.map(o => o * mult);
    const offMeanAtT = offsetsAtT.reduce((a, b) => a + b, 0) / nMembers;

    let meanE = 0;
    for (let m = 0; m < nMembers; m++) meanE += noise[m][t];
    meanE /= nMembers;
    for (let m = 0; m < nMembers; m++) {
      series[m][t] = data.price[t] + (offsetsAtT[m] - offMeanAtT) + (noise[m][t] - meanE);
    }
  }
  return series;
}

// Build a panel (grower × month) OLS design matrix for the Time Comparator.
//
// All 4 growers are cartelists here (no untreated comparator — that's the
// Geographic Comparator's job), so a full set of per-period time dummies, or
// year dummies, would be exactly collinear with the cartel dummy (cartelStart/
// cartelEnd align to whole calendar years). The columns below are the
// realistic, non-collinear alternative an economist would actually reach for:
// grower fixed effects (varies across i, not t), month-of-year fixed effects
// (repeats every 12 months, so it never aligns with the 4-year cartel block),
// a genuine cost-index control, a one-off shock dummy, the cartel dummy, and
// separate annual run-off dummies.
//
// IMPORTANT: column order must mirror js/ui/equation-builder.js's
// buildPanelEquationHTML (grower FE, month FE, trend, cost index, shock,
// cartel, run-off years) — keep the two files in step.
export function buildPanelMatrix(memberSeries, data, spec = {}) {
  const {
    nMembers            = memberSeries.length,
    includeMemberFE     = false,
    includeMonthFE      = false,
    includeTrend        = false,
    includeCostControl  = false,
    includeShockControl = false,
    includeCartelDummy  = true,
    extendCartelDummy   = false,
    runOffYearDummies   = 0,
    cartelStart         = 24,
    cartelEnd           = 72,
    runOffMonths        = 0,
    macroShockTiming    = 48,
  } = spec;

  const n = data.t.length;
  const Y = [];
  const X = [];

  for (let i = 0; i < nMembers; i++) {
    for (let t = 0; t < n; t++) {
      const row = [];

      if (includeMemberFE) {
        for (let m = 1; m < nMembers; m++) row.push(i === m ? 1 : 0);
      }
      if (includeMonthFE) {
        for (let mo = 1; mo < 12; mo++) row.push((t % 12) === mo ? 1 : 0);
      }
      if (includeTrend)        row.push(t);
      if (includeCostControl)  row.push(data.confounder[t] - 50);
      if (includeShockControl) row.push(t >= macroShockTiming ? 1 : 0);

      if (includeCartelDummy) {
        if (extendCartelDummy) {
          // Wrongly extend the cartel dummy to cover run-off too
          row.push((t >= cartelStart && t < cartelEnd + runOffMonths) ? 1 : 0);
        } else {
          row.push(data.cartelDummy[t]);
        }
      }

      if (!extendCartelDummy) {
        for (let j = 0; j < runOffYearDummies; j++) {
          const lo = cartelEnd + j * 12;
          const hi = Math.min(cartelEnd + (j + 1) * 12, cartelEnd + runOffMonths);
          row.push((t >= lo && t < hi) ? 1 : 0);
        }
      }

      X.push(row);
      Y.push(memberSeries[i][t]);
    }
  }

  const names = [];
  if (includeMemberFE)     for (let m = 1; m < nMembers; m++) names.push(`grower${m + 1}`);
  if (includeMonthFE)      for (let mo = 1; mo < 12; mo++) names.push(`month${mo + 1}`);
  if (includeTrend)        names.push('trend');
  if (includeCostControl)  names.push('cost index');
  if (includeShockControl) names.push('shock');
  if (includeCartelDummy)  names.push('cartel');
  if (!extendCartelDummy)  for (let j = 0; j < runOffYearDummies; j++) names.push(`run-off y${j + 1}`);

  return { X, Y, names };
}
