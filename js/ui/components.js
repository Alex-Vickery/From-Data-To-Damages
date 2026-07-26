// Shared UI components: sliders, panels, presets, toggles, reveal buttons, pills

import { computeBias } from "../math/ols.js";

// Brief color pulse on a value element whenever it's set to a new real
// value — smooths the initial "--" placeholder -> real-value reveal on
// first render, and gives every subsequent toggle-driven update a small
// "this number just changed" confirmation instead of a silent swap.
export function flashValue(el) {
  el.classList.remove("value-flash");
  void el.offsetWidth; // restart the animation if it's still mid-flash
  el.classList.add("value-flash");
}

// Overcharge-check comparison card — the truth and an estimate as mini-bars
// on a shared £ scale, with a colour-coded bias chip. One component serves
// The Data tab's "Overcharge check" and the comparator tabs' metrics panel,
// so they stay visually identical by construction.
export function createOcCard(container, config = {}) {
  const { estimateLabel = "Avg price difference", scaleMax = 150 } = config;

  const card = document.createElement("div");
  card.className = "oc-check-card oc-check-card--primary";
  card.innerHTML = `
    <div class="oc-check-row">
      <span class="oc-check-label">True Overcharge</span>
      <span class="oc-check-val oc-val--truth" data-val="truth">--</span>
    </div>
    <div class="oc-check-bar"><div class="oc-check-fill oc-check-fill--truth" data-fill="truth"></div></div>
    <div class="oc-check-naive" data-block="estimate">
      <div class="oc-check-row">
        <span class="oc-check-label"></span>
        <span class="oc-check-val oc-val--naive" data-val="estimate">--</span>
      </div>
      <div class="oc-check-bar">
        <div class="oc-check-fill oc-check-fill--naive" data-fill="estimate"></div>
        <div class="oc-check-tick" data-tick="truth"></div>
      </div>
      <div class="oc-bias-chip" data-chip="bias">--</div>
    </div>
  `;
  card.querySelector(".oc-check-naive .oc-check-label").textContent =
    estimateLabel;
  container.appendChild(card);

  const els = {
    block: card.querySelector('[data-block="estimate"]'),
    truthVal: card.querySelector('[data-val="truth"]'),
    estVal: card.querySelector('[data-val="estimate"]'),
    truthFill: card.querySelector('[data-fill="truth"]'),
    estFill: card.querySelector('[data-fill="estimate"]'),
    tick: card.querySelector('[data-tick="truth"]'),
    chip: card.querySelector('[data-chip="bias"]'),
  };

  const pct = (v) => `${Math.max(0, Math.min(100, (v / scaleMax) * 100))}%`;

  // showTruth lets a caller withhold the true value until the story is
  // ready to reveal it (e.g. the Regression tab shows the naive £0 estimate
  // one step before it reveals the truth) — every other caller passes the
  // default (always true), so this is fully backward compatible.
  function update(truth, estimate, showEstimate = true, showTruth = true) {
    if (showTruth) {
      els.truthVal.textContent = `£${truth.toFixed(0)}`;
      flashValue(els.truthVal);
      els.truthFill.style.width = pct(truth);
      els.tick.style.opacity = "1";
      els.tick.style.left = pct(truth);
    } else {
      els.truthVal.textContent = "--";
      els.truthFill.style.width = "0%";
      els.tick.style.opacity = "0";
    }

    els.block.classList.toggle("is-open", showEstimate && estimate != null);
    if (showEstimate && estimate != null) {
      els.estVal.textContent = `£${estimate.toFixed(0)}`;
      flashValue(els.estVal);
      els.estFill.style.width = pct(estimate);

      if (showTruth) {
        const bias = computeBias(estimate, truth);
        const absBiasPct = Math.abs(bias.percentage);
        // Underestimating the overcharge is always the worse failure mode
        // for a damages estimate — never merely "cautionary" — so any
        // negative bias is red regardless of magnitude; only a positive
        // (or zero) bias gets the graduated good/warn/bad treatment.
        const biasClass =
          bias.absolute < 0
            ? "bad"
            : absBiasPct < 10
              ? "good"
              : absBiasPct < 25
                ? "warn"
                : "bad";
        els.chip.textContent = `Bias ${bias.absolute >= 0 ? "+" : ""}£${bias.absolute.toFixed(0)} (${bias.percentage >= 0 ? "+" : ""}${bias.percentage.toFixed(0)}%)`;
        els.chip.className = `oc-bias-chip oc-bias--${biasClass}`;
      } else {
        els.chip.textContent = "";
        els.chip.className = "oc-bias-chip";
      }
    }
  }

  return { update, el: card, destroy: () => card.remove() };
}

export function createSliderGroup(container, config) {
  const {
    id,
    label,
    min,
    max,
    step = 1,
    value,
    unit = "",
    category = "dgp",
    description = "",
    setupOnly = false,
  } = config;

  const wrapper = document.createElement("div");
  wrapper.className = `slider-group slider-group--${category}`;
  if (setupOnly) wrapper.dataset.setupOnly = "";

  const labelRow = document.createElement("div");
  labelRow.className = "slider-label-row";

  const labelEl = document.createElement("label");
  labelEl.htmlFor = id;
  labelEl.textContent = label;
  if (description) labelEl.title = description;

  const valueDisplay = document.createElement("span");
  valueDisplay.className = "slider-value";
  valueDisplay.textContent = formatValue(value, unit, step);

  labelRow.appendChild(labelEl);
  labelRow.appendChild(valueDisplay);

  const slider = document.createElement("input");
  slider.type = "range";
  slider.id = id;
  slider.min = min;
  slider.max = max;
  slider.step = step;
  slider.value = value;

  wrapper.appendChild(labelRow);
  wrapper.appendChild(slider);
  container.appendChild(wrapper);

  const callbacks = [];
  slider.addEventListener("input", () => {
    const v = parseFloat(slider.value);
    valueDisplay.textContent = formatValue(v, unit, step);
    callbacks.forEach((cb) => cb(v));
  });

  return {
    getValue: () => parseFloat(slider.value),
    setValue: (v) => {
      slider.value = v;
      valueDisplay.textContent = formatValue(v, unit, step);
    },
    onChange: (cb) => callbacks.push(cb),
    destroy: () => wrapper.remove(),
    el: wrapper,
  };
}

function formatValue(v, unit, step) {
  const decimals = step < 1 ? Math.max(0, -Math.floor(Math.log10(step))) : 0;
  return v.toFixed(decimals) + (unit ? " " + unit : "");
}

// Pill-style toggle button (for complexity toggles and umbrella-effect annotations)
export function createPillToggle(container, config) {
  const { label, value = false, warnStyle = false } = config;

  const btn = document.createElement("button");
  btn.className =
    "pill-toggle" + (value ? (warnStyle ? " active-warn" : " active") : "");
  btn.setAttribute("aria-pressed", String(value));
  btn.textContent = label;
  container.appendChild(btn);

  const callbacks = [];
  let active = value;

  btn.addEventListener("click", () => {
    active = !active;
    btn.classList.toggle("active", active && !warnStyle);
    btn.classList.toggle("active-warn", active && warnStyle);
    btn.setAttribute("aria-pressed", String(active));
    callbacks.forEach((cb) => cb(active));
  });

  return {
    getValue: () => active,
    setValue: (v) => {
      active = v;
      btn.classList.toggle("active", v && !warnStyle);
      btn.classList.toggle("active-warn", v && warnStyle);
      btn.setAttribute("aria-pressed", String(v));
    },
    onChange: (cb) => callbacks.push(cb),
    destroy: () => btn.remove(),
    el: btn,
  };
}

// iOS/Material-style toggle switch — a settings-list row (label left,
// switch right) backed by a real checkbox for native keyboard/screen-reader
// support. Same call signature and returned shape as createPillToggle, so
// it drops in wherever a pill toggle is swapped for a switch.
export function createToggleSwitch(container, config) {
  const { label, value = false, warnStyle = false } = config;

  const row = document.createElement("label");
  row.className = "toggle-row";

  const text = document.createElement("span");
  text.className = "toggle-row-label";
  text.textContent = label;

  const switchEl = document.createElement("span");
  switchEl.className = "toggle-switch" + (warnStyle ? " toggle-switch--warn" : "");

  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("role", "switch");
  input.className = "toggle-switch-input";
  input.checked = value;

  const track = document.createElement("span");
  track.className = "toggle-switch-track";

  switchEl.appendChild(input);
  switchEl.appendChild(track);
  row.appendChild(text);
  row.appendChild(switchEl);
  container.appendChild(row);

  const callbacks = [];

  input.addEventListener("change", () => {
    callbacks.forEach((cb) => cb(input.checked));
  });

  return {
    getValue: () => input.checked,
    setValue: (v) => {
      input.checked = v;
    },
    onChange: (cb) => callbacks.push(cb),
    destroy: () => row.remove(),
    el: row,
  };
}

// Matches --duration-base in css/styles.css — the fade-out must finish
// before the text swap, so this stays numerically in step with the CSS
// opacity/transform transition on .teaching-caption.
const CAPTION_FADE_MS = 200;

// Teaching caption with a smooth crossfade between texts. `tone` colours the
// accent border: null (primary) | 'warn' (gold) | 'bad' (red).
export function createCaption(container) {
  const el = document.createElement("div");
  el.className = "teaching-caption";
  container.appendChild(el);

  let pending = null;

  function applyTone(tone) {
    el.classList.toggle("caption-warn", tone === "warn");
    el.classList.toggle("caption-bad", tone === "bad");
  }

  function set(text, tone = null) {
    if (el.textContent === text) {
      applyTone(tone);
      return;
    }
    el.classList.add("caption-fading");
    clearTimeout(pending);
    pending = setTimeout(() => {
      el.textContent = text;
      applyTone(tone);
      el.classList.remove("caption-fading");
    }, CAPTION_FADE_MS);
  }

  return {
    el,
    set,
    destroy: () => {
      clearTimeout(pending);
      el.remove();
    },
  };
}

// Full-width chart + bottom caption/controls + right-hand metrics sidebar —
// the shared skeleton every "story" tab (Tabs 2-5) builds. `container` is
// cleared first (each tab owns its own container, mounted once).
export function createStoryLayout(container) {
  container.innerHTML = "";

  const layout = document.createElement("div");
  layout.className = "story-layout";

  const storyContent = document.createElement("div");
  storyContent.className = "story-content";
  layout.appendChild(storyContent);

  const storyMain = document.createElement("div");
  storyMain.className = "story-main";
  storyContent.appendChild(storyMain);

  const storyBottom = document.createElement("div");
  storyBottom.className = "story-bottom";
  storyContent.appendChild(storyBottom);

  const sidePanel = document.createElement("div");
  sidePanel.className = "story-side-panel";
  layout.appendChild(sidePanel);

  container.appendChild(layout);

  return { layout, storyMain, storyBottom, sidePanel };
}

// The caption plus the wrapper the story controller's prev/next controls
// mount into — the other half of every story tab's bottom bar.
export function createStoryBottomBar(storyBottom) {
  const caption = createCaption(storyBottom);
  const storyWrap = document.createElement("div");
  storyBottom.appendChild(storyWrap);
  return { caption, storyWrap };
}

// "Model Fit" sidebar card (R² bar + 95% CI band) — shared by the Time and
// Geographic Comparator tabs, which fit the same kind of OLS model.
export function createModelFitCard(container, config = {}) {
  const { ciDomainMin = 50, ciDomainMax = 125 } = config;

  const card = document.createElement("div");
  card.className = "oc-check-card";
  card.innerHTML = `
    <div class="oc-check-row"><span class="oc-check-label">R²</span><span class="oc-check-val" data-mf="r2">--</span></div>
    <div class="oc-check-bar"><div class="oc-check-fill" data-mf="r2bar"></div></div>
    <div class="oc-check-row"><span class="oc-check-label">95% CI</span><span class="oc-check-val" data-mf="ci">--</span></div>
    <div class="oc-check-bar"><div class="oc-check-range" data-mf="cirange"></div><div class="oc-check-tick" data-mf="citick"></div></div>
  `;
  container.appendChild(card);

  const els = {
    r2: card.querySelector('[data-mf="r2"]'),
    r2Bar: card.querySelector('[data-mf="r2bar"]'),
    ci: card.querySelector('[data-mf="ci"]'),
    ciRange: card.querySelector('[data-mf="cirange"]'),
    ciTick: card.querySelector('[data-mf="citick"]'),
  };

  // The CI bar uses a wider reference domain than the Overcharge-check bars
  // (which are scaled to the £0-150 truth/estimate range) so the same £
  // interval reads as a narrower, more precise-looking band here.
  const ciPct = (v) =>
    Math.max(
      0,
      Math.min(100, ((v - ciDomainMin) / (ciDomainMax - ciDomainMin)) * 100),
    );

  function update(result, coeffName, truthOvercharge) {
    const idx = result.names.indexOf(coeffName);
    if (idx < 0) {
      els.r2.textContent = "--";
      els.ci.textContent = "--";
      els.r2Bar.style.width = "0%";
      els.ciRange.style.width = "0%";
      els.ciTick.style.opacity = "0";
      return;
    }
    const r2 = result.rSquared;
    els.r2.textContent = r2.toFixed(2);
    flashValue(els.r2);
    els.r2Bar.style.width = `${Math.max(0, Math.min(100, r2 * 100))}%`;
    // Single-hue blue scale: deeper blue reads as a better fit, a light
    // wash reads as a weaker one — a sequential encoding rather than a
    // good/warn/bad status judgement (R² doesn't have a "bad" value here).
    els.r2Bar.style.background = `color-mix(in srgb, var(--clr-navy) ${Math.max(15, Math.round(r2 * 100))}%, white)`;

    const [lo, hi] = result.ci[idx];
    els.ci.textContent = `[£${lo.toFixed(0)}, £${hi.toFixed(0)}]`;
    flashValue(els.ci);
    const loPct = ciPct(lo),
      hiPct = ciPct(hi);
    els.ciRange.style.left = `${loPct}%`;
    els.ciRange.style.width = `${Math.max(0, hiPct - loPct)}%`;
    els.ciTick.style.opacity = "1";
    els.ciTick.style.left = `${ciPct(truthOvercharge)}%`;
  }

  return { update, el: card };
}

// Section heading helper
export function createSectionHeading(container, text, setupOnly = false) {
  const h = document.createElement("div");
  h.className = "section-heading";
  h.textContent = text;
  if (setupOnly) h.dataset.setupOnly = "";
  container.appendChild(h);
  return h;
}
