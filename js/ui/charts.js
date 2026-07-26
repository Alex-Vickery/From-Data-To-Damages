// D3 chart primitives for all modules
// Label fonts live in CSS classes (.event-label, .legend-label, …) so the
// --fs-* scale applies to in-chart text too.

const d3 = () => window.d3;

const STROKE_MAIN = 3;   // primary data series
const STROKE_REF  = 2;   // reference/event lines

export function createChart(container, config = {}) {
  const {
    marginTop = 30, marginRight = 25, marginBottom = 40, marginLeft = 55,
    xLabel = '', yLabel = '', title = '',
    xTickFormat = null, xTickValues = null,
    hoverFormatX = null
  } = config;

  const wrapper = document.createElement('div');
  wrapper.className = 'chart-wrapper';
  container.appendChild(wrapper);

  const svg = d3().select(wrapper).append('svg')
    .attr('class', 'chart-svg')
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const defs = svg.append('defs');

  const gRoot = svg.append('g')
    .attr('transform', `translate(${marginLeft},${marginTop})`);

  gRoot.append('rect').attr('class', 'chart-bg').attr('fill', 'transparent');

  const clipId = 'clip-' + Math.random().toString(36).substr(2, 9);
  defs.append('clipPath').attr('id', clipId)
    .append('rect').attr('class', 'clip-rect');

  const gClipped = gRoot.append('g').attr('clip-path', `url(#${clipId})`);
  const gAxes    = gRoot.append('g');
  const gXAxis   = gAxes.append('g').attr('class', 'x-axis');
  const gYAxis   = gAxes.append('g').attr('class', 'y-axis');
  // Invisible widened hit strokes for hover live here — appended after the
  // axes so they always sit on top of every mark
  const gHit     = gRoot.append('g').attr('clip-path', `url(#${clipId})`);

  const xLabelEl = gAxes.append('text').attr('class', 'axis-label x-axis-label')
    .attr('text-anchor', 'middle').text(xLabel);
  const yLabelEl = gAxes.append('text').attr('class', 'axis-label y-axis-label')
    .attr('text-anchor', 'middle').text(yLabel);

  const titleEl = svg.append('text').attr('class', 'chart-title')
    .attr('text-anchor', 'start').text(title);

  let xScale = d3().scaleLinear();
  let yScale = d3().scaleLinear();
  let width = 0, height = 0;

  function resize() {
    // Measure the SVG itself, not the wrapper — the wrapper may carry
    // horizontal padding (floating-nav gutters) the plot must not fill
    const rect = svg.node().getBoundingClientRect();
    width  = Math.max(rect.width  - marginLeft - marginRight,  80);
    height = Math.max(rect.height - marginTop  - marginBottom, 60);

    svg.attr('viewBox', `0 0 ${rect.width} ${rect.height}`);
    gRoot.select('.chart-bg').attr('width', width).attr('height', height);
    svg.select('.clip-rect').attr('width', width).attr('height', height);

    gXAxis.attr('transform', `translate(0,${height})`);
    xLabelEl.attr('x', width / 2).attr('y', height + marginBottom - 5);
    yLabelEl.attr('transform', `translate(${-marginLeft + 15},${height / 2}) rotate(-90)`);
    titleEl.attr('x', marginLeft).attr('y', 20);

    xScale.range([0, width]);
    yScale.range([height, 0]);
  }

  function updateAxes(xDomain, yDomain, transitionDur = 400) {
    xScale.domain(xDomain);
    yScale.domain(yDomain);

    const t = gAxes.transition().duration(transitionDur).ease(d3().easeQuadInOut);

    let xAxis = d3().axisBottom(xScale).ticks(Math.min(width / 65, 11));
    if (xTickValues) xAxis = xAxis.tickValues(xTickValues);
    if (xTickFormat) xAxis = xAxis.tickFormat(xTickFormat);
    gXAxis.transition(t).call(xAxis);

    gYAxis.transition(t).call(d3().axisLeft(yScale).ticks(Math.min(height / 40, 8)));
  }

  setTimeout(resize, 0);
  const observer = new ResizeObserver(resize);
  observer.observe(wrapper);

  const chartApi = {
    svg, gRoot, gClipped, gAxes, gHit, hoverFormatX,
    get xScale() { return xScale; },
    get yScale() { return yScale; },
    get width()  { return width; },
    get height() { return height; },
    get marginLeft() { return marginLeft; },
    get marginTop()  { return marginTop; },
    resize, updateAxes, wrapper,
    // Swap a hovered series' presenter note (and optionally its tooltip
    // label and swatch/marker colour), e.g. per story step
    setHoverNote(key, note, label = null, color = null) {
      const entry = chartApi._hover?.entries.get(key);
      if (entry) {
        entry.note = note;
        if (label) entry.label = label;
        if (color) entry.color = color;
      }
    },
    destroy: () => { observer.disconnect(); wrapper.remove(); }
  };
  return chartApi;
}

// ─── Hover layer: line pop + presenter tooltip ─────────────────────────
// Binders opt in via a `hover: { label, note, formatY }` config. The layer
// is one shared HTML tooltip per chart plus an invisible widened hit path
// per registered series (in gHit, always on top of the marks).

function ensureHoverLayer(chart) {
  if (chart._hover) return chart._hover;

  const tooltip = document.createElement('div');
  tooltip.className = 'chart-tooltip';

  const head   = document.createElement('div');
  head.className = 'chart-tooltip-head';
  const swatch = document.createElement('span');
  swatch.className = 'chart-tooltip-swatch';
  const label  = document.createElement('span');
  head.appendChild(swatch);
  head.appendChild(label);

  const xy   = document.createElement('div');
  xy.className = 'chart-tooltip-xy';
  const note = document.createElement('div');
  note.className = 'chart-tooltip-note';

  tooltip.appendChild(head);
  tooltip.appendChild(xy);
  tooltip.appendChild(note);
  chart.wrapper.appendChild(tooltip);

  const marker = chart.gRoot.append('circle')
    .attr('class', 'tooltip-marker')
    .attr('r', 5)
    .attr('opacity', 0);

  chart._hover = { tooltip, swatch, label, xy, note, marker, entries: new Map(), active: null };
  return chart._hover;
}

function clearHover(chart) {
  const layer = chart._hover;
  if (!layer) return;
  layer.entries.forEach(e => {
    e.visiblePath
      .classed('line-pop', false)
      .classed('series-dim', false)
      .attr('stroke-width', e.baseWidth);
  });
  layer.tooltip.classList.remove('visible');
  layer.marker.attr('opacity', 0);
  layer.active = null;
}

function attachHover(chart, key, visiblePath, hover, defaults) {
  const layer = ensureHoverLayer(chart);
  const entry = {
    key,
    visiblePath,
    color:     defaults.color,
    baseWidth: defaults.strokeWidth,
    label:     hover.label || key,
    note:      hover.note || '',
    formatY:   hover.formatY || (v => `£${Math.round(v)}/t`),
    data: [], xAcc: null, yAcc: null,
    visible: false,
    hitPath: chart.gHit.append('path').attr('class', `hover-hit hit-${key}`)
  };
  layer.entries.set(key, entry);

  entry.hitPath
    .on('pointerenter', () => {
      layer.active = entry;
      entry.visiblePath
        .classed('line-pop', true)
        .classed('series-dim', false)
        .attr('stroke-width', entry.baseWidth * 1.7);
      layer.entries.forEach(other => {
        if (other !== entry && other.visible) other.visiblePath.classed('series-dim', true);
      });
    })
    .on('pointermove', (ev) => {
      if (!entry.data.length) return;
      const [mx] = d3().pointer(ev, chart.gClipped.node());
      const xVal = chart.xScale.invert(mx);
      const idx  = d3().leastIndex(entry.data, d => {
        const y = entry.yAcc(d);
        return isNaN(y) ? Infinity : Math.abs(entry.xAcc(d) - xVal);
      });
      if (idx == null || idx < 0) return;
      const d = entry.data[idx];
      const xv = entry.xAcc(d), yv = entry.yAcc(d);
      if (isNaN(yv)) return;

      layer.marker
        .attr('cx', chart.xScale(xv))
        .attr('cy', chart.yScale(yv))
        .attr('fill', entry.color)
        .attr('opacity', 1);

      const fmtX = chart.hoverFormatX || ((v) => String(Math.round(v)));
      layer.swatch.style.background = entry.color;
      layer.label.textContent = entry.label;
      layer.xy.textContent = `${fmtX(xv)} · ${entry.formatY(yv)}`;
      const noteText = typeof entry.note === 'function' ? entry.note(d, idx) : entry.note;
      layer.note.textContent = noteText || '';
      layer.note.style.display = noteText ? '' : 'none';

      const [wx, wy] = d3().pointer(ev, chart.wrapper);
      const rect = chart.wrapper.getBoundingClientRect();
      const tt = layer.tooltip;
      tt.classList.add('visible');
      if (wx > rect.width * 0.6) {
        tt.style.left = 'auto';
        tt.style.right = `${rect.width - wx + 14}px`;
      } else {
        tt.style.right = 'auto';
        tt.style.left = `${wx + 14}px`;
      }
      const clampedTop = Math.max(8, Math.min(wy - 20, rect.height - tt.offsetHeight - 8));
      tt.style.top = `${clampedTop}px`;
    })
    .on('pointerleave', () => clearHover(chart));

  return entry;
}

// Sync the invisible hit path to the visible line. Runs inside binder update
// closures — no transition, so the hit area is instantly where the data is.
function syncHitPath(chart, entry, data, xAcc, yAcc, lineGen, visible = true) {
  entry.data = data || [];
  entry.xAcc = xAcc;
  entry.yAcc = yAcc;
  const hasData = visible && entry.data.some(d => !isNaN(yAcc(d)));
  entry.visible = hasData;
  entry.hitPath
    .style('display', hasData ? null : 'none')
    .attr('d', hasData ? lineGen(entry.data) : null);
  // If the hovered series just vanished, don't strand the tooltip
  if (!hasData && chart._hover?.active === entry) clearHover(chart);
}

// Animated line binding
export function bindLine(chart, key, config = {}) {
  const { color = 'var(--clr-observed)', strokeWidth = STROKE_MAIN, dashArray = null, opacity = 1, hover = null } = config;

  let path = chart.gClipped.select(`.line-${key}`);
  if (path.empty()) {
    path = chart.gClipped.append('path')
      .attr('class', `line-${key}`)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', strokeWidth)
      .attr('opacity', opacity);
    if (dashArray) path.attr('stroke-dasharray', dashArray);
  }

  const hoverEntry = hover ? attachHover(chart, key, path, hover, { color, strokeWidth }) : null;

  // Optional `style` restyles the line WITHIN the same transition as the
  // geometry morph — a separate transition on the same node would cancel
  // the in-flight `d` tween and the line would jump instead of pivoting.
  //
  // Optional `immediate`: skip the transition entirely and set `d` (and
  // style) synchronously. Used to "seed" a path's starting position right
  // before an animated call on the same tick — e.g. a line that's about to
  // split in two can be seeded at its pre-split position so the split
  // itself tweens smoothly instead of snapping in from nothing. A plain
  // `.attr()` set is synchronous, so a `.transition()` issued immediately
  // afterward correctly reads it as the tween's starting value.
  return function update(data, xAccessor, yAccessor, dur = 400, style = null, immediate = false) {
    const line = d3().line()
      .x(d => chart.xScale(xAccessor(d)))
      .y(d => chart.yScale(yAccessor(d)))
      .defined(d => !isNaN(yAccessor(d)));

    if (style && 'dashArray' in style) path.attr('stroke-dasharray', style.dashArray);

    if (immediate) {
      path.interrupt().datum(data).attr('d', line);
      if (style && style.stroke) path.attr('stroke', style.stroke);
      return;
    }

    const tr = path.datum(data)
      .transition().duration(dur).ease(d3().easeQuadInOut)
      .attr('d', line);
    if (style && style.stroke) tr.attr('stroke', style.stroke);

    if (hoverEntry) syncHitPath(chart, hoverEntry, data, xAccessor, yAccessor, line);
  };
}

// Animated line with draw-on effect (for reveal animations)
export function bindLineAnimated(chart, key, config = {}) {
  const { color = 'var(--clr-counterfactual)', strokeWidth = STROKE_MAIN, dashArray = null, hover = null } = config;

  let path = chart.gClipped.select(`.anim-line-${key}`);
  if (path.empty()) {
    path = chart.gClipped.append('path')
      .attr('class', `anim-line-${key}`)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', strokeWidth)
      .attr('opacity', 0);
    if (dashArray) path.attr('stroke-dasharray', dashArray);
  }

  const hoverEntry = hover ? attachHover(chart, key, path, hover, { color, strokeWidth }) : null;

  // The stroke-dashoffset "draw-on" entrance should only play the first
  // time the line is revealed. Later calls (data change, another reveal
  // toggling elsewhere, a resize) just morph the existing path in place —
  // otherwise every unrelated re-render replays the whole entrance.
  let hasDrawnOnce = false;

  return function draw(data, xAcc, yAcc, visible = true, dur = 800) {
    if (!visible) {
      path.transition().duration(300).ease(d3().easeQuadInOut).attr('opacity', 0);
      hasDrawnOnce = false;
      if (hoverEntry) syncHitPath(chart, hoverEntry, [], xAcc, yAcc, null, false);
      return;
    }
    const lineGen = d3().line()
      .x(d => chart.xScale(xAcc(d)))
      .y(d => chart.yScale(yAcc(d)))
      .defined(d => !isNaN(yAcc(d)));
    const d = lineGen(data);

    if (hoverEntry) syncHitPath(chart, hoverEntry, data, xAcc, yAcc, lineGen);

    if (!hasDrawnOnce) {
      path.attr('d', d).attr('opacity', 0);
      const totalLen = path.node().getTotalLength();
      path.attr('stroke-dasharray', `${totalLen} ${totalLen}`)
          .attr('stroke-dashoffset', totalLen)
          .transition().duration(dur).ease(d3().easeQuadInOut)
          .attr('stroke-dashoffset', 0)
          .attr('opacity', 1)
          .on('end', () => path.attr('stroke-dasharray', dashArray || null));
      hasDrawnOnce = true;
    } else {
      path.transition().duration(400).ease(d3().easeQuadInOut)
        .attr('d', d).attr('opacity', 1);
    }
  };
}

// Shaded vertical region
export function bindRegion(chart, key, config = {}) {
  const { color = 'var(--clr-cartel)', opacity = 1 } = config;

  let rect = chart.gClipped.select(`.region-${key}`);
  if (rect.empty()) {
    rect = chart.gClipped.append('rect')
      .attr('class', `region-${key}`)
      .attr('fill', color)
      .attr('opacity', opacity);
  }

  return function update(x0, x1, dur = 400) {
    rect.transition().duration(dur).ease(d3().easeQuadInOut)
      .attr('x', chart.xScale(x0))
      .attr('width', Math.max(0, chart.xScale(x1) - chart.xScale(x0)))
      .attr('y', 0)
      .attr('height', chart.height);
  };
}

// Region with visibility toggle
export function bindRegionToggle(chart, key, config = {}) {
  const { color = 'var(--clr-cartel)', opacity = 1 } = config;

  let rect = chart.gClipped.select(`.region-toggle-${key}`);
  if (rect.empty()) {
    rect = chart.gClipped.append('rect')
      .attr('class', `region-toggle-${key}`)
      .attr('fill', color)
      .attr('opacity', 0)
      .attr('y', 0);
  }

  return function show(x0, x1, visible = true, dur = 400) {
    if (!visible) {
      rect.transition().duration(dur).ease(d3().easeQuadInOut).attr('opacity', 0);
      return;
    }
    rect.attr('x', chart.xScale(x0))
        .attr('width', Math.max(0, chart.xScale(x1) - chart.xScale(x0)))
        .attr('height', chart.height)
        .transition().duration(dur)
        .attr('opacity', 1);
  };
}

// Shaded area between two lines
export function bindArea(chart, key, config = {}) {
  const { color = 'rgba(62, 135, 120, 0.18)', strokeColor = null } = config;

  let area = chart.gClipped.select(`.area-${key}`);
  if (area.empty()) {
    area = chart.gClipped.append('path')
      .attr('class', `area-${key}`)
      .attr('fill', color)
      .attr('opacity', 0);
    if (strokeColor) area.attr('stroke', strokeColor).attr('stroke-width', 1);
  }

  return function update(data, xAcc, y0Acc, y1Acc, visible = true, dur = 400) {
    if (!visible) { area.transition().duration(dur).attr('opacity', 0); return; }
    const areaGen = d3().area()
      .x(d => chart.xScale(xAcc(d)))
      .y0(d => chart.yScale(y0Acc(d)))
      .y1(d => chart.yScale(y1Acc(d)))
      .defined(d => !isNaN(y0Acc(d)) && !isNaN(y1Acc(d)));
    area.datum(data)
      .transition().duration(dur).ease(d3().easeQuadInOut)
      .attr('d', areaGen)
      .attr('opacity', 1);
  };
}

// Vertical event line with label
export function bindEventLine(chart, key, config = {}) {
  const { color = 'var(--clr-cartel-border)', dashArray = null, label = '' } = config;

  let line = chart.gClipped.select(`.event-line-${key}`);
  let text = chart.gClipped.select(`.event-label-${key}`);
  if (line.empty()) {
    line = chart.gClipped.append('line')
      .attr('class', `event-line-${key}`)
      .attr('stroke', color).attr('stroke-width', STROKE_REF)
      .attr('opacity', 0);
    if (dashArray) line.attr('stroke-dasharray', dashArray);
    // Label sits above the plot area, so it must live outside the clip path
    text = chart.gRoot.append('text')
      .attr('class', `event-label event-label-${key}`)
      .attr('fill', color)
      .attr('text-anchor', 'middle').text(label).attr('opacity', 0);
  }

  return function update(xVal, visible = true, dur = 400) {
    const t = d3().transition().duration(dur).ease(d3().easeQuadInOut);
    const op = visible ? 1 : 0;
    line.transition(t)
      .attr('x1', chart.xScale(xVal)).attr('x2', chart.xScale(xVal))
      .attr('y1', 0).attr('y2', chart.height).attr('opacity', op);
    text.transition(t)
      .attr('x', chart.xScale(xVal)).attr('y', -5).attr('opacity', op);
  };
}

// Horizontal reference line
export function bindHLine(chart, key, config = {}) {
  const { color = 'var(--clr-truth)', dashArray = '6,3', label = '', hover = null } = config;

  let line = chart.gClipped.select(`.hline-${key}`);
  let text = chart.gClipped.select(`.hline-label-${key}`);
  if (line.empty()) {
    line = chart.gClipped.append('line')
      .attr('class', `hline-${key}`)
      .attr('stroke', color).attr('stroke-width', STROKE_REF)
      .attr('stroke-dasharray', dashArray).attr('opacity', 0);
    text = chart.gClipped.append('text')
      .attr('class', `hline-label hline-label-${key}`)
      .attr('fill', color)
      .attr('text-anchor', 'end').text(label).attr('opacity', 0);
  }

  const hoverEntry = hover ? attachHover(chart, key, line, hover, { color, strokeWidth: STROKE_REF }) : null;

  return function update(yVal, visible = true, dur = 400) {
    const t = d3().transition().duration(dur).ease(d3().easeQuadInOut);
    const op = visible ? 1 : 0;
    line.transition(t)
      .attr('x1', 0).attr('x2', chart.width)
      .attr('y1', chart.yScale(yVal)).attr('y2', chart.yScale(yVal))
      .attr('opacity', op);
    text.transition(t)
      .attr('x', chart.width - 4).attr('y', chart.yScale(yVal) - 5)
      .attr('opacity', op);

    if (hoverEntry) {
      // Synthetic per-month points along the line so the shared hover layer
      // (nearest-point lookup, snap marker, tooltip) works unchanged
      const [x0, x1] = chart.xScale.domain();
      const pts = [];
      for (let m = Math.ceil(x0); m <= Math.floor(x1); m++) pts.push({ t: m, y: yVal });
      const lineGen = d3().line()
        .x(d => chart.xScale(d.t))
        .y(d => chart.yScale(d.y));
      syncHitPath(chart, hoverEntry, pts, d => d.t, d => d.y, lineGen, visible);
    }
  };
}

// Residual line segments (from observed to fitted)
export function bindResidualLines(chart, key, config = {}) {
  const { color = 'var(--clr-secondary)', opacity = 0.8, strokeWidth = STROKE_REF } = config;

  return function update(data, xAcc, yObsAcc, yFitAcc, visible = true, dur = 300) {
    const lines = chart.gClipped.selectAll(`.resid-seg-${key}`).data(visible ? data : []);
    const t = d3().transition().duration(dur);

    lines.enter().append('line')
      .attr('class', `resid-seg-${key}`)
      .attr('stroke', color)
      .attr('stroke-width', strokeWidth)
      .attr('opacity', 0)
      .attr('x1', d => chart.xScale(xAcc(d))).attr('x2', d => chart.xScale(xAcc(d)))
      .attr('y1', d => chart.yScale(yObsAcc(d))).attr('y2', d => chart.yScale(yFitAcc(d)))
      .transition(t).attr('opacity', opacity);

    lines.transition(t)
      .attr('x1', d => chart.xScale(xAcc(d))).attr('x2', d => chart.xScale(xAcc(d)))
      .attr('y1', d => chart.yScale(yObsAcc(d))).attr('y2', d => chart.yScale(yFitAcc(d)))
      .attr('opacity', opacity);

    lines.exit().transition(t).attr('opacity', 0).remove();
  };
}

// Horizontal group averages with labels (for DiD)
export function bindGroupAvgLines(chart) {
  return function update(groups, visible = true, dur = 400) {
    const data = visible ? groups : [];
    const lines = chart.gClipped.selectAll('.group-avg-line').data(data, d => d.id);
    const texts = chart.gClipped.selectAll('.group-avg-label').data(data, d => d.id);
    const t = d3().transition().duration(dur);

    lines.enter().append('line').attr('class', 'group-avg-line')
      .attr('stroke', d => d.color).attr('stroke-width', STROKE_MAIN)
      .attr('stroke-dasharray', '8,4').attr('opacity', 0)
      .merge(lines).transition(t)
      .attr('x1', d => chart.xScale(d.x0)).attr('x2', d => chart.xScale(d.x1))
      .attr('y1', d => chart.yScale(d.y)).attr('y2', d => chart.yScale(d.y))
      .attr('opacity', 0.9);

    lines.exit().transition(t).attr('opacity', 0).remove();

    // Label text wears ink (CSS class); the coloured line carries identity.
    // Anchored at the segment's own midpoint (not its edge) so the four
    // labels naturally separate from each other and from the boundary
    // event-lines, rather than clustering at a shared edge.
    texts.enter().append('text').attr('class', 'group-avg-label')
      .attr('text-anchor', 'middle').attr('opacity', 0)
      .merge(texts).transition(t)
      .attr('x', d => chart.xScale((d.x0 + d.x1) / 2)).attr('y', d => chart.yScale(d.y) - 10)
      .attr('opacity', 1)
      .text(d => d.label);

    texts.exit().transition(t).attr('opacity', 0).remove();
  };
}

// Scatter points
export function bindPoints(chart, key, config = {}) {
  const { radius = 3, opacity = 0.65 } = config;

  return function update(data, xAcc, yAcc, colorAcc, dur = 400) {
    const t = d3().transition().duration(dur).ease(d3().easeQuadInOut);

    const circles = chart.gClipped.selectAll(`.point-${key}`)
      .data(data, (d, i) => i);

    circles.enter().append('circle')
      .attr('class', `point-${key}`)
      .attr('r', 0).attr('opacity', opacity)
      .attr('cx', d => chart.xScale(xAcc(d)))
      .attr('cy', d => chart.yScale(yAcc(d)))
      .attr('fill', d => typeof colorAcc === 'function' ? colorAcc(d) : (colorAcc || 'var(--clr-navy)'))
      .transition(t).attr('r', radius);

    circles.transition(t)
      .attr('r', radius)   // re-assert: an interrupted enter transition must not strand r near 0
      .attr('cx', d => chart.xScale(xAcc(d)))
      .attr('cy', d => chart.yScale(yAcc(d)))
      .attr('fill', d => typeof colorAcc === 'function' ? colorAcc(d) : (colorAcc || 'var(--clr-navy)'));

    circles.exit().transition(t).attr('r', 0).remove();
  };
}

// Legend
export function createLegend(chart, items, config = {}) {
  const { xOffset = 0, yOffset = 0 } = config;
  let g = chart.gRoot.select('.legend-group');
  if (g.empty()) g = chart.gRoot.append('g').attr('class', 'legend-group');
  g.selectAll('*').remove();

  items.forEach((item, i) => {
    const x = chart.width - 10 - xOffset;
    const y = i * 22 + 4 + yOffset;

    const swatch = g.append('line').attr('x1', x - 24).attr('x2', x - 4)
      .attr('y1', y).attr('y2', y)
      .attr('stroke', item.color).attr('stroke-width', item.strokeWidth || STROKE_MAIN);
    if (item.dash) swatch.attr('stroke-dasharray', item.dash);
    if (item.opacity) swatch.attr('opacity', item.opacity);

    // Legend text wears ink; the swatch carries identity
    g.append('text').attr('class', 'legend-label')
      .attr('x', x - 30).attr('y', y + 4)
      .attr('text-anchor', 'end')
      .text(item.label);
  });
}

// Individual member series fanning out from (and collapsing back into) the average line
export function bindMemberLines(chart, key, config = {}) {
  const { color = 'var(--clr-member)', strokeWidth = 1.4, opacity = 0.7 } = config;

  return function update(seriesList, avgSeries, xAcc, yAcc, visible = true, dur = 700) {
    const lineGen = d3().line()
      .x(d => chart.xScale(xAcc(d)))
      .y(d => chart.yScale(yAcc(d)))
      .defined(d => !isNaN(yAcc(d)));
    const avgPath = lineGen(avgSeries);

    const sel = chart.gClipped.selectAll(`.member-line-${key}`)
      .data(visible ? seriesList : [], (d, i) => i);
    const t = d3().transition().duration(dur).ease(d3().easeQuadInOut);

    sel.enter().append('path')
      .attr('class', `member-line-${key}`)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', strokeWidth)
      .attr('opacity', 0)
      .attr('d', avgPath)
      .transition(t)
      .attr('d', d => lineGen(d))
      .attr('opacity', opacity);

    sel.transition(t)
      .attr('d', d => lineGen(d))
      .attr('opacity', opacity);

    sel.exit().transition(t)
      .attr('d', avgPath)
      .attr('opacity', 0)
      .remove();
  };
}

// Vertical difference bracket: stem + end caps + bold label (for DiD first differences)
export function bindDiffBracket(chart, key, config = {}) {
  const { color = 'var(--clr-navy)', capWidth = 12 } = config;

  let g = chart.gClipped.select(`.bracket-${key}`);
  if (g.empty()) {
    g = chart.gClipped.append('g').attr('class', `bracket-${key}`).attr('opacity', 0);
    g.append('line').attr('class', 'bracket-stem').attr('stroke', color).attr('stroke-width', 2.5);
    g.append('line').attr('class', 'bracket-cap-a').attr('stroke', color).attr('stroke-width', 2.5);
    g.append('line').attr('class', 'bracket-cap-b').attr('stroke', color).attr('stroke-width', 2.5);
    // NOTE: not 'group-avg-label' — that class is a live data-join selector
    // in bindGroupAvgLines; sharing it corrupts the join
    g.append('text').attr('class', 'bracket-label').attr('text-anchor', 'start');
  }

  return function update(xVal, yA, yB, label, visible = true, dur = 400) {
    const t = d3().transition().duration(dur).ease(d3().easeQuadInOut);
    if (!visible) { g.transition(t).attr('opacity', 0); return; }

    const x  = chart.xScale(xVal);
    const ya = chart.yScale(yA);
    const yb = chart.yScale(yB);
    const half = capWidth / 2;

    g.select('.bracket-stem').attr('x1', x).attr('x2', x).attr('y1', ya).attr('y2', yb);
    g.select('.bracket-cap-a').attr('x1', x - half).attr('x2', x + half).attr('y1', ya).attr('y2', ya);
    g.select('.bracket-cap-b').attr('x1', x - half).attr('x2', x + half).attr('y1', yb).attr('y2', yb);
    g.select('.bracket-label')
      .attr('x', x + 8).attr('y', (ya + yb) / 2 + 4)
      .text(label);

    g.transition(t).attr('opacity', 1);
  };
}

// Floating HTML pop-up annotation with a pointer arrow, anchored to a data
// point. `side` is where the box sits relative to the target — the arrow
// protrudes from the box's opposite edge back toward the target (e.g.
// side: 'top' → box floats above the target, arrow points down at it).
export function bindAnnotation(chart, key, config = {}) {
  const { side = 'top', offset = 40 } = config;

  let box = chart.wrapper.querySelector(`.chart-annotation-${key}`);
  if (!box) {
    box = document.createElement('div');
    box.className = `chart-annotation chart-annotation-${key} annotation-${side}`;
    box.innerHTML = `<span class="chart-annotation-text"></span><span class="chart-annotation-arrow"></span>`;
    chart.wrapper.appendChild(box);
  }
  const textEl = box.querySelector('.chart-annotation-text');

  return function update(targetX, targetY, html, visible = false) {
    if (!visible) { box.classList.remove('visible'); return; }
    textEl.innerHTML = html;
    // Measure the <svg>'s live offset within the wrapper rather than
    // assuming it's flush with the wrapper's edge — .has-floating-nav
    // (see story-controller.js) pads the wrapper to make room for the
    // prev/next buttons, which insets the svg by that same amount.
    const svgRect = chart.svg.node().getBoundingClientRect();
    const wrapRect0 = chart.wrapper.getBoundingClientRect();
    const svgOffsetX = svgRect.left - wrapRect0.left;
    const svgOffsetY = svgRect.top - wrapRect0.top;
    const px = svgOffsetX + chart.marginLeft + chart.xScale(targetX);
    const py = svgOffsetY + chart.marginTop + chart.yScale(targetY);
    let left = px, top = py;
    if (side === 'top')    top = py - offset;
    if (side === 'bottom') top = py + offset;
    if (side === 'left')   left = px - offset;
    if (side === 'right')  left = px + offset;
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    box.classList.add('visible');

    // Nudge back in if the box would spill outside the chart wrapper —
    // a fixed offset/side can't anticipate every box size (text length
    // varies) or every target position (near an edge)
    const wrapRect = chart.wrapper.getBoundingClientRect();
    const boxRect = box.getBoundingClientRect();
    let dx = 0, dy = 0;
    if (boxRect.left < wrapRect.left) dx = wrapRect.left - boxRect.left;
    else if (boxRect.right > wrapRect.right) dx = wrapRect.right - boxRect.right;
    if (boxRect.top < wrapRect.top) dy = wrapRect.top - boxRect.top;
    else if (boxRect.bottom > wrapRect.bottom) dy = wrapRect.bottom - boxRect.bottom;
    if (dx || dy) {
      box.style.left = `${left + dx}px`;
      box.style.top = `${top + dy}px`;
    }
  };
}
