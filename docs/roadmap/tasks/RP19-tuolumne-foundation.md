# RP19: Establish the Tuolumne River geographic foundation

Start the next river in parallel with RP18's Eel data audit. This task ends at a
reviewable source-data and camera-plan foundation; it does not claim a finished
scene or human visual acceptance.

## Scope

1. Research Hetch Hetchy / Poopenaut Valley using primary geographic references.
2. Choose a bounded downstream reach, preserve unexaggerated USGS 3DEP elevations,
   and record its actual exported resolution rather than claiming 1 m lidar.
3. Acquire state-authored CalWater watershed context with provider, source URL,
   retrieval date, coordinate frame and limitations.
4. Record five reproducible review camera proposals and the next plain-form pass.
5. Keep the river planned until an actual runtime scene has been reviewed. Do not
   change shared renderers, the accepted Eel scene or Sacramento bridge.

## Checks

- `python pipeline/validate_tuolumne_foundation.py`
- `python pipeline/render_tuolumne_reference_sheet.py` and visual source-sheet inspection
- `node pipeline/validate-river-packages.mjs`
- `python pipeline/build_river_registry.py --check`
- `git diff --check`

Work in isolated `C:/Github/waterscape-tuolumne-rp19`, branch `task/RP19`.
Commit implementation with this task title, then commit a separate Result section.
Never push or merge.

## Result

- Status: done (bounded source-data/research foundation).
- Commit: `615acb1`.
- Checks:
  - `python pipeline/validate_tuolumne_foundation.py` -> `Tuolumne foundation valid: 768x512 @ 14.66 m; 278 mapped flowlines; state CalWater unit/area; five proposed cameras.`
  - `python pipeline/render_tuolumne_reference_sheet.py` -> `Tuolumne source sheet written: reference-sheet.jpg (not a runtime render).` Actual source aerial and sheet inspected; state polygon and study window are visible, geographic dam/downstream sequence recognizable.
  - `node pipeline/validate-river-packages.mjs` -> `River packages valid.`
  - `python pipeline/build_river_registry.py --check` -> `River Pulse registry is current: C:\Github\waterscape-tuolumne-rp19\river-pulse\data\registry.json`.
  - `git diff --check` -> exit 0, no whitespace errors (standard LF/CRLF conversion notice only).
- Notes: Isolated worktree/branch; no push or merge. River remains planned because
  no runtime scene exists. Actual California CalWater HU 6536 / HA 65366 geometry
  is bundled and featured on the reference sheet. Native 1 m Poopenaut NCALM
  lidar availability is verified by primary metadata; its raw points/raster are
  not downloaded, and full local footprint coverage is not established. Terrain
  remains a 14.66 m 3DEP service export at unexaggerated elevations. Cameras are
  proposals needing first plain-form runtime validation. No human visual
  acceptance, motion or runtime performance claim. State endpoint moved to the
  verified public portalserver service after the old endpoint returned non-JSON;
  a transient USGS connection reset cleared on retry.
