// Lighting presets shared by every reservoir: hand-tuned rather than a free time-of-day, so
// each can be made to look right. Scene axes: +x east, +y up, +z south. Radiances are in the
// renderer's HDR units (today's sun was (2.0, 1.83, 1.55), sky fill (.36, .46, .62)).
// skyGain scales the Preetham sky (whose raw brightness falls ~10x from midday to a low sun)
// to those units; see sky() in water.cu.
import { landLook } from "./look.js";
const unit = (v) => {
  const l = Math.hypot(...v);
  return v.map((x) => x / l);
};

export const PRESET_NAMES = ["morning", "midday", "golden"];

export const PRESETS = {
  morning: {
    label: "Morning",
    sun: unit([0.93, 0.28, 0.24]),
    sunColor: [2.2, 1.8, 1.35],
    fill: [0.34, 0.42, 0.56],
    skyGain: 1.0,
    turbidity: 3, rayleigh: 1.2, mieCoefficient: 0.004, mieG: 0.82,
    cloudCoverage: 0.42, cloudDensity: 0.4, cloudScale: 0.0002, cloudSpeed: 0.00002,
    haze: [0.72, 0.72, 0.74], hazeDensity: 0.00024,
    exposure: 0.85,
  },
  midday: {
    label: "Midday",
    sun: unit([0.05, 0.91, 0.41]),
    sunColor: [1.75, 1.68, 1.6],
    fill: [0.36, 0.46, 0.62],
    skyGain: 0.3,
    turbidity: 2.5, rayleigh: 1.0, mieCoefficient: 0.004, mieG: 0.8,
    cloudCoverage: 0.48, cloudDensity: 0.45, cloudScale: 0.0002, cloudSpeed: 0.00002,
    haze: [0.6, 0.7, 0.82], hazeDensity: 0.00016,
    exposure: 0.62,
  },
  golden: {
    label: "Golden hour",
    sun: unit([-0.95, 0.17, 0.26]),
    sunColor: [2.4, 1.55, 0.85],
    fill: [0.3, 0.34, 0.44],
    skyGain: 2.0,
    turbidity: 4, rayleigh: 1.4, mieCoefficient: 0.005, mieG: 0.85,
    cloudCoverage: 0.52, cloudDensity: 0.5, cloudScale: 0.0002, cloudSpeed: 0.00002,
    haze: [0.74, 0.71, 0.68], hazeDensity: 0.00017,
    exposure: 0.85,
  },
};

// Eight float4s, read by the shader as `const float4 *light` (see the comment above sky()):
// six for the light, two for the water body's land look (look.js).
export function presetBuffer(p, look = landLook(null)) {
  return new Float32Array([
    ...p.sun, p.cloudCoverage,
    ...p.sunColor, p.cloudDensity,
    ...p.fill, p.skyGain,
    p.turbidity, p.rayleigh, p.mieCoefficient, p.mieG,
    ...p.haze, p.hazeDensity,
    p.cloudScale, p.cloudSpeed, p.exposure, 0,
    ...look.summer.ground[0], look.cover,
    ...look.summer.ground[1], 0,
  ]);
}

// The requested preset if the bundle offers it, else the bundle's default.
export function choosePreset(requested, profile) {
  const offered = profile?.presets ?? PRESET_NAMES;
  if (requested && offered.includes(requested) && PRESETS[requested]) return requested;
  return profile?.defaultPreset ?? "golden";
}
