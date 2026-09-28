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
| L1 | Ground materials and wind grass ([brief](capable-agent-briefs.md#l1-ground-and-grass)) | capable | — | in progress (Claude, branch `land-l1`) |
| L2 | California oaks ([brief](capable-agent-briefs.md#l2-oaks)) | capable | L1 | later |
| L3 | Light and tuning, re-rendered flyovers ([brief](capable-agent-briefs.md#l3-light-and-tuning)) | capable | L2 | later |

## Track Q — upkeep

| ID | Task | Who | Needs | Status |
|---|---|---|---|---|
| Q1 | [Build and smoke-test the native Windows host](tasks/Q1-native-build.md) | small | — | todo |
