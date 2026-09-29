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

## Result
- Status: blocked (implementation committed; visual verification incomplete)
- Commit: a327069
- Checks:
  - `npm test`, first run: `8 bundle problem(s)` — initial shared asset location
    was interpreted as a reservoir; moved the assets into the existing biome.
  - `npm test`, second run: unit tests `ℹ fail 0` (29 passed); `Bundles valid.`;
    browser stage failed with the exact error:
    ```text
    browserType.launch: Chromium distribution 'msedge' is not found at /opt/microsoft/msedge/msedge
    Run "npx playwright install msedge"
    ```
  - `npm run build`: `Built Pages with 57 browser modules, shared CUDA source and licensed assets.`
  - `node --check renderer/land/grass.js`: exit 0, no output.
  - `git diff --check`: exit 0, no output.
  - Firefox 142.0.1 WebGPU probe with `dom.webgpu.enabled=true` failed:
    ```text
    page.evaluate: WebGPU is only available on Windows, and in Nightly and Early Beta builds on other platforms.
    ```
- Notes: User requested Firefox instead of Chrome for WebGPU. Playwright Firefox
  was installed, but its Linux release build cannot provide the GPU adapter.
  Edge installation also needs unavailable sudo credentials. Stopped under the
  two-failed-check rule. Use Firefox Nightly for the remaining shader/runtime,
  close/overhead, season, tier, toggle and performance checks; no visual approval
  is claimed. The trial uses six/three/two splayed cards by distance, chunk culling,
  and the upstream MIT grass mask. Videos remain unchanged pending acceptance.

### Firefox preview follow-up

At the user's request to see the trial, downloaded Firefox Nightly 159.0a1 into
`/tmp/fluffy-grass/` and opened a separate temporary profile with WebGPU enabled.
The live renderer starts successfully: `ready: true`, `errors: []`, shared land
device, and zero frame-loop readback bytes. Visually inspected the high-tier,
spring-green close-up at the north ridge; alpha-cutout clumps render correctly.
The browser is left open for the user. Screenshot: `/tmp/fluffy-grass/preview.png`.
All-tier, overhead, gold and toggle checks and the full Edge suite remain unverified;
this preview does not constitute completion of the original verification checklist.
