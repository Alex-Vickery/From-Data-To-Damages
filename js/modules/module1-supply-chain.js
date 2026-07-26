// Tab 1 — Supply Chain
// Animated diagram of the apple supply chain, coloured by position in the
// chain rather than cartel status: growers (navy) → direct purchasers
// (primary) → class members (secondary), plus a non-cartelist "Firm D"
// (a lighter tint of the growers' navy) for the umbrella-pricing story.
// Flow labels live in two mirrored gutters either side of the diagram —
// the main pass-on story on the left, the umbrella-effect equivalents on
// the right — so the whole figure reads symmetrically.

import { state } from "../data/state.js";
import { createSliderGroup } from "../ui/components.js";

const d3 = () => window.d3;

// ── Layout constants ───────────────────────────────────────────────────────
const SVG_W = 900;
const GUTTER_X = 18; // left edge of the left-gutter tier-label text
const LEFT_GUTTER_W = 190; // wide enough for the longest dynamic flow label
const RIGHT_GUTTER_W = 190; // mirrors the left gutter's width
const BOX_X = LEFT_GUTTER_W; // left edge of the box region
const BOX_W = SVG_W - BOX_X - RIGHT_GUTTER_W;
const CX = BOX_X + BOX_W / 2;
const GAP = 28; // wide enough that the cartel ring never overlaps Firm D
const BOX_RIGHT = BOX_X + BOX_W; // right edge of the box region
const RIGHT_TEXT_X = BOX_RIGHT + 36; // left-justified start x for the right gutter
// Room to the left of x=0 for the tier-label connector arrows to curve
// into. Added symmetrically to the right too, so the diagram stays centred.
const VIEWBOX_MARGIN = 28;

const TIERS = [
  {
    id: "growers",
    y: 40,
    h: 104,
    sideLabel: "Primary Producers",
    accent: "var(--clr-navy)",
    boxes: [
      { label: "Firm A", cartel: true },
      { label: "Firm B", cartel: true },
      { label: "Firm C", cartel: true },
      { label: "Firm D", cartel: false },
    ],
  },
  {
    id: "purchasers",
    y: 178,
    h: 76,
    boxWidth: BOX_W,
    sideLabel: "Direct Purchasers",
    accent: "var(--clr-primary)",
    boxes: [{ label: "e.g. OEMs, Supermarkets, Wholesalers" }],
  },
  {
    id: "consumers",
    y: 288,
    h: 56,
    boxWidth: BOX_W,
    sideLabel: "Consumers",
    accent: "var(--clr-secondary)",
    boxes: [{ label: "Class Members" }],
  },
];

const CHAN = [
  { from: 0, to: 1 },
  { from: 1, to: 2 },
];
CHAN.forEach((ch) => {
  ch.y0 = TIERS[ch.from].y + TIERS[ch.from].h;
  ch.y1 = TIERS[ch.to].y;
});

// Downstream flow is the same vertical height as the two flows above it
const DS_Y0 = TIERS[2].y + TIERS[2].h;
const DS_Y1 = DS_Y0 + (CHAN[0].y1 - CHAN[0].y0);
const SVG_H = DS_Y1 + 16;

const MAX_CHAN_W = 230; // widened since upstream/overcharge now share one narrower centre-x
const UMBRELLA_MAX_W = 46;
const DS_MAX_W = 70;

function boxPositions(tier) {
  const n = tier.boxes.length;
  if (tier.boxWidth) {
    const total = n * tier.boxWidth + (n - 1) * GAP;
    const startX = CX - total / 2;
    return tier.boxes.map((b, i) => ({
      ...b,
      x: startX + i * (tier.boxWidth + GAP),
      w: tier.boxWidth,
    }));
  }
  const w = (BOX_W - (n - 1) * GAP) / n;
  return tier.boxes.map((b, i) => ({ ...b, x: BOX_X + i * (w + GAP), w }));
}

// Width-aware label wrap: only splits across 2 lines if the text won't fit
// on one line at the given box width / font size.
function wrapLabel(text, boxWidth, fontPx = 15) {
  const estWidth = text.length * fontPx * 0.55;
  if (estWidth <= boxWidth * 0.92) return [text];
  const words = text.split(" ");
  if (words.length <= 1) return [text];
  let bestSplit = 1,
    bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const l1 = words.slice(0, i).join(" ").length;
    const l2 = words.slice(i).join(" ").length;
    const diff = Math.abs(l1 - l2);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestSplit = i;
    }
  }
  return [
    words.slice(0, bestSplit).join(" "),
    words.slice(bestSplit).join(" "),
  ];
}

// Trapezoid path centred on cx, narrowing/widening between two half-widths.
// bottomFrac controls how sharply it tapers at y1 (low = fades to a point).
function trapezoidPath(cx, halfW, y0, y1, bottomFrac = 0.95) {
  return `M ${cx - halfW} ${y0} L ${cx + halfW} ${y0} L ${cx + halfW * bottomFrac} ${y1} L ${cx - halfW * bottomFrac} ${y1} Z`;
}

// Lightweight reuse of the app's .chart-tooltip visual language for simple
// one-sentence node/flow explanations. Not the full attachHover() system in
// charts.js — that tracks a cursor's x-position along a data-bound line,
// which this diagram has no equivalent of; here every shape just needs a
// single static sentence on hover.
function createChainTooltip(wrapper) {
  const tooltip = document.createElement("div");
  tooltip.className = "chart-tooltip";
  const note = document.createElement("div");
  note.className = "chart-tooltip-note";
  tooltip.appendChild(note);
  wrapper.appendChild(tooltip);

  function position(evt) {
    const rect = wrapper.getBoundingClientRect();
    const wx = evt.clientX - rect.left;
    const wy = evt.clientY - rect.top;
    if (wx > rect.width * 0.6) {
      tooltip.style.left = "auto";
      tooltip.style.right = `${rect.width - wx + 14}px`;
    } else {
      tooltip.style.right = "auto";
      tooltip.style.left = `${wx + 14}px`;
    }
    const clampedTop = Math.max(
      8,
      Math.min(wy - 20, rect.height - tooltip.offsetHeight - 8),
    );
    tooltip.style.top = `${clampedTop}px`;
  }

  return {
    show(text, evt) {
      note.textContent = text;
      position(evt);
      tooltip.classList.add("visible");
    },
    move(evt) {
      position(evt);
    },
    hide() {
      tooltip.classList.remove("visible");
    },
  };
}

export function createSupplyChainTab(container) {
  container.innerHTML = "";

  // ── Outer layout ────────────────────────────────────────────────────────
  const layout = document.createElement("div");
  layout.className = "passon-layout";
  container.appendChild(layout);

  const chainSection = document.createElement("div");
  chainSection.className = "passon-chain-section";
  layout.appendChild(chainSection);

  const bottomRow = document.createElement("div");
  bottomRow.className = "passon-bottom-row";
  layout.appendChild(bottomRow);

  const controlsPanel = document.createElement("div");
  controlsPanel.className = "passon-controls";
  bottomRow.appendChild(controlsPanel);

  const harmSection = document.createElement("div");
  harmSection.className = "passon-harm-section";
  bottomRow.appendChild(harmSection);

  // ── Pass-on state ─────────────────────────────────────────────────────────
  let rhoUp = 0.5; // upstream: purchasers → consumers (capped at 100%)
  let rhoDown = 0.5; // downstream: consumers → further downstream (capped at 100%)
  let umbrellaPct = 0.5; // umbrella-pricing effect on the non-cartelist firm (0–100%)

  // ── Controls ──────────────────────────────────────────────────────────────
  const ctrlHead = document.createElement("h3");
  ctrlHead.className = "panel-heading";
  ctrlHead.textContent = "Parameters";
  controlsPanel.appendChild(ctrlHead);

  const rhoUpSlider = createSliderGroup(controlsPanel, {
    id: "sc-rho-up",
    label: "Upstream pass-on (%)",
    category: "purchaser",
    min: 0,
    max: 100,
    step: 10,
    value: 50,
    unit: "%",
    description:
      "% of the overcharge that direct purchasers pass on in their own prices",
  });
  rhoUpSlider.onChange((v) => {
    rhoUp = v / 100;
    update();
  });

  const rhoDownSlider = createSliderGroup(controlsPanel, {
    id: "sc-rho-down",
    label: "Downstream pass-on (%)",
    category: "consumer",
    min: 0,
    max: 100,
    step: 10,
    value: 50,
    unit: "%",
    description:
      "The pass-on defence: class members mitigating loss by passing the overcharge further downstream",
  });
  rhoDownSlider.onChange((v) => {
    rhoDown = v / 100;
    update();
  });

  const umbrellaSlider = createSliderGroup(controlsPanel, {
    id: "sc-umbrella",
    label: "Umbrella effect (%)",
    category: "umbrella",
    min: 0,
    max: 100,
    step: 10,
    value: 50,
    unit: "%",
    description:
      "Non-cartelist firms sheltering under the cartel’s higher price umbrella",
  });
  umbrellaSlider.onChange((v) => {
    umbrellaPct = v / 100;
    update();
  });

  // ── Supply chain SVG ───────────────────────────────────────────────────────
  const svgWrap = document.createElement("div");
  svgWrap.className = "supply-chain-wrap";
  chainSection.appendChild(svgWrap);

  const tooltip = createChainTooltip(svgWrap);

  const svg = d3()
    .select(svgWrap)
    .append("svg")
    .attr(
      "viewBox",
      `${-VIEWBOX_MARGIN} 0 ${SVG_W + 2 * VIEWBOX_MARGIN} ${SVG_H}`,
    )
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("width", "100%")
    .style("height", "100%");

  // Arrowhead marker for the curved tier-label connectors — auto-orients
  // to the curve's end tangent, which a manual polygon can't do cleanly
  const defs = svg.append("defs");
  defs
    .append("marker")
    .attr("id", "tier-connector-arrow")
    .attr("viewBox", "0 0 10 10")
    .attr("refX", 8.5)
    .attr("refY", 5)
    .attr("markerWidth", 5.5)
    .attr("markerHeight", 5.5)
    .attr("orient", "auto-start-reverse")
    .append("path")
    .attr("d", "M 0 0 L 10 5 L 0 10 Z")
    .attr("fill", "var(--clr-text-dim)");

  // Particle layer (behind tier boxes)
  const particleLayer = svg.append("g").attr("class", "particle-layer");

  // Cartel ring (behind everything except particles)
  const cartelRing = svg.append("g").attr("class", "cartel-ring-layer");

  // Channel trapezoids (behind tiers, updated dynamically)
  const chanPaths = CHAN.map((ch, ci) => {
    const g = svg.append("g");
    const path = g
      .append("path")
      .attr("class", `chain-flow chan-path-${ci}`)
      .attr("fill", "color-mix(in srgb, var(--clr-gold) 15%, transparent)")
      .attr("stroke", "color-mix(in srgb, var(--clr-gold) 50%, transparent)")
      .attr("stroke-width", 1);
    const flowTooltipText =
      ci === 0
        ? "The overcharge — the amount by which the cartelists raised the prices paid by their direct purchasers above the competitive level."
        : "The share of the overcharge passed on by direct purchasers (upstream pass-on).";
    path
      .style("pointer-events", "visibleFill")
      .on("pointerenter", (evt) => tooltip.show(flowTooltipText, evt))
      .on("pointermove", (evt) => tooltip.move(evt))
      .on("pointerleave", () => tooltip.hide());
    return { path, ch };
  });

  // Umbrella flow layers (Firm D → purchasers, purchasers → consumers)
  const umbrellaPaths = [0, 1].map((ci) => {
    const g = svg.append("g");
    const path = g
      .append("path")
      .attr("class", `chain-flow umbrella-path-${ci}`)
      .attr("fill", "color-mix(in srgb, var(--clr-umbrella) 18%, transparent)")
      .attr("stroke", "var(--clr-umbrella)")
      .attr("stroke-width", 1)
      .attr("opacity", 0);
    const umbrellaTooltipText =
      ci === 0
        ? "The umbrella overcharge flowing into prices paid by direct purchasers."
        : "The share of the umbrella overcharge passed on to class members by direct purchasers.";
    path
      .style("pointer-events", "visibleFill")
      .on("pointerenter", (evt) => tooltip.show(umbrellaTooltipText, evt))
      .on("pointermove", (evt) => tooltip.move(evt))
      .on("pointerleave", () => tooltip.hide());
    return { path, ch: CHAN[ci] };
  });

  // Downstream flow layers (consumers → further downstream): main + umbrella
  const dsMainPath = svg
    .append("path")
    .attr("class", "chain-flow ds-main-path")
    .attr("fill", "color-mix(in srgb, var(--clr-gold) 15%, transparent)")
    .attr("stroke", "color-mix(in srgb, var(--clr-gold) 50%, transparent)")
    .attr("stroke-width", 1)
    .attr("opacity", 0)
    .style("pointer-events", "visibleFill")
    .on("pointerenter", (evt) =>
      tooltip.show(
        "The share of the overcharge passed on further downstream by class members, mitigating their own loss (the pass-on defence).",
        evt,
      ),
    )
    .on("pointermove", (evt) => tooltip.move(evt))
    .on("pointerleave", () => tooltip.hide());
  const dsUmbrellaPath = svg
    .append("path")
    .attr("class", "chain-flow ds-umbrella-path")
    .attr("fill", "color-mix(in srgb, var(--clr-umbrella) 18%, transparent)")
    .attr("stroke", "var(--clr-umbrella)")
    .attr("stroke-width", 1)
    .attr("opacity", 0)
    .style("pointer-events", "visibleFill")
    .on("pointerenter", (evt) =>
      tooltip.show(
        "The share of the umbrella overcharge passed on further downstream by class members.",
        evt,
      ),
    )
    .on("pointermove", (evt) => tooltip.move(evt))
    .on("pointerleave", () => tooltip.hide());

  // ── Gutter labels (left = main flows, right = umbrella-flow mirror) ────
  // Dynamic labels run longer than the static tier labels ("Downstream
  // pass-on = 100%", "Umbrella effect = £75.0/t"), so they use a slightly
  // smaller font to comfortably fit the gutter width. They're rendered in a
  // lighter, translucent tint of their flow's colour (derived via
  // color-mix(), not a new colour) and italicised, so they read as
  // secondary annotations and don't visually compete with the bold tier
  // labels ("Apple growers" etc).
  function addGutterLabel(x, y, anchor, colorVar) {
    return svg
      .append("text")
      .attr("class", "chain-side-label chain-flow-label")
      .attr("x", x)
      .attr("y", y)
      .attr("text-anchor", anchor)
      .attr("font-size", "9px")
      .attr("fill", `color-mix(in srgb, ${colorVar} 62%, transparent)`);
  }

  // Small arrow connecting a gutter label to the flow it describes. The
  // line stops exactly where the arrowhead's base begins, so the two
  // pieces abut cleanly instead of overlapping.
  function addFlowArrow(xStart, xEnd, y, colorVar) {
    const color = `color-mix(in srgb, ${colorVar} 62%, transparent)`;
    const dir = xEnd > xStart ? 1 : -1;
    const ah = 3.5;
    const lineEnd = xEnd - dir * ah * 1.8;
    const g = svg.append("g");
    g.append("line")
      .attr("x1", xStart)
      .attr("y1", y)
      .attr("x2", lineEnd)
      .attr("y2", y)
      .attr("stroke", color)
      .attr("stroke-width", 1.4);
    g.append("polygon")
      .attr("points", `${xEnd},${y} ${lineEnd},${y - ah} ${lineEnd},${y + ah}`)
      .attr("fill", color);
    return g;
  }

  const chan0MidY = (CHAN[0].y0 + CHAN[0].y1) / 2;
  const chan1MidY = (CHAN[1].y0 + CHAN[1].y1) / 2;
  const dsMidY = (DS_Y0 + DS_Y1) / 2;

  // Left gutter: static tier labels (Apple growers / Direct purchasers / Class members),
  // underlined and coloured to match the boxes at that level of the chain
  TIERS.forEach((tier) => {
    if (!tier.sideLabel) return;
    const midY = tier.y + tier.h / 2;
    const lines = wrapLabel(tier.sideLabel, LEFT_GUTTER_W - GUTTER_X, 12);
    const top = midY - (lines.length - 1) * 8;
    lines.forEach((line, li) => {
      svg
        .append("text")
        .attr("class", "chain-side-label chain-tier-label")
        .attr("x", GUTTER_X)
        .attr("y", top + li * 15 + 4)
        .attr("text-anchor", "start")
        .attr("fill", tier.accent)
        .text(line);
    });
  });

  // Straight vertical connectors from one tier label down to the next,
  // with a crisp arrowhead — traces the top-to-bottom story of the gutter
  // labels without hand-drawn curves
  function addTierConnector(y0, y1) {
    const x = GUTTER_X + 3; // roughly centred on the first letter
    const startY = y0 + 18,
      endY = y1 - 20;
    svg
      .append("line")
      .attr("x1", x)
      .attr("y1", startY)
      .attr("x2", x)
      .attr("y2", endY)
      .attr("stroke", "var(--clr-text-dim)")
      .attr("stroke-width", 1.3)
      .attr("opacity", 0.85)
      .attr("marker-end", "url(#tier-connector-arrow)");
  }

  const growersLabelY = TIERS[0].y + TIERS[0].h / 2 + 4;
  const purchasersLabelY = TIERS[1].y + TIERS[1].h / 2 + 4;
  const consumersLabelY = TIERS[2].y + TIERS[2].h / 2 + 4;
  addTierConnector(growersLabelY, purchasersLabelY);
  addTierConnector(purchasersLabelY, consumersLabelY);

  // Left gutter: only the overcharge label + arrow — upstream/downstream
  // pass-on text already lives in the right gutter's umbrella mirror, so
  // it isn't duplicated here. Anchored to the arrow (not the far edge) so
  // the text-to-arrow gap matches the right gutter's spacing.
  const overchargeLabel = addGutterLabel(
    LEFT_GUTTER_W - 36,
    chan0MidY + 4,
    "end",
    "var(--clr-navy)",
  );
  addFlowArrow(
    LEFT_GUTTER_W - 30,
    LEFT_GUTTER_W - 6,
    chan0MidY,
    "var(--clr-navy)",
  );

  // Right gutter: umbrella-flow mirror — left-justified to match the left
  // gutter's alignment, with arrows pointing back into the diagram
  const umbrellaLabel = addGutterLabel(
    RIGHT_TEXT_X,
    chan0MidY + 4,
    "start",
    "var(--clr-umbrella)",
  );
  const umbrellaUpstreamLabel = addGutterLabel(
    RIGHT_TEXT_X,
    chan1MidY + 4,
    "start",
    "var(--clr-primary)",
  );
  const umbrellaDownstreamLabel = addGutterLabel(
    RIGHT_TEXT_X,
    dsMidY + 4,
    "start",
    "var(--clr-secondary)",
  );
  addFlowArrow(BOX_RIGHT + 30, BOX_RIGHT + 6, chan0MidY, "var(--clr-umbrella)");
  addFlowArrow(BOX_RIGHT + 30, BOX_RIGHT + 6, chan1MidY, "var(--clr-primary)");
  addFlowArrow(BOX_RIGHT + 30, BOX_RIGHT + 6, dsMidY, "var(--clr-secondary)");

  // Tier boxes
  const tierGroups = TIERS.map((tier) => {
    const boxes = boxPositions(tier);
    const boxGroups = boxes.map((box) => {
      const g = svg.append("g").attr("class", "chain-box-group");
      const isCartel = !!box.cartel;

      // Opaque card fills (accent mixed into the surface colour, not
      // transparency) so each stage reads as a clean modern card sitting
      // on the page, in both themes
      let border, fill, textColor;
      if (tier.id === "growers") {
        if (isCartel) {
          border = "var(--clr-navy)";
          fill = "color-mix(in srgb, var(--clr-navy) 8%, var(--clr-surface))";
          textColor = "var(--clr-navy)";
        } else {
          // Firm D sits outside the cartel — a dashed border and a muted,
          // desaturated fill so it reads as "outside" on its own, without
          // relying solely on the cartel ring to carry that distinction.
          border = "var(--clr-text-dim)";
          fill =
            "color-mix(in srgb, var(--clr-text-dim) 10%, var(--clr-surface))";
          textColor = "var(--clr-text-dim)";
        }
      } else {
        border = tier.accent;
        fill = `color-mix(in srgb, ${tier.accent} 8%, var(--clr-surface))`;
        textColor = tier.accent;
      }

      g.append("rect")
        .attr("x", box.x)
        .attr("y", tier.y)
        .attr("width", box.w)
        .attr("height", tier.h)
        .attr("rx", 10)
        .attr("fill", fill)
        .attr("stroke", border)
        .attr("stroke-width", 1.5)
        .attr(
          "stroke-dasharray",
          tier.id === "growers" && !isCartel ? "5,3" : null,
        );

      // Single label, vertically + horizontally centred — same template for every box
      const fontPx = box.w < 130 ? 13 : 16;
      const lines = wrapLabel(box.label, box.w, fontPx);
      const midY = tier.y + tier.h / 2;
      const lineH = fontPx + 1;
      const cls = box.w < 130 ? "chain-label-main--sm" : "chain-label-main";
      lines.forEach((line, li) => {
        const dy = (li - (lines.length - 1) / 2) * lineH;
        g.append("text")
          .attr("class", cls)
          .attr("x", box.x + box.w / 2)
          .attr("y", midY + dy + 4)
          .attr("text-anchor", "middle")
          .attr("fill", textColor)
          .text(line);
      });

      let boxTooltipText;
      if (tier.id === "growers") {
        boxTooltipText = isCartel
          ? "Cartel member — coordinates with the other cartelists to fix prices above the competitive level."
          : "Outside of the cartel, but may still raise its own price in response to the cartel (the umbrella effect).";
      } else if (tier.id === "purchasers") {
        boxTooltipText =
          "Buys directly from the cartel, and may pass some/all of the overcharge on downstream.";
      } else {
        boxTooltipText =
          "Suffers a loss due to the share of the overcharge passed on to them. Can mitigate their loss by passing on the overcharge further downstream.";
      }
      g.on("pointerenter", (evt) => tooltip.show(boxTooltipText, evt))
        .on("pointermove", (evt) => tooltip.move(evt))
        .on("pointerleave", () => tooltip.hide());

      return { g, box, isCartel };
    });
    return { tier, boxGroups };
  });

  // Bounding box of the 3 cartelist boxes (used for the ring and the main
  // overcharge channel's centre-x, so it lines up under the cartel only).
  // The ring pads generously in x (wider oval) but only lightly in y, so
  // widening it never changes its vertical extent.
  let cartelCX = CX;
  const cartelBoxes = tierGroups[0].boxGroups
    .filter((bg) => bg.isCartel)
    .map((bg) => bg.box);
  if (cartelBoxes.length) {
    const x0 = cartelBoxes[0].x;
    const x1 =
      cartelBoxes[cartelBoxes.length - 1].x +
      cartelBoxes[cartelBoxes.length - 1].w;
    cartelCX = (x0 + x1) / 2;

    const padX = 20,
      padY = 12;
    const tier = TIERS[0];
    const ringX0 = x0 - padX,
      ringX1 = x1 + padX;
    const ringY0 = tier.y - padY,
      ringY1 = tier.y + tier.h + padY;

    cartelRing
      .append("rect")
      .attr("class", "chain-cartel-ring")
      .attr("x", ringX0)
      .attr("y", ringY0)
      .attr("width", ringX1 - ringX0)
      .attr("height", ringY1 - ringY0)
      .attr("rx", (ringY1 - ringY0) / 2);

    cartelRing
      .append("text")
      .attr("class", "chain-cartel-ring-label")
      .attr("x", (ringX0 + ringX1) / 2)
      .attr("y", ringY0 - 5)
      .attr("text-anchor", "middle")
      .text("Cartelists");
  }
  // Upstream pass-on and the overcharge flow above it share one centre-x,
  // so the two flows read as a single aligned column
  const CHAN_CX = [cartelCX, cartelCX];

  // ── "Who is most impacted by the overcharge?" stacked bar ─────────────
  const harmChartWrap = document.createElement("div");
  harmChartWrap.className = "harm-chart-wrap";
  harmSection.appendChild(harmChartWrap);

  const harmTitle = document.createElement("h3");
  harmTitle.className = "panel-heading";
  harmTitle.textContent = "Who bears the impact of the overcharge?";
  harmChartWrap.appendChild(harmTitle);

  const harmSVGWrap = document.createElement("div");
  harmSVGWrap.style.flex = "1";
  harmSVGWrap.style.minHeight = "90px";
  harmChartWrap.appendChild(harmSVGWrap);

  const harmSvg = d3()
    .select(harmSVGWrap)
    .append("svg")
    .attr("width", "100%")
    .attr("height", 100);

  const HARM_SEGS = [
    { key: "direct", label: "Direct purchasers", color: "var(--clr-primary)" },
    { key: "consumers", label: "Class members", color: "var(--clr-secondary)" },
    {
      key: "downstream",
      label: "Further downstream",
      color: "var(--clr-gold)",
    },
  ];

  const harmLegend = document.createElement("div");
  harmLegend.className = "harm-legend";
  HARM_SEGS.forEach((seg) => {
    const item = document.createElement("div");
    item.className = "harm-legend-item";
    const dot = document.createElement("span");
    dot.className = "harm-legend-dot";
    dot.style.background = seg.color;
    item.appendChild(dot);
    item.appendChild(document.createTextNode(seg.label));
    harmLegend.appendChild(item);
  });
  harmChartWrap.appendChild(harmLegend);

  function renderHarmBar(overcharge) {
    const width = harmSVGWrap.clientWidth || 280;
    const height = harmSVGWrap.clientHeight || 100;
    const barH = 54;
    const innerW = Math.max(60, width - 24);
    const top = Math.max(0, (height - barH) / 2);
    const left = (width - innerW) / 2;

    harmSvg.attr("width", width).attr("height", height);

    const directPct = Math.max(0, 1 - rhoUp);
    const consumersPct = rhoUp * (1 - rhoDown);
    const downstreamPct = rhoUp * rhoDown;
    const pcts = {
      direct: directPct,
      consumers: consumersPct,
      downstream: downstreamPct,
    };

    const x = d3().scaleLinear().domain([0, 1]).range([0, innerW]);

    let g = harmSvg.select("g.harm-g");
    if (g.empty()) {
      g = harmSvg.append("g").attr("class", "harm-g");
      HARM_SEGS.forEach((seg, i) => {
        g.append("rect")
          .attr("class", `seg-${i}`)
          .attr("rx", 4)
          .attr("fill", seg.color);
        g.append("text")
          .attr("class", `harm-seg-pct-label pct-${i}`)
          .attr(
            "fill",
            seg.key === "downstream" ? "var(--clr-gold-text)" : "white",
          );
      });
    }
    g.attr("transform", `translate(${left},${top})`);

    const t = harmSvg.transition().duration(400).ease(d3().easeQuadInOut);
    let cursor = 0;
    HARM_SEGS.forEach((seg, i) => {
      const pct = pcts[seg.key];
      const w = x(pct);
      g.select(`.seg-${i}`)
        .transition(t)
        .attr("x", cursor)
        .attr("y", 0)
        .attr("height", barH)
        .attr("width", w);
      g.select(`.pct-${i}`)
        .transition(t)
        .attr("x", cursor + w / 2)
        .attr("y", barH / 2 + 5)
        .attr("opacity", pct > 0.04 ? 1 : 0)
        .text(`${Math.round(pct * 100)}%`);
      cursor += w;
    });
  }

  // ── Particle engine (ambient flow along all active channels) ──────────
  // Respect the OS-level "reduce motion" preference — this is CSS-driven
  // animation's JS counterpart (the app's @media (prefers-reduced-motion)
  // block only covers CSS transitions/keyframes, not this setInterval loop).
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  let animActive = true;
  let tabVisible = true; // paused while another tab is active
  let particleIntervals = [];

  function spawnParticle(flow, intensity) {
    // document.hidden: in a minimized/background window the removal
    // transitions are frame-throttled while setInterval keeps firing —
    // without this guard particles accumulate without bound. The count cap
    // is a second safety net for the same failure mode.
    if (intensity <= 0 || !animActive || !tabVisible || document.hidden) return;
    if (particleLayer.node().childElementCount > 200) return;
    const nParticles = Math.max(1, Math.round(intensity * 4));
    for (let i = 0; i < nParticles; i++) {
      setTimeout(
        () => {
          if (!animActive || !tabVisible || document.hidden) return;
          const xOff = (Math.random() - 0.5) * 2 * flow.halfW * 0.8;
          const startX = flow.cx + xOff;
          const endX = flow.cx + xOff * 0.9;
          const startY = flow.y0 + 3;
          const endY = flow.y1 - 3;
          const dur = 800 + Math.random() * 400;

          const circle = particleLayer
            .append("circle")
            .attr("cx", startX)
            .attr("cy", startY)
            .attr("r", 3.2)
            .attr("fill", flow.color)
            .attr("opacity", 0.85);

          circle
            .transition()
            .duration(dur)
            .ease(d3().easeLinear)
            .attr("cy", endY)
            .attr("cx", endX)
            .attr("opacity", 0)
            .on("end", function () {
              d3().select(this).remove();
            });
        },
        i * 120 + Math.random() * 80,
      );
    }
  }

  // Current set of animatable flows, recomputed from live slider state
  function activeFlows() {
    const fenwickBox = tierGroups[0].boxGroups.find((bg) => !bg.isCartel)?.box;
    const flows = [
      {
        cx: CHAN_CX[0],
        y0: CHAN[0].y0,
        y1: CHAN[0].y1,
        halfW: MAX_CHAN_W / 2,
        rate: 1,
        color: "var(--clr-navy)",
      },
      {
        cx: CHAN_CX[1],
        y0: CHAN[1].y0,
        y1: CHAN[1].y1,
        halfW: (MAX_CHAN_W * rhoUp) / 2,
        rate: rhoUp,
        color: "var(--clr-primary)",
      },
    ];
    if (fenwickBox) {
      const fenwickCX = fenwickBox.x + fenwickBox.w / 2;
      flows.push({
        cx: fenwickCX,
        y0: CHAN[0].y0,
        y1: CHAN[0].y1,
        halfW: (UMBRELLA_MAX_W * umbrellaPct) / 2,
        rate: umbrellaPct,
        color: "var(--clr-umbrella)",
      });
      const umbrella1CX = cartelCX + MAX_CHAN_W / 2 + 34;
      const umb1Rate = umbrellaPct * rhoUp;
      flows.push({
        cx: umbrella1CX,
        y0: CHAN[1].y0,
        y1: CHAN[1].y1,
        halfW: (UMBRELLA_MAX_W * umb1Rate) / 2,
        rate: umb1Rate,
        color: "var(--clr-umbrella)",
      });
    }
    const dsMainCX = cartelCX,
      dsUmbCX = cartelCX + MAX_CHAN_W / 2 + 34;
    const dsMainRate = rhoDown * rhoUp;
    const dsUmbRate = rhoDown * umbrellaPct * rhoUp;
    flows.push({
      cx: dsMainCX,
      y0: DS_Y0,
      y1: DS_Y1,
      halfW: (DS_MAX_W * dsMainRate) / 2,
      rate: dsMainRate,
      color: "var(--clr-secondary)",
    });
    flows.push({
      cx: dsUmbCX,
      y0: DS_Y0,
      y1: DS_Y1,
      halfW: (DS_MAX_W * dsUmbRate) / 2,
      rate: dsUmbRate,
      color: "var(--clr-umbrella)",
    });
    return flows;
  }

  function startParticles() {
    particleIntervals.forEach((id) => clearInterval(id));
    particleIntervals = [];
    if (!tabVisible || prefersReducedMotion) return;

    activeFlows().forEach((flow, fi) => {
      if (flow.rate > 0.005 && flow.halfW > 1) {
        particleIntervals.push(
          setInterval(() => spawnParticle(flow, flow.rate), 600 + fi * 90),
        );
      }
    });
  }

  // ── Update function ────────────────────────────────────────────────────
  function update() {
    const overcharge = state.params?.overcharge ?? 75;

    const umbrellaToFirm = overcharge * umbrellaPct;

    // Main channel trapezoids
    chanPaths.forEach(({ path, ch }, ci) => {
      const cx = CHAN_CX[ci];
      const rate = ci === 0 ? 1 : rhoUp;
      const halfW = ci === 0 ? MAX_CHAN_W / 2 : (MAX_CHAN_W * rate) / 2;
      const y0 = ch.y0,
        y1 = ch.y1;
      const visible = ci === 0 || rate > 0.005;

      path
        .transition()
        .duration(400)
        .ease(d3().easeQuadInOut)
        .attr("d", trapezoidPath(cx, halfW, y0, y1))
        .attr("opacity", visible ? 1 : 0);
    });

    overchargeLabel
      .attr("opacity", 1)
      .text(`Overcharge = £${overcharge.toFixed(1)}/t`);

    // Umbrella flow layers
    const fenwickBox = tierGroups[0].boxGroups.find((bg) => !bg.isCartel)?.box;
    if (fenwickBox) {
      const fenwickCX = fenwickBox.x + fenwickBox.w / 2;
      const halfW0 = (UMBRELLA_MAX_W / 2) * umbrellaPct;
      umbrellaPaths[0].path
        .transition()
        .duration(400)
        .ease(d3().easeQuadInOut)
        .attr(
          "d",
          trapezoidPath(
            fenwickCX,
            Math.max(0.01, halfW0),
            CHAN[0].y0,
            CHAN[0].y1,
          ),
        )
        .attr("opacity", umbrellaPct > 0.005 ? 1 : 0);

      const umbrella2CX = cartelCX + MAX_CHAN_W / 2 + 34;
      const halfW1 = (UMBRELLA_MAX_W / 2) * umbrellaPct * rhoUp;
      umbrellaPaths[1].path
        .transition()
        .duration(400)
        .ease(d3().easeQuadInOut)
        .attr(
          "d",
          trapezoidPath(
            umbrella2CX,
            Math.max(0.01, halfW1),
            CHAN[1].y0,
            CHAN[1].y1,
          ),
        )
        .attr("opacity", umbrellaPct > 0.005 && rhoUp > 0.005 ? 1 : 0);
    }

    umbrellaLabel
      .attr("opacity", 1)
      .text(`Umbrella effect = £${umbrellaToFirm.toFixed(1)}/t`);
    umbrellaUpstreamLabel
      .attr("opacity", 1)
      .text(`Upstream pass-on = ${(rhoUp * 100).toFixed(0)}%`);
    umbrellaDownstreamLabel
      .attr("opacity", 1)
      .text(`Downstream pass-on = ${(rhoDown * 100).toFixed(0)}%`);

    // Downstream flow layers (main + umbrella), fading toward a point
    const dsMainCX = cartelCX,
      dsUmbCX = cartelCX + MAX_CHAN_W / 2 + 34;
    const dsMainRate = rhoDown * rhoUp;
    const dsUmbRate = rhoDown * umbrellaPct * rhoUp;
    const dsMainHalfW = (DS_MAX_W / 2) * dsMainRate;
    const dsUmbHalfW = (DS_MAX_W / 2) * dsUmbRate;

    dsMainPath
      .transition()
      .duration(400)
      .ease(d3().easeQuadInOut)
      .attr(
        "d",
        trapezoidPath(
          dsMainCX,
          Math.max(0.01, dsMainHalfW),
          DS_Y0,
          DS_Y1,
          0.12,
        ),
      )
      .attr("opacity", dsMainRate > 0.005 ? 1 : 0);

    dsUmbrellaPath
      .transition()
      .duration(400)
      .ease(d3().easeQuadInOut)
      .attr(
        "d",
        trapezoidPath(dsUmbCX, Math.max(0.01, dsUmbHalfW), DS_Y0, DS_Y1, 0.12),
      )
      .attr("opacity", dsUmbRate > 0.005 ? 1 : 0);

    startParticles();
    renderHarmBar(overcharge);
  }

  // ── Subscribe to state changes ────────────────────────────────────────────
  state.subscribe(() => update());

  // Re-render the harm bar when its container resizes (window resize)
  const harmResizeObserver = new ResizeObserver(() => {
    renderHarmBar(state.params?.overcharge ?? 75);
  });
  harmResizeObserver.observe(harmSVGWrap);

  // Kick off
  setTimeout(update, 100);

  return {
    onHide: () => {
      tabVisible = false;
      particleIntervals.forEach((id) => clearInterval(id));
      particleIntervals = [];
    },
    onShow: () => {
      tabVisible = true;
      renderHarmBar(state.params?.overcharge ?? 75);
      startParticles();
    },
    resample: () => {},
  };
}
