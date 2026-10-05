import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { riverPoseToReservoir } from "../../river-pulse/scene-kit/reservoir-context-pose.js";

const json = (file) => JSON.parse(readFileSync(new URL(file, import.meta.url))),
  riverMeta = json("../../river-pulse/rivers/tuolumne_river/scenes/start/poopenaut_valley/data/terrain.json"),
  reservoirMeta = json("../../data/hetch_hetchy/terrain.json"),
  close = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance,
    `${actual} differs from ${expected} by more than ${tolerance}`);

test("Tuolumne camera position maps to Hetch local UTM and water-level coordinates", () => {
  const river = { ...riverMeta, sceneVerticalOffset: 1000 },
    position = [2500, 180, -1300], // absolute NAVD88 elevation 1180 m
    target = [3800, 165, -1900], // absolute NAVD88 elevation 1165 m
    input = structuredClone({ river, reservoirMeta, position, target }),
    pose = riverPoseToReservoir(position, target, river, reservoirMeta);

  close(pose.x, riverMeta.originUTM[0] + position[0] - reservoirMeta.originUTM[0]);
  close(pose.y, 1180 - reservoirMeta.waterLevel);
  close(pose.z, reservoirMeta.originUTM[1] - riverMeta.originUTM[1] + position[2]);
  assert.deepEqual({ river, reservoirMeta, position, target }, input, "conversion leaves source metadata and coordinates unchanged");
});

test("translated yaw and pitch reconstruct the original camera direction", () => {
  const position = [2500, 180, -1300], target = [3800, 165, -1900],
    pose = riverPoseToReservoir(position, target, { ...riverMeta, sceneVerticalOffset: 1000 }, reservoirMeta),
    absoluteY = (localY) => localY + 1000 - reservoirMeta.waterLevel,
    dx = target[0] - position[0], dy = absoluteY(target[1]) - absoluteY(position[1]),
    dz = target[2] - position[2], length = Math.hypot(dx, dy, dz),
    direction = [Math.sin(pose.yaw) * Math.cos(pose.pitch), Math.sin(pose.pitch), -Math.cos(pose.yaw) * Math.cos(pose.pitch)];

  close(direction[0], dx / length);
  close(direction[1], dy / length);
  close(direction[2], dz / length);
});

test("rejects incompatible horizontal or vertical reference systems", () => {
  const position = [2500, 1180, -1300], target = [3800, 1165, -1900];
  for (const [key, value] of [["crs", "EPSG:26911"], ["utmZone", 10], ["verticalDatum", "NAVD88 (GEOID03)"]]) {
    assert.throws(
      () => riverPoseToReservoir(position, target, riverMeta, { ...reservoirMeta, [key]: value }),
      /share CRS, UTM zone and vertical datum/,
      `rejects mismatched ${key}`,
    );
  }
});

test("rejects nonfinite and coincident camera coordinates", () => {
  const position = [2500, 1180, -1300], target = [3800, 1165, -1900];
  for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.throws(() => riverPoseToReservoir([bad, ...position.slice(1)], target, riverMeta, reservoirMeta), /finite metres/);
    assert.throws(() => riverPoseToReservoir(position, [target[0], bad, target[2]], riverMeta, reservoirMeta), /finite metres/);
  }
  assert.throws(() => riverPoseToReservoir(position, [...position], riverMeta, reservoirMeta), /distinct target/);
});
