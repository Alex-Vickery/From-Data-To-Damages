// App entry point: tab routing, shared state initialisation

import { state } from './data/state.js';
import { initThemeToggle } from './ui/theme-toggle.js';
import { initCover } from './ui/cover.js';
import { createSupplyChainTab } from './modules/module1-supply-chain.js';

const modules = {
  module1: { init: createSupplyChainTab, instance: null, loaded: false },
  module2: { init: null, instance: null, loaded: false },
  module3: { init: null, instance: null, loaded: false },
  module4: { init: null, instance: null, loaded: false },
  module5: { init: null, instance: null, loaded: false }
};

let activeTab = 'module1';

// ── Lazy loaders ──────────────────────────────────────────────────────────

async function loadModule2() {
  if (modules.module2.init) return;
  try {
    const { createSceneTab } = await import('./modules/module2-scene.js');
    modules.module2.init = createSceneTab;
  } catch (e) { console.error('Tab 2 load error:', e); }
}

async function loadModule3() {
  if (modules.module3.init) return;
  try {
    const { createRegressionTab } = await import('./modules/module3-regression.js');
    modules.module3.init = createRegressionTab;
  } catch (e) { console.error('Tab 3 load error:', e); }
}

async function loadModule4() {
  if (modules.module4.init) return;
  try {
    const { createTimeComparatorTab } = await import('./modules/module4-time-comparator.js');
    modules.module4.init = createTimeComparatorTab;
  } catch (e) { console.error('Tab 4 load error:', e); }
}

async function loadModule5() {
  if (modules.module5.init) return;
  try {
    const { createGeoComparatorTab } = await import('./modules/module5-geo-comparator.js');
    modules.module5.init = createGeoComparatorTab;
  } catch (e) { console.error('Tab 5 load error:', e); }
}

// ── Tab switching ─────────────────────────────────────────────────────────

function switchTab(tabId) {
  if (!modules[tabId]) return;

  // Lifecycle: let the outgoing module pause animations, the incoming one resume
  if (activeTab !== tabId) {
    modules[activeTab]?.instance?.onHide?.();
  }
  activeTab = tabId;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    const selected = btn.dataset.tab === tabId;
    btn.classList.toggle('active', selected);
    btn.setAttribute('aria-selected', String(selected));
  });

  // Outgoing tab disappears instantly; the incoming one fades in — split
  // across two classes (display via .tab-shown, opacity via .active) with
  // a forced reflow between them so the browser has a starting frame to
  // transition from (display:none -> block and opacity:0 -> 1 in the same
  // tick would otherwise skip the animation).
  document.querySelectorAll('.tab-content').forEach(el => {
    if (el.id !== tabId) {
      el.classList.remove('active', 'tab-shown');
    }
  });
  const nextEl = document.getElementById(tabId);
  nextEl.classList.add('tab-shown');
  void nextEl.offsetHeight;
  nextEl.classList.add('active');

  const mod       = modules[tabId];
  const container = nextEl;
  if (!mod.loaded && mod.init) {
    mod.instance = mod.init(container);
    mod.loaded   = true;
  } else if (!mod.loaded) {
    container.innerHTML = `<div class="module-placeholder">Loading…</div>`;
    mod.loaded = true;
  } else {
    mod.instance?.onShow?.();
  }
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────

document.addEventListener('keydown', async (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  switch (e.key) {
    case '1': switchTab('module1'); break;
    case '2': await loadModule2(); switchTab('module2'); break;
    case '3': await loadModule3(); switchTab('module3'); break;
    case '4': await loadModule4(); switchTab('module4'); break;
    case '5': await loadModule5(); switchTab('module5'); break;
    case 'r':
    case 'R':
      if (!e.ctrlKey && !e.metaKey) {
        const mod = modules[activeTab];
        if (mod.instance?.resample) mod.instance.resample();
      }
      break;
    case 'ArrowLeft':
    case 'ArrowRight': {
      const mod = modules[activeTab];
      if (mod.instance?.presetBar) {
        const bar  = mod.instance.presetBar;
        const idx  = bar.getActiveIndex();
        const tot  = bar.buttons.length;
        const next = e.key === 'ArrowRight' ? Math.min(idx + 1, tot - 1) : Math.max(idx - 1, 0);
        if (next !== idx && next >= 0) bar.buttons[next].click();
      }
      break;
    }
  }
});

// ── Tab click handlers ────────────────────────────────────────────────────

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const tab = btn.dataset.tab;
    if (tab === 'module2') await loadModule2();
    if (tab === 'module3') await loadModule3();
    if (tab === 'module4') await loadModule4();
    if (tab === 'module5') await loadModule5();
    switchTab(tab);
  });
});

// ── Initialise ────────────────────────────────────────────────────────────

state.init();
initThemeToggle();
initCover();
switchTab('module1');
