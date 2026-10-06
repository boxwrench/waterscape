import { latestAtOrBefore } from "../../../../../core/data-model/selection.js";
import { matchingSeries } from "../../../../../core/data-model/binding-series.js";
import { riverState } from "../../../../../core/data-model/river-state.js";
import { observedFlowStatus } from "../../../../../core/visual-bindings/flow-status.js";

export function freeportDischarge(quantities, binding, validTime) {
  const selection = latestAtOrBefore(matchingSeries(quantities, binding), validTime,
    { maximumAgeMs: binding.maximum_age_minutes * 60000 }),
    state = riverState({ validTime, features: { gauges: [{ id: binding.feature_id }] },
      selections: [{ feature_id: binding.feature_id, phenomenon: "discharge",
        policy_id: "freeport_latest_at_or_before_45_minutes", result: selection }] });
  return { state, selection, presentation: observedFlowStatus(state, binding.feature_id) };
}
