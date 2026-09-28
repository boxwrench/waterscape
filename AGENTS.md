# Instructions for coding agents

Read this whole file before starting any task. Then read the task file you were given
(in `docs/roadmap/tasks/`) and follow it step by step. For the latest state of the project,
see `docs/HANDOFF.md`.

## What this project is

Waterscape rebuilds real US lakes and reservoirs from public data and shows them in the
browser: a journey of flyover videos plus a live 3D renderer (WebGPU). Each water body is one
folder in `data/<id>/`. See `README.md` and `docs/architecture.md`.

## Setup (once)

```
npm ci
pip install numpy scipy Pillow pytest
```

Microsoft Edge must be installed (the browser tests use it).

## Commands

| Purpose | Command | Passing output |
|---|---|---|
| Unit tests | `node --test "pipeline/tests/*.test.mjs"` | `ℹ fail 0` |
| Python tests | `python -m pytest pipeline/tests -q` | `N passed`, no `failed` |
| Data checks | `node pipeline/validate-bundles.mjs` | `Bundles valid.` |
| Everything | `npm test` | ends with `Journey checks passed.` |
| Build the site | `npm run build` | `Built Pages with …` |
| Local server | `npm start` | then open http://localhost:5173/ |

`npm test` takes several minutes and opens browser windows. That is normal.

## Rules

1. **One task at a time.** Only do what your task file says. Do not refactor, rename or
   "improve" other code.
2. **Work on a branch.** Before editing: `git switch -c task/<task-id>` (for example
   `task/W2`). Commit at the end of the task. **Never push. Never merge.**
3. **Never invent facts or numbers.** Every number in `story.json` or `storage.json` must be
   copied from a URL you fetched during the task, and that URL must be recorded next to it.
   If a fetch fails or the value is missing, stop and report — do not guess.
4. **Never edit `vendor/`, `renderer/water.cu` or `renderer/engine/waterscape.js`** unless the
   task file explicitly says so.
5. **Browser code has no external imports.** Every `import` in `renderer/`, `site/` must be a
   relative path (`./x.js`, `../y.js`). No CDNs.
6. **Run every check the task lists and read its output.** If a check fails, fix only what the
   task covers and run it again. If it fails twice, stop and report the exact output.
7. **Keep the style of the surrounding code**: 2-space indent in JS/JSON, 4 in Python, double
   quotes in JS.
8. **Commit message**: the task title, e.g. `W2: Add Crystal Springs Reservoir`.

## When you finish

Append a short **Result** section to the bottom of your task file:

```
## Result
- Status: done | blocked
- Commit: <short hash>
- Checks: <each command and its final line of output>
- Notes: <anything the next person must know>
```

Then commit that change too. A human merges finished branches.

## Coordinates and data you will meet

- Scene axes: x = east, z = south, y = up, metres; the water surface is y = 0.
- `data/<id>/source.json` — inputs for the builder: `name`, `biome`, `anchor [lat, lon]` (a
  point on open water), `bbox [west, south, east, north]` (degrees), `size [w, h]` (grid cells,
  about 10 m each).
- Public sources used: USGS 3DEP (elevation), USGS NHD (lake outlines), USACE National
  Inventory of Dams (dam facts), California CDEC (monthly reservoir storage).
