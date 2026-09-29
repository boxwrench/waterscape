# G2: Try Codrops fluffy grass

User-requested local trial of Ebenezer's grass technique:
https://tympanus.net/codrops/2025/02/04/how-to-make-the-fluffiest-grass-with-three-js/

1. Replace the ribbon tufts in `renderer/land/grass.js` with splayed, alpha-cutout
   clumps adapted to the existing WebGPU/TSL land pass. Preserve shoreline exclusion,
   terrain anchoring, wind, lighting, season and the Grass toggle.
2. Use spatial chunks with frustum culling and distance LOD to limit grass cost.
3. Store the upstream mask and MIT licence locally under `data/biomes/diablo-oak/grass/` and credit
   the source in `THIRD_PARTY_NOTICES.md`. No external browser imports.
4. Run `npm test` and `npm run build`. Inspect close grass and overhead views in
   green and gold, all quality tiers, and the Grass toggle. Record browser limitations.
5. Commit the trial and this task's result. Leave flyover re-recording until the
   user accepts the visual trial; do not push or merge.
