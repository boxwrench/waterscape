import { riverState } from "./river-state.js";
import { coveringIntervalPolicy, latestAtOrBeforePolicy } from "./selection.js";

export const GAUGE_TIME_MODES = Object.freeze({
  CURRENT_CONTINUOUS: "current-continuous",
  HISTORICAL_DAILY: "historical-daily",
});

export function resolveGaugeDischargeState({
  featureId,
  validTime,
  asOfTime = null,
  mode,
  continuousQuantities = [],
  dailyQuantities = [],
  maximumCurrentAgeMs = 45 * 60 * 1000,
}) {
  if (!featureId) throw new Error("featureId is required");

  let policy, quantities;
  if (mode === GAUGE_TIME_MODES.CURRENT_CONTINUOUS) {
    policy = latestAtOrBeforePolicy({ maximumAgeMs: maximumCurrentAgeMs });
    quantities = continuousQuantities;
  } else if (mode === GAUGE_TIME_MODES.HISTORICAL_DAILY) {
    policy = coveringIntervalPolicy();
    quantities = dailyQuantities;
  } else {
    throw new Error(`Unknown gauge time mode: ${mode}`);
  }

  const result = policy.select(quantities, validTime);
  return riverState({
    validTime,
    asOfTime,
    features: { gauges: [{ id: featureId }] },
    selections: [
      {
        feature_id: featureId,
        phenomenon: "discharge",
        policy_id: policy.id,
        result,
      },
    ],
  });
}
