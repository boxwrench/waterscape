# RP24 source and reuse audit

## Eel material input

The existing Rock030 pair is in `data/biomes/diablo-oak/ground/rock_color.jpg` and `rock_normal.jpg`. The biome metadata identifies it as ambientCG Rock030, CC0 1.0, with source archive `https://ambientcg.com/get?file=Rock030_1K-JPG.zip`. Both files are 1024 × 1024 RGB JPEGs. Together they occupy 990,546 bytes (0.945 MiB). If both are decoded as RGBA with a complete mip chain, the estimate is about 10.67 MiB (5.33 MiB each); actual GPU allocation depends on browser and driver.

Reusing these maps on Eel is an authored dry-slope surface treatment. The color photo can add restrained fine variation to the existing material, and the OpenGL normal photo can add shallow lighting relief through world-space triplanar sampling. Fade the effect on gentle ground and beneath the existing aerial-derived woody cover mask. Keep the mask soft and treat it only as image classification. This does not identify Scotia rock or vegetation, and the photo does not add geology, elevation, or river-stage information.

Scotia Bluffs terrain remains the existing USGS 3DEP sampled grid: 384 × 384 cells at 14.05296785 m spacing, NAVD88 metres, EPSG:32610. The 0.05 m channel encoding step is quantization, not spatial resolution. No 1 m terrain is bundled for this scene. Surface detail must not imply finer native geometry.

## Projection and integration risks

Triplanar color sampling can use world position and the unmodified terrain normal as its blend weights. The normal map needs more care: its tangent components must use the same UV axes as color. Face-reflected tangent frames require matching reflected color UVs; the final implementation instead projects fixed-world UV gradients onto the actual tangent plane, as detailed below. The reservoir helper in `renderer/land/granite.js` has custom axis mappings and an optional upright rotation; copying only its sampling pattern into Eel would risk inverted relief or seams. Validate positive and negative X/Z faces and the upward-facing Y case under the fixed light. The Rock030 biome metadata identifies the asset and files but does not state its normal convention. `pipeline/biome_assets.py` documents generated `_normal.jpg` files as OpenGL convention, and the original reservoir ground uses that interpretation with visual review. Follow that established interpretation here; do not apply a DirectX green flip unless asset evidence changes.

Calculate steepness from the original terrain normal before applying the photo normal. Otherwise detail changes its own slope mask. Keep positions and normals in the same world-space frame; avoid mixing `positionWorld` with local coordinates, or a world normal with view-space axes. If any fade depends on camera distance, keep it an explicit appearance LOD so camera motion does not change the source terrain or cover classification.

## Cross-river reuse recommendations

| Reach | Recommendation | Basis and limit |
| --- | --- | --- |
| Eel, Scotia Bluffs | Suitable for a restrained dry-steep-face detail pass. | Existing 14.05 m terrain and aerial cover mask; authored appearance only. Requires visual review. |
| Tuolumne / Poopenaut | Candidate for a separate native-terrain dry-slope trial; keep the full Hetch Hetchy dam/reservoir as its own context. | An isolated checkout, `C:\Github\waterscape-tuolumne-rp19` at RP23 commits `655fd19` and `d8a18ef`, contains the Poopenaut runtime and USGS 3DEP terrain at 14.66265725 m cells, plus the full Hetch Hetchy reservoir context. See its `docs/river-pulse/reservoir-renderer-reuse.md` and `tuolumne-foundation.md`. This audit's main checkout does not include those parallel changes. Candidate technique only; keep Poopenaut native/source modes separate from reservoir level and stage. |
| Sacramento, Freeport | Poor fit for blanket floodplain use; assess only exposed dry banks if a scene need is established. | Existing terrain is 7.73 m 3DEP sampling. A steep-face rock treatment across low-relief floodplain would be visually misleading. |
| Russian River | Prefer its existing local materials where appropriate; avoid adding a duplicate rock layer by default. | Hacienda Bridge already has CC0 Poly Haven dry-rock color, OpenGL normal, and roughness maps with local metadata. Jenner has its own setting references. |

These are reuse recommendations from existing metadata and scene structure, not validated runtime changes or geological claims.

## Follow-up normal projection audit

A consistent option for the Rock030 normal map is to decode its tangent XY direction as a negative height gradient, using `xy / max(z, 0.25)`, then map that gradient through the same fixed, unreflected UV bases as the color projections: X `(z,y)` maps to world `(0, ty, tx)`, Y `(x,z)` to `(tx, 0, ty)`, and Z `(x,y)` to `(tx, ty, 0)`. Blend these vectors with weights from the original geometric normal, project the result onto its tangent plane with `g - n * dot(g,n)`, then add the offset to `n` and normalize. This represents outward relief consistently on positive and negative faces without face-dependent U flips; the UV axes continue to align with the color samples. For the rotated sample, inverse-rotate the world gradient back from the rotated frame before blending. This assumes the ordinary OpenGL normal-map channel/UV convention and matching texture `flipY` treatment on color and normal maps. It is a proposed authored interpretation of the normal map, not height or geological measurement.
