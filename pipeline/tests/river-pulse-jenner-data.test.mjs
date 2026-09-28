import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GAGE_HEIGHT_PARAMETER_CODE,
  STREAM_LEVEL_NAVD88_PARAMETER_CODE,
  latestContinuousUrl,
  parseLatestContinuousFeature,
} from "../../river-pulse/adapters/usgs.js";

function feature(parameterCode, value = "4.04") {
  return {
    type: "Feature",
    id: `jenner-${parameterCode}`,
    geometry: { type: "Point", coordinates: [-123.10110833333333, 38.43402222222222] },
    properties: {
      monitoring_location_id: "USGS-11467270",
      parameter_code: parameterCode,
      time_series_id: `series-${parameterCode}`,
      time: "2026-09-16T15:30:00Z",
      value,
      unit_of_measure: "ft",
      approval_status: "Provisional",
    },
  };
}

test("Jenner parameter 63160 is water-surface elevation referenced to NAVD88", () => {
  const q = parseLatestContinuousFeature(feature(STREAM_LEVEL_NAVD88_PARAMETER_CODE), {
    retrievalTime: "2026-09-16T15:35:00Z",
  });
  assert.equal(q.feature_id, "USGS-11467270");
  assert.equal(q.phenomenon, "water_surface_elevation");
  assert.equal(q.value, 4.04);
  assert.equal(q.unit, "ft");
  assert.equal(q.spatial.vertical_datum, "NAVD88");
  assert.equal(q.evidence_type, "observation");
});

test("gage-height parameter remains distinct from NAVD88 water-surface elevation", () => {
  const q = parseLatestContinuousFeature(feature(GAGE_HEIGHT_PARAMETER_CODE));
  assert.equal(q.phenomenon, "gage_height");
  assert.equal(q.spatial.vertical_datum, null);
});

test("Jenner latest-continuous URL can explicitly request stream-level elevation", () => {
  const url = new URL(latestContinuousUrl("USGS-11467270", STREAM_LEVEL_NAVD88_PARAMETER_CODE));
  assert.equal(url.searchParams.get("monitoring_location_id"), "USGS-11467270");
  assert.equal(url.searchParams.get("parameter_code"), "63160");
});
