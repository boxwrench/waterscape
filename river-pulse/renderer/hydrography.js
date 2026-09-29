// Render USGS 3DHP flowlines as symbolic, terrain-draped context.
// The line width is presentation only: it does not encode measured channel width or depth.
import * as THREE from "../../vendor/three/three.webgpu.js";

export const HYDROGRAPHY_SCHEMA = "river-pulse-hydrography-0.1";

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

export async function loadHydrography(url) {
  const document = await fetchJson(url);
  if (document.schemaVersion !== HYDROGRAPHY_SCHEMA)
    throw new Error(
      `Unsupported hydrography schema: ${document.schemaVersion}`,
    );
  if (!Array.isArray(document.features))
    throw new Error("Hydrography bundle lacks features array");
  return document;
}

function lineSegments(features, terrain, elevationOffset) {
  const values = [];
  for (const feature of features)
    for (const line of feature.lines ?? [])
      for (let i = 1; i < line.length; i++) {
        const [ax, az] = line[i - 1],
          [bx, bz] = line[i];
        values.push(
          ax,
          terrain.ground(ax, az) + elevationOffset,
          az,
          bx,
          terrain.ground(bx, bz) + elevationOffset,
          bz,
        );
      }
  return new Float32Array(values);
}

function layer(features, terrain, color, opacity, elevationOffset) {
  const positions = lineSegments(features, terrain, elevationOffset),
    geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = true;
  return lines;
}

// Constant-width cartographic stroke. Width is an authored display choice, never
// channel geometry. Each segment follows sampled terrain rather than a water level.
function mainstemStroke(features, terrain) {
  const segments = lineSegments(features, terrain, 3.5),
    positions = [];
  for (let i = 0; i < segments.length; i += 6) {
    const [ax, ay, az, bx, by, bz] = segments.slice(i, i + 6),
      length = Math.hypot(bx - ax, bz - az);
    if (!length) continue;
    const nx = (-(bz - az) / length) * 3,
      nz = ((bx - ax) / length) * 3,
      a = [ax + nx, ay, az + nz],
      b = [ax - nx, ay, az - nz],
      c = [bx + nx, by, bz + nz],
      d = [bx - nx, by, bz - nz];
    positions.push(...a, ...b, ...c, ...b, ...d, ...c);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  return new THREE.Mesh(
    geometry,
    new THREE.MeshBasicNodeMaterial({
      color: 0x8bd7bd,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    }),
  );
}

export function createHydrographyLayer(document, terrain) {
  const group = new THREE.Group(),
    mainstem = document.features.filter(
      (feature) => feature.name === "Russian River",
    ),
    context = document.features.filter(
      (feature) => feature.name !== "Russian River",
    ),
    contextLines = layer(context, terrain, 0x91adc1, 0.25, 1.3),
    mainstemLines = mainstemStroke(mainstem, terrain);

  contextLines.name = "3DHP context flowlines";
  mainstemLines.name = "3DHP Russian River flowline";
  group.add(contextLines, mainstemLines);
  group.userData = {
    source: document.source,
    schemaVersion: document.schemaVersion,
    representation:
      "symbolic centerline overlay; line width is not measured channel width",
    featureCount: document.features.length,
    mainstemFeatureCount: mainstem.length,
  };
  return group;
}
