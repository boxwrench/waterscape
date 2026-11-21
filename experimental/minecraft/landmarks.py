"""Landmarks from a site file's "landmarks" list, built into a reservoir world at their own scale.

Used by build_reservoir.py. Each landmark lists its blocks (registered in the builder's block
table before the world is built), its measurements with their sources, and a type that picks the
function here. Types: "pulgas-temple" (task MC7).
"""

import math

import numpy as np
from scipy import ndimage

# Landmark blocks laid as a surface that should be solid all the way down (no dirt under paving,
# coping or a canal wall), and blocks that are plants (not motion-blocking).
FILL_KEYS = ('paving', 'coping', 'poolFloor', 'canalWall', 'canalFloor')
PLANT_KEYS = ('lavender',)


def build(site, ctx):
    """Build every landmark of the site. Returns the cells to keep free of trees and plants, and
    a summary per landmark."""
    clear = np.zeros(ctx.ground.shape, bool)
    summary = {}
    for lm in site.get('landmarks', []):
        if lm['type'] != 'pulgas-temple':
            raise ValueError(f'Unknown landmark type {lm["type"]}')
        cells, info = pulgas_temple(lm, ctx)
        clear |= cells
        summary[lm['name']] = info
    return clear, summary


def half_blocks(metres, k):
    """A height in metres as whole and half blocks (at least half a block)."""
    return max(.5, round(metres * k * 2) / 2)


def put(ctx, x, z, y, kind, keep=False):
    patch = ctx.extras[x // 16, z // 16]
    if keep:
        patch.setdefault((y, z % 16, x % 16), kind)
    else:
        patch[y, z % 16, x % 16] = kind


def pulgas_temple(lm, ctx):
    """The temple on its round steps with the open well, a paved forecourt with lavender beds,
    the reflecting pool with white coping between two rows of cypress, and the canal behind the
    temple down to the lake, all at the landmark's own scale on a level lawn terrace."""
    B = {key: ctx.block(name) for key, name in lm['blocks'].items()}
    g, surface, wet = ctx.ground, ctx.surface, ctx.wet
    H, W = g.shape
    k = 1 / lm['metresPerBlock']                      # landmark blocks per metre
    ue, un = lm['axis']
    norm = math.hypot(ue, un)
    ue, un = ue / norm, un / norm
    u = np.array([ue, -un])                           # along the axis, temple -> pool, in blocks
    n = np.array([-u[1], u[0]])
    M, pool, cyp, fc = lm['model'], lm['pool'], lm['cypress'], lm['forecourt']
    U = M['unitMetres']
    r_steps = M['steps']['radii'][0] * U
    pool_lo = pool['centreAlong'] - pool['length'] / 2
    pool_hi = pool['centreAlong'] + pool['length'] / 2
    # Centre the complex (back step to the pool's far coping) on its real middle.
    back, front = -r_steps, pool_hi + 1
    mid = (back + front) / 2
    e0, n0 = lm['templeUTM']
    real_mid = ctx.to_blocks([(e0 + ue * mid, n0 + un * mid)])[0]
    t_half = cyp['rowOffset'] + 4
    # Keep the terrace inside the crop (Crystal Springs: the bundle ends just east of the pool),
    # sliding the complex back along its own axis if it would cross the edge.
    margin, slide = 3, 0.0
    while True:
        centre = np.floor(real_mid - u * (mid + slide) * k) + .5   # the temple centre on a block centre
        corners = [centre + (u * a + n * b) * k for a in (back - 4, front + 3) for b in (-t_half, t_half)]
        if all(margin <= c[0] <= W - margin and margin <= c[1] <= H - margin for c in corners):
            break
        slide += .5
        if slide > 60:
            raise ValueError(f'{lm["name"]}: does not fit inside the crop')
    zz, xx = np.mgrid[0:H, 0:W]
    dx, dz = xx + .5 - centre[0], zz + .5 - centre[1]
    s = (dx * u[0] + dz * u[1]) / k                   # metres along the axis
    t = (dx * n[0] + dz * n[1]) / k                   # metres across it
    r = np.hypot(dx, dz) / k                          # metres from the temple centre
    T = ctx.water_y + int(round((lm['templeGround'] - ctx.water_level) / ctx.scale))

    # Terrace: a level lawn under the whole complex, blended into the land over 8 blocks.
    ds = np.maximum.reduce([back - 4 - s, s - (front + 3), np.zeros_like(s)])
    dt = np.maximum(np.abs(t) - t_half, 0)
    out = np.hypot(ds, dt) * k                        # blocks outside the terrace
    terrace = out == 0
    blend = (out > 0) & (out < 8)
    if wet[terrace | blend].any():
        raise ValueError(f'{lm["name"]}: the terrace reaches the lake')
    g[terrace] = T
    g[blend] = np.rint(T + (g[blend] - T) * out[blend] / 8).astype(g.dtype)
    surface[terrace] = ctx.grass

    # Forecourt: a paved round plaza about the temple and a paved strip to the pool, with two
    # lavender beds either side of the path to the front steps.
    paved = (r <= fc['plazaRadius']) | ((s >= 0) & (s <= pool_lo) & (np.abs(t) <= fc['width'] / 2))
    bed = (s >= fc['bedFrom']) & (s <= fc['bedTo']) & (np.abs(t) >= fc['bedInner']) & (np.abs(t) <= fc['bedOuter'])
    bed_inner = ndimage.binary_erosion(bed)
    surface[paved & ~bed] = B['paving']
    surface[bed] = ctx.grass

    # Pool: water level with the lawn, one block deep, inside a ring of coping.
    ps = s - pool['centreAlong']
    in_pool = (np.abs(ps) <= pool['length'] / 2) & (np.abs(t) <= pool['width'] / 2)
    coping = (np.abs(ps) <= pool['length'] / 2 + 1) & (np.abs(t) <= pool['width'] / 2 + 1) & ~in_pool
    g[in_pool] = T - 1
    surface[in_pool] = B['poolFloor']
    surface[coping] = B['coping']
    water = {}                                        # (x, z) -> water surface y
    for z, x in zip(*np.nonzero(in_pool)):
        water[x, z] = T

    for z, x in zip(*np.nonzero(bed_inner)):
        put(ctx, x, z, T + 1, B['lavender'])
    for z, x in zip(*np.nonzero(bed & ~bed_inner)):
        put(ctx, x, z, T + 1, B['bedEdge'])

    # The temple. Steps: each round course to its own height, in half blocks.
    radii = [rad * U for rad in M['steps']['radii']]
    zs = M['steps']['z']
    tops = [half_blocks((zs[i + 1] - zs[0]) * U, k) for i in range(len(radii))]
    tops[-1] = math.ceil(tops[-1])                    # the landing is whole blocks
    floor_y = T + int(tops[-1])                       # the landing's top block
    step_h = np.zeros(g.shape)
    for rad, top in zip(radii, tops):
        step_h = np.where(r <= rad, np.maximum(step_h, top), step_h)
    landing = r <= radii[-1]
    w_in, w_out = (rad * U for rad in M['well']['radii'])
    hole = r < max(w_in, 1.0 / k + .01)
    well_wall = ndimage.binary_dilation(hole, np.ones((3, 3), bool)) & ~hole
    inlay = landing & (np.abs(r - M['inlayRadius'] * U) < .5 / k)
    for z, x in zip(*np.nonzero(step_h > 0)):
        if hole[z, x]:
            continue
        h = step_h[z, x]
        full = int(h)
        for y in range(T + 1, T + 1 + full):
            put(ctx, x, z, y, B['step'])
        if h - full:
            put(ctx, x, z, T + 1 + full, B['stepSlab'])
    for z, x in zip(*np.nonzero(inlay & ~hole)):
        put(ctx, x, z, floor_y, B['inlay'])
    # The well: open to the water three blocks below the lawn, inside a low wall.
    g[hole] = T - 4
    surface[hole] = B['canalFloor']
    for z, x in zip(*np.nonzero(hole)):
        water[x, z] = T - 3
    wall_h = half_blocks((M['well']['top'] - zs[-1]) * U, k)
    for z, x in zip(*np.nonzero(well_wall)):
        for y in range(floor_y + 1, floor_y + 1 + int(wall_h)):
            put(ctx, x, z, y, B['wellWall'])
        if wall_h % 1:
            put(ctx, x, z, floor_y + 1 + int(wall_h), B['wellCap'])
    # Columns, a gap on the axis front and back (ten round a ring).
    col = M['columns']
    base = floor_y + 1
    col_h = int(round((col['capital'][1] - zs[-1]) * U * k))
    cap_h = max(1, int(round((col['capital'][1] - col['capital'][0]) * U * k)))
    columns = set()
    for i in range(col['count']):
        phi = math.pi / col['count'] + 2 * math.pi * i / col['count']
        d = u * math.cos(phi) + n * math.sin(phi)
        cx, cz = np.floor(centre + d * col['radius'] * U * k).astype(int)
        columns.add((cx, cz))
        for j in range(col_h):
            kind = B['columnBase'] if j == 0 else B['capital'] if j >= col_h - cap_h else B['shaft']
            put(ctx, cx, cz, base + j, kind)
    # Entablature: architrave, drum and cornice as one ring over the capitals.
    ent = M['entablature']
    ring = (r >= ent['radii'][0] * U) & (r <= ent['radii'][1] * U)
    ent_h = max(3, int(round((ent['z'][1] - ent['z'][0]) * U * k)))
    for z, x in zip(*np.nonzero(ring)):
        for j in range(ent_h):
            kind = B['architrave'] if j == 0 else B['cornice'] if j == ent_h - 1 else B['drum']
            put(ctx, x, z, base + col_h + j, kind)

    # Cypress: two rows along the pool's long sides, columnar crowns on bare grey trunks.
    rng = np.random.default_rng(1938)
    trees = 0
    lo_h, hi_h = cyp['height']
    for side in (-1, 1):
        for along in np.arange(pool_lo + cyp['spacing'] / 2, pool_hi, cyp['spacing']):
            px, pz = np.floor(centre + (u * along + n * side * cyp['rowOffset']) * k).astype(int)
            height = int(round(rng.uniform(lo_h, hi_h) * k))
            top = T + height
            first = T + 1 + int(round(cyp['clearTrunk'] * k))
            for y in range(T + 1, top - 1):
                put(ctx, px, pz, y, B['cypressTrunk'])
            for y in range(first, top + 1):
                f = (y - first) / max(1, top - first)
                if f > .85:
                    cells = [(0, 0)]
                elif .2 < f < .7:
                    cells = [(a, b) for a in (-1, 0, 1) for b in (-1, 0, 1)]
                else:
                    cells = [(0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)]
                for ox, oz in cells:
                    put(ctx, px + ox, pz + oz, y, B['cypressLeaves'], keep=True)
            trees += 1

    # The canal behind the temple: from the back step along the real canal line traced on NAIP to
    # its mouth, then on to the nearest lake water in the world (the bundle's shoreline lies west
    # of the real mouth). Water steps down with the land (one block below it, never below the
    # lake) between stone walls.
    cw = lm['canal']
    half = cw['water'] / 2 * k
    head = centre - u * (r_steps + .5) * k
    traced = ctx.to_blocks(cw['centreUTM'])
    traced = [p for p in traced if (p - head) @ -u > 0]
    mouth = traced[-1]
    dist, (iz, ix) = ndimage.distance_transform_edt(~wet, return_indices=True)
    mz, mx = int(mouth[1]), int(mouth[0])
    lake = np.array([ix[mz, mx] + .5, iz[mz, mx] + .5])
    lake = lake + (lake - mouth) / max(1e-6, np.hypot(*(lake - mouth))) * 2   # two blocks into the lake
    path = np.array([head] + traced + [lake])
    d, along_c, _, _, length = ctx.polyline(path, g.shape)
    samples = np.arange(0, length, .5)
    levels, level = [], T - 1
    seg = np.cumsum([0] + [np.hypot(*(b - a)) for a, b in zip(path[:-1], path[1:])])
    for a in samples:
        i = min(np.searchsorted(seg, a, side='right') - 1, len(path) - 2)
        p = path[i] + (path[i + 1] - path[i]) * (a - seg[i]) / (seg[i + 1] - seg[i])
        px_, pz_ = int(p[0]), int(p[1])
        if not wet[pz_, px_]:
            level = max(ctx.water_y, min(level, int(g[pz_, px_]) - 1))
        levels.append(level)
    canal = (d <= half + cw['wall'] * k) & (along_c >= 0) & ~wet & ~(r <= r_steps + .5)
    lev = np.interp(along_c, samples, np.array(levels, float)).round().astype(int)
    start, end = 0.0, length / k
    channel = canal & (d <= half)
    walls = canal & ~channel
    g[walls] = np.maximum(g[walls], lev[walls] + 1)
    surface[walls] = B['canalWall']
    g[channel] = lev[channel] - 1
    surface[channel] = B['canalFloor']
    # At lake level the canal is part of the lake (the builder's leak check then covers it).
    wet[channel & (lev <= ctx.water_y)] = True
    for z, x in zip(*np.nonzero(channel & (lev > ctx.water_y))):
        water[x, z] = int(lev[z, x])

    for (x, z), y in water.items():
        put(ctx, x, z, y, ctx.water)
    leaks = contained(water, g, wet, ctx)
    if leaks:
        raise ValueError(f'{lm["name"]}: {leaks} water cells could run out')

    clear = ndimage.binary_dilation(terrace | blend | canal, iterations=2)
    temple = (int(centre[0]), int(centre[1]))
    return clear, {
        'temple_centre_block': temple, 'terrace_y': T, 'landing_y': floor_y, 'columns': len(columns),
        'top_y': base + col_h + ent_h - 1, 'slid_back_m': slide, 'pool_cells': int(in_pool.sum()), 'cypress': trees,
        'canal_blocks': int(round(length)), 'canal_levels': sorted(set(levels), reverse=True),
        'shift_from_true_m': round(float(np.hypot(*(centre - ctx.to_blocks([(e0, n0)])[0]))) * ctx.scale, 1)}


def contained(water, g, wet, ctx):
    """Water cells with a 4-neighbour at their level that is neither solid nor water."""
    H, W = g.shape
    bad = 0
    for (x, z), y in water.items():
        for ox, oz in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, nz = x + ox, z + oz
            if not (0 <= nx < W and 0 <= nz < H):
                bad += 1
                continue
            if water.get((nx, nz)) == y or g[nz, nx] >= y or (wet[nz, nx] and y <= ctx.water_y):
                continue
            if water.get((nx, nz), -999) > y:          # the next step up: its water falls into ours
                continue
            if wet[nz, nx] or water.get((nx, nz), 999) < y:
                continue                              # a cascade down the canal or into the lake
            bad += 1
    return bad
