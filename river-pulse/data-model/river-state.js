// Spatial RiverState assembled after deterministic source selection.
// It carries selected/missing scientific quantities; renderers consume it through visual bindings.

export function riverState({ validTime, asOfTime = null, features = {}, selections = [] }) {
  if (!validTime || !Number.isFinite(Date.parse(validTime))) throw new Error(`Invalid RiverState validTime: ${validTime}`);
  if (asOfTime && !Number.isFinite(Date.parse(asOfTime))) throw new Error(`Invalid RiverState asOfTime: ${asOfTime}`);

  const normalizedFeatures = {
    reaches: [...(features.reaches ?? [])],
    gauges: [...(features.gauges ?? [])],
    tributaries: [...(features.tributaries ?? [])],
    weather_fields: [...(features.weather_fields ?? [])],
    model_fields: [...(features.model_fields ?? [])],
    authored_places: [...(features.authored_places ?? [])],
  };

  const selected_quantities = [],
    missing_quantities = [],
    selection_results = [];
  for (const entry of selections) {
    const record = {
      feature_id: entry.feature_id,
      phenomenon: entry.phenomenon,
      policy_id: entry.policy_id,
      status: entry.result?.status ?? "missing",
      reason: entry.result?.reason ?? "unknown",
      age_ms: entry.result?.age_ms ?? null,
    };
    if (entry.result?.quantity) selected_quantities.push(entry.result.quantity);
    else
      missing_quantities.push({
        feature_id: entry.feature_id,
        phenomenon: entry.phenomenon,
        reason: record.reason,
        stale_quantity: entry.result?.stale_quantity ?? null,
      });
    selection_results.push(record);
  }

  return Object.freeze({
    request: Object.freeze({ valid_time: validTime, as_of_time: asOfTime }),
    features: Object.freeze(normalizedFeatures),
    selected_quantities: Object.freeze(selected_quantities),
    missing_quantities: Object.freeze(missing_quantities),
    selection_results: Object.freeze(selection_results),
  });
}
