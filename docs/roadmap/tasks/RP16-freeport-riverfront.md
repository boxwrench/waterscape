# RP16: Build the Freeport riverfront setting

## Scope

After accepting the bridge, the user asks to move on. Develop the surrounding
Freeport scene using their aerial reference: riverbank vegetation, levee roads,
marina docks/roofed slips, boats, buildings and agricultural context. Keep the
accepted bridge geometry and the existing scientific data/terrain interpretation.
Work locally without publication.

## Approach

Replace the pale repetitive bank material with earthy shoreline and layered grass.
Put curved roads on the authored levee crest, connect bridge approaches, and add
small original procedural buildings and riverfront details. Place a roofed marina
on the tender-house/east side north of the bridge, following the supplied photo's
composition. Reframe Riverbank to show that waterfront. Trees and bank details
should leave the river and bridge readable from desktop and phone viewpoints.

All surrounding geometry, vegetation, optical color and dimensions are Setting,
fitted visually rather than surveyed or current-condition data. Use existing
licensed local textures/tree meshes and original code geometry. Do not redistribute
the supplied photograph or claim boat counts, botanical species or current season.

## Checks

- `node --test pipeline/tests/sacramento-scene.test.mjs pipeline/tests/river-pulse-sacramento.test.mjs pipeline/tests/california-overview.test.mjs`
- `node pipeline/validate-river-packages.mjs`
- `npm run test:build`
- Browser: bridge bank/approach/overhead views and Riverbank; desktop/phone;
  Evidence and pause controls; no console errors/overflow. Update local previews.
- `git diff --check`
