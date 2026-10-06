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

## Track RP: River Pulse

River Pulse follows the river template: a river map and a start, a scenic middle and an end per river, with the Russian River
as the reference. Read the [River Pulse documentation](../river-pulse/README.md) first; the current state is in the
[handoff](../HANDOFF.md). The numbering RP11-RP13 was used on two
lines of work (suffix `b` marks the second).

### Done (all on `main`, deployed)

| ID | Task | Who | Needs | Status |
|---|---|---|---|---|
| RP2 | [Authored water](tasks/RP2-authored-water.md) | capable | R1 | complete; superseded by accepted RP5 composition |
| RP3 | [Hacienda materials](tasks/RP3-hacienda-materials.md) | capable | RP2 | selected and integrated in RP4/RP5 |
| RP4 | [Pebble beach and bank rocks](tasks/RP4-hacienda-bank-materials.md) | capable | RP3 | complete; refined in RP5 |
| RP5 | [Hacienda authored scene](tasks/RP5-hacienda-authored-scene.md) | capable | RP4 | user accepted; historical browser race resolved in RP6 |
| RP6 | [Flow-scaled Map water ribbon](tasks/RP6-map-water-ribbon.md) | capable | RP5 | complete; all scoped checks pass |
| RP7 | [Irregular blue Map water](tasks/RP7-map-water-detail.md) | capable | RP6 | complete; all scoped checks pass |
| RP8 | [Document and publish River Pulse](tasks/RP8-publish-river-pulse.md) | capable | RP7 | historical Pages timeout; accepted scenes deployed in RP10 |
| RP9 | [Jenner estuary and Pacific shoreline](tasks/RP9-jenner-estuary.md) | capable | RP8 code | user accepted as a good starting point; focused checks pass |
| RP10 | [Merge and publish Jenner](tasks/RP10-publish-jenner.md) | capable | RP9 | merged/pushed 4a404c4; Pages and live assets verified |
| [RP11](tasks/RP11-river-atlas-sacramento.md) | River atlas and Sacramento data foundation | capable | merged | complete, on main |
| [RP11b](tasks/RP11-hacienda-high-low.md) | Hacienda historical high and low water (east-fork line; its id collides with RP11) | capable | merged | complete, on main |
| [RP12](tasks/RP12-california-overview.md) | California overview map | capable | merged | complete, on main |
| [RP12b](tasks/RP12-river-pulse-visuals.md) | River Pulse visual pass (east-fork line) | capable | merged | complete, on main |
| [RP13](tasks/RP13-sacramento-freeport.md) | Sacramento Freeport scene | capable | merged | complete, on main |
| [RP13b](tasks/RP13-publish-branch.md) | Publish the east-fork work as a branch | capable | merged | complete; ported in RP32 |
| [RP14-RP16](tasks/RP14-freeport-bridge-fidelity.md) | Freeport bridge, upper links, riverfront | capable | merged | complete, on main |
| [RP17-RP18](tasks/RP17-eel-visual-baseline.md) | Eel visual baseline and state sources | capable | merged | complete, on main |
| [RP19-RP23](tasks/RP23-tuolumne-reservoir-visuals.md) | Tuolumne foundation, form, dam and reservoir visuals | capable | merged | complete, on main |
| [RP20, RP24-RP26](tasks/RP20-eel-bluff-forest.md) | Eel bluffs, forest, rock detail, water optics and reflection contact | capable | merged | complete, on main; contact still imperfect |
| [RP27](tasks/RP27-river-water-adoption-land-form.md) | Shared river water, Eel 1 m hero land | capable | merged | complete, on main |
| [RP28-RP30](tasks/RP28-river-home-layout.md) | River home, scene data cards, scene chrome consistency | capable | merged | complete, on main |
| [RP31](tasks/RP31-river-template-restructure.md) | River template and modular structure, documentation rewrite | capable | merged | complete, on main |
| [LM2, RP32](tasks/RP32-port-east-fork.md) | East Fork scene, river map, Jenner and Hacienda upgrades ported onto the template | capable | merged | complete, on main (946850a), deployed |
| RP44 | Sacramento slots: Freeport becomes the middle; Headwaters Park (start) and the Delta confluence (end) named as planned placeholders | capable | merged | complete, local branch task/RP44-sacramento-slots |

### Open

| ID | Task | Who | Needs | Status |
|---|---|---|---|---|
| RP34 | Human visual acceptance of the new river home, East Fork, Jenner and Hacienda extremes | human | live on Pages | open |
| RP35 | Put the river map on the river home page (pins for start / middle / end) | capable | RP32 | open |
| RP36 | Extract shared scene chrome (topbar, data card, view bar, evidence drawer) into `ui/` and migrate all six scenes | capable | RP30 | open |
| RP37 | Bind live gauges: Eel at Scotia (USGS-11477000) is documented; find and verify a Tuolumne gauge. No invented values | capable | RP36 helps | open |
| RP38 | River maps for the other five rivers (`map.status` is `planned`) | small | RP35 | open |
| RP45 | Sacramento end: the Delta confluence with the San Joaquin (Collinsville and Pittsburg area). Source the place and photos first, then author a bank-level scene like East Fork | capable | RP44 | open |
| RP46 | Sacramento start: Headwaters Park at Big Springs, Mount Shasta. Source it, and confirm the official-origin note (Mount Eddy forks) before relying on it | capable | RP44 | open |
| RP47 | **Eel quality pass**: add an authored bank-level scene (gravel bar and bluff face, photo-informed setting, shared bank and tree assets) and keep today's terrain scene as the Overview view. Terrain tuning alone has hit its ceiling (RP20-RP27) | capable | RP36 helps | open |
| RP48 | **Tuolumne quality pass**: add an authored granite river-reach scene below the dam using the Sierra granite and reservoir rock materials; keep the valley and dam views as context | capable | RP36 helps | open |
| RP39 | Fill the remaining planned slots, one per pass (Eel start and middle, Tuolumne middle and end, San Joaquin and American), following Make a river | capable | RP31 docs | open |
| RP40 | Hide or gate the Review tools & runtime cost control for visitors on Eel and Tuolumne (needs your call: it is your review workflow) | small | decision | open |
| RP41 | Measure GPU time and phone performance for Eel and Tuolumne (62 ms desktop at lowest tier with the dam context) | capable | none | open |
| RP42 | Fix `scripts/verify-river-pulse.mjs` on Windows (static server path built from `URL.pathname`); predates RP31 | small | none | open |
| RP43 | Eel water-to-shore contact and bluff silhouettes (remaining visual weaknesses from RP24-RP27) | capable | RP37 | open |
| LM1 | Lake Mendocino reservoir bundle: the lake-side reservoir work was not in the pushed branch. Locate it before deciding | decision | find the branch | open |

Task files for open items are written when they are picked up (copy the closest `tasks/RP*.md`). "small" suits a local model with
exact files and checks; "capable" needs design and visual judgment; "human" and "decision" are yours.

## Track D — reservoir context

| ID | Task | Who | Needs | Status |
|---|---|---|---|---|
| D1 | [Put reservoir context around the water experience](tasks/D1-reservoir-context.md) | capable | P1 | complete on task/D1; awaiting review |

## Track B — water at the bank

| ID | Task | Who | Needs | Status |
|---|---|---|---|---|
| B1 | [Organic shoreline contact with ebb and flow](tasks/B1-shoreline-contact.md) | capable | — | merged 2026-09-29 |

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
| W1 | [`pipeline/locate.py`: draft a source.json from a lake name](tasks/W1-locate.md) | small | — | done 2026-09-29 |
| W2 | [Add Crystal Springs Reservoir](tasks/W2-crystal-springs.md) | small | W1 | done 2026-09-29, with Peninsula biome and morning fog |
| W3 | [Add San Andreas Lake](tasks/W3-san-andreas.md) | small | W1 | done 2026-09-29 |
| W4 | [Add both to the Hetch Hetchy tour](tasks/W4-tour.md) | small | W2, W3 | done 2026-09-29 |
| H1 | Hetch Hetchy: Sierra granite + conifer biome, then the bundle ([brief](capable-agent-briefs.md#h1-hetch-hetchy)) | capable | L1, L2 | done 2026-10-03, with O'Shaughnessy Dam; fifth tour stop |

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
