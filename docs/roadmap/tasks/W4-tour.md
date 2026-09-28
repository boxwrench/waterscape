# W4 — Add Crystal Springs and San Andreas to the Hetch Hetchy tour

**Who:** small · **Needs:** W2 and W3 merged · **Branch:** `task/W4`

## Steps

1. `git switch -c task/W4`

2. Edit `data/tours/hetch-hetchy.json`. The `stops` list must become exactly (keep `title`):

```json
  "stops": [
    { "id": "calaveras", "caption": "Hetch Hetchy Regional Water System" },
    { "id": "san_antonio", "caption": "Hetch Hetchy Regional Water System" },
    { "id": "crystal_springs", "caption": "Hetch Hetchy Regional Water System" },
    { "id": "san_andreas", "caption": "Hetch Hetchy Regional Water System" }
  ]
```

3. The journey test assumes San Antonio is the last stop. In `scripts/verify-site.mjs`, replace
   these lines:

```js
  assert.deepEqual(
    await page.$$eval("#systemMap li", (li) => li.map((x) => x.classList.contains("active"))),
    [false, true],
  );
  assert.equal(await page.isDisabled("#next"), true);
```

   with:

```js
  assert.deepEqual(
    await page.$$eval("#systemMap li", (li) => li.map((x) => x.classList.contains("active"))),
    [false, true, false, false],
  );
  assert.equal(await page.isDisabled("#next"), false);
  // The last stop disables "Next".
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.textContent("#stopName"), "San Andreas Lake");
  assert.equal(await page.isDisabled("#next"), true);
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
```

   (The next line, `await page.click("#prev");`, stays as it is and still returns to Calaveras.)

4. Run `node pipeline/validate-bundles.mjs` — **Pass:** `Bundles valid.`

5. `npm start`, open `http://localhost:5173/`, use "Next stop →" to reach stops 3 and 4.
   **Pass:** each shows its name, facts with links, and a playing video. Stop the server.

6. `npm test` — **Pass:** ends with `Journey checks passed.`

7. Commit: `git add data/tours/hetch-hetchy.json scripts/verify-site.mjs` then
   `git commit -m "W4: Crystal Springs and San Andreas join the Hetch Hetchy tour"`.

8. Add the **Result** section (see AGENTS.md) to this file and commit it.
