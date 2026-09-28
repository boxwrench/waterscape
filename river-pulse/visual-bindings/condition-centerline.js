// Presentation-only mapping from a seasonal streamflow condition to the river centerline overlay.
// It changes categorical appearance only; it never implies channel width, depth, or velocity.

const STYLES = Object.freeze({
  "all-time-high": { color: 0x5aa8da, opacity: 1 },
  "much-above-normal": { color: 0x6fb8e8, opacity: 0.98 },
  "above-normal": { color: 0x86c9e5, opacity: 0.95 },
  normal: { color: 0x8bd7bd, opacity: 0.92 },
  "below-normal": { color: 0xe2b56f, opacity: 0.95 },
  "much-below-normal": { color: 0xc77d62, opacity: 0.98 },
  "all-time-low": { color: 0xb86b58, opacity: 1 },
  "not-flowing": { color: 0x9e705f, opacity: 0.82 },
  "not-ranked": { color: 0x9eaba6, opacity: 0.62 },
  unavailable: { color: 0x8c9894, opacity: 0.5 },
  checking: { color: 0x72d2df, opacity: 0.72 },
});

export function centerlineConditionStyle(condition) {
  const kind = condition?.kind ?? "unavailable",
    style = STYLES[kind] ?? STYLES.unavailable;
  return Object.freeze({
    kind,
    color: style.color,
    opacity: style.opacity,
    representation: "categorical-centerline-overlay",
    note: "Color represents seasonal discharge condition only; line geometry is a cartographic centerline, not channel width, depth, velocity, or water surface.",
  });
}
