// Tab 3 — Regression Analysis
// Teaches what a regression actually is — from a line plot, to points, to
// residuals, to the best fit — and then introduces the cartel dummy as an
// intercept shifter. Runs on the SAME shared data as The Data tab, pinned to
// the simplest interesting DGP (time trend only), so the chart here looks
// exactly like Tab 2 and the finale tees up the Time Comparator, which
// starts from this very picture.
//
// The "candidate" line is a single path across the guess and best-fit
// steps, so advancing pivots the line smoothly into place instead of
// swapping one line for another.

import {
  state,
  DGP_TREND_ONLY,
  PRICE_Y_DOMAIN,
  YEAR_TICKS,
  monthToLabel,
  yearTickFormat,
} from "../data/state.js";
import { ols } from "../math/ols.js";
import {
  createChart,
  bindLine,
  bindPoints,
  bindResidualLines,
  bindRegionToggle,
  bindEventLine,
  bindDiffBracket,
  bindAnnotation,
  createLegend,
} from "../ui/charts.js";
import { createStoryController } from "../ui/story-controller.js";
import {
  createStoryLayout,
  createStoryBottomBar,
  createOcCard,
  createSectionHeading,
  flashValue,
} from "../ui/components.js";

// A deliberately imperfect (but not silly) guess: right idea, wrong numbers
const GUESS = { m: 1.6, c: 540 };

const GUESS_HOVER = {
  label: "Arbitrary Guess",
  note: `An arbitrary guess of the line of best fit (i.e. pₜ = α + β·t), with α = ${GUESS.c} and β = ${GUESS.m.toFixed(2)}.`,
};

// Three-row pop-up content: bold label, the equation (proper HTML subscripts
// + dot products, not raw underscore notation), then the plugged-in values —
// each its own line so the (longest) parameter row never wraps
function annotationHTML(label, equation, params) {
  return (
    `<div class="chart-annotation-label">${label}</div>` +
    `<div class="chart-annotation-eq">${equation}</div>` +
    `<div class="chart-annotation-params">${params}</div>`
  );
}
const FIT_HOVER = {
  label: "Line Of Best Fit",
  note: "The line that minimises the sum of squared residuals.",
};

function guessSSR() {
  const d = state.data;
  return d.price.reduce(
    (s, p, i) => s + (p - (GUESS.c + GUESS.m * d.t[i])) ** 2,
    0,
  );
}

function fitSingleLine() {
  const d = state.data;
  return ols(
    d.price,
    d.t.map((t) => [t]),
    { addIntercept: true, robust: true, names: ["intercept", "t"] },
  );
}

function fitWithDummy() {
  const d = state.data;
  return ols(
    d.price,
    d.t.map((t, i) => [t, d.cartelDummy[i]]),
    { addIntercept: true, robust: true, names: ["intercept", "t", "cartel"] },
  );
}

const STEPS = [
  {
    label: "The price series",
    caption:
      "Let’s build up, step by step, how a regression model works in practice.",
    reveals: { line: true },
  },
  {
    label: "From a line to individual points",
    caption:
      "Regression models work directly on the raw data, in this case individual (time, price) pairs.",
    reveals: { points: true },
  },
  {
    label: "Guess a line",
    caption: `Here’s an arbitrary guess of the line of best fit through the time-price pairs. It’s clearly not the best summary of these points.`,
    reveals: { points: true, guessLine: true },
  },
  {
    label: "Residuals — and how to shrink them",
    caption: () =>
      `The vertical gaps between the data points and the line are residuals. The purpose of regression is to find the exact intercept and gradient parameters that minimize the Sum of Squared Residuals (SSR).`,
    reveals: { points: true, guessLine: true, guessResid: true },
  },
  {
    label: "The line of best fit",
    caption:
      "This is the line of best fit. It systematically over-predicts the clean period and under-predicts the cartel period — the residuals aren’t random — this tells us our model is missing a key variable.",
    reveals: { points: true, fitLine: true, fitResid: true },
  },
  {
    label: "A pattern the line cannot see",
    caption:
      "The cause is the cartel. During the cartel period, prices increased by a fixed amount above the baseline trend. A single straight line cannot capture this sudden jump.",
    reveals: {
      points: true,
      fitLine: true,
      fitResid: true,
      cartelRegion: true,
    },
  },
  {
    label: "Enter the cartel dummy",
    caption:
      "Adding a dummy variable (equal to 1 during the cartel, 0 otherwise) allows the trend line to shift upward. The size of this intercept shift then becomes our estimate of the overcharge.",
    reveals: {
      points: true,
      cartelRegion: true,
      fitDummy: true,
      dummyResid: true,
    },
  },
  {
    label: "A dummy is an intercept shifter",
    caption: () => {
      const fit = fitWithDummy();
      const delta = fit.beta[fit.names.indexOf("cartel")];
      return `The dummy variable shifts the intercept upward during the cartel period, creating two parallel lines. The dark green line is the counterfactual price, and the gap between them (≈ £${Math.round(delta)}/tonne) is the overcharge.`;
    },
    reveals: {
      line: true,
      cartelRegion: true,
      fitDummy: true,
      cfExt: true,
      bracket: true,
    },
  },
];

export function createRegressionTab(container) {
  const { storyMain, storyBottom, sidePanel } = createStoryLayout(container);

  // ── Metrics sidebar: same components as The Data tab's Overcharge check ─
  createSectionHeading(sidePanel, "Overcharge Summary");
  const ocCard = createOcCard(sidePanel, {
    estimateLabel: "Estimated Overcharge",
  });

  // Residual diagnostics — mirrors the Overcharge-check card's own styling
  // (same card/row/label/value classes) so the two sit as a matched pair.
  createSectionHeading(sidePanel, "Residuals Summary");
  const rdCard = document.createElement("div");
  rdCard.className = "oc-check-card";
  rdCard.innerHTML = `
    <div class="oc-check-row"><span class="oc-check-label">Minimum</span><span class="oc-check-val" data-rd="min">--</span></div>
    <div class="oc-check-row"><span class="oc-check-label">Maximum</span><span class="oc-check-val" data-rd="max">--</span></div>
    <div class="oc-check-row"><span class="oc-check-label">Average</span><span class="oc-check-val" data-rd="avg">--</span></div>
    <div class="oc-check-row"><span class="oc-check-label">SSR</span><span class="oc-check-val" data-rd="ssr">--</span></div>
  `;
  sidePanel.appendChild(rdCard);
  const rdEls = {
    min: rdCard.querySelector('[data-rd="min"]'),
    max: rdCard.querySelector('[data-rd="max"]'),
    avg: rdCard.querySelector('[data-rd="avg"]'),
    ssr: rdCard.querySelector('[data-rd="ssr"]'),
  };
  function updateResidualDiagnostics(residuals) {
    if (!residuals || !residuals.length) {
      rdEls.min.textContent = "--";
      rdEls.max.textContent = "--";
      rdEls.avg.textContent = "--";
      rdEls.ssr.textContent = "--";
      rdEls.avg.className = "oc-check-val";
      return;
    }
    const min = Math.min(...residuals);
    const max = Math.max(...residuals);
    const avg = residuals.reduce((s, r) => s + r, 0) / residuals.length;
    const ssr = residuals.reduce((s, r) => s + r * r, 0);
    rdEls.min.textContent = `£${min.toFixed(1)}`;
    rdEls.max.textContent = `£${max.toFixed(1)}`;
    rdEls.avg.textContent = `£${avg.toFixed(2)}`;
    rdEls.ssr.textContent = Math.round(ssr).toLocaleString();
    const absAvg = Math.abs(avg);
    const cls = absAvg < 1 ? "good" : absAvg < 5 ? "warn" : "bad";
    rdEls.avg.className = `oc-check-val stat-value--${cls}`;
    flashValue(rdEls.min);
    flashValue(rdEls.max);
    flashValue(rdEls.avg);
    flashValue(rdEls.ssr);
  }

  // ── Main column: the chart, exactly as it looks on The Data tab ────────
  const mainChartWrap = document.createElement("div");
  mainChartWrap.className = "main-chart-container";
  storyMain.appendChild(mainChartWrap);

  const mainChart = createChart(mainChartWrap, {
    xLabel: "",
    yLabel: "£ / tonne",
    title: "The Cartelists’ Average Prices",
    // marginTop 48 keeps the "Jan 2015 / Dec 2018" event labels clear of
    // the (long) chart title, matching The Data tab
    marginTop: 48,
    marginBottom: 36,
    marginLeft: 56,
    marginRight: 20,
    xTickValues: YEAR_TICKS,
    xTickFormat: yearTickFormat,
    hoverFormatX: (m) => monthToLabel(m, "monthYear"),
  });

  const updateLine = bindLine(mainChart, "price", {
    color: "var(--clr-observed)",
    hover: {
      label: "Cartelists’ Average Price",
      note: "The price we actually observe in practice, equal to the average price charged by the cartelists.",
    },
  });
  const updatePoints = bindPoints(mainChart, "price", {
    radius: 2.5,
    opacity: 0.55,
  });
  // One path for both the guess and the best fit, so the line pivots
  // smoothly between them instead of being swapped out
  const updateCandidate = bindLine(mainChart, "candidate", {
    color: "var(--clr-guess)",
    hover: GUESS_HOVER,
  });
  const updateGuessResid = bindResidualLines(mainChart, "guess", {
    color: "var(--clr-guess)",
    opacity: 0.5,
  });
  const updateFitResid = bindResidualLines(mainChart, "fit", {
    color: "var(--clr-residual)",
  });
  const updateFitBase = bindLine(mainChart, "fitBase", {
    color: "var(--clr-fitted)",
    hover: {
      label: "Line Of Best Fit — Clean Period",
      note: "The predicted price in the months where the cartel dummy is equal to 0.",
    },
  });
  const updateFitCartel = bindLine(mainChart, "fitCartel", {
    color: "var(--clr-fitted)",
    strokeWidth: 3.5,
    hover: {
      label: "Line Of Best Fit — Cartel Period",
      note: "The predicted price when the cartel dummy is equal to 1.",
    },
  });
  const updateDummyResid = bindResidualLines(mainChart, "dummy", {
    color: "var(--clr-fitted)",
  });
  const updateCfExt = bindLine(mainChart, "cfExt", {
    color: "var(--clr-counterfactual)",
    hover: {
      label: "Counterfactual Price",
      note: "The price that would have prevailed but-for the cartel.",
    },
  });
  const updateCartelRegion = bindRegionToggle(mainChart, "cartel", {
    color: "var(--clr-cartel)",
  });
  const updateStartLine = bindEventLine(mainChart, "start", {
    color: "var(--clr-cartel-border)",
    label: "Jan 2015",
  });
  const updateEndLine = bindEventLine(mainChart, "end", {
    color: "var(--clr-cartel-border)",
    label: "Dec 2018",
  });
  const updateBracket = bindDiffBracket(mainChart, "delta", {
    color: "var(--clr-navy)",
    capWidth: 16,
  });
  const showArbitraryNote = bindAnnotation(mainChart, "arbitraryNote", {
    side: "top",
  });
  const showBestFitNote = bindAnnotation(mainChart, "bestFitNote", {
    side: "top",
  });
  const showDummyNote = bindAnnotation(mainChart, "dummyNote", {
    side: "top",
  });

  // ── Bottom bar: the caption only ───────────────────────────────────────
  const { caption, storyWrap } = createStoryBottomBar(storyBottom);

  // ── Render ────────────────────────────────────────────────────────────
  // Tracks the previously-drawn step so the base/cartel split (below) only
  // seeds+animates on the genuine first entry into the fitDummy reveal —
  // not on every re-render of steps 6/7 (resample, resize, going back and
  // forth between them, both of which already have fitDummy true).
  let prevIdx = -1;

  function drawStep(idx) {
    const step = STEPS[idx];
    const r = step.reveals;
    const d = state.data;
    const p = state.params;

    // Same fixed frame as The Data tab, at every step
    mainChart.updateAxes([0, p.n - 1], PRICE_Y_DOMAIN);

    const cd = d.t.map((t, i) => ({ t, price: d.price[i] }));

    updateLine(
      r.line ? cd : [],
      (e) => e.t,
      (e) => e.price,
    );
    updatePoints(
      r.points ? cd : [],
      (e) => e.t,
      (e) => e.price,
    );

    // Candidate line: the guess (steps 3-4) pivots into the best fit (5-6)
    const single = fitSingleLine();
    const showCandidate = r.guessLine || r.fitLine;
    const candIsFit = !!r.fitLine;
    const candLine = candIsFit
      ? { m: single.beta[1], c: single.beta[0] }
      : { m: GUESS.m, c: GUESS.c };
    // Geometry and restyle share one transition, so the guess pivots
    // smoothly into the best fit rather than being swapped out.
    // One point per month (not just the two endpoints) so hovering
    // anywhere along the line interpolates to the exact hovered x/y
    // instead of always snapping to Jan 2013 / Dec 2023.
    updateCandidate(
      showCandidate
        ? Array.from({ length: p.n }, (_, t) => ({
            t,
            y: candLine.c + candLine.m * t,
          }))
        : [],
      (e) => e.t,
      (e) => e.y,
      600,
      {
        stroke: candIsFit ? "var(--clr-fitted)" : "var(--clr-guess)",
      },
    );
    const candHover = candIsFit ? FIT_HOVER : GUESS_HOVER;
    mainChart.setHoverNote(
      "candidate",
      candHover.note,
      candHover.label,
      candIsFit ? "var(--clr-fitted)" : "var(--clr-guess)",
    );

    // Pop-up call-outs pointing at the candidate line, mutually exclusive
    // with each other (only one line — guess or best-fit — is ever shown)
    const candMidT = (p.n - 1) / 2;
    showArbitraryNote(
      candMidT,
      GUESS.c + GUESS.m * candMidT,
      annotationHTML(
        "Arbitrary guess:",
        "p<sub>t</sub> = α + β·t",
        `with α = ${GUESS.c} and β = ${GUESS.m.toFixed(2)}`,
      ),
      !!(r.guessLine && !r.fitLine),
    );
    showBestFitNote(
      candMidT,
      single.beta[0] + single.beta[1] * candMidT,
      annotationHTML(
        "Line of best fit:",
        "p<sub>t</sub> = α + β·t",
        `with α = ${single.beta[0].toFixed(1)} and β = ${single.beta[1].toFixed(2)}`,
      ),
      !!(r.fitLine && !r.fitDummy),
    );

    // Residuals to the candidate, in its two guises
    const guessData = cd.map((e) => ({ ...e, guess: GUESS.c + GUESS.m * e.t }));
    updateGuessResid(
      r.guessResid ? guessData : [],
      (e) => e.t,
      (e) => e.price,
      (e) => e.guess,
      !!r.guessResid,
    );
    const fitData = cd.map((e) => ({
      ...e,
      fit: single.beta[0] + single.beta[1] * e.t,
    }));
    updateFitResid(
      r.fitResid ? fitData : [],
      (e) => e.t,
      (e) => e.price,
      (e) => e.fit,
      !!r.fitResid,
    );

    // Cartel-dummy model: base and shifted segments (NaN-gapped)
    const dummy = fitWithDummy();
    const [c0, mSlope, dCoef] = dummy.beta;

    // Persists through the tab's final step (both fitDummy steps)
    const dummyMidT = (p.cartelStart + p.cartelEnd - 1) / 2;
    showDummyNote(
      dummyMidT,
      c0 + mSlope * dummyMidT + dCoef,
      annotationHTML(
        "Line of best fit:",
        "p<sub>t</sub> = α + β·t + δ·Cartel<sub>t</sub>",
        `with α = ${c0.toFixed(1)}, β = ${mSlope.toFixed(2)} & δ = ${dCoef.toFixed(1)}`,
      ),
      !!r.fitDummy,
    );
    const base = d.t.map((t, i) => ({
      t,
      y: d.cartelDummy[i] === 0 ? c0 + mSlope * t : NaN,
    }));
    const cartelSeg = d.t.map((t, i) => ({
      t,
      y: d.cartelDummy[i] === 1 ? c0 + mSlope * t + dCoef : NaN,
    }));

    if (r.fitDummy) {
      // First entry into this reveal: seed both segments at the single-fit
      // line's position (same NaN-gap shape as the final arrays) so the
      // subsequent animated call has something to tween FROM — the clean
      // segment drifts slightly, the cartel segment visibly slides up by δ,
      // instead of the segments snapping in from nothing.
      const enteringDummy = !STEPS[prevIdx]?.reveals?.fitDummy;
      if (enteringDummy) {
        const seedBase = d.t.map((t, i) => ({
          t,
          y: d.cartelDummy[i] === 0 ? single.beta[0] + single.beta[1] * t : NaN,
        }));
        const seedCartel = d.t.map((t, i) => ({
          t,
          y: d.cartelDummy[i] === 1 ? single.beta[0] + single.beta[1] * t : NaN,
        }));
        updateFitBase(
          seedBase,
          (e) => e.t,
          (e) => e.y,
          0,
          null,
          true,
        );
        updateFitCartel(
          seedCartel,
          (e) => e.t,
          (e) => e.y,
          0,
          null,
          true,
        );
      }
      updateFitBase(
        base,
        (e) => e.t,
        (e) => e.y,
        600,
      );
      updateFitCartel(
        cartelSeg,
        (e) => e.t,
        (e) => e.y,
        600,
      );
    } else {
      updateFitBase(
        [],
        (e) => e.t,
        (e) => e.y,
      );
      updateFitCartel(
        [],
        (e) => e.t,
        (e) => e.y,
      );
    }

    const dummyFitData = cd.map((e, i) => ({
      ...e,
      fit: c0 + mSlope * e.t + (d.cartelDummy[i] === 1 ? dCoef : 0),
    }));
    updateDummyResid(
      r.dummyResid ? dummyFitData : [],
      (e) => e.t,
      (e) => e.price,
      (e) => e.fit,
      !!r.dummyResid,
    );

    // Residual diagnostics track whichever fit is currently active (dummy
    // takes priority once introduced, and stays put through the finale even
    // though its residual segments aren't drawn there anymore)
    if (r.fitDummy) updateResidualDiagnostics(dummy.residuals);
    else if (r.fitResid) updateResidualDiagnostics(single.residuals);
    else if (r.guessResid)
      updateResidualDiagnostics(guessData.map((e) => e.price - e.guess));
    else updateResidualDiagnostics(null);

    // Finale: clean line carried through the cartel window (the counterfactual)
    const cfData = d.t.map((t, i) => ({
      t,
      y: d.cartelDummy[i] === 1 ? c0 + mSlope * t : NaN,
    }));
    updateCfExt(
      r.cfExt ? cfData : [],
      (e) => e.t,
      (e) => e.y,
    );

    updateCartelRegion(
      p.cartelStart - 0.5,
      p.cartelEnd - 0.5,
      !!r.cartelRegion,
    );
    updateStartLine(p.cartelStart - 0.5, !!r.cartelRegion);
    updateEndLine(p.cartelEnd - 0.5, !!r.cartelRegion);

    const midT = (p.cartelStart + p.cartelEnd) / 2;
    updateBracket(
      midT,
      c0 + mSlope * midT + 10,
      c0 + mSlope * midT + dCoef - 10,
      `≈ £${Math.round(dCoef)} / tonne`,
      !!r.bracket,
    );

    // Legend
    const legendItems = [];
    if (r.line || r.points)
      legendItems.push({
        label: "Cartelists’ Average Price",
        color: "var(--clr-observed)",
      });
    if (r.guessLine)
      legendItems.push({
        label: "Arbitrary Guess",
        color: "var(--clr-guess)",
      });
    if (r.fitLine)
      legendItems.push({
        label: "Line Of Best Fit",
        color: "var(--clr-fitted)",
      });
    if (r.fitDummy)
      legendItems.push({
        label: "Line Of Best Fit",
        color: "var(--clr-fitted)",
      });
    if (r.cfExt)
      legendItems.push({
        label: "Counterfactual Price",
        color: "var(--clr-counterfactual)",
      });
    createLegend(mainChart, legendItems);

    // Sidebar: the truth is a known constant throughout; the estimate only
    // reveals at the very final step, when the counterfactual line (and
    // the intercept-shifter framing) is overlaid
    ocCard.update(p.overcharge, dCoef, !!r.cfExt);

    prevIdx = idx;
  }

  const storySteps = STEPS.map((step, i) => ({
    label: step.label,
    render: () => {
      caption.set(
        typeof step.caption === "function" ? step.caption() : step.caption,
      );
      // Pin the DGP this story is written for; if that changes the shared
      // state, the subscriber below redraws — otherwise draw directly
      if (!state.ensure(DGP_TREND_ONLY)) drawStep(i);
    },
  }));

  const storyController = createStoryController(storyWrap, {
    steps: storySteps,
    chartWrapper: mainChart.wrapper,
  });

  state.subscribe(() => {
    const idx = storyController.getActiveIndex();
    if (idx >= 0) drawStep(idx);
  });

  setTimeout(() => storyController.goTo(0), 80);

  return {
    resample: () => state.reseed((state.params.seed || 42) + 1),
    presetBar: storyController,
    onShow: () => {
      mainChart.resize();
      const idx = Math.max(0, storyController.getActiveIndex());
      if (!state.ensure(DGP_TREND_ONLY)) drawStep(idx);
    },
  };
}
