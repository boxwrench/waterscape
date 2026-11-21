"""Build a Calaveras creative world from Waterscape data and a Java 26.3 save header."""

import argparse
import gzip
import json
import math
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
import region_edit as region
from world_columns import World, longpack, state

VERSION = 5023
SCALE = 4
WATER_Y = 65
# Projected metres relative to terrain.json's UTM origin. Array rows run south.
WEST, NORTH, WIDTH, LENGTH = -2368, -3776, 1504, 1664
SEED = 26463

BLOCKS = [state(name) for name in (
    'air', 'bedrock', 'stone', 'dirt', 'coarse_dirt', 'packed_mud', 'yellow_terracotta',
    'grass_block', 'gravel', 'andesite', 'water', 'short_dry_grass', 'tall_dry_grass',
    'dark_oak_log', 'oak_log',
)] + [state(name, persistent=True, distance=7, waterlogged=False) for name in (
    'dark_oak_leaves', 'oak_leaves', 'birch_leaves',
)]
AIR, BEDROCK, STONE, DIRT, SOIL, MUD, GOLD, GRASS, GRAVEL, ROCK, WATER, SHORT, TALL, DARK_LOG, OAK_LOG, DARK_LEAVES, OAK_LEAVES, PALE_LEAVES = range(len(BLOCKS))


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


def smooth(lo, hi, value):
    t = np.clip((value - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


def patch_noise(rng, spacing):
    coarse = rng.random((math.ceil(LENGTH / spacing) + 1, math.ceil(WIDTH / spacing) + 1), dtype=np.float32)
    return ndimage.zoom(coarse, (LENGTH / coarse.shape[0], WIDTH / coarse.shape[1]), order=3)


def terrain(meta, data, look, rng):
    gx, gz = meta['gridOrigin']
    sx, sz = meta['cell']
    x = WEST + (np.arange(WIDTH, dtype=np.float32) + .5) * SCALE
    z = NORTH + (np.arange(LENGTH, dtype=np.float32) + .5) * SCALE
    coords = np.meshgrid((z - gz) / sz, (x - gx) / sx, indexing='ij')
    if any(grid.min() < 0 or grid.max() > size - 1 for grid, size in zip(coords, data.shape[1:])):
        raise ValueError('Crop extends outside the Waterscape bundle')
    h, shore, valley = [ndimage.map_coordinates(plane, coords, order=1) for plane in data]
    wet = shore < 0
    if any(edge.any() for edge in (wet[0], wet[-1], wet[:, 0], wet[:, -1])):
        raise ValueError('Crop cuts through the reservoir')
    # A lower dry neighbour would let source blocks flow outside the source shoreline.
    shore_ring = ndimage.binary_dilation(wet) & ~wet
    ground = np.rint(WATER_Y + h / SCALE).astype(np.int16)
    ground[shore_ring] = np.maximum(ground[shore_ring], WATER_Y)
    macro = patch_noise(rng, 42)
    depth_m = np.clip(-shore * look['water']['bankSlope'] + (macro - .5) * 8, SCALE, look['water']['maxDepth'])
    ground[wet] = WATER_Y - np.maximum(1, np.rint(depth_m[wet] / SCALE)).astype(np.int16)
    if ground.min() < -60 or ground.max() > 305:
        raise ValueError('Terrain does not fit the Java build height')
    dz, dx = np.gradient(h, float(SCALE))
    normal_y = 1 / np.sqrt(1 + dx * dx + dz * dz)
    slope = 1 - normal_y
    rock = smooth(.34, .55, slope + (macro - .5) * .25) * (1 - valley * .6)
    gravel = ((h < 6) & (shore < 32)) | wet
    surface = np.where(macro > .58, GOLD, SOIL)
    surface = np.where(macro < .32, MUD, surface)
    surface = np.where((valley > .74) & (macro < .60) & ~wet, GRASS, surface)
    surface = np.where(rock > .46, ROCK, surface)
    surface = np.where(gravel, GRAVEL, surface).astype(np.uint8)
    # Follow the browser's oak placement weights, with wider spacing for blocky crowns.
    spur = 1 - valley
    grove = smooth(.46, .64, .7 * patch_noise(rng, 22) + .3 * macro)
    density = np.clip(.05 + .85 * (1 - smooth(.22, .60, spur)) + .55 * smooth(0, -.4, -dz * normal_y)
                      + .25 * smooth(.18, .45, slope) + .75 * grove - .7 * smooth(.62, .88, spur), 0, 1)
    density *= smooth(10, 35, shore) * (1 - smooth(.25, .42, slope))
    dry = np.isin(surface, [SOIL, MUD, GOLD]) & ~wet & (rng.random(surface.shape) < (.10 + .18 * macro))
    # Dry grass can survive on dirt variants and terracotta. Use coarse dirt beneath tufts
    # selected on bare packed-mud cells.
    surface[dry & (surface == MUD)] = SOIL
    return ground, wet, surface, dry, density


def trees(ground, wet, density, look, rng, viewpoints):
    patches = defaultdict(dict)
    weights = look['vegetation']['species']
    species = [(DARK_LOG, DARK_LEAVES, 2), (OAK_LOG, PALE_LEAVES, 2), (OAK_LOG, OAK_LEAVES, 3)]
    counts = [0, 0, 0]
    for row in range(5, LENGTH - 5, 7):
        for col in range(5, WIDTH - 5, 7):
            z, x = row + int(rng.integers(-2, 3)), col + int(rng.integers(-2, 3))
            if wet[z, x] or rng.random() >= density[z, x] * look['vegetation']['density']:
                continue
            if any((x - vx) ** 2 + (z - vz) ** 2 < 64 for vx, _, vz, _, _ in viewpoints.values()):
                continue
            pick = rng.random()
            kind = 0 if pick < weights['coast-live'] else (1 if pick < weights['coast-live'] + weights['blue'] else 2)
            counts[kind] += 1
            log, leaves, radius = species[kind]
            y0 = int(ground[z, x])
            trunk = int(rng.integers(2, 4)) + (kind == 2)
            for oy, radi in [(-1, radius - 1), (0, radius), (1, radius - 1), (2, 0 if kind != 2 else 1)]:
                y = y0 + trunk + oy
                for oz in range(-radi, radi + 1):
                    for ox in range(-radi, radi + 1):
                        zz, xx = z + oz, x + ox
                        if ox * ox + oz * oz > radi * radi + .5 or y <= ground[zz, xx] or wet[zz, xx]:
                            continue
                        patches[xx // 16, zz // 16].setdefault((y, zz % 16, xx % 16), leaves)
            for y in range(y0 + 1, y0 + trunk + 1):
                patches[x // 16, z // 16][y, z % 16, x % 16] = log
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


def make_header(template, out, spawn):
    # Construct a minimal clean save using the game's version and generator schema.
    source = nbtlib.load(template / 'level.dat')['Data']
    if int(source['DataVersion']) != VERSION:
        raise ValueError('Expected a Java 26.3 template')
    level = Compound({key: source[key] for key in ('Version', 'DataVersion', 'version')})
    x, y, z, yaw, pitch = spawn
    level.update(LevelName=String('Calaveras Reservoir - Waterscape'), GameType=Int(1), allowCommands=Byte(1),
                 initialized=Byte(1), WasModded=Byte(0), Time=Long(6000), LastPlayed=Long(time.time_ns() // 1_000_000),
                 DataPacks=Compound({'Enabled': List[String](['vanilla']), 'Disabled': List[String]([])}),
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


def new_chunk(cx, cz, ground, wet, surface, plants, tree):
    # The native Java 26.3 chunk format comes from the game-written template and shared I/O.
    base_surface = np.where(wet, WATER_Y, ground)
    heights = {'WORLD_SURFACE': base_surface + (plants > 0), 'OCEAN_FLOOR': ground.copy(),
               'MOTION_BLOCKING': base_surface.copy(), 'MOTION_BLOCKING_NO_LEAVES': base_surface.copy()}
    tree_by_section = defaultdict(list)
    for (y, z, x), block in tree.items():
        tree_by_section[y // 16].append((y % 16, z, x, block))
        heights['WORLD_SURFACE'][z, x] = max(heights['WORLD_SURFACE'][z, x], y)
        heights['MOTION_BLOCKING'][z, x] = max(heights['MOTION_BLOCKING'][z, x], y)
        # Leaves have a collision shape and count in OCEAN_FLOOR.
        heights['OCEAN_FLOOR'][z, x] = max(heights['OCEAN_FLOOR'][z, x], y)
        if block in (DARK_LOG, OAK_LOG):
            heights['MOTION_BLOCKING_NO_LEAVES'][z, x] = max(heights['MOTION_BLOCKING_NO_LEAVES'][z, x], y)
    low = int(ground.min()) - 3
    high = int(heights['WORLD_SURFACE'].max())
    biome = Compound({'palette': List[String](['minecraft:savanna'])})
    sections = []
    for sy in range(-4, 20):
        if sy * 16 > high or (sy > -4 and sy * 16 + 15 < low):
            palette = World.palette([BLOCKS[AIR if sy * 16 > high else STONE]], True)
            states = Compound({'palette': palette})
        else:
            y = np.arange(sy * 16, (sy + 1) * 16)[:, None, None]
            empty = np.where(wet & (y <= WATER_Y), WATER, AIR)
            block = np.where(y == ground, surface, np.where(y >= ground - 3, DIRT, STONE))
            block = np.where(y <= ground, block, empty).astype(np.uint8)
            block = np.where((y == ground + 1) & (plants > 0), np.where(plants == 2, TALL, SHORT), block).astype(np.uint8)
            if sy == -4:
                block[0] = BEDROCK
            for oy, oz, ox, kind in tree_by_section[sy]:
                block[oy, oz, ox] = kind
            ids, indices = np.unique(block, return_inverse=True)
            states = Compound({'palette': World.palette([BLOCKS[i] for i in ids], True)})
            if len(ids) > 1:
                states['data'] = longpack(indices.ravel(), max(4, (len(ids) - 1).bit_length()))
        sections.append(Compound({'Y': Byte(sy), 'biomes': biome, 'block_states': states}))
    return nbtlib.File(dict(DataVersion=Int(VERSION), xPos=Int(cx), zPos=Int(cz), yPos=Int(-4),
                            Status=String('minecraft:full'), sections=List[Compound](sections),
                            Heightmaps=Compound({key: longpack(val + 65, 9) for key, val in heights.items()}),
                            isLightOn=Byte(0), LastUpdate=Long(0), InhabitedTime=Long(0),
                            structures=Compound({'starts': Compound(), 'References': Compound()}),
                            block_entities=List[Compound]([]), block_ticks=List[Compound]([]),
                            fluid_ticks=List[Compound]([]), PostProcessing=List[List]([List([]) for _ in sections])))


def audit(path, chunks, ground, wet, rx, rz):
    saved, _ = region.read_region(path)
    if saved.keys() != chunks.keys():
        raise ValueError(f'Chunk index mismatch in {path}')
    # Sample across the map, including the water level in any wet sample.
    selected = set(list(saved)[::127])
    def chunk_has_water(key):
        x = (rx * 32 + key % 32) * 16
        z = (rz * 32 + key // 32) * 16
        return wet[z:z + 16, x:x + 16].any()

    wet_key = next((key for key in saved if chunk_has_water(key)), None)
    if wet_key is not None:
        selected.add(wet_key)
    for key in selected:
        chunk = region.decode_chunk(saved[key])
        cx, cz = int(chunk['xPos']), int(chunk['zPos'])
        assert int(chunk['DataVersion']) == VERSION and str(chunk['Status']) == 'minecraft:full'
        assert len(chunk['sections']) == 24 and all(len(h) == 37 for h in chunk['Heightmaps'].values())
        full = np.empty((384, 16, 16), dtype=np.uint8)
        for section in chunk['sections']:
            palette = [str(World.normalise(entry)['Name']) for entry in section['block_states']['palette']]
            ids = [next(i for i, state_tag in enumerate(BLOCKS) if str(state_tag['Name']) == name) for name in palette]
            sy = int(section['Y']) + 4
            full[sy * 16:(sy + 1) * 16] = np.array(ids)[region.unpack(section).reshape(16, 16, 16)]
        sl = np.s_[cz * 16:(cz + 1) * 16, cx * 16:(cx + 1) * 16]
        assert np.all((full[WATER_Y + 64] == WATER) == wet[sl])
        assert np.all(full[0] == BEDROCK)
        z, x = np.indices((16, 16))
        assert np.all(full[ground[sl] + 64, z, x] != AIR)
        world_surface = [int(v) & ((1 << 64) - 1) for v in chunk['Heightmaps']['WORLD_SURFACE']]
        recorded = [(world_surface[i // 7] >> ((i % 7) * 9)) & 511 for i in range(256)]
        assert np.array_equal(recorded, (384 - (full[::-1] != AIR).argmax(axis=0)).ravel())
    return len(selected)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--template', required=True, type=Path, help='Existing Java 26.3 save used only for header schema')
    p.add_argument('--out', required=True, type=Path, help='A new folder for the generated world')
    args = p.parse_args()
    if args.out.exists():
        p.error('--out must be a new folder')
    folder = REPO / 'data/calaveras'
    meta, data = load_grid(folder)
    look = json.loads((folder / 'land.json').read_text())
    rng = np.random.default_rng(SEED)
    ground, wet, surface, dry, density = terrain(meta, data, look, rng)
    views = cameras(folder, ground, wet)
    tree, counts = trees(ground, wet, density, look, rng, views)
    plants = np.where(dry, np.where(rng.random(dry.shape) < .77, 1, 2), 0).astype(np.uint8)
    for (cx, cz), blocks in tree.items():
        for y, z, x in blocks:
            ix, iz = cx * 16 + x, cz * 16 + z
            if y == ground[iz, ix] + 1:
                plants[iz, ix] = 0
    args.out.mkdir(parents=True)
    make_header(args.template, args.out, views['overlook'])
    region_dir = args.out / 'dimensions/minecraft/overworld/region'
    region_dir.mkdir(parents=True)
    written = checked = 0
    for rz in range(math.ceil(LENGTH / 512)):
        for rx in range(math.ceil(WIDTH / 512)):
            chunks = {}
            for cz in range(rz * 32, min((rz + 1) * 32, LENGTH // 16)):
                for cx in range(rx * 32, min((rx + 1) * 32, WIDTH // 16)):
                    sl = np.s_[cz * 16:(cz + 1) * 16, cx * 16:(cx + 1) * 16]
                    chunk = new_chunk(cx, cz, ground[sl], wet[sl], surface[sl], plants[sl], tree.get((cx, cz), {}))
                    chunks[(cx & 31) + (cz & 31) * 32] = region.encode_chunk(chunk)
            path = region_dir / f'r.{rx}.{rz}.mca'
            region.write_region(path, chunks, bytes(4096))
            checked += audit(path, chunks, ground, wet, rx, rz)
            written += len(chunks)
            print(f'{path.name}: {written} chunks written', flush=True)
    colors = np.array([(0, 0, 0)] * len(BLOCKS), dtype=np.float32)
    for idx, color in {SOIL: (164, 133, 85), GOLD: (192, 162, 87), MUD: (148, 113, 78),
                       GRASS: (153, 148, 82), GRAVEL: (182, 166, 133), ROCK: (128, 119, 105)}.items():
        colors[idx] = color
    dy, dx = np.gradient(ndimage.gaussian_filter(ground.astype(np.float32), 1.6))
    rgb = colors[surface] * np.clip(1 + .32 * (dx + dy), .52, 1.35)[..., None]
    rgb[wet] = (39, 90, 118)
    for (cx, cz), blocks in tree.items():
        for (y, z, x), kind in blocks.items():
            if kind in (DARK_LEAVES, OAK_LEAVES, PALE_LEAVES):
                rgb[cz * 16 + z, cx * 16 + x] = (64, 75, 45)
    preview = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))
    preview.save(args.out.parent / 'calaveras-overview.png')
    preview.resize((64, 64), Image.Resampling.LANCZOS).save(args.out / 'icon.png')
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=REPO, text=True).strip()
    info = {'bundle': 'calaveras', 'bundle_commit': commit, 'minecraft': 'Java 26.3', 'data_version': VERSION,
            'source': meta['service'], 'crs': meta['crs'], 'vertical_datum': meta['verticalDatum'],
            'origin_utm': meta['originUTM'], 'scene_northwest_edge_m': [WEST, NORTH], 'dimensions_blocks': [WIDTH, LENGTH],
            'metres_per_block_xyz': [SCALE, SCALE, SCALE], 'source_grid_spacing_m': meta['cell'],
            'survey_water_level_m': meta['waterLevel'], 'water_block_y': WATER_Y, 'seed': SEED,
            'calaveras_dam': 'Embankment as captured in the Waterscape elevation grid; no separate structure overlays.',
            'interpretation': ['Procedural Diablo oak trees and dry summer ground.',
                               'Synthetic reservoir bottom using Waterscape bank slope and depth cap.',
                               'One-block dry rim where needed to contain Minecraft water.'],
            'tree_counts': dict(zip(('coast-live', 'blue', 'valley'), counts)),
            'viewpoints_xyz_yaw_pitch': views, 'verified_chunks': checked, 'written_chunks': written}
    (args.out / 'waterscape-build.json').write_text(json.dumps(info, indent=2) + '\n', encoding='utf-8')
    print(f'{written} chunks, {checked} decoded and sampled, {sum(counts)} oaks; spawn {views["overlook"]}', flush=True)


if __name__ == '__main__':
    main()
