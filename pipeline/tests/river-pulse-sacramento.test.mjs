import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseLatestContinuousFeature, parseDailyFeature } from "../../river-pulse/adapters/usgs.js";
import { matchingSeries } from "../../river-pulse/data-model/binding-series.js";
import { latestAtOrBefore } from "../../river-pulse/data-model/selection.js";
import { dailyHydrograph } from "../../river-pulse/visual-bindings/hydrograph.js";

function feature(parameter, time, series, statistic, value = "100") {
  return { id: `${parameter}-${time}`, properties: { monitoring_location_id: "USGS-11447650",
    parameter_code: parameter, time, time_series_id: series, statistic_id: statistic,
    value, unit_of_measure: "ft^3/s", approval_status: "Provisional" } };
}
const options = { retrievalTime: "2026-10-03T12:00:00Z" };

test("Freeport daily history preserves tidally filtered provenance and stays out of ordinary discharge charts", () => {
  const q = parseDailyFeature(feature("72137", "2026-10-01", "daily", "00003"), options);
  assert.equal(q.phenomenon, "tidally_filtered_discharge");
  assert.equal(q.evidence_type, "derived_statistic");
  assert.equal(q.method.parameter_code, "72137");
  assert.equal(dailyHydrograph([q]).kind, "empty");
  assert.equal(dailyHydrograph([q], { phenomenon: "tidally_filtered_discharge" }).points.length, 1);
});
test("a competing Freeport series or a different station cannot replace the configured observation", () => {
  const q = parseLatestContinuousFeature(feature("00060", "2026-10-03T11:45:00Z", "instant", "00011"), options),
    competing = parseLatestContinuousFeature(feature("00060", "2026-10-03T11:55:00Z", "other", "00011", "999"), options),
    binding = { feature_id: q.feature_id, phenomenon: q.phenomenon, parameter_code: "00060",
      statistic_id: "00011", time_series_id: "instant", unit: "ft^3/s", evidence_type: "observation" },
    matches = matchingSeries([q, competing, { ...q, feature_id: "USGS-11467000" },
      { ...q, unit: "m^3/s" }, { ...q, evidence_type: "model_output" }], binding);
  assert.deepEqual(matches, [q]);
  assert.equal(latestAtOrBefore(matches, "2026-10-03T12:00:00Z", { maximumAgeMs: 45 * 60000 }).quantity, q);
  assert.equal(latestAtOrBefore(matches, "2026-10-03T13:00:00Z", { maximumAgeMs: 45 * 60000 }).reason, "stale");
  assert.equal(latestAtOrBefore(matches, "2026-10-03T11:00:00Z").quantity, null);
});
test("the atlas distinguishes four planned rivers from Sacramento's installed data place", async () => {
  const registry = JSON.parse(await readFile(new URL("../../river-pulse/data/registry.json", import.meta.url), "utf8"));
  assert.equal(registry.rivers.length, 6);
  assert.equal(registry.rivers.filter(r => r.status === "planned").length, 4);
  assert.equal(registry.places.find(p => p.river_pack === "sacramento_river").id, "freeport");
  for (const river of registry.rivers.filter(r => r.status === "planned"))
    assert.equal(registry.places.some(p => p.river_pack === river.id), false);
});
