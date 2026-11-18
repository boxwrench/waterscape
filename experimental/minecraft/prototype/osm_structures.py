"""Graded roads, a dam-crest walkway and simple buildings from the cropped OSM extract.

Replaces archive/add_osm_features.py's flat road lines and box shells. Dry run unless --apply; edit only
a disposable world copy with Minecraft closed.

What is mapped and what is illustrative:
- Road centre lines, classes, lanes, surfaces and bridge tags come from OpenStreetMap
  (© OpenStreetMap contributors, ODbL). Widths are per class/lanes at 2 m per block; the grade is
  the ground smoothed along each road, with half-slabs between full blocks. Cut faces, fill,
  stone guard walls (in the manner of Yosemite's masonry walls), tunnels in deep cuts, bridge decks
  and railings are illustrative.
- Building footprints and building:levels come from OSM. Walls, windows, doors, roofs and
  materials are generic, and buildings use playable height (3 blocks per storey), not the
  world's 4 m vertical scale, which would make a cabin one block tall.
- The dam-crest parapets follow structures.json's crest and the browser's gravity profile.
"""
import argparse, collections, json, math, pathlib, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import binary_dilation, binary_erosion, distance_transform_cdt
from scipy.spatial import ConvexHull
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from world_columns import World, state, Y0, AIR, PLANTS
from pyproj import Transformer

V1_BLOCKS = {'minecraft:stone_bricks', 'minecraft:spruce_planks'}      # add_osm_features.py shells
V1_ROADS = {'minecraft:packed_mud', 'minecraft:gray_concrete'}         # add_osm_features.py roads
CLASSES = {   # width (blocks), rank (junction priority), smoothing window (blocks)
    'tertiary': (4, 6, 22), 'secondary': (4, 7, 24), 'primary': (5, 8, 26),
    'unclassified': (3, 5, 20), 'residential': (3, 4, 16), 'service': (3, 3, 14),
    'track': (2, 2, 9), 'path': (1, 1, 3), 'footway': (1, 1, 3), 'bridleway': (1, 1, 3),
}
DIRS = {'east': (1, 0), 'west': (-1, 0), 'south': (0, 1), 'north': (0, -1)}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--world', required=True, type=pathlib.Path)
    p.add_argument('--osm', required=True, type=pathlib.Path)
    p.add_argument('--structures', required=True, type=pathlib.Path)
    p.add_argument('--shift-face-drop', type=float, default=None,
                   help='if the canyon was moved upstream (rebuild_downstream.py --close-gap shift), '
                        'the same --face-drop, so mapped roads and buildings move with it')
    p.add_argument('--apply', action='store_true')
    a = p.parse_args()
    marker = a.world / 'waterscape-osm-structures.txt'
    if marker.exists():
        raise SystemExit('Already applied to this world; start from another copy.')
    meta = json.loads((a.world / 'metadata.json').read_text(encoding='utf-8-sig'))
    elements = json.loads(a.osm.read_text(encoding='utf-8-sig'))['elements']
    st = json.loads(a.structures.read_text())
    stats = collections.Counter()

    def mc(lon, lat):
        return ((lon - meta['minGeoLon']) / (meta['maxGeoLon'] - meta['minGeoLon']) * meta['maxMcX'],
                (meta['maxGeoLat'] - lat) / (meta['maxGeoLat'] - meta['minGeoLat']) * meta['maxMcZ'])

    nodes = {e['id']: mc(e['lon'], e['lat']) for e in elements if e['type'] == 'node'}
    if a.shift_face_drop:
        import warp
        wp = warp.load(a.world, a.structures, a.shift_face_drop)
        ids = list(nodes); moved = wp.move_points(np.array([nodes[i] for i in ids]))
        stats['mapped points moved with the canyon'] = int((np.hypot(*(moved - np.array([nodes[i] for i in ids])).T) > .5).sum())
        nodes = {i: tuple(q) for i, q in zip(ids, moved)}
    ways = []
    for e in elements:
        if e['type'] != 'way':
            continue
        pts = np.array([nodes[i] for i in e['nodes'] if i in nodes], dtype=float)
        if len(pts) >= 2:
            ways.append((e['id'], e.get('tags', {}), pts))
    roads = [w for w in ways if w[1].get('highway') in CLASSES]
    buildings = [w for w in ways if 'building' in w[1] and len(w[2]) >= 3]

    # Work grid: everything the features touch, plus a margin.
    allpts = np.vstack([w[2] for w in roads + buildings])
    gx0 = max(0, int(allpts[:, 0].min()) - 12); gz0 = max(0, int(allpts[:, 1].min()) - 12)
    gx1 = min(meta['maxMcX'], int(allpts[:, 0].max()) + 12); gz1 = min(meta['maxMcZ'], int(allpts[:, 1].max()) + 12)
    GW, GH = gx1 - gx0 + 1, gz1 - gz0 + 1
    need = np.zeros((GH, GW), bool)
    img = Image.new('1', (GW, GH)); d = ImageDraw.Draw(img)
    for _, tag, pts in roads:
        d.line([(x - gx0, z - gz0) for x, z in pts], fill=1, width=CLASSES[tag['highway']][0] + 16)
    for _, tag, pts in buildings:
        d.polygon([(x - gx0, z - gz0) for x, z in pts], fill=1, outline=1)
    need = binary_dilation(np.asarray(img, bool), iterations=8)
    w = World(a.world)
    keys = {((gx0 + x) >> 4, (gz0 + z) >> 4) for z, x in np.argwhere(need)}
    w.load(keys)
    stats['chunks loaded'] = len(w.cols)

    # Ground and water for the grid. Ground ignores trees, plants, water and the old shells.
    loaded = np.zeros((GH, GW), bool)
    for cx, cz in w.cols:
        xs = slice(max(cx * 16, gx0) - gx0, min(cx * 16 + 16, gx1 + 1) - gx0)
        zs = slice(max(cz * 16, gz0) - gz0, min(cz * 16 + 16, gz1 + 1) - gz0)
        if xs.start < xs.stop and zs.start < zs.stop:
            loaded[zs, xs] = True

    def ground_arrays():
        soft = w.flags(lambda s: s in AIR or s in PLANTS or s == 'minecraft:water' or s.endswith('_leaves')
                       or s.endswith('_log') or s in V1_BLOCKS or s.endswith('_wall') or s.endswith('_fence')
                       or s.endswith('_door') or s in ('minecraft:glass', 'minecraft:lantern'))
        wet = w.flags(lambda s: s == 'minecraft:water')
        G = np.full((GH, GW), -999, np.int32); WL = np.full((GH, GW), -999, np.int32); TOP = np.zeros((GH, GW), np.int32)
        for (cx, cz), full in w.cols.items():
            solid = ~soft[full]; wat = wet[full]
            g = np.where(solid.any(0), 383 - np.argmax(solid[::-1], 0), -1)
            wl = np.where(wat.any(0), 383 - np.argmax(wat[::-1], 0), -1)
            tb = np.take_along_axis(full, np.maximum(g, 0)[None], 0)[0]
            xs = slice(max(cx * 16, gx0), min(cx * 16 + 16, gx1 + 1)); zs = slice(max(cz * 16, gz0), min(cz * 16 + 16, gz1 + 1))
            if xs.start >= xs.stop or zs.start >= zs.stop:
                continue
            lx = slice(xs.start - cx * 16, xs.stop - cx * 16); lz = slice(zs.start - cz * 16, zs.stop - cz * 16)
            G[zs.start - gz0:zs.stop - gz0, xs.start - gx0:xs.stop - gx0] = (g + Y0)[lz, lx]
            WL[zs.start - gz0:zs.stop - gz0, xs.start - gx0:xs.stop - gx0] = np.where(wl[lz, lx] >= 0, wl[lz, lx] + Y0, -999)
            TOP[zs.start - gz0:zs.stop - gz0, xs.start - gx0:xs.stop - gx0] = tb[lz, lx]
        return G, WL, TOP

    # 1. Remove the old shells and flat road lines.
    v1 = w.flags(lambda s: s in V1_BLOCKS)
    for key, full in w.cols.items():
        m = v1[full]
        if m.any():
            full[m] = w.AIR; w.dirty.add(key); stats['old shell blocks removed'] += int(m.sum())
    G, WL, TOP = ground_arrays()
    oldroad = w.flags(lambda s: s in V1_ROADS)
    natural = w.flags(lambda s: s in ('minecraft:stone', 'minecraft:diorite', 'minecraft:andesite', 'minecraft:gravel',
                                      'minecraft:coarse_dirt', 'minecraft:calcite', 'minecraft:grass_block',
                                      'minecraft:tuff', 'minecraft:dirt'))
    for z, x in np.argwhere(oldroad[TOP] & loaded):
        nb = [int(TOP[zz, xx]) for zz in range(max(0, z - 3), min(GH, z + 4)) for xx in range(max(0, x - 3), min(GW, x + 4))
              if natural[TOP[zz, xx]]]
        rep = collections.Counter(nb).most_common(1)[0][0] if nb else w.gid('stone')
        w.set(gx0 + x, int(G[z, x]), gz0 + z, rep); stats['old road cells restored'] += 1
    G, WL, TOP = ground_arrays()
    is_dam = w.flags(lambda s: s == 'minecraft:smooth_stone')[TOP]

    # 2. Roads, most important first; lesser roads are pinned to them where they meet.
    B = {k: w.gid(state(k)) for k in ['stone', 'cobblestone', 'gravel', 'dirt_path', 'coarse_dirt', 'polished_deepslate',
                                       'smooth_stone', 'spruce_planks', 'stone_bricks', 'air']}
    slab = {'polished_deepslate': w.gid(state('polished_deepslate_slab', type='bottom', waterlogged='false')),
            'smooth_stone': w.gid(state('smooth_stone_slab', type='bottom', waterlogged='false'))}
    RY = np.full((GH, GW), np.nan); RMAT = np.full((GH, GW), '', dtype=object)
    RANK = np.full((GH, GW), -1); SHOULDER = np.zeros((GH, GW), bool); BRIDGE = np.zeros((GH, GW), bool)
    RD = np.full((GH, GW), 99.0); RHW = np.zeros((GH, GW))
    order = sorted(roads, key=lambda r: -CLASSES[r[1]['highway']][1])
    for wid, tag, pts in order:
        width, rank, win = CLASSES[tag['highway']]
        lanes = int(tag['lanes']) if str(tag.get('lanes', '')).isdigit() else None
        if lanes and tag['highway'] not in ('track', 'path', 'footway'):
            width = max(width, round(lanes * 1.75 + .5))
        surface = tag.get('surface', '')
        if tag['highway'] in ('track', 'path', 'footway', 'bridleway') or surface in ('unpaved', 'gravel', 'dirt', 'ground', 'compacted'):
            mat = 'dirt_path'
        elif surface == 'concrete':
            mat = 'smooth_stone'
        else:
            mat = 'polished_deepslate'
        bridge = tag.get('bridge') == 'yes'
        # Samples every half block along the line, the ground under each, then a smoothed grade.
        seg = np.diff(pts, axis=0); L = np.hypot(seg[:, 0], seg[:, 1]); cum = np.concatenate([[0], np.cumsum(L)])
        s = np.arange(0, cum[-1] + .25, .5)
        sx = np.interp(s, cum, pts[:, 0]); sz = np.interp(s, cum, pts[:, 1])
        ix = np.clip(np.rint(sx).astype(int) - gx0, 0, GW - 1); iz = np.clip(np.rint(sz).astype(int) - gz0, 0, GH - 1)
        ok = loaded[iz, ix]
        if not ok.any():
            continue
        gy = G[iz, ix].astype(float)
        over = WL[iz, ix] >= G[iz, ix]
        gy = np.where(over, WL[iz, ix] + 1.0, gy)
        gy = np.where(ok, gy, np.nan)
        if np.isnan(gy).all():
            continue
        gy = np.where(np.isnan(gy), np.nanmean(gy), gy)
        pin = ~np.isnan(RY[iz, ix]); pinv = RY[iz, ix]
        dam_s = is_dam[iz, ix]
        pin |= dam_s; pinv = np.where(dam_s, G[iz, ix] + 1.0 - 1e-3, pinv)   # meet the dam crest at its surface
        y = np.where(pin, pinv, gy)
        k = max(1, int(win / .5))
        for _ in range(3):
            pad = np.pad(y, k, mode='edge')
            y = np.convolve(pad, np.ones(2 * k + 1) / (2 * k + 1), mode='same')[k:-k]
            y = np.where(pin, pinv, y)
        # Cross-section: distance to the line and position along it, for cells near the road.
        hw = width / 2
        bx0 = max(0, int(pts[:, 0].min() - hw - 3) - gx0); bx1 = min(GW, int(pts[:, 0].max() + hw + 4) - gx0)
        bz0 = max(0, int(pts[:, 1].min() - hw - 3) - gz0); bz1 = min(GH, int(pts[:, 1].max() + hw + 4) - gz0)
        X, Z = np.meshgrid(np.arange(bx0, bx1) + gx0, np.arange(bz0, bz1) + gz0)
        best = np.full(X.shape, 1e9); along = np.zeros(X.shape)
        for i in range(len(pts) - 1):
            A = pts[i]; v = seg[i]
            if L[i] == 0:
                continue
            t = np.clip(((X - A[0]) * v[0] + (Z - A[1]) * v[1]) / (L[i] ** 2), 0, 1)
            dd = np.hypot(X - (A[0] + t * v[0]), Z - (A[1] + t * v[1]))
            m = dd < best; best[m] = dd[m]; along[m] = cum[i] + t[m] * L[i]
        yy = np.interp(along, s, y)
        sub = np.s_[bz0:bz1, bx0:bx1]
        road = (best <= hw) & loaded[sub]
        shoulder = (best > hw) & (best <= hw + 1) & loaded[sub]
        take = road & (np.isnan(RY[sub]) | SHOULDER[sub])
        for arr, val in ((RY, yy), (RMAT, mat), (RANK, rank), (BRIDGE, bridge), (RD, best), (RHW, hw)):
            arr[sub][take] = val[take] if isinstance(val, np.ndarray) else val
        SHOULDER[sub][take] = False
        takes = shoulder & np.isnan(RY[sub])
        for arr, val in ((RY, yy), (RMAT, mat), (RANK, rank), (BRIDGE, bridge), (RD, best), (RHW, hw)):
            arr[sub][takes] = val[takes] if isinstance(val, np.ndarray) else val
        SHOULDER[sub][takes] = True
        stats['roads laid'] += 1

    _ct = {}

    def is_tree(ids):
        """Trees and plants among block ids; the palette grows as blocks are added."""
        if _ct.get('n') != len(w.names):
            _ct['f'] = w.flags(lambda s: s.endswith('_leaves') or s.endswith('_log') or s in PLANTS); _ct['n'] = len(w.names)
        return _ct['f'][ids]
    walls = []; fences = []
    lantern = w.gid(state('lantern', hanging='false', waterlogged='false'))
    for z, x in np.argwhere(~np.isnan(RY)):
        X_, Z_ = gx0 + x, gz0 + z
        gn, wl, y = int(G[z, x]), int(WL[z, x]), float(RY[z, x])
        if gn < -900 or is_dam[z, x]:
            continue
        base = int(math.floor(y + 1e-6)); half = (y - base) >= .5
        mat = RMAT[z, x]; col = w.column(X_, Z_)
        top_m = B[mat]
        wet = wl >= gn
        if not SHOULDER[z, x]:
            if wet:
                if BRIDGE[z, x]:
                    deck = max(base, wl + 1)
                    col[deck - Y0] = B['spruce_planks']; col[deck + 1 - Y0:deck + 8 - Y0] = B['air']
                    if RD[z, x] < .75 and (X_ * 3 + Z_ * 5) % 6 == 0:
                        col[gn + 1 - Y0:deck - Y0] = B['stone_bricks']
                    stats['bridge cells'] += 1
                else:
                    col[gn + 1 - Y0:base - Y0] = B['stone']; col[base - Y0] = top_m
                    col[base + 1 - Y0:base + 8 - Y0] = B['air']; stats['causeway cells'] += 1
                continue
            cut = gn - base
            if cut > 5:
                col[base - Y0] = top_m; col[base + 1 - Y0:base + 5 - Y0] = B['air']
                if RD[z, x] > RHW[z, x] - 1 and (X_ * 7 + Z_ * 11) % 9 == 0:
                    col[base + 1 - Y0] = lantern
                stats['tunnel cells'] += 1
                continue
            if base > gn:
                col[gn + 1 - Y0:base - Y0] = B['stone']; stats['fill cells'] += 1
            elif cut > 0:
                stats['cut cells'] += 1
            col[base - Y0] = top_m
            col[base + 1 - Y0:base + 12 - Y0] = B['air']
            if half and mat in slab:
                col[base + 1 - Y0] = slab[mat]
            m = is_tree(col[base + 12 - Y0:base + 30 - Y0])
            col[base + 12 - Y0:base + 30 - Y0][m] = B['air']
            stats['road cells'] += 1
        else:
            if wet:
                if BRIDGE[z, x]:
                    deck = max(base, wl + 1)
                    col[deck - Y0] = B['spruce_planks']; col[deck + 1 - Y0:deck + 8 - Y0] = B['air']
                    fences.append((X_, deck + 1, Z_)); col[deck + 1 - Y0] = w.gid('spruce_fence')
                continue
            fill = base - gn
            if fill >= 2:
                col[gn + 1 - Y0:base + 1 - Y0] = B['cobblestone']
                col[base + 1 - Y0:base + 12 - Y0] = B['air']
                if mat != 'dirt_path' or fill >= 3:
                    col[base + 1 - Y0] = w.gid('cobblestone_wall'); walls.append((X_, base + 1, Z_))
                stats['guard wall cells'] += 1
            elif gn - base > 5:
                col[base + 1 - Y0:base + 5 - Y0] = B['air']      # tunnel width
            else:
                if base > gn:
                    col[gn + 1 - Y0:base - Y0] = B['stone']
                col[base - Y0] = B['gravel'] if mat != 'dirt_path' else B['coarse_dirt']
                col[base + 1 - Y0:base + 12 - Y0] = B['air']
            m = is_tree(col[base + 1 - Y0:base + 30 - Y0])
            col[base + 1 - Y0:base + 30 - Y0][m] = B['air']

    # 3. Dam crest parapets: crest blocks at the crest height next to anything lower.
    G, WL, TOP = ground_arrays()
    crest_y = int(round(80 + (st['dams'][0]['crestElevation'] - 1151.7) / 4))
    crest = np.array([mc(*Transformer.from_crs(32611, 4326, always_xy=True).transform(*q)) for q in st['dams'][0]['crestUTM']])
    Xg, Zg = np.meshgrid(np.arange(GW) + gx0, np.arange(GH) + gz0)
    dmin = np.full((GH, GW), 1e9)
    for i in range(len(crest) - 1):
        A, Bv = crest[i], crest[i + 1]; v = Bv - A
        t = np.clip(((Xg - A[0]) * v[0] + (Zg - A[1]) * v[1]) / (v @ v), 0, 1)
        dmin = np.minimum(dmin, np.hypot(Xg - (A[0] + t * v[0]), Zg - (A[1] + t * v[1])))
    dam_top = w.flags(lambda s: s == 'minecraft:smooth_stone')[TOP] & (G == crest_y) & (dmin <= 5)
    edge = np.zeros((GH, GW), bool)
    for z, x in np.argwhere(dam_top):
        for dx, dz in DIRS.values():
            zz, xx = z + dz, x + dx
            if 0 <= zz < GH and 0 <= xx < GW and loaded[zz, xx] and G[zz, xx] < crest_y and not dam_top[zz, xx]:
                edge[z, x] = True
    # Walls join only side to side: where the curved edge steps diagonally, fill the corner.
    for z, x in np.argwhere(edge):
        for dz, dx in ((1, 1), (1, -1)):
            zz, xx = z + dz, x + dx
            if 0 <= zz < GH and 0 <= xx < GW and edge[zz, xx] and not edge[z, xx] and not edge[zz, x]:
                if dam_top[z, xx]:
                    edge[z, xx] = True
                elif dam_top[zz, x]:
                    edge[zz, x] = True
    for z, x in np.argwhere(edge):
        w.set(gx0 + x, crest_y + 1, gz0 + z, 'andesite_wall'); walls.append((gx0 + x, crest_y + 1, gz0 + z))
        stats['parapet blocks'] += 1

    # 4. Buildings. Each OSM footprint becomes its minimum rotated rectangle laid square to the
    # block grid (same centre, size and long axis); rotated pixel outlines leave gappy walls.
    road_mask = ~np.isnan(RY) & ~SHOULDER

    def rect(pts):
        P = np.unique(pts, axis=0)
        try:
            hull = P[ConvexHull(P).vertices]
        except Exception:
            hull = P
        best = None
        for i in range(len(hull)):
            e = hull[(i + 1) % len(hull)] - hull[i]
            if not e.any():
                continue
            ang = math.atan2(e[1], e[0]); c, s_ = math.cos(ang), math.sin(ang)
            R2 = np.array([[c, s_], [-s_, c]]); q = hull @ R2.T
            lo, hi = q.min(0), q.max(0); area = np.prod(hi - lo)
            if best is None or area < best[0]:
                best = (area, ang, lo, hi, R2)
        _, ang, lo, hi, R2 = best
        centre = ((lo + hi) / 2) @ R2              # back to world axes
        a, b = hi - lo                             # along ang, across
        if abs(math.cos(ang)) < abs(math.sin(ang)):
            a, b = b, a                            # the side nearer the x axis is the x size
        wx, wz = max(3, int(round(a))), max(3, int(round(b)))
        x0 = int(round(centre[0] - wx / 2)); z0 = int(round(centre[1] - wz / 2))
        return x0, z0, wx, wz

    rects = [(bid, tag, *rect(pts)) for bid, tag, pts in buildings]
    taken = np.zeros((GH, GW), bool)
    for bid, tag, rx0, rz0, wx, wz in rects:
        if 0 <= rz0 - gz0 and rz0 - gz0 + wz <= GH and 0 <= rx0 - gx0 and rx0 - gx0 + wx <= GW:
            taken[rz0 - gz0:rz0 - gz0 + wz, rx0 - gx0:rx0 - gx0 + wx] = True
    for bid, tag, rx0, rz0, wx, wz in rects:
        bx0 = rx0 - 3 - gx0; bz0 = rz0 - 3 - gz0; bw = wx + 6; bh = wz + 6
        fp = np.zeros((bh, bw), bool); fp[3:3 + wz, 3:3 + wx] = True
        sub = np.s_[bz0:bz0 + bh, bx0:bx0 + bw]
        if bz0 < 0 or bx0 < 0 or bz0 + bh > GH or bx0 + bw > GW or not loaded[sub][binary_dilation(fp)].all():
            stats['buildings skipped (outside loaded area)'] += 1; continue
        others = taken[sub] & ~fp
        g = G[sub]; wl = WL[sub]
        if is_dam[sub][fp].any():
            stats['buildings skipped (on dam)'] += 1; continue
        base = int(round(np.median(g[fp])))
        if (wl[fp] >= g[fp]).any():
            base = max(base, int(wl[fp].max()) + 1)
        kind = tag.get('building', 'yes'); amen = tag.get('amenity', '')
        levels = int(tag['building:levels']) if str(tag.get('building:levels', '')).isdigit() else 1
        wallH = 3 + 4 * (levels - 1)
        toilet = kind == 'toilets' or amen == 'toilets'
        historic = tag.get('historic') == 'building'
        wall_b = w.gid('stone_bricks') if toilet else w.gid('spruce_planks')
        floor_b = w.gid('stone_bricks') if toilet else w.gid('spruce_planks')
        roof_name = 'dark_oak' if kind in ('stable', 'shed', 'boathouse') or toilet else 'deepslate_tile'
        corner_b = w.gid(state('stripped_spruce_log', axis='y'))
        ring = binary_dilation(fp) & ~fp
        boundary = fp & ~binary_erosion(fp, border_value=0)
        roof_area = binary_dilation(fp) & ~others      # no overhang into a neighbour
        dR = distance_transform_cdt(np.pad(roof_area, 1), metric='chessboard')[1:-1, 1:-1]
        dR = np.minimum(dR, 4)
        top = base + wallH + 1
        # Door: the boundary cell nearest a road, opening outward.
        rz, rx = np.nonzero(road_mask[sub])
        bz_, bx_ = np.nonzero(boundary)
        cand = []
        for zz, xx in zip(bz_, bx_):
            outs = [(n, d) for n, d in DIRS.items() if not fp[min(bh - 1, max(0, zz + d[1])), min(bw - 1, max(0, xx + d[0]))]]
            if len(outs) == 1:
                dist = np.min(np.hypot(rx - xx, rz - zz)) if len(rx) else 0
                cand.append((dist, zz, xx, outs[0]))
        door = min(cand)[1:] if cand else None
        for zz, xx in np.argwhere(roof_area):
            X_, Z_ = gx0 + bx0 + xx, gz0 + bz0 + zz
            col = w.column(X_, Z_); gn = int(g[zz, xx])
            if fp[zz, xx]:
                if gn < base:
                    col[gn + 1 - Y0:base - Y0] = w.gid('cobblestone')
                col[base - Y0] = floor_b
                col[base + 1 - Y0:top + 8 - Y0] = B['air']
            else:     # the ring: a level apron and clear air around the walls
                if gn < base - 1:
                    col[gn + 1 - Y0:base - Y0] = w.gid('cobblestone')
                elif gn > base:
                    col[base - Y0] = col[gn - Y0]
                    col[base + 1 - Y0:gn + 1 - Y0] = B['air']
                col[base + 1 - Y0:top + 8 - Y0] = np.where(is_tree(col[base + 1 - Y0:top + 8 - Y0]), B['air'],
                                                           col[base + 1 - Y0:top + 8 - Y0])
        for zz, xx in np.argwhere(boundary):
            X_, Z_ = gx0 + bx0 + xx, gz0 + bz0 + zz
            col = w.column(X_, Z_)
            outs = [d for d in DIRS.values() if not fp[min(bh - 1, max(0, zz + d[1])), min(bw - 1, max(0, xx + d[0]))]]
            corner = len({d[0] != 0 for d in outs}) == 2
            roof_y = top + int(dR[zz, xx]) - 1
            col[base + 1 - Y0:roof_y - Y0] = corner_b if corner else wall_b
            if historic and not corner:
                col[base + 1 - Y0] = w.gid('cobblestone')
            if not corner:
                for lv in range(levels):
                    if (X_ + Z_) % 3 == 0:
                        col[base + 2 + 4 * lv - Y0] = w.gid('glass')
        if levels > 1:
            inner = fp & ~boundary
            for zz, xx in np.argwhere(inner):
                for lv in range(1, levels):
                    w.set(gx0 + bx0 + xx, base + 4 * lv, gz0 + bz0 + zz, floor_b)
        if door:
            zz, xx, (face, dv) = door
            X_, Z_ = gx0 + bx0 + xx, gz0 + bz0 + zz
            w.set(X_, base + 1, Z_, state('spruce_door', facing=face, half='lower', hinge='left', open='false', powered='false'))
            w.set(X_, base + 2, Z_, state('spruce_door', facing=face, half='upper', hinge='left', open='false', powered='false'))
            ox, oz = X_ + dv[0], Z_ + dv[1]
            if w.has(ox, oz):
                c = w.column(ox, oz); gz_ = int(G[oz - gz0, ox - gx0])
                if gz_ < base:
                    c[gz_ + 1 - Y0:base + 1 - Y0] = w.gid('cobblestone')
                c[base + 1 - Y0:base + 4 - Y0] = B['air']
        # Hip roof: stairs rising toward the middle, slabs on the flat top.
        for zz, xx in np.argwhere(roof_area):
            X_, Z_ = gx0 + bx0 + xx, gz0 + bz0 + zz
            dv = int(dR[zz, xx]); y = top + dv - 1
            up = [n for n, (ddx, ddz) in DIRS.items()
                  if 0 <= zz + ddz < bh and 0 <= xx + ddx < bw and dR[zz + ddz, xx + ddx] > dv]
            if len(up) == 1:
                b = state(f'{roof_name}_stairs', facing=up[0], half='bottom', shape='straight', waterlogged='false')
            elif len(up) == 0:
                b = state(f'{roof_name}_slab', type='bottom', waterlogged='false')
            else:
                b = state(f'{roof_name}s' if roof_name == 'deepslate_tile' else f'{roof_name}_planks')
            w.set(X_, y, Z_, b)
        inner = np.argwhere(fp & ~boundary)
        if len(inner):
            zz, xx = inner[len(inner) // 2]
            w.set(gx0 + bx0 + xx, base + 1, gz0 + bz0 + zz, lantern)
        stats['buildings built'] += 1

    # 5. Connect walls and fences to their neighbours (offline blocks do not update themselves).
    wallset = {(x, y, z) for x, y, z in walls}
    for x, y, z in walls:
        name = w.name(w.get(x, y, z))
        if not name.endswith('_wall'):
            continue
        sides = {n: ('low' if (x + d[0], y, z + d[1]) in wallset else 'none') for n, d in DIRS.items()}
        straight = (sides['east'] == sides['west'] == 'low' and sides['north'] == sides['south'] == 'none') or \
                   (sides['north'] == sides['south'] == 'low' and sides['east'] == sides['west'] == 'none')
        w.set(x, y, z, state(name, up='false' if straight else 'true', waterlogged='false', **sides))
    fenceset = set(fences)
    for x, y, z in fences:
        sides = {n: ('true' if (x + d[0], y, z + d[1]) in fenceset else 'false') for n, d in DIRS.items()}
        w.set(x, y, z, state('spruce_fence', waterlogged='false', **sides))

    n = w.save(a.apply)
    stats['chunks written' if a.apply else 'chunks that would be written'] = n
    for k, v in stats.items():
        print(f'{k}: {v}')
    if a.apply:
        marker.write_text('Graded OSM roads, dam-crest parapets and generic buildings (osm_structures.py). '
                          '© OpenStreetMap contributors, ODbL.\n', encoding='utf-8')
        print('applied to', a.world)
    else:
        print('dry run; pass --apply to write')


if __name__ == '__main__':
    main()
