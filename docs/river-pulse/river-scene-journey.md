# River home, scenes, and fixed viewpoints

This inventory separates three navigation levels: the California overview, a river-specific
home, and place scenes. Camera buttons inside a scene are viewpoints of that scene, not
additional geographic places. This is a map of the experience that exists today, not a list of
scenes to build.

## Current route behavior

`river-pulse/index.html` is the statewide overview. Every overview river selection now opens its
own `river.html?river=<id>` home through `riverDestination()` in
`data-model/overview-navigation.js`. The home reads that river's `river.json`, shows its summary,
and links only to the place scenes present in that manifest (`river.js`). It loads the first
place's observations when configured. Scene headers link back to their river home; their fixed
camera controls remain viewpoints within that place. The implemented route is therefore:
California overview → selected river home → an available place scene → that scene's fixed views.
The scene inventory below records which destinations exist today; a camera view is not another
place.

## Existing scene inventory

| River | River-home / manifest | Distinct scenes and actual roles | Fixed viewpoints in those scenes |
|---|---|---|---|
| Russian | `river.html?river=russian_river`; `russian_river/river.json` lists two scenes. | Hacienda Bridge is a river-reach scene. Jenner is a separate estuary/coastal scene. These are two distinct places; neither is named as the river source or headwaters. | Hacienda: Map, Bridge, Hacienda Beach. Jenner: Estuary lookout, River shore, Pacific beach. Each set is a camera/view selector within one place scene. |
| Sacramento | `river.html?river=sacramento_river`; `sacramento_river/river.json` lists Freeport. | Sacramento River at Freeport is the only bundled place scene. Its manifest calls it a tidally influenced reach and distinguishes instantaneous from tidally filtered discharge. This is a lower-river/Delta-side context, not a source-area scene. | Bridge, Riverbank, Terrain; bridge-angle choices refine the Bridge view. All remain Freeport views. |
| Eel | `river.html?river=eel_river`; `eel_river/river.json` lists Scotia Bluffs. | Scotia Bluffs visual study is the only Eel place scene. USGS station 11477000 is in the Lower Eel hydrologic unit, so describe this as a Lower Eel reach; the scene is not a headwaters/source scene. | Reach overview, Scotia Bluffs, Across the river, Water & gravel, Downstream bend. These are five fixed views of the Scotia study extent. |
| Tuolumne | `river.html?river=tuolumne_river`; `tuolumne_river/river.json` lists Poopenaut Valley. | Poopenaut is one native valley scene downstream of Hetch Hetchy. The same page conditionally shows the original Hetch Hetchy reservoir context for the dam transition, downstream named view, and lake view. Those are distinct camera/context choices, not extra native valley places. NPS describes Poopenaut below O'Shaughnessy Dam and the Tuolumne's high-Sierra headwaters separately. | Native: Overview, Valley, Eye level, River contact, Dam transition, Dam close-up. Reservoir context: Below dam and Reservoir. Five original Poopenaut cameras remain; the dam close-up is a separate authored view. |
| American | `river.html?river=american_river`; `american_river/river.json` has no scenes and status `planned`. | No place or scene bundle yet. Keep the home as the planned-river entry. | None. |
| San Joaquin | `river.html?river=san_joaquin_river`; `san_joaquin_river/river.json` has no scenes and status `planned`. | No place or scene bundle yet. Keep the home as the planned-river entry. | None. |

Geographic qualifiers above follow the place manifests and agency references: [USGS Lower Eel
station 11477000](https://waterdata.usgs.gov/monitoring-location/USGS-11477000/), [Freeport's
Delta-side context from California State Parks](https://www.parks.ca.gov/BoatingFacilities/f/648)
and its [USGS station record](https://waterdata.usgs.gov/monitoring-location/USGS-11447650/),
and the [NPS Tuolumne River Plan](https://www.nps.gov/yose/getinvolved/trp.htm). Scene and
camera names are from the repository manifests and page controls, not new geographic claims.

## Navigation convention

Use the Russian manifest's existing multi-scene model as the navigation example: its river home
names its two actual place scenes, and each scene keeps its own fixed viewpoints. River homes
currently list only their manifest entries. Rivers with one bundled scene show one destination;
planned rivers show no scene card. Do not create source-area or scenic-middle placeholders, infer
new geographic areas from camera labels, or promise scenes that are not built. If a future reach
selection is desired, add a place only after its geography, sources, and authored scene are
reviewed.
