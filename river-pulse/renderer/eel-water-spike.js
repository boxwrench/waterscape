// Experimental adapter: replace/remove after the visual parity spike decision.
import { createAuthoredWater } from "./authored-water.js";
import { buildEelOpticalGrid } from "./eel-water-depth.js";

export function createEelWaterSpike(terrain, geometry, field) {
  const positions = geometry.attributes.position.array, indices = geometry.index.array,
    grid = buildEelOpticalGrid(terrain, field, positions, indices),
    water = createAuthoredWater(null, terrain, null, grid, {
      sunDirection: [-1600, 2300, 700], filterProceduralBed: true, shoreReflectionRange: [0.02, 2.6],
    });
  // Share the actual BufferAttributes too, avoiding duplicate GPU geometry buffers.
  water.mesh.geometry.setAttribute("position", geometry.attributes.position);
  water.mesh.geometry.setIndex(geometry.index);
  water.mesh.material.polygonOffset = true;
  water.mesh.material.polygonOffsetFactor = -1;
  water.mesh.material.polygonOffsetUnits = -1;
  water.mesh.name = "Eel experimental reused water optics";
  water.mesh.userData.bindingClass = "derived";
  water.mesh.userData.inputProvenance = "illustrative shore-distance depth and modeled bed";
  water.mesh.userData.surveyed = false;
  water.mesh.userData.gaugeDriven = false;
  let low = Infinity, high = -Infinity;
  for (let i = 1; i < positions.length; i += 3) {
    low = Math.min(low, positions[i]); high = Math.max(high, positions[i]);
  }
  return { ...water, depthBytes: grid.depths.byteLength, heightRange: [low, high] };
}
