# RP8: Document and publish Hacienda views and Map water

## Authorization and scope

The user requests commit, push, a README link and updated docs. This authorizes integration
and publication to the existing GitHub Pages site, overriding the default no-merge/no-push
rule for this task. Publish accepted RP2–RP7 River Pulse work. Preserve current remote main
and leave the independent dirty reservoir checkout untouched.

## Steps

1. Integrate current remote main into the isolated River Pulse branch, retaining both tracks.
   Existing upstream reservoir/vendor changes are carried through unchanged, not edited.
2. Add a prominent direct Hacienda link in the README. Update River Pulse guide, architecture,
   roadmap and handoff to describe Map/Bridge/Beach, optics, illustrative flow and limitations.
3. Run publication checks, commit docs and push the verified integrated commit to main using
   an ordinary fast-forward push. Never force-push.
4. Monitor the Pages workflow and verify deployed River Pulse assets against the local build.
5. Record the publication result and commit/push that documentation update too.

## Checks

- `node --test "pipeline/tests/*.test.mjs"`
- `python3 -m pytest pipeline/tests -q`
- `npm run check`
- `npm run validate`
- `python3 pipeline/build_river_registry.py --check`
- `npm run test:build`
- `RIVER_PULSE_BROWSER=/opt/google/chrome/chrome node scripts/verify-river-pulse.mjs`
- README/internal document links resolve; GitHub Pages build/deploy succeeds; deployed
  representative HTML, modules, terrain and setting assets match the verified local build.

## Interpretation

No new source data, scientific claims or visual bindings. Water optics and reconstructed
beach are presentation; Map width follows selected discharge within loaded history, not
measured channel banks/stage/velocity. Documentation must preserve these distinctions.
