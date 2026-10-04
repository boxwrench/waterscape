# RP14: Reconstruct Freeport Bridge from multiple angles

## Scope

The user requests a bridge that looks almost identical from each angle. Replace RP13's
generic crossing with a detailed, photo-matched closed Freeport Bridge. Retain water,
observations and terrain data. Work locally without publication.

## Approach

Use original Nathan Holth photo documentation (southeast/northeast, portal, truss webs,
counterweights, machinery, piers and underside) and Dicklyon's east approach photograph.
Use archived National Bridge Inventory dimensions for overall length, central span and
roadway/deck width. Estimate unreported member sizes and elevations from photos, record
those estimates explicitly, and inspect the same model from both banks, both approaches
and below. No surveyed geometry or current river level is claimed.

Keep the current visual design. Model green built-up/laced steel, asymmetric approach
spans, low tapered leaves, tall Pratt counterweight supports, articulated tower links,
weathered concrete weights, rounded piers, timber fenders, bearings, railing, road deck,
signals and tender house. Add useful viewpoints for evaluating the whole bridge.

The user's top-strut review adds paired open roof diagonals, cross ties, central
gusset plates/transverse struts, correctly oriented lattice headers and angle-member
portal sway frames. Match close-up photos 02997, 02984 and 03008; retain the top
maintenance platform and two-tier rails.

## Checks

- `node --test pipeline/tests/sacramento-scene.test.mjs pipeline/tests/river-pulse-sacramento.test.mjs pipeline/tests/california-overview.test.mjs`
- `node pipeline/validate-river-packages.mjs`
- `npm run test:build`
- Browser: inspect four bank sides, east/west approaches, underside and above; desktop/mobile;
  existing data/evidence/pause controls; no console errors.
- `git diff --check`

## References

- https://historicbridges.org/bridges/browser/?bridgebrowser=california/freeportbridge/
- https://historicbridges.org/bridges/browser/photos.php?bridgebrowser=california/freeportbridge/&gallerynum=1&gallerysize=1
- https://historicbridges.org/california/freeportbridge/nbisheet.pdf
- https://commons.wikimedia.org/wiki/File:Freeport_Bridge_from_Freeport.jpg

Photographs are studied as references, not redistributed.

## Result

- Status: done
- Commit: `9011472`
- Checks:
  - `node --test pipeline/tests/sacramento-scene.test.mjs pipeline/tests/river-pulse-sacramento.test.mjs pipeline/tests/california-overview.test.mjs`: 11 pass, 0 fail.
  - `node pipeline/validate-river-packages.mjs`: `River packages valid.`
  - `npm run test:build`: `Built experience pages and river assets valid.` (111 browser modules).
  - Browser: all eight angles inspected at desktop and phone sizes; Evidence, pause/resume,
    Explore and Bridge/Riverbank/Terrain controls checked; phone has no horizontal overflow;
    console error logs empty. Top-strut correction reviewed from approach, overhead and
    underside views. Temporary viewport override reset; final scene left open.
  - `git diff --check` and `git diff --cached --check`: pass.
- Notes: Same complete bridge model in every view. Photo-fitting improves visual fidelity
  but does not establish surveyed/photogrammetric accuracy. Horizontal NBI dimensions and
  documented east pony length are distinguished from estimated elevations/components.
  Reference photographs and scratch PDFs are not bundled. Local previews updated. Water
  and observation bindings retain their existing interpretation. No push or merge.
