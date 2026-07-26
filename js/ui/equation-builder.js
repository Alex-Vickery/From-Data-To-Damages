// Dynamic regression-equation HTML builders.
// IMPORTANT: term order must mirror the column order of buildPanelMatrix()
// in js/data/datagen.js (grower FE, month FE, trend, cost index, shock,
// cartel, run-off years) — keep the two files in step.

const HL   = (s) => `<span class="eq-hl">${s}</span>`;        // the overcharge term
const WARN = (s) => `<span class="eq-warn">${s}</span>`;      // run-off terms

// Left-anchored label on the bare equation box (Time & Geographic Comparator)
const CURRENT_MODEL_LABEL = `<span class="eq-current-model-label">Current Model:</span>`;

// Time-comparator panel-regression equation (grower × month)
export function buildPanelEquationHTML(spec = {}) {
  const {
    includeMemberFE     = false,
    includeMonthFE      = false,
    includeTrend        = false,
    includeCostControl  = false,
    includeShockControl = false,
    extendCartelDummy   = false,
    runOffYearDummies    = 0,
  } = spec;

  const terms = ['α'];
  const legend = [['α', 'baseline price level']];

  if (includeMemberFE) {
    terms.push('Σ<sub>i</sub> γ<sub>i</sub>·Cartelist<sub>i</sub>');
    legend.push(['γᵢ', 'grower fixed effects — absorb baseline price differences between growers']);
  }
  if (includeMonthFE) {
    terms.push('Σ<sub>m</sub> τ<sub>m</sub>·Month<sub>m</sub>');
    legend.push(['τₘ', 'month-of-year fixed effects — absorb seasonality']);
  }
  if (includeTrend) {
    terms.push('φ·t');
    legend.push(['φ', 'linear time trend — the steady drift in prices']);
  }
  if (includeCostControl) {
    terms.push('β·InputCost<sub>t</sub>');
    legend.push(['β', 'input cost index (fertiliser/energy/packaging) — supply-cost control']);
  }
  if (includeShockControl) {
    terms.push('θ·MacroShock<sub>t</sub>');
    legend.push(['θ', 'one-off import cost shock']);
  }

  if (extendCartelDummy) {
    terms.push(HL('δ·Cartel<sub>Extended,t</sub>'));
    legend.push(['δ', 'overcharge — dummy wrongly extended over the run-off months']);
  } else {
    terms.push(HL('δ·Cartel<sub>t</sub>'));
    legend.push(['δ', 'overcharge — the coefficient we are after']);
  }

  if (runOffYearDummies > 0 && !extendCartelDummy) {
    terms.push(WARN('Σ<sub>j</sub> λ<sub>j</sub>·RunOffYear<sub>j,t</sub>'));
    legend.push(['λⱼ', 'run-off decay, year j after the cartel ended']);
  }

  terms.push('ε<sub>it</sub>');
  legend.push(['ε', 'error term']);

  return CURRENT_MODEL_LABEL + renderEquation(`p<sub>it</sub> = ${terms.join(' + ')}`, legend);
}

// Geographic-comparator (difference-in-differences) equation
export function buildDidEquationHTML(spec = {}) {
  const { includeTrend = false, includeGroupTrend = false } = spec;

  const terms = [
    'α',
    'β·Cartelised<sub>it</sub>',
    'γ·During<sub>it</sub>',
    HL('δ·(Cartelised<sub>it</sub>×During<sub>it</sub>)')
  ];
  const legend = [
    ['α',  'baseline (comparator, pre-period)'],
    ['β',  'level difference: UK vs comparator'],
    ['γ',  'common change in the during period'],
    ['δ',  'DiD estimate — the overcharge'],
  ];

  if (includeTrend)      { terms.push('φ·t');                    legend.push(['φ', 'common time trend']); }
  if (includeGroupTrend) { terms.push('ψ·(Cartelised<sub>it</sub>×t)');   legend.push(['ψ', 'UK-specific trend']); }

  terms.push('ε<sub>it</sub>');
  legend.push(['ε', 'error term']);

  return CURRENT_MODEL_LABEL + renderEquation(`p<sub>it</sub> = ${terms.join(' + ')}`, legend);
}

function renderEquation(main, legend) {
  const rows = legend.map(([sym, desc]) =>
    `<div class="eq-row"><span class="eq-sym">${sym}</span><span class="eq-desc">${desc}</span></div>`
  ).join('');
  return `<div class="equation-main">${main}</div><div class="equation-legend">${rows}</div>`;
}
