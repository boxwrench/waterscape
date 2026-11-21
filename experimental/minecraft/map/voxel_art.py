"""Voxel dioramas for the HetchyCraft front page (make_front.py): pictures, and data for the live models.

Each diorama is drawn from the reservoir's own bundle (data/<id>/terrain.json + terrain.bin.gz):
the real hills, canyon and shoreline, shrunk to a few dozen columns, with the vertical exaggerated
so the relief reads at that size. Colours come from the world's palette (grass, leaves, water).
Ground cover is a simplified, illustrative version of the browser's rules (rock on steep ground,
trees in valleys and on north-facing slopes); it is art, not a map.
"""
import gzip
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
MC = HERE.parent


def hexrgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)


def load_grid(rid):
    """Height above the water (m), signed shore distance (m, negative on water), valley strength."""
    folder = REPO / 'data' / rid
    meta = json.loads((folder / 'terrain.json').read_text())
    order = ('height', 'shoreDistance', 'valley')
    raw = np.frombuffer(gzip.decompress((folder / 'terrain.bin.gz').read_bytes()), '<u2')
    raw = raw.reshape(-1, meta['height'], meta['width'])[:len(order)]
    planes = np.cumsum(raw, axis=1, dtype=np.uint16).astype(np.float32)
    out = {}
    for plane, name in zip(planes, order):
        out[name] = plane * meta['channels'][name]['scale'] + meta['channels'][name]['offset']
    return meta, out


def dam_lines(rid, meta):
    """Dam crest lines in scene metres, from structures.json or the Minecraft site file."""
    lines = []
    s = REPO / 'data' / rid / 'structures.json'
    if s.exists():
        lines += [d['crestUTM'] for d in json.loads(s.read_text()).get('dams', [])]
    site = MC / 'sites' / f'{rid}.json'
    if site.exists():
        dam = json.loads(site.read_text()).get('dam')
        if dam:
            lines.append(dam['crestUTM'])
    e0, n0 = meta['originUTM']
    return [np.array([[e - e0, n0 - n] for e, n in line]) for line in lines]


def palette(rid, meta):
    """Block colours for one reservoir, from its Minecraft palette or the Sierra datapack."""
    biome = meta.get('biome', '')
    if biome.startswith('diablo'):
        pal = json.loads((MC / 'palettes' / 'diablo-oak.json').read_text())
        fx = pal['biomeColours']['effects']
        return {'grass': hexrgb(fx['grass_color']) * 0.88, 'water': hexrgb(fx['water_color']),
                'leaves': [hexrgb('#3f5226'), hexrgb('#8d9a7c'), hexrgb(fx['foliage_color'])],
                'rock': hexrgb('#8f8a80'), 'dirt': hexrgb('#8a6745'), 'stone': hexrgb('#6f6c68'),
                'log': hexrgb('#4a3826'), 'dam': hexrgb('#a39d92'), 'trees': 0.42, 'steep': 0.55}
    bc = json.loads((MC / 'pack' / 'biome_colours.json').read_text())
    fx = bc.get('effects', bc)
    grass = fx.get('grass_color', '#7f8a4a')
    water = fx.get('water_color', '#2f6f86')
    return {'grass': hexrgb(grass) * 0.85, 'water': hexrgb(water),
            'leaves': [hexrgb('#2c4a2e'), hexrgb('#35573a'), hexrgb('#263f28')],
            'rock': hexrgb('#c9c3b6'), 'dirt': hexrgb('#7a6650'), 'stone': hexrgb('#9a958c'),
            'log': hexrgb('#4b3a2a'), 'dam': hexrgb('#ddd8cd'), 'trees': 0.42, 'steep': 0.5}


def hash2(a, b, seed=0):
    v = (np.asarray(a, np.int64) * 73856093) ^ (np.asarray(b, np.int64) * 19349663) ^ (seed * 83492791)
    v = ((v ^ (v >> 13)) & 0xFFFFFFF) * 1274126177 & 0xFFFFFFFFFFFF
    return ((v ^ (v >> 16)) & 0xFFFF) / 65535.0


def columns(rid, n=64, target_relief=15, margin=0.3, min_aspect=0.6, max_exag=3.0, rotation=None):
    """Grid of block columns: heights (blocks), kind per column, tree heights, palette.

    The crop is the lake's bounding box plus a margin, at least min_aspect as deep as it is wide;
    n columns along its long side. rotation: quarter turns of the view (default: dam at the back)."""
    meta, g = load_grid(rid)
    water = g['shoreDistance'] < 0
    rows, cols = np.nonzero(water)
    H, W = water.shape
    r0, r1, c0, c1 = rows.min(), rows.max(), cols.min(), cols.max()
    hr, hc = (r1 - r0) * (0.5 + margin), (c1 - c0) * (0.5 + margin)
    hr, hc = max(hr, hc * min_aspect), max(hc, hr * min_aspect)
    rc, cc = (r0 + r1) / 2, (c0 + c1) / 2
    hr, hc = min(hr, rc, H - 1 - rc), min(hc, cc, W - 1 - cc)
    ra, ca = rc - hr, cc - hc
    step = 2 * max(hr, hc) / n
    nr, nc = max(8, int(round(2 * hr / step))), max(8, int(round(2 * hc / step)))

    def block(a, how):
        out = np.zeros((nr, nc), np.float32)
        for i in range(nr):
            for j in range(nc):
                tile = a[int(ra + i * step):int(ra + (i + 1) * step) + 1, int(ca + j * step):int(ca + (j + 1) * step) + 1]
                out[i, j] = how(tile)
        return out

    h = block(g['height'], np.mean)
    wet = block(water.astype(np.float32), np.mean) > 0.4
    valley = block(g['valley'], np.mean)
    m_per_block = step * meta['cell'][0]
    relief = max(np.percentile(h[~wet], 97), 1.0)
    exag = float(np.clip(target_relief * m_per_block / relief, 1.0, max_exag))
    # Steepness on the real ground (rise over run in metres), before any exaggeration.
    rz, rx = np.gradient(h, m_per_block)
    real_slope = np.hypot(rx, rz)
    k = np.round(h / m_per_block * exag).astype(int)
    k[wet] = 0
    k[(~wet) & (k <= 0) & (h > 0)] = 1

    pal = palette(rid, meta)
    kind = np.full((nr, nc), 'grass', object)
    kind[wet] = 'water'
    kind[(~wet) & (real_slope > pal['steep'])] = 'rock'
    # Dams: columns the crest line passes through.
    x0, z0 = meta['gridOrigin']
    cell = meta['cell'][0]
    for line in dam_lines(rid, meta):
        for t in np.linspace(0, 1, 200):
            seg = t * (len(line) - 1)
            a = min(int(seg), len(line) - 2)
            p = line[a] + (line[a + 1] - line[a]) * (seg - a)
            j = int(((p[0] - x0) / cell - ca) / step)
            i = int(((p[1] - z0) / cell - ra) / step)
            if 0 <= i < nr and 0 <= j < nc:
                kind[i, j] = 'dam'
                k[i, j] = max(k[i, j], int(np.max(k[max(0, i - 1):i + 2, max(0, j - 1):j + 2])))
    # Trees: valleys and north-facing slopes (height rising southward), thinned by a hash.
    vn = (valley - np.percentile(valley, 20)) / max(np.percentile(valley, 95) - np.percentile(valley, 20), 1e-6)
    north = np.clip(rz / (pal['steep'] + 1e-6), 0, 1)
    ii, jj = np.mgrid[0:nr, 0:nc]
    p = pal['trees'] * (0.35 + 0.9 * np.clip(vn, 0, 1) + 0.7 * north)
    # No trees right on the shore, so the water stays visible at this size.
    from scipy.ndimage import binary_dilation
    shore = binary_dilation(wet, iterations=1)
    trees = np.where((kind == 'grass') & ~shore & (hash2(ii, jj, 7) < p), 1 + (hash2(ii, jj, 9) > 0.6), 0)
    species = (hash2(ii, jj, 11) * 3).astype(int)
    return {'k': k, 'kind': kind, 'trees': trees, 'species': species, 'pal': pal, 'exag': exag,
            'rotation': best_rotation(kind) if rotation is None else rotation}


def from_site(rid, art):
    """columns() with the settings in sites/<id>.json "art" (all optional)."""
    return columns(rid, n=art.get('columns', 64), margin=art.get('margin', 0.3),
                   max_exag=art.get('maxExaggeration', 3.0), rotation=art.get('rotation'))


def best_rotation(kind):
    """Quarter turns that put the dam at the back of the view, so the lake sits in front of it."""
    dam = np.argwhere(kind == 'dam')
    if not len(dam):
        return 0
    best, score = 0, None
    for rot in range(4):
        rotated = np.rot90(kind == 'dam', -rot)
        r, c = np.nonzero(rotated)
        s = ((r + c) / sum(rotated.shape)).mean()
        if score is None or s < score:
            best, score = rot, s
    return best


def render(cols, width=640, path=None, scale=2):
    """Isometric PNG of the columns, painted back to front."""
    k, kind, trees, species = (np.rot90(cols[x], -cols['rotation']) for x in ('k', 'kind', 'trees', 'species'))
    pal = cols['pal']
    nr, nc = k.shape
    tw = width * scale / ((nr + nc) / 2)  # top diamond width
    th = tw / 2                      # top diamond height
    vh = tw * 0.58                   # block side height
    base = min(int(k.min()) - 3, -3)
    top = int(k.max() + trees.max() + 1)
    img_w = int((nr + nc) * tw / 2 + tw)
    img_h = int((nr + nc) * th / 2 + (top - base) * vh + th * 2)
    img = Image.new('RGBA', (img_w, img_h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    ox, oy = nr * tw / 2 + tw / 2, top * vh + th / 2

    def col(c, shade, i, j, y):
        jit = 0.93 + 0.14 * hash2(i * 131 + y, j * 71 - y, 3)
        return tuple(int(v) for v in np.clip(c * shade * jit, 0, 255)) + (255,)

    def cube(i, j, y, ctop, cside, faces=(True, True, True)):
        cx = ox + (j - i) * tw / 2
        cy = oy + (i + j) * th / 2 - y * vh
        t = [(cx, cy - th / 2), (cx + tw / 2, cy), (cx, cy + th / 2), (cx - tw / 2, cy)]
        if faces[0]:
            d.polygon([t[3], t[2], (t[2][0], t[2][1] + vh), (t[3][0], t[3][1] + vh)], fill=col(cside, 0.78, i, j, y))
        if faces[1]:
            d.polygon([t[2], t[1], (t[1][0], t[1][1] + vh), (t[2][0], t[2][1] + vh)], fill=col(cside, 0.6, i, j, y))
        if faces[2]:
            d.polygon(t, fill=col(ctop, 1.0, i, j, y))

    def kin(i, j):
        return int(k[i, j]) if 0 <= i < nr and 0 <= j < nc else base

    for s in range(nr + nc - 1):
        for i in range(max(0, s - nc + 1), min(nr, s + 1)):
            j = s - i
            h = int(k[i, j])
            front_l, front_r = kin(i + 1, j), kin(i, j + 1)
            low = min(front_l, front_r)
            what = kind[i, j]
            for y in range(max(base, low - 1), h + 1):
                below = h - y
                if what == 'water':
                    side = pal['water'] if y == h else pal['stone']
                elif what == 'dam':
                    side = pal['dam']
                elif below == 0:
                    side = pal['rock'] if what == 'rock' else pal['dirt']
                elif below < 3 and what != 'rock':
                    side = pal['dirt']
                else:
                    side = pal['stone'] if what != 'rock' else pal['rock'] * 0.9
                ctop = {'water': pal['water'] * 1.15, 'rock': pal['rock'], 'dam': pal['dam'],
                        'grass': pal['grass']}[what]
                cube(i, j, y, ctop, side, (y >= front_l - 1, y >= front_r - 1, y == h))
            for t in range(int(trees[i, j])):
                leaf = pal['leaves'][int(species[i, j]) % len(pal['leaves'])]
                cube(i, j, h + 1 + t, leaf * 1.08, leaf)
    out = img.resize((int(img_w / scale), int(img_h / scale)), Image.LANCZOS)
    bbox = out.getbbox()
    out = out.crop(bbox)
    if path:
        out.save(path, optimize=True)
    return out


def export(cols):
    """The columns as compact JSON for the page's live models (front/front.js)."""
    k = cols['k']
    code = {'grass': 'g', 'water': 'w', 'rock': 'r', 'dam': 'd'}
    pal = cols['pal']

    def hx(c):
        return '#%02x%02x%02x' % tuple(int(v) for v in np.clip(c, 0, 255))
    return {
        'nr': int(k.shape[0]), 'nc': int(k.shape[1]), 'rotation': int(cols['rotation']),
        'base': int(min(k.min() - 3, -3)), 'top': int(k.max() + cols['trees'].max() + 1),
        'k': [int(v) for v in k.ravel()],
        'kind': ''.join(code[v] for v in cols['kind'].ravel()),
        'trees': ''.join(str(int(v)) for v in cols['trees'].ravel()),
        'species': ''.join(str(int(v) % 10) for v in cols['species'].ravel()),
        'pal': {name: hx(pal[name]) for name in ('grass', 'water', 'rock', 'dirt', 'stone', 'dam')}
        | {'leaves': [hx(c) for c in pal['leaves']]},
    }


if __name__ == '__main__':
    import sys
    rid = sys.argv[1] if len(sys.argv) > 1 else 'calaveras'
    c = columns(rid)
    render(c, 640, Path(sys.argv[2]) if len(sys.argv) > 2 else Path(f'/tmp/{rid}.png'))
    print(rid, 'exaggeration', round(c['exag'], 2), 'rotation', c['rotation'])
