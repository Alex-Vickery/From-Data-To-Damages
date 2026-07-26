// Shared back/forward narrative controller for the story tabs. Each step is
// { label, render(idx) }. Exposes the same { buttons, getActiveIndex,
// setActive } shape createScenarioButtons used to, so app.js's arrow-key
// handler keeps working unchanged.
//
// The Back/Forward buttons float over the left/right edges of the chart
// itself — translucent at rest, opaque + slightly enlarged on hover — so
// the graph takes center stage. No dots, no step label; the caption
// carries the story.

const CHEVRON_LEFT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>`;
const CHEVRON_RIGHT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>`;

export function createStoryController(container, config) {
  const { steps, chartWrapper } = config;

  let activeIdx = -1;

  chartWrapper.classList.add('has-floating-nav');

  const prevBtn = document.createElement('button');
  prevBtn.className = 'story-float-btn story-float-prev';
  prevBtn.innerHTML = CHEVRON_LEFT;
  prevBtn.setAttribute('aria-label', 'Previous step');

  const nextBtn = document.createElement('button');
  nextBtn.className = 'story-float-btn story-float-next';
  nextBtn.innerHTML = CHEVRON_RIGHT;
  nextBtn.setAttribute('aria-label', 'Next step');

  chartWrapper.appendChild(prevBtn);
  chartWrapper.appendChild(nextBtn);

  function goTo(idx) {
    idx = Math.max(0, Math.min(steps.length - 1, idx));
    if (idx === activeIdx) return;
    activeIdx = idx;
    prevBtn.disabled = idx === 0;
    nextBtn.disabled = idx === steps.length - 1;
    steps[idx].render(idx);
  }

  prevBtn.addEventListener('click', () => goTo(activeIdx - 1));
  nextBtn.addEventListener('click', () => goTo(activeIdx + 1));

  // Proxy array satisfying app.js's presetBar contract (.length, [i].click())
  // without requiring per-step DOM buttons
  const buttons = steps.map((step, idx) => ({ click: () => goTo(idx) }));

  return {
    buttons,
    getActiveIndex: () => activeIdx,
    setActive: goTo,
    goTo,
  };
}
