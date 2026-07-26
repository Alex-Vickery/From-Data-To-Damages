// Tab 5 — Geographic Comparator (Difference-in-Differences)
// Starts from the same trend-only data as the Regression and Time Comparator
// tabs. Treated series = shared state.data (apple growers' cartel).
// Comparator series = synthetic non-cartelised apple market (e.g. Ireland).
// A mechanical DiD walkthrough first (comparator → averages → first
// differences → DiD estimate), then two closing pitfalls: umbrella pricing
// contaminating the comparator, and a parallel-trends violation.

import {
  state,
  DGP_TREND_ONLY,
  monthToLabel,
  YEAR_TICKS,
  PRICE_Y_DOMAIN,
} from "../data/state.js";
import { generateBeforeDuringData } from "../data/datagen.js";
import { ols } from "../math/ols.js";
import {
  createChart,
  bindLine,
  bindRegion,
  bindArea,
  bindEventLine,
  bindGroupAvgLines,
  bindDiffBracket,
  createLegend,
} from "../ui/charts.js";
import { createStoryController } from "../ui/story-controller.js";
import {
  createStoryLayout,
  createStoryBottomBar,
  createOcCard,
  createModelFitCard,
  createSectionHeading,
} from "../ui/components.js";
import { buildDidEquationHTML } from "../ui/equation-builder.js";

// Gentle enough that the diverging comparator series stays inside the
// fixed PRICE_Y_DOMAIN (over the now-truncated Dec-2018 window), steep
// enough to be clearly visible
const PT_EXTRA_SLOPE = 1.2; // £/t per month

const STEPS = [
  {
    label: "Meet the comparator market",
    caption:
      "A geographic comparator uses the evolution of prices in a separate, uncartelised market to represent the counterfactual.",
    reveals: { comparator: true },
    violations: {},
    includeGroupTrend: false,
  },
  {
    label: "Mark the period averages",
    caption:
      "The geographic comparator approach — known as difference-in-differences — is built from just four numbers.",
    reveals: { comparator: true, avgLines: true },
    violations: {},
    includeGroupTrend: false,
  },
  {
    label: "Take first differences",
    caption:
      "Subtracting the comparator’s price shift from the cartelised market’s price shift cancels out their shared trends.",
    reveals: { comparator: true, avgLines: true, diff1: true },
    violations: {},
    includeGroupTrend: false,
  },
  {
    label: "Pitfall: umbrella pricing",
    tone: "warn",
    caption:
      "If cartelised prices leak into the comparator market (umbrella effects), the Difference-in-Differences approach fails.",
    reveals: { comparator: true, avgLines: true, diff1: true, did: true },
    violations: { contamination: true },
    includeGroupTrend: false,
  },
  {
    label: "Pitfall: parallel trends",
    tone: "bad",
    caption:
      "If the markets were actually on different trajectories, the model wrongly attributes that divergence to the cartel.",
    reveals: { comparator: true, avgLines: true, diff1: true },
    violations: { trendDivergence: true },
    includeGroupTrend: false,
  },
];

export function createGeoComparatorTab(container) {
  // The story only ever compares the cartel window to its own pre-period —
  // there's nothing to show past the cartel's end, so the plotted data
  // truncates there (Dec 2018) rather than running out to the full
  // 132-month domain.
  const CUTOFF = state.params.cartelEnd - 1;
  // The AXIS itself extends a little further than the data — just enough
  // that the "Dec 2018" event label and a "2019" tick both have clearance
  // from the right edge instead of clipping against it. Nothing is plotted
  // in this extra margin; only the coordinate system is wider.
  const AXIS_MAX = CUTOFF + 9;

  const { storyMain, storyBottom, sidePanel } = createStoryLayout(container);

  // ── Chart + bare equation ───────────────────────────────────────────────
  const mainChartWrap = document.createElement("div");
  mainChartWrap.className = "main-chart-container";
  storyMain.appendChild(mainChartWrap);

  const eqPanel = document.createElement("div");
  eqPanel.className =
    "equation-panel equation-panel--static equation-panel--bare";
  storyMain.appendChild(eqPanel);

  // ── Metrics sidebar content: same components as The Data tab ──────────
  createSectionHeading(sidePanel, "Overcharge Summary");
  const ocCard = createOcCard(sidePanel, {
    estimateLabel: "Estimated Overcharge",
  });

  createSectionHeading(sidePanel, "Model Fit");
  const modelFit = createModelFitCard(sidePanel);

  const { caption, storyWrap } = createStoryBottomBar(storyBottom);

  // ── Chart ─────────────────────────────────────────────────────────────
  const mainChart = createChart(mainChartWrap, {
    xLabel: "",
    yLabel: "£ / tonne",
    title: "The Cartelists’ Average Prices vs Prices From A Comparator Market",
    // marginTop/Bottom match The Data tab exactly — at the old 28/36 the
    // "Jan 2015"/"Dec 2018" event labels sat almost on top of the title
    marginTop: 48,
    marginBottom: 38,
    marginLeft: 56,
    marginRight: 20,
    xTickValues: YEAR_TICKS.filter((v) => v <= AXIS_MAX),
    xTickFormat: (d) => monthToLabel(d),
    hoverFormatX: (m) => monthToLabel(m, "monthYear"),
  });

  const updateTreated = bindLine(mainChart, "treated", {
    color: "var(--clr-observed)",
    hover: {
      label: "Cartelists’ Average Price",
      note: "The average price charged by the cartelists in the cartelised market.",
    },
  });
  const updateComparator = bindLine(mainChart, "comparator", {
    color: "var(--clr-secondary)",
    hover: {
      label: "Comparator Market Price",
      note: "The average price charged for the same product in a non-cartelisted comparator market.",
    },
  });
  // Shaded bands over the cartel window making each market's first
  // difference (pre-average → during-average) a visible area
  const updateDiffBandT = bindArea(mainChart, "diffT", {
    color: "color-mix(in srgb, var(--clr-observed) 10%, transparent)",
  });
  const updateDiffBandC = bindArea(mainChart, "diffC", {
    color: "color-mix(in srgb, var(--clr-comparator) 16%, transparent)",
  });
  const updateCartelRegion = bindRegion(mainChart, "cartel", {
    color: "var(--clr-cartel)",
  });
  const updateGroupAvgLines = bindGroupAvgLines(mainChart);
  const updateStartLine = bindEventLine(mainChart, "start", {
    color: "var(--clr-cartel-border)",
    label: "Jan 2015",
  });
  const updateEndLine = bindEventLine(mainChart, "end", {
    color: "var(--clr-cartel-border)",
    label: "Dec 2018",
  });
  const updateBracketT = bindDiffBracket(mainChart, "bT", {
    color: "var(--clr-observed)",
  });
  const updateBracketC = bindDiffBracket(mainChart, "bC", {
    color: "var(--clr-primary)",
  });

  // ── Generate comparator series ────────────────────────────────────────────
  function generateComparator(violations) {
    const p = state.params;
    const compParams = {
      ...p,
      // Umbrella pricing: comparator sees partial overcharge (~20%) during cartel period
      overcharge: violations.contamination ? p.overcharge * 0.2 : 0,
      rampUpEnabled: false,
      runOffEnabled: false,
      basePrice: p.basePrice - 60,
      seed: p.seed + 500,
    };
    const data = generateBeforeDuringData(compParams);
    if (violations.trendDivergence) {
      // Parallel-trends violation: the COMPARATOR is given a shallower
      // pre-existing path (not the treated series, which stays fixed) —
      // the growing gap this opens up is what DiD wrongly credits to the cartel
      const adjustedPrice = data.price.map((v, t) => v - PT_EXTRA_SLOPE * t);
      return { ...data, price: adjustedPrice };
    }
    return data;
  }

  // The treated series is always the untouched shared data — every
  // violation in this story is implemented via the comparator instead, so
  // the treated line is a stable visual anchor across every step.
  function treatedSeriesFor() {
    return [...state.data.price];
  }

  // ── DiD OLS ───────────────────────────────────────────────────────────────
  // The pure 2×2 estimator the story builds by hand: sample restricted to
  // the pre + during window (run-off-era months excluded) and no
  // common-trend column, so the OLS "did" coefficient equals ΔT − ΔC
  // exactly — including when a violation inflates it, which a common trend
  // or a wider sample would partially absorb and hide.
  function buildDidMatrix(
    treatedPrices,
    compPrices,
    n,
    cartelStart,
    cartelEnd,
    includeGroupTrend,
  ) {
    const Y = [];
    const X = [];

    for (let g = 0; g < 2; g++) {
      const prices = g === 0 ? treatedPrices : compPrices;
      for (let t = 0; t < cartelEnd; t++) {
        const treated = g === 0 ? 1 : 0;
        const during = t >= cartelStart ? 1 : 0;
        const did = treated * during;
        const row = [];
        if (includeGroupTrend) row.push(treated * t);
        row.push(treated, during, did);
        X.push(row);
        Y.push(prices[t]);
      }
    }

    const fullNames = ["intercept"];
    if (includeGroupTrend) fullNames.push("group trend");
    fullNames.push("treated", "during", "did");

    return { X, Y, names: fullNames };
  }

  // ── Pipeline ──────────────────────────────────────────────────────────────
  function runPipeline() {
    const d = state.data;
    const p = state.params;
    const idx = storyController.getActiveIndex();
    if (!d || idx < 0) return;

    const step = STEPS[idx];
    const reveals = step.reveals;
    const violations = step.violations;

    const compData = generateComparator(violations);
    const treatedPrices = treatedSeriesFor();

    const { X, Y, names } = buildDidMatrix(
      treatedPrices,
      compData.price,
      p.n,
      p.cartelStart,
      p.cartelEnd,
      step.includeGroupTrend,
    );
    const result = ols(Y, X, { addIntercept: true, robust: true, names });

    // The axis extends a little past the cartel window (AXIS_MAX) so the
    // "Dec 2018" label and the 2019 tick have breathing room; the data
    // itself (below) still stops exactly at the cartel window (CUTOFF)
    mainChart.updateAxes([0, AXIS_MAX], PRICE_Y_DOMAIN);

    const tData = d.t
      .slice(0, CUTOFF + 1)
      .map((t, i) => ({ t, price: treatedPrices[i] }));
    const cData = d.t
      .slice(0, CUTOFF + 1)
      .map((t, i) => ({ t, price: compData.price[i] }));

    updateTreated(
      tData,
      (e) => e.t,
      (e) => e.price,
    );
    updateCartelRegion(p.cartelStart, p.cartelEnd - 1);
    updateStartLine(p.cartelStart, true);
    updateEndLine(p.cartelEnd - 1, true);
    updateComparator(
      reveals.comparator ? cData : [],
      (e) => e.t,
      (e) => e.price,
    );

    const cartelSpan = p.cartelEnd - p.cartelStart;
    const tPre = p.cartelStart
      ? treatedPrices.slice(0, p.cartelStart).reduce((s, v) => s + v, 0) /
        p.cartelStart
      : 0;
    const tDur = cartelSpan
      ? treatedPrices
          .slice(p.cartelStart, p.cartelEnd)
          .reduce((s, v) => s + v, 0) / cartelSpan
      : 0;
    const cPre = p.cartelStart
      ? compData.price.slice(0, p.cartelStart).reduce((s, v) => s + v, 0) /
        p.cartelStart
      : 0;
    const cDur = cartelSpan
      ? compData.price
          .slice(p.cartelStart, p.cartelEnd)
          .reduce((s, v) => s + v, 0) / cartelSpan
      : 0;

    updateGroupAvgLines(
      reveals.avgLines
        ? [
            {
              id: "tpre",
              y: tPre,
              x0: 0,
              x1: p.cartelStart,
              color: "var(--clr-observed)",
              label: `Cartelists’ before: £${tPre.toFixed(0)}`,
            },
            {
              id: "tdur",
              y: tDur,
              x0: p.cartelStart,
              x1: p.cartelEnd,
              color: "var(--clr-observed)",
              label: `Cartelists’ during: £${tDur.toFixed(0)}`,
            },
            {
              id: "cpre",
              y: cPre,
              x0: 0,
              x1: p.cartelStart,
              color: "var(--clr-secondary)",
              label: `Comparator before: £${cPre.toFixed(0)}`,
            },
            {
              id: "cdur",
              y: cDur,
              x0: p.cartelStart,
              x1: p.cartelEnd,
              color: "var(--clr-secondary)",
              label: `Comparator during: £${cDur.toFixed(0)}`,
            },
          ]
        : [],
      !!reveals.avgLines,
    );

    const diff1T = tDur - tPre;
    const diff1C = cDur - cPre;
    const span = p.cartelEnd - p.cartelStart;
    updateBracketT(
      p.cartelStart + span * 0.72,
      tPre,
      tDur,
      `Δ = ${diff1T >= 0 ? "+" : ""}£${diff1T.toFixed(1)}`,
      !!reveals.diff1,
    );
    updateBracketC(
      p.cartelStart + span * 0.28,
      cPre,
      cDur,
      `Δ = ${diff1C >= 0 ? "+" : ""}£${diff1C.toFixed(1)}`,
      !!reveals.diff1,
    );

    // Shaded first-difference bands over the cartel window: each market's
    // pre-average → during-average change as a visible area, so the DiD is
    // literally the difference between the two band heights
    const bandData = [
      { t: p.cartelStart, lo: 0, hi: 0 },
      { t: p.cartelEnd - 1, lo: 0, hi: 0 },
    ];
    updateDiffBandT(
      bandData.map((b) => ({ ...b, lo: tPre, hi: tDur })),
      (e) => e.t,
      (e) => e.lo,
      (e) => e.hi,
      !!reveals.diff1,
    );
    updateDiffBandC(
      bandData.map((b) => ({ ...b, lo: cPre, hi: cDur })),
      (e) => e.t,
      (e) => e.lo,
      (e) => e.hi,
      !!reveals.diff1,
    );

    eqPanel.innerHTML = buildDidEquationHTML({
      includeTrend: false,
      includeGroupTrend: !!step.includeGroupTrend,
    });

    createLegend(
      mainChart,
      [
        { label: "Cartelists’ Price", color: "var(--clr-observed)" },
        {
          label: "Comparator Price",
          color: "var(--clr-secondary)",
        },
      ],
      // Anchored to the plot's top-left (north-west) corner instead of the
      // default top-right — this chart's prices sit well below the y-axis
      // max, so the top-left corner is empty space with nothing to clash
      // with, unlike the top-right where the "Dec 2018" event label lives.
      { anchor: "start", xOffset: 0, yOffset: 4 },
    );

    const didIdx = result.names.indexOf("did");
    ocCard.update(p.overcharge, didIdx >= 0 ? result.beta[didIdx] : null);
    modelFit.update(result, "did", p.overcharge);
  }

  // ── Story controller ──────────────────────────────────────────────────────
  const storySteps = STEPS.map((step) => ({
    label: step.label,
    render: () => {
      caption.set(step.caption, step.tone || null);
      // This tab's story is written for the trend-only DGP; pin it. If that
      // changed the shared state the subscriber redraws, otherwise draw now.
      if (!state.ensure(DGP_TREND_ONLY)) runPipeline();
    },
  }));
  const storyController = createStoryController(storyWrap, {
    steps: storySteps,
    chartWrapper: mainChart.wrapper,
  });

  state.subscribe(() => runPipeline());

  // Deferred past the chart's own setTimeout(resize, 0) so the first render
  // measures the container correctly instead of at zero size.
  setTimeout(() => storyController.goTo(0), 80);

  return {
    resample: () => state.reseed((state.params.seed || 42) + 1),
    presetBar: storyController,
    onShow: () => {
      mainChart.resize();
      if (!state.ensure(DGP_TREND_ONLY)) runPipeline();
    },
  };
}
