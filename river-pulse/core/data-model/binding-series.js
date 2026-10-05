// Keep different gauge products and methods separate even when units are identical.
export function matchingSeries(quantities, binding) {
  return quantities.filter(q => q.feature_id === binding.feature_id
    && q.phenomenon === binding.phenomenon
    && q.unit === binding.unit
    && q.evidence_type === binding.evidence_type
    && q.method.parameter_code === binding.parameter_code
    && q.method.statistic_id === binding.statistic_id
    && q.method.time_series_id === binding.time_series_id);
}
