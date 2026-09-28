// Normalized scientific quantities for River Pulse.
// This module intentionally contains no rendering/presentation metadata.

const EVIDENCE_TYPES = new Set(["observation", "derived_statistic", "model_output"]);
const AVAILABILITY = new Set(["present", "missing"]);
const APPROVAL = new Set(["provisional", "approved", "unknown"]);
const ESTIMATION = new Set(["source_estimated", "not_flagged", "unknown"]);

export function quantity(input) {
  const q = {
    quantity_id: input.quantity_id,
    feature_id: input.feature_id,
    phenomenon: input.phenomenon,
    value: input.value ?? null,
    unit: input.unit ?? null,
    evidence_type: input.evidence_type,
    time: {
      valid_start: input.time?.valid_start ?? null,
      valid_end: input.time?.valid_end ?? input.time?.valid_start ?? null,
      issue_time: input.time?.issue_time ?? null,
      as_of_time: input.time?.as_of_time ?? null,
    },
    method: input.method ?? {},
    availability: input.availability ?? (input.value == null ? "missing" : "present"),
    source_approval: input.source_approval ?? "unknown",
    estimation_status: input.estimation_status ?? "unknown",
    source_flags: [...(input.source_flags ?? [])],
    provenance: { ...(input.provenance ?? {}) },
    spatial: { ...(input.spatial ?? {}) },
  };
  validateQuantity(q);
  return Object.freeze(q);
}

export function validateQuantity(q) {
  for (const key of ["quantity_id", "feature_id", "phenomenon", "evidence_type"])
    if (!q[key]) throw new Error(`Quantity lacks ${key}`);
  if (!EVIDENCE_TYPES.has(q.evidence_type)) throw new Error(`Unknown evidence_type: ${q.evidence_type}`);
  if (!AVAILABILITY.has(q.availability)) throw new Error(`Unknown availability: ${q.availability}`);
  if (!APPROVAL.has(q.source_approval)) throw new Error(`Unknown source_approval: ${q.source_approval}`);
  if (!ESTIMATION.has(q.estimation_status)) throw new Error(`Unknown estimation_status: ${q.estimation_status}`);
  if (q.availability === "present") {
    if (q.value == null) throw new Error("Present Quantity requires value");
    if (!q.unit) throw new Error("Present Quantity requires unit");
    if (!q.time?.valid_start) throw new Error("Present Quantity requires valid_start");
  }
  return true;
}
