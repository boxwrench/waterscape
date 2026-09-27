// Should the journey offer the live renderer? `?tier=video` or `?tier=live` forces it;
// otherwise WebGPU must hand out an adapter. Frame-time monitoring after entering 3D
// (journey.js) catches devices that have WebGPU but are too slow.
export async function liveCapable(tier = new URLSearchParams(location.search).get("tier")) {
  if (tier === "video") return false;
  if (tier === "live") return true;
  if (!navigator.gpu) return false;
  try {
    return !!(await navigator.gpu.requestAdapter({ powerPreference: "high-performance" }));
  } catch {
    return false;
  }
}
