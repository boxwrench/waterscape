# Roadmap work queue

The [roadmap](../../ROADMAP.md) broken into tasks an agent can pick up. Every task names who
should do it:

- **small** — a small local model can do it (tested with the goal of Qwen-class models): the
  task file lists exact files, commands, values and pass/fail checks. Give the agent
  [`AGENTS.md`](../../AGENTS.md) and the task file, nothing else.
- **capable** — needs design work and visual judgment (rendering, shaders, art direction).
  Give it to a frontier coding agent (Claude Code, Codex) with the brief in
  [capable-agent-briefs.md](capable-agent-briefs.md); it writes its own spec and plan first.

Run tasks in order within a track; a task may start only when everything in **Needs** is
merged into `main`. A human reviews and merges each `task/<id>` branch.

## How to hand a task to a local agent

1. `git switch main && git pull` (or just `git switch main`).
2. Start the agent in the repository folder with this prompt:

   > Read AGENTS.md, then do the task in docs/roadmap/tasks/<file>.md exactly as written.
   > Stop and report if any check fails twice.

3. When it reports done, review the branch (`git log main..task/<id>`, `git diff main`) and run
   `npm test` yourself before merging.

## Current priority

Water is the visual focus; real reservoir data gives the journey meaning. P1 is deployed.
D1 reservoir context comes first, then P1b startup profiling, then W1/W2 and T1/T2 sourced
storage history. Preserve the shallow-water opening cameras. Landscape refinement and
Ultra are secondary. Track dependencies still apply; storage history needs Crystal Springs.

## Track D — reservoir context

| ID | Task | Who | Needs | Status |
|---|---|---|---|---|
| D1 | [Put reservoir context around the water experience](tasks/D1-reservoir-context.md) | capable | P1 | complete on task/D1; awaiting review |

## Track B — water at the bank

| ID | Task | Who | Needs | Status |
|---|---|---|---|---|
| B1 | [Organic shoreline contact with ebb and flow](tasks/B1-shoreline-contact.md) | capable | — | in progress on task/B1 |

## Track P — first visit and delivery

| ID | Task | Who | Needs | Status |
|---|---|---|---|---|
| P1 | [Faster first scene and smoother stop transitions](tasks/P1-first-scene.md) | capable | L2 | merged and deployed as ab96848 |
| P1b | Profile remaining engine initialization (~13 s locally); measure compilation/allocation/baking before deciding on renderer reuse | capable | P1 | next after D1 |
| P2 | Refine distant reflections while preserving the shallow-water foreground and current camera emphasis | capable | P1 | later; water-focused scope replaces tree-framing proposal |

Keep GitHub Pages for P1. Measure before considering renderer reuse, compact geometry,
versioned long-lived asset caching or a different host.

## Track W — more water bodies (Hetch Hetchy system)

| ID | Task | Who | Needs | Status |
|---|---|---|---|---|
| W1 | [`pipeline/locate.py`: draft a source.json from a lake name](tasks/W1-locate.md) | small | — | todo |
| W2 | [Add Crystal Springs Reservoir](tasks/W2-crystal-springs.md) | small | W1 | todo |
| W3 | [Add San Andreas Lake](tasks/W3-san-andreas.md) | small | W1 | todo |
| W4 | [Add both to the Hetch Hetchy tour](tasks/W4-tour.md) | small | W2, W3 | todo |
| H1 | Hetch Hetchy: Sierra granite + conifer biome, then the bundle ([brief](capable-agent-briefs.md#h1-hetch-hetchy)) | capable | L1, L2 | later |

## Track T — water level and timeline

| ID | Task | Who | Needs | Status |
|---|---|---|---|---|
| T1 | [Monthly storage from CDEC (`pipeline/storage.py`, `storage.json`)](tasks/T1-storage.md) | small | W2 | todo |
| T2 | [Show storage on the journey card](tasks/T2-storage-card.md) | small | T1 | todo |
| T3 | Water level above the lidar surface from storage (dam-line flood fill) | capable | T1 | later |

CDEC reports monthly storage for Crystal Springs (station `CRY`) and Hetch Hetchy (`HTH`) only;
Calaveras, San Antonio and San Andreas are not in CDEC, so they have no timeline yet.

## Track S — scene controls

| ID | Task | Who | Needs | Status |
|---|---|---|---|---|
| S1 | [Remember light and season; share them by URL](tasks/S1-remember-scene.md) | small | — | todo |
| S2 | Wind: strength and direction for waves and grass ([brief](capable-agent-briefs.md#s2-wind)) | capable | L1 | later |
| S3 | Water clarity: clear ↔ turbid ([brief](capable-agent-briefs.md#s3-clarity)) | capable | — | todo |

## Track L — land that holds up up close

| ID | Task | Who | Needs | Status |
|---|---|---|---|---|
| L1 | Ground materials and wind grass ([brief](capable-agent-briefs.md#l1-ground-and-grass)) | capable | — | done 2026-09-28 |
| L1b | Grass refinement: blades read pixelated or sparse at 1152 px (thin blades alias without MSAA in the land pass); try MSAA or alpha-to-coverage on the land target, wider far blades, denser near field; golden-hour shade too muddy, backlit glow ([brief](capable-agent-briefs.md#l1-ground-and-grass)) | capable | L1 | later |
| L2 | California oaks ([brief](capable-agent-briefs.md#l2-oaks)): baked ez-tree oak meshes near the camera, photographed impostors to 250 m–1.5 km, 3D trees and grass toggles | capable | L1 | live 2026-09-28: works, "just ok"; 9.8 MB geometry, staging in P1 |
| L2b | Real tree shadows: render oaks and grass from the sun into a shadow map sampled by ground and grass (today's soft blobs from the old procedural crowns do not match the 3D trees) | capable | L2 | later; supporting landscape work |
| U1 | PC-only Ultra tier (opt-in, never auto-picked): denser curved grass with seed heads and flowers, backlit glow, land-pass anti-aliasing, shadow maps, full-detail oaks to ~400 m, native resolution, photo mode (pause, hide UI, 2× PNG) | capable | L2b | proposed |
| L3 | Light and tuning, re-rendered flyovers ([brief](capable-agent-briefs.md#l3-light-and-tuning)) | capable | L2 | later |

## Track Q — upkeep

| ID | Task | Who | Needs | Status |
|---|---|---|---|---|
| Q1 | [Build and smoke-test the native Windows host](tasks/Q1-native-build.md) | small | — | todo |
