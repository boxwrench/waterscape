# Make a river

A step-by-step recipe for adding a river, and for turning a planned slot into a built scene. The
[Russian River](../../river-pulse/rivers/russian_river/README.md) is the worked example; open its folder beside this page.
Read the [Structure guide](./structure.md) first, and keep the [Style](./style-guide.md) and [Data](./data-guide.md) guides handy.
To do this with an AI partner, see [Working with AI](./working-with-ai.md).

## Setup (once)

```sh
npm ci
pip install numpy scipy Pillow pytest
```

Microsoft Edge must be installed for the browser checks. Work on a branch: `git switch -c task/<id>`.
Commit when done; do not push or merge.

## Part 1: add the river with every slot planned

This takes minutes and is a complete, valid river. The atlas and river home show it honestly.

1. **Create the river folder**: `river-pulse/rivers/<river_id>/`. The id is lowercase with underscores (`feather_river`).

2. **Write `river.json`** (copy [Russian's](../../river-pulse/rivers/russian_river/river.json) and change it):

   ```json
   {
     "schema_version": "river-pulse-river-0.2",
     "id": "feather_river",
     "name": "Feather River",
     "status": "planned",
     "summary": "One honest sentence about what this river will show.",
     "map": { "status": "planned" },
     "scenes": [
       { "slot": "start", "id": "start_to_be_chosen" },
       { "slot": "middle", "id": "middle_to_be_chosen" },
       { "slot": "end", "id": "end_to_be_chosen" }
     ],
     "references": [{ "label": "A real source", "url": "https://example.org/" }]
   }
   ```

   `status` is `planned`, `in_development` or `available`. At least one `references` entry with an `https://` URL is required.

3. **Add a `scene.json` for each slot** at `scenes/<slot>/<id>/scene.json`:

   ```json
   {
     "schema_version": "river-pulse-scene-0.1",
     "id": "start_to_be_chosen",
     "river": "feather_river",
     "slot": "start",
     "name": "Start (to be chosen)",
     "status": "planned",
     "note": "Placeholder that blocks out the river's structure. No scene, data or geography is implied."
   }
   ```

   Give a slot you already know a real name. Choose places by the rules in [Choosing places](./reference/choosing-places.md): the end is the mouth or
   confluence, the start is where people feel the river begins, the middle is the best-known reach.
   Naming a place is fine; inventing its data or geography is not.

4. **Put the river on the state map.** Add its USGS 3DHP flowline names to the `NAMES` table in
   [`pipeline/build_california_overview.py`](../../pipeline/build_california_overview.py) and run it. It queries the live service,
   writes `river-pulse/app/data/`, and is the only step that needs the network.

5. **Regenerate and check.**

   ```sh
   python pipeline/build_river_registry.py
   npm run validate
   node --test "pipeline/tests/*.test.mjs"
   ```

6. **Look at it**: `npm start`, then open http://localhost:5173/river-pulse/river.html?river=feather_river. All three slots show
   dashed "planned" cards and the river says `No live gauge yet`.

## Part 2: fill a planned slot with a scene

Pick one slot and one place. Do the steps in order; each ends with something you can see.

1. **Choose and source the place.** Write down the agency sources (a USGS gauge ID, a 3DEP area, reference photos) before
   building anything. Per the [Data guide](./data-guide.md), copy numbers only from records you fetched.

2. **Rename the placeholder** to the real place id (`hacienda_bridge`): rename the scene folder, update `id` in `scene.json`
   and `river.json`. A scene's folder name must equal its place id.

3. **Create the data.** In `scenes/<slot>/<id>/data/`:
   - `source.json` (`id`, `name`, `anchor`, `bbox`, `size`; see the [Data guide](./data-guide.md)).
   - Build terrain and centerline:
     `python pipeline/build_river_terrain.py <that source.json>` then `python pipeline/build_river_hydrography.py <that source.json>`.
   - `place.json` with `supported_capabilities` and, if you have a gauge, a `data_bindings` entry.
   - Then `python pipeline/build_river_registry.py` so the registry lists the place.

4. **Build the page.** Add `index.html` and your scene module beside `scene.json`. Start from the closest existing scene:
   - Terrain plus a live card and history → [Freeport](../../river-pulse/rivers/sacramento_river/scenes/end/freeport/README.md) or [Hacienda](../../river-pulse/rivers/russian_river/scenes/middle/hacienda_bridge/README.md).
   - Terrain study with fixed cameras and no gauge → [Scotia Bluffs](../../river-pulse/rivers/eel_river/scenes/end/scotia_bluffs/README.md).
   - A coastal or authored setting → [Jenner](../../river-pulse/rivers/russian_river/scenes/end/jenner/README.md).
   Reuse `scene-kit/` (terrain, water, banks, materials) and `ui/tokens.css`. Do not copy shared code into the scene; if you need
   to change shared code, change it once in `scene-kit/`.

5. **Make a thumbnail.** Capture the real scene with the UI hidden, 960x540, as `thumb.jpg`.

6. **Flip the scene to built** in `scene.json`: `"status": "built"`, `"entry": "index.html"`, `"thumb": "thumb.jpg"`, `"fidelity"`,
   `"views": [...]` (the camera names a visitor sees) and the `"data"` flags (`live_gauge`, `history`, `condition`, `fine_terrain`).
   If the river's home should show live data from this scene, set `"live_data_scene": "<id>"` in `river.json`.

7. **Write the scene's `README.md`**: what the place is, sources, what is exact, derived, illustrative and setting, known limits.
   The scene card at the top (and each river's slot table) is generated: run `node scripts/sync-river-readmes.mjs` after editing `scene.json` or
   `river.json`. Keep notes and review records in `notes/`.

8. **Verify** (all must pass):

   ```sh
   python pipeline/build_river_registry.py --check
   node scripts/sync-river-readmes.mjs
   npm run validate
   node --test "pipeline/tests/*.test.mjs"
   python -m pytest pipeline/tests -q
   npm run test:build
   node scripts/check-doc-links.mjs
   ```

   Then open the scene and the river home at 1280 px and 390 px wide: no console errors, no horizontal overflow, the data card shows
   a real current, stale or missing state, and the evidence drawer opens.

9. **Record the result.** Add `docs/roadmap/tasks/<id>-<name>.md` with scope, checks and the visual weaknesses that remain, and
   add a short entry at the top of [`docs/HANDOFF.md`](../HANDOFF.md). Visual acceptance is a human decision.

## What you do not touch

`vendor/`, `renderer/water.cu`, `renderer/engine/waterscape.js` (the reservoir engine), other rivers' scenes, and generated files
(`registry.json`, `terrain.bin.gz`) except through their builders.

## Checklist

- [ ] River has all three slots; unbuilt ones are `planned`
- [ ] Folder name = place id = `id` in `place.json` and `scene.json`
- [ ] Sources recorded; nothing invented; illustrative parts labelled
- [ ] `thumb.jpg` is a real capture
- [ ] Registry current, validators, tests and build pass; doc links valid
- [ ] Checked on desktop and phone; handoff updated
