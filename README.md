# From Data to Damages: Comparator-Based Methods for Estimating Overcharge

![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)
![HTML5](https://img.shields.io/badge/html5-%23E34F26.svg?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/css3-%231572B6.svg?style=for-the-badge&logo=css3&logoColor=white)

*An Interactive Guide to Estimating Cartel Overcharge*

## Premise

This application is an interactive visual tool that explains, step by step, how economists estimate the financial harm caused by a price-fixing cartel — the "overcharge" — and how that harm moves through a supply chain to the parties who ultimately bear it.

Using a simulated price-fixing cartel as a running example, the app walks the user from first principles (who pays for an overcharge, and how much of it gets passed on) through to the econometric methods practitioners use to measure it in real disputes, including time-series regression and Difference-in-Differences (comparator-based) analysis. Each tab builds on the last, so the story can be followed in order from a plain-language supply chain diagram to a full regression model.

All companies, data, prices, and events depicted in the app are entirely fictional and have been simulated for illustrative purposes only.

## What Each Tab Does

### 1. Supply Chain

A diagram of the market: a group of coordinating cartelist firms, a non-cartelist firm sitting outside the cartel, direct purchasers, and class members further downstream. Adjustable sliders let the user see how an overcharge imposed at the top of the chain is absorbed or passed on at each level:

- **Upstream pass-on** — how much of the overcharge direct purchasers pass on to the next level down
- **Downstream pass-on** — the pass-on defence, where that next level mitigates its own loss by passing the overcharge on again
- **Umbrella effect** — how firms outside the cartel can still raise their own prices under cover of the cartel's higher prices, spreading harm beyond the cartelists' own direct customers

A companion chart shows, in real time, how the overcharge is ultimately split between direct purchasers, class members, and parties further downstream.

### 2. The Data

Introduces the raw market data: a monthly price series for the cartelists, with the cartel period clearly marked. A guided walkthrough reveals the true (but-for) counterfactual price and the overcharge itself as the gap between the observed and counterfactual prices — building the intuition that a simple before/after comparison of average prices is really what's being measured.

From here, the user can layer in realistic complications — a time trend, seasonality, macroeconomic shocks, and other noise — to see how quickly a naive before/after comparison stops being reliable, motivating the more rigorous methods covered in the following tabs.

### 3. Regression Analysis

Builds up, from scratch, what a regression model actually does. Starting from the same price series, the tab moves from an arbitrary guessed line, to the residuals (errors) that guess produces, to the true line of best fit that minimises those errors — the mechanics behind the equation *pₜ = α + β·t*. It then introduces a "cartel dummy" variable that lets the line shift upward during the cartel period, showing how the size of that shift is precisely the model's estimate of the overcharge.

### 4. Time Comparator

Extends the regression from Tab 3 into a full model capable of handling real-world complexity: seasonality, macroeconomic shocks, input-cost spikes, and a "run-off" period where cartel effects fade out gradually rather than stopping abruptly. The tab contrasts common mistakes (such as ignoring run-off, or omitting a genuine cost driver) with the corrected, correctly specified model, demonstrating that a properly built regression can still isolate the true overcharge even in noisy, realistic data.

### 5. Geographic Comparator

Introduces the Difference-in-Differences (DiD) method, which estimates the overcharge by comparing the cartelised market against a similar, uncartelised comparator market used to represent the counterfactual. The tab walks through the mechanics of DiD — period averages, first differences, and the final DiD estimate — before turning to two ways this method can fail in practice: **umbrella effects** contaminating the comparator market, and a violation of the **parallel trends** assumption underlying the whole approach.

---

### Developer Note

This is a static, client-side app (HTML/CSS/vanilla JS + D3.js, all dependencies vendored locally). Because it uses ES modules, it must be served over HTTP rather than opened directly from disk — run `npx serve .` or `python -m http.server` in this directory and open the printed local URL.

## License

### Alexander Vickery
<img src="./other/logo.png" width="125px">
