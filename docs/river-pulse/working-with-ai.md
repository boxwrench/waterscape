# Working with AI

River Pulse is built to be extended with an AI partner such as Claude Code. The structure, manifests and checks exist so
that a model can add a river reliably and a human can review quickly. This guide is how to run that collaboration well.

## What makes this repo easy for an AI

- **One template.** River → slot → place. The model does not need to guess where anything goes ([Structure](./structure.md)).
- **Manifests, not hidden conventions.** `river.json`, `scene.json` and `place.json` say what exists; validators fail loudly when they disagree.
- **Executable checks.** `npm run validate`, the unit tests, the build and the doc-link check give the model (and you) an objective "done".
- **Honesty rules in writing.** The [Data guide](./data-guide.md) and [Style guide](./style-guide.md) are the model's contract. Point it at them.

## Start a session

Give the model these three things first. Most bad results come from skipping them.

1. **The goal in one sentence**, in terms of the template: "Build the Russian River `start` scene at the East Fork."
2. **The reading list**: [`AGENTS.md`](../../AGENTS.md), this folder's [README](./README.md), [Structure](./structure.md), [Make a river](./make-a-river.md),
   and the sibling scene that is closest to what you want.
3. **The rules that matter here**: never invent facts or numbers; sources must be fetched; mark illustrative parts; change one slot at a time; do not
   edit `vendor/` or the reservoir engine; commit on a branch; never push or merge.

## A prompt that works

> Read `AGENTS.md` and `docs/river-pulse/` (README, structure, make-a-river, data-guide, style-guide). We are filling the `middle` slot of
> `<river>`. Use `<closest scene>` as the model. First propose the place, its sources and the views, and wait for my approval. Then build it,
> run every check in "Verify", and show me before/after captures at desktop and phone width. Anything illustrative must be labelled.
> Record the result in a task file and the handoff. Do not push.

Why it works: it names the slot, the model scene and the approval gate, and it asks for evidence instead of a claim of success.

## Working pattern

1. **Brainstorm first** for anything new: purpose, sources, views, what the data earns. Get a yes before code.
2. **Small, bounded passes.** One slot, one capability, one visual problem per pass. Each pass ends with something you can look at.
3. **Fixed cameras and before/after.** Compare the same views, lighting and geometry before and after, on desktop and phone. See
   [Visual development](../visual-development.md).
4. **The model proposes, you accept.** Visual acceptance is always a human decision; tests prove wiring, not beauty.
5. **Delegate the parallel, bounded work.** Source audits, thumbnail captures, test fixtures and review galleries suit cheaper or parallel agents
   with explicit file ownership. Keep integration and sign-off with one owner.

## What to verify yourself

An AI can say "done" and be wrong. Check:

- **Checks actually ran.** Ask for the output, not a summary: `npm run validate`, the unit tests, `npm run test:build`, `node scripts/check-doc-links.mjs`.
- **Open it.** Load the river home and the scene at 1280 and 390 px; try each view; open the evidence drawer.
- **Numbers have sources.** Click through a displayed value to its record. A value with no source is a bug.
- **Illustrative stays labelled.** Water, bed, colour and motion should say what they are.
- **Nothing was lost.** For moves and refactors, compare file hashes before and after (the RP31 restructure kept an
  [inventory](../archive/restructure-2026-10-05/asset-inventory.sha256)) and look at the diff for unexpected deletions, especially
  3D assets and models.
- **Scope held.** The diff touches only the slot and shared files the task named.

## Common failure modes

| Looks like | Usually means | Fix |
|---|---|---|
| A confident number with no link | Invented or remembered data | Reject; require a fetched source |
| "All tests pass" but the page is blank | Tests do not cover runtime URLs | Open the page; check network and console |
| A scene that looks great at one camera only | Detail was spent on a single view | Review all fixed views and phone width |
| New code copied between scenes | Missed `scene-kit/` | Promote shared code once, import it everywhere |
| A planned slot filled with filler content | Placeholder rules ignored | Planned means no scene, data or geography |
| Changes to unrelated rivers | Scope creep | Revert and restate the one-slot rule |

## Keeping the project legible

- Update the scene's `README.md` and `scene.json` when behaviour changes; the scene card regenerates from `scene.json`.
- Add a short entry to [`docs/HANDOFF.md`](../HANDOFF.md) and a task file in `docs/roadmap/tasks/` for every pass.
- Move superseded review records into the scene's `notes/` or `docs/archive/`, never delete them.
- Prefer improving a guide over explaining something twice in chat.
