# R2: Make full reservoir controls accessible from the journey

The user reported missing controls on GitHub Pages. The deployed reservoir journey
hides the embedded Explorer panel and has no link to the full Explorer.

1. Work on `task/R2`.
2. Add a visible Full controls link to the reservoir card. Keep it pointed at the
   selected reservoir's standalone Explorer, where all existing controls are available.
3. Match the surrounding navigation styling and check desktop/mobile layout and both stops.
4. Run `npm run test:build`, verify the link in a browser, and run `git diff --check`.
5. Commit with this task title and record the result. Do not merge or push.

## Result
- Status: done
- Commit: 8d509ec
- Checks: `npm run test:build` — Built experience pages and river assets valid.
- Checks: Local Chromium browser verification — Controls link and full panel verified at 667x375 (also passed 1280x800 and 390x844; both reservoir destinations checked).
- Checks: `git diff --check` — exit 0, no output.
- Notes: Desktop/mobile screenshots saved in `/tmp/waterscape-r2-*.png`; mobile layout reviewed. Full controls opens the existing standalone Explorer. This change is local and awaits human merge/publication.
