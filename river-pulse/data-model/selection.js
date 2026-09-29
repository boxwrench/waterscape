// Deterministic temporal selection. No generic "best available" behavior.

function isPreferred(candidate, chosen) {
  if (!chosen) return true;
  const candidateMs = Date.parse(candidate.time.valid_start),
    chosenMs = Date.parse(chosen.time.valid_start);
  if (candidateMs !== chosenMs) return candidateMs > chosenMs;
  const candidateAvailability = Date.parse(candidate.time.as_of_time) || 0,
    chosenAvailability = Date.parse(chosen.time.as_of_time) || 0;
  if (candidateAvailability !== chosenAvailability)
    return candidateAvailability > chosenAvailability;
  // Source APIs are not required to return equal-time series in a stable order. Keep the
  // selection reproducible by breaking ties on the normalized scientific identity.
  return (
    String(candidate.quantity_id).localeCompare(String(chosen.quantity_id)) < 0
  );
}

function eligibleAsOf(q, asOfTime) {
  if (!asOfTime) return true;
  const cutoff = Date.parse(asOfTime),
    available = Date.parse(q.time?.as_of_time);
  if (!Number.isFinite(cutoff))
    throw new Error(`Invalid as-of time: ${asOfTime}`);
  // Retrieval and last_modified are deliberately not substitutes for availability.
  return (
    Number.isFinite(available) &&
    available <= cutoff &&
    (!q.time?.issue_time || Date.parse(q.time.issue_time) <= cutoff)
  );
}

export function latestAtOrBefore(
  quantities,
  requestedValidTime,
  { maximumAgeMs = Infinity, asOfTime = null } = {},
) {
  const requestedMs = Date.parse(requestedValidTime);
  if (!Number.isFinite(requestedMs))
    throw new Error(`Invalid requested time: ${requestedValidTime}`);
  if (!(maximumAgeMs >= 0))
    throw new Error("maximumAgeMs must be non-negative");
  if (asOfTime && !Number.isFinite(Date.parse(asOfTime)))
    throw new Error(`Invalid as-of time: ${asOfTime}`);

  let chosen = null;
  for (const q of quantities) {
    if (!q.time?.valid_start || !eligibleAsOf(q, asOfTime)) continue;
    const validMs = Date.parse(q.time.valid_start);
    if (!Number.isFinite(validMs) || validMs > requestedMs) continue;
    if (isPreferred(q, chosen)) chosen = q;
  }

  if (!chosen)
    return {
      quantity: null,
      status: "missing",
      reason: "no_eligible_observation",
      age_ms: null,
    };

  const ageMs = requestedMs - Date.parse(chosen.time.valid_start);
  if (ageMs > maximumAgeMs)
    return {
      quantity: null,
      status: "missing",
      reason: "stale",
      age_ms: ageMs,
      stale_quantity: chosen,
    };

  if (chosen.availability !== "present" || chosen.value == null)
    return {
      quantity: null,
      status: "missing",
      reason: "source_reported_missing",
      age_ms: ageMs,
    };

  return {
    quantity: chosen,
    status: "selected",
    reason: "latest_at_or_before",
    age_ms: ageMs,
  };
}

export function latestAtOrBeforePolicy({ maximumAgeMs }) {
  if (!(maximumAgeMs >= 0))
    throw new Error("maximumAgeMs must be non-negative");
  return {
    id: "latest-at-or-before",
    maximum_age_ms: maximumAgeMs,
    future_values: "forbidden",
    tie_break: "latest_explicit_availability_then_quantity_id_ascending",
    select(quantities, requestedValidTime, { asOfTime = null } = {}) {
      return latestAtOrBefore(quantities, requestedValidTime, {
        maximumAgeMs,
        asOfTime,
      });
    },
  };
}

export function coveringInterval(
  quantities,
  requestedValidTime,
  { asOfTime = null } = {},
) {
  const requestedMs = Date.parse(requestedValidTime);
  if (!Number.isFinite(requestedMs))
    throw new Error(`Invalid requested time: ${requestedValidTime}`);
  if (asOfTime && !Number.isFinite(Date.parse(asOfTime)))
    throw new Error(`Invalid as-of time: ${asOfTime}`);

  let chosen = null;
  for (const q of quantities) {
    if (
      !q.time?.valid_start ||
      !q.time?.valid_end ||
      !eligibleAsOf(q, asOfTime)
    )
      continue;
    const startMs = Date.parse(q.time.valid_start),
      endMs = Date.parse(q.time.valid_end);
    if (
      !Number.isFinite(startMs) ||
      !Number.isFinite(endMs) ||
      endMs <= startMs
    )
      continue;
    // Intervals are [start, end): midnight belongs to the new daily interval, not both days.
    if (requestedMs < startMs || requestedMs >= endMs) continue;
    if (isPreferred(q, chosen)) chosen = q;
  }

  if (!chosen)
    return {
      quantity: null,
      status: "missing",
      reason: "no_covering_interval",
      age_ms: null,
    };
  if (chosen.availability !== "present" || chosen.value == null)
    return {
      quantity: null,
      status: "missing",
      reason: "source_reported_missing",
      age_ms: null,
    };

  return {
    quantity: chosen,
    status: "selected",
    reason: "covering_interval",
    age_ms: requestedMs - Date.parse(chosen.time.valid_start),
  };
}

export function coveringIntervalPolicy() {
  return {
    id: "covering-interval",
    interval_semantics: "start-inclusive-end-exclusive",
    tie_break:
      "latest_valid_start_then_explicit_availability_then_quantity_id_ascending",
    select(quantities, requestedValidTime, options = {}) {
      return coveringInterval(quantities, requestedValidTime, options);
    },
  };
}
