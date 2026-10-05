// Presentation controls and evidence inspection remain independent of GPU startup.
const inspector = document.querySelector("#inspector"),
  toggle = document.querySelector("#inspect-toggle");
function inspect(open) {
  inspector.hidden = !open;
  toggle.setAttribute("aria-expanded", String(open));
  if (open) document.querySelector("#inspect-close").focus();
  else toggle.focus();
}
toggle.addEventListener("click", () => inspect(inspector.hidden));
document
  .querySelector("#inspect-close")
  .addEventListener("click", () => inspect(false));
addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !inspector.hidden) inspect(false);
});
document.querySelector("#focus-view").addEventListener("click", (event) => {
  const active = document.body.classList.toggle("focus-view");
  event.currentTarget.setAttribute("aria-pressed", String(active));
  event.currentTarget.textContent = active ? "Show data" : "Explore";
});
document
  .querySelector("#timeline-toggle")
  .addEventListener("click", (event) => {
    const expanded = document.body.classList.toggle("timeline-open");
    event.currentTarget.setAttribute("aria-expanded", String(expanded));
  });
for (const id of ["river-layer", "tint-layer"]) {
  document.querySelector(`#${id}`).addEventListener("click", (event) => {
    const enabled = event.currentTarget.getAttribute("aria-pressed") !== "true";
    event.currentTarget.setAttribute("aria-pressed", String(enabled));
    dispatchEvent(
      new CustomEvent("river-pulse-layer-change", { detail: { id, enabled } }),
    );
  });
}

function evidence(state) {
  const target = document.querySelector("#observation-evidence"),
    record = document.querySelector("#observation-record"),
    q = state?.selected_quantities?.[0],
    selection = state?.selection_results?.[0];
  target.replaceChildren();
  function row(label, text, url) {
    const dt = document.createElement("dt"),
      dd = document.createElement("dd");
    dt.textContent = label;
    if (url) {
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = text;
      dd.append(a);
    } else dd.textContent = text;
    target.append(dt, dd);
  }
  row("Status", selection?.reason?.replaceAll("_", " ") ?? "Waiting for data");
  row("Value", q ? `${q.value} ${q.unit}` : "No eligible observation");
  row("Valid time", q?.time.valid_start ?? "—");
  if (q?.time.valid_end !== q?.time.valid_start)
    row("Interval end", q.time.valid_end);
  row("Evidence", q?.evidence_type?.replaceAll("_", " ") ?? "—");
  row("Quality", q?.source_approval ?? "—");
  row("Method", q?.method?.method_id?.replaceAll("_", " ") ?? "—");
  row(
    "Source",
    q?.provenance?.agency ?? "USGS",
    q
      ? "https://waterdata.usgs.gov/monitoring-location/" +
          encodeURIComponent(q.feature_id) +
          "/"
      : null,
  );
  row("Retrieved", q?.provenance?.retrieval_time ?? "Unknown");
  row("Availability", q?.time.as_of_time ?? "Not established by the source");
  row("Policy", selection?.policy_id ?? "—");
  record.textContent = JSON.stringify(
    { request: state?.request, selection, quantity: q ?? null },
    null,
    2,
  );
}
addEventListener("river-pulse-state-change", (event) =>
  evidence(event.detail.state),
);
if (window.riverPulseState) evidence(window.riverPulseState);
