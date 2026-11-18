"""Retexture natural soil below the Hetch Hetchy dam in an offline world copy.

Dry run by default. Requires numpy, scipy, Pillow, pyproj and nbtlib. This is a
site-specific demo tool; it does not modify dam geometry or underwater blocks.
"""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from pyproj import Transformer
from scipy.ndimage import distance_transform_edt

import region_edit as region


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--world', type=Path, required=True, help='Offline world copy, never the only save')
    p.add_argument('--structures', type=Path, required=True)
    p.add_argument('--apply', action='store_true', help='Write changes; otherwise only report')
    args = p.parse_args()
    world = args.world.resolve()
    meta = json.loads((world / 'metadata.json').read_text(encoding='utf-8-sig'))
    data = json.loads(args.structures.read_text(encoding='utf-8-sig'))
    region_dir = world / 'dimensions/minecraft/overworld/region'
    if not region_dir.is_dir():
        region_dir = world / 'region'
    if not region_dir.is_dir():
        raise SystemExit('No supported overworld region directory')
    w, h = meta['maxMcX'] + 1, meta['maxMcZ'] + 1
    tx = Transformer.from_crs(32611, 4326, always_xy=True)

    def mc(pt):
        lon, lat = tx.transform(*pt)
        x = (lon-meta['minGeoLon'])/(meta['maxGeoLon']-meta['minGeoLon'])*(w-1)
        z = (meta['maxGeoLat']-lat)/(meta['maxGeoLat']-meta['minGeoLat'])*(h-1)
        return round(x), round(z)

    # The first section of the mapped downstream river and the downstream face
    # of the crest define a localized visual treatment, not a geological map.
    x0, z0, x1, z1 = 200, 1240, 640, 1610
    line = Image.new('1', (x1-x0, z1-z0))
    draw = ImageDraw.Draw(line)
    river = [mc(pt) for pt in data['rivers'][0]['centreUTM']]
    dam = [mc(pt) for pt in data['dams'][0]['crestUTM']]
    draw.line([(x-x0, z-z0) for x, z in river], fill=1, width=1)
    river_dist = distance_transform_edt(~np.asarray(line, dtype=bool))
    line2 = Image.new('1', (x1-x0, z1-z0))
    ImageDraw.Draw(line2).line([(x-x0, z-z0) for x, z in dam], fill=1, width=1)
    dam_dist = distance_transform_edt(~np.asarray(line2, dtype=bool))
    zz, xx = np.mgrid[z0:z1, x0:x1]
    # Restrict the near-wall part to the downstream/west side of the crest.
    jitter = 4*np.sin(xx/17.0)*np.cos(zz/19.0)
    mask = (river_dist < 30+jitter) | ((dam_dist < 40+jitter) & (xx < 580) & (zz > 1300))
    mask &= (xx < 590)
    changed = sections = chunks_changed = 0
    targets = {'minecraft:dirt', 'minecraft:coarse_dirt', 'minecraft:grass_block',
               'minecraft:rooted_dirt', 'minecraft:podzol', 'minecraft:dirt_path'}
    for rz in range(z0//512, (z1-1)//512+1):
        for rx in range(x0//512, (x1-1)//512+1):
            path = region_dir / f'r.{rx}.{rz}.mca'
            if not path.exists():
                continue
            chunks, timestamps = region.read_region(path)
            dirty_region = False
            for index, raw in list(chunks.items()):
                chunk = region.decode_chunk(raw)
                cx, cz = int(chunk['xPos']), int(chunk['zPos'])
                bx, bz = cx*16, cz*16
                if bx < x0 or bz < z0 or bx+16 > x1 or bz+16 > z1:
                    continue
                local = mask[bz-z0:bz-z0+16, bx-x0:bx-x0+16]
                if not local.any():
                    continue
                chunk_dirty = False
                # Large patches, rather than alternating individual blocks.
                lx, lz = np.meshgrid(np.arange(bx, bx+16), np.arange(bz, bz+16))
                rock = ((lx//5)*13+(lz//7)*17) % 10
                for sec in chunk['sections']:
                    if 'block_states' not in sec:
                        continue
                    pal = sec['block_states']['palette']
                    ids = [i for i, entry in enumerate(pal) if str(entry['Name']) in targets]
                    if not ids:
                        continue
                    arr = region.unpack(sec).reshape(16, 16, 16)
                    hit = np.isin(arr, ids) & local[None, :, :]
                    n = int(hit.sum())
                    if not n:
                        continue
                    d = region.palette_id(sec, 'minecraft:diorite')
                    a = region.palette_id(sec, 'minecraft:andesite')
                    rock_ids = np.where(rock < 7, d, a)[None, :, :]
                    arr[:] = np.where(hit, rock_ids, arr)
                    if args.apply:
                        region.pack(sec, arr.ravel())
                    changed += n
                    sections += 1
                    chunk_dirty = True
                if chunk_dirty:
                    chunks_changed += 1
                    if args.apply:
                        region.mark_relight(chunk)
                        chunks[index] = region.encode_chunk(chunk)
                        dirty_region = True
            if dirty_region:
                region.write_region(path, chunks, timestamps)
    print(f"{'Applied' if args.apply else 'Would change'}: {changed} soil/grass blocks in {sections} sections, {chunks_changed} chunks")


if __name__ == '__main__':
    main()
