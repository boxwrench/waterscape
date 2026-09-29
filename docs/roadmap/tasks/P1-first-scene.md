# P1: Faster first scene and smoother stop transitions

**Who:** capable · **Needs:** L2 · **Branch:** `task/P1`

## Goal

Keep the current video moving while live 3D starts, reduce geometry required before the
first frame, and defer speculative video traffic. Keep GitHub Pages and the existing
renderer-per-stop lifecycle for this pass; measure before considering renderer reuse.

## Scope and plan

1. Work on `task/P1`. Add a repeatable local browser measurement in
   `scripts/measure-startup.mjs`. Record cold low-tier first-frame time, transition time,
   and resource body bytes (including iframe resources) before and after implementation.
   Local timings are observations, not production network benchmarks.
2. In `site/journey.js`, pause video only when the current iframe reports its first frame.
   Defer next-stop video prefetch until video-only playback is established. Live mode
   should prefetch only the next poster. Cancel pending prefetch when changing modes/stops.
   Preserve explicit video preference, including the struggling-device fallback.
3. In `renderer/explore.js`, report the first displayed frame immediately, then retain
   periodic frame-time messages. Expose startup phase durations in diagnostics.
4. In `renderer/land/trees.js`, load far variants first, keep species selection stable,
   and fetch full detail asynchronously when a medium/high frame needs it. Low tier must
   not fetch full meshes. On detail failure, retain usable far meshes without an unhandled
   rejection. Check HTTP responses before decoding. Do not change baked assets.
5. Extend `scripts/verify-site.mjs` with delayed-startup video handoff, low-tier network,
   detail upgrade/failure, stale-frame/navigation and deferred-prefetch regression checks.
6. Update `ROADMAP.md`, `docs/roadmap/README.md` and `docs/HANDOFF.md`: prioritize this
   loading pass, then opening composition and shoreline polish (L2b/L1b), then journey
   context and sourced storage history using the existing W/T dependencies. Ultra follows
   the baseline experience. Correct stale media status and branch/publish instructions.
7. Run `npm test`, `npm run build`, `node scripts/measure-startup.mjs`, and
   `git diff --check`. Read each output. Stop and report any check that fails twice.
8. Commit as `P1: Faster first scene and smoother stop transitions`. Append Result with
   implementation commit, checks and measured outcomes, then commit that documentation.
   Never push or merge.

## Acceptance

- Video continues advancing while live assets are delayed and pauses after the first frame.
- Forced low fetches only the six far meshes (1,226,464 geometry bytes in this revision).
- Medium/high upgrades without blocking initial rendering; failed detail keeps far trees.
- No next-video prefetch while 3D starts or is active. Video-only navigation still prefetches.
- Stop switches and a return to video work during loading; stale iframe messages are ignored.
- Record measurements without claiming a speedup unless the results support it.

Protected files (`vendor/`, `renderer/water.cu`, `renderer/engine/waterscape.js`) are out of
scope. Camera composition, geometry encoding, hosting migration and renderer reuse are
follow-up tasks.

## Baseline observation

Local Edge, unthrottled, before runtime changes on 2026-09-28. One sample per stop;
completed resource body bytes include parent and iframe resources, not network wire bytes.

| Observation | Time to live handoff | Resource body bytes | Tree bytes | Tree requests |
|---|---:|---:|---:|---:|
| Cold low | 16,145 ms | 26,767,413 | 9,815,328 | 12 |
| Next stop low | 15,586 ms | 21,425,920 | 9,815,328 | 12 |

## After implementation

Same local measurement, one sample per stop:

| Observation | Time to live handoff | Resource body bytes | Tree bytes | Tree requests |
|---|---:|---:|---:|---:|
| Cold low | 14,609 ms | 15,773,019 | 1,226,464 | 6 |
| Next stop low | 14,237 ms | 15,590,555 | 1,226,464 | 6 |

This defers 8,588,864 bytes of geometry on low (87.5%). The cold completed resource body
total fell by about 41%; media completion and machine load can vary between runs. Engine
initialization measured 13,071 ms cold and 12,817 ms on the next stop. Profile that phase
before attributing its entire cost to compilation or choosing persistent renderer reuse.
The current changes preserve the per-stop lifecycle and hosting.
