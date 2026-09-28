# T2 — Show storage on the journey card

**Who:** small · **Needs:** T1 merged · **Branch:** `task/T2`

## Goal

When a stop has `storage.json`, its fact card gains a **Storage** row: the latest month's
storage as a link to the CDEC query, and a small sparkline of the last five years.

## Steps

1. `git switch -c task/T2`

2. Create `site/storage.js` with exactly this content:

```js
// Monthly storage (data/<id>/storage.json, from CDEC) as a line of text and a sparkline.
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August",
  "September", "October", "November", "December"];

// { text, points } — text like "43,463 acre-feet in June 2025"; points is an SVG polyline
// "x,y x,y …" for the last `span` months in a width × height box (higher storage = higher line).
export function storageSummary(storage, { span = 60, width = 120, height = 24 } = {}) {
  const months = storage?.months ?? [];
  if (!months.length) return null;
  const latest = months.at(-1),
    [year, month] = latest.month.split("-").map(Number),
    recent = months.slice(-span),
    values = recent.map((m) => m.acreFeet),
    lo = Math.min(...values),
    hi = Math.max(...values),
    points = recent
      .map((m, i) => {
        const x = recent.length > 1 ? (i / (recent.length - 1)) * width : width / 2,
          y = hi > lo ? height - ((m.acreFeet - lo) / (hi - lo)) * height : height / 2;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  return {
    text: `${latest.acreFeet.toLocaleString("en-US")} acre-feet in ${MONTHS[month - 1]} ${year}`,
    points,
  };
}
```

3. Create `pipeline/tests/storage-summary.test.mjs` with exactly this content:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { storageSummary } from "../../site/storage.js";

test("latest month as text and a sparkline scaled to the box", () => {
  const s = storageSummary(
    { months: [{ month: "2025-05", acreFeet: 40000 }, { month: "2025-06", acreFeet: 43463 }] },
    { width: 100, height: 20 },
  );
  assert.equal(s.text, "43,463 acre-feet in June 2025");
  assert.equal(s.points, "0.0,20.0 100.0,0.0");
});

test("no months, no summary", () => {
  assert.equal(storageSummary({ months: [] }), null);
  assert.equal(storageSummary(null), null);
});
```

   Run `node --test pipeline/tests/storage-summary.test.mjs` — **Pass:** `ℹ pass 2`, `ℹ fail 0`.

4. Edit `site/journey.js`:
   - Add this import below the existing `import { poseAt } …` line:

```js
import { storageSummary } from "./storage.js";
```

   - In `loadJourney`, replace

```js
        const [story, cameras] = await Promise.all([
          json(dataUrl(stop.id, "story.json")).catch(() => null),
          json(dataUrl(stop.id, "cameras.json")).catch(() => null),
        ]);
        return { ...stop, story, cameras };
```

     with

```js
        const [story, cameras, storage] = await Promise.all([
          json(dataUrl(stop.id, "story.json")).catch(() => null),
          json(dataUrl(stop.id, "cameras.json")).catch(() => null),
          // Only reservoirs CDEC reports have one; a 404 is normal.
          json(dataUrl(stop.id, "storage.json")).catch(() => null),
        ]);
        return { ...stop, story, cameras, storage };
```

   - In `renderCard`, just before the function's closing `}` (after the
     `$("facts").replaceChildren(…);` statement), add:

```js
  // Monthly storage from CDEC, when this reservoir reports it.
  const summary = storageSummary(stop.storage);
  if (summary) {
    const dt = document.createElement("dt"),
      dd = document.createElement("dd"),
      a = document.createElement("a"),
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"),
      line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    dt.textContent = "Storage";
    a.textContent = summary.text;
    a.href = stop.storage.source;
    a.target = "_blank";
    a.rel = "noopener";
    a.title = "Source: California CDEC";
    svg.setAttribute("viewBox", "0 0 120 24");
    svg.setAttribute("class", "spark");
    svg.setAttribute("aria-hidden", "true");
    line.setAttribute("points", summary.points);
    svg.append(line);
    dd.append(a, svg);
    $("facts").append(dt, dd);
  }
```

5. Append to `site/journey.css`:

```css
.spark {
  display: block;
  width: 120px;
  height: 24px;
  margin-top: 4px;
}
.spark polyline {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  opacity: 0.7;
}
```

6. Look at it: `npm start`, open `http://localhost:5173/#stop=crystal_springs`.
   **Pass:** the card shows a **Storage** row like `43,463 acre-feet in June 2025` with a small
   line under it; Calaveras (`#stop=calaveras`) shows no Storage row. Stop the server.

7. `npm test` — **Pass:** ends with `Journey checks passed.` `npm run build` — **Pass:**
   `Built Pages with …`.

8. Commit: `git add site/storage.js site/journey.js site/journey.css pipeline/tests/storage-summary.test.mjs`
   then `git commit -m "T2: storage on the journey card"`.

9. Add the **Result** section (see AGENTS.md) to this file and commit it.
