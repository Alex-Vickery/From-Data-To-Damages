// Tab 2 — "The Data"
// Sets the scene with the apple growers' cartel price series.
// Provides a floating story nav and complexity toggles.
// Writes to shared state; Tabs 3-4 subscribe.

import {
  state,
  monthToLabel,
  YEAR_TICKS,
  PRICE_Y_DOMAIN,
  yearTickFormat,
} from "../data/state.js";
import { generateMemberSeries } from "../data/datagen.js";
import {
  createChart,
  bindLine,
  bindLineAnimated,
  bindRegionToggle,
  bindArea,
  bindEventLine,
  bindHLine,
  bindMemberLines,
  bindAnnotation,
  createLegend,
} from "../ui/charts.js";
import {
  createPillToggle,
  createSectionHeading,
  createStoryLayout,
  createStoryBottomBar,
  createOcCard,
} from "../ui/components.js";
import { createComplexityPills } from "../ui/complexity-pills.js";
import { createStoryController } from "../ui/story-controller.js";

export function createSceneTab(container) {
  // ── Layout ──────────────────────────────────────────────────────────────
  const {
    storyMain,
    storyBottom,
    sidePanel: controlCol,
  } = createStoryLayout(container);

  // ── Story Reveals ────────────────────────────────────────────────────────
  const CAPTIONS = [
    'Monthly prices from January 2013 - December 2023. The blue line is the average price across the three cartelists — toggle "Show the individual cartelists’ prices to see each cartel member’s own price series.',
    "The competition authority’s investigation found that price coordination began in January 2015 and continued until December 2018.",
    "Because this is a simulated dataset, we know the true counterfactual price — the price that would have been charged, absent the cartel.",
    "The difference between the observed and counterfactual price is the overcharge — our goal is to recover this even though, in practice, the true counterfactual price is unobserved.",
  ];

  let reveals = { cartel: false, counterfactual: false, overcharge: false };

  // ── Main Chart ────────────────────────────────────────────────────────────
  const chartMain = document.createElement("div");
  chartMain.className = "scene-chart-main";
  storyMain.appendChild(chartMain);

  // Shared crossfading caption in the full-width bottom bar
  const { caption: captionCtl, storyWrap } = createStoryBottomBar(storyBottom);
  captionCtl.el.textContent = CAPTIONS[0];

  // Gold accent whenever the picture is getting genuinely complicated
  function complexityFlags(p) {
    return [
      p.trendEnabled,
      p.seasonalityEnabled,
      p.confoundEnabled,
      p.macroShockEnabled,
      p.rampUpEnabled,
      p.runOffEnabled,
    ];
  }

  function currentTone() {
    const nActive = complexityFlags(state.params).filter(Boolean).length;
    return nActive >= 2 ? "warn" : null;
  }

  function updateCaption() {
    const tone = currentTone();
    if (reveals.overcharge) captionCtl.set(CAPTIONS[3], tone);
    else if (reveals.counterfactual) captionCtl.set(CAPTIONS[2], tone);
    else if (reveals.cartel) captionCtl.set(CAPTIONS[1], tone);
    else captionCtl.set(CAPTIONS[0], tone);
  }

  const chart = createChart(chartMain, {
    xLabel: "",
    yLabel: "£ / tonne",
    title: "The Cartelists’ Average Prices",
    marginTop: 48,
    marginBottom: 38,
    marginLeft: 58,
    marginRight: 20,
    xTickValues: YEAR_TICKS,
    xTickFormat: yearTickFormat,
    hoverFormatX: (m) => monthToLabel(m, "monthYear"),
  });

  // Chart bindings (create once, update on every pipeline run)
  const updateObserved = bindLine(chart, "obs", {
    color: "var(--clr-observed)",
    hover: {
      label: "Cartelists’ Average Price",
      note: "The price we actually observe in practice, equal to the average price charged by the cartelists.",
    },
  });
  const updateMembers = bindMemberLines(chart, "members");
  const drawCounterfactual = bindLineAnimated(chart, "cf", {
    color: "var(--clr-counterfactual)",
    hover: {
      label: "Counterfactual Price",
      note: "The price that would have prevailed but-for the cartel. Known here only because the data is simulated; in practice this price must be estimated.",
    },
  });
  const showRegion = bindRegionToggle(chart, "cartel", {
    color: "var(--clr-cartel)",
  });
  const showStartLine = bindEventLine(chart, "start", {
    color: "var(--clr-cartel-border)",
    label: "Jan 2015",
  });
  const showEndLine = bindEventLine(chart, "end", {
    color: "var(--clr-cartel-border)",
    label: "Dec 2018",
  });
  const showOverchargeArea = bindArea(chart, "oc", {
    color: "color-mix(in srgb, var(--clr-counterfactual) 18%, transparent)",
  });
  const showCartelNote = bindAnnotation(chart, "cartelNote", { side: "top" });
  const showOverchargeNote = bindAnnotation(chart, "overchargeNote", {
    side: "center",
  });
  // No in-chart labels for the average lines — their names live in the
  // legend instead (see legendItems below).
  const showCleanAvg = bindHLine(chart, "cleanAvg", {
    color: "var(--clr-gold)",
    hover: {
      label: "Clean-Period Average",
      note: "The average price across every non-cartel month.",
    },
  });
  const showCartelAvg = bindHLine(chart, "cartelAvg", {
    color: "var(--clr-umbrella)",
    hover: {
      label: "Cartel-Period Average",
      note: "The average price during the cartel window.",
    },
  });

  // ── Render from state.data ────────────────────────────────────────────────
  let showMembers = false;
  let showAverages = false;
  let activeStepIdx = 0;

  function renderChart() {
    const d = state.data;
    const p = state.params;
    if (!d) return;

    chart.updateAxes([0, p.n - 1], PRICE_Y_DOMAIN);

    const cd = d.t.map((t, i) => ({
      t,
      price: d.price[i],
      cf: d.trueCounterfactual[i],
      inCartel: d.cartelDummy[i],
    }));
    updateObserved(
      cd,
      (e) => e.t,
      (e) => e.price,
    );

    // Individual member series fan out from / collapse into the average
    // (3 series — matching the 3 cartelist firms in the Supply Chain tab)
    const memberSeries = generateMemberSeries(d, p, 3).map((vals) =>
      d.t.map((t, i) => ({ t, y: vals[i] })),
    );
    updateMembers(
      memberSeries,
      cd.map((e) => ({ t: e.t, y: e.price })),
      (e) => e.t,
      (e) => e.y,
      showMembers,
    );

    // Shade exactly up to the Dec 2018 event line (display; dummy still covers t=71)
    showRegion(p.cartelStart, p.cartelEnd - 1, reveals.cartel);
    showStartLine(p.cartelStart, reveals.cartel);
    showEndLine(p.cartelEnd - 1, reveals.cartel);

    // Momentary teaching call-outs — each only while its own step is active.
    // High on the axis, but bindAnnotation's spill-over nudge keeps it
    // inside the wrapper even this close to the plot's top edge.
    const cartelMidT = (p.cartelStart + p.cartelEnd - 1) / 2;
    showCartelNote(
      cartelMidT,
      PRICE_Y_DOMAIN[1],
      "The Cartel Period",
      activeStepIdx === 1,
    );

    drawCounterfactual(
      cd,
      (e) => e.t,
      (e) => e.cf,
      reveals.counterfactual,
    );

    const overchargeData = cd.filter((e) => e.inCartel === 1);
    showOverchargeArea(
      overchargeData,
      (e) => e.t,
      (e) => e.cf,
      (e) => e.price,
      reveals.overcharge,
    );

    // Centroid of the whole shaded region (not just its midpoint month) so
    // the box sits truly centered within the fill, not just at one slice of it
    const anyComplexityActive = complexityFlags(p).some(Boolean);
    const ocAvgPrice = overchargeData.length
      ? overchargeData.reduce((s, e) => s + e.price, 0) / overchargeData.length
      : 0;
    const ocAvgCf = overchargeData.length
      ? overchargeData.reduce((s, e) => s + e.cf, 0) / overchargeData.length
      : 0;
    showOverchargeNote(
      cartelMidT,
      (ocAvgPrice + ocAvgCf) / 2,
      "The Overcharge",
      activeStepIdx === 3 && !anyComplexityActive,
    );

    // Clean vs cartel average reference lines
    const cleanPrices = d.price.filter((_, i) => d.cartelDummy[i] === 0);
    const cartelPrices = d.price.filter((_, i) => d.cartelDummy[i] === 1);
    const cleanAvg = cleanPrices.length
      ? cleanPrices.reduce((a, b) => a + b, 0) / cleanPrices.length
      : 0;
    const cartelAvg = cartelPrices.length
      ? cartelPrices.reduce((a, b) => a + b, 0) / cartelPrices.length
      : 0;
    showCleanAvg(cleanAvg, showAverages);
    showCartelAvg(cartelAvg, showAverages);
    const naiveDiff = cartelAvg - cleanAvg;

    updateStatBoxes(p.overcharge, naiveDiff);

    const legendItems = [
      { label: "Cartelists’ Average Price", color: "var(--clr-observed)" },
      { label: "Counterfactual Price", color: "var(--clr-counterfactual)" },
    ];
    if (showMembers)
      legendItems.push({
        label: "Individual Cartelists’ Prices",
        color: "var(--clr-member)",
        strokeWidth: 1.4,
        opacity: 0.7,
      });
    if (showAverages) {
      legendItems.push({
        label: "Clean-Period Average",
        color: "var(--clr-gold)",
        dash: "6,3",
      });
      legendItems.push({
        label: "Cartel-Period Average",
        color: "var(--clr-umbrella)",
        dash: "6,3",
      });
    }
    createLegend(chart, legendItems);

    updateComplexityCaption();
  }

  // ── Complexity caption update ─────────────────────────────────────────────
  const COMPLEXITY_MSG =
    "A simple difference between the clean- and cartel-period average prices is no longer an accurate measure of the overcharge.";

  function updateComplexityCaption() {
    const nActive = complexityFlags(state.params).filter(Boolean).length;
    const tone = currentTone();
    if (showAverages && nActive >= 1) {
      captionCtl.set(COMPLEXITY_MSG, tone);
      return;
    }
    updateCaption();
  }

  // ── Story controller (floating Back/Forward over the chart) ──────────────
  const storySteps = [
    {
      label: "Show the average price series",
      render: () => {
        activeStepIdx = 0;
        reveals = { cartel: false, counterfactual: false, overcharge: false };
        renderChart();
      },
    },
    {
      label: "Show the cartel period",
      render: () => {
        activeStepIdx = 1;
        reveals = { cartel: true, counterfactual: false, overcharge: false };
        renderChart();
      },
    },
    {
      label: "Show the true counterfactual price",
      render: () => {
        activeStepIdx = 2;
        reveals = { cartel: true, counterfactual: true, overcharge: false };
        renderChart();
      },
    },
    {
      label: "Show the overcharge",
      render: () => {
        activeStepIdx = 3;
        reveals = { cartel: true, counterfactual: true, overcharge: true };
        renderChart();
      },
    },
  ];
  const storyController = createStoryController(storyWrap, {
    steps: storySteps,
    chartWrapper: chart.wrapper,
  });

  // ── View options ──────────────────────────────────────────────────────────
  createSectionHeading(controlCol, "Display Other Price Series");
  const viewGroup = document.createElement("div");
  viewGroup.className = "pill-group";
  controlCol.appendChild(viewGroup);

  const membersPill = createPillToggle(viewGroup, {
    label: "Show the individual cartelists’ prices",
    value: false,
  });
  membersPill.onChange((v) => {
    showMembers = v;
    renderChart();
  });

  const averagesPill = createPillToggle(viewGroup, {
    label: "Show the average clean & cartel period prices",
    value: false,
  });
  averagesPill.onChange((v) => {
    showAverages = v;
    renderChart();
  });

  // ── Complexity Toggles (shared factory — synced with Tabs 3 & 4) ──────────
  createComplexityPills(controlCol);

  // ── Overcharge check — the shared comparison card (also used by the
  // comparator tabs' metrics sidebar) ─────────────────────────────────────
  createSectionHeading(controlCol, "Overcharge Summary");
  const ocCard = createOcCard(controlCol, {
    estimateLabel: "Difference in average prices",
  });

  function updateStatBoxes(truth, estimate) {
    // Naive-estimate block appears with the averages toggle
    ocCard.update(truth, estimate, showAverages);
  }

  // ── State subscription: re-render whenever any tab changes the DGP ────────
  state.subscribe(renderChart);

  // ── Initial render ─────────────────────────────────────────────────────────
  setTimeout(() => storyController.goTo(0), 80);

  let currentSeed = state.params.seed;

  return {
    resample: () => {
      currentSeed++;
      state.reseed(currentSeed);
    },
    presetBar: storyController,
    onShow: () => {
      chart.resize();
      renderChart();
    },
  };
}
