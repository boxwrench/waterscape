import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMapRibbonSkeleton } from "../../river-pulse/renderer/map-ribbon-geometry.js";
import { reachDynamics } from "../../river-pulse/visual-bindings/map-flow-dynamics.js";

// A straight run west, then a bend to the south, on terrain that falls toward the west end.
const line = [];
for (let x = 1000; x >= 0; x -= 20) line.push([x, 0]);
for (let a = 0; a <= 90; a += 5) line.push([-300 * Math.sin(a * Math.PI / 180), 300 * (1 - Math.cos(a * Math.PI / 180))]);
const doc = { features: [{ name: "Russian River", lines: [line] }] };

test("slope is higher where the terrain falls faster along the flow", () => {
  const sk = buildMapRibbonSkeleton(doc),
    { slope } = reachDynamics(sk, (x) => (x > 500 ? x * 0.002 : 1 + x * 0.02)),
    upper = slope[Math.floor(sk.sites.findIndex((p) => p.x < 800) )], lower = slope[sk.sites.findIndex((p) => p.x < 300)];
  assert.ok(lower > upper, `lower ${lower} should exceed upper ${upper}`);
  assert.ok(slope.every((v) => v >= 0 && v <= 1));
});

test("bend is near zero on a straight run and strong, with one sign, on the curve", () => {
  const sk = buildMapRibbonSkeleton(doc), { bend } = reachDynamics(sk, () => 0),
    straight = bend[sk.sites.findIndex((p) => p.x < 600)],
    curve = bend[sk.sites.length - 6];
  assert.ok(Math.abs(straight) < 0.1, `straight ${straight}`);
  assert.ok(Math.abs(curve) > 0.8, `curve ${curve}`);
  assert.ok(bend.every((v) => v >= -1 && v <= 1));
});

test("lines are bounded so smoothing does not cross separate polylines", () => {
  const sk = buildMapRibbonSkeleton({ features: [{ name: "Russian River", lines: [line, line] }] });
  assert.equal(sk.lines.length, 2);
  assert.equal(sk.lines[1].first, sk.lines[0].count);
});
