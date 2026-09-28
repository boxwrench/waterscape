import { quantity } from "../data-model/quantity.js";

export const USGS_API_ROOT = "https://api.waterdata.usgs.gov/ogcapi/v1";
export const DISCHARGE_PARAMETER_CODE = "00060";

export function latestContinuousUrl(monitoringLocationId, parameterCode = DISCHARGE_PARAMETER_CODE) {
  const url = new URL(`${USGS_API_ROOT}/collections/latest-continuous/items`);
  url.searchParams.set("monitoring_location_id", monitoringLocationId);
  url.searchParams.set("parameter_code", parameterCode);
  url.searchParams.set("f", "json");
  return url.toString();
}

function approval(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized.includes("provisional") || normalized === "working") return "provisional";
  if (normalized.includes("approved")) return "approved";
  return "unknown";
}

function flags(properties) {
  const raw = properties.qualifier;
  if (raw == null || raw === "" || raw === "None") return [];
  return (Array.isArray(raw) ? raw : [raw]).map(String);
}

export function parseLatestContinuousFeature(feature, { retrievalTime = new Date().toISOString() } = {}) {
  const p = feature?.properties ?? {};
  if (!p.monitoring_location_id) throw new Error("USGS feature lacks monitoring_location_id");
  if (!p.parameter_code) throw new Error("USGS feature lacks parameter_code");
  if (!p.time) throw new Error("USGS feature lacks time");

  const validMs = Date.parse(p.time);
  if (!Number.isFinite(validMs)) throw new Error(`USGS feature has invalid time: ${p.time}`);

  const hasValue = p.value != null && p.value !== "",
    numericValue = hasValue ? Number(p.value) : null;
  if (hasValue && !Number.isFinite(numericValue)) throw new Error(`USGS feature has non-finite value: ${p.value}`);

  const phenomenon = p.parameter_code === DISCHARGE_PARAMETER_CODE ? "discharge" : `usgs:${p.parameter_code}`,
    timeSeriesId = p.time_series_id ?? feature.id ?? "unknown-series";
  return quantity({
    quantity_id: `usgs:${p.monitoring_location_id}:${p.parameter_code}:${timeSeriesId}:${new Date(validMs).toISOString()}`,
    feature_id: p.monitoring_location_id,
    phenomenon,
    value: numericValue,
    unit: p.unit_of_measure ?? null,
    evidence_type: "observation",
    time: {
      valid_start: new Date(validMs).toISOString(),
      valid_end: new Date(validMs).toISOString(),
      // The API's last_modified is retained as provenance, not treated as proof that the
      // record was publicly available at that instant.
      issue_time: null,
      as_of_time: null,
    },
    availability: hasValue ? "present" : "missing",
    source_approval: approval(p.approval_status),
    estimation_status: "unknown",
    source_flags: flags(p),
    method: {
      method_id: "usgs_continuous",
      parameter_code: p.parameter_code,
      statistic_id: p.statistic_id ?? null,
      time_series_id: p.time_series_id ?? null,
    },
    provenance: {
      agency: "U.S. Geological Survey",
      dataset: "USGS Water Data latest-continuous",
      source_feature_id: p.monitoring_location_id,
      source_record_id: feature.id ?? null,
      source_snapshot_id: null,
      retrieval_time: new Date(retrievalTime).toISOString(),
      last_modified: p.last_modified ?? null,
      api: USGS_API_ROOT,
    },
    spatial: {
      monitoring_location_id: p.monitoring_location_id,
      geometry: feature.geometry ?? null,
      horizontal_crs: "OGC:CRS84",
    },
  });
}

export function parseLatestContinuous(payload, options = {}) {
  const features = Array.isArray(payload?.features) ? payload.features : [];
  return features.map((feature) => parseLatestContinuousFeature(feature, options));
}

export async function fetchLatestContinuous(monitoringLocationId, parameterCode = DISCHARGE_PARAMETER_CODE, fetchImpl = fetch) {
  const retrievalTime = new Date().toISOString(),
    url = latestContinuousUrl(monitoringLocationId, parameterCode),
    response = await fetchImpl(url, { headers: { Accept: "application/geo+json, application/json" } });
  if (!response.ok) throw new Error(`USGS latest-continuous ${response.status}`);
  return {
    url,
    retrieval_time: retrievalTime,
    quantities: parseLatestContinuous(await response.json(), { retrievalTime }),
  };
}
