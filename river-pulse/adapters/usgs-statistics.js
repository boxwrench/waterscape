import { quantity } from "../data-model/quantity.js";
import { DISCHARGE_PARAMETER_CODE } from "./usgs.js";

export const USGS_STATISTICS_API_ROOT = "https://api.waterdata.usgs.gov/statistics/v0";
export const DAY_OF_YEAR_NORMAL_TYPE = "DOY";

export function dayOfYearStatisticsUrl(
  monitoringLocationId,
  monthDay,
  parameterCode = DISCHARGE_PARAMETER_CODE,
) {
  const url = new URL(`${USGS_STATISTICS_API_ROOT}/observationNormals`);
  for (const computation of ["minimum", "maximum", "percentile"])
    url.searchParams.append("computation_type", computation);
  url.searchParams.set("normal_type", DAY_OF_YEAR_NORMAL_TYPE);
  url.searchParams.set("start_date", monthDay);
  url.searchParams.set("end_date", monthDay);
  url.searchParams.set("monitoring_location_id", monitoringLocationId);
  url.searchParams.set("parameter_code", parameterCode);
  url.searchParams.set("page_size", "1000");
  return url.toString();
}

function asSeries(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function numeric(value) {
  if (value == null || value === "" || String(value).toLowerCase() === "nan") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function percentileFor(computation, rawPercentile) {
  if (rawPercentile != null && Number.isFinite(Number(rawPercentile))) return Number(rawPercentile);
  if (computation === "minimum") return 0;
  if (computation === "median") return 50;
  if (computation === "maximum") return 100;
  return null;
}

function expandSeries(series) {
  const observations = Array.isArray(series?.values) ? series.values : [];
  const expanded = [];

  for (const observation of observations) {
    const values = Array.isArray(observation?.values) ? observation.values : null,
      percentiles = Array.isArray(observation?.percentiles) ? observation.percentiles : null;

    if (values && percentiles) {
      const count = Math.min(values.length, percentiles.length);
      for (let i = 0; i < count; i++)
        expanded.push({
          ...observation,
          value: values[i],
          percentile: percentiles[i],
        });
    } else {
      expanded.push(observation);
    }
  }

  return expanded;
}

export function parseDayOfYearStatistics(
  payload,
  {
    validDate,
    retrievalTime = new Date().toISOString(),
    monitoringLocationId = null,
    parameterCode = DISCHARGE_PARAMETER_CODE,
  } = {},
) {
  if (!validDate || !/^\d{4}-\d{2}-\d{2}$/.test(validDate))
    throw new Error(`validDate must be YYYY-MM-DD, got ${validDate}`);

  const validStart = `${validDate}T00:00:00.000Z`,
    validEnd = new Date(Date.parse(validStart) + 24 * 60 * 60 * 1000).toISOString(),
    out = [];

  for (const series of asSeries(payload)) {
    const featureId = series.monitoring_location_id ?? monitoringLocationId,
      pcode = series.parameter_code ?? parameterCode,
      unit = series.unit_of_measure ?? series.unit ?? "ft^3/s",
      computation = series.computation ?? series.computation_type ?? null,
      parentTimeSeriesId = series.parent_time_series_id ?? null,
      normalType = series.normal_type ?? series.time_of_year_type ?? DAY_OF_YEAR_NORMAL_TYPE;

    if (!featureId) continue;
    for (const observation of expandSeries(series)) {
      const value = numeric(observation?.value ?? observation?.values),
        percentile = percentileFor(computation, observation?.percentile ?? observation?.percentiles),
        sampleCount = numeric(observation?.sample_count ?? series.sample_count),
        timeOfYear = observation?.time_of_year ?? observation?.date ?? series.time_of_year ?? validDate.slice(5);

      if (value == null) continue;
      out.push(
        quantity({
          quantity_id: [
            "usgs-stat",
            featureId,
            pcode,
            normalType,
            timeOfYear,
            computation ?? "unknown",
            percentile ?? "na",
            parentTimeSeriesId ?? "series",
          ].join(":"),
          feature_id: featureId,
          phenomenon: pcode === DISCHARGE_PARAMETER_CODE ? "discharge_day_of_year_statistic" : `usgs_stat:${pcode}`,
          value,
          unit,
          evidence_type: "derived_statistic",
          time: {
            valid_start: validStart,
            valid_end: validEnd,
            issue_time: null,
            as_of_time: null,
          },
          method: {
            method_id: "usgs_day_of_year_statistic",
            parameter_code: pcode,
            normal_type: normalType,
            time_of_year: timeOfYear,
            computation,
            percentile,
            sample_count: sampleCount,
            parent_time_series_id: parentTimeSeriesId,
          },
          availability: "present",
          source_approval: "approved",
          estimation_status: "unknown",
          source_flags: [],
          provenance: {
            agency: "U.S. Geological Survey",
            dataset: "USGS Water Data Statistics observationNormals",
            source_feature_id: featureId,
            source_record_id: series.parent_statistics_id ?? null,
            source_snapshot_id: null,
            retrieval_time: new Date(retrievalTime).toISOString(),
            api: USGS_STATISTICS_API_ROOT,
            beta: true,
          },
          spatial: {
            monitoring_location_id: featureId,
            geometry: series.geometry ?? null,
            horizontal_crs: "OGC:CRS84",
          },
        }),
      );
    }
  }

  return out;
}

export async function fetchDayOfYearStatistics(
  monitoringLocationId,
  monthDay,
  validDate,
  parameterCode = DISCHARGE_PARAMETER_CODE,
  fetchImpl = fetch,
) {
  const retrievalTime = new Date().toISOString(),
    url = dayOfYearStatisticsUrl(monitoringLocationId, monthDay, parameterCode),
    response = await fetchImpl(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`USGS statistics ${response.status}`);
  return {
    url,
    retrieval_time: retrievalTime,
    quantities: parseDayOfYearStatistics(await response.json(), {
      validDate,
      retrievalTime,
      monitoringLocationId,
      parameterCode,
    }),
  };
}
