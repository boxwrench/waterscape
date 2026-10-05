# RP12: River Pulse visual pass

Make the water and settings first-class, per [Making Water Visible](../../making-water-visible.md),
and give the Hacienda close-ups a historical high and low. Based on LM2 (East Fork and river map).

## Scope done

1. **Hacienda map:** water-blue ribbon even with a stale reading; baseline drift when no
   discharge is known (Setting); slope and bend drive streak speed and outer-bank foam
   (Derived then Illustrative); valley haze.
2. **Jenner** (matched to the two Commons references in `setting/references.json`): smooth
   channel behind a barrier beach, narrower mouth, darker sand and softer wet edge, one ragged
   break line, moving river and lagoon water, dark turf-capped sea stacks, Douglas-fir stands,
   coastal scrub and wider prairie grass.
3. **Hacienda Bridge and Beach:** Selected time / Record low / Record high water. Record low
   flow 0.75 ft³/s (1977-05-06) and record high stage 49.7 ft (1955-12-23) come from USGS with
   source URLs ([RP11](RP11-hacienda-high-low.md)). Height is an Illustrative mapping; the
   record high reaches the underside of the authored bridge steel.
4. **Docs:** [River structure](../../river-pulse/river-structure.md) (start, middle, end; history
   at every level), the Lake Mendocino start-place decision, README bindings.

## Not done / follow-ups

- Jenner has no historical high/low yet; its gauge reports tidal water level.
- Jenner and Hacienda vegetation does not use the reservoirs' shader oaks and tufted grass.
- Beach camera floats above the flood at record high instead of standing on higher ground.
- Hub page and header "River map" links were dropped in favour of LM2's river map panel.
- Windows Chrome/Edge and Firefox performance unmeasured; Firefox not checked by the agent.

## Result
- Status: done (follow-ups listed above)
- Commit: e6b9cbd (branch `task/rp-visuals-v2`, based on `task/LM2`; not pushed or merged)
- Checks:
  - `node --test "pipeline/tests/*.test.mjs"` — `ℹ pass 132`, `ℹ fail 0`
  - `node pipeline/validate-river-packages.mjs` — `River packages valid.`
  - `python3 pipeline/build_river_registry.py --check` — `River Pulse registry is current`
  - `npm run test:build` — `Built experience pages and river assets valid.`
  - `RIVER_PULSE_BROWSER=/usr/bin/google-chrome node scripts/verify-river-pulse.mjs` — `River Pulse browser checks passed: ...`
  - `... node scripts/verify-jenner.mjs` — `Jenner views, motion, mobile, data outage and GPU fallback passed.`
  - `... node scripts/verify-east-fork.mjs` — `East Fork scene, shoreline controls and map navigation passed.`
- Notes: Checked in Chrome only (software WebGL2 in the verification scripts; hardware WebGPU
  looked at by screenshot). Firefox and Windows performance unmeasured. `river-package-validation`
  test updated for East Fork (LM2 left it expecting two places).
