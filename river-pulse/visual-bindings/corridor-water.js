export const CORRIDOR_DISPLAY_MODES = Object.freeze({
  FLOW_WIDTH: "flow-width",
  SEASONAL_COLOR: "seasonal-color",
});

export const CORRIDOR_CONDITION_COLORS = Object.freeze({
  "not-flowing": "#6f7f82",
  "all-time-low": "#a85c3b",
  "much-below-normal": "#c9823e",
  "below-normal": "#c9aa62",
  normal: "#3f9585",
  "above-normal": "#4b8faf",
  "much-above-normal": "#356f9d",
  "all-time-high": "#695f9f",
  "not-ranked": "#4e8791",
  unavailable: "#69787b",
  checking: "#4e8791",
});

const DEFAULTS = Object.freeze({
  minimumWidth: 12,
  maximumWidth: 42,
  conditionWidth: 24,
  fallbackWidth: 20,
  widthModeColor: "#2d99a4",
});

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function selectedDischarge(state) {
  return (
    state?.selected_quantities?.find(
      (quantity) => quantity.phenomenon === "discharge" && quantity.availability === "present",
    ) ?? null
  );
}

function normalizedRelativeFlow(value, thresholds) {
  if (!Number.isFinite(value) || value < 0) return null;
  if (value === 0) return 0;

  const p10 = Number(thresholds?.p10),
    p90 = Number(thresholds?.p90);
  if (!(p10 > 0) || !(p90 > p10)) return null;

  const low = Math.log(p10),
    high = Math.log(p90),
    sample = Math.log(Math.max(value, p10 * 0.25));
  return clamp((sample - low) / (high - low));
}

function widthFromRelative(relative, options) {
  if (!Number.isFinite(relative)) return options.fallbackWidth;
  return options.minimumWidth + (options.maximumWidth - options.minimumWidth) * clamp(relative);
}

function conditionColor(condition) {
  return CORRIDOR_CONDITION_COLORS[condition?.kind] ?? CORRIDOR_CONDITION_COLORS["not-ranked"];
}

export function corridorWaterBinding(
  state,
  condition,
  mode = CORRIDOR_DISPLAY_MODES.FLOW_WIDTH,
  options = {},
) {
  if (!Object.values(CORRIDOR_DISPLAY_MODES).includes(mode))
    throw new Error(`Unsupported corridor display mode: ${mode}`);

  const config = { ...DEFAULTS, ...options },
    discharge = selectedDischarge(state),
    value = Number(discharge?.value),
    relativeFlow = normalizedRelativeFlow(value, condition?.thresholds),
    width =
      mode === CORRIDOR_DISPLAY_MODES.FLOW_WIDTH
        ? widthFromRelative(relativeFlow, config)
        : config.conditionWidth,
    color =
      mode === CORRIDOR_DISPLAY_MODES.SEASONAL_COLOR
        ? conditionColor(condition)
        : config.widthModeColor,
    motionRate = Number.isFinite(relativeFlow) ? 0.22 + relativeFlow * 0.78 : discharge ? 0.42 : 0.12;

  return Object.freeze({
    id: "russian-river-corridor-water",
    mode,
    representation: "illustrative",
    width_m: width,
    color,
    motion_rate: motionRate,
    relative_flow: relativeFlow,
    source_quantity_id: discharge?.quantity_id ?? null,
    condition_kind: condition?.kind ?? null,
    note:
      mode === CORRIDOR_DISPLAY_MODES.FLOW_WIDTH
        ? "Corridor width communicates relative selected discharge; it is not measured bank width or inundation extent."
        : "Corridor color communicates the selected USGS seasonal-condition class; corridor width remains illustrative.",
  });
}
