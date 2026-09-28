import { test } from "node:test";
import assert from "node:assert/strict";
import { quantity } from "../../river-pulse/data-model/quantity.js";
import { latestAtOrBefore, latestAtOrBeforePolicy } from "../../river-pulse/data-model/selection.js";
import {
  DISCHARGE_PARAMETER_CODE,
  latestContinuousUrl,
  parseLatestContinuous,
} from "../../river-pulse/adapters/usgs.js";

function observed(time, value = 100) {
  return quantity({
    quantity_id: `q:${time}`,
    feature_id: "USGS-11467000",
    phenomenon: "discharge",
    value,
    unit: "ft^3/s",
    evidence_type: "observation",
    time: { valid_start: time },
    source_approval: "provisional",
  });
}

test("scientific quantity carries no presentation metadata", () => {
  const q = observed("2026-09-27T12:00:00Z");
  assert.equal(q.evidence_type, "observation");
  assert.equal(q.time.valid_start, "2026-09-27T12:00:00Z");
  assert.equal("presentation" in q, false);
  assert.equal("visual_state" in q, false);
});

test("latest-at-or-before never selects a future observation", () => {
  const values = [
    observed("2026-09-27T11:45:00Z", 90),
    observed("2026-09-27T12:00:00Z", 100),
    observed("2026-09-27T12:15:00Z", 120),
  ];
  const result = latestAtOrBefore(values, "2026-09-27T12:05:00Z", { maximumAgeMs: 30 * 60 * 1000 });
  assert.equal(result.status, "selected");
  assert.equal(result.quantity.value, 100);
  assert.equal(result.age_ms, 5 * 60 * 1000);
});

test("latest-at-or-before exposes stale data rather than silently using it", () => {
  const q = observed("2026-09-27T10:00:00Z", 80),
    result = latestAtOrBefore([q], "2026-09-27T12:00:00Z", { maximumAgeMs: 30 * 60 * 1000 });
  assert.equal(result.status, "missing");
  assert.equal(result.reason, "stale");
  assert.equal(result.stale_quantity, q);
});

test("selection policy records its deterministic rule", () => {
  const policy = latestAtOrBeforePolicy({ maximumAgeMs: 15 * 60 * 1000 });
  assert.equal(policy.id, "latest-at-or-before");
  assert.equal(policy.future_values, "forbidden");
  assert.equal(policy.maximum_age_ms, 15 * 60 * 1000);
});

test("USGS adapter normalizes latest-continuous discharge without inventing as-of time", () => {
  const payload = {
    type: "FeatureCollection",
    features: [
      {
        id: "record-1",
        type: "Feature",
        geometry: { type: "Point", coordinates: [-122.9277, 38.5085] },
        properties: {
          time_series_id: "series-1",
          monitoring_location_id: "USGS-11467000",
          parameter_code: DISCHARGE_PARAMETER_CODE,
          statistic_id: "00011",
          time: "2026-09-13T18:00:00+00:00",
          value: "142",
          unit_of_measure: "ft^3/s",
          approval_status: "Provisional",
          qualifier: "None",
          last_modified: "2026-09-13T18:07:00+00:00",
        },
      },
    ],
  };
  const [q] = parseLatestContinuous(payload, { retrievalTime: "2026-09-27T12:00:00Z" });
  assert.equal(q.feature_id, "USGS-11467000");
  assert.equal(q.phenomenon, "discharge");
  assert.equal(q.value, 142);
  assert.equal(q.unit, "ft^3/s");
  assert.equal(q.source_approval, "provisional");
  assert.equal(q.time.as_of_time, null);
  assert.equal(q.provenance.last_modified, "2026-09-13T18:07:00+00:00");
});

test("USGS adapter uses the modern v1 latest-continuous endpoint", () => {
  const url = new URL(latestContinuousUrl("USGS-11467000"));
  assert.equal(url.pathname, "/ogcapi/v1/collections/latest-continuous/items");
  assert.equal(url.searchParams.get("monitoring_location_id"), "USGS-11467000");
  assert.equal(url.searchParams.get("parameter_code"), "00060");
  assert.equal(url.searchParams.get("f"), "json");
});
