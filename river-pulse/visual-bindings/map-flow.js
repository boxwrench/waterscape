// Selected quantities have already passed the gauge/time eligibility policy.
// Positive discharge supports an illustrative flowing-water cue, not a speed estimate.
export function mapFlowIsMoving(state) {
  const q = state?.selected_quantities?.find((q) =>
    q.phenomenon === "discharge" && q.availability === "present");
  return Boolean(q && Number.isFinite(q.value) && q.value > 0);
}
