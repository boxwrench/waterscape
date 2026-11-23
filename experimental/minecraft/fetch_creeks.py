"""Creek centre lines from OpenStreetMap for a site, simplified, as a JSON file beside the site.

  python experimental/minecraft/fetch_creeks.py --site experimental/minecraft/sites/sunol_valley.json

Reads the site's "creeks" list (names and widths) and its terrain area, asks the Overpass API for
waterway=river|stream ways with those names, keeps each way's own direction (OpenStreetMap draws
waterways in the direction of flow), converts to UTM zone 10 and drops points closer than a block
to the simplified line. Writes sites/<id>.creeks.json with the query, its date and the licence.
Data (c) OpenStreetMap contributors, ODbL.
"""

import argparse
import datetime
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'pipeline'))
import geo  # noqa: E402

OVERPASS = 'https://overpass-api.de/api/interpreter'


def simplify(points, tolerance):
    """Douglas-Peucker on [(e, n), ...]."""
    if len(points) < 3:
        return points
    (ax, ay), (bx, by) = points[0], points[-1]
    dx, dy = bx - ax, by - ay
    length = (dx * dx + dy * dy) ** .5 or 1e-9
    worst, index = 0.0, 0
    for i, (px, py) in enumerate(points[1:-1], 1):
        d = abs((px - ax) * dy - (py - ay) * dx) / length
        if d > worst:
            worst, index = d, i
    if worst <= tolerance:
        return [points[0], points[-1]]
    return simplify(points[:index + 1], tolerance)[:-1] + simplify(points[index:], tolerance)


def site_bbox(site):
    """The site's terrain area in degrees (south, west, north, east), slightly generous."""
    t, scale = site['terrain'], site['metresPerBlock']
    west, north = t['westUTM'], t['northUTM']
    east, south = west + site['crop']['width'] * scale, north - site['crop']['length'] * scale
    # The area in degrees, slightly generous (UTM to degrees by inverting a few corners roughly).
    lat0, lon0 = 37.0, -122.0
    corners = []
    for e, n in ((west, north), (east, north), (west, south), (east, south)):
        lat, lon = lat0, lon0
        for _ in range(30):   # Newton on the forward projection
            ce, cn = geo.utm(lat, lon, 10)
            lat += (n - cn) / 111000
            lon += (e - ce) / (111000 * 0.79)
        corners.append((lat, lon))
    s, w = min(c[0] for c in corners) - .005, min(c[1] for c in corners) - .005
    n_, e_ = max(c[0] for c in corners) + .005, max(c[1] for c in corners) + .005
    return s, w, n_, e_


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--site', type=Path, required=True)
    args = p.parse_args()
    site = json.loads(args.site.read_text())
    scale = site['metresPerBlock']
    s, w, n_, e_ = site_bbox(site)
    names ='|'.join(c['name'] for c in site['creeks'])
    query = f'[out:json][timeout:120];way["waterway"~"river|stream"]["name"~"^({names})$"]({s:.4f},{w:.4f},{n_:.4f},{e_:.4f});out geom tags;'
    req = urllib.request.Request(OVERPASS, data=urllib.parse.urlencode({'data': query}).encode(),
                                 headers={'User-Agent': 'waterscape-builder/1.0'})
    with urllib.request.urlopen(req, timeout=180) as r:
        elements = json.loads(r.read())['elements']
    lines = []
    for el in elements:
        pts = [geo.utm(g['lat'], g['lon'], 10) for g in el['geometry']]
        pts = [(round(e, 1), round(n, 1)) for e, n in simplify(pts, scale / 2)]
        lines.append({'name': el['tags']['name'], 'osm_way': el['id'], 'utm': pts})
    out = args.site.with_name(f'{site["id"]}.creeks.json')
    out.write_text(json.dumps({
        'source': 'OpenStreetMap via the Overpass API; (c) OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright)',
        'query': query, 'fetched': datetime.date.today().isoformat(), 'crs': 'EPSG:32610',
        'note': f'Each way in its own direction (the direction of flow), simplified to {scale / 2:g} m.',
        'lines': lines}, indent=1) + '\n')
    print(out, len(lines), 'ways', sum(len(l['utm']) for l in lines), 'points')


if __name__ == '__main__':
    main()
