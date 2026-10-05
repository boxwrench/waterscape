# Style guide

The visual language every river and scene shares. Scenes carry the story; the interface frames it and
keeps the evidence close. Landscape first, instrumentation second.

## Principles

1. **The scene is the product.** Full-screen 3D wherever it adds information. UI floats over it as small, calm glass surfaces.
2. **Three questions, in order.** What is happening here? (visible in the world and one number) How does it compare? (history, condition)
   How do we know? (an explicit inspect action with source, time, method, quality).
3. **Honest by default.** Never fill a gap with a plausible value. Missing, stale and illustrative are visible states, not hidden ones.
4. **Same bones everywhere.** A river with a live gauge and a river with only terrain use the same components. The second just uses fewer of them.
5. **Structure never changes, fidelity does.** Richer data raises the quality of a scene; it does not change where things sit.

## Tokens

All colour, type and spacing tokens live in [`river-pulse/ui/tokens.css`](../../river-pulse/ui/tokens.css). Import it first and
use `var(--rp-*)`; do not introduce a new hex value for something that already has a token.

| Token | Use |
|---|---|
| `--rp-bg`, `--rp-bg-deep` | Page background (deep water teal, darkening downward) |
| `--rp-panel`, `--rp-glass` | Translucent surfaces over a page or a scene |
| `--rp-line` | 1px borders and dividers |
| `--rp-text`, `--rp-muted`, `--rp-faint` | Primary, secondary, tertiary text |
| `--rp-cyan` | Live, observed, current |
| `--rp-gold`, `--rp-gold-muted` | Attention, stale readings, in-development |
| `--rp-planned` | Planned placeholders |
| `--rp-font-display` (Georgia) | Place names and big numbers |
| `--rp-font-sans` (Segoe UI) | Everything else |

Pages use dark translucent UI over bright natural scenes, restrained river green and blue accents, large
place names with small technical labels, rounded glass and thin borders. Avoid saturated dashboard palettes.

## Components

Every scene page is assembled from the same parts. Where a part is implemented today is listed so you reuse it
instead of rebuilding it.

| Component | What it is | Where it lives today |
|---|---|---|
| **Topbar** | Wave-icon brand (links to the river home), breadcrumb `California / River / Place`, actions: River home, Explore, Evidence or Inspect data | each scene's CSS and HTML; Eel and Tuolumne share `ui/study-scene.css` |
| **Place card** | Eyebrow (`RIVER / 01`), place name in Georgia with a full stop (`Freeport.`), one-line subtitle | scene HTML and CSS |
| **Data card** | A glass card with one big value, a quality badge, a time line, an optional sparkline, the station link | Freeport (`#flow-card`), Hacienda (flow card + history panel), Jenner (level card) |
| **View bar** | Segmented glass control of the scene's fixed cameras, wraps on small screens | every scene; Eel and Tuolumne share `ui/study-scene.css` |
| **Evidence drawer** | `Inspect data` or `Evidence`: sources, units, valid time, selection policy, binding class, limits | every scene |
| **Disclosure line** | Tiny footer line naming fidelity: `USGS terrain · Illustrative water · Development scene` | every scene |
| **Scene card** | Thumbnail, slot label, name, fidelity, view chips, `Explore →`; planned slots are dashed with no link | `app/river.js` |
| **Planned card** | Dashed placeholder: "This slot is reserved. No scene, data or geography is implied yet." | `app/river.js` |

The components are shared in *look* but still duplicated in *code*: tokens are shared, per-scene stylesheets still carry
their own copies. When you touch a scene's chrome, move one component into `ui/` instead of copying it again.

## Data states

The data card has exactly these states. Use [`flowDisplay()`](../../river-pulse/core/visual-bindings/flow-status.js) so they read the same everywhere.

| State | Value | Badge | Note line |
|---|---|---|---|
| Current | the reading, cyan accent | `Current` | time and approval (`provisional`) |
| Stale | the **last value**, muted gold | `Stale` | `No current reading · last value <time>` |
| Missing | `No observation available` | `Missing` | why nothing eligible was found |
| Unavailable | `Unavailable` | `Unavailable` | what could not be reached; offer the source link |
| Not bound | no card | none | the river home says `No live gauge yet`; never show a placeholder number |

A stale number stays visible because it is still the best honest answer; muting it says it is old.

## Honesty labels

Every visual belongs to one class (see [Making Water Visible](../making-water-visible.md)): **exact**, **derived**,
**illustrative**, or **setting**. The scene's disclosure line and evidence drawer must say which parts are which.
Typical wording: `Illustrative water`, `Authored setting`, `Photo-informed setting`, `Native elevations`, `Development scene`.
Fidelity strings in `scene.json` use the same words.

## Layout and responsive rules

- Desktop can carry a place card, a data card, a view bar and a timeline together. Mobile becomes a compact heads-up
  display: keep place identity, the selected value and the view bar; collapse descriptive copy first. Do not build a
  separate reduced-information mobile product.
- Gutters: 40px on pages, 20px on phones. Touch targets are at least 44px.
- The river home and the atlas are pages (scroll). Scene pages are full-viewport and fixed (no page scroll); long
  content goes in the evidence drawer.
- Controls are discoverable but quiet. Developer controls such as `Review tools & runtime cost` collapse small and stay out of the way.
- Respect `prefers-reduced-motion`: freeze ripples, snap transitions, and say so in the control label.

## Thumbnails and imagery

A scene's `thumb.jpg` is a **clean capture of the real scene** (960x540, UI hidden), not an illustration or a mock-up.
Re-capture it when the scene changes enough to look different. Never use a concept image as a stand-in.

## Accessibility and quality bar

- Real headings, labelled landmarks (`nav`, `main`), skip links on pages, live regions for data that updates.
- Colour is never the only carrier of meaning; badges also carry words.
- Contrast: body text on glass meets 4.5:1. Check muted text on bright scenes at desktop and phone width.
- A change to chrome is verified at 1280 and 390 px with no horizontal overflow and no console errors.
