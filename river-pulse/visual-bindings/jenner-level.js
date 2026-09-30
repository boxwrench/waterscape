import { latestAtOrBeforePolicy } from "../data-model/selection.js";
import { riverState } from "../data-model/river-state.js";

export const JENNER_GAUGE = "USGS-11467270";

export function jennerLevelState(quantities, validTime, maximumAgeMs = 45 * 60 * 1000) {
  const policy = latestAtOrBeforePolicy({ maximumAgeMs }),
    eligible = quantities.filter(q => q.feature_id === JENNER_GAUGE &&
      q.phenomenon === "water_surface_elevation" && q.unit === "ft" &&
      q.evidence_type === "observation" && q.spatial?.vertical_datum === "NAVD88"),
    result = policy.select(eligible, validTime);
  return riverState({ validTime, features: { gauges: [{ id: JENNER_GAUGE }],
    authored_places: [{ id: "jenner" }] }, selections: [{ feature_id: JENNER_GAUGE,
    phenomenon: "water_surface_elevation", policy_id: policy.id, result }] });
}

export function jennerLevelPresentation(state) {
  const q = state.selected_quantities[0], selection = state.selection_results[0],
    stale = state.missing_quantities[0]?.stale_quantity;
  return { value: q ? `${q.value.toFixed(2)} ft` : "Unavailable",
    quality: q ? q.source_approval : selection.reason === "stale" ? "Stale" : "Unavailable",
    time: q?.time.valid_start ?? stale?.time.valid_start ?? null,
    datum: "NAVD88", source: "https://waterdata.usgs.gov/monitoring-location/USGS-11467270/",
    // No renderer level/current is returned: this gauge is upstream of the pictured mouth.
    note: "At Highway 1 Bridge; the coastal scene is an authored setting, not today's tide or mouth status." };
}
