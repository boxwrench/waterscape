import { quantity } from "../data-model/quantity.js";

export const USGS_API_ROOT = "https://api.waterdata.usgs.gov/ogcapi/v1";
export const DISCHARGE_PARAMETER_CODE = "00060";
export const DAILY_MEAN_STATISTIC_ID = "00003";

export function latestContinuousUrl(monitoringLocationId, parameterCode = DISCHARGE_PARAMETER_CODE) {
  const url = new URL(`${USGS_API_ROOT}/collections/latest-continuous/items`);
  url.searchParams.set("monitoring_location_id", monitoringLocationId);
  url.searchParams.set("parameter_code", parameterCode);
  url.searchParams.set("f", "json");
  return url.toString();
}

export function dailyValuesUrl(
  monitoringLocationId,
  startDate,
  endDate,
  parameterCode = DISCHARGE_PARAMETER_CODE,
  statisticId = DAILY_MEAN_STATISTIC_ID,
) {
  const url = new URL(`${USGS_API_ROOT}/collections/daily/items`);
  url.searchParams.set("monitoring_location_id", monitoringLocationId);
  url.searchParams.set("parameter_code", parameterCode);
  url.searchParams.set("statistic_id", statisticId);
  url.searchParams.set("datetime", `${startDate}/${endDate}`);
  url.searchParams.set("limit", "1000");
  url.searchParams.set("f", "json");
  return url.toString();
}

function approval(value) {
  const raw = Array.isArray(value) ? value.join(" ") : value,
    normalized = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (normalized.includes("provisional") || normalized.includes("working")) return "provisional";
  if (normalized.includes("approved")) return "approved";
  return "unknown";
}

function flags(properties) {
  const raw = properties.qualifier;
  if (raw == null || raw === "" || raw === "None") return [];
  return (Array.isArray(raw) ? raw : [raw]).map(String);
}

function numericValue(properties) {
  const hasValue = properties.value != null && properties.value !== "",
    value = hasValue ? Number(properties.value) : null;
  if (hasValue && !Number.isFinite(value)) throw new Error(`USGS feature has non-finite value: ${properties.value}`);
  return { hasValue, value };
}

function commonProvenance(feature, properties, retrievalTime, dataset) {
  return {
    agency: "U.S. Geological Survey",
    dataset,
    source_feature_id: properties.monitoring_location_id,
    source_record_id: feature.id ?? null,
    source_snapshot_id: null,
    retrieval_time: new Date(retrievalTime).toISOString(),
    last_modified: properties.last_modified ?? null,
    api: USGS_API_ROOT,
  };
}

export function parseLatestContinuousFeature(feature, { retrievalTime = new Date().toISOString() } = {}) {
  const p = feature?.properties ?? {};
  if (!p.monitoring_location_id) throw new Error("USGS feature lacks monitoring_location_id");
  if (!p.parameter_code) throw new Error("USGS feature lacks parameter_code");
  if (!p.time) throw new Error("USGS feature lacks time");

  const validMs = Date.parse(p.time);
  if (!Number.isFinite(validMs)) throw new Error(`USGS feature has invalid time: ${p.time}`);

  const { hasValue, value } = numericValue(p),
    phenomenon = p.parameter_code === DISCHARGE_PARAMETER_CODE ? "discharge" : `usgs:${p.parameter_code}`,
    timeSeriesId = p.time_series_id ?? p.timeseries_id ?? feature.id ?? "unknown-series";
  return quantity({
    quantity_id: `usgs:${p.monitoring_location_id}:${p.parameter_code}:${timeSeriesId}:${new Date(validMs).toISOString()}`,
    feature_id: p.monitoring_location_id,
    phenomenon,
    value,
    unit: p.unit_of_measure ?? null,
    evidence_type: "observation",
    time: {
      valid_start: new Date(validMs).toISOString(),
      valid_end: new Date(validMs).toISOString(),
      issue_time: null,
      // last_modified and retrieval time are not proof of first public availability.
      as_of_time: null,
    },
    availability: hasValue ? "present" : "missing",
    source_approval: approval(p.approval_status ?? p.approvals_status),
    estimation_status: "unknown",
    source_flags: flags(p),
    method: {
      method_id: "usgs_continuous",
      parameter_code: p.parameter_code,
      statistic_id: p.statistic_id ?? null,
      time_series_id: timeSeriesId,
    },
    provenance: commonProvenance(feature, p, retrievalTime, "USGS Water Data latest-continuous"),
    spatial: {
      monitoring_location_id: p.monitoring_location_id,
      geometry: feature.geometry ?? null,
      horizontal_crs: "OGC:CRS84",
    },
  });
}

export function parseDailyFeature(feature, { retrievalTime = new Date().toISOString() } = {}) {
  const p = feature?.properties ?? {};
  if (!p.monitoring_location_id) throw new Error("USGS daily feature lacks monitoring_location_id");
  if (!p.parameter_code) throw new Error("USGS daily feature lacks parameter_code");
  if (!p.time) throw new Error("USGS daily feature lacks time");

  const validMs = Date.parse(`${p.time}T00:00:00Z`);
  if (!Number.isFinite(validMs)) throw new Error(`USGS daily feature has invalid date: ${p.time}`);
  const { hasValue, value } = numericValue(p),
    statisticId = p.statistic_id ?? null,
    timeSeriesId = p.time_series_id ?? p.timeseries_id ?? feature.id ?? "unknown-series",
    phenomenon = p.parameter_code === DISCHARGE_PARAMETER_CODE ? "discharge" : `usgs:${p.parameter_code}`;

  return quantity({
    quantity_id: `usgs-daily:${p.monitoring_location_id}:${p.parameter_code}:${statisticId ?? "none"}:${timeSeriesId}:${p.time}`,
    feature_id: p.monitoring_location_id,
    phenomenon,
    value,
    unit: p.unit_of_measure ?? null,
    // Daily values are statistics derived from the day's observations, not instantaneous observations.
    evidence_type: "derived_statistic",
    time: {
      valid_start: new Date(validMs).toISOString(),
      valid_end: new Date(validMs + 24 * 60 * 60 * 1000).toISOString(),
      issue_time: null,
      as_of_time: null,
    },
    availability: hasValue ? "present" : "missing",
    source_approval: approval(p.approval_status ?? p.approvals_status),
    estimation_status: "unknown",
    source_flags: flags(p),
    method: {
      method_id: statisticId === DAILY_MEAN_STATISTIC_ID ? "usgs_daily_mean" : "usgs_daily_statistic",
      parameter_code: p.parameter_code,
      statistic_id: statisticId,
      time_series_id: timeSeriesId,
    },
    provenance: commonProvenance(feature, p, retrievalTime, "USGS Water Data daily values"),
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

export function parseDailyValues(payload, options = {}) {
  const features = Array.isArray(payload?.features) ? payload.features : [];
  return features.map((feature) => parseDailyFeature(feature, options));
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

export async function fetchDailyValues(
  monitoringLocationId,
  startDate,
  endDate,
  parameterCode = DISCHARGE_PARAMETER_CODE,
  statisticId = DAILY_MEAN_STATISTIC_ID,
  fetchImpl = fetch,
) {
  const retrievalTime = new Date().toISOString(),
    url = dailyValuesUrl(monitoringLocationId, startDate, endDate, parameterCode, statisticId),
    response = await fetchImpl(url, { headers: { Accept: "application/geo+json, application/json" } });
  if (!response.ok) throw new Error(`USGS daily values ${response.status}`);
  return {
    url,
    retrieval_time: retrievalTime,
    quantities: parseDailyValues(await response.json(), { retrievalTime }),
  };
}
