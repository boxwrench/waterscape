# S1 — Remember light and season; share them by URL

**Who:** small · **Needs:** — · **Branch:** `task/S1`

## Goal

Live 3D remembers the visitor's last light preset and season in this browser, and both can be
set by URL (`?preset=morning|midday|golden`, `?season=spring|summer`). Priority: URL parameter,
then what was remembered, then the water body's default from `land.json`.

## Steps

1. `git switch -c task/S1`

2. Edit `renderer/explore.js`:

   a. Directly after the line `const keys = new Set();` add:

```js
// The visitor's last light and season (per browser); URL parameters win.
function remembered() {
  try {
    return JSON.parse(localStorage.getItem("waterscape.scene")) ?? {};
  } catch {
    return {};
  }
}
function remember(patch) {
  try {
    localStorage.setItem("waterscape.scene", JSON.stringify({ ...remembered(), ...patch }));
  } catch {}
}
```

   b. Replace

```js
$("season").addEventListener("change", () => body && intro());
```

   with

```js
$("season").addEventListener("change", () => {
  remember({ season: $("season").value === "0" ? "spring" : "summer" });
  if (body) intro();
});
```

   c. Replace `  applyPreset(q.get("preset"));` with

```js
  applyPreset(q.get("preset") ?? remembered().preset ?? null);
```

   d. Replace

```js
  $("season").value = body.land.defaultSeason === "spring" ? "0" : "1";
```

   with

```js
  const season = q.get("season") ?? remembered().season ?? body.land.defaultSeason;
  $("season").value = season === "spring" ? "0" : "1";
```

   e. Replace

```js
  $("preset").onchange = () => applyPreset($("preset").value);
```

   with

```js
  $("preset").onchange = () => {
    applyPreset($("preset").value);
    remember({ preset: $("preset").value });
  };
```

3. Edit `site/journey.js`. Replace the line

```js
$("livePreset").value = new URLSearchParams(location.search).get("preset") || "golden";
```

   with

```js
let rememberedPreset = null;
try {
  rememberedPreset = JSON.parse(localStorage.getItem("waterscape.scene"))?.preset ?? null;
} catch {}
$("livePreset").value =
  new URLSearchParams(location.search).get("preset") || rememberedPreset || "golden";
```

   and replace the handler

```js
$("livePreset").onchange = () =>
  $("liveFrame")?.contentWindow.postMessage(
    { type: "waterscape:preset", name: $("livePreset").value },
    location.origin,
  );
```

   with this one, which also remembers the choice:

```js
$("livePreset").onchange = () => {
  try {
    const scene = JSON.parse(localStorage.getItem("waterscape.scene")) ?? {};
    localStorage.setItem("waterscape.scene", JSON.stringify({ ...scene, preset: $("livePreset").value }));
  } catch {}
  $("liveFrame")?.contentWindow.postMessage(
    { type: "waterscape:preset", name: $("livePreset").value },
    location.origin,
  );
};
```

4. Test. In `scripts/verify.mjs`, directly before the line `  const result = {`, add:

```js
  // Light and season are remembered per browser; URL parameters win.
  const mem = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await mem.goto(`${base}/renderer/explore.html`);
  await mem.evaluate(() =>
    localStorage.setItem("waterscape.scene", JSON.stringify({ preset: "morning", season: "spring" })),
  );
  await mem.reload();
  await mem.waitForFunction(() => window.waterscapeDiagnostics?.ready, null, { timeout: 120000 });
  assert.equal(await mem.evaluate(() => window.waterscapeDiagnostics.preset), "morning");
  assert.equal(await mem.locator("#season").inputValue(), "0");
  await mem.goto(`${base}/renderer/explore.html?preset=midday&season=summer`);
  await mem.waitForFunction(() => window.waterscapeDiagnostics?.ready, null, { timeout: 120000 });
  assert.equal(await mem.evaluate(() => window.waterscapeDiagnostics.preset), "midday");
  assert.equal(await mem.locator("#season").inputValue(), "1");
  await mem.evaluate(() => localStorage.removeItem("waterscape.scene"));
  await mem.close();
```

5. In `README.md`, in the "URL options" paragraph, after `` `?preset=morning|midday|golden`, ``
   add `` `?season=spring|summer`, ``.

6. `npm test` — **Pass:** ends with `Journey checks passed.`

7. Commit: `git add renderer/explore.js site/journey.js scripts/verify.mjs README.md` then
   `git commit -m "S1: remember light and season; share them by URL"`.

8. Add the **Result** section (see AGENTS.md) to this file and commit it.
