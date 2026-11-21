"""Build the Calaveras Reservoir world from its Waterscape bundle, site file and palette.

  python experimental/minecraft/build_calaveras.py --template "<Java 26.3 save>" --out "<new folder>"
      [--server-jar ~/mc-server/versions/26.3/server-26.3.jar]

Inputs: data/calaveras/ (terrain, land.json, cameras.json), sites/calaveras.json (crop, scale,
water level, the dam traced from NAIP with its sources) and palettes/diablo-oak.json (blocks and
biome colours). The template save only supplies level.dat's version keys and generator settings.
With --server-jar the world gets a datapack (built from that jar's own biome) that colours the
grass summer gold; without it the grass keeps vanilla savanna colours.

The ground and trees translate the browser's rules: renderer/land/ground.js (grass is the
ground; soil on the bank and in patches; rock on steep ground) and renderer/land/oak-placement.js
(oakSite, ported exactly, so each oak stands where the browser draws one). Task:
docs/roadmap/tasks/MC2-calaveras.md.
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

VERSION = 5023
SITE = json.loads((HERE / 'sites/calaveras.json').read_text())
PAL = json.loads((HERE / f'palettes/{SITE["palette"]}.json').read_text())
SCALE = SITE['metresPerBlock']
WATER_Y = SITE['waterY']
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
SPECIES = ['coast-live', 'blue', 'valley']  # biome.json variant order, as the browser uses it
LOGS = [_add(PAL['trees'][s]['log']) for s in SPECIES]
LEAVES = [_add(PAL['trees'][s]['leaves']) for s in SPECIES]
D = PAL['dam']
CREST, CREST_EDGE, FACE = _add(D['crest']), _add(D['crestEdge']), _add(D['face'])
RIPRAP = [_add(n) for n in D['riprap']]
SPILL, SPILL_WALL = _add(D['spillway']), _add(D['spillwayWall'])
AIR, BEDROCK, STONE, WATER = 0, 1, 2, 3
BLOCKS = [state(n, persistent=True, distance=7, waterlogged=False) if n.endswith('_leaves') else state(n)
          for n in NAMES]
IS_LEAVES = np.array([n.endswith('_leaves') for n in NAMES])
IS_PLANT = np.isin(np.arange(len(NAMES)), PLANTS)
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


def terrain(tr, look, rng):
    X, Z = block_centres()
    if X.min() < tr.x0 or Z.min() < tr.z0:
        raise ValueError('Crop extends outside the Waterscape bundle')
    h, shore, valley = (tr.sample(X, Z, c).astype(np.float32) for c in range(3))
    wet = shore < 0
    if any(edge.any() for edge in (wet[0], wet[-1], wet[:, 0], wet[:, -1])):
        raise ValueError('Crop cuts through the reservoir')
    shore_ring = ndimage.binary_dilation(wet) & ~wet
    ground = np.rint(WATER_Y + h / SCALE).astype(np.int16)
    # A lower dry neighbour would let source blocks flow outside the source shoreline.
    ground[shore_ring] = np.maximum(ground[shore_ring], WATER_Y)
    # Synthetic lake bed (the lidar cannot see under water): bank slope and depth cap from land.json.
    macro = bnoise(X * 0.012 + 3.1, Z * 0.012 - 7.3)
    depth_m = np.clip(-shore * look['water']['bankSlope'] + (macro - .5) * 8, SCALE, look['water']['maxDepth'])
    ground[wet] = WATER_Y - np.maximum(1, np.rint(depth_m[wet] / SCALE)).astype(np.int16)
    if ground.min() < -60 or ground.max() > 305:
        raise ValueError('Terrain does not fit the Java build height')
    return X, Z, h, shore, valley, wet, ground, macro


def ground_cover(X, Z, h, shore, valley, wet, macro):
    """renderer/land/ground.js, non-granite branch: grass, then soil (bank and patches), then rock.
    One departure: the bank (soil up to 3 to 6 m above the water) is kept to land within 80 m of
    the shore. The browser applies it to all land below that height, which would make the creek
    canyon below the dam bare soil; the aerial shows it grassed and wooded."""
    dz, dx = np.gradient(h, float(SCALE))
    slope = 1 - 1 / np.sqrt(1 + dx * dx + dz * dz)
    rock_w = smooth(.34, .55, slope + (macro - .5) * .25) * (1 - valley * .6)
    bank = (1 - smooth(3, 6, h)) * (1 - smooth(60, 80, shore))
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


def build_dam(meta, ground, surface, wet, rng):
    """Level the crest, armour the upstream face, grass the downstream face, cut the spillway.
    Returns a mask of cells to keep free of trees and plants, and extra blocks by chunk."""
    dam = SITE['dam']
    extras = defaultdict(dict)
    crest_y = WATER_Y + int(round((dam['crestElevation'] - meta['waterLevel']) / SCALE))
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
    up_y = np.floor(crest_y - (d - half) / 3 + .5).astype(np.int16)
    down_y = np.floor(crest_y - (d - half) / 2.7 + .5).astype(np.int16)
    counts = {}
    ground[body] = crest_y
    wet[body] = False
    surface[body] = CREST
    edge = body & (d > half - 0.5)
    surface[edge] = CREST_EDGE
    face_up = up_face & ~wet & (up_y >= WATER_Y) & (ground <= crest_y + 1)
    ground[face_up] = np.maximum(ground[face_up], np.maximum(up_y[face_up], WATER_Y))
    pick = rng.random(ground.shape)
    riprap = face_up | (up_face & ~wet & (ground <= WATER_Y + 1) & (d < half + 3 * (crest_y - WATER_Y) + 3))
    surface[riprap] = np.array(RIPRAP, np.uint8)[(pick[riprap] * len(RIPRAP)).astype(int)]
    # Under the water the face continues down to meet the lake bed.
    under = up_face & wet
    ground[under] = np.maximum(ground[under], np.minimum(up_y[under], WATER_Y - 1))
    face_dn = down_face & ~wet & (down_y > ground)
    ground[face_dn] = down_y[face_dn]
    surface[face_dn] = FACE
    # The whole downstream face is mown grass: no soil patches, no trees.
    dn_zone = down_face & ~wet & (d < half + 2.7 * (crest_y - WATER_Y + 16))
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
    floor = np.where(along <= s_cross, WATER_Y,
                     np.rint(WATER_Y + (chute_end_y - WATER_Y) * np.clip((along - s_cross) / (length - s_cross), 0, 1)))
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
    pool = basin_in.copy()
    while True:
        ok = np.ones_like(pool)
        for dz, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ok &= np.roll(pool, (dz, dx), (0, 1)) | (np.roll(ground, (dz, dx), (0, 1)) >= basin_floor + 1) \
                & ~np.roll(wet, (dz, dx), (0, 1))
        keep = pool & ok
        if keep.sum() == pool.sum():
            break
        pool = keep
    for z, x in zip(*np.nonzero(pool)):
        extras[x // 16, z // 16][basin_floor + 1, z % 16, x % 16] = WATER
    clear |= ds <= s_half + 3
    clear |= db <= b_half + 3
    counts.update(spillway_cells=int(in_chute.sum()), spillway_walls=int((wall | wall_basin).sum()),
                  basin_cells=int(basin_in.sum()), basin_water=int(pool.sum()), basin_floor_y=basin_floor)
    return clear, extras, counts


def leak_check(ground, wet):
    """Cells of lake water whose dry neighbour is lower than the water: must be none."""
    bad = 0
    for dz, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nb_dry = ~np.roll(wet, (dz, dx), (0, 1))
        nb_low = np.roll(ground, (dz, dx), (0, 1)) < WATER_Y
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
    weights = [v.get('species', {}).get(s, 0) for s in SPECIES]
    thresholds = np.cumsum(weights) / (sum(weights) or 1)
    thresholds[-1] = 1
    species = np.searchsorted(thresholds, pick, side='right').clip(0, len(SPECIES) - 1)
    return x, z, radius, species, turn


def place_trees(sites, ground, wet, clear, viewpoints):
    x, z, radius, species, turn = sites
    bx = np.floor((x - WEST) / SCALE).astype(int)
    bz = np.floor((z - NORTH) / SCALE).astype(int)
    patches = defaultdict(dict)
    counts = [0, 0, 0]
    views = [(vx, vz) for vx, _, vz, _, _ in viewpoints.values()]
    for xi, zi, r_m, kind, tu in zip(bx, bz, radius, species, turn):
        if not (2 <= xi < WIDTH - 2 and 2 <= zi < LENGTH - 2) or wet[zi, xi] or clear[zi, xi]:
            continue
        if any((xi - vx) ** 2 + (zi - vz) ** 2 < 64 for vx, vz in views):
            continue
        lo, hi = PAL['trees'][SPECIES[kind]]['height']
        height = max(3, int(round((lo + (hi - lo) * tu) / SCALE)))
        r = r_m / SCALE
        layers = 3 if height >= 4 else 2
        g = int(ground[zi, xi])
        top = g + height
        leaves, log = LEAVES[kind], LOGS[kind]
        for i, y in enumerate(range(top - layers + 1, top + 1)):
            # Widest layer at the crown's own radius, so a block crown covers about the area of
            # the browser's (3.4 to 6.6 m radius, 1 to 9 blocks at 4 m); the top layer smaller.
            rr = (r - .6) if y == top else r
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


def cameras(folder, ground, wet):
    source = json.loads((folder / 'cameras.json').read_text())['viewpoints']
    views = {}
    for key, source_view in source.items():
        x = math.floor((source_view['x'] - WEST) / SCALE)
        z = math.floor((source_view['z'] - NORTH) / SCALE)
        y = max(int(ground[z, x]), WATER_Y if wet[z, x] else -64) + 2
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
    settings.save(support / 'world_gen_settings.dat')
    clocks = Compound({'minecraft:overworld': Compound({'total_ticks': Long(6000)})})
    nbtlib.File({'DataVersion': Int(VERSION), 'data': clocks}, gzipped=True).save(support / 'world_clocks.dat')


def heightmap(block, flags):
    """Per column, one above the highest block whose flag is set (0 if none), as y + 64 + 1."""
    hit = flags[block]
    top = 384 - np.argmax(hit[::-1], axis=0)
    return np.where(hit.any(axis=0), top, 0)


def new_chunk(cx, cz, ground, wet, surface, plants, extra):
    y = np.arange(-64, 320)[:, None, None]
    block = np.where(y == ground, surface, np.where(y >= ground - 3, np.where(surface == STONE, STONE, UNDER), STONE))
    rocky = np.isin(surface, ROCK)
    block = np.where((y < ground) & rocky, STONE, block)
    block = np.where(y <= ground, block, np.where(wet & (y <= WATER_Y), WATER, AIR)).astype(np.uint8)
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
    names = [str(b['Name']) for b in BLOCKS]
    for key in selected:
        chunk = region.decode_chunk(saved[key])
        assert int(chunk['DataVersion']) == VERSION and str(chunk['Status']) == 'minecraft:full'
        assert len(chunk['sections']) == 24 and all(len(h) == 37 for h in chunk['Heightmaps'].values())
        full = np.empty((384, 16, 16), dtype=np.uint8)
        for section in chunk['sections']:
            palette = [str(World.normalise(entry)['Name']) for entry in section['block_states']['palette']]
            ids = [names.index(name) for name in palette]
            sy = int(section['Y']) + 4
            full[sy * 16:(sy + 1) * 16] = np.array(ids)[region.unpack(section).reshape(16, 16, 16)]
        assert np.array_equal(full, blocks_by_key[key])
        ws = [int(v) & ((1 << 64) - 1) for v in chunk['Heightmaps']['WORLD_SURFACE']]
        recorded = [(ws[i // 7] >> ((i % 7) * 9)) & 511 for i in range(256)]
        assert np.array_equal(recorded, heightmap(full, ~IS_AIR).ravel())
    return len(selected)


def preview(path, ground, surface, wet, trees, extras):
    colours = {AIR: (0, 0, 0), WATER: (45, 90, 120)}
    tint = {'grass_block': (196, 168, 98), 'coarse_dirt': (119, 85, 59), 'packed_mud': (142, 107, 80),
            'gravel': (131, 127, 126), 'mud': (60, 57, 60), 'stone': (125, 125, 125), 'andesite': (136, 136, 136),
            'tuff': (108, 109, 102), 'cobblestone': (120, 120, 120), 'smooth_stone': (180, 180, 180),
            'light_gray_concrete': (150, 150, 145), 'dark_oak_leaves': (60, 72, 34), 'oak_leaves': (78, 92, 44),
            'pale_oak_leaves': (110, 116, 98)}
    lut = np.array([tint.get(n, colours.get(i, (200, 0, 200))) for i, n in enumerate(NAMES)], np.float32)
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
    X, Z, h, shore, valley, wet, ground, macro = terrain(tr, look, rng)
    surface, rock = ground_cover(X, Z, h, shore, valley, wet, macro)
    clear, extras, dam_counts = build_dam(meta, ground, surface, wet, rng)
    leaks = leak_check(ground, wet)
    print('dam:', dam_counts, '| lake leaks (must be 0):', leaks, flush=True)
    if leaks:
        raise SystemExit('The lake would leak; nothing written.')
    views = cameras(folder, ground, wet)
    sites = oak_sites(tr, look)
    tree, counts = place_trees(sites, ground, wet, clear, views)
    print(f'oak sites {len(sites[0])}, placed {sum(counts)} ({dict(zip(SPECIES, counts))})', flush=True)
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
                    chunk, block = new_chunk(cx, cz, ground[sl], wet[sl], surface[sl], plants[sl], extra)
                    key = (cx & 31) + (cz & 31) * 32
                    chunks[key] = region.encode_chunk(chunk)
                    blocks[key] = block
            path = region_dir / f'r.{rx}.{rz}.mca'
            region.write_region(path, chunks, bytes(4096))
            checked += audit(path, chunks, blocks)
            written += len(chunks)
            print(f'{path.name}: {written} chunks written', flush=True)
    preview(args.out.parent / 'calaveras-overview.png', ground, surface, wet, tree, extras)
    Image.open(args.out.parent / 'calaveras-overview.png').resize((64, 64), Image.Resampling.LANCZOS).save(args.out / 'icon.png')
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=REPO, text=True).strip()
    info = {'bundle': SITE['id'], 'bundle_commit': commit, 'minecraft': 'Java 26.3', 'data_version': VERSION,
            'site': SITE, 'palette': SITE['palette'], 'datapack': datapack,
            'source': meta['service'], 'crs': meta['crs'], 'vertical_datum': meta['verticalDatum'],
            'origin_utm': meta['originUTM'], 'source_grid_spacing_m': meta['cell'],
            'survey_water_level_m': meta['waterLevel'],
            'interpretation': ['Ground from renderer/land/ground.js: grass (summer gold via the datapack), soil on the bank and in patches, rock on steep ground.',
                               'Oaks at the browser\'s own sites (oak-placement.js oakSite); block crowns are approximate.',
                               'Synthetic reservoir bottom using Waterscape bank slope and depth cap.',
                               'Dam crest, faces and spillway dressed onto the surveyed embankment from the traced site file; illustrative.'],
            'dam': dam_counts, 'tree_counts': dict(zip(SPECIES, counts)),
            'viewpoints_xyz_yaw_pitch': views, 'verified_chunks': checked, 'written_chunks': written}
    (args.out / 'waterscape-build.json').write_text(json.dumps(info, indent=2) + '\n', encoding='utf-8')
    print(f'{written} chunks, {checked} decoded and compared, {sum(counts)} oaks; spawn {views["overlook"]}', flush=True)


if __name__ == '__main__':
    main()
