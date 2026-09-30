# RP6: Render an animated map-water ribbon with flow-scaled width

## Scope

The user requested readable water ripples/movement in Map, despite exaggerated scale,
with seasonal color along its border and width following historical flow. Keep the
accepted Hacienda Beach/Bridge setting and reservoir checkout unchanged. No push or merge.

## Steps

1. Define a bounded, monotonic illustrative width binding from selected eligible gauge
   discharge and the loaded history range. Keep scientific quantities unchanged. Handle
   zero, missing/stale, constant history and absent history explicitly.
2. Replace the solid map pulse stroke with a continuous terrain-draped ribbon: green-blue
   water, exaggerated ripples and traveling highlights, seasonal-color margins. Width
   responds to the timeline; movement and width are display mappings, not hydraulics.
3. Connect history/state/condition changes without depending on event arrival order. Keep
   River toggle, authored-view visibility and reduced-motion behavior intact.
4. Add concise map-scale disclosure in the inspector. Record normalization and limits.
5. Verify timeline-driven geometry/color/motion and zero/missing behavior. Repair the
   earlier browser-test initialization race by waiting for the asynchronous map layer
   before reading it. This is required to verify the requested Map behavior under outages.
6. Inspect actual rendered desktop/mobile Map screenshots and adjust readability.

## Checks

- `node --test "pipeline/tests/*.test.mjs"`
- `node pipeline/validate-river-packages.mjs`
- `npm run test:build`
- `RIVER_PULSE_BROWSER=/opt/google/chrome/chrome node scripts/verify-river-pulse.mjs`
- Inspect desktop/mobile Map renders; retain accepted authored scene appearance.

## Interpretation

Mapped centerlines and terrain retain their existing source provenance. A single gauge's
selected discharge controls the whole mainstem display width, which is an illustrative
comparison within the loaded history window, not spatially resolved discharge, channel
width, bank extent, stage, inundation or local velocity. Ripple size/speed are exaggerated
presentation choices. No new factual quantities or external assets are needed.
