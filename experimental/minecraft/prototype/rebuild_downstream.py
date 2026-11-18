"""Rebuild the canyon below O'Shaughnessy Dam from Waterscape's own inputs, as the browser does.

Dry run unless --apply. Writes into --world, which must be a disposable copy with Minecraft
closed. Terrain is the bundle's unmodified 10 m 3DEP grid (cubic-resampled to 2 m blocks, 4 m
per vertical block); the river is a water ribbon along structures.json's traced centre line,
widths and surface, like renderer/land/structures.js. Ground follows renderer/land/ground.js's
granite rules (slope rock with land.json rock 0.38; dark canyon rock below the biome's
canyon.below); trees follow the builder's density rules with land.json's species mix. Block
choices, river bed depth, boulders and tree shapes are illustrative, not surveyed.
This replaces the earlier slope cut, canyon stone and plunge pool in this box. The dam,
reservoir and OSM building shells are preserved; OSM road surfaces are re-laid on the new ground.
"""
import argparse, collections, gzip, json, math, pathlib, sys
import numpy as np
from scipy.ndimage import map_coordinates, zoom, distance_transform_edt, binary_dilation
from pyproj import Transformer
from nbtlib import Compound, String, List, LongArray, Byte
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import region_edit as R

BOX = (170, 1220, 670, 1645)    # Minecraft x0, z0, x1, z1 (exclusive): the canyon below the dam
BLEND = 28                       # blocks over which new ground eases into the existing world
Y0 = -64                         # bottom of the world
AIR = {'minecraft:air', 'minecraft:cave_air', 'minecraft:void_air'}
PLANTS = {'minecraft:short_grass', 'minecraft:tall_grass', 'minecraft:short_dry_grass',
          'minecraft:tall_dry_grass', 'minecraft:fern', 'minecraft:dead_bush'}
ROADS = {'minecraft:packed_mud', 'minecraft:gray_concrete', 'minecraft:dirt_path'}   # add_osm_features.py
KEEP = {'minecraft:stone_bricks', 'minecraft:spruce_planks', 'minecraft:oak_planks',
        'minecraft:glass_pane', 'minecraft:spruce_door', 'minecraft:oak_door'}
DAM = {'minecraft:smooth_stone'}


def smooth(a, b, v):
    t = np.clip((v - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def noise(shape, spacing, seed, origin):
    """Value noise on the world grid (deterministic by world position)."""
    rng = np.random.default_rng(seed)
    big = rng.random((4096 // spacing + 3, 4096 // spacing + 3), dtype=np.float32)
    z0, x0 = origin
    gz = (np.arange(shape[0]) + z0) / spacing
    gx = (np.arange(shape[1]) + x0) / spacing
    Z, X = np.meshgrid(gz, gx, indexing='ij')
    return map_coordinates(big, [Z, X], order=1)


def state(name, **props):
    c = Compound({'Name': String(name)})
    if props:
        c['Properties'] = Compound({k: String(v) for k, v in props.items()})
    return c


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--world', required=True, type=pathlib.Path)
    p.add_argument('--data', required=True, type=pathlib.Path, help='data/hetch_hetchy')
    p.add_argument('--biome', required=True, type=pathlib.Path, help='data/biomes/sierra-granite/biome.json')
    p.add_argument('--face-drop', type=float, default=None,
                   help='blocks the downstream face drops per block outward (default: the browser profile, '
                        'about 0.67; 1.5 looks like the real dam at the 4 m vertical scale)')
    p.add_argument('--apply', action='store_true')
    a = p.parse_args()
    w = a.world.resolve()
    marker = w / 'waterscape-downstream-rebuild.txt'
    if marker.exists():
        raise SystemExit('Downstream rebuild already applied; start from another copy.')
    if (w / 'session.lock').exists() and a.apply:
        print('note: session.lock present; make sure Minecraft is not running on this world')
    meta = json.loads((w / 'metadata.json').read_text(encoding='utf-8-sig'))
    tmeta = json.loads((a.data / 'terrain.json').read_text())
    st = json.loads((a.data / 'structures.json').read_text())
    land = json.loads((a.data / 'land.json').read_text())
    biome = json.loads(a.biome.read_text())
    canyon_below = biome['ground']['rock']['canyon']['below']
    rock_look = land['ground']['rock']
    pine_share = land['vegetation']['species']['ponderosa']

    x0, z0, x1, z1 = BOX
    W, H = x1 - x0, z1 - z0
    # Block centres -> lon/lat (the world's linear geographic mapping) -> UTM -> terrain grid.
    X, Z = np.meshgrid(np.arange(x0, x1) + .5, np.arange(z0, z1) + .5)
    lon = meta['minGeoLon'] + X / meta['maxMcX'] * (meta['maxGeoLon'] - meta['minGeoLon'])
    lat = meta['maxGeoLat'] - Z / meta['maxMcZ'] * (meta['maxGeoLat'] - meta['minGeoLat'])
    east, north = Transformer.from_crs(4326, 32611, always_xy=True).transform(lon, lat)
    cell = tmeta['cell'][0]; ox, oz = tmeta['gridOrigin']; ue, un = tmeta['originUTM']
    rows = (un - north - oz) / cell; gcols = (east - ue - ox) / cell
    raw = np.frombuffer(gzip.decompress((a.data / 'terrain.bin.gz').read_bytes()), '<u2')
    nch = raw.size // (tmeta['width'] * tmeta['height'])
    raw = raw.reshape(nch, tmeta['height'], tmeta['width'])

    def channel(i, name, order):
        g = (np.cumsum(raw[i].astype(np.uint64), axis=0) % 65536).astype(np.float32)
        g = g * tmeta['channels'][name]['scale'] + tmeta['channels'][name]['offset']
        return map_coordinates(g, [rows, gcols], order=order)

    h = channel(0, 'height', 3)          # metres relative to the lake surface (1151.7 m)
    shore = channel(1, 'shoreDistance', 1)
    valley = channel(2, 'valley', 1)
    lake = shore < 0
    ground = np.rint(80 + h / 4).astype(np.int32)

    # Dam and river in block space.
    to_ll = Transformer.from_crs(32611, 4326, always_xy=True)

    def mc(pt):
        lo, la = to_ll.transform(*pt)
        return np.array([(lo - meta['minGeoLon']) / (meta['maxGeoLon'] - meta['minGeoLon']) * meta['maxMcX'],
                         (meta['maxGeoLat'] - la) / (meta['maxGeoLat'] - meta['minGeoLat']) * meta['maxMcZ']])

    def seg_dist(pts):
        """Distance (blocks) to a polyline, and parameter along it (segment index + t)."""
        best = np.full(X.shape, 1e9); par = np.zeros(X.shape)
        for i in range(len(pts) - 1):
            A, B = pts[i], pts[i + 1]; v = B - A
            t = np.clip(((X - A[0]) * v[0] + (Z - A[1]) * v[1]) / (v @ v), 0, 1)
            d = np.hypot(X - (A[0] + t * v[0]), Z - (A[1] + t * v[1]))
            m = d < best; best[m] = d[m]; par[m] = i + t[m]
        return best, par

    crest = [mc(q) for q in st['dams'][0]['crestUTM']]
    damdist, _ = seg_dist(crest)
    r = st['rivers'][0]
    rpts = [mc(q) for q in r['centreUTM']]
    rdist, rpar = seg_dist(rpts)
    i = np.clip(rpar.astype(int), 0, len(rpts) - 2); f = rpar - i
    widths = np.array(r['width']); surf = np.array(r['surface'])
    half = (widths[i] * (1 - f) + widths[i + 1] * f) / 2 / 2      # metres -> blocks (2 m), half width
    wy = np.rint(80 + ((surf[i] * (1 - f) + surf[i + 1] * f) - tmeta['waterLevel']) / 4).astype(np.int32)
    # The dam's downstream side, as renderer/land/structures.js gravityProfile(): crest 7.5 m wide,
    # the top 6 m of the downstream face vertical, then a 0.75:1 batter down to the base
    # (height + 12 m below the crest). u is metres downstream from the traced crest line.
    dam = st['dams'][0]
    best = np.full(X.shape, 1e9); perp = np.zeros(X.shape); inside = np.zeros(X.shape, bool)
    for k in range(len(crest) - 1):
        A, Bp = crest[k], crest[k + 1]; v = Bp - A; L = np.hypot(*v)
        tt = ((X - A[0]) * v[0] + (Z - A[1]) * v[1]) / (v @ v)
        tc = np.clip(tt, 0, 1)
        d = np.hypot(X - (A[0] + tc * v[0]), Z - (A[1] + tc * v[1]))
        m = d < best; best[m] = d[m]
        perp[m] = ((v[0] * (Z - A[1]) - v[1] * (X - A[0])) / L)[m]
        ok = (tt >= 0 if k == 0 else True) & (tt <= 1 if k == len(crest) - 2 else True)
        inside[m] = np.broadcast_to(ok, X.shape)[m]
    s0 = rpts[0]                       # the river's first point lies below the dam
    down_sign = np.sign(perp[int(s0[1] - z0), int(s0[0] - x0)])
    downstream = np.sign(perp) == down_sign
    u_m = np.abs(perp) * 2.0
    base_m = dam['height'] + 12
    crest_y = int(round(80 + (dam['crestElevation'] - tmeta['waterLevel']) / 4))
    dam_y = np.where(u_m <= 7.5, crest_y, crest_y - np.rint((6 + (u_m - 7.5) / 0.75) / 4)).astype(np.int32)
    footprint = downstream & inside & (u_m <= 7.5 + 0.75 * (base_m - 6)) & ~lake
    # The browser's profile is where the lidar records the dam's face; a steeper face (--face-drop,
    # an exaggeration for the vertical scale) stops at river level, and the band it frees below
    # becomes a plunge pool rather than a ledge of old-face ground.
    old_dam_y, old_footprint = dam_y.copy(), footprint.copy()
    river_y = int(round(80 + (surf[0] - tmeta['waterLevel']) / 4))
    if a.face_drop:
        u_b = u_m / 2
        raw = crest_y - np.where(u_b <= 3.75, 0, 1.5 + (u_b - 3.75) * a.face_drop)
        dam_y = np.maximum(np.rint(raw), river_y).astype(np.int32)
        footprint = downstream & inside & (raw >= river_y - .5) & ~lake
    # At the toe, the face meets the river: no concrete step below the water beside it.
    dam_y = np.where(footprint & (rdist <= half + 2), np.maximum(dam_y, wy), dam_y)
    river = (rdist <= half) & ~lake & ~(footprint & (dam_y > wy))
    bank = (rdist <= half + 2) & ~river & ~lake & ~footprint

    # Materials, as ground.js's granite branch: rock on slopes (threshold lowered by look.rock),
    # canyon rock deep below the lake surface with a noise-warped edge, soil elsewhere.
    gy, gx = np.gradient(h, 2.0, 2.0)
    ny = 1 / np.sqrt(1 + gx * gx + gy * gy); steep = 1 - ny
    o = (z0, x0)
    macro = noise((H, W), 65, 17, o)
    rockW = smooth(.34 - rock_look, .55 - rock_look, steep + (macro - .5) * .25) * (1 - valley * .6)
    edgeY = h + (noise((H, W), 50, 51, o) - .5) * 28 + (noise((H, W), 12, 53, o) - .5) * 12
    deep = 1 - smooth(canyon_below - 25, canyon_below + 20, edgeY)
    def uniform(f):
        r = f.ravel().argsort().argsort()
        return (r / (r.size - 1)).reshape(f.shape)
    v3 = uniform(noise((H, W), 3, 5, o)); v7 = uniform(noise((H, W), 7, 6, o)); vein = uniform(noise((H, W), 4, 9, o))

    # Trees: the builder's density ingredients, a denser 8-block lattice for this small area.
    spur = 1 - valley
    north_facing = smooth(0, -.4, -gy * ny)
    grove = noise((H, W), 40, 29, o); stands = noise((H, W), 40, 71, o)
    dens = np.clip(.05 + .85 * (1 - smooth(.22, .6, spur)) + .55 * north_facing + .25 * smooth(.18, .45, steep)
                   + .75 * smooth(.46, .64, grove) - .7 * smooth(.62, .88, spur), 0, 1)
    dens *= 1 - smooth(.45, .7, steep)

    names = []; index = {}

    def gid(c):
        k = str(c)
        if k not in index:
            index[k] = len(names); names.append(c)
        return index[k]

    B = {n: gid(state('minecraft:' + n)) for n in
         ['air', 'stone', 'diorite', 'calcite', 'andesite', 'tuff', 'deepslate', 'gravel', 'coarse_dirt',
          'cobblestone', 'mossy_cobblestone', 'bedrock']}
    B['water'] = gid(state('minecraft:water', level='0'))
    B['concrete'] = gid(state('minecraft:smooth_stone'))   # the existing dam's block
    B['dry'] = gid(state('minecraft:short_dry_grass'))
    B['plog'] = gid(state('minecraft:spruce_log', axis='y'))
    B['pleaf'] = gid(state('minecraft:spruce_leaves', distance='7', persistent='true', waterlogged='false'))
    B['olog'] = gid(state('minecraft:dark_oak_log', axis='y'))
    B['oleaf'] = gid(state('minecraft:dark_oak_leaves', distance='7', persistent='true', waterlogged='false'))

    region_dir = w / 'dimensions/minecraft/overworld/region'
    if not region_dir.is_dir():
        region_dir = w / 'region'
    stats = collections.Counter()

    # Pass 1: read every chunk in the box into full 384-high columns.
    chunks_by_region = {}
    cols = {}
    for rx in range(x0 // 512, (x1 - 1) // 512 + 1):
        for rz in range(z0 // 512, (z1 - 1) // 512 + 1):
            path = region_dir / f'r.{rx}.{rz}.mca'
            if not path.exists() or path.stat().st_size < 8192:
                continue
            chunks, times = R.read_region(path)
            chunks_by_region[path] = (chunks, times, {})
            for k, rawc in chunks.items():
                c = R.decode_chunk(rawc); cx, cz = int(c['xPos']), int(c['zPos'])
                if cx * 16 + 15 < x0 or cx * 16 >= x1 or cz * 16 + 15 < z0 or cz * 16 >= z1:
                    continue
                full = np.full((384, 16, 16), B['air'], dtype=np.int32)
                for s in c['sections']:
                    if 'block_states' not in s:
                        continue
                    sy = int(s['Y'])
                    if not -4 <= sy < 20:
                        continue
                    lut = np.array([gid(e) for e in s['block_states']['palette']], dtype=np.int32)
                    full[(sy + 4) * 16:(sy + 5) * 16] = lut[R.unpack(s).reshape(16, 16, 16)]
                chunks_by_region[path][2][k] = c
                cols[(cx, cz)] = full

    def at(cx, cz):
        return np.s_[cz * 16 - z0:cz * 16 - z0 + 16, cx * 16 - x0:cx * 16 - x0 + 16]

    # Existing ground (ignoring trees, plants, water) and protected columns.
    old_ground = np.full((H, W), -999, np.int32)
    protect = np.zeros((H, W), bool); old_road = np.full((H, W), -1, np.int32)
    old_lake = np.zeros((H, W), bool)
    is_air = np.array([str(n['Name']) in AIR for n in names])
    for (cx, cz), full in cols.items():
        n = len(names)
        def mask_of(test):
            return np.array([test(str(names[j]['Name'])) for j in range(n)])
        soft = mask_of(lambda s: s in AIR or s in PLANTS or s == 'minecraft:water' or s.endswith('_leaves') or s.endswith('_log'))
        keep = mask_of(lambda s: s in KEEP)
        road = mask_of(lambda s: s in ROADS)
        solid = ~soft[full]
        top = np.where(solid.any(0), 383 - np.argmax(solid[::-1], 0), 0)
        sl = at(cx, cz)
        lz0, lx0 = max(0, -(cz * 16 - z0)), max(0, -(cx * 16 - x0))
        lz1, lx1 = min(16, z1 - cz * 16), min(16, x1 - cx * 16)
        tb = np.take_along_axis(full, top[None], 0)[0]
        region_view = (slice(lz0, lz1), slice(lx0, lx1))
        tgt = (slice(cz * 16 + lz0 - z0, cz * 16 + lz1 - z0), slice(cx * 16 + lx0 - x0, cx * 16 + lx1 - x0))
        old_ground[tgt] = (top + Y0)[region_view]
        protect[tgt] = keep[full].any(0)[region_view]
        old_road[tgt] = np.where(road[tb], tb, -1)[region_view]
        wet = mask_of(lambda s: s == 'minecraft:water')
        old_lake[tgt] = wet[full[80 - Y0]][region_view]       # lake water at the lake surface
    have = old_ground > -999
    lake |= old_lake
    lake_shore = (distance_transform_edt(~lake) <= 2) & ~lake
    # The upstream half of the existing dam and the lake are left exactly as they are; the
    # downstream half is rebuilt from the gravity profile below.
    protect &= ~footprint              # OSM marker blocks on the old dam do not keep its thin wall
    protect |= ((damdist <= 8) & ~downstream) | lake | ~have
    stats['protected columns'] = int(protect.sum())

    # Blend new ground into the existing world near the box edge and around protected columns.
    edge = np.minimum.reduce([np.arange(W)[None, :].repeat(H, 0), np.arange(W)[::-1][None, :].repeat(H, 0),
                              np.arange(H)[:, None].repeat(W, 1), np.arange(H)[::-1][:, None].repeat(W, 1)])
    near_protect = distance_transform_edt(~protect)
    t = smooth(0, BLEND, np.minimum(edge, near_protect * 2))
    new = np.where(river, np.minimum(ground, wy - 2), ground)
    new = np.where(bank, np.maximum(new, wy), new)
    t = np.where(river | bank, 1.0, t)
    g = np.rint(old_ground * (1 - t) + new * t).astype(np.int32)
    # River bed: 1-3 blocks below the surface, deepest at the centre line.
    bed = wy - 1 - np.rint(2 * (1 - rdist / np.maximum(half, 1))).astype(np.int32)
    g = np.where(river, np.minimum(g, bed), g)
    g = np.where(lake_shore, np.maximum(g, 80), g)   # keep the reservoir's edge watertight
    change = ~protect
    # Lidar sees the dam's face as ground; where the ground is within a few blocks of the profile
    # it is the dam, and concrete runs from the ground (or bed) up to the profile. Higher ground
    # is the abutment rock and stays natural.
    # Near the toe the ground is real ground, not the dam: never cut it down to the profile there.
    toe_y = int(round(80 + (surf[0] - tmeta['waterLevel']) / 4))
    lidar_dam = old_footprint & change & ~river & (((g <= old_dam_y + 3) & (old_dam_y >= toe_y + 3)) | (g <= old_dam_y))
    dam_here = footprint & change & ~river & ((((g <= dam_y + 3) & (dam_y >= toe_y + 3)) | (g <= dam_y)) | lidar_dam)
    g_dam_floor = np.minimum(g, dam_y)
    # The freed band: a pool at river level with a rocky bed, rising as rock against natural ground.
    freed = lidar_dam & ~footprint & ~river
    if freed.any():
        natural = change & ~freed & ~dam_here & ~river & ~lake & ~footprint
        dnat = distance_transform_edt(~natural)
        pool_bed = river_y - 2 - (v7 > .6).astype(np.int32)
        rim = np.clip(river_y + (3 - np.ceil(dnat)).astype(np.int32), river_y, river_y + 2)
        g = np.where(freed, np.where(dnat > 3, pool_bed, rim), g)
        # Watertight: any dry neighbour of the pool lower than the water is raised to it.
        poolw = freed & (g < river_y)
        edge_lo = binary_dilation(poolw) & ~poolw & ~river & ~lake & change & (g < river_y) & ~dam_here
        g = np.where(edge_lo, river_y, g)
        stats['plunge pool columns'] = int(poolw.sum())
    stats['dam face columns'] = int(dam_here.sum())
    stats['rebuilt columns'] = int(change.sum())
    stats['river columns'] = int((river & change).sum())

    # Tree list (procedural stands, not surveyed trees).
    rng = np.random.default_rng(611)
    trees = []
    no_tree = river | bank | protect | footprint | old_footprint | (old_road >= 0)
    no_tree = distance_transform_edt(~no_tree) < 3
    for zz in range(4, H - 4, 8):
        for xx in range(4, W - 4, 8):
            tx = xx + int(rng.integers(-3, 4)); tz = zz + int(rng.integers(-3, 4))
            if no_tree[tz, tx] or rng.random() > dens[tz, tx] * min(1, t[tz, tx] * 1.5):
                continue
            pine = np.clip(rng.random() + 2 * (stands[tz, tx] - .5), 0, 1) < pine_share
            trees.append((tx, tz, bool(pine), int(rng.integers(7, 12) if pine else rng.integers(5, 8))))
    stats['pines'] = sum(1 for q in trees if q[2]); stats['oaks'] = len(trees) - stats['pines']

    # Column contents for rebuilt columns.
    rock = rockW > .5
    def top_block(zz, xx):
        # Shares are of area (the noise fields are rank-normalised to uniform). Pale granite
        # dominates, as in the browser; the deep canyon is greyer with pale veins.
        if deep[zz, xx] > .5 and (rock[zz, xx] or steep[zz, xx] > .15):
            if vein[zz, xx] > .88: return B['diorite']
            v = v3[zz, xx]
            return B['stone'] if v < .4 else B['andesite'] if v < .7 else B['diorite'] if v < .9 else B['tuff']
        if rock[zz, xx]:
            v = v3[zz, xx]
            return B['diorite'] if v < .55 else B['stone'] if v < .75 else B['andesite'] if v < .9 else B['calcite']
        v = v7[zz, xx]
        return B['diorite'] if v < .4 else B['gravel'] if v < .75 else B['coarse_dirt']

    for (cx, cz), full in cols.items():
        for lz in range(16):
            for lx in range(16):
                xx, zz = cx * 16 + lx - x0, cz * 16 + lz - z0
                if not (0 <= xx < W and 0 <= zz < H) or not change[zz, xx]:
                    continue
                gy_ = int(g[zz, xx]) - Y0
                col = full[:, lz, lx]
                col[1:gy_ + 1] = B['stone']; col[gy_ + 1:] = B['air']; col[0] = B['bedrock']
                if dam_here[zz, xx]:
                    lo = int(g_dam_floor[zz, xx]) - Y0; hi = int(dam_y[zz, xx]) - Y0
                    col[gy_ + 1:] = B['air']
                    col[1:lo] = B['stone']
                    col[lo:hi + 1] = B['concrete']
                    col[hi + 1:] = B['air']
                    continue
                if a.face_drop and freed[zz, xx]:
                    v = v3[zz, xx]
                    col[gy_] = B['gravel'] if v < .3 else B['cobblestone'] if v < .55 else B['andesite'] if v < .8 else B['mossy_cobblestone']
                    if gy_ + Y0 < river_y:
                        col[gy_ + 1:river_y - Y0 + 1] = B['water']
                        if v7[zz, xx] > .85 and gy_ + 1 + Y0 < river_y:
                            col[gy_ + 1] = B['mossy_cobblestone']     # a boulder in the pool
                    continue
                if river[zz, xx]:
                    v = v3[zz, xx]
                    col[gy_] = B['gravel'] if v < .55 else B['cobblestone'] if v < .8 else B['mossy_cobblestone']
                    col[gy_ + 1:int(wy[zz, xx]) - Y0 + 1] = B['water']
                    continue
                tb = top_block(zz, xx)
                col[max(1, gy_ - 2):gy_ + 1] = tb if tb not in (B['gravel'], B['coarse_dirt']) else B['stone']
                col[gy_] = old_road[zz, xx] if old_road[zz, xx] >= 0 else tb
                if old_road[zz, xx] < 0 and tb in (B['gravel'], B['coarse_dirt'], B['diorite']) and not rock[zz, xx]:
                    if ((xx + x0) * 17 + (zz + z0) * 31) % 7 < 2:
                        col[gy_ + 1] = B['dry']
                elif old_road[zz, xx] < 0 and bank[zz, xx] and v7[zz, xx] > .8:
                    col[gy_ + 1] = B['cobblestone']   # an occasional boulder at the water's edge

    for tx, tz, pine, ht in trees:
        base = int(g[tz, tx]); log, leaf = (B['plog'], B['pleaf']) if pine else (B['olog'], B['oleaf'])
        crown = ((-4, 1), (-3, 2), (-2, 2), (-1, 1), (0, 1), (1, 0)) if pine else ((-3, 2), (-2, 3), (-1, 3), (0, 2), (1, 1))
        def put(xx, zz, y, b, only_air):
            if not (0 <= xx < W and 0 <= zz < H) or not change[zz, xx]:
                return
            key = ((xx + x0) // 16, (zz + z0) // 16)
            if key not in cols:
                return
            c = cols[key][:, (zz + z0) % 16, (xx + x0) % 16]
            if 0 <= y - Y0 < 384 and (not only_air or c[y - Y0] == B['air']):
                c[y - Y0] = b
        for y in range(base + 1, base + ht + 1):
            put(tx, tz, y, log, False)
        for dy, rad in crown:
            y = base + ht + dy
            for dz in range(-rad, rad + 1):
                for dx in range(-rad, rad + 1):
                    if abs(dx) + abs(dz) <= rad + (1 if rad > 1 else 0):
                        put(tx + dx, tz + dz, y, leaf, True)

    # Encode changed chunks: per-section palettes, recomputed heightmaps, relight on load.
    def longpack(vals, bits):
        per = 64 // bits; v = np.asarray(vals, dtype=np.uint64).ravel(); v = np.pad(v, (0, (-len(v)) % per)).reshape(-1, per)
        words = np.bitwise_or.reduce(v << (np.arange(per, dtype=np.uint64) * np.uint64(bits)), axis=1)
        return LongArray(words.view(np.int64))
    nm = [str(n['Name']) for n in names]
    def flag(test): return np.array([test(s) for s in nm])
    hm_tests = {
        'WORLD_SURFACE': flag(lambda s: s not in AIR),
        'MOTION_BLOCKING': flag(lambda s: s not in AIR and s not in PLANTS),
        'MOTION_BLOCKING_NO_LEAVES': flag(lambda s: s not in AIR and s not in PLANTS and not s.endswith('_leaves')),
        'OCEAN_FLOOR': flag(lambda s: s not in AIR and s not in PLANTS and s != 'minecraft:water'),
    }
    nchanged = 0
    for path, (chunks, times, decoded) in chunks_by_region.items():
        for k, c in decoded.items():
            cx, cz = int(c['xPos']), int(c['zPos'])
            xs = slice(max(cx * 16, x0) - x0, min(cx * 16 + 16, x1) - x0)
            zs = slice(max(cz * 16, z0) - z0, min(cz * 16 + 16, z1) - z0)
            if not change[zs, xs].any():
                continue
            full = cols[(cx, cz)]
            by_y = {int(s['Y']): s for s in c['sections']}
            out = []
            for sy in range(-4, 20):
                ids = full[(sy + 4) * 16:(sy + 5) * 16]
                present, inv = np.unique(ids, return_inverse=True)
                old = by_y.get(sy)
                sec = Compound({'Y': Byte(sy)})
                if old is not None and 'biomes' in old:
                    sec['biomes'] = old['biomes']
                else:
                    sec['biomes'] = Compound({'palette': List[String]([String('minecraft:forest')])})
                sec['block_states'] = Compound({'palette': List[Compound]([names[j] for j in present])})
                if len(present) > 1:
                    sec['block_states']['data'] = longpack(inv.reshape(-1), max(4, (len(present) - 1).bit_length()))
                out.append(sec)
            c['sections'] = List[Compound](out)
            for name, ok in hm_tests.items():
                m = ok[full]
                top = np.where(m.any(0), 384 - np.argmax(m[::-1], 0), 0)   # first air above, from the bottom
                c['Heightmaps'][name] = longpack(top.reshape(-1).astype(np.int64), 9)
            if 'block_entities' in c:
                keep = []
                for be in c['block_entities']:
                    bx, bz = int(be['x']) - x0, int(be['z']) - z0
                    if not (0 <= bx < W and 0 <= bz < H and change[bz, bx]):
                        keep.append(be)
                c['block_entities'] = List[Compound](keep)
            for key in ('block_ticks', 'fluid_ticks'):
                if key in c:
                    c[key] = List[Compound]([])
            R.mark_relight(c)
            chunks[k] = R.encode_chunk(c); nchanged += 1
        if a.apply:
            R.write_region(path, chunks, times)
    stats['chunks rewritten'] = nchanged
    for k_, v in stats.items():
        print(f'{k_}: {v}')
    if a.apply:
        marker.write_text("Downstream canyon rebuilt from Waterscape's terrain, river trace and granite rules "
                          '(rebuild_downstream.py); replaces the earlier slope cut, canyon stone and plunge pool.\n',
                          encoding='utf-8')
        print('applied to', w)
    else:
        print('dry run; pass --apply to write')


if __name__ == '__main__':
    main()
