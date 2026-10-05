import test from "node:test";
import assert from "node:assert/strict";
import { flowDisplay } from "../../river-pulse/visual-bindings/flow-status.js";

const quantity = { value: 16500, unit: "ft^3/s", time: { valid_start: "2026-10-05T12:15:00Z" } };

test("a stale reading keeps its last value prominent and is marked muted", () => {
  const shown = flowDisplay({ kind: "stale", headline: "No current reading", detail: "Latest 16,500 ft³/s", quantity });
  assert.equal(shown.value, "16,500 ft³/s");
  assert.equal(shown.muted, true);
  assert.match(shown.note, /^No current reading · last value Oct 5, 12:15 PM UTC$/);
});

test("current and missing readings keep their existing wording", () => {
  const current = flowDisplay({ kind: "current", headline: "119 ft³/s", detail: "Oct 5 · provisional", quantity });
  assert.deepEqual(current, { value: "119 ft³/s", note: "Oct 5 · provisional", muted: false });
  const missing = flowDisplay({ kind: "unavailable", headline: "No observation available", detail: "None eligible", quantity: null });
  assert.equal(missing.value, "No observation available");
  assert.equal(missing.muted, false);
});
