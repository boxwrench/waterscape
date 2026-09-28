# T1 — Monthly storage from CDEC (`pipeline/storage.py`, `storage.json`)

**Who:** small · **Needs:** W2 merged · **Branch:** `task/T1`

## Goal

`data/<id>/storage.json`: the monthly storage history of a reservoir from California's CDEC,
with the exact query URL as its source. Only reservoirs CDEC reports get one: Crystal Springs
(station `CRY`) now, Hetch Hetchy (`HTH`) when it is added. The validator checks the file when
it exists.

## Steps

1. `git switch -c task/T1`

2. Create `pipeline/storage.py` with exactly this content:

```python
"""Monthly reservoir storage from California CDEC into data/<id>/storage.json.

Usage:  python pipeline/storage.py <id> <CDEC station> [--start YYYY-MM]
Station IDs: https://cdec.water.ca.gov (e.g. CRY Crystal Springs, HTH Hetch Hetchy).
Sensor 15 is reservoir storage in acre-feet; duration M is monthly.
"""
import datetime
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SERVLET = "https://cdec.water.ca.gov/dynamicapp/req/JSONDataServlet"
MISSING = -9999


def cdec_url(station, start, end):
    return f"{SERVLET}?Stations={station}&SensorNums=15&dur_code=M&Start={start}-01&End={end}-28"


def parse_records(records):
    """CDEC JSON records -> [{"month": "YYYY-MM", "acreFeet": int}], oldest first, gaps dropped."""
    months = []
    for r in records:
        if r.get("value") is None or r["value"] == MISSING:
            continue
        year, month = r["date"].split(" ")[0].split("-")[:2]
        months.append({"month": f"{int(year):04d}-{int(month):02d}", "acreFeet": int(r["value"])})
    months.sort(key=lambda m: m["month"])
    return months


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    rid, station = sys.argv[1], sys.argv[2].upper()
    start = sys.argv[sys.argv.index("--start") + 1] if "--start" in sys.argv else "2000-01"
    end = datetime.date.today().strftime("%Y-%m")
    url = cdec_url(station, start, end)
    with urllib.request.urlopen(url, timeout=120) as r:
        months = parse_records(json.load(r))
    if not months:
        sys.exit(f"CDEC returned no monthly storage for station {station}")
    out = ROOT / "data" / rid / "storage.json"
    out.write_text(json.dumps({
        "station": station,
        "unit": "acre-feet",
        "source": url,
        "months": months,
    }, indent=1) + "\n")
    print(f"{rid}: {len(months)} months, {months[0]['month']} to {months[-1]['month']}, latest {months[-1]['acreFeet']} AF")


if __name__ == "__main__":
    main()
```

3. Create `pipeline/tests/test_storage.py`:

```python
from storage import cdec_url, parse_records


def test_parse_sorts_months_and_drops_missing_values():
    records = [
        {"date": "2025-2-1 00:00", "value": 45773},
        {"date": "2024-12-1 00:00", "value": 50904},
        {"date": "2025-1-1 00:00", "value": -9999},
    ]
    assert parse_records(records) == [
        {"month": "2024-12", "acreFeet": 50904},
        {"month": "2025-02", "acreFeet": 45773},
    ]


def test_url_asks_for_monthly_storage():
    url = cdec_url("CRY", "2000-01", "2025-06")
    assert "Stations=CRY" in url and "SensorNums=15" in url and "dur_code=M" in url
```

   Run `python -m pytest pipeline/tests/test_storage.py -q` — **Pass:** `2 passed`.

4. Validator. In `pipeline/validate-bundles.mjs`, inside `validateBundle`, directly before the
   final `return errors;` of that function, add:

```js
  // Optional: monthly storage history (pipeline/storage.py).
  const storagePath = path.join(dir, "storage.json");
  if (await stat(storagePath).then(() => true, () => false)) {
    const storage = JSON.parse(await readFile(storagePath, "utf8")),
      months = storage.months ?? [];
    if (!/^https:\/\//.test(storage.source ?? "")) errors.push(`${id}: storage.json has no https source`);
    if (storage.unit !== "acre-feet") errors.push(`${id}: storage.json unit must be acre-feet`);
    if (!months.length) errors.push(`${id}: storage.json has no months`);
    months.forEach((m, i) => {
      if (!/^\d{4}-\d{2}$/.test(m.month) || !(m.acreFeet >= 0))
        errors.push(`${id}: storage.json month ${i} is malformed`);
      else if (i && !(m.month > months[i - 1].month))
        errors.push(`${id}: storage.json months are out of order at ${m.month}`);
    });
  }
```

5. Validator test. Append to `pipeline/tests/validate-bundles.test.mjs`:

```js
test("storage.json months must be in order", async () => {
  const dir = await bundle();
  await writeFile(path.join(dir, "storage.json"), JSON.stringify({
    station: "CRY", unit: "acre-feet", source: "https://cdec.water.ca.gov/x",
    months: [{ month: "2025-02", acreFeet: 1 }, { month: "2025-01", acreFeet: 2 }],
  }));
  assert.deepEqual(await validateBundle(dir), ["test: storage.json months are out of order at 2025-01"]);
  await rm(path.dirname(dir), { recursive: true });
});
```

   Run `node --test pipeline/tests/validate-bundles.test.mjs` — **Pass:** `ℹ fail 0`.

6. Fetch Crystal Springs (needs internet): `python pipeline/storage.py crystal_springs CRY`
   **Pass:** prints `crystal_springs: N months, … latest … AF` with N above 100, and
   `data/crystal_springs/storage.json` exists.

7. `node pipeline/validate-bundles.mjs` — **Pass:** `Bundles valid.`
   `npm test` — **Pass:** ends with `Journey checks passed.`

8. Commit: `git add pipeline/storage.py pipeline/tests/test_storage.py pipeline/validate-bundles.mjs pipeline/tests/validate-bundles.test.mjs data/crystal_springs/storage.json`
   then `git commit -m "T1: monthly storage from CDEC"`.

9. Add the **Result** section (see AGENTS.md) to this file and commit it.

## Notes

- CDEC station `CRY` reported 61,244 acre-feet in January 2023, more than the Lower Crystal
  Springs dam's rated 57,910 — it likely counts Upper and Lower Crystal Springs together. Show
  storage in acre-feet; do not compute "percent full" from the NID capacity.
- Calaveras, San Antonio and San Andreas have no CDEC storage station (checked 2026-09-27).
