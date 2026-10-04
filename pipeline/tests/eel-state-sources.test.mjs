import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { watershedMap } from "../../river-pulse/renderer/eel-state-layout.js";

const root = new URL("../../river-pulse/data/eel_river/places/scotia_bluffs/", import.meta.url),
  json = async file => JSON.parse(await readFile(new URL(file, root), "utf8"));

function contains(feature, [x, y]) {
  const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  return polygons.some(rings => {
    let inside = false;
    for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, ay] = ring[i], [bx, by] = ring[j];
      if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
    }
    return inside;
  });
}

test("state watershed context is source-backed and contains the Scotia station", async () => {
  const [unit, area, source, metadata] = await Promise.all([
    "calwater-unit.geojson", "calwater-area.geojson", "source.json", "calwater-service.json"].map(json)),
    anchor = [source.anchor[1], source.anchor[0]];
  for (const data of [unit, area]) {
    assert.equal(data.features.length, 1);
    assert.ok(contains(data.features[0], anchor));
    const query = new URL(data.source);
    assert.equal(query.hostname, "gispublic.waterboards.ca.gov");
    assert.equal(query.searchParams.get("outSR"), "4326");
    assert.ok(data.retrieval_time);
  }
  assert.match(metadata.metadata.copyrightText, /California Department of Water Resources/);
  const map = watershedMap(unit, area, source);
  assert.equal(map.unitName, "EEL RIVER"); assert.equal(map.areaName, "Lower Eel River");
  assert.equal(map.unitCode, "1111"); assert.equal(map.areaCode, "11111");
  assert.ok(map.anchor.every(Number.isFinite));
  for (const path of [map.unitPath, map.areaPath, map.extentPath]) assert.ok(!/NaN|Infinity/.test(path));
  // Increasing latitude must go up in the map; preserve the upstream/downstream relationship.
  const tiny = { features: [{ properties: unit.features[0].properties, geometry: {
    type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] } }] },
    south = watershedMap(tiny, area, { bbox: [0, 0, 1, 1], anchor: [0.2, 0.5] }),
    north = watershedMap(tiny, area, { bbox: [0, 0, 1, 1], anchor: [0.8, 0.5] });
  assert.ok(north.anchor[1] < south.anchor[1]);
});

test("1 m reference coverage is partial and cannot be substituted for the rendered grid", async () => {
  const [terrain, source, footprint, dwr] = await Promise.all([
    "terrain.json", "source.json", "lidar-reference-footprint.geojson", "dwr-dem-coverage.json"].map(json)),
    inside = point => (footprint.type === "FeatureCollection" ? footprint.features : [footprint]).some(feature => contains(feature, point)),
    [w, s, e, n] = source.bbox;
  assert.ok(terrain.cell.every(cell => cell > 14 && cell < 14.1));
  assert.equal(inside([source.anchor[1], source.anchor[0]]), true);
  assert.equal([[w, s], [e, s], [e, n], [w, n]].every(inside), false);
  assert.equal(inside([-124.08695183, 40.50332634]), false, "bluffs review target is outside this survey");
  assert.equal(dwr.response.features.length, 0, "only the checked DWR project is excluded");
});
