"""Write the BlueMap map config and the panel text for one reservoir's web map.

    python make_site.py --site sites/hetch_hetchy.json --world <original world> --relit <relit copy> \
        --conf-out <bluemap config>/maps/<id>.conf --json-out <webroot>/waterscape-site.json

- The panel text comes from the reservoir's own bundle, data/<id>/story.json (name, headline,
  facts), so every number shown already has its source recorded there.
- The render area is the rectangle of chunks the original world holds (read from the region
  file headers). Lighting the edge chunks on a server makes the game start generating chunks
  just outside; the mask keeps those off the map.
- The site file (sites/<id>.json) only holds what cannot be derived: viewpoints, what is
  illustrative and, optionally, the sky colour ("sky", from the world's biome datapack).
"""
import argparse
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
REPO_URL = 'https://github.com/boxwrench/waterscape'


def chunk_extent(world):
    """(min_x, max_x, min_z, max_z) in blocks over every chunk stored in the overworld region files."""
    region = world / 'dimensions' / 'minecraft' / 'overworld' / 'region'
    if not region.is_dir():
        region = world / 'region'  # worlds from before 26.x
    xs, zs = [], []
    for f in region.glob('r.*.*.mca'):
        rx, rz = map(int, f.name.split('.')[1:3])
        head = f.read_bytes()[:4096]
        if len(head) < 4096:
            continue
        for i in range(1024):
            if int.from_bytes(head[i * 4:i * 4 + 4], 'big'):
                xs.append(rx * 32 + i % 32)
                zs.append(rz * 32 + i // 32)
    if not xs:
        raise SystemExit(f'no chunks found in {region}')
    return min(xs) * 16, max(xs) * 16 + 15, min(zs) * 16, max(zs) * 16 + 15


def panel(site, story):
    wanted = site.get('facts') or [f['label'] for f in story.get('facts', []) if f.get('featured')]
    facts = {f['label']: f['value'] for f in story.get('facts', [])}
    missing = [w for w in wanted if w not in facts]
    if missing:
        raise SystemExit(f'facts not in story.json: {missing}')
    return {
        'id': site['id'],
        'name': story['name'],
        'headline': story['headline'],
        'facts': [f'{w}: {facts[w]}' for w in wanted],
        'sources': f"{REPO_URL}/blob/main/data/{site['id']}/story.json",
        'illustrative': site.get('illustrative', ''),
        'data': site.get('data', ''),
        'osm': site.get('osm', False),
        'overview': site['viewpoints']['overview'],
        'first_person': site['viewpoints']['first_person'],
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--site', required=True, type=Path)
    ap.add_argument('--world', required=True, type=Path, help='the original world (for the map area)')
    ap.add_argument('--relit', required=True, type=Path, help='the lit copy BlueMap reads')
    ap.add_argument('--conf-out', required=True, type=Path)
    ap.add_argument('--json-out', required=True, type=Path)
    a = ap.parse_args()

    site = json.loads(a.site.read_text())
    story = json.loads((REPO / 'data' / site['id'] / 'story.json').read_text())
    x0, x1, z0, z1 = chunk_extent(a.world)
    sx, sz = site.get('start', [(x0 + x1) // 2, (z0 + z1) // 2])
    conf = (HERE / 'bluemap' / 'map.conf.template').read_text()
    sky = site.get('sky', '#6c9ee6')
    for key, value in {'WORLD': str(a.relit.resolve()), 'NAME': story['name'], 'SKY': sky, 'START_X': sx, 'START_Z': sz,
                       'MIN_X': x0, 'MAX_X': x1, 'MIN_Z': z0, 'MAX_Z': z1}.items():
        conf = conf.replace(f'@{key}@', str(value))
    a.conf_out.parent.mkdir(parents=True, exist_ok=True)
    a.conf_out.write_text(conf)
    a.json_out.parent.mkdir(parents=True, exist_ok=True)
    a.json_out.write_text(json.dumps(panel(site, story), indent=2) + '\n')
    print(f"{story['name']}: map area x {x0}..{x1}, z {z0}..{z1}; start {sx},{sz}")


if __name__ == '__main__':
    main()
