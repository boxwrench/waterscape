"""Build a reservoir world from its Waterscape bundle, site file and palette.

  python experimental/minecraft/build_reservoir.py --site experimental/minecraft/sites/<id>.json \
      --template "<Java 26.3 save>" --out "<new folder>" [--server-jar ~/mc-server/versions/26.3/server-26.3.jar]

Inputs: the site file (crop, scale, water level, the dam traced from NAIP with its sources), its
bundle data/<id>/ (terrain, land.json, cameras.json), the bundle's biome (data/biomes/<biome>/
biome.json: the tree species) and the site's palette (palettes/<palette>.json: blocks and biome
colours). The template save only supplies level.dat's version keys and generator settings. With
--server-jar the world gets a datapack (built from that jar's own biome) with the palette's
colours; without it the biome keeps vanilla colours.

The ground and trees translate the browser's rules: renderer/land/ground.js (grass is the
ground; soil on the bank and in patches; rock on steep ground) and renderer/land/oak-placement.js
(oakSite and standPick, ported exactly, so each tree stands where the browser draws one, with the
browser's species). Dams: an earth embankment (crest, riprap, grassed face, spillway chute) or a
gravity dam (crest, stepped face, spillway over the face into a stilling basin), from the site
file's "type". Landmarks from the site file's "landmarks" list are built by landmarks.py at their
own scale (the Pulgas Water Temple, task MC7). Sites: Calaveras (task MC2), Crystal Springs
(task MC6). MC1 will make this the builder for every bundle.
"""

import argparse
import gzip
import json
import math
import shutil
import subprocess
import sys
import time
from collections import defaultdict
from pathlib import Path
from types import SimpleNamespace

import nbtlib
import numpy as np
from nbtlib import Byte, Compound, Float, Int, IntArray, List, Long, String
from PIL import Image
from scipy import ndimage

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE / 'prototype'))
sys.path.insert(0, str(HERE / 'pack'))
import region_edit as region
from build_datapack import make_datapack
from world_columns import World, longpack, state
import landmarks

VERSION = 5023
# The site is needed before the block table below is built, so --site is read first.
_pre = argparse.ArgumentParser(add_help=False)
_pre.add_argument('--site', type=Path, default=HERE / 'sites/calaveras.json')
SITE_PATH = _pre.parse_known_args()[0].site
SITE = json.loads(SITE_PATH.read_text())
LAND = json.loads((REPO / SITE['bundle'] / 'land.json').read_text())
BIOME = json.loads((REPO / 'data/biomes' / LAND['biome'] / 'biome.json').read_text())
PAL = json.loads((HERE / f'palettes/{SITE["palette"]}.json').read_text())
SCALE = SITE['metresPerBlock']
# Vertical scale (metres per block up); a site may exaggerate relief (task MC8). K is the ratio
# that turns a slope in metres into one in blocks.
VSCALE = SITE.get('metresPerBlockVertical', SCALE)
K = VSCALE / SCALE
# Trees and buildings may stand taller than the land's scale, for play (site "objectScale"): tree
# heights, crown widths and building heights each in metres per block; by default the land's.
OBJ = SITE.get('objectScale', {})
TREE_VSCALE = OBJ.get('treeMetresPerBlock', VSCALE)
CROWN_SCALE = OBJ.get('crownMetresPerBlock', SCALE)
BUILDING_VSCALE = OBJ.get('buildingMetresPerBlock', VSCALE)
WATER_Y = SITE['waterY']
# Dams: one ("dam") or several ("dams", each naming its "lake" when the site has several).
DAMS = SITE.get('dams') or [SITE['dam']]
WEST, NORTH = SITE['crop']['west'], SITE['crop']['north']
WIDTH, LENGTH = SITE['crop']['width'], SITE['crop']['length']
SEED = SITE['seed']
DATAPACK = 'waterscape-' + SITE['palette'].split('-')[0]

# Block table: index -> block state. Leaves are persistent so they never decay.
NAMES = ['air', 'bedrock', 'stone', 'water']
def _add(name):
    if name not in NAMES:
        NAMES.append(name)
    return NAMES.index(name)
G = PAL['ground']
GRASS = [_add(n) for n in G['grass']]
SOIL = [_add(n) for n in G['soil']]
ROCK = [_add(n) for n in G['rock']]
BED = [_add(n) for n in G['bed']]
UNDER = _add(G['under'])
PLANTS = [_add(n) for n in PAL['plants']['blocks']]
# The biome's species in biome.json variant order, as the browser's speciesThresholds uses them.
SPECIES = list(dict.fromkeys(v['species'] for v in BIOME['trees']['variants']))
LOGS = [_add(PAL['trees'][s]['log']) for s in SPECIES]
LEAVES = [_add(PAL['trees'][s]['leaves']) for s in SPECIES]
D = PAL['dam']
CREST, CREST_EDGE, FACE = _add(D['crest']), _add(D['crestEdge']), _add(D['face'])
RIPRAP = [_add(n) for n in D['riprap']]
SPILL, SPILL_WALL = _add(D['spillway']), _add(D['spillwayWall'])
# Causeways (roads on fill across the water), only for sites that list them.
CW = PAL.get('causeway', {})
ROAD, ROAD_EDGE = (_add(CW['road']), _add(CW['edge'])) if SITE.get('causeways') else (None, None)
# Roads and trails (site "roads", fetch_roads.py), only for sites that list them.
ROAD_BLOCKS = {k: _add(PAL['roads'][k]) for k in ('paved', 'unpaved', 'trail', 'bridge')} if SITE.get('roads') else {}
# Landmarks (site file "landmarks", landmarks.py): their blocks, which may carry block-state
# properties as name[key=value,...].
LANDMARKS = SITE.get('landmarks', [])
for _n in sorted({n for lm in LANDMARKS for n in lm['blocks'].values()}):
    _add(_n)
AIR, BEDROCK, STONE, WATER = 0, 1, 2, 3
# A gravity dam is masonry all the way down (its stepped face would otherwise show the dirt under
# each step); an earth dam keeps soil under its surface. So are a landmark's paving and walls.
MASONRY = [CREST, CREST_EDGE, FACE, SPILL, SPILL_WALL] if any(d['type'].lower() == 'gravity' for d in DAMS) else []
MASONRY += [NAMES.index(lm['blocks'][k]) for lm in LANDMARKS for k in landmarks.FILL_KEYS if k in lm['blocks']]


def block_state(n):
    name, _, props = n.partition('[')
    props = dict(p.split('=') for p in props.rstrip(']').split(',')) if props else {}
    if name.endswith('_leaves'):
        props.update(persistent=True, distance=7, waterlogged=False)
    return state(name, **props)


BLOCKS = [block_state(n) for n in NAMES]
IS_LEAVES = np.array([n.endswith('_leaves') for n in NAMES])
IS_PLANT = np.isin(np.arange(len(NAMES)), PLANTS + [NAMES.index(lm['blocks'][k]) for lm in LANDMARKS
                                                     for k in landmarks.PLANT_KEYS if k in lm['blocks']])
IS_AIR = np.arange(len(NAMES)) == AIR
IS_FLUID = np.arange(len(NAMES)) == WATER


# --- the browser's hash and noise (renderer/land/oak-placement.js), vectorised -------------------
def _imul(a, b):
    return (a.astype(np.int64) * b) & 0xFFFFFFFF

def hash_u(x):
    x = x.astype(np.uint64) & 0xFFFFFFFF
    x ^= x >> 16
    x = _imul(x, 2146121005).astype(np.uint64)
    x ^= x >> 15
    x = _imul(x, 2221713035).astype(np.uint64)
    x ^= x >> 16
    return x

def bhash(x, z):
    """hash() in oak-placement.js: a float in (0, 1) from integer lattice coordinates."""
    xi, zi = np.trunc(np.asarray(x, float)).astype(np.int64), np.trunc(np.asarray(z, float)).astype(np.int64)
    seed = (_imul(xi, 1973) + _imul(zi, 9277) + 89173) & 0xFFFFFFFF
    return ((hash_u(seed) & 16777215).astype(np.float64) + 1) / 16777217

def bnoise(x, z):
    ix, iz = np.floor(x), np.floor(z)
    u, w = x - ix, z - iz
    u, w = u * u * (3 - 2 * u), w * w * (3 - 2 * w)
    a, b = bhash(ix, iz), bhash(ix + 1, iz)
    c, d = bhash(ix, iz + 1), bhash(ix + 1, iz + 1)
    return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * w

def fbm(x, z):
    return (0.55 * bnoise(x, z) + 0.28 * bnoise(x * 2.03 + 17.1, z * 2.03 + 17.1)
            + 0.12 * bnoise(x * 4.12, z * 4.12) + 0.05 * bnoise(x * 8.36, z * 8.36))

def smooth(lo, hi, value):
    t = np.clip((value - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


# --- inputs -------------------------------------------------------------------------------------
def load_grid(folder):
    meta = json.loads((folder / 'terrain.json').read_text())
    order = ('height', 'shoreDistance', 'valley')
    raw = np.frombuffer(gzip.decompress((folder / 'terrain.bin.gz').read_bytes()), '<u2')
    raw = raw.reshape(len(order), meta['height'], meta['width'])
    decoded = np.cumsum(raw, axis=1, dtype=np.uint16).astype(np.float32)
    for plane, name in zip(decoded, order):
        plane *= meta['channels'][name]['scale']
        plane += meta['channels'][name]['offset']
    return meta, decoded


class Terrain:
    """terrain.sample() of renderer/terrain.js: bilinear, clamped at the grid edge."""
    def __init__(self, meta, data):
        self.x0, self.z0 = meta['gridOrigin']
        self.cell = meta['cell'][0]
        self.data = data

    def sample(self, x, z, channel):
        h, w = self.data.shape[1:]
        u = np.clip((np.asarray(x) - self.x0) / self.cell, 0, w - 1.001)
        v = np.clip((np.asarray(z) - self.z0) / self.cell, 0, h - 1.001)
        return ndimage.map_coordinates(self.data[channel], [v.ravel(), u.ravel()], order=1).reshape(u.shape)


def block_centres():
    x = WEST + (np.arange(WIDTH, dtype=np.float64) + .5) * SCALE
    z = NORTH + (np.arange(LENGTH, dtype=np.float64) + .5) * SCALE
    return np.meshgrid(x, z)


def find_lakes(meta, look, wet):
    """The lakes: one (the bundle's) or the site's "lakes", each the connected water holding its
    bundle's anchor, at its own level (terrain.json "lakes") and with its own bank slope and depth
    cap (its bundle's land.json). Water joined from other flattened surveys (make_valley_terrain's
    extra anchors) that does not touch its lake goes to the nearest lake. Returns the lakes, a
    lake number per cell (0 dry) and the cells so joined."""
    if not SITE.get('lakes'):
        lake = SimpleNamespace(id=SITE['id'], name=SITE['name'], level=meta['waterLevel'], y=WATER_Y, water=look['water'])
        return [lake], wet.astype(np.int8), np.zeros(wet.shape, bool)
    sys.path.insert(0, str(REPO / 'pipeline'))
    import geo
    labels, _ = ndimage.label(wet)
    number = np.zeros(wet.shape, np.int8)
    levels = {lk['name']: lk['waterLevel'] for lk in meta['lakes']}
    lakes = []
    for i, lk in enumerate(SITE['lakes']):
        anchor = json.loads((REPO / lk['bundle'] / 'source.json').read_text())['anchor']
        (x, z), = to_blocks(meta, [geo.utm(*anchor, 10)]).astype(int)
        if not labels[z, x]:
            raise ValueError(f'{lk["name"]}: its anchor is not on the water')
        number[labels == labels[z, x]] = i + 1
        level = levels[lk['name']]
        water = json.loads((REPO / lk['bundle'] / 'land.json').read_text())['water']
        lakes.append(SimpleNamespace(id=lk['id'], name=lk['name'], level=level,
                                     y=WATER_Y + int(round((level - meta['waterLevel']) / VSCALE)), water=water))
    joined = wet & (number == 0)
    if joined.any():
        near = number[tuple(ndimage.distance_transform_edt(number == 0, return_distances=False, return_indices=True))]
        number[joined] = near[joined]
    return lakes, number, joined


def terrain(tr, look, rng, meta):
    X, Z = block_centres()
    if X.min() < tr.x0 or Z.min() < tr.z0:
        raise ValueError('Crop extends outside the Waterscape bundle')
    h, shore, valley = (tr.sample(X, Z, c).astype(np.float32) for c in range(3))
    wet = shore < 0
    lakes, number, joined = find_lakes(meta, look, wet)
    if any(edge.any() for edge in (wet[0], wet[-1], wet[:, 0], wet[:, -1])):
        raise ValueError('Crop cuts through the reservoir')
    # Every cell's nearest lake: its water height where it is wet, and the level a dry cell's
    # bank is measured from.
    nearest = number[tuple(ndimage.distance_transform_edt(number == 0, return_distances=False, return_indices=True))]
    water_y = np.array([WATER_Y] + [lk.y for lk in lakes], np.int16)[nearest]
    shore_ring = ndimage.binary_dilation(wet) & ~wet
    ground = np.rint(WATER_Y + h / VSCALE).astype(np.int16)
    # A lower dry neighbour would let source blocks flow outside the source shoreline.
    ground[shore_ring] = np.maximum(ground[shore_ring], water_y[shore_ring])
    # Synthetic lake bed (the lidar cannot see under water): bank slope and depth cap from land.json.
    macro = bnoise(X * 0.012 + 3.1, Z * 0.012 - 7.3)
    if len(lakes) == 1:
        slope, cap = lakes[0].water['bankSlope'], lakes[0].water['maxDepth']
    else:
        slope = np.array([0] + [lk.water['bankSlope'] for lk in lakes])[nearest]
        cap = np.array([SCALE] + [lk.water['maxDepth'] for lk in lakes])[nearest]
    depth_m = np.clip(-shore * slope + (macro - .5) * 8, SCALE, cap)
    ground[wet] = water_y[wet] - np.maximum(1, np.rint(depth_m[wet] / VSCALE)).astype(np.int16)
    if ground.min() < -60 or ground.max() > 305:
        raise ValueError('Terrain does not fit the Java build height')
    # Height above the nearest lake, for the bank rule in ground_cover().
    bank_h = h if len(lakes) == 1 else h - np.array([0] + [lk.level - meta['waterLevel'] for lk in lakes], np.float32)[nearest]
    lake_info = SimpleNamespace(lakes=lakes, number=number, water_y=water_y, bank_h=bank_h, joined=int(joined.sum()))
    return X, Z, h, shore, valley, wet, ground, macro, lake_info


def ground_cover(X, Z, h, shore, valley, wet, macro, bank_h=None):
    """renderer/land/ground.js, non-granite branch: grass, then soil (bank and patches), then rock.
    One departure: the bank (soil up to 3 to 6 m above the water) is kept to land within 80 m of
    the shore. The browser applies it to all land below that height, which would make the creek
    canyon below the dam bare soil; the aerial shows it grassed and wooded."""
    dz, dx = np.gradient(h, float(SCALE))
    slope = 1 - 1 / np.sqrt(1 + dx * dx + dz * dz)
    rock_w = smooth(.34, .55, slope + (macro - .5) * .25) * (1 - valley * .6)
    bank = (1 - smooth(3, 6, h if bank_h is None else bank_h)) * (1 - smooth(60, 80, shore))
    patch = smooth(.72, .86, bnoise(X * 0.02 + 7.7, Z * 0.02 + 1.9))
    soil_w = np.maximum(bank, patch * .6)
    pick = bnoise(X * 0.4 + 11.3, Z * 0.4 - 5.1)                       # per-block variety
    soil_mix = bnoise(X * 0.03 + 11, Z * 0.03 - 2) > .5
    surface = np.full(h.shape, GRASS[0], np.uint8)
    surface[soil_w > .5] = np.where(soil_mix, SOIL[0], SOIL[-1])[soil_w > .5]
    rock = rock_w > .5
    surface[rock] = np.array(ROCK, np.uint8)[(pick[rock] * len(ROCK)).astype(int) % len(ROCK)]
    surface[wet] = np.array(BED, np.uint8)[(pick[wet] * len(BED)).astype(int) % len(BED)]
    return surface, rock


# --- the dam, from the site file ----------------------------------------------------------------
def to_blocks(meta, utm):
    e0, n0 = meta['originUTM']
    return np.array([((e - e0 - WEST) / SCALE, (n0 - n - NORTH) / SCALE) for e, n in utm])


def polyline_frame(pts, shape):
    """Distance (blocks) from every cell centre to a polyline, the along-distance of the closest
    point, the side (+1 left of travel, -1 right) and the segment parameter at the ends."""
    zz, xx = np.mgrid[0:shape[0], 0:shape[1]]
    px, pz = xx + .5, zz + .5
    best = np.full(shape, np.inf)
    along = np.zeros(shape)
    side = np.zeros(shape)
    t_end = np.zeros(shape)
    run = 0.0
    for i, ((ax, az), (bx, bz)) in enumerate(zip(pts[:-1], pts[1:])):
        vx, vz = bx - ax, bz - az
        L = math.hypot(vx, vz)
        t = ((px - ax) * vx + (pz - az) * vz) / (L * L)
        raw = t.copy()
        if i > 0:
            t = np.maximum(t, 0)
        if i < len(pts) - 2:
            t = np.minimum(t, 1)
        tc = np.clip(t, 0, 1)
        d = np.hypot(px - (ax + tc * vx), pz - (az + tc * vz))
        closer = d < best
        best[closer] = d[closer]
        along[closer] = (run + raw * L)[closer]
        side[closer] = np.sign((px - ax) * vz - (pz - az) * vx)[closer]
        t_end[closer] = raw[closer] if len(pts) == 2 else 0.5
        run += L
    return best, along, side, t_end, run


def build_dam(meta, ground, surface, wet, rng, lakes):
    """The site's dams: each an earth embankment or a gravity dam, by its NID type, on its lake
    ("lake" names it when the site has several). Returns the cells to keep clear, extra blocks
    and counts (by dam name when there are several)."""
    clear = np.zeros(ground.shape, bool)
    extras = defaultdict(dict)
    counts = {}
    for dam in DAMS:
        lake = next(lk for lk in lakes if lk.id == dam['lake']) if 'lake' in dam else lakes[0]
        build = build_gravity_dam if dam['type'].lower() == 'gravity' else build_earth_dam
        c, e, n = build(meta, dam, lake.y, ground, surface, wet, rng)
        if len(DAMS) == 1:
            return c, e, n
        clear |= c
        for key, blocks in e.items():
            extras[key].update(blocks)
        counts[dam['name']] = n
    return clear, extras, counts


def contained_pool(cells, ground, wet, floor):
    """Cells of a pool one block deep at floor + 1 whose every neighbour is pool or solid at that
    level, so none of the water can run out."""
    pool = cells.copy()
    while True:
        ok = np.ones_like(pool)
        for dz, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ok &= np.roll(pool, (dz, dx), (0, 1)) | (np.roll(ground, (dz, dx), (0, 1)) >= floor + 1) \
                & ~np.roll(wet, (dz, dx), (0, 1))
        keep = pool & ok
        if keep.sum() == pool.sum():
            return pool
        pool = keep


def build_gravity_dam(meta, dam, lake_y, ground, surface, wet, rng):
    """A masonry or concrete gravity dam: a level crest straight up from the lake, a stepped
    downstream face (the site's slope, horizontal per vertical) down to the creek, the spillway
    as the part of the face above the stilling basin, and the basin with a little water.
    Returns a mask of cells to keep free of trees and plants, extra blocks by chunk and counts."""
    extras = defaultdict(dict)
    crest_y = WATER_Y + int(round((dam['crestElevation'] - meta['waterLevel']) / VSCALE))
    crest = to_blocks(meta, dam['crestUTM'])
    d, along, side, t, length = polyline_frame(crest, ground.shape)
    near = d < 12
    up = 1 if (side[wet & near] > 0).sum() >= (side[wet & near] < 0).sum() else -1
    within = (t >= -0.02) & (t <= 1.02)
    interior = (t >= 0.08) & (t <= 0.92)
    half = dam['crestWidth'] / 2 / SCALE
    slope = dam['downstreamSlope']
    body = within & (d <= half + 0.25)
    down = within & (side == -up) & (d > half + 0.25)
    # The creek floor below the dam: the lowest ground in the first stretch downstream.
    toe = int(ground[down & (d < half + 30)].min())
    reach = half + slope * K * (crest_y - toe)
    face_y = np.floor(crest_y - (d - half) / (slope * K) + .5).astype(np.int16)
    ground[body] = crest_y
    wet[body] = False
    surface[body] = CREST
    # Interior of the face: cut or fill the surveyed (10 m, smoothed) dam to the stepped profile.
    cut = down & interior & ~wet & (d <= reach + 1)
    ground[cut] = np.maximum(face_y[cut], toe)
    # At the abutments only fill, so the canyon walls stay.
    fill = down & ~interior & ~wet & (face_y > ground) & (d <= reach)
    ground[fill] = face_y[fill]
    face = (cut & (face_y >= toe)) | fill
    surface[face] = FACE
    # The stilling basin at the toe, from the site file.
    b = dam['basin']
    line = to_blocks(meta, b['centreUTM'])
    db, b_along, _, b_t, b_len = polyline_frame(line, ground.shape)
    b_half = b['width'] / 2 / SCALE
    in_basin = (db <= b_half) & (b_t >= 0) & (b_t <= 1) & ~wet & ~body
    basin_floor = toe - 1
    # The spillway: the stretch of face whose place along the crest lies opposite the basin.
    a_lo, a_hi = along[in_basin].min(), along[in_basin].max()
    spill = face & (along >= a_lo) & (along <= a_hi)
    surface[spill] = SPILL
    surface[body & (along >= a_lo) & (along <= a_hi)] = SPILL
    wall = (db > b_half) & (db <= b_half + 1) & (b_t >= -0.05) & (b_t <= 1.05) & ~wet & ~body & ~face
    wall |= in_basin & (b_along > b_len - 1)
    for z, x in zip(*np.nonzero(wall)):
        top = basin_floor + 2
        for y in range(min(int(ground[z, x]), top) - 2, top):
            extras[x // 16, z // 16][y, z % 16, x % 16] = SPILL_WALL
        ground[z, x] = max(int(ground[z, x]), top)
        surface[z, x] = SPILL_WALL
    basin_in = in_basin & ~wall
    ground[basin_in] = basin_floor
    surface[basin_in] = SPILL
    pool = contained_pool(basin_in, ground, wet, basin_floor)
    for z, x in zip(*np.nonzero(pool)):
        extras[x // 16, z // 16][basin_floor + 1, z % 16, x % 16] = WATER
    clear = body | face | (down & (d <= reach + 3)) | (db <= b_half + 3)
    counts = dict(crest_y=crest_y, crest_cells=int(body.sum()), face_cells=int(face.sum()),
                  spillway_cells=int(spill.sum()), toe_y=toe, basin_cells=int(basin_in.sum()),
                  basin_water=int(pool.sum()), basin_floor_y=basin_floor, dam_height_blocks=crest_y - toe)
    return clear, extras, counts


def build_earth_dam(meta, dam, lake_y, ground, surface, wet, rng):
    """Level the crest, armour the upstream face, grass the downstream face, cut the spillway.
    Returns a mask of cells to keep free of trees and plants, and extra blocks by chunk."""
    extras = defaultdict(dict)
    crest_y = WATER_Y + int(round((dam['crestElevation'] - meta['waterLevel']) / VSCALE))
    crest = to_blocks(meta, dam['crestUTM'])
    d, _, side, t, _ = polyline_frame(crest, ground.shape)
    near = d < 12
    up = 1 if (side[wet & near] > 0).sum() >= (side[wet & near] < 0).sum() else -1
    within = (t >= -0.01) & (t <= 1.01)
    half = dam['crestWidth'] / 2 / SCALE
    body = within & (d <= half + 0.25)
    up_face = within & (side == up) & (d > half + 0.25)
    down_face = within & (side == -up) & (d > half + 0.25)
    # Upstream face about 3 horizontal to 1 vertical, downstream about 2.7:1 (both through the
    # crest edge); applied only where it is higher than the survey, which holds the embankment
    # smoothed by its 10 m cells.
    up_y = np.floor(crest_y - (d - half) / (3 * K) + .5).astype(np.int16)
    down_y = np.floor(crest_y - (d - half) / (2.7 * K) + .5).astype(np.int16)
    counts = {}
    ground[body] = crest_y
    wet[body] = False
    surface[body] = CREST
    edge = body & (d > half - 0.5)
    surface[edge] = CREST_EDGE
    face_up = up_face & ~wet & (up_y >= lake_y) & (ground <= crest_y + 1)
    ground[face_up] = np.maximum(ground[face_up], np.maximum(up_y[face_up], lake_y))
    pick = rng.random(ground.shape)
    riprap = face_up | (up_face & ~wet & (ground <= lake_y + 1) & (d < half + 3 * K * (crest_y - lake_y) + 3))
    surface[riprap] = np.array(RIPRAP, np.uint8)[(pick[riprap] * len(RIPRAP)).astype(int)]
    # Under the water the face continues down to meet the lake bed.
    under = up_face & wet
    ground[under] = np.maximum(ground[under], np.minimum(up_y[under], lake_y - 1))
    face_dn = down_face & ~wet & (down_y > ground)
    ground[face_dn] = down_y[face_dn]
    surface[face_dn] = FACE
    # The whole downstream face is mown grass: no soil patches, no trees.
    dn_zone = down_face & ~wet & (d < half + 2.7 * K * (crest_y - lake_y + 16))
    surface[dn_zone & np.isin(surface, SOIL)] = FACE
    clear = body | face_up | riprap | face_dn | dn_zone
    counts.update(crest_y=crest_y, crest_cells=int(body.sum()), upstream_face=int(riprap.sum()),
                  downstream_face=int(face_dn.sum()))

    # Spillway: approach at the water level, then a chute falling to a stilling basin.
    sp = dam['spillway']
    line = to_blocks(meta, sp['centreUTM'])
    basin = to_blocks(meta, sp['basinUTM'])
    ds, along, _, _, length = polyline_frame(line, ground.shape)
    db, b_along, _, b_t, b_len = polyline_frame(basin, ground.shape)
    s_half, b_half = sp['width'] / 2 / SCALE, sp['basinWidth'] / 2 / SCALE
    in_basin = (db <= b_half) & (b_t >= 0) & (b_t <= 1)
    basin_floor = int(ground[in_basin].min()) - 1
    # Where the centre line crosses the crest: the chute starts falling there.
    lx, lz = line[:, 0], line[:, 1]
    cum = np.concatenate([[0], np.cumsum(np.hypot(np.diff(lx), np.diff(lz)))])
    fine = np.linspace(0, cum[-1], 400)
    fx, fz = np.interp(fine, cum, lx), np.interp(fine, cum, lz)
    s_cross = fine[int(np.argmin([d[int(z), int(x)] for x, z in zip(fx, fz)]))]
    chute_end_y = basin_floor + 2
    floor = np.where(along <= s_cross, lake_y,
                     np.rint(lake_y + (chute_end_y - lake_y) * np.clip((along - s_cross) / (length - s_cross), 0, 1)))
    floor = floor.astype(np.int16)
    in_chute = (ds <= s_half) & (along >= 0) & (along <= length) & ~wet & ~in_basin
    wall = (ds > s_half) & (ds <= s_half + 1) & (along >= 0) & (along <= length + 1) & ~wet & ~in_basin
    wall_basin = (db > b_half) & (db <= b_half + 1) & (b_t >= -0.05) & (b_t <= 1.05) & ~wet
    wall_basin |= in_basin & (b_along > b_len - 1)          # the far end wall
    ground[in_chute] = floor[in_chute]
    surface[in_chute] = SPILL
    for mask, base in ((wall, floor), (wall_basin, np.full(ground.shape, basin_floor, np.int16))):
        for z, x in zip(*np.nonzero(mask & ~in_chute)):
            top = int(base[z, x]) + 2 if mask is wall else basin_floor + 3
            for y in range(min(int(ground[z, x]), top) - 2, top):
                extras[x // 16, z // 16][y, z % 16, x % 16] = SPILL_WALL
            ground[z, x] = max(int(ground[z, x]), top)
            surface[z, x] = SPILL_WALL
    basin_in = in_basin & ~wall_basin
    ground[basin_in] = basin_floor
    surface[basin_in] = SPILL
    # A little water in the basin, one block deep below the chute's last step. Keep only cells
    # whose every neighbour is basin water or solid at that level, so none of it can run out.
    pool = contained_pool(basin_in, ground, wet, basin_floor)
    for z, x in zip(*np.nonzero(pool)):
        extras[x // 16, z // 16][basin_floor + 1, z % 16, x % 16] = WATER
    clear |= ds <= s_half + 3
    clear |= db <= b_half + 3
    counts.update(spillway_cells=int(in_chute.sum()), spillway_walls=int((wall | wall_basin).sum()),
                  basin_cells=int(basin_in.sum()), basin_water=int(pool.sum()), basin_floor_y=basin_floor)
    return clear, extras, counts


def build_causeways(meta, ground, surface, wet):
    """Roads on fill across the water, from the site file: the cells within half the width of
    the traced centre line become dry land at the surveyed top. Returns the cells (no trees)."""
    clear = np.zeros(ground.shape, bool)
    for cw in SITE.get('causeways', []):
        top = WATER_Y + max(1, int(round((cw['topElevation'] - meta['waterLevel']) / VSCALE)))
        d, *_ = polyline_frame(to_blocks(meta, cw['centreUTM']), ground.shape)
        half = cw['width'] / 2 / SCALE
        fill = d <= half + 0.25
        raise_ = fill & (wet | (ground < top))
        ground[raise_] = top
        wet[fill] = False
        surface[raise_] = np.where(d[raise_] <= half - 0.5, ROAD, ROAD_EDGE)
        clear |= d <= half + 1
    return clear


def shifted(a, dz, dx, fill):
    """a moved by (dz, dx) cells without wrapping round the edges (np.roll would)."""
    out = np.full_like(a, fill)
    H, W = a.shape
    out[max(dz, 0):H + min(dz, 0), max(dx, 0):W + min(dx, 0)] = a[max(-dz, 0):H + min(-dz, 0), max(-dx, 0):W + min(-dx, 0)]
    return out


def build_creeks(meta, ground, surface, wet, avoid, extras):
    """Creeks from the site's "creeks" list and its creeks file (fetch_creeks.py: OpenStreetMap
    centre lines). Along each line, downstream, the water stays at the lowest ground met so far
    (a line drawn uphill is turned round first), the channel is cut one block under it, and every
    cell beside the channel is raised to at least a block above the water next to it, so no
    water can spread out of the channel: a source on a higher step pours onto the next step and
    spreads only just above that step's water. Creeks stop two blocks short of a lake and keep
    off dams and landmarks (`avoid`). Returns the cells to keep clear and counts."""
    clear = np.zeros(ground.shape, bool)
    if not SITE.get('creeks'):
        return clear, {}, None
    lines = json.loads(SITE_PATH.with_name(f'{SITE["id"]}.creeks.json').read_text())['lines']
    widths = {c['name']: c['width'] for c in SITE['creeks']}
    H, W = ground.shape
    ground0 = ground.copy()
    keep_off = avoid | ndimage.binary_dilation(wet, iterations=2)
    level = np.full(ground.shape, np.iinfo(np.int16).max, np.int16)
    for line in lines:
        if line['name'] not in widths:
            continue
        pts = to_blocks(meta, line['utm'])
        cum = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(pts, axis=0).T))])
        s = np.arange(0, cum[-1], 0.25)
        px, pz = np.interp(s, cum, pts[:, 0]), np.interp(s, cum, pts[:, 1])
        inside = (px >= 1) & (px < W - 1) & (pz >= 1) & (pz < H - 1)
        if inside.sum() < 2:
            continue
        g = ground0[pz[inside].astype(int), px[inside].astype(int)]
        if g[0] < g[-1]:
            px, pz = px[::-1], pz[::-1]
        radius = max(1, round(widths[line['name']] / SCALE)) / 2 + 0.2
        span = int(math.ceil(radius))
        run = None
        for x, z in zip(px, pz):
            xi, zi = int(x), int(z)
            # A block short of the world's edge: past it is void, which water would pour into.
            if not (span < xi < W - 1 - span and span < zi < H - 1 - span) or keep_off[zi, xi]:
                run = None
                continue
            run = int(ground0[zi, xi]) if run is None else min(run, int(ground0[zi, xi]))
            for oz in range(-span, span + 1):
                for ox in range(-span, span + 1):
                    cx_, cz_ = xi + ox, zi + oz
                    if (cx_ + .5 - x) ** 2 + (cz_ + .5 - z) ** 2 <= radius * radius and not keep_off[cz_, cx_]:
                        level[cz_, cx_] = min(level[cz_, cx_], run)
    channel = level < np.iinfo(np.int16).max
    ground[channel] = level[channel] - 1
    pick = bnoise(np.arange(W)[None, :] * 0.4 + 2.3, np.arange(H)[:, None] * 0.4 - 1.7)
    surface[channel] = np.array(BED, np.uint8)[(pick[channel] * len(BED)).astype(int) % len(BED)]
    for z, x in zip(*np.nonzero(channel)):
        extras[x // 16, z // 16][int(level[z, x]), z % 16, x % 16] = WATER
    # Banks: a block above the highest water beside them (four neighbours: water spreads no other way).
    need = np.where(channel, level + 1, np.iinfo(np.int16).min).astype(np.int16)
    beside = np.full(ground.shape, np.iinfo(np.int16).min, np.int16)
    for dz, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        beside = np.maximum(beside, shifted(need, dz, dx, np.iinfo(np.int16).min))
    bank = ~channel & ~wet & (ground < beside)
    raised = (beside - ground)[bank]
    ground[bank] = beside[bank]
    clear |= ndimage.binary_dilation(channel, iterations=1)
    cut = (ground0 - ground)[channel]
    return clear, dict(channel_cells=int(channel.sum()), deepest_cut_blocks=int(cut.max()) if cut.size else 0,
                       banks_raised=int(bank.sum()), highest_bank_raise=int(raised.max()) if raised.size else 0), (channel, level)


def creek_leaks(ground, wet, channel, level):
    """Creek cells with a dry, non-creek neighbour lower than a block above the water: must be none."""
    need = np.where(channel, level + 1, np.iinfo(np.int16).min).astype(np.int16)
    bad = 0
    for dz, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nb_need = shifted(need, dz, dx, np.iinfo(np.int16).min)
        bad += int((~channel & ~wet & (ground < nb_need)).sum())
    return bad


def build_roads(meta, ground, surface, wet, avoid, extras, creek):
    """Roads and trails from the site's "roads" entry and its roads file (fetch_roads.py:
    OpenStreetMap centre lines). Each line's kind (by its highway class) gives a width (metres, at
    least a block) and a block (paved, unpaved or trail; a paved kind tagged with an unpaved
    surface takes the unpaved block); earlier kinds win where lines overlap. The road block
    replaces the top of the ground, which keeps its height. Roads keep off lakes and `avoid` (dams
    and landmarks) and cross creek channels on a deck a block above the water (the road block if
    paved, else planks: gravel would fall). Returns the cells to keep clear and counts."""
    clear = np.zeros(ground.shape, bool)
    if not SITE.get('roads'):
        return clear, {}
    R = SITE['roads']
    lines = json.loads(SITE_PATH.with_name(f'{SITE["id"]}.roads.json').read_text())['lines']
    kind_of = {h: k for k, kind in R['kinds'].items() for h in kind['highway']}
    rank = {k: i for i, k in enumerate(R['kinds'])}
    unpaved = set(R['unpavedSurfaces'])
    H, W = ground.shape
    best = np.full(ground.shape, len(rank), np.int16)
    block = np.zeros(ground.shape, np.uint8)
    for line in lines:
        k = kind_of.get(line['highway'])
        pts = to_blocks(meta, line['utm'])
        if k is None or len(pts) < 2:
            continue
        kind = R['kinds'][k]
        use = 'unpaved' if kind['block'] == 'paved' and line.get('surface') in unpaved else kind['block']
        cum = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(pts, axis=0).T))])
        s = np.arange(0, cum[-1] + 0.25, 0.25)
        px, pz = np.interp(s, cum, pts[:, 0]), np.interp(s, cum, pts[:, 1])
        radius = max(1, round(kind['width'] / SCALE)) / 2 + 0.2
        span = int(math.ceil(radius))
        x0, z0 = np.floor(px).astype(int), np.floor(pz).astype(int)
        for oz in range(-span, span + 1):
            for ox in range(-span, span + 1):
                cx_, cz_ = x0 + ox, z0 + oz
                ok = ((cx_ + .5 - px) ** 2 + (cz_ + .5 - pz) ** 2 <= radius * radius) & \
                     (cx_ >= 0) & (cx_ < W) & (cz_ >= 0) & (cz_ < H)
                cx_, cz_ = cx_[ok], cz_[ok]
                win = best[cz_, cx_] >= rank[k]
                best[cz_[win], cx_[win]] = rank[k]
                block[cz_[win], cx_[win]] = ROAD_BLOCKS[use]
    road = (best < len(rank)) & ~wet & ~avoid
    channel, level = creek if creek is not None else (np.zeros(ground.shape, bool), None)
    paint = road & ~channel
    surface[paint] = block[paint]
    deck = road & channel
    for z, x in zip(*np.nonzero(deck)):
        b = block[z, x] if block[z, x] == ROAD_BLOCKS['paved'] else ROAD_BLOCKS['bridge']
        extras[x // 16, z // 16][int(level[z, x]) + 1, z % 16, x % 16] = b
    clear |= ndimage.binary_dilation(road, iterations=1)
    counts = {k: int((road & (best == i)).sum()) for k, i in rank.items()}
    return clear, dict(cells=counts, creek_decks=int(deck.sum()),
                       lines_used=sum(1 for l in lines if l['highway'] in kind_of))


def leak_check(ground, wet, water_y):
    """Cells of lake water whose dry neighbour is lower than the water: must be none."""
    bad = 0
    for dz, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nb_dry = ~np.roll(wet, (dz, dx), (0, 1))
        nb_low = np.roll(ground, (dz, dx), (0, 1)) < water_y
        bad += int((wet & nb_dry & nb_low).sum())
    return bad


# --- trees: oakSite from oak-placement.js, exact -------------------------------------------------
OAK_CELL = 9

def oak_density(tr, x, z, cover=0.0, bare=0.0):
    e = 3
    hs = lambda a, b: tr.sample(a, b, 0)
    nx = hs(x - e, z) - hs(x + e, z)
    nz = hs(x, z - e) - hs(x, z + e)
    l = np.hypot(np.hypot(nx, 2 * e), nz)
    ny = 2 * e / l
    shore = tr.sample(x, z, 1)
    spur = 1 - tr.sample(x, z, 2)
    valley = 1 - smooth(.22, .6, spur)
    north = smooth(0, -.4, nz / l)
    steep = smooth(.18, .45, 1 - ny)
    grove = smooth(.46, .64, fbm(x * .0065 + 13, z * .0065 - 4))
    crest = smooth(.62, .88, spur)
    return (np.clip(.05 + .85 * valley + .55 * north + .25 * steep + .75 * grove - .7 * crest + cover * (1 - crest), 0, 1)
            * (1 - bare * smooth(.25, .42, 1 - ny)) * smooth(10, 35, shore))


def oak_sites(tr, look):
    cx0, cx1 = math.floor(WEST / OAK_CELL), math.floor((WEST + WIDTH * SCALE) / OAK_CELL)
    cz0, cz1 = math.floor(NORTH / OAK_CELL), math.floor((NORTH + LENGTH * SCALE) / OAK_CELL)
    cz, cx = np.mgrid[cz0:cz1 + 1, cx0:cx1 + 1]
    cx, cz = cx.ravel().astype(np.float64), cz.ravel().astype(np.float64)
    x = (cx + .15 + .7 * bhash(cx + 71, cz - 19)) * OAK_CELL
    z = (cz + .15 + .7 * bhash(cx - 33, cz + 57)) * OAK_CELL
    v = look.get('vegetation', {})
    keep = bhash(cx, cz) <= oak_density(tr, x, z, v.get('cover', 0), v.get('bare', 0))
    keep &= (x >= WEST) & (x < WEST + WIDTH * SCALE) & (z >= NORTH) & (z < NORTH + LENGTH * SCALE)
    cx, cz, x, z = cx[keep], cz[keep], x[keep], z[keep]
    radius = 3.4 + 3.2 * bhash(cx + 11, cz + 5)
    pick = bhash(cx + 5, cz + 91)
    turn = bhash(cx - 7, cz + 3)
    stands = v.get('stands', 0)
    if stands > 0:  # standPick: the rarer species grows in groups
        pick = np.clip(pick + stands * 2 * (bnoise(x * .012 + 41, z * .012 - 7) - .5), 0, 1)
    species_weights = v.get('species')
    weights = [species_weights.get(s, 0) if species_weights else 1 for s in SPECIES]
    thresholds = np.cumsum(weights) / (sum(weights) or 1)
    thresholds[-1] = 1
    species = np.searchsorted(thresholds, pick, side='right').clip(0, len(SPECIES) - 1)
    return x, z, radius, species, turn


def place_trees(sites, ground, wet, clear, viewpoints):
    x, z, radius, species, turn = sites
    bx = np.floor((x - WEST) / SCALE).astype(int)
    bz = np.floor((z - NORTH) / SCALE).astype(int)
    patches = defaultdict(dict)
    counts = [0] * len(SPECIES)
    views = [(vx, vz) for vx, _, vz, _, _ in viewpoints.values()]
    for xi, zi, r_m, kind, tu in zip(bx, bz, radius, species, turn):
        if not (2 <= xi < WIDTH - 2 and 2 <= zi < LENGTH - 2) or wet[zi, xi] or clear[zi, xi]:
            continue
        if any((xi - vx) ** 2 + (zi - vz) ** 2 < 64 for vx, vz in views):
            continue
        spec = PAL['trees'][SPECIES[kind]]
        lo, hi = spec['height']
        height = max(3, int(round((lo + (hi - lo) * tu) / TREE_VSCALE)))
        r = r_m / CROWN_SCALE
        g = int(ground[zi, xi])
        top = g + height
        leaves, log = LEAVES[kind], LOGS[kind]
        if spec.get('shape') == 'cone':
            # A conifer: trunk to just below the tip, needles from a quarter of the way up, the
            # widest ring at the bottom (the crown radius plus a block) narrowing to the tip.
            base = g + max(2, int(round(height * 0.25)))
            for y in range(base, top + 1):
                rr = (r + 0.9) * (top - y) / max(1, top - base)
                span = int(math.floor(rr))
                for oz in range(-span, span + 1):
                    for ox in range(-span, span + 1):
                        if ox * ox + oz * oz > rr * rr + 0.3:
                            continue
                        zz, xx = zi + oz, xi + ox
                        if y <= ground[zz, xx] or wet[zz, xx]:
                            continue
                        patches[xx // 16, zz // 16].setdefault((y, zz % 16, xx % 16), leaves)
            for y in range(g + 1, top):
                patches[xi // 16, zi // 16][y, zi % 16, xi % 16] = log
            counts[kind] += 1
            continue
        layers = 3 if height >= 4 else 2
        if 'treeMetresPerBlock' in OBJ:   # a taller tree: the crown fills nearly half its height
            layers = max(layers, int(round(height * 0.45)))
        for i, y in enumerate(range(top - layers + 1, top + 1)):
            # Widest layer at the crown's own radius, so a block crown covers about the area of
            # the browser's (3.4 to 6.6 m radius, 1 to 9 blocks at 4 m); the top layer smaller,
            # and the bottom one too in a deep crown (rounder).
            rr = (r - .6) if y == top or (layers > 3 and i == 0) else r
            span = int(math.floor(rr))
            for oz in range(-span, span + 1):
                for ox in range(-span, span + 1):
                    if ox * ox + oz * oz > rr * rr:
                        continue
                    zz, xx = zi + oz, xi + ox
                    if y <= ground[zz, xx] or wet[zz, xx]:
                        continue
                    patches[xx // 16, zz // 16].setdefault((y, zz % 16, xx % 16), leaves)
        for y in range(g + 1, top - layers + 1 + (1 if layers == 3 else 0)):
            patches[xi // 16, zi // 16][y, zi % 16, xi % 16] = log
        counts[kind] += 1
    return patches, counts


def cameras(folder, ground, wet, water_y):
    source = json.loads((folder / 'cameras.json').read_text())['viewpoints']
    views = {}
    for key, source_view in source.items():
        x = math.floor((source_view['x'] - WEST) / SCALE)
        z = math.floor((source_view['z'] - NORTH) / SCALE)
        y = max(int(ground[z, x]), int(water_y[z, x]) if wet[z, x] else -64) + 2
        yaw = (180 + math.degrees(source_view['yaw']) + 180) % 360 - 180
        views[key] = (x, y, z, round(yaw, 1), round(-math.degrees(source_view['pitch']), 1))
    return views


def make_header(template, out, spawn, datapack):
    # Construct a minimal clean save using the game's version and generator schema.
    source = nbtlib.load(template / 'level.dat')['Data']
    if int(source['DataVersion']) != VERSION:
        raise ValueError('Expected a Java 26.3 template')
    level = Compound({key: source[key] for key in ('Version', 'DataVersion', 'version')})
    x, y, z, yaw, pitch = spawn
    enabled = ['vanilla'] + ([f'file/{datapack}'] if datapack else [])
    level.update(LevelName=String(SITE['name']), GameType=Int(1), allowCommands=Byte(1),
                 initialized=Byte(1), WasModded=Byte(0), Time=Long(6000), LastPlayed=Long(time.time_ns() // 1_000_000),
                 DataPacks=Compound({'Enabled': List[String](enabled), 'Disabled': List[String]([])}),
                 difficulty_settings=Compound({'difficulty': String('peaceful'), 'locked': Byte(0)}),
                 spawn=Compound({'pos': IntArray([x, y, z]), 'yaw': Float(yaw), 'pitch': Float(pitch),
                                 'dimension': String('minecraft:overworld')}))
    nbtlib.File({'Data': level}, gzipped=True).save(out / 'level.dat')
    support = out / 'data/minecraft'
    support.mkdir(parents=True)
    settings = nbtlib.load(template / 'data/minecraft/world_gen_settings.dat')
    settings['data']['seed'] = Long(SEED)
    settings['data']['generate_structures'] = Byte(0)
    settings['data']['bonus_chest'] = Byte(0)
    # Outside the built area, nothing: the game would otherwise grow its own terrain (mountains,
    # snow) against the edge of the map. A flat generator with no layers makes empty chunks.
    settings['data']['dimensions']['minecraft:overworld']['generator'] = Compound({
        'type': String('minecraft:flat'),
        'settings': Compound({'biome': String(PAL['biome']), 'layers': List[Compound]([]),
                              'features': Byte(0), 'lakes': Byte(0), 'structure_overrides': List[String]([])})})
    settings.save(support / 'world_gen_settings.dat')
    clocks = Compound({'minecraft:overworld': Compound({'total_ticks': Long(6000)})})
    nbtlib.File({'DataVersion': Int(VERSION), 'data': clocks}, gzipped=True).save(support / 'world_clocks.dat')


def heightmap(block, flags):
    """Per column, one above the highest block whose flag is set (0 if none), as y + 64 + 1."""
    hit = flags[block]
    top = 384 - np.argmax(hit[::-1], axis=0)
    return np.where(hit.any(axis=0), top, 0)


def new_chunk(cx, cz, ground, wet, surface, plants, extra, water_y):
    y = np.arange(-64, 320)[:, None, None]
    block = np.where(y == ground, surface, np.where(y >= ground - 3, np.where(surface == STONE, STONE, UNDER), STONE))
    rocky = np.isin(surface, ROCK)
    block = np.where((y < ground) & rocky, STONE, block)
    if MASONRY:
        block = np.where((y < ground) & np.isin(surface, MASONRY), surface, block)
    block = np.where(y <= ground, block, np.where(wet & (y <= water_y), WATER, AIR)).astype(np.uint8)
    block = np.where((y == ground + 1) & (plants > 0), plants, block).astype(np.uint8)
    block[0] = BEDROCK
    for (yy, oz, ox), kind in extra.items():
        block[yy + 64, oz, ox] = kind
    blocking = ~(IS_AIR | IS_PLANT)
    heights = {'WORLD_SURFACE': heightmap(block, ~IS_AIR),
               'MOTION_BLOCKING': heightmap(block, blocking),
               'MOTION_BLOCKING_NO_LEAVES': heightmap(block, blocking & ~IS_LEAVES),
               'OCEAN_FLOOR': heightmap(block, blocking & ~IS_FLUID)}
    biome = Compound({'palette': List[String]([PAL['biome']])})
    sections = []
    for sy in range(-4, 20):
        part = block[(sy + 4) * 16:(sy + 5) * 16]
        ids, indices = np.unique(part, return_inverse=True)
        states = Compound({'palette': World.palette([BLOCKS[i] for i in ids], True)})
        if len(ids) > 1:
            states['data'] = longpack(indices.ravel(), max(4, (len(ids) - 1).bit_length()))
        sections.append(Compound({'Y': Byte(sy), 'biomes': biome, 'block_states': states}))
    return nbtlib.File(dict(DataVersion=Int(VERSION), xPos=Int(cx), zPos=Int(cz), yPos=Int(-4),
                            Status=String('minecraft:full'), sections=List[Compound](sections),
                            Heightmaps=Compound({key: longpack(val, 9) for key, val in heights.items()}),
                            isLightOn=Byte(0), LastUpdate=Long(0), InhabitedTime=Long(0),
                            structures=Compound({'starts': Compound(), 'References': Compound()}),
                            block_entities=List[Compound]([]), block_ticks=List[Compound]([]),
                            fluid_ticks=List[Compound]([]), PostProcessing=List[List]([List([]) for _ in sections]))), block


def audit(path, chunks, blocks_by_key):
    """Decode a sample of the written chunks and compare them with the arrays they came from."""
    saved, _ = region.read_region(path)
    if saved.keys() != chunks.keys():
        raise ValueError(f'Chunk index mismatch in {path}')
    selected = list(saved)[::97]
    def key(c):
        props = c.get('Properties', {})
        return str(c['Name']), tuple(sorted((str(a), str(b)) for a, b in props.items()))
    names = [key(b) for b in BLOCKS]
    for key_ in selected:
        chunk = region.decode_chunk(saved[key_])
        assert int(chunk['DataVersion']) == VERSION and str(chunk['Status']) == 'minecraft:full'
        assert len(chunk['sections']) == 24 and all(len(h) == 37 for h in chunk['Heightmaps'].values())
        full = np.empty((384, 16, 16), dtype=np.uint8)
        for section in chunk['sections']:
            palette = [key(World.normalise(entry)) for entry in section['block_states']['palette']]
            ids = [names.index(name) for name in palette]
            sy = int(section['Y']) + 4
            full[sy * 16:(sy + 1) * 16] = np.array(ids)[region.unpack(section).reshape(16, 16, 16)]
        assert np.array_equal(full, blocks_by_key[key_])
        ws = [int(v) & ((1 << 64) - 1) for v in chunk['Heightmaps']['WORLD_SURFACE']]
        recorded = [(ws[i // 7] >> ((i % 7) * 9)) & 511 for i in range(256)]
        assert np.array_equal(recorded, heightmap(full, ~IS_AIR).ravel())
    return len(selected)


def preview(path, ground, surface, wet, trees, extras):
    colours = {AIR: (0, 0, 0), WATER: (45, 90, 120)}
    grass = tuple(int(int(PAL['biomeColours']['effects']['grass_color'][i:i + 2], 16) * .85) for i in (1, 3, 5))
    tint = {'grass_block': grass, 'rooted_dirt': (144, 104, 76), 'stone_bricks': (122, 121, 122),
            'spruce_leaves': (46, 66, 44), 'coarse_dirt': (119, 85, 59), 'packed_mud': (142, 107, 80),
            'gravel': (131, 127, 126), 'mud': (60, 57, 60), 'stone': (125, 125, 125), 'andesite': (136, 136, 136),
            'tuff': (108, 109, 102), 'cobblestone': (120, 120, 120), 'smooth_stone': (180, 180, 180),
            'light_gray_concrete': (150, 150, 145), 'dark_oak_leaves': (60, 72, 34), 'oak_leaves': (78, 92, 44),
            'pale_oak_leaves': (110, 116, 98), 'smooth_quartz': (236, 230, 223), 'quartz_block': (236, 230, 223),
            'quartz_pillar': (235, 229, 222), 'chiseled_quartz_block': (231, 226, 218), 'quartz_bricks': (234, 229, 221),
            'light_blue_terracotta': (113, 108, 137), 'azalea_leaves': (90, 117, 44), 'pale_oak_log': (88, 77, 71),
            'polished_andesite': (132, 134, 133), 'terracotta': (152, 94, 67), 'allium': (165, 110, 200),
            'stone_brick_slab[type=bottom]': (122, 121, 122), 'polished_andesite_slab[type=bottom]': (132, 134, 133),
            'smooth_quartz_slab[type=bottom]': (236, 230, 223), 'quartz_stairs': (236, 230, 223), 'iron_trapdoor': (200, 200, 200),
            'gray_concrete': (55, 58, 62), 'dirt_path': (148, 122, 65), 'spruce_planks': (115, 85, 49),
            'light_blue_concrete': (36, 137, 199), 'white_concrete': (207, 213, 214), 'smooth_sandstone': (223, 214, 170),
            'daylight_detector': (70, 78, 96), 'cherry_leaves': (228, 170, 200), 'birch_leaves': (128, 167, 85),
            'red_terracotta': (143, 61, 46), 'polished_diorite': (192, 193, 194), 'oxidized_cut_copper': (79, 153, 126),
            'oxidized_copper': (82, 162, 132), 'gray_stained_glass': (76, 76, 76), 'deepslate_tiles': (54, 54, 55),
            'lightning_rod': (200, 120, 90), 'birch_log': (216, 215, 210), 'cherry_log': (54, 33, 44)}
    lut = np.array([tint.get(n, tint.get(n.split('[')[0], colours.get(i, (200, 0, 200)))) for i, n in enumerate(NAMES)], np.float32)
    rgb = lut[surface].copy()
    top = ground.astype(np.float32).copy()
    for layer in (extras, trees):
        for (cx, cz), blocks in layer.items():
            for (y, z, x), kind in blocks.items():
                if y >= top[cz * 16 + z, cx * 16 + x]:
                    top[cz * 16 + z, cx * 16 + x] = y
                    rgb[cz * 16 + z, cx * 16 + x] = lut[kind]
    dy, dx = np.gradient(ndimage.gaussian_filter(top, 1.0))
    rgb *= np.clip(1 + .3 * (dx + dy), .55, 1.35)[..., None]
    rgb[wet] = lut[WATER]
    Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).save(path)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--site', type=Path, default=SITE_PATH, help='sites/<id>.json (default: Calaveras)')
    p.add_argument('--template', required=True, type=Path, help='Existing Java 26.3 save used only for header schema')
    p.add_argument('--out', required=True, type=Path, help='A new folder for the generated world')
    p.add_argument('--server-jar', type=Path, help='Minecraft 26.3 server jar: adds the biome-colour datapack')
    args = p.parse_args()
    if args.out.exists():
        p.error('--out must be a new folder')
    folder = REPO / SITE['bundle']
    meta, data = load_grid(folder)
    tr = Terrain(meta, data)
    look = json.loads((folder / 'land.json').read_text())
    rng = np.random.default_rng(SEED)
    X, Z, h, shore, valley, wet, ground, macro, lk = terrain(tr, look, rng, meta)
    if len(lk.lakes) > 1:
        print('lakes:', {l.name: dict(level=l.level, y=l.y, cells=int((lk.number == i + 1).sum()))
                         for i, l in enumerate(lk.lakes)}, '| water joined to the nearest lake:', lk.joined, flush=True)
    surface, rock = ground_cover(X, Z, h, shore, valley, wet, macro, None if len(lk.lakes) == 1 else lk.bank_h)
    clear, extras, dam_counts = build_dam(meta, ground, surface, wet, rng, lk.lakes)
    road_avoid = clear.copy()
    clear |= build_causeways(meta, ground, surface, wet)
    ctx = SimpleNamespace(ground=ground, surface=surface, wet=wet, extras=extras, block=NAMES.index,
                          grass=GRASS[0], water=WATER, water_y=WATER_Y, water_level=meta['waterLevel'],
                          scale=SCALE, vscale=VSCALE, building_vscale=BUILDING_VSCALE, tree_vscale=TREE_VSCALE,
                          crown_scale=CROWN_SCALE, to_blocks=lambda utm: to_blocks(meta, utm), polyline=polyline_frame)
    landmark_clear, landmark_info = landmarks.build(SITE, ctx)
    clear |= landmark_clear
    road_avoid |= landmark_clear
    if landmark_info:
        print('landmarks:', landmark_info, flush=True)
    creek_clear, creek_info, creek_cells = build_creeks(meta, ground, surface, wet, clear, extras)
    clear |= creek_clear
    road_clear, road_info = build_roads(meta, ground, surface, wet, road_avoid, extras, creek_cells)
    clear |= road_clear
    if road_info:
        print('roads:', road_info, flush=True)
    leaks = leak_check(ground, wet, lk.water_y)
    print('dam:', dam_counts, '| lake leaks (must be 0):', leaks, flush=True)
    if leaks:
        raise SystemExit('The lake would leak; nothing written.')
    if creek_cells is not None:
        spills = creek_leaks(ground, wet, *creek_cells)
        print('creeks:', creek_info, '| creek spills (must be 0):', spills, flush=True)
        if spills:
            raise SystemExit('A creek would spill; nothing written.')
    views = cameras(folder, ground, wet, lk.water_y)
    sites = oak_sites(tr, look)
    tree, counts = place_trees(sites, ground, wet, clear, views)
    print(f'tree sites {len(sites[0])}, placed {sum(counts)} ({dict(zip(SPECIES, counts))})', flush=True)
    grassy = np.isin(surface, GRASS) & ~wet & ~clear
    share = PAL['plants']['share']
    roll = rng.random(surface.shape)
    plants = np.where(grassy & (roll < share), np.array(PLANTS, np.uint8)[(roll / share * len(PLANTS)).astype(int).clip(0, len(PLANTS) - 1)], 0).astype(np.uint8)
    for (cx, cz), blocks in list(tree.items()) + list(extras.items()):
        for y, z, x in blocks:
            ix, iz = cx * 16 + x, cz * 16 + z
            if y == ground[iz, ix] + 1:
                plants[iz, ix] = 0
    args.out.mkdir(parents=True)
    datapack = None
    if args.server_jar:
        datapack = DATAPACK
        make_datapack(args.server_jar, PAL['biome'].split(':')[-1], PAL['biomeColours'],
                      args.out / 'datapacks' / datapack, SITE['palette'].replace('-', ' ').title())
    make_header(args.template, args.out, views['overlook'], datapack)
    region_dir = args.out / 'dimensions/minecraft/overworld/region'
    region_dir.mkdir(parents=True)
    written = checked = 0
    for rz in range(math.ceil(LENGTH / 512)):
        for rx in range(math.ceil(WIDTH / 512)):
            chunks, blocks = {}, {}
            for cz in range(rz * 32, min((rz + 1) * 32, LENGTH // 16)):
                for cx in range(rx * 32, min((rx + 1) * 32, WIDTH // 16)):
                    sl = np.s_[cz * 16:(cz + 1) * 16, cx * 16:(cx + 1) * 16]
                    extra = dict(tree.get((cx, cz), {}))
                    extra.update(extras.get((cx, cz), {}))
                    chunk, block = new_chunk(cx, cz, ground[sl], wet[sl], surface[sl], plants[sl], extra, lk.water_y[sl])
                    key = (cx & 31) + (cz & 31) * 32
                    chunks[key] = region.encode_chunk(chunk)
                    blocks[key] = block
            path = region_dir / f'r.{rx}.{rz}.mca'
            region.write_region(path, chunks, bytes(4096))
            checked += audit(path, chunks, blocks)
            written += len(chunks)
            print(f'{path.name}: {written} chunks written', flush=True)
    overview = args.out.parent / f'{SITE["id"]}-overview.png'
    preview(overview, ground, surface, wet, tree, extras)
    Image.open(overview).resize((64, 64), Image.Resampling.LANCZOS).save(args.out / 'icon.png')
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=REPO, text=True).strip()
    info = {'bundle': SITE['id'], 'bundle_commit': commit, 'minecraft': 'Java 26.3', 'data_version': VERSION,
            'site': SITE, 'palette': SITE['palette'], 'datapack': datapack,
            'source': meta['service'], 'crs': meta['crs'], 'vertical_datum': meta['verticalDatum'],
            'origin_utm': meta['originUTM'], 'source_grid_spacing_m': meta['cell'],
            'survey_water_level_m': meta['waterLevel'],
            'interpretation': ['Ground from renderer/land/ground.js: grass (coloured by the datapack), soil on the bank and in patches, rock on steep ground.',
                               'Trees at the browser\'s own sites and species (oak-placement.js oakSite, standPick); block crowns are approximate.',
                               'Synthetic reservoir bottom using Waterscape bank slope and depth cap.',
                               ] + [(f'{d["type"]} dam' if len(DAMS) == 1 else f'{d["name"]} ({d["type"]} dam)') + ': crest, faces and spillway dressed onto the surveyed dam from the traced site file; illustrative.' for d in DAMS]
                              + [f'{lm["name"]}: built at {lm["metresPerBlock"]} m per block (the land is {SCALE} m), centred on its real middle; illustrative.'
                                 for lm in LANDMARKS if lm['type'] != 'footprint']
                              + [f'{lm["name"]}: a placeholder on its footprint; heights illustrative.' for lm in LANDMARKS if lm['type'] == 'footprint']
                              + (['Creeks from OpenStreetMap centre lines: water at the lowest ground met downstream, the channel cut a block under it, banks raised to hold it.']
                                 if SITE.get('creeks') else [])
                              + (['Roads and trails from OpenStreetMap centre lines, laid on the ground at estimated widths; creek crossings on a deck.']
                                 if SITE.get('roads') else [])
                              + ['Outside the built area the world is empty (a flat generator with no layers).']
                              + ([f'Exaggerated for play: trees {TREE_VSCALE} m per block in height and {CROWN_SCALE} m across, buildings {BUILDING_VSCALE} m per block in height (the land is {SCALE} m across, {VSCALE} m up).']
                                 if OBJ else []),
            'dam': dam_counts, 'landmarks': landmark_info, **({'creeks': creek_info} if creek_info else {}),
            **({'roads': road_info} if road_info else {}),
            **({'vertical_metres_per_block': VSCALE, 'lakes': {l.name: dict(level_m=l.level, water_y=l.y) for l in lk.lakes}} if SITE.get('lakes') else {}), 'tree_counts': dict(zip(SPECIES, counts)),
            'viewpoints_xyz_yaw_pitch': views, 'verified_chunks': checked, 'written_chunks': written}
    (args.out / 'waterscape-build.json').write_text(json.dumps(info, indent=2) + '\n', encoding='utf-8')
    print(f'{written} chunks, {checked} decoded and compared, {sum(counts)} trees; spawn {views["overlook"]}', flush=True)


if __name__ == '__main__':
    main()
