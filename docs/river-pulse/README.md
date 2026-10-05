# River Pulse documentation

River Pulse turns real river data into explorable places. Every river follows one template, so a
new contributor can learn the shape once, copy it, and fill it in, alone or with an AI partner.

## Start here

| You want to... | Read |
|---|---|
| Understand how the project is organised | [Structure guide](./structure.md) |
| Make a new river or build a planned scene | [Make a river](./make-a-river.md) |
| Make it look and feel like the rest | [Style guide](./style-guide.md) |
| Add or present data honestly | [Data guide](./data-guide.md) |
| Work with Claude or another AI on all of the above | [Working with AI](./working-with-ai.md) |

A good first hour: read this page and the Structure guide, open the
[Russian River](../../river-pulse/rivers/russian_river/README.md), the reference river, in your browser
(`npm start`, then http://localhost:5173/river-pulse/), then read Make a river.

## The idea in one screen

- **A river has a map view and 3-4 scenes**: a **start**, a scenic **middle** and an **end**, plus an optional
  extra. A slot with no scene yet is a clearly marked **planned** placeholder.
- **A scene has a few views**: fixed cameras such as Map, Bridge or Beach.
- **One visual language** (colours, type, glass surfaces, data cards) runs through every river.
  Places with richer data, such as a live gauge, history or fine lidar, use more of it. The structure never changes.
- **Real data is the backbone.** Every number on screen is observed, derived or labelled
  illustrative. See [Making Water Visible](../making-water-visible.md).

## Where things live

```
river-pulse/            the code and data (see the Structure guide)
  rivers/<river>/       one folder per river; each scene holds its own page, code, data and notes
docs/river-pulse/       these guides
  reference/            durable references: data contract, known traps, reuse notes
docs/archive/           history: review records, old handoffs, the restructure tools
docs/roadmap/tasks/     one file per past task (what was asked, what was done)
```

Per-scene notes live next to the scene, in `river-pulse/rivers/<river>/scenes/<slot>/<place>/README.md`.

## Reference

- [Implementation contract](./reference/implementation-contract.md): the full scientific-state architecture.
- [Known traps](./reference/known-traps.md): verified USGS behaviour and mistakes already made once.
- [Reservoir renderer reuse](./reference/reservoir-renderer-reuse.md) and
  [Waterscape reuse audit](./reference/waterscape-reuse-audit.md): what can be borrowed from the reservoir engine.
- [Future ideas](./reference/future-ideas.md).
- Reservoirs, the sister experience: [Make a waterscape](../make-a-waterscape.md).
