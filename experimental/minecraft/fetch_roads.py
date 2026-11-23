"""Road and trail centre lines from OpenStreetMap for a site, simplified, as a JSON file beside the site.

  python experimental/minecraft/fetch_roads.py --site experimental/minecraft/sites/sunol_valley.json

Asks the Overpass API for every highway way reaching the site's terrain area whose class the site's
"roads" entry lists (paved roads, unpaved tracks, trails), converts to UTM zone 10 and simplifies
to half a block, keeping each way's class, name, surface and bridge tags (the builder picks the
block and width from them). Writes sites/<id>.roads.json with the query, its date and the licence.
Data (c) OpenStreetMap contributors, ODbL.
"""

import argparse
import datetime
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parents[1] / 'pipeline'))
import geo  # noqa: E402
from fetch_creeks import OVERPASS, simplify, site_bbox  # noqa: E402

KEEP = ('name', 'ref', 'highway', 'surface', 'tracktype', 'bridge', 'access')


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--site', type=Path, required=True)
    args = p.parse_args()
    site = json.loads(args.site.read_text())
    s, w, n, e = site_bbox(site)
    classes = sorted({h for kind in site['roads']['kinds'].values() for h in kind['highway']})
    query = f'[out:json][timeout:180];way["highway"~"^({"|".join(classes)})$"]({s:.4f},{w:.4f},{n:.4f},{e:.4f});out geom tags;'
    req = urllib.request.Request(OVERPASS, data=urllib.parse.urlencode({'data': query}).encode(),
                                 headers={'User-Agent': 'waterscape-builder/1.0'})
    for attempt in range(6):   # the public server often answers 502/504 when busy
        try:
            with urllib.request.urlopen(req, timeout=240) as r:
                elements = json.loads(r.read())['elements']
            break
        except OSError as error:
            print('  retry after', error, flush=True)
            time.sleep(20 * (attempt + 1))
    else:
        raise SystemExit('Overpass did not answer')
    scale = site['metresPerBlock']
    t = site['terrain']
    west, north = t['westUTM'], t['northUTM']
    east, south = west + site['crop']['width'] * scale, north - site['crop']['length'] * scale
    lines = []
    for el in elements:
        pts = [geo.utm(g['lat'], g['lon'], 10) for g in el['geometry']]
        if not any(west - 50 <= x <= east + 50 and south - 50 <= y <= north + 50 for x, y in pts):
            continue   # the query box (in degrees) reaches past the area
        pts = [(round(x, 1), round(y, 1)) for x, y in simplify(pts, scale / 2)]
        lines.append({'osm_way': el['id'], **{k: el['tags'][k] for k in KEEP if k in el['tags']}, 'utm': pts})
    out = args.site.with_name(f'{site["id"]}.roads.json')
    out.write_text(json.dumps({
        'source': 'OpenStreetMap via the Overpass API; (c) OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright)',
        'query': query, 'fetched': datetime.date.today().isoformat(), 'crs': 'EPSG:32610',
        'note': f'Simplified to {scale / 2:g} m; tags kept: {", ".join(KEEP)}.',
        'lines': lines}, indent=1) + '\n')
    print(out, len(lines), 'ways', sum(len(l['utm']) for l in lines), 'points')


if __name__ == '__main__':
    main()
