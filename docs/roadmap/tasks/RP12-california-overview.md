# RP12: Build a California river overview

## Scope

Replace the index catalog with a visually impressive California map. Use a sourced state
outline, terrain relief and actual cartographic geometry for the six catalog rivers.
Rivers are selectable by mouse, touch and keyboard and lead to individual river pages.
Move RP11 details to `river.html`; Russian River can open its existing Hacienda scene.
Keep unavailable scene status explicit. No Sacramento 3D scene, publication or vendor edits.

## Design plan

Ocean #102f3c, deep water #081d29, mist #e2ece7, sandstone #d8c9a4, river #8ce9ee,
selected water #f0d69b. Georgia headlines and Segoe UI controls. A large California
relief map on the right, open typography and compact river links on the left. State
outline, shoreline and sourced relief carry the visual identity; glows increase river
legibility. No autonomous animation. Responsive map and readable river links on mobile.
The plan uses geographic structure as the centerpiece rather than generic UI cards.

## Steps

User steering: use the detailed reservoir/Russian River visuals and saved resource library
as inspiration. Review the committed Calaveras/Jenner images and resource notes. Apply
terrain depth, cool water, restrained atmosphere and geographic storytelling. Relevant
references: Clearwater, Tidewater, Hai no Michi and River Bend. No upstream code/assets
are copied by this pass.

1. Acquire Census boundary, USGS 3DHP river geometry and USGS 3DEP shaded relief. Store
   compact local assets with URLs, retrieval time, CRS and processing notes.
2. Build state-map navigation, focused river preview and accessible individual routes.
3. Preserve observations and existing scene URLs; include all assets in the build.
4. Inspect desktop/mobile appearance, navigation, keyboard operation and page errors.

## Checks

- `node --test pipeline/tests/california-overview.test.mjs`
- `npm run test:build`
- `git diff --check`
- Browser review of desktop/mobile overview, river links and destination pages.

## Result
- Status: done
- Commit: f8939c3
- Checks: focused overview tests 3 passed; production build: Built experience pages and
  river assets valid; git diff --check clean.
- Browser: full California silhouette inspected on desktop; mobile 390px layout
  inspected with no horizontal overflow and enlarged map labels. Keyboard Tab changed
  the preview/highlight. Sacramento map link opened its Freeport page; Eel map link
  opened its planned page; Back restored the overview. All six destination files are
  checked by the focused tests. Russian River maps to the existing Hacienda scene.
  Browser error/warning logs were empty. Preview saved in previews/california-overview.png.
- Notes: DWR service unavailable, so USGS 3DHP supplied 6,477 named flowlines. Smaller
  direct 3DEP relief export succeeded after the initial image URL timed out. Test
  aspect-ratio comparison was corrected to use a floating-point tolerance. Assets are
  bundled; ordinary builds/viewing do not refetch them. Work remains local on task/RP12.
