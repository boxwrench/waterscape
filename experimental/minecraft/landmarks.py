"""Landmarks from a site file's "landmarks" list, built into a reservoir world at their own scale.

Used by build_reservoir.py. Each landmark lists its blocks (registered in the builder's block
table before the world is built), its measurements with their sources, and a type that picks the
function here. Types: "pulgas-temple" (task MC7), "footprint" (placeholders on real footprints,
task MC8: buildings, sheds, paving, paths, open basins of water, rows of trees) and
"round-temple" (the Sunol Water Temple, task MC8).
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
        kinds = {'pulgas-temple': pulgas_temple, 'footprint': footprint, 'round-temple': round_temple}
        if lm['type'] not in kinds:
            raise ValueError(f'Unknown landmark type {lm["type"]}')
        cells, info = kinds[lm['type']](lm, ctx)
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


def part_cells(part, ctx):
    """A part's footprint cells: a UTM polygon, a circle (centre and radius) or a rectangle
    (centre, length along a bearing, width). For a rectangle also its frame, to place dividers:
    (centre, along and across per metre, in blocks; length, width)."""
    from PIL import Image, ImageDraw
    H, W = ctx.ground.shape
    img = Image.new('1', (W, H), 0)
    draw = ImageDraw.Draw(img)
    frame = None
    if 'circleUTM' in part:
        (cx, cz), = ctx.to_blocks([part['circleUTM']])
        r = part['radiusMetres'] / ctx.scale
        draw.ellipse([cx - r, cz - r, cx + r, cz + r], fill=1)
    elif 'rectUTM' in part:
        rect = part['rectUTM']
        c, b = np.array(rect['centre'], float), math.radians(rect['bearing'])
        a, n = np.array([math.sin(b), math.cos(b)]), np.array([-math.cos(b), math.sin(b)])
        L, Wd = rect['length'], rect['width']
        corners = [c + a * sa * L / 2 + n * sn * Wd / 2 for sa, sn in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        draw.polygon([tuple(p) for p in ctx.to_blocks(corners)], fill=1)
        cb, ab, nb = ctx.to_blocks([c, c + a, c + n])
        frame = (cb, ab - cb, nb - cb, L, Wd)
    elif 'lineUTM' in part:   # a path: cells within half its width of the line
        pts = ctx.to_blocks(part['lineUTM'])
        half = max(1, round(part['widthMetres'] / ctx.scale)) / 2 + 0.2
        for (ax, az), (bx, bz) in zip(pts[:-1], pts[1:]):
            for s in np.linspace(0, 1, max(2, int(math.hypot(bx - ax, bz - az) * 4))):
                x, z = ax + (bx - ax) * s, az + (bz - az) * s
                draw.ellipse([x - half, z - half, x + half, z + half], fill=1)
    else:
        draw.polygon([tuple(p) for p in ctx.to_blocks(part['polygonUTM'])], fill=1)
    return np.array(img, bool), frame


def perimeter(cells):
    """Cells of a footprint with a 4-neighbour outside it."""
    return cells & ~ndimage.binary_erosion(cells)


def footprint(lm, ctx):
    """A placeholder on a real footprint, made of parts laid in order (a later part over an
    earlier one's paving, but never over its buildings or basins). Each part's "kind":
      building (default): solid "wall" blocks up to its height (metres, illustrative, at the
        site's building scale) under a "roof" layer, on a level pad at its footprint's median
        ground; optional "band" (a window row every three blocks round the outside), "parapet"
        (a ring on the roof's edge) and "roofTop" (on the roof inside the edge: solar panels).
      canopy: an open shed, posts round the edge under a roof.
      paving: the ground's top block ("surface", by default "paving"), levelled if "level".
      path: a line ("lineUTM", "widthMetres") of the same.
      basin: an open tank, water a block under its rim (two deep, on a "floor"), divided into a
        "grid" of cells (rectangles: [along, across]) by walls.
      trees: a row of planted trees along "lineUTM" every "spacingMetres", at each of
        "offsetsMetres" to the side, of the landmark's "trees" entry named by "tree".
    A part's block keys ("wall", "roof", ...) name entries of the landmark's "blocks"; by default
    each key names itself. Returns the cells to keep clear of trees and plants (the footprints and
    a block round them) and a summary."""
    clear = np.zeros(ctx.ground.shape, bool)
    taken = np.zeros(ctx.ground.shape, bool)
    parts, water = [], {}
    B = lambda part, key: ctx.block(lm['blocks'][part.get(key, key)])
    for part in lm['parts']:
        kind = part.get('kind', 'building')
        if kind == 'trees':
            parts.append(dict(name=part.get('name', ''), kind=kind, trees=planted_row(lm, part, ctx)))
            continue
        cells, frame = part_cells(part, ctx)
        cells &= ~ctx.wet & ~taken   # an earlier building or basin keeps its cells
        if not cells.any():
            raise ValueError(f'{lm["name"]}: a part falls outside the world or on water')
        info = dict(name=part.get('name', ''), kind=kind, cells=int(cells.sum()))
        if kind in ('paving', 'path'):
            if part.get('level'):
                ctx.ground[cells] = int(np.median(ctx.ground[cells]))
            ctx.surface[cells] = ctx.block(lm['blocks'][part.get('surface', 'paving')])
        elif kind == 'basin':
            pad = int(np.median(ctx.ground[cells]))
            walls = perimeter(cells)
            if frame is not None and 'grid' in part:
                walls |= dividers(cells, frame, part['grid'], ctx.scale)
            inner = cells & ~walls
            ctx.ground[cells] = pad
            ctx.surface[walls] = B(part, 'wall')
            for z, x in zip(*np.nonzero(walls)):
                put(ctx, int(x), int(z), pad + 1, B(part, 'wall'))
            ctx.ground[inner] = pad - 2
            ctx.surface[inner] = B(part, 'floor')
            for z, x in zip(*np.nonzero(inner)):
                for y in (pad - 1, pad):
                    put(ctx, int(x), int(z), y, ctx.water)
                water[int(x), int(z)] = pad
            info.update(pad_y=pad, water_y=pad, water_cells=int(inner.sum()))
        else:   # building or canopy
            pad = int(np.median(ctx.ground[cells]))
            top = pad + max(1, round(part['heightMetres'] / ctx.building_vscale))
            wall, roof = B(part, 'wall'), B(part, 'roof')
            edge = perimeter(cells)
            ctx.ground[cells] = pad
            ctx.surface[cells] = wall if kind == 'building' else B(part, 'surface') if 'surface' in part else ctx.surface[cells]
            zs, xs = np.nonzero(cells)
            for z, x in zip(zs, xs):
                x, z = int(x), int(z)
                if kind == 'building' or (edge[z, x] and (x + z) % 3 == 0):   # a canopy's posts
                    for y in range(pad + 1, top):
                        put(ctx, x, z, y, wall)
                put(ctx, x, z, top, roof)
                if kind == 'building' and edge[z, x]:
                    if 'band' in part:
                        for y in range(pad + 2, top - 1, 3):
                            put(ctx, x, z, y, B(part, 'band'))
                    if 'parapet' in part:
                        put(ctx, x, z, top + 1, B(part, 'parapet'))
                elif kind == 'building' and 'roofTop' in part:
                    put(ctx, x, z, top + 1, B(part, 'roofTop'))
            info.update(pad_y=pad, top_y=top)
        if kind not in ('paving', 'path'):
            taken |= cells
        clear |= ndimage.binary_dilation(cells, iterations=1)
        parts.append(info)
    leaks = contained(water, ctx.ground, ctx.wet, ctx)
    if leaks:
        H, W = ctx.ground.shape
        bad = [(x, z, y) for (x, z), y in water.items() for ox, oz in ((1, 0), (-1, 0), (0, 1), (0, -1))
               if (x + ox, z + oz) not in water and ctx.ground[min(z + oz, H - 1), min(x + ox, W - 1)] < y]
        raise ValueError(f'{lm["name"]}: {leaks} basin water cells could run out, at {bad[:5]}')
    return clear, parts


def dividers(cells, frame, grid, scale):
    """Walls splitting a rectangle's cells into grid[0] x grid[1] (along x across) compartments."""
    (cb, ab, nb, L, Wd) = frame
    zs, xs = np.nonzero(cells)
    p = np.stack([xs + .5, zs + .5], 1) - cb
    along, across = p @ ab / (ab @ ab), p @ nb / (nb @ nb)
    hit = np.zeros(len(zs), bool)
    for coord, size, n in ((along, L, grid[0]), (across, Wd, grid[1])):
        for k in range(1, n):
            hit |= np.abs(coord - (-size / 2 + k * size / n)) < scale / 2
    out = np.zeros_like(cells)
    out[zs[hit], xs[hit]] = True
    return out


def planted_row(lm, part, ctx):
    """Trees every spacingMetres along a line, at each side offset, on the ground: a ball crown
    (most of the top half) or a column (from a quarter up). Heights at the site's tree scale,
    crowns at its crown scale. Returns how many were planted."""
    spec = lm['trees'][part['tree']]
    log, leaves = ctx.block(lm['blocks'][spec['log']]), ctx.block(lm['blocks'][spec['leaves']])
    H, W = ctx.ground.shape
    pts = np.array(part['lineUTM'], float)
    seg = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(pts, axis=0).T))])
    planted = 0
    for s in np.arange(part['spacingMetres'] / 2, seg[-1], part['spacingMetres']):
        i = min(np.searchsorted(seg, s, side='right') - 1, len(pts) - 2)
        d = (pts[i + 1] - pts[i]) / (seg[i + 1] - seg[i])
        base = pts[i] + d * (s - seg[i])
        for off in part['offsetsMetres']:
            (x, z), = ctx.to_blocks([base + np.array([-d[1], d[0]]) * off])
            x, z = int(x), int(z)
            if not (1 <= x < W - 1 and 1 <= z < H - 1) or ctx.wet[z, x]:
                continue
            g = int(ctx.ground[z, x])
            height = max(3, round(spec['heightMetres'] / ctx.tree_vscale))
            r = max(1.0, spec['radiusMetres'] / ctx.crown_scale)
            top = g + height
            low = top - max(2, round(height * 0.45)) if spec.get('shape', 'ball') == 'ball' else g + max(2, round(height * 0.25))
            for y in range(low, top + 1):
                rr = r - .6 if y in (low, top) else r
                span = int(math.floor(rr))
                for oz in range(-span, span + 1):
                    for ox in range(-span, span + 1):
                        if ox * ox + oz * oz <= rr * rr and 0 <= x + ox < W and 0 <= z + oz < H:
                            put(ctx, x + ox, z + oz, y, leaves, keep=True)
            for y in range(g + 1, top):
                put(ctx, x, z, y, log)
            planted += 1
    return planted


def round_temple(lm, ctx):
    """A round temple on a stepped base in a circular plaza, at its own finer scale
    ("metresPerBlock", for its parts; illustrative proportions) and centred on its real middle:
    steps, a floor, a ring of columns, a two-block entablature (the second a full ceiling), a
    stepped conical roof and a finial. The plaza is drawn at the land's scale, but at least a
    block round the base. Returns the plaza cells (and a block round) and a summary."""
    B = {key: ctx.block(name) for key, name in lm['blocks'].items()}
    (cx, cz), = ctx.to_blocks([lm['centreUTM']])
    k = 1 / lm['metresPerBlock']
    R = lm['diameterMetres'] / 2 * k
    steps = lm['steps']
    plaza_r = max(lm['plazaRadiusMetres'] / ctx.scale, R + steps + 1)
    H, W = ctx.ground.shape
    span = int(math.ceil(plaza_r)) + 2
    x0, z0 = int(cx) - span, int(cz) - span
    zz, xx = np.mgrid[z0:z0 + 2 * span + 1, x0:x0 + 2 * span + 1]
    d = np.hypot(xx + .5 - cx, zz + .5 - cz)
    sl = np.s_[z0:z0 + 2 * span + 1, x0:x0 + 2 * span + 1]
    plaza = d <= plaza_r
    pad = int(np.median(ctx.ground[sl][plaza]))
    ctx.ground[sl][plaza] = pad
    ctx.surface[sl][plaza] = B['plaza']
    def ring(lo, hi, y, block):
        for z, x in zip(*np.nonzero((d >= lo) & (d <= hi))):
            put(ctx, int(x) + x0, int(z) + z0, y, block)
    for s in range(steps):
        ring(0, R + steps - s + .3, pad + 1 + s, B['step'])
    floor = pad + steps
    ring(0, R + .3, floor, B['floor'])
    col_h = max(2, round(lm['columnHeightMetres'] * k))
    cols = set()
    for i in range(lm['columns']):
        t = 2 * math.pi * (i + .5) / lm['columns']
        cols.add((int(math.floor(cx + (R - .5) * math.cos(t))), int(math.floor(cz + (R - .5) * math.sin(t)))))
    for x, z in cols:
        for y in range(floor + 1, floor + 1 + col_h):
            put(ctx, x, z, y, B['column'])
    y1 = floor + 1 + col_h
    ring(R - 1.3, R + .5, y1, B['entablature'])
    ring(0, R + .5, y1 + 1, B['entablature'])
    ring(R + .2, R + 1.1, y1 + 1, B['cornice'])
    layers = lm['roofLayers']
    for i in range(layers):
        ring(0, (R + .6) * (1 - i / layers), y1 + 2 + i, B['roof'])
    top = y1 + 2 + layers
    put(ctx, int(math.floor(cx)), int(math.floor(cz)), top, B['finial'])
    put(ctx, int(math.floor(cx)), int(math.floor(cz)), top + 1, B['finialTop'])
    clear = np.zeros(ctx.ground.shape, bool)
    clear[sl] = ndimage.binary_dilation(plaza, iterations=1)
    return clear, dict(centre_block=(round(float(cx), 1), round(float(cz), 1)), plaza_radius_blocks=round(plaza_r, 1),
                       colonnade_radius_blocks=round(R, 1), columns=len(cols), plaza_y=pad, floor_y=floor, top_y=top + 1)
