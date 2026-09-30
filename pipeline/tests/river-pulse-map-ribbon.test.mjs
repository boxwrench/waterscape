import test from "node:test";
import assert from "node:assert/strict";
import { MAP_RIBBON_WIDTH, mapRibbonBinding } from "../../river-pulse/visual-bindings/map-flow.js";
import { buildMapRibbonSkeleton, mapRibbonPositions } from "../../river-pulse/renderer/map-ribbon-geometry.js";

const state = (value) => ({ selected_quantities: [{ phenomenon: "discharge",
  availability: "present", value, quantity_id: `test-${value}` }] });
const history = (...values) => ({ kind: "series", points: values.map((value) => ({ value })) });

test("Map ribbon width increases monotonically with selected discharge on a fixed history scale", () => {
  const graph = history(0, 40, 100, 1000), original = JSON.stringify(graph),
    widths = [0, 20, 40, 100, 500, 1000, 2000].map((value) => mapRibbonBinding(state(value), graph).width);
  assert.equal(widths[0], MAP_RIBBON_WIDTH.minimum);
  assert.equal(widths.at(-1), MAP_RIBBON_WIDTH.maximum);
  for (let i = 1; i < widths.length; i++) assert.ok(widths[i] >= widths[i - 1]);
  assert.equal(JSON.stringify(graph), original, "The binding must not change scientific history");
  assert.equal(mapRibbonBinding(state(100), graph).source_quantity_id, "test-100");
});

test("Missing and zero map flow stop motion without borrowing stale discharge", () => {
  const missing = { selected_quantities: [], missing_quantities: [{ stale_quantity: { value: 100 } }] },
    unknown = mapRibbonBinding(missing, history(10, 100));
  assert.equal(unknown.moving, false);
  assert.equal(unknown.availability, "missing");
  assert.equal(unknown.width, MAP_RIBBON_WIDTH.fallback);
  for (const value of [null, NaN, -1, Infinity])
    assert.equal(mapRibbonBinding(state(value), history(10, 100)).availability, "missing");
  const zero = mapRibbonBinding(state(0), history(10, 100));
  assert.equal(zero.availability, "present");
  assert.equal(zero.moving, false);
  assert.equal(zero.width, MAP_RIBBON_WIDTH.minimum);
});

test("Constant, zero-only and unavailable history have explicit finite map scales", () => {
  assert.equal(mapRibbonBinding(state(100), history(100, 100)).width, 42);
  assert.equal(mapRibbonBinding(state(200), history(100, 100)).width, MAP_RIBBON_WIDTH.maximum);
  assert.equal(mapRibbonBinding(state(0), history(0, 0)).width, MAP_RIBBON_WIDTH.minimum);
  assert.equal(mapRibbonBinding(state(100), history(0, 0)).width, MAP_RIBBON_WIDTH.maximum);
  const noHistory = mapRibbonBinding(state(100), { kind: "empty", points: [] });
  assert.equal(noHistory.width, MAP_RIBBON_WIDTH.fallback);
  assert.equal(noHistory.moving, true);
  assert.equal(noHistory.domain, "no-history");
});

test("Map strip joins bends, preserves source points and drapes expanded width to terrain", () => {
  const doc = { features: [{ name: "Russian River", lines: [[[0, 0], [48, 0], [48, 48]]] },
    { name: "Tributary", lines: [[[100, 100], [200, 200]]] }] }, source = JSON.stringify(doc),
    terrain = { ground: (x, z) => x * 0.1 + z * 0.2 }, skeleton = buildMapRibbonSkeleton(doc),
    narrow = mapRibbonPositions(skeleton, terrain, 18), wide = mapRibbonPositions(skeleton, terrain, 66);
  assert.equal(skeleton.sites.length, 9);
  assert.equal(skeleton.indices.length, 8 * 6);
  for (let i = 0; i < skeleton.sites.length; i++) {
    const k = i * 6;
    assert.ok(Math.abs(Math.hypot(wide[k] - wide[k + 3], wide[k + 2] - wide[k + 5]) - 66) < 0.001);
    assert.ok(Math.abs(wide[k + 1] - terrain.ground(wide[k], wide[k + 2]) - 4.2) < 0.001);
    assert.ok(Math.abs((wide[k] + wide[k + 3]) / 2 - skeleton.sites[i].x) < 0.001);
    assert.ok(Math.abs((wide[k + 2] + wide[k + 5]) / 2 - skeleton.sites[i].z) < 0.001);
  }
  assert.notDeepEqual(narrow, wide);
  assert.equal(JSON.stringify(doc), source);
});
