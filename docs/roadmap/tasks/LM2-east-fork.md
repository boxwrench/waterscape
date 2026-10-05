# LM2: Author East Fork and connect the river map

Continue LM1's Lake Mendocino start place with the River Pulse view directly below Coyote
Valley Dam. Work from current main in an isolated branch; preserve the unpublished reservoir
structure work on task/LM1 and the active Hacienda/Jenner worktrees.

## Scope

1. Fetch and inspect dam/outlet photographs. Model the broad earthfill face, crest road,
   concrete outlet/stilling channel, riprap and dry oak woodland as photo-informed Setting.
   Reuse local rock, pebble, grass and oak assets. Keep the camera on the actual modeled bank.
2. Add an East Fork place manifest and authored entry with bounded shoreline exploration,
   animated reflective river water, pause/reduced-motion controls and evidence disclosure.
   The retired local USGS station must not imply live observations. Link its source record;
   do not invent stage, flow or storage, or substitute a downstream mainstem gauge.
3. Add a compact geographic river overview with selectable East Fork, Hacienda and Jenner
   pins, accessible from the existing Map view and each authored place. Use sourced centerlines
   and manifest coordinates; distinguish the inset from Hacienda's local terrain extent.
4. Ship the entry and map assets in the build. Update README and handoff.

Lake Mendocino's reservoir bundle remains LM1 work; its NHD lake-outline request timed out
again during this task. The river setting is authored independently of that lake outline.
No edits to vendor or the reservoir engine/water shader. No push or merge.

## Checks

- `node pipeline/validate-river-packages.mjs`
- `python3 pipeline/build_river_registry.py --check`
- `npm run test:build`
- `RIVER_PULSE_BROWSER=/opt/google/chrome/chrome node scripts/verify-east-fork.mjs`
- Browser smoke/visual review: East Fork first frame, shoreline camera, pause, alternate view,
  reduced motion, geographic map pin navigation, mobile layout and console errors.

## Result
- Status: done
- Commit: 5e84813
- Checks:
  - `node pipeline/validate-river-packages.mjs` — `River packages valid.`
  - `python3 pipeline/build_river_registry.py --check` — `River Pulse registry is current: /tmp/waterscape-mendocino/river-pulse/data/registry.json`
  - `npm run test:build` — `Built experience pages and river assets valid.`
  - `RIVER_PULSE_BROWSER=/opt/google/chrome/chrome node scripts/verify-east-fork.mjs` — `East Fork scene, shoreline controls and map navigation passed.`
  - `git diff --check` — no output.
- Notes: Desktop riverbank/outlet and mobile/map captures inspected in
  `/tmp/waterscape-mendocino-review/`. Bank starts dry at eye height; movement, pause,
  reduced motion and map navigation through Hacienda/East Fork/Jenner pass, with no page
  errors or missing local assets. Rendering review used Chrome's WebGL2 software backend;
  hardware WebGPU performance is unmeasured. Firefox opened the local preview at port 5175.
  README, source notes and handoff updated. No push or merge. LM1's lake outline remains
  blocked by a USGS NHD timeout; this task completes the independent river setting, not
  the Lake Mendocino reservoir bundle. No current discharge/stage is invented.
