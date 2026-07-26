// Tab 4 — Time Comparator
// Picks up exactly where the Regression tab ends: the same trend-only data,
// now treated as a panel of three growers with a cartel dummy. Each concept
// is a break→fix pair: the omitted cost driver (omitted-variable bias), the
// wrongly-stretched cartel dummy, and ignored run-off contaminating the
// clean baseline — closing with every complexity switched on and correctly
// specified to show regression still recovers the truth.

import {
  state,
  DGP_TREND_ONLY,
  monthToLabel,
  YEAR_TICKS,
  PRICE_Y_DOMAIN,
  yearTickFormat,
} from "../data/state.js";
import { generateMemberSeries, buildPanelMatrix } from "../data/datagen.js";
import { ols } from "../math/ols.js";
import {
  createChart,
  bindLine,
  bindRegion,
  bindResidualLines,
  bindEventLine,
  bindArea,
  bindMemberLines,
  createLegend,
} from "../ui/charts.js";
import {
  createStoryLayout,
  createStoryBottomBar,
  createOcCard,
  createModelFitCard,
  createSectionHeading,
} from "../ui/components.js";
import { createStoryController } from "../ui/story-controller.js";
import { buildPanelEquationHTML } from "../ui/equation-builder.js";

// Start state = the Regression tab's end state (time trend only), with a
// long 18-month run-off standing by for the mistake steps
const M4_BASE = { ...DGP_TREND_ONLY, runOff: 18 };

// Every model includes the cartel dummy, grower FE, and the time trend the
// data has carried since Tab 2
const MODEL_CORE = {
  includeCartelDummy: true,
  includeMemberFE: true,
  includeTrend: true,
};

const STEPS = [
  {
    label: "Picking up where regression left off",
    caption:
      "Using a cartel dummy assumes that the clean periods are a suitable baseline for estimating the overcharge.",
    dgp: { ...M4_BASE },
    model: { ...MODEL_CORE },
    reveals: { fitted: true, ocArea: true, residuals: true },
  },
  {
    label: "Cartels don’t end cleanly: the run-off",
    tone: "bad",
    caption:
      'Ignoring the "run-off" period pulls the clean baseline upward, underestimating the true overcharge.',
    dgp: { ...M4_BASE, runOffEnabled: true },
    model: { ...MODEL_CORE },
    reveals: { fitted: true, ocArea: true, residuals: true },
  },
  {
    label: "A tempting shortcut: stretch the dummy",
    tone: "bad",
    caption:
      "Extending the cartel dummy through the run-off period doesn't fix the issue.",
    dgp: { ...M4_BASE, runOffEnabled: true },
    model: { ...MODEL_CORE, extendCartelDummy: true },
    reveals: { fitted: true, ocArea: true, residuals: true },
  },
  {
    label: "Fix: annual run-off dummies",
    caption:
      "Including separate annual run-off dummies lets the model track the decaying prices.",
    dgp: { ...M4_BASE, runOffEnabled: true },
    model: { ...MODEL_CORE, runOffYearDummies: 2 },
    reveals: { fitted: true, ocArea: true, residuals: true },
  },
  {
    label: "A hidden cost driver",
    tone: "warn",
    caption:
      "If unmodeled input costs spike during the cartel, that effect leaks into the cartel coefficient.",
    dgp: { ...M4_BASE, runOffEnabled: true, confoundEnabled: true },
    model: { ...MODEL_CORE, runOffYearDummies: 2 },
    reveals: { fitted: true, ocArea: true, residuals: true },
  },
  {
    label: "Fix: control for input costs",
    caption:
      "Adding the cost variable to the model isolates its effect, removing the bias.",
    dgp: { ...M4_BASE, runOffEnabled: true, confoundEnabled: true },
    model: { ...MODEL_CORE, includeCostControl: true, runOffYearDummies: 2 },
    reveals: { fitted: true, ocArea: true, residuals: true },
  },
  {
    label: "Everything on — and it still works",
    caption:
      "A fully and correctly specified model accurately isolates the overcharge even in messy data.",
    dgp: {
      ...M4_BASE,
      confoundEnabled: true,
      runOffEnabled: true,
      seasonalityEnabled: true,
      macroShockEnabled: true,
    },
    model: {
      ...MODEL_CORE,
      includeMonthFE: true,
      includeCostControl: true,
      includeShockControl: true,
      runOffYearDummies: 2,
    },
    reveals: { fitted: true, ocArea: true, residuals: true },
  },
];

function avgAcrossGrowers(flat, nMembers, n) {
  const out = new Array(n).fill(0);
  for (let t = 0; t < n; t++) {
    let s = 0;
    for (let i = 0; i < nMembers; i++) s += flat[i * n + t];
    out[t] = s / nMembers;
  }
  return out;
}

export function createTimeComparatorTab(container) {
  const { storyMain, storyBottom, sidePanel } = createStoryLayout(container);

  // ── Chart + bare equation ───────────────────────────────────────────────
  const mainChartWrap = document.createElement("div");
  mainChartWrap.className = "main-chart-container";
  storyMain.appendChild(mainChartWrap);

  const eqPanel = document.createElement("div");
  eqPanel.className =
    "equation-panel equation-panel--static equation-panel--bare";
  storyMain.appendChild(eqPanel);

  const mainChart = createChart(mainChartWrap, {
    xLabel: "",
    yLabel: "£ / tonne",
    title: "The Cartelists’ Average Prices",
    // marginTop/Bottom match The Data tab exactly — at the old 28/36 the
    // "Jan 2015"/"Dec 2018" event labels sat almost on top of the title
    marginTop: 48,
    marginBottom: 38,
    marginLeft: 56,
    marginRight: 20,
    xTickValues: YEAR_TICKS,
    xTickFormat: yearTickFormat,
    hoverFormatX: (m) => monthToLabel(m, "monthYear"),
  });

  const updateObserved = bindLine(mainChart, "obs", {
    color: "var(--clr-observed)",
    hover: {
      label: "Cartelists’ Average Price",
      note: "The price we actually observe in practice, equal to the average price charged by the cartelists.",
    },
  });
  const updateFitted = bindLine(mainChart, "fit", {
    color: "var(--clr-fitted)",
    dashArray: "6,3",
    hover: {
      label: "Predicted Price",
      note: "The prices predicted by the current model specification.",
    },
  });
  const updateCounterfactual = bindLine(mainChart, "cf", {
    color: "var(--clr-counterfactual)",
    hover: {
      label: "Counterfactual Price",
      note: "The price that would have prevailed but-for the cartel.",
    },
  });
  const updateCartelRegion = bindRegion(mainChart, "cartel", {
    color: "var(--clr-cartel)",
  });
  const updateCartelStart = bindEventLine(mainChart, "start", {
    color: "var(--clr-cartel-border)",
    label: "Jan 2015",
  });
  const updateCartelEnd = bindEventLine(mainChart, "end", {
    color: "var(--clr-cartel-border)",
    label: "Dec 2018",
  });
  const showResidLines = bindResidualLines(mainChart, "resid", {
    color: "var(--clr-residual)",
  });
  const updateOCArea = bindArea(mainChart, "oc", {
    color: "color-mix(in srgb, var(--clr-counterfactual) 15%, transparent)",
  });
  const updateMembers = bindMemberLines(mainChart, "members");

  // ── Metrics sidebar: same components as The Data tab's Overcharge check ─
  createSectionHeading(sidePanel, "Overcharge Summary");
  const ocCard = createOcCard(sidePanel, {
    estimateLabel: "Estimated Overcharge",
  });

  createSectionHeading(sidePanel, "Model Fit");
  const modelFit = createModelFitCard(sidePanel);

  const { caption, storyWrap } = createStoryBottomBar(storyBottom);

  // ── Shared per-step computation ────────────────────────────────────────
  function computeStepSeries(step, d, p) {
    const nMembers = 3; // matches the 3 cartelist firms in the Supply Chain tab
    const memberSeries = generateMemberSeries(d, p, nMembers);
    const spec = {
      ...step.model,
      cartelStart: p.cartelStart,
      cartelEnd: p.cartelEnd,
      runOffMonths: p.runOff || 0,
      macroShockTiming: p.macroShockTiming || 48,
    };
    const { X, Y, names } = buildPanelMatrix(memberSeries, d, spec);
    const result = ols(Y, X, {
      addIntercept: true,
      robust: true,
      names: ["intercept", ...names],
    });

    const fitted = result.fitted;
    const overchargeCols = names.filter(
      (nm) => nm === "cartel" || nm.startsWith("run-off"),
    );
    const overchargeColIdx = overchargeCols.map((nm) => names.indexOf(nm));
    const overchargeBetas = overchargeCols.map(
      (nm) => result.beta[result.names.indexOf(nm)],
    );

    const counterfactualFlat = fitted.map((f, r) => {
      let sub = 0;
      overchargeColIdx.forEach((colIdx, k) => {
        sub += overchargeBetas[k] * X[r][colIdx];
      });
      return f - sub;
    });

    const n = d.t.length;
    return {
      result,
      memberSeries,
      fittedAvg: avgAcrossGrowers(fitted, nMembers, n),
      counterfactualAvg: avgAcrossGrowers(counterfactualFlat, nMembers, n),
    };
  }

  // ── Pipeline ──────────────────────────────────────────────────────────
  function runPipeline() {
    const d = state.data;
    const p = state.params;
    const idx = storyController.getActiveIndex();
    if (!d || idx < 0) return;

    const step = STEPS[idx];
    const reveals = step.reveals;

    const { result, memberSeries, fittedAvg, counterfactualAvg } =
      computeStepSeries(step, d, p);

    mainChart.updateAxes([0, p.n - 1], PRICE_Y_DOMAIN);

    const cd = d.t.map((t, i) => ({
      t,
      price: d.price[i],
      fitted: fittedAvg[i],
      cf: counterfactualAvg[i],
      inCartel: d.cartelDummy[i],
    }));

    updateObserved(
      cd,
      (e) => e.t,
      (e) => e.price,
    );
    updateCartelRegion(p.cartelStart, p.cartelEnd - 1);
    updateCartelStart(p.cartelStart, true);
    updateCartelEnd(p.cartelEnd - 1, true);

    const showFit = !!reveals.fitted;
    updateFitted(
      showFit ? cd : [],
      (e) => e.t,
      (e) => e.fitted,
    );
    updateCounterfactual(
      showFit ? cd : [],
      (e) => e.t,
      (e) => e.cf,
    );

    showResidLines(
      reveals.residuals ? cd : [],
      (e) => e.t,
      (e) => e.price,
      (e) => e.fitted,
      !!reveals.residuals,
    );

    const ocData = cd.filter((e) => e.inCartel === 1);
    updateOCArea(
      ocData,
      (e) => e.t,
      (e) => e.cf,
      (e) => e.price,
      !!reveals.ocArea,
    );

    const memberSeriesForFan = memberSeries.map((vals) =>
      d.t.map((t, i) => ({ t, y: vals[i] })),
    );
    updateMembers(
      memberSeriesForFan,
      cd.map((e) => ({ t: e.t, y: e.price })),
      (e) => e.t,
      (e) => e.y,
      !!reveals.memberFan,
    );

    eqPanel.innerHTML = buildPanelEquationHTML(step.model);

    const cartelIdx = result.names.indexOf("cartel");
    ocCard.update(p.overcharge, cartelIdx >= 0 ? result.beta[cartelIdx] : null);
    modelFit.update(result, "cartel", p.overcharge);

    createLegend(mainChart, [
      { label: "Cartelists’ Average Price", color: "var(--clr-observed)" },
      { label: "Predicted Price", color: "var(--clr-fitted)", dash: "6,3" },
      { label: "Counterfactual Price", color: "var(--clr-counterfactual)" },
      ...(reveals.memberFan
        ? [
            {
              label: "Individual Cartelists",
              color: "var(--clr-member)",
              strokeWidth: 1.4,
              opacity: 0.7,
            },
          ]
        : []),
    ]);
  }

  // ── Story controller ──────────────────────────────────────────────────
  const storySteps = STEPS.map((step) => ({
    label: step.label,
    render: () => {
      caption.set(step.caption, step.tone || null);
      // Pin this step's DGP; if nothing changed, the subscriber won't fire,
      // so run the pipeline directly (model spec may still have changed)
      if (!state.ensure({ ...step.dgp })) runPipeline();
    },
  }));
  const storyController = createStoryController(storyWrap, {
    steps: storySteps,
    chartWrapper: mainChart.wrapper,
  });

  state.subscribe(() => runPipeline());

  setTimeout(() => storyController.goTo(0), 80);

  return {
    resample: () => {
      const seed = (state.params.seed || 42) + 1;
      state.reseed(seed);
    },
    presetBar: storyController,
    onShow: () => {
      mainChart.resize();
      const idx = storyController.getActiveIndex();
      // Re-pin the active step's DGP (pills may have moved on The Data tab)
      if (idx >= 0 && state.ensure({ ...STEPS[idx].dgp })) return;
      runPipeline();
    },
  };
}
