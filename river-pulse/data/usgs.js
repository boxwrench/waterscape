// USGS Water Data API adapter for River Pulse.
//
// This module owns source-specific translation only. It turns USGS OGC features into the
// normalized scientific quantity shape used by River Pulse. Rendering decisions belong in
// visual bindings, not here.

export const USGS_API = "https://api.waterdata.usgs.gov/ogcapi/v1";
export const DISCHARGE_PARAMETER = "00060";
export const DEFAULT_MAX_AGE_MS = 2 * 60 * 60 * 1000;

export function monitoringLocationId(siteNumber, agency = "USGS") {
  return `${agency}-${siteNumber}`;
}

export function latestContinuousUrl(siteNumber, parameterCode = DISCHARGE_PARAMETER, agency = "USGS") {
  const url = new URL(`${USGS_API}/collections/latest-continuous/items`);
  url.searchParams.set("monitoring_location_id", monitoringLocationId(siteNumber, agency));
  url.searchParams.set("parameter_code", parameterCode);
  url.searchParams.set("limit", "10");
  url.searchParams.set("f", "json");
  return url;
}

function approvalStatus(properties) {
  const raw = properties.approval_status ?? properties.approvals_status;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return "unknown";
  const normalized = value.toLowerCase();
  if (normalized.includes("provisional") || normalized === "working") return "provisional";
  if (normalized.includes("approved")) return "approved";
  return "unknown";
}

function sourceFlags(properties) {
  const raw = properties.qualifier;
  if (raw == null || raw === "") return [];
  return Array.isArray(raw) ? raw.map(String) : [String(raw)];
}

export function normalizeContinuousFeature(feature, { retrievedAt = new Date().toISOString() } = {}) {
  const p = feature?.properties ?? {};
  const value = Number(p.value);
  if (!Number.isFinite(value)) throw new Error("USGS continuous feature has no finite value");
  if (!p.time) throw new Error("USGS continuous feature has no valid time");
  if (!p.monitoring_location_id) throw new Error("USGS continuous feature has no monitoring location id");
  if (!p.parameter_code) throw new Error("USGS continuous feature has no parameter code");

  const timeSeriesId = p.time_series_id ?? p.timeseries_id ?? null,
    validTime = new Date(p.time);
  if (!Number.isFinite(validTime.getTime())) throw new Error(`Invalid USGS observation time: ${p.time}`);

  return {
    quantity_id: ["usgs", p.monitoring_location_id, p.parameter_code, timeSeriesId ?? "series", p.time].join(":"),
    feature_id: p.monitoring_location_id,
    phenomenon: p.parameter_code === DISCHARGE_PARAMETER ? "stream_discharge" : `usgs_parameter_${p.parameter_code}`,
    value,
    unit: p.unit_of_measure ?? null,
    evidence_type: "observation",
    time: {
      valid_start: validTime.toISOString(),
      valid_end: validTime.toISOString(),
      issue_time: null,
      as_of_time: null,
    },
    method: {
      method_id: "usgs_continuous",
      parameter_code: p.parameter_code,
      statistic_id: p.statistic_id ?? null,
      time_series_id: timeSeriesId,
    },
    availability: "present",
    source_approval: approvalStatus(p),
    estimation_status: "unknown",
    source_flags: sourceFlags(p),
    provenance: {
      agency: p.agency_code ?? "USGS",
      dataset: "USGS Water Data APIs — continuous values",
      source_feature_id: p.monitoring_location_id,
      source_record_id: feature.id ?? p.id ?? null,
      source_snapshot_id: null,
      retrieval_time: new Date(retrievedAt).toISOString(),
      last_modified: p.last_modified ?? null,
    },
    spatial: {
      geometry: feature.geometry ?? null,
      horizontal_crs: "EPSG:4326",
      vertical_datum: null,
    },
  };
}

// Deterministic policy: latest eligible observation at or before requested time, subject to
// maximum age. Future observations are never selected. Ties are broken by quantity id so a
// newly-added adapter/time series cannot silently make ordering nondeterministic.
export function selectLatestAtOrBefore(quantities, requestedTime, { maxAgeMs = DEFAULT_MAX_AGE_MS } = {}) {
  const requestedMs = new Date(requestedTime).getTime();
  if (!Number.isFinite(requestedMs)) throw new Error(`Invalid requested time: ${requestedTime}`);

  const eligible = quantities
    .filter((quantity) => quantity?.availability === "present" && quantity?.time?.valid_start)
    .map((quantity) => ({ quantity, ms: new Date(quantity.time.valid_start).getTime() }))
    .filter(({ ms }) => Number.isFinite(ms) && ms <= requestedMs && requestedMs - ms <= maxAgeMs)
    .sort((a, b) => b.ms - a.ms || String(a.quantity.quantity_id).localeCompare(String(b.quantity.quantity_id)));

  if (!eligible.length) {
    return {
      quantity: null,
      availability: "missing",
      reason: "no_eligible_observation",
      requested_time: new Date(requestedMs).toISOString(),
      max_age_ms: maxAgeMs,
    };
  }

  const chosen = eligible[0];
  return {
    quantity: chosen.quantity,
    availability: "present",
    reason: null,
    requested_time: new Date(requestedMs).toISOString(),
    age_ms: requestedMs - chosen.ms,
    max_age_ms: maxAgeMs,
  };
}

export async function fetchLatestContinuous(
  siteNumber,
  {
    parameterCode = DISCHARGE_PARAMETER,
    agency = "USGS",
    requestedTime = new Date().toISOString(),
    maxAgeMs = DEFAULT_MAX_AGE_MS,
    fetchImpl = fetch,
  } = {},
) {
  const url = latestContinuousUrl(siteNumber, parameterCode, agency),
    retrievalTime = new Date().toISOString(),
    response = await fetchImpl(url);
  if (!response.ok) throw new Error(`USGS ${response.status} ${url}`);
  const payload = await response.json(),
    features = Array.isArray(payload.features) ? payload.features : [],
    quantities = features.map((feature) => normalizeContinuousFeature(feature, { retrievedAt: retrievalTime }));
  const selection = selectLatestAtOrBefore(quantities, requestedTime, { maxAgeMs });
  return { url: url.toString(), retrieval_time: retrievalTime, quantities, selection };
}
