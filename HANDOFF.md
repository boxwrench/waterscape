# Calaveras Reservoir — Project Handoff

## Project status

This repository is now a working local WebGPU/CUDA water study inspired by Calaveras Reservoir near Milpitas, California:

- **Reference coordinates:** 37°28′42.5″N, 121°49′21.5″W
- **Local project:** `C:\Users\wests\OneDrive\Desktop\calaveras-reservoir`
- **Development URL:** `http://localhost:5173`
- **One-click Windows launcher:** `START.bat`
- **Current package version:** `calaveras-reservoir@1.0.0`
- **Status:** Browser build and automated verification pass. Changes have not been committed.

The result is location-inspired rather than geographically exact. It recreates the reservoir bowl, green rolling ridges, oak-like dark clusters, exposed banks and blue-green water from the supplied roadside reference without bundling the Google Maps screenshot.

## Repository lineage

The implementation was based directly on:

- **Primary upstream:** [SamG-Coder/clearwater](https://github.com/SamG-Coder/clearwater)
- **Cloned upstream commit:** `1bbc2ae791ab04418efbdaabd05f18988ccb1aff`
- **Configured Git remote:** `origin https://github.com/SamG-Coder/clearwater`

That repository is a CUDA/WebGPU reimplementation of:

- **Original optical design:** [Aureliengmz/clearwater](https://github.com/Aureliengmz/clearwater)
- **Original revision documented upstream:** `4bc826134321043a25df3c2b6fed16fb7b9241e8`

Both upstream projects use the MIT license. The inherited `LICENSE`, `THIRD_PARTY_NOTICES.md`, seabed asset attribution and vendored `cuda-webshader` license remain in the project. Preserve those notices in any fork or distribution.

## What was implemented

### 1. Bounded reservoir model

The original SamG-Coder scene rendered an effectively infinite water plane with distant headlands embedded in the sky shader. The new version introduces an irregular reservoir boundary.

In `src/clearwater.cu`:

- `reservoirField(x, z)` defines the shoreline. Values below zero are water; values above zero are land.
- Multiple lobes, coves and inlet terms prevent the reservoir from appearing as a simple ellipse.
- `floorDepth(x, z, depth)` now becomes shallow near the shoreline and deeper toward the basin center.
- Water shading only runs where the camera ray intersects the negative side of `reservoirField` before hitting terrain.

The browser mirrors the shoreline function in `app.js` for navigation and verification. The GPU CUDA function remains the rendering authority.

### 2. Calaveras terrain

In `src/clearwater.cu`:

- `terrainHeight(x, z)` produces the basin, near banks, rolling elevation and a raised far ridge.
- `terrainTrace(...)` performs a bounded height-field ray trace for nearby land.
- `terrainNormal(...)` estimates terrain normals from height samples.
- `terrainShade(...)` applies seasonal grass, exposed shoreline, clustered dark vegetation and distance haze.
- The sky shader now contains a world-oriented distant ridge layer. This supplies a stable background and reflected hill color while keeping the expensive terrain trace limited to nearby land.

This is a hybrid representation:

1. Traversable procedural height field for nearby banks.
2. Directional procedural landscape for distant ridges and reflections.

### 3. Reservoir water treatment

The inherited three-scale 256² FFT water system remains intact. The Calaveras adaptation changes its presentation:

- Default wave energy was reduced from ocean-like behavior to reservoir movement.
- The basin defaults to 18 metres in the interface.
- Absorption and distance haze were shifted toward muted blue-green water.
- Strong pebble detail and caustics remain most visible in the Shoreline view.
- The existing click-generated ripple simulation still runs at 120 Hz on a camera-relative 256² field.
- The ordinary frame loop still performs zero GPU-to-CPU readbacks.

### 4. Camera and navigation

`app.js` now defines two named viewpoints:

| Viewpoint | Purpose | Initial camera |
|---|---|---|
| Overlook | Roadside-inspired wide reservoir composition | `(18, 88, 510)`, looking north into the basin |
| Shoreline | Low shallow-water and caustics view | `(-118, 3.4, 338)` |

Additional behavior:

- Reset returns to the currently selected viewpoint.
- WASD, E/Q, arrows, drag, wheel speed and Shift boost remain available.
- A CPU-side terrain-clearance approximation prevents free-flight movement from going below the broad land surface.
- The clearance approximation intentionally omits fine GPU noise, so it is conservative rather than pixel-identical.

### 5. Interface and identity

`index.html` and `style.css` were converted from the Clearwater identity to a Calaveras-specific presentation:

- Calaveras Reservoir name and coordinates
- “Water held by the hills” title
- Overlook and Shoreline buttons
- Spring green and Summer gold seasonal selector
- Reservoir-scale wave energy and depth ranges
- Updated accessibility label and instructions
- Responsive scaling for shorter browser windows
- Footer pointer behavior fixed so it cannot block controls

`START.bat` provides the local Windows launch path. It checks for Node, installs dependencies if missing, opens `http://localhost:5173`, and starts the static server.

### 6. Seasonal rendering

The `season` uniform is passed from `app.js` into `render_water`:

- `0`: March-inspired spring green
- `1`: dry summer gold

The selection affects near terrain and the distant ridge/reflection layer. The native CUDA host currently passes spring (`0`) unconditionally.

### 7. Native compatibility

`Native/main.cu` was updated for the expanded `render_water(..., season)` signature so it remains source-compatible.

The native application was not built locally because CUDA Toolkit/NVCC is not installed. Its legacy control labels still say Clearwater/Open water and should be updated before treating the native host as a finished Calaveras build.

### 8. Verification and evidence

`scripts/verify.mjs` was updated to cover the new application:

- Compiles all 20 CUDA kernels through the vendored CUDA frontend
- Confirms zero readbacks during ordinary rendering
- Checks basin center, overlook and shoreline classification
- Exercises Overlook and Shoreline viewpoints
- Generates and detects a click ripple
- Validates FFT and round-trip error
- Validates caustic energy and diffraction-kernel normalization
- Checks finite wave/HDR/glare buffers
- Exercises Spring/Summer, resize, diagnostics, lens glare, pause, reset and PNG export
- Checks browser console, page, network and WebGPU errors

Latest successful run:

| Check | Result |
|---|---|
| CUDA entries | 20 compiled |
| FFT maximum error | `2.8253568e-5` |
| FFT round-trip error | `7.4803829e-6` |
| Caustic RGB mean | approximately `0.99223` |
| PSF energy | approximately `1.0` per channel |
| Normal-frame readback | `0` bytes |
| Browser/WebGPU errors | none |
| Balanced frame time in automated run | approximately `35.6 ms` |

The automated browser selected the Intel Xe-LPG integrated adapter rather than the RTX 5070 Ti. For higher frame rates, assign Edge or Chrome to the high-performance NVIDIA GPU in Windows Graphics settings or use the Performance resolution preset.

Evidence:

- `previews/verification.json`
- `previews/calaveras-ui.png`
- `previews/calaveras-overlook.png`
- `previews/calaveras-shoreline.png`
- `previews/calaveras-late-water.png`

The inherited `previews/clearwater-ui.png` and `previews/clearwater.png` were overwritten during early visual checkpoints. They are no longer canonical; use the `calaveras-*` files above. They can be restored from upstream or deleted in a cleanup commit.

## Build and verification commands

Install and run:

```powershell
npm ci
npm start
```

Compile-check and build:

```powershell
npm run check
npm run build
```

For browser verification, start a second server:

```powershell
$env:PORT='5186'
npm start
```

Then, in another terminal:

```powershell
npm test
```

## Important architecture notes

- `src/clearwater.cu` is shared by the WebGPU browser host and native CUDA host.
- Adding or changing a CUDA kernel parameter requires updating both `app.js` and `Native/main.cu`.
- The browser discovers kernels by scanning for `__global__ void` declarations, then compiles every entry.
- The build script follows the JavaScript module graph and rejects external browser imports.
- Keep the runtime self-contained; the current build needs no CDN.
- The three FFT wave fields remain periodic even though the visible reservoir is bounded.
- Caustics are computed at one mean depth and then used in variable-depth shading; this is visually useful but not physically exact across the whole basin.
- The distant ridge is directional shader scenery, not traversable geometry.
- The user-supplied Google Maps screenshot is a design reference only and is intentionally not copied into the repository.

## Known limitations

1. **Not geographically exact.** The shoreline and elevations are artist-authored procedural approximations.
2. **Distant hills are stylized.** They read clearly as Calaveras-like rolling terrain but do not reproduce the real skyline.
3. **Vegetation is shading, not geometry.** Oak clusters do not have individual trunks or canopies.
4. **Near-shore water is unusually clear.** The Shoreline view preserves Clearwater's caustics for visual impact; real reservoir turbidity would reduce floor visibility.
5. **Hybrid-GPU selection.** Automated Edge testing used Intel graphics, reducing Balanced mode to roughly 28 fps during the recorded run.
6. **Native host incomplete.** It compiles conceptually against the new signature, but its UI, camera presets and smoke captures still reflect the upstream application and were not rebuilt locally.
7. **Uncommitted working tree.** No project fork, new Git remote or commit has been created.
8. **Legacy preview files.** Two upstream preview images were overwritten during development and should be cleaned up before publishing.

## Roadmap

### Phase 0 — Preserve the work

Priority: immediate.

- Create a personal GitHub fork or new repository for Calaveras Reservoir.
- Change `origin` away from `SamG-Coder/clearwater` so this work cannot accidentally target upstream.
- Decide whether to retain upstream history or start a clean project history with explicit provenance.
- Restore or remove the two legacy `clearwater-*` preview images.
- Commit the current passing baseline and tag it `v0.1.0-procedural`.

Exit condition: clean working tree, owned remote, reproducible baseline.

### Phase 1 — Geographic terrain fidelity

**Status (2026-09-26): done.** Terrain is USGS 3DEP lidar (`scripts/build-terrain.py` → `assets/calaveras-terrain.*`), 1:1 scale, water outline from the lidar's flattened surface (≈224 m), viewpoints chosen by a line-of-sight search, elevation/lat-lon readouts in the UI. Remaining: far field beyond the ~9 × 11 km crop is still painted; the procedural terrain was replaced rather than kept as a mode (it remains in Git history); the native host's terrain loader is written but uncompiled.

Priority: highest visual improvement.

- Obtain a legally reusable elevation source for the reservoir area, such as public-domain USGS elevation data.
- Define a real-world local coordinate transform around 37.478472, -121.822639.
- Convert the elevation crop into a compact height texture or generated source asset.
- Add a reservoir shoreline/water mask based on authoritative or manually traced boundary data.
- Match the supplied roadside viewpoint against recognizable ridge peaks and shoreline bends.
- Preserve the procedural terrain as a fallback and comparison mode.

Exit condition: the overlook silhouette and water boundary are recognizably Calaveras rather than generally Calaveras-inspired.

### Phase 2 — Landscape quality

Priority: high.

- Replace the single distant ridge layer with two or three depth-separated ridges.
- Add slope-, aspect- and drainage-aware vegetation placement.
- Introduce procedural oak canopy billboards or low-cost impostors near the camera.
- Add dry brush, sage and small exposed rock variation to the foreground.
- Improve shoreline terraces so low-water rings are visible from the overlook.
- Add atmospheric perspective that becomes cooler and softer across successive ridges.

Exit condition: no obvious “painted ridge” appearance in the main overlook screenshot.

### Phase 3 — Reservoir water realism

Priority: high.

- Reduce deep-water floor visibility with depth-dependent turbidity.
- Restrict strong caustics to genuinely shallow zones.
- Add a water-level control that moves the shoreline and exposes/reclaims bank terraces.
- Rebalance the long-wave cascade for fetch-limited reservoir waves.
- Add wind-direction control and reflect it in spectral directionality.
- Evaluate simplified terrain reflection for nearby banks without restoring the expensive full reflection trace.

Exit condition: Overlook water reads as a reservoir while Shoreline remains visually rich.

### Phase 4 — Performance and hardware routing

Priority: medium-high.

- Confirm Chrome/Edge use the RTX 5070 Ti and document Windows high-performance GPU setup.
- Profile `terrainTrace`, caustics and post-processing independently with timestamp queries.
- Add adaptive terrain step count by resolution and camera altitude.
- Consider half-resolution terrain/reflection evaluation with edge-aware reconstruction.
- Add a true Auto quality mode using measured GPU frame time.
- Define performance budgets for Intel integrated, RTX laptop and desktop RTX classes.

Suggested targets:

| Hardware | Preset | Target |
|---|---|---|
| Intel Xe-LPG | Performance | 30–45 fps |
| RTX 5070 Ti Laptop | Balanced | 60 fps |
| RTX desktop class | High | 60 fps |

### Phase 5 — Experience and presentation

Priority: medium.

- Add named camera tours: Roadside, Dam, North Ridge and Waterline.
- Add a restrained morning/golden-hour lighting control.
- Save user settings in `localStorage`.
- Add a shareable URL state for camera, time, season and water level.
- Add keyboard-help and reduced-motion overlays.
- Make the mobile/touch interface more compact.
- Add a clean screenshot mode that hides every UI element automatically.

### Phase 6 — Native Windows finish

Priority: optional.

- Install CUDA Toolkit 13.x and verify `nvcc` against the installed driver.
- Rename native windows, controls and export filenames for Calaveras.
- Port Overlook/Shoreline cameras, seasonal control and reservoir-scale sliders.
- Add CPU terrain-clearance parity or an explicit free-camera warning.
- Update native smoke screenshots and `native-smoke.json`.
- Verify CUDA–D3D11 interop on the RTX 5070 Ti Laptop GPU.

### Phase 7 — Publish

Priority: after visual fidelity and cleanup.

- Replace upstream Pages metadata with the new owned repository.
- Add a short project description, hero image and controls GIF/video.
- Run `npm run check`, `npm run build` and `npm test` on the release commit.
- Confirm all licenses and third-party notices ship in `dist/`.
- Publish the static `dist/` directory over HTTPS.

## Recommended next task

Start with **Phase 0**, then do one focused Phase 1 spike: acquire a small elevation crop, render it as a diagnostic grayscale height field, and compare its skyline from the supplied coordinates against `previews/calaveras-overlook.png`. Do not replace the procedural terrain until the coordinate transform and camera alignment are verified.
