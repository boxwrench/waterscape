# Visual development and verification

Trialed on [Eel River / Scotia Bluffs](river-pulse/eel-visual-review.md), RP17.
The first rendered comparison exposed a broken water/terrain contact that code
checks had missed. The process is useful; visual acceptance remains a human decision.

## Combine the strongest parts of Eel and Sacramento

The user endorses combining this verification workflow with Sacramento's detailed,
photo-informed modeling. Use source geography to establish the reach first, then
apply photographic comparison to focal structures, rock forms, banks and vegetation.
Preserve measured dimensions where available and label fitted components as estimates.
Keep a separate sourced presentation when an authored close scene changes the frame.

Sacramento demonstrates the value of detailed views and human corrections to
recognizable structures. Eel demonstrates early geographic acquisition, fixed
comparisons and cost records. Neither tests nor source data alone prove that a
scene looks right. Agent critique and human feedback must both enter each bounded
pass. The trial has not established faster overall delivery; assess that after
comparable detailed passes, not from a coarse Eel study versus a developed bridge.

## Start from the existing renderer

For each river, inventory the user's existing reservoir terrain, relief shading,
materials, lighting, vegetation and water treatments before building substitutes.
Compare their actual runtime against the proposed river scene. Reuse proven pieces
where local landforms, materials and source coverage fit; calibrate them against
that river's references. [Reservoir reuse guidance](river-pulse/reservoir-renderer-reuse.md)
records the components, candidate places and limitations. A fine shading tile does
not establish equally fine source geometry, and reservoir water/shoreline assumptions
must not silently become river stage or bathymetry.

## Before implementation

1. Pick a specific reach or structure and a bounded visual pass. State its acceptance
   question: silhouette, scale, channel layout, shoreline contact, vegetation or motion.
2. Fetch authoritative layout/physical sources and inspect clearly licensed visual
   references. Record URL, author, license, date, coordinate frame, resolution and
   limitations. Separate measured/source geometry from authored interpretations.
   Concept art can guide decisions; it cannot validate the implemented scene.
3. Define a small named camera set before details: overview, primary composition,
   eye level, shoreline/contact and any critical special angle. Store numeric presets
   in source with a version. Changing a camera invalidates comparisons from that view.
4. Record seeds and inputs. Keep a plain form mode without textures, fog, vegetation
   or effects that could conceal weak geometry. Establish recognizable forms there.

## One bounded iteration

1. Capture the actual local runtime from the fixed cameras before editing. Preserve
   those files with explicit before names. Do not substitute references or concepts.
2. Describe the visible mismatch in ordinary language before choosing its technical
   cause. Change one related system at a time. Render again from the same cameras,
   presentation, viewport and motion state. Compare side by side. Use overlays or
   contours only when the reference viewpoint supports that comparison.
3. For animated systems, review several actual frames or a short runtime clip. Test
   pause and reduced motion. A still validates form, not motion quality.
4. Measure the cost at a recorded camera/viewport, renderer backend and pixel ratio.
   Record triangles/draw calls, resident geometry/texture bytes, first-frame loading
   and useful frame/CPU/GPU timing. Name what is estimated or unmeasured. Keep warmup,
   sample size, browser visibility and motion state consistent. Occluded/automated
   frame pacing cannot establish a normal foreground FPS guarantee.
5. Inspect important desktop and phone views, controls and errors. Spend detail near
   shorelines, close cameras and interaction points. Choose LOD, batching or baking
   from measured costs and visible quality, not polygon-count assumptions.
6. Keep a short review record: changed, improved, worse, still artificial, evidence
   paths and measured cost delta. Retain a stable local preview for shared inspection.

## Acceptance checkpoint

Stop at the end of the pass and report:

- What changed and the fixed views/frames actually inspected.
- What visibly improved and what is still weak, including source limitations.
- Runtime cost and comparison conditions, with unmeasured items disclosed.
- Whether the implementation is ready for review or needs another correction.
- The human's acceptance status and the next bounded pass if accepted.

Passing tests does not accept the visual baseline. Do not silently continue into
more detailed systems while an explicit visual acceptance point is pending. Treat
feedback such as “the trees feel fake” or “the scale is wrong” as actionable visual
evidence; investigate the cause without asking the human for a technical prescription.

## Review record template

```text
Pass / scope:
Sources and measured-vs-authored distinction:
Seed / input versions / camera preset version:
Before and after runtime images / clips:
Views reviewed / viewport / presentation / motion state:
Visible mismatch -> related changes:
Improved / worse / still artificial:
Cost before -> after / warmup and sample / backend / limitations:
Checks:
Acceptance: awaiting human / accepted by human / needs another pass
Next bounded pass:
```

For Eel, native terrain is the geographic backbone. The water surface is a labeled
visual proxy. The contact fix does not turn that proxy into a measured water level.
Future passes must preserve that distinction when adding more convincing optics.
