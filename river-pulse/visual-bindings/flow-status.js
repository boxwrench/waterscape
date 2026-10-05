// Presentation-only mapping for the compact observed-flow status UI.
// It consumes RiverState but never mutates or reclassifies scientific quantities.

function unit(unitValue) {
  if (unitValue === "ft^3/s") return "ft³/s";
  return unitValue ?? "";
}

function number(value) {
  return Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function time(iso) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(d);
}

export function observedFlowStatus(state, featureId) {
  const selected = state.selected_quantities.find(
    (q) => q.feature_id === featureId && q.phenomenon === "discharge",
  );
  if (selected)
    return {
      kind: "current",
      badge: "Current",
      headline: `${number(selected.value)} ${unit(selected.unit)}`,
      detail: `${time(selected.time.valid_start)} · ${selected.source_approval}`,
      quantity: selected,
      representation: "direct",
    };

  const missing = state.missing_quantities.find(
    (m) => m.feature_id === featureId && m.phenomenon === "discharge",
  );
  if (missing?.reason === "stale" && missing.stale_quantity) {
    const q = missing.stale_quantity;
    return {
      kind: "stale",
      badge: "Stale",
      headline: "No current reading",
      detail: `Latest ${number(q.value)} ${unit(q.unit)} · ${time(q.time.valid_start)}`,
      quantity: q,
      representation: "direct-with-staleness",
    };
  }

  return {
    kind: "unavailable",
    badge: "Missing",
    headline: "No observation available",
    detail: "No eligible discharge observation for the selected time",
    quantity: null,
    representation: "missing",
  };
}

// Presentation-only wording for cards: a stale reading keeps its last value prominent and is
// marked muted, instead of replacing the number with "No current reading".
export function flowDisplay(status) {
  const q = status.quantity;
  if (status.kind === "stale" && q)
    return {
      value: `${number(q.value)} ${unit(q.unit)}`,
      note: `No current reading · last value ${time(q.time.valid_start)}`,
      muted: true,
    };
  return { value: status.headline, note: status.detail, muted: false };
}
