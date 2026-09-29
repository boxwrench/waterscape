# D1: Put reservoir context around the water experience

**Who:** capable · **Needs:** P1 · **Branch:** `task/D1`

## Goal

Keep shallow water as the visual centerpiece. Explain who the reservoir serves, what the
capacity figure means, and what is sourced versus modeled, without covering the scene with
more always-visible text. See [design](../../design/reservoir-context.md).

## Steps

1. Read AGENTS.md and HANDOFF.md; work on `task/D1`.
2. Verify the existing story sources and the new water-system summary against fetched
   USACE, USGS and SFPUC records. Preserve sourced numeric values. Identify the USGS point
   acquisition years as reference years, not verified dates for the entire terrain crop.
   Label the NID dam completion record explicitly where another publication differs.
3. Update only the two `story.json` files, `index.html`, `site/journey.js` and
   `site/journey.css`: show a sourced supply summary and featured capacity, and put the
   remaining facts and scene explanation in a native disclosure. Keep all source links.
   Preserve the current cameras, shader, renderer, video handoff and quality behavior.
4. Validate optional summary/source and featured fields in `pipeline/validate-bundles.mjs`;
   cover malformed new metadata in its existing tests. Document the optional fields in
   `docs/make-a-waterscape.md`. Old stories without them must still work.
5. Extend `scripts/verify-site.mjs` to check both cards, source links, disclosure keyboard
   use, mobile/short viewport fit, and scrolling without changing stops. Capture desktop
   and mobile previews and inspect them. Keep generated screenshots out of the commit.
6. Update ROADMAP.md, docs/roadmap/README.md and HANDOFF.md: P1 is deployed; D1 comes first,
   startup profiling next, then Crystal Springs and sourced storage history. Preserve
   water-focused cameras. Land detail and Ultra are secondary.
7. Run `npm test`, `npm run build`, and `git diff --check`; read their outputs. If a check
   fails, fix only this scope and retry; stop and report if it fails twice.
8. Commit `D1: Put reservoir context around the water experience`; append a Result with
   commit hash and check outputs and commit that record. Do not merge or push this task.

## Source verification

Fetched 2026-09-28; individual numerical facts retain their existing query/report URLs.

- USACE NID CA01546: MAX_STORAGE 96850, DAM_HEIGHT 210, YEAR_COMPLETED 2018.
- USACE NID CA00132: MAX_STORAGE 50500, NAME James H. Turner, YEAR_COMPLETED 1964.
- USGS EPQS at the existing Calaveras anchor: value 223.692733765, AcquisitionDate
  `0/4/2006`; at San Antonio: value 141.665222168, AcquisitionDate `1/0/2021`. Preserve
  previously displayed rounded elevations; only the years are suitable for display.
- [SFPUC systems](https://www.sfpuc.gov/about-us/our-systems): regional system serves
  San Francisco and wholesale customers in Alameda, Santa Clara and San Mateo counties;
  the existing 2.7 million figure is supported.
- [SFPUC water system](https://www.sfpuc.gov/about-us/our-systems/surface-water-water-rain-and-snowmelt):
  Calaveras and San Antonio are in the system and supply the Sunol Valley treatment plant.
- [USGS San Antonio report](https://www.usgs.gov/publications/storage-capacity-and-sedimentation-characteristics-san-antonio-reservoir-california):
  supports the historical capacity and sediment figures, but gives 1965 as the dam's
  completion year versus NID's 1964. The 2018 survey estimates larger total capacity with
  improved methods; avoid implying the historical estimate is current storage or that
  sediment loss is the only change in the capacity estimate.

No data fetch failed or required value was missing. No new current-storage claim is made.

## Result

- Status: done
- Commit: 81d1022
- Checks:
  - `npm test` — `Journey checks passed.` (29 unit tests passed, bundles valid, renderer
    checks passed on NVIDIA; this run is not comparable to the earlier Intel timing).
  - `npm run test:site` — `Journey checks passed.` after the final live/mobile previews
    and scrollbar styling. Covers both reservoirs, legacy stories, keyboard disclosure,
    scrolling, source links, narrow/short screens, and existing live/failure behavior.
  - `npm run build` — `Built Pages with 57 browser modules, shared CUDA source and licensed assets.`
  - `git diff --check` — exit 0; no whitespace errors (LF/CRLF conversion notices only).
- Notes: Reviewed desktop, portrait-mobile and short-landscape screenshots, plus live
  desktop/mobile water views. Temporary captures are under the test's logged
  `waterscape-d1-*` directory, not in Git. Restored generated renderer preview PNGs.
  Cameras, shaders, renderer, terrain and media assets are unchanged. D1 is committed on
  its branch, not merged, pushed or deployed. The roadmap prioritizes reservoir context,
  startup profiling, then Crystal Springs/storage history; landscape detail is secondary.
