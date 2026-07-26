# From Data to Damages: Comparator-based methods for estimating overcharge

A browser-based teaching app for a lunch-and-learn session on how econometric evidence estimates cartel overcharge and pass-on — illustrated with a simulated UK apple-growers' cartel.

## How to Run

Start a local server in this directory:

```
npx serve .
```

Or:

```
python -m http.server 8000
```

Then open the URL shown in your terminal (usually http://localhost:3000 or http://localhost:8000). Click through the cover screen to begin.

The app uses ES modules, so it cannot be opened directly via `file://`. A local server is required.

All dependencies (D3.js, fonts) are vendored locally. No internet connection needed.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| 1-5 | Switch tabs |
| R | Resample (new random draw, same parameters) |
| Left/Right arrows | Step through the story (Tabs 3-5) |

## Tabs

### 1. Supply Chain

The apple supply chain: four anonymised cartelist firms (Firm A-D) plus a non-cartelist grower (Fenwick Orchards), ringed to show the coordinating group, illustrating potential umbrella pricing in the wider UK market. Direct purchasers bear the overcharge in full by definition. Two independently adjustable pass-on levers:

- **Upstream pass-on** (0-100%): how much of the overcharge direct purchasers pass on to consumers
- **Downstream pass-on** (0-100%, default 0%, narrative-only): the pass-on *defence* applied to consumers themselves — implausible for retail apples, but shown for completeness
- **Umbrella effect** (0-100%): draws two extra pass-on flow layers — from the non-cartelist firm to direct purchasers, and from there on to consumers — showing how firms outside the cartel can still raise prices under its shelter

The "Who bears the harm?" bar always splits the overcharge into two segments (direct purchasers / consumers) that sum to 100%, colour-coded by supply-chain level.

### 2. The Data

Sets the scene: the apple growers' cartel (Jan 2015 – Dec 2018) and the monthly wholesale apple price series, plotted as the average across the four cartelist growers. A "Show individual growers" toggle fans the average out into the four member series (spread compresses during the cartel period, widens outside it); "Show clean vs. cartel average" overlays the two period averages as horizontal reference lines plus the naive-diff-vs-true-overcharge annotation, to motivate why a simple before/after comparison isn't enough once the data gets noisy.

**Story reveals:** (1) mark the cartel period, (2) reveal the true counterfactual — we know it because the data is simulated (with a "predict the overcharge" prompt beforehand), (3) show the overcharge as the shaded gap.

**Add complexity** pills switch features of the data-generating process on and off: trend, seasonality, an input-cost-index driver, a macro shock, ramp-up/run-off of the overcharge, and noise. These flags live in shared state, so the same pills affect Tabs 3-5 too.

### 3. Regression Analysis

A scripted story that teaches what a regression actually is, using a small fixed local dataset: from a line plot, to a scatter of points, to an arbitrary line and its residuals, to the goal of minimising the sum of squared residuals, to the closed-form matrix solution β = (X′X)⁻¹X′Y, to the actual line of best fit, to introducing a 0/1 cartel dummy variable so the line can jump during the cartel period — the dummy's coefficient is the estimated overcharge. The final step refits the same simple model against the real, shared dataset to show it breaking down once realistic complexity is present, motivating the next tab.

### 4. Time Comparator

A scripted back/forward story builds up a panel (grower × month) regression. It opens with a before/after comparison of the estimate with and without grower fixed effects, then shows the run-off story on simple data, then layers in the rest of the realistic complexity (seasonality, month-of-year fixed effects, an input-cost-index control, an import-cost-shock control), and closes by reprising run-off against the fully-loaded model — the fix, and a common mistake (extending the cartel dummy over the run-off months).

Use the Back/Forward buttons (below the chart), the numbered dots, or arrow keys to move through the story. The Y-axis is fixed for the whole story so steps are visually comparable.

### 5. Geographic Comparator (Difference-in-Differences)

Two markets: the treated UK market and a synthetic comparator market without the cartel. A scripted story walks through a simple, mechanical DiD walkthrough first (comparator market → period averages → first differences → DiD estimate), then closes with two pitfalls: a trend-divergence violation of parallel trends (and its fix via group-specific trends), and umbrella pricing contaminating the comparator.

## The Pedagogical Core

Every regression tab works the same way:

1. Set the "true" data-generating process (DGP), including the true overcharge
2. The app generates noisy synthetic data from the DGP
3. An econometric model tries to recover the overcharge from the data
4. Compare the estimate to the known truth

This shows exactly what the regression is recovering and, crucially, why it gets biased when assumptions fail — and why realistic controls (fixed effects, genuine cost/shock variables) fix it, rather than mechanical trend/cosine terms.

## Technical Notes

- All regressions use hand-coded OLS with HC1 heteroskedasticity-robust standard errors (not clustered by grower — an accepted simplification for teaching purposes)
- The RNG is seeded: identical parameters always produce identical data. "Resample" increments the seed.
- Charts use D3.js v7 with 400ms animated transitions
- Light/dark theme toggle (top right) only swaps structural colours (backgrounds, borders, text) — chart-series colours are identical in both themes
- The dynamic equation panel for the Time Comparator mirrors the column order of `buildPanelMatrix` in `js/data/datagen.js`; if you change one, update `js/ui/equation-builder.js`'s `buildPanelEquationHTML` to match
- Tabs 3-5 share a `.story-layout` (full-width chart on top, story controls/stat strip/caption below) rather than the older 3-column layout
