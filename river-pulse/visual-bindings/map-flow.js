// Selected quantities have already passed the gauge/time eligibility policy.
// Positive discharge supports an illustrative flowing-water cue, not a speed estimate.
function selectedDischarge(state) {
  return state?.selected_quantities?.find((q) => q.phenomenon === "discharge" &&
    q.availability === "present" && Number.isFinite(q.value) && q.value >= 0) ?? null;
}

export function mapFlowIsMoving(state) {
  const q = selectedDischarge(state);
  return Boolean(q && q.value > 0);
}

export const MAP_RIBBON_WIDTH = Object.freeze({ minimum: 18, maximum: 66, fallback: 34 });

export function mapRibbonBinding(state, history) {
  const q = selectedDischarge(state), values = history?.kind === "series"
    ? history.points.map((p) => p.value).filter((v) => Number.isFinite(v) && v >= 0) : [],
    low = values.length ? Math.min(...values) : null,
    high = values.length ? Math.max(...values) : null;
  let relative = null, domain = "no-history";
  if (q && values.length) {
    // Square-root compression preserves ordering while keeping low-flow changes
    // legible when the history window contains a large peak. This is display scale.
    if (high > low) {
      relative = (Math.sqrt(q.value) - Math.sqrt(low)) / (Math.sqrt(high) - Math.sqrt(low));
      domain = "history-range";
    } else if (high > 0) {
      relative = q.value / (2 * high);
      domain = "constant-history";
    } else {
      relative = q.value === 0 ? 0 : 1;
      domain = "zero-history";
    }
    relative = Math.max(0, Math.min(1, relative));
  }
  const width = !q ? MAP_RIBBON_WIDTH.fallback : q.value === 0 ? MAP_RIBBON_WIDTH.minimum :
    relative === null ? MAP_RIBBON_WIDTH.fallback : MAP_RIBBON_WIDTH.minimum +
      relative * (MAP_RIBBON_WIDTH.maximum - MAP_RIBBON_WIDTH.minimum);
  return Object.freeze({
    representation: "illustrative", moving: Boolean(q && q.value > 0),
    availability: q ? "present" : "missing", source_quantity_id: q?.quantity_id ?? null,
    width, relative, domain, history_min: low, history_max: high,
    note: "Width compares selected gauge discharge within loaded history; exaggerated scale, not measured channel width, stage or inundation. Ripple speed is fixed display motion.",
  });
}
