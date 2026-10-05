// Reuse the complete reservoir engine and its original bundle. No RiverTerrain enters it.
import { loadBody, viewpoint } from "../../renderer/engine/body.js";
import { createWaterscape } from "../../renderer/engine/waterscape.js";
import { QualityGovernor, startingLevel, medianOf, TIER_NAMES } from "../../renderer/engine/quality.js";
import { riverPoseToReservoir } from "./reservoir-context-pose.js";

export function reservoirContext(canvas, { onProgress, onMetrics, onReady, onError }) {
  let body, ws, loading, governor, active = false, playing = !matchMedia("(prefers-reduced-motion: reduce)").matches,
    dirty = false, running = false, raf = null, last = null, desiredPose = null, preset = "golden", failed = false,
    firstFrameMs = null, began = null;
  const samples = [];
  // The kernel's output rows require 256-byte alignment (64 RGBA pixels).
  const renderWidth = () => innerWidth < 600 ? Math.min(governor.current.width, Math.ceil(innerWidth / 64) * 64) : governor.current.width;
  function schedule() {
    if (ws && active && !document.hidden && !failed && !running && raf === null && (dirty || playing))
      raf = requestAnimationFrame(frame);
  }
  function report() {
    const trackedBytes = [...ws.rt.buffers].reduce((sum, buffer) => sum + buffer.size, 0);
    onMetrics(`Hetch Hetchy reservoir · ${ws.width}×${ws.height} · ${TIER_NAMES[ws.state.quality]} · frame ${ws.diag.frames} · animation ${playing ? "running" : "paused"}\n` +
      `Rolling submission + GPU-completion wait median ${samples.length ? medianOf(samples).toFixed(1) : "—"} ms (${samples.length} samples); automatic quality, not GPU-only timing or FPS.\n` +
      `Tracked engine GPU buffers ${(trackedBytes / 1048576).toFixed(2)} MiB; excludes textures, driver, uniforms and native renderer. First ready frame ${firstFrameMs.toFixed(0)} ms (cache-dependent).\n` +
      `Land pass ${ws.diag.land?.shared ? "shared device" : "separate device"} · ${ws.rt.stats.pipelineCompiles} pipelines · ${ws.diag.readbackBytes} render-path readback bytes. One retained reservoir engine; no frames when inactive, hidden or paused.`);
  }
  async function frame(now) {
    raf = null;
    if (!active || document.hidden || failed || !(dirty || playing)) return;
    running = true; dirty = false;
    try {
      const dt = last === null ? 0 : Math.min(0.05, (now - last) / 1000); last = now;
      ws.state.playing = playing;
      const ms = await ws.step(dt);
      firstFrameMs ??= performance.now() - began;
      if (ws.diag.frames > 10) { samples.push(ms); if (samples.length > 120) samples.shift(); }
      if (playing) {
        const quality = governor.sample(ms, performance.now());
        if (quality) { ws.state.quality = quality.tier; ws.resize(renderWidth()); }
      }
      report(); onReady();
    } catch (error) { failed = true; onError(error); }
    finally { running = false; schedule(); }
  }
  async function ensure() {
    loading ??= (async () => {
      began = performance.now();
      body = await loadBody("hetch_hetchy", onProgress);
      ws = await createWaterscape(canvas, body, { onProgress, onError: error => { failed = true; onError(error); }, playing });
      if (ws.diag.land?.error) throw new Error(`Reservoir land pass unavailable: ${ws.diag.land.error}`);
      ws.settings.energy = 0.3; ws.settings.season = 1;
      governor = new QualityGovernor(startingLevel(ws.rt.describe().vendor));
      ws.state.quality = governor.current.tier; ws.resize(renderWidth()); ws.setPreset(preset);
    })();
    await loading;
    const pose = desiredPose.named ? viewpoint(body, desiredPose.named) :
      riverPoseToReservoir(desiredPose.position, desiredPose.target, desiredPose.meta, body.terrain.meta);
    Object.assign(ws.state, pose); samples.length = 0; dirty = true; schedule();
  }
  return {
    async show(pose) {
      desiredPose = pose; active = true; last = null;
      try { await ensure(); } catch (error) { failed = true; onError(error); }
    },
    hide() { active = false; last = null; if (raf !== null) cancelAnimationFrame(raf); raf = null; },
    setPlaying(value) { playing = value; if (value) samples.length = 0; dirty = true; last = null; schedule(); },
    setPreset(value) { preset = value; if (ws) ws.setPreset(value); dirty = true; schedule(); },
    resize() { if (ws) ws.resize(renderWidth()); dirty = true; schedule(); },
    visibility() { last = null; if (document.hidden) { if (raf !== null) cancelAnimationFrame(raf); raf = null; } else schedule(); },
    get playing() { return playing; },
  };
}
