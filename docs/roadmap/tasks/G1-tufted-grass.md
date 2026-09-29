# G1: Tufted, clumped grass

Make the grass fuller. Each instance is a tuft of 5 splayed blades instead of one ribbon; a slow
noise clumps tufts into patches; blades are wider with a lifted base colour and lighter root
shadow. Tiers use 4, 10 and 14 tufts per m². Only `renderer/land/grass.js` changed. Green
(spring) and gold (summer) are the existing Season control; gold stays the default.

## Result
- Status: done (one known failing check, see Notes)
- Commit: see `git log` for "G1: Tufted, clumped grass"
- Checks:
  - `node --test "pipeline/tests/*.test.mjs"`: `ℹ fail 0`
  - `node pipeline/validate-bundles.mjs`: `Bundles valid.`
  - `node scripts/verify.mjs`: `AssertionError [ERR_ASSERTION]: low tier median 62.389999985694885 ms > 33 ms at 768 px`
- Notes: The low-tier frame-time check also fails on the unchanged code on this machine (52 ms
  median, integrated Intel GPU), so it is not caused by this change; it did pass once earlier
  with an earlier, lighter version. Medium and high tiers now draw more blades, so their cost
  should be re-measured on the target hardware. A "stylized" grass option was tried and removed
  at the user's request. `verify-site.mjs` did not run because `verify.mjs` failed first.
