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
