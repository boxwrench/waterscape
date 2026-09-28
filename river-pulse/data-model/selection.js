// Deterministic temporal selection. No generic "best available" behavior.

export function latestAtOrBefore(quantities, requestedValidTime, { maximumAgeMs = Infinity } = {}) {
  const requestedMs = Date.parse(requestedValidTime);
  if (!Number.isFinite(requestedMs)) throw new Error(`Invalid requested time: ${requestedValidTime}`);

  let chosen = null;
  for (const q of quantities) {
    if (q.availability !== "present" || !q.time?.valid_start) continue;
    const validMs = Date.parse(q.time.valid_start);
    if (!Number.isFinite(validMs) || validMs > requestedMs) continue;
    if (!chosen || validMs > Date.parse(chosen.time.valid_start)) chosen = q;
  }

  if (!chosen)
    return { quantity: null, status: "missing", reason: "no_eligible_observation", age_ms: null };

  const ageMs = requestedMs - Date.parse(chosen.time.valid_start);
  if (ageMs > maximumAgeMs)
    return { quantity: null, status: "missing", reason: "stale", age_ms: ageMs, stale_quantity: chosen };

  return { quantity: chosen, status: "selected", reason: "latest_at_or_before", age_ms: ageMs };
}

export function latestAtOrBeforePolicy({ maximumAgeMs }) {
  if (!(maximumAgeMs >= 0)) throw new Error("maximumAgeMs must be non-negative");
  return {
    id: "latest-at-or-before",
    maximum_age_ms: maximumAgeMs,
    future_values: "forbidden",
    select(quantities, requestedValidTime) {
      return latestAtOrBefore(quantities, requestedValidTime, { maximumAgeMs });
    },
  };
}
