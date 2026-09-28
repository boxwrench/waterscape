import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DISCHARGE_PARAMETER,
  fetchLatestContinuous,
  latestContinuousUrl,
  normalizeContinuousFeature,
  selectLatestAtOrBefore,
} from "../../river-pulse/data/usgs.js";

function feature({
  id = "record-1",
  time = "2026-09-28T00:00:00Z",
  value = "1234",
  approval = "Provisional",
  series = "series-a",
} = {}) {
  return {
    type: "Feature",
    id,
    geometry: { type: "Point", coordinates: [-122.9277, 38.5085] },
    properties: {
      monitoring_location_id: "USGS-11467000",
      monitoring_location_number: "11467000",
      monitoring_location_name: "RUSSIAN R A HACIENDA BRIDGE NR GUERNEVILLE CA",
      agency_code: "USGS",
      parameter_code: DISCHARGE_PARAMETER,
      statistic_id: null,
      time_series_id: series,
      time,
      value,
      unit_of_measure: "ft3/s",
      approval_status: approval,
      qualifier: "P",
      last_modified: "2026-09-28T00:05:00Z",
    },
  };
}

test("latest continuous URL uses modern USGS OGC endpoint and simple filters", () => {
  const url = latestContinuousUrl("11467000");
  assert.equal(url.origin, "https://api.waterdata.usgs.gov");
  assert.equal(url.pathname, "/ogcapi/v1/collections/latest-continuous/items");
  assert.equal(url.searchParams.get("monitoring_location_id"), "USGS-11467000");
  assert.equal(url.searchParams.get("parameter_code"), "00060");
  assert.equal(url.searchParams.get("f"), "json");
});

test("USGS feature normalizes without presentation metadata", () => {
  const quantity = normalizeContinuousFeature(feature(), { retrievedAt: "2026-09-28T00:06:00Z" });
  assert.equal(quantity.feature_id, "USGS-11467000");
  assert.equal(quantity.phenomenon, "stream_discharge");
  assert.equal(quantity.value, 1234);
  assert.equal(quantity.unit, "ft3/s");
  assert.equal(quantity.evidence_type, "observation");
  assert.equal(quantity.source_approval, "provisional");
  assert.equal(quantity.provenance.agency, "USGS");
  assert.equal(quantity.provenance.retrieval_time, "2026-09-28T00:06:00.000Z");
  assert.deepEqual(quantity.source_flags, ["P"]);
  assert.equal("presentation" in quantity, false);
  assert.equal("visual_state" in quantity, false);
});

test("selection never reaches into the future and enforces maximum age", () => {
  const past = normalizeContinuousFeature(feature({ id: "past", time: "2026-09-28T00:00:00Z" })),
    future = normalizeContinuousFeature(feature({ id: "future", time: "2026-09-28T00:20:00Z", series: "series-b" }));

  const selected = selectLatestAtOrBefore([future, past], "2026-09-28T00:10:00Z", { maxAgeMs: 30 * 60 * 1000 });
  assert.equal(selected.availability, "present");
  assert.equal(selected.quantity.provenance.source_record_id, "past");
  assert.equal(selected.age_ms, 10 * 60 * 1000);

  const stale = selectLatestAtOrBefore([past], "2026-09-28T03:00:00Z", { maxAgeMs: 30 * 60 * 1000 });
  assert.equal(stale.availability, "missing");
  assert.equal(stale.reason, "no_eligible_observation");
});

test("fetch path returns normalized quantities plus deterministic selection", async () => {
  const seen = [];
  const fetchImpl = async (url) => {
    seen.push(url.toString());
    return {
      ok: true,
      async json() {
        return {
          type: "FeatureCollection",
          features: [
            feature({ id: "older", time: "2026-09-28T00:00:00Z", value: "900", series: "a" }),
            feature({ id: "newer", time: "2026-09-28T00:15:00Z", value: "1100", series: "b" }),
          ],
        };
      },
    };
  };

  const result = await fetchLatestContinuous("11467000", {
    requestedTime: "2026-09-28T00:20:00Z",
    maxAgeMs: 60 * 60 * 1000,
    fetchImpl,
  });
  assert.equal(seen.length, 1);
  assert.match(seen[0], /monitoring_location_id=USGS-11467000/);
  assert.equal(result.quantities.length, 2);
  assert.equal(result.selection.quantity.value, 1100);
  assert.equal(result.selection.quantity.provenance.source_record_id, "newer");
});
