"""Remove the identified earthen slope downstream of O'Shaughnessy Dam.

Dry run by default. Operates only on a supplied offline copy of the Hetch
Hetchy prototype. It preserves dam blocks and reservoir/river water. Requires
numpy, pyproj and nbtlib. The cut is an interpretive Minecraft correction.
"""
import argparse
import collections
import json
from pathlib import Path

import numpy as np
from pyproj import Transformer
from nbtlib import LongArray
import region_edit as region

AIR = {'minecraft:air', 'minecraft:cave_air', 'minecraft:void_air'}
PLANTS = {'minecraft:short_dry_grass', 'minecraft:tall_dry_grass', 'minecraft:short_grass',
          'minecraft:grass', 'minecraft:fern', 'minecraft:dead_bush', 'minecraft:snow'}
TREES = {'minecraft:spruce_log', 'minecraft:spruce_leaves',
         'minecraft:dark_oak_log', 'minecraft:dark_oak_leaves'}
EARTH = {'minecraft:dirt', 'minecraft:coarse_dirt', 'minecraft:grass_block',
         'minecraft:rooted_dirt', 'minecraft:podzol', 'minecraft:dirt_path',
         'minecraft:stone', 'minecraft:andesite', 'minecraft:diorite', 'minecraft:gravel'}
REMOVABLE = EARTH | PLANTS | TREES


def smooth(a, b, x):
    t = np.clip((x-a)/(b-a), 0, 1)
    return t*t*(3-2*t)


def heights(chunk, changed_columns):
    """Refresh affected heightmap columns after the cut; preserve others."""
    maps = {name: np.full((16, 16), -65, dtype=np.int16) for name in
            ('WORLD_SURFACE', 'OCEAN_FLOOR', 'MOTION_BLOCKING', 'MOTION_BLOCKING_NO_LEAVES')}
    for sec in chunk['sections']:
        if 'block_states' not in sec:
            continue
        sy = int(sec['Y'])
        pal = [str(e['Name']) for e in sec['block_states']['palette']]
        arr = region.unpack(sec).reshape(16, 16, 16)
        for name, out in maps.items():
            allowed = []
            for block in pal:
                if name == 'WORLD_SURFACE':
                    allowed.append(block not in AIR)
                elif name == 'MOTION_BLOCKING_NO_LEAVES':
                    allowed.append(block not in AIR and block not in PLANTS and not block.endswith('_leaves'))
                elif name == 'MOTION_BLOCKING':
                    allowed.append(block not in AIR and block not in PLANTS)
                else:
                    allowed.append(block not in AIR and block not in PLANTS and block not in ('minecraft:water', 'minecraft:lava'))
            include = np.asarray(allowed, dtype=bool)[arr]
            y = np.arange(sy*16, sy*16+16, dtype=np.int16)[:, None, None]
            out[:] = np.maximum(out, np.max(np.where(include, y, -65), axis=0))
    for name, data in maps.items():
        if name not in chunk.get('Heightmaps', {}):
            continue
        # Parsed NBT arrays may be backed by a read-only decompression buffer.
        chunk['Heightmaps'][name] = LongArray(np.array(chunk['Heightmaps'][name], dtype=np.int64, copy=True))
        for z, x in np.argwhere(changed_columns):
            region.height_set(chunk, name, int(x), int(z), int(data[z, x]))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--world', required=True, type=Path)
    ap.add_argument('--structures', required=True, type=Path)
    ap.add_argument('--apply', action='store_true')
    args = ap.parse_args()
    world = args.world.resolve()
    marker = world/'waterscape-dam-slope-applied.txt'
    if marker.exists():
        raise SystemExit('This one-shot slope edit is already marked as applied in this world. Start from an unedited copy.')
    meta = json.loads((world/'metadata.json').read_text(encoding='utf-8-sig'))
    structures = json.loads(args.structures.read_text(encoding='utf-8-sig'))
    tx = Transformer.from_crs(32611, 4326, always_xy=True)
    def mc(pt):
        lon, lat = tx.transform(*pt)
        return ((lon-meta['minGeoLon'])/(meta['maxGeoLon']-meta['minGeoLon'])*meta['maxMcX'],
                (meta['maxGeoLat']-lat)/(meta['maxGeoLat']-meta['minGeoLat'])*meta['maxMcZ'])
    crest = np.asarray([mc(p) for p in structures['dams'][0]['crestUTM']])
    order = np.argsort(crest[:, 1]); crest = crest[order]
    region_dir = world/'dimensions/minecraft/overworld/region'
    if not region_dir.is_dir(): region_dir = world/'region'
    if not region_dir.is_dir(): raise SystemExit('Missing overworld region directory')
    stats = collections.Counter(); painted = 0; count_chunks = 0
    for rz in range(2, 3):
        for rx in range(0, 2):
            path = region_dir/f'r.{rx}.{rz}.mca'
            if not path.exists(): continue
            chunks, timestamps = region.read_region(path); dirty = False
            for index, raw in list(chunks.items()):
                chunk = region.decode_chunk(raw);cx, cz = int(chunk['xPos']), int(chunk['zPos'])
                x, z = np.meshgrid(np.arange(cx*16, cx*16+16), np.arange(cz*16, cz*16+16))
                if x.max()<460 or x.min()>600 or z.max()<1305 or z.min()>1430: continue
                dam_x = np.interp(z, crest[:, 1], crest[:, 0]); dx = dam_x-x
                weight = (smooth(6, 10, dx)*(1-smooth(43, 55, dx)) *
                          smooth(1307, 1320, z)*(1-smooth(1408, 1425, z)))
                if np.max(weight)<.05: continue
                # Measure only natural ground, not trees, water or the concrete wall.
                surface = np.full((16, 16), -65, np.int16)
                for sec in chunk['sections']:
                    if 'block_states' not in sec: continue
                    pal = [str(e['Name']) for e in sec['block_states']['palette']]
                    arr = region.unpack(sec).reshape(16,16,16)
                    good = np.asarray([s in EARTH for s in pal],dtype=bool)[arr]
                    yy = np.arange(int(sec['Y'])*16,int(sec['Y'])*16+16)[:,None,None]
                    surface = np.maximum(surface, np.max(np.where(good,yy,-65),axis=0))
                river_floor = 58 + .8*np.sin(x/15.0)*np.cos(z/19.0)
                target = np.rint(surface-(surface-river_floor)*weight).astype(np.int16)
                changed_cols = np.zeros((16,16),bool);chunk_dirty=False
                for sec in chunk['sections']:
                    if 'block_states' not in sec: continue
                    pal = sec['block_states']['palette']
                    names = [str(e['Name']) for e in pal]
                    remove_ids = [i for i,n in enumerate(names) if n in REMOVABLE]
                    if not remove_ids: continue
                    arr=region.unpack(sec).reshape(16,16,16)
                    yy=np.arange(int(sec['Y'])*16,int(sec['Y'])*16+16)[:,None,None]
                    hit=np.isin(arr,remove_ids) & (yy>target[None,:,:]) & (weight[None,:,:]>.05)
                    for i in remove_ids:
                        count=int((hit & (arr==i)).sum())
                        if count: stats[names[i]]+=count
                    changed_cols |= np.any(hit,axis=0)
                    if hit.any():
                        air=region.palette_id(sec,'minecraft:air');arr[hit]=air
                    # The cut exposes gray subsurface stone. Give its visible
                    # floor the same granite-like rock palette as the canyon.
                    stone_ids=[i for i,n in enumerate(names) if n=='minecraft:stone']
                    floor=np.isin(arr,stone_ids) & (yy==target[None,:,:]) & (weight[None,:,:]>.5)
                    if floor.any():
                        diorite=region.palette_id(sec,'minecraft:diorite')
                        andesite=region.palette_id(sec,'minecraft:andesite')
                        choice=np.where(((x//5)*13+(z//7)*17)%10<7,diorite,andesite)
                        arr[:]=np.where(floor,choice[None,:,:],arr)
                        painted+=int(floor.sum());changed_cols |= np.any(floor,axis=0)
                    if not hit.any() and not floor.any(): continue
                    # Pack for both dry run and apply so height calculations inspect the result.
                    region.pack(sec,arr.ravel());chunk_dirty=True
                if chunk_dirty:
                    count_chunks+=1
                    if args.apply:
                        heights(chunk,changed_cols);region.mark_relight(chunk)
                        chunks[index]=region.encode_chunk(chunk);dirty=True
            if dirty: region.write_region(path,chunks,timestamps)
    if args.apply:
        marker.write_text('Hetch Hetchy downstream slope edit applied; do not run it again on this world.\n', encoding='utf-8')
    print(('Applied' if args.apply else 'Would remove'),sum(stats.values()),'blocks in',count_chunks,'chunks; by type:',dict(stats),'; exposed stone repainted:',painted)


if __name__ == '__main__': main()
