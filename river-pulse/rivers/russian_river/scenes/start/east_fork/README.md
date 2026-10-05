# East Fork (Lake Mendocino area): planned start

Placeholder for the Russian River's **start** slot. Nothing is built: there is no page, terrain,
gauge binding or sourced geography for this scene yet, and none should be implied.

To build it, follow [Make a river](../../../../../../docs/river-pulse/make-a-river.md), "Fill a
planned slot": choose and source the place, add `data/place.json` and terrain, build the page, then
change `scene.json` to `"status": "built"` with `entry`, `thumb`, `views` and `data` flags.

## Existing work

Earlier East Fork work is believed to exist, unpushed, on another machine. It is not in this repository.
When it is available, do not rebuild it: bring its page and code into this folder, its sourced files into `data/`, then follow
"Fill a planned slot" in [Make a river](../../../../../../docs/river-pulse/make-a-river.md). Old paths in that work predate the
restructure, so map them with the layout in the [Structure guide](../../../../../../docs/river-pulse/structure.md): shared 3D code goes to
`scene-kit/`, the page and its own modules stay here. The mapping tool in `docs/archive/restructure-2026-10-05/` shows how the
old `renderer/`, `data/` and `visual-bindings/` folders were translated.
