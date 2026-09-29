// Presentation mapping for exact daily values. Input quantities remain unchanged.

export function dailyHydrograph(quantities, { width = 320, height = 86, padding = 7 } = {}) {
  const values = quantities
    .filter((q) => q.availability === "present" && q.phenomenon === "discharge" && Number.isFinite(Number(q.value)))
    .map((q) => ({ quantity: q, time: Date.parse(q.time.valid_start), value: Number(q.value) }))
    .filter((p) => Number.isFinite(p.time))
    .sort((a, b) => a.time - b.time || String(a.quantity.quantity_id).localeCompare(String(b.quantity.quantity_id)));

  if (!values.length)
    return { kind: "empty", points: [], path: "", min: null, max: null, first_time: null, last_time: null };

  const min = Math.min(...values.map((p) => p.value)),
    max = Math.max(...values.map((p) => p.value)),
    firstTime = values[0].time,
    lastTime = values.at(-1).time,
    timeSpan = Math.max(1, lastTime - firstTime),
    valueSpan = Math.max(1e-9, max - min),
    innerWidth = Math.max(1, width - 2 * padding),
    innerHeight = Math.max(1, height - 2 * padding),
    points = values.map((p) => ({
      x: padding + ((p.time - firstTime) / timeSpan) * innerWidth,
      y: padding + (1 - (p.value - min) / valueSpan) * innerHeight,
      value: p.value,
      time: p.quantity.time.valid_start,
      quantity: p.quantity,
    })),
    path = points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

  return {
    kind: "series",
    points,
    path,
    min,
    max,
    first_time: values[0].quantity.time.valid_start,
    last_time: values.at(-1).quantity.time.valid_start,
    evidence_type: "derived_statistic",
    representation: "direct-series",
  };
}
