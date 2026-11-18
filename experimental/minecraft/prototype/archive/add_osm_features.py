"""Place mapped Hetch Hetchy roads and simple building shells on a world copy.

Uses a cropped OSM extract obtained by Arnis, not Arnis's own generated blocks.
Dry run by default. Buildings, road blocks, heights and roofs are approximations.
"""
import argparse
import collections
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import binary_erosion
import region_edit as region
from remove_dam_slope import heights

AIR={'minecraft:air','minecraft:cave_air','minecraft:void_air'}
GROUND={'minecraft:stone','minecraft:andesite','minecraft:diorite','minecraft:calcite',
        'minecraft:grass_block','minecraft:dirt','minecraft:coarse_dirt','minecraft:gravel',
        'minecraft:smooth_stone','minecraft:rooted_dirt','minecraft:podzol','minecraft:dirt_path'}
FLORA={'minecraft:short_dry_grass','minecraft:tall_dry_grass','minecraft:short_grass',
       'minecraft:fern','minecraft:grass','minecraft:snow','minecraft:dead_bush',
       'minecraft:spruce_log','minecraft:spruce_leaves','minecraft:dark_oak_log','minecraft:dark_oak_leaves'}
REPLACEABLE=AIR|GROUND|FLORA


def main():
    p=argparse.ArgumentParser();p.add_argument('--world',required=True,type=Path)
    p.add_argument('--osm',required=True,type=Path);p.add_argument('--apply',action='store_true')
    args=p.parse_args();w=args.world.resolve();marker=w/'waterscape-osm-features-applied.txt'
    if marker.exists():raise SystemExit('OSM features already marked as applied; start from an unedited copy.')
    meta=json.loads((w/'metadata.json').read_text(encoding='utf-8-sig'))
    data=json.loads(args.osm.read_text(encoding='utf-8-sig'))['elements'];W,H=meta['maxMcX']+1,meta['maxMcZ']+1
    nodes={e['id']:e for e in data if e['type']=='node'}
    def mc(node):
        return (round((node['lon']-meta['minGeoLon'])/(meta['maxGeoLon']-meta['minGeoLon'])*meta['maxMcX']),
                round((meta['maxGeoLat']-node['lat'])/(meta['maxGeoLat']-meta['minGeoLat'])*meta['maxMcZ']))
    image=Image.new('L',(W,H));draw=ImageDraw.Draw(image);footprints=[];way_count=0
    for e in data:
        if e['type']!='way':continue
        tag=e.get('tags',{});pts=[mc(nodes[i]) for i in e['nodes'] if i in nodes]
        if len(pts)<2:continue
        if tag.get('highway') and tag.get('tunnel')!='yes':
            highway=tag['highway'];path=highway in ('path','footway','steps','track','bridleway')
            width=1 if path else (2 if highway=='service' else 3)
            draw.line(pts,fill=1 if path else 2,width=width);way_count+=1
        if tag.get('building') and len(pts)>=3:
            xs,zs=zip(*pts);x0=max(0,min(xs));x1=min(W-1,max(xs));z0=max(0,min(zs));z1=min(H-1,max(zs))
            if x1-x0<1 or z1-z0<1:continue
            im=Image.new('1',(x1-x0+1,z1-z0+1));ImageDraw.Draw(im).polygon([(x-x0,z-z0) for x,z in pts],fill=1)
            mask=np.asarray(im,dtype=bool)
            if mask.sum()<4:continue
            footprints.append((e['id'],tag,x0,z0,mask))
    road=np.asarray(image,dtype=np.uint8)
    needed={(int(x)//16,int(z)//16) for z,x in np.argwhere(road>0)}
    for _,_,x0,z0,mask in footprints:
        needed.update(((x0+int(x))//16,(z0+int(z))//16) for z,x in np.argwhere(mask))
    region_dir=w/'dimensions/minecraft/overworld/region'
    if not region_dir.is_dir():region_dir=w/'region'
    if not region_dir.is_dir():raise SystemExit('No overworld region directory')
    groups=collections.defaultdict(set)
    for cx,cz in needed:groups[(cx//32,cz//32)].add((cx,cz))
    ground=np.full((H,W),-65,np.int16);water=np.full((H,W),-65,np.int16);dam=np.zeros((H,W),bool)
    # Read current world columns, not Arnis's differently scaled elevation.
    for (rx,rz),coords in groups.items():
        f=region_dir/f'r.{rx}.{rz}.mca'
        if not f.exists():continue
        chunks,_=region.read_region(f)
        for cx,cz in coords:
            index=(cx%32)+(cz%32)*32
            if index not in chunks:continue
            chunk=region.decode_chunk(chunks[index]);g=np.full((16,16),-65,np.int16);wa=g.copy();dm=np.zeros((16,16),bool)
            for sec in chunk['sections']:
                if 'block_states' not in sec:continue
                names=[str(e['Name']) for e in sec['block_states']['palette']];arr=region.unpack(sec).reshape(16,16,16)
                yy=np.arange(int(sec['Y'])*16,int(sec['Y'])*16+16)[:,None,None]
                gm=np.asarray([n in GROUND for n in names])[arr];wm=np.asarray([n=='minecraft:water' for n in names])[arr]
                g=np.maximum(g,np.max(np.where(gm,yy,-65),axis=0));wa=np.maximum(wa,np.max(np.where(wm,yy,-65),axis=0))
            # Query the block at the highest ground to preserve the wall.
            for sec in chunk['sections']:
                if 'block_states' not in sec:continue
                sy=int(sec['Y']);names=[str(e['Name']) for e in sec['block_states']['palette']]
                ids=[i for i,n in enumerate(names) if n=='minecraft:smooth_stone']
                if ids:
                    arr=region.unpack(sec).reshape(16,16,16);yy=np.arange(sy*16,sy*16+16)[:,None,None]
                    dm|=np.any(np.isin(arr,ids)&(yy==g[None,:,:]),axis=0)
            x0,z0=cx*16,cz*16;x1,z1=min(W,x0+16),min(H,z0+16)
            ground[z0:z1,x0:x1]=g[:z1-z0,:x1-x0];water[z0:z1,x0:x1]=wa[:z1-z0,:x1-x0];dam[z0:z1,x0:x1]=dm[:z1-z0,:x1-x0]
    # Map position -> desired material; later building operations replace road operations.
    ops={};stats=collections.Counter()
    for z,x in np.argwhere(road>0):
        g=int(ground[z,x])
        if g < -60 or water[z,x]>g:stats['road_cells_skipped_water_or_missing']+=1;continue
        if dam[z,x]:
            ops[(int(x),g+1,int(z))]='minecraft:stone_bricks'
        else:
            ops[(int(x),g,int(z))]='minecraft:packed_mud' if road[z,x]==1 else 'minecraft:gray_concrete'
        # Clear only vegetation, not buildings, water or other user-made blocks.
        for y in range(g+1,g+5):
            if (int(x),y,int(z)) not in ops:ops[(int(x),y,int(z))]='CLEAR_FLORA'
        stats['road_cells']+=1
    for ident,tag,x0,z0,mask in footprints:
        zz,xx=np.nonzero(mask);xx=xx+x0;zz=zz+z0;g=ground[zz,xx];wa=water[zz,xx]
        if np.any(g < -60) or np.any(wa>g) or np.any(dam[zz,xx]) or int(g.max()-g.min())>4:
            stats['buildings_skipped']+=1;continue
        base=int(g.max());boundary=mask & ~binary_erosion(mask,border_value=0)
        bz,bx=np.nonzero(boundary);door=(int(bx[0]+x0),int(bz[0]+z0)) if len(bx) else None
        for local_z,local_x in np.argwhere(mask):
            x=x0+int(local_x);z=z0+int(local_z);g0=int(ground[z,x])
            for y in range(g0+1,base+1):ops[(x,y,z)]='minecraft:stone_bricks'
            ops[(x,base,z)]='minecraft:stone_bricks'
            if boundary[local_z,local_x]:
                for y in range(base+1,base+4):
                    if (x,z)==door and y<base+3:ops[(x,y,z)]='CLEAR_FLORA'
                    else:ops[(x,y,z)]='minecraft:stone_bricks'
            ops[(x,base+4,z)]='minecraft:spruce_planks'
        stats['buildings_planned']+=1
    bychunk=collections.defaultdict(list)
    for (x,y,z),kind in ops.items():bychunk[(x//16,z//16)].append((x%16,y,z%16,kind))
    regiongroups=collections.defaultdict(set)
    for cx,cz in bychunk:regiongroups[(cx//32,cz//32)].add((cx,cz))
    for (rx,rz),coords in regiongroups.items():
        path=region_dir/f'r.{rx}.{rz}.mca'
        if not path.exists():continue
        chunks,times=region.read_region(path);dirty=False
        for cx,cz in coords:
            idx=(cx%32)+(cz%32)*32
            if idx not in chunks:continue
            chunk=region.decode_chunk(chunks[idx]);changed=np.zeros((16,16),bool);chunkdirty=False
            bysection=collections.defaultdict(list)
            for x,y,z,kind in bychunk[(cx,cz)]:bysection[y//16].append((x,y%16,z,kind))
            for sec in chunk['sections']:
                if 'block_states' not in sec or int(sec['Y']) not in bysection:continue
                names=[str(e['Name']) for e in sec['block_states']['palette']];arr=region.unpack(sec).reshape(16,16,16)
                for x,y,z,kind in bysection[int(sec['Y'])]:
                    old=names[int(arr[y,z,x])]
                    if kind=='CLEAR_FLORA':
                        if old not in FLORA:continue
                        new='minecraft:air'
                    else:
                        if old not in REPLACEABLE or old=='minecraft:smooth_stone':continue
                        new=kind
                    if old==new:continue
                    palid=region.palette_id(sec,new);arr[y,z,x]=palid
                    if palid>=len(names):names.append(new)
                    stats['blocks_'+new.rsplit(':',1)[-1]]+=1;changed[z,x]=True;chunkdirty=True
                if chunkdirty:region.pack(sec,arr.ravel())
            if chunkdirty:
                stats['chunks']+=1
                if args.apply:
                    heights(chunk,changed);region.mark_relight(chunk);chunks[idx]=region.encode_chunk(chunk);dirty=True
        if dirty:region.write_region(path,chunks,times)
    if args.apply:marker.write_text('OSM roads and approximate building shells applied. © OpenStreetMap contributors, ODbL.\n',encoding='utf-8')
    print(('Applied' if args.apply else 'Would apply'),dict(stats),'from',way_count,'mapped roads or paths')


if __name__=='__main__':main()
