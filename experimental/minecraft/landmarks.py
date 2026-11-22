"""Landmarks from a site file's "landmarks" list, built into a reservoir world at their own scale.

Used by build_reservoir.py. Each landmark lists its blocks (registered in the builder's block
table before the world is built), its measurements with their sources, and a type that picks the
function here. Types: "pulgas-temple" (task MC7) and "footprint" (a placeholder on a real
footprint, task MC8).
"""

import math

import numpy as np
from scipy import ndimage

# Landmark blocks laid as a surface that should be solid all the way down (no dirt under paving,
# coping or a canal wall), and blocks that are plants (not motion-blocking).
FILL_KEYS = ('paving', 'coping', 'poolFloor', 'canalWall', 'canalFloor', 'wall')
PLANT_KEYS = ('lavender',)


def build(site, ctx):
    """Build every landmark of the site. Returns the cells to keep free of trees and plants, and
    a summary per landmark."""
    clear = np.zeros(ctx.ground.shape, bool)
    summary = {}
    for lm in site.get('landmarks', []):
        if lm['type'] not in ('pulgas-temple', 'footprint'):
            raise ValueError(f'Unknown landmark type {lm["type"]}')
        cells, info = (pulgas_temple if lm['type'] == 'pulgas-temple' else footprint)(lm, ctx)
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
    """The temple on its round steps with the grated well, a paved forecourt with lavender beds,
    the reflecting pool with white coping between two rows of cypress, and the canal behind the
    temple down to the lake, on a level lawn terrace. The temple has its own scale
    (templeMetresPerBlock, finer for detail); the setting has metresPerBlock and is moved out
    along the axis by however much bigger the temple is."""
    B = {key: ctx.block(name) for key, name in lm['blocks'].items()}
    g, surface, wet = ctx.ground, ctx.surface, ctx.wet
    H, W = g.shape
    kS = 1 / lm['metresPerBlock']                     # setting blocks per metre
    kT = 1 / lm.get('templeMetresPerBlock', lm['metresPerBlock'])   # temple blocks per metre
    ue, un = lm['axis']
    norm = math.hypot(ue, un)
    ue, un = ue / norm, un / norm
    u = np.array([ue, -un])                           # along the axis, temple -> pool, in blocks
    n = np.array([-u[1], u[0]])
    M, pool, cyp, fc = lm['model'], lm['pool'], lm['cypress'], lm['forecourt']
    U = M['unitMetres']
    UT = U * kT                                       # temple blocks per model unit
    r_steps = M['steps']['radii'][0] * U              # metres
    grow = r_steps * (kT - kS)                        # blocks the setting moves out
    pool_lo = pool['centreAlong'] - pool['length'] / 2
    pool_hi = pool['centreAlong'] + pool['length'] / 2
    back_b = -r_steps * kT                            # blocks along the axis from the temple centre
    front_b = grow + (pool_hi + 1) * kS
    plaza_b = r_steps * kT + (fc['plazaRadius'] - r_steps) * kS
    t_half_b = max((cyp['rowOffset'] + 4) * kS, plaza_b + 3)
    # Centre the complex (back step to the pool's far coping) on its real middle.
    mid_m = (-r_steps + pool_hi + 1) / 2
    mid_b = (back_b + front_b) / 2
    e0, n0 = lm['templeUTM']
    real_mid = ctx.to_blocks([(e0 + ue * mid_m, n0 + un * mid_m)])[0]
    odd = .5 if round(kT) % 2 else 0.0                # an even temple centres on a block corner
    # Keep the terrace inside the crop (Crystal Springs: the bundle ends just east of the pool),
    # sliding the complex back along its own axis if it would cross the edge.
    margin, slide = 3, 0.0
    while True:
        centre = np.floor(real_mid - u * (mid_b + slide)) + odd
        corners = [centre + u * a + n * b for a in (back_b - 4, front_b + 3) for b in (-t_half_b, t_half_b)]
        if all(margin <= c[0] <= W - margin and margin <= c[1] <= H - margin for c in corners):
            break
        slide += .5
        if slide > 120:
            raise ValueError(f'{lm["name"]}: does not fit inside the crop')
    zz, xx = np.mgrid[0:H, 0:W]
    dx, dz = xx + .5 - centre[0], zz + .5 - centre[1]
    sb = dx * u[0] + dz * u[1]                        # blocks along the axis
    tb = dx * n[0] + dz * n[1]                        # blocks across it
    rb = np.hypot(dx, dz)                             # blocks from the temple centre
    s = (sb - grow) / kS                              # setting metres along the axis
    t = tb / kS                                       # setting metres across it
    T = ctx.water_y + int(round((lm['templeGround'] - ctx.water_level) / ctx.scale))

    # Terrace: a level lawn under the whole complex, blended into the land over 8 blocks.
    ds = np.maximum.reduce([back_b - 4 - sb, sb - (front_b + 3), np.zeros_like(sb)])
    dt = np.maximum(np.abs(tb) - t_half_b, 0)
    out = np.hypot(ds, dt)                            # blocks outside the terrace
    terrace = out == 0
    blend = (out > 0) & (out < 8)
    if wet[terrace | blend].any():
        raise ValueError(f'{lm["name"]}: the terrace reaches the lake')
    g[terrace] = T
    g[blend] = np.rint(T + (g[blend] - T) * out[blend] / 8).astype(g.dtype)
    surface[terrace] = ctx.grass

    # Forecourt: a paved round plaza about the temple and a paved strip to the pool, with two
    # lavender beds either side of the path to the front steps.
    paved = (rb <= plaza_b) | ((s >= 0) & (s <= pool_lo) & (np.abs(t) <= fc['width'] / 2))
    bed = (s >= fc['bedFrom']) & (s <= fc['bedTo']) & (np.abs(t) >= fc['bedInner']) & (np.abs(t) <= fc['bedOuter'])
    bed &= rb > r_steps * kT + 1
    bed_inner = ndimage.binary_erosion(bed)
    surface[paved & ~bed] = B['paving']
    surface[bed] = ctx.grass

    # Pool: water level with the lawn, one block deep, inside a ring of coping.
    ps = s - pool['centreAlong']
    in_pool = (np.abs(ps) <= pool['length'] / 2) & (np.abs(t) <= pool['width'] / 2)
    coping = (np.abs(ps) <= pool['length'] / 2 + 1 / kS) & (np.abs(t) <= pool['width'] / 2 + 1 / kS) & ~in_pool
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

    # --- The temple, in temple blocks. Steps: equal half-block courses up to the landing.
    radii = [rad * UT for rad in M['steps']['radii']]
    zs = M['steps']['z']
    z_land = zs[-1]
    total = half_blocks((z_land - zs[0]) * U, kT)
    tops = [max(.5, round((i + 1) * total / len(radii) * 2) / 2) for i in range(len(radii))]
    tops[-1] = math.ceil(tops[-1])                    # the landing is whole blocks
    floor_y = T + int(tops[-1])                       # the landing's top block
    base = floor_y + 1

    def band(z):                                      # model height -> block index above the landing
        return int(round((z - z_land) * UT))

    step_h = np.zeros(g.shape)
    for rad, top in zip(radii, tops):
        step_h = np.where(rb <= rad, np.maximum(step_h, top), step_h)
    landing = rb <= radii[-1]
    w_in, w_out = (rad * UT for rad in M['well']['radii'])
    hole = rb < max(w_in, 1.01)
    well_wall = (rb < max(w_out, w_in + 1) + .5) & ~hole
    inlay = landing & (np.abs(rb - M['inlayRadius'] * UT) < .5)
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
    # The well: water three blocks below the lawn under a grate, inside a low wall with cap stones.
    g[hole] = T - 4
    surface[hole] = B['canalFloor']
    for z, x in zip(*np.nonzero(hole)):
        water[x, z] = T - 3
        put(ctx, x, z, floor_y, B['grate'])
    wall_h = max(1, band(M['well']['top']))
    for z, x in zip(*np.nonzero(well_wall)):
        for j in range(wall_h):
            put(ctx, x, z, base + j, B['wellCap'] if j == wall_h - 1 and wall_h > 1 else B['wellWall'])

    # Columns: ten round the ring, a gap on the axis front and back; a moulded base, the fluted
    # shaft, and a capital that flares out to its abacus.
    col = M['columns']
    width = max(1, int(round(2 * col['shaftRadius'] * UT)))
    cap0, cap1 = band(col['capital'][0]), band(col['capital'][1])
    flare = {(1, 0): B['flareWest'], (-1, 0): B['flareEast'], (0, 1): B['flareNorth'], (0, -1): B['flareSouth']}
    columns = 0
    for i in range(col['count']):
        phi = math.pi / col['count'] + 2 * math.pi * i / col['count']
        p = centre + (u * math.cos(phi) + n * math.sin(phi)) * col['radius'] * UT
        ox, oz = np.round(p - width / 2).astype(int)
        foot = {(ox + a, oz + b) for a in range(width) for b in range(width)}
        skirt = {}
        for fx, fz in foot:
            for (ax, az) in flare:
                c = (fx + ax, fz + az)
                if c not in foot:
                    skirt[c] = flare[ax, az]
        for (fx, fz) in foot:
            put(ctx, fx, fz, base, B['columnBase'])
            for j in range(1, cap0):
                put(ctx, fx, fz, base + j, B['shaft'])
            for j in range(cap0, cap1):
                put(ctx, fx, fz, base + j, B['capital'])
        if width > 1:
            for (cx_, cz_), stair in skirt.items():
                put(ctx, cx_, cz_, base, B['baseSlab'])
                if cap1 - cap0 >= 2:
                    put(ctx, cx_, cz_, base + cap0, stair)
                    for j in range(cap0 + 1, cap1):
                        put(ctx, cx_, cz_, base + j, B['capital'])
        columns += 1

    # Entablature: architrave (its outer face a meander band), the plain drum, the cornice with
    # its leaf-and-tongue moulding, and a crest of lion masks, anthemia and scrolls at the rim.
    r_in = M['entablature']['radii'][0] * UT
    arch, drum, corn, crest = M['architrave'], M['drum'], M['cornice'], M['cresting']
    a0, a1 = band(arch['z'][0]), band(arch['z'][1])
    d0, d1 = a1, band(drum['z'][1])
    c0, c1 = d1, band(corn['z'][1])
    ring_arch = (rb >= r_in) & (rb <= arch['outerRadius'] * UT)
    ring_drum = (rb >= r_in) & (rb <= drum['outerRadius'] * UT)
    ring_corn = (rb >= r_in) & (rb <= corn['outerRadius'] * UT)
    ring_mould = (rb > corn['outerRadius'] * UT) & (rb <= crest['radii'][1] * UT)
    angle = np.arctan2(tb, sb)
    ornament = (np.floor((angle + math.pi) / (2 * math.pi / crest['count'])).astype(int) % 2) == 0
    top_y = base + c1 - 1
    for z, x in zip(*np.nonzero(ring_arch)):
        outer = rb[z, x] > arch['outerRadius'] * UT - 1
        for j in range(a0, a1):
            put(ctx, x, z, base + j, B['meander'] if outer else B['architrave'])
    for z, x in zip(*np.nonzero(ring_drum)):
        for j in range(d0, d1):
            put(ctx, x, z, base + j, B['drum'])
    for z, x in zip(*np.nonzero(ring_corn)):
        for j in range(c0, c1):
            put(ctx, x, z, base + j, B['corniceMoulding'] if j == c0 else B['cornice'])
    for z, x in zip(*np.nonzero(ring_mould)):
        put(ctx, x, z, base + c0, B['crestingBase'])
        for j in range(c0 + 1, c1):
            put(ctx, x, z, base + j, B['cresting'] if ornament[z, x] else B['crestingSlab'])

    # Cypress: two rows along the pool's long sides, columnar crowns on bare grey trunks.
    rng = np.random.default_rng(1938)
    trees = 0
    lo_h, hi_h = cyp['height']
    for side in (-1, 1):
        for along in np.arange(pool_lo + cyp['spacing'] / 2, pool_hi, cyp['spacing']):
            px, pz = np.floor(centre + u * (grow + along * kS) + n * side * cyp['rowOffset'] * kS).astype(int)
            height = int(round(rng.uniform(lo_h, hi_h) * kS))
            top = T + height
            first = T + 1 + int(round(cyp['clearTrunk'] * kS))
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
    half = cw['water'] / 2 * kS
    head = centre - u * (r_steps * kT + .5)
    traced = [p for p in ctx.to_blocks(cw['centreUTM']) if (p - head) @ -u > 0]
    mouth = traced[-1] if traced else head
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
    canal = (d <= half + cw['wall'] * kS) & (along_c >= 0) & ~wet & ~(rb <= r_steps * kT + .5)
    lev = np.interp(along_c, samples, np.array(levels, float)).round().astype(int)
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
    return clear, {
        'temple_centre_block': (round(float(centre[0]), 1), round(float(centre[1]), 1)), 'terrace_y': T,
        'landing_y': floor_y, 'columns': columns, 'column_width_blocks': width, 'top_y': top_y,
        'slid_back_blocks': slide, 'pool_cells': int(in_pool.sum()), 'cypress': trees,
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


def footprint(lm, ctx):
    """A placeholder on a real footprint: each part (a UTM polygon, or a circle with its centre and
    radius) stands on a level pad at its footprint's median ground, solid "wall" blocks up to the
    part's height (metres, illustrative) under a "roof" layer. Returns the cells to keep clear of
    trees and plants (the footprints and a block round them) and a summary."""
    from PIL import Image, ImageDraw
    H, W = ctx.ground.shape
    wall, roof = ctx.block(lm['blocks']['wall']), ctx.block(lm['blocks']['roof'])
    clear = np.zeros((H, W), bool)
    parts = []
    for part in lm['parts']:
        img = Image.new('1', (W, H), 0)
        draw = ImageDraw.Draw(img)
        if 'circleUTM' in part:
            (cx, cz), = ctx.to_blocks([part['circleUTM']])
            r = part['radiusMetres'] / ctx.scale
            draw.ellipse([cx - r, cz - r, cx + r, cz + r], fill=1)
        else:
            draw.polygon([tuple(p) for p in ctx.to_blocks(part['polygonUTM'])], fill=1)
        cells = np.array(img, bool) & ~ctx.wet
        if not cells.any():
            raise ValueError(f'{lm["name"]}: a part falls outside the world or on water')
        pad = int(np.median(ctx.ground[cells]))
        top = pad + max(1, round(part['heightMetres'] / ctx.vscale))
        ctx.ground[cells] = pad
        ctx.surface[cells] = wall
        for z, x in zip(*np.nonzero(cells)):
            for y in range(pad + 1, top):
                put(ctx, int(x), int(z), y, wall)
            put(ctx, int(x), int(z), top, roof)
        clear |= ndimage.binary_dilation(cells, iterations=1)
        parts.append(dict(name=part.get('name', ''), cells=int(cells.sum()), pad_y=pad, top_y=top))
    return clear, parts
