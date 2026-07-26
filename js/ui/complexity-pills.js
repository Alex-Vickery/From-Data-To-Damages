// "Add complexity" pill group, mounted on The Data tab.
// Flags live in shared state, so every tab's chart reacts when they change.

import { state } from "../data/state.js";
import { createToggleSwitch, createSectionHeading } from "./components.js";

export const COMPLEXITY_FEATURES = [
  { key: "trendEnabled", label: "Time Trend" },
  { key: "rampUpEnabled", label: "Ramp-up", warn: true },
  { key: "runOffEnabled", label: "Run-off", warn: true },
  { key: "macroShockEnabled", label: "Macro Shock" },
  { key: "confoundEnabled", label: "Confounder" },
  { key: "seasonalityEnabled", label: "Seasonality" },
  { key: "noiseEnabled", label: "Noise" },
];

export function createComplexityPills(container, config = {}) {
  const { heading = "Add Complexity" } = config;

  if (heading) createSectionHeading(container, heading);

  const group = document.createElement("div");
  group.className = "toggle-list";
  container.appendChild(group);

  const pills = COMPLEXITY_FEATURES.map((f) => {
    const pill = createToggleSwitch(group, {
      label: f.label,
      value: !!state.params[f.key],
      warnStyle: !!f.warn,
    });
    pill.onChange((v) => state.update({ [f.key]: v }));
    return { key: f.key, pill };
  });

  state.subscribe((data, params) => {
    pills.forEach(({ key, pill }) => pill.setValue(!!params[key]));
  });

  return { el: group };
}
