"""Add an illustrative plunge pool on a copy of the Hetch Hetchy demo.

Dry run unless --apply is supplied. Coordinates and water level come from
Waterscape's dam/river metadata; pool shape, depth and boulders are illustrative.
"""
import argparse
import collections
import json
from pathlib import Path

import numpy as np
from pyproj import Transformer
from scipy.ndimage import binary_dilation
import region_edit as region
from remove_dam_slope import heights

NATURAL = {'minecraft:air','minecraft:cave_air','minecraft:void_air','minecraft:stone',
           'minecraft:andesite','minecraft:diorite','minecraft:gravel','minecraft:dirt',
           'minecraft:grass_block','minecraft:coarse_dirt','minecraft:short_dry_grass',
           'minecraft:tall_dry_grass','minecraft:spruce_leaves','minecraft:dark_oak_leaves'}
AIR = {'minecraft:air','minecraft:cave_air','minecraft:void_air'}


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--world',required=True,type=Path)
    p.add_argument('--structures',required=True,type=Path)
    p.add_argument('--apply',action='store_true')
    args=p.parse_args();w=args.world.resolve()
    marker=w/'waterscape-dam-pool-applied.txt'
    if marker.exists(): raise SystemExit('Pool edit already applied; start from an unedited copy.')
    meta=json.loads((w/'metadata.json').read_text(encoding='utf-8-sig'))
    src=json.loads(args.structures.read_text(encoding='utf-8-sig'))
    tx=Transformer.from_crs(32611,4326,always_xy=True)
    def mc(pt):
        lon,lat=tx.transform(*pt)
        return np.array([(lon-meta['minGeoLon'])/(meta['maxGeoLon']-meta['minGeoLon'])*meta['maxMcX'],
                         (meta['maxGeoLat']-lat)/(meta['maxGeoLat']-meta['minGeoLat'])*meta['maxMcZ']])
    r=src['rivers'][0];start=mc(r['centreUTM'][0]);crest=[mc(p) for p in src['dams'][0]['crestUTM']]
    candidates=[]
    for a,b in zip(crest,crest[1:]):
        v=b-a;t=np.clip(np.dot(start-a,v)/np.dot(v,v),0,1);candidates.append(a+t*v)
    near=min(candidates,key=lambda q:np.linalg.norm(q-start));axis=near-start;axis=axis/np.linalg.norm(axis)
    end=near-axis*8;center=(start+end)/2
    half=np.linalg.norm(end-start)/2+7;width=11
    pool_y=round(80+(r['surface'][0]-1151.7)*.25)
    region_dir=w/'dimensions/minecraft/overworld/region'
    if not region_dir.is_dir():region_dir=w/'region'
    if not region_dir.is_dir():raise SystemExit('No overworld region directory')
    stats=collections.Counter();nchunks=0
    for rx in (0,1):
        path=region_dir/f'r.{rx}.2.mca'
        if not path.exists():continue
        chunks,times=region.read_region(path);dirty=False
        for idx,raw in list(chunks.items()):
            chunk=region.decode_chunk(raw);cx,cz=int(chunk['xPos']),int(chunk['zPos'])
            x,z=np.meshgrid(np.arange(cx*16,cx*16+16),np.arange(cz*16,cz*16+16))
            if x.max()<500 or x.min()>610 or z.max()<1320 or z.min()>1415:continue
            ox=x-center[0];oz=z-center[1]
            along=(ox*axis[0]+oz*axis[1])/half;across=(-ox*axis[1]+oz*axis[0])/width
            r2=along*along+across*across
            pool=r2<=1
            # A low, irregular granite rim; never extend into the dam's concrete.
            damdist=np.minimum.reduce([np.hypot(x-c[0],z-c[1]) for c in crest])
            bank=(r2>1)&(r2<1.7)&(damdist>10)
            # Leave the existing downstream channel and its immediate banks open.
            existing_water=np.zeros((16,16),dtype=bool)
            for section in chunk['sections']:
                sy=int(section['Y'])
                if 'block_states' not in section or not sy*16<=pool_y<sy*16+16:continue
                names=[str(e['Name']) for e in section['block_states']['palette']]
                ids=[i for i,n in enumerate(names) if n=='minecraft:water']
                if ids:
                    arr=region.unpack(section).reshape(16,16,16)
                    existing_water=np.isin(arr[pool_y-sy*16],ids)
            bank &= ~binary_dilation(existing_water,iterations=2)
            if not pool.any() and not bank.any():continue
            depth=np.clip(2+5*np.sqrt(np.maximum(0,1-r2))+np.sin(x/4)*.8*np.cos(z/6),2,8)
            bottom=pool_y-np.rint(depth).astype(np.int16)
            bank_top=pool_y+np.rint(3*np.clip((1.7-r2)/.7,0,1)+np.sin(x/7)*np.cos(z/9)).astype(np.int16)
            changed=np.zeros((16,16),bool);chunkdirty=False
            for sec in chunk['sections']:
                if 'block_states' not in sec:continue
                names=[str(e['Name']) for e in sec['block_states']['palette']]
                ids=[i for i,n in enumerate(names) if n in NATURAL]
                if not ids:continue
                arr=region.unpack(sec).reshape(16,16,16);yy=np.arange(int(sec['Y'])*16,int(sec['Y'])*16+16)[:,None,None]
                eligible=np.isin(arr,ids)
                clear=np.isin(arr,[i for i,n in enumerate(names) if n in NATURAL and n not in AIR])&pool[None,:,:]&(yy>pool_y)
                water=eligible&pool[None,:,:]&(yy>bottom[None,:,:])&(yy<=pool_y)
                bed=eligible&pool[None,:,:]&(yy==bottom[None,:,:])
                bankfill=eligible&bank[None,:,:]&(yy>=pool_y-3)&(yy<=bank_top[None,:,:])
                # Only write a rim where there is already natural ground or air;
                # leave dam concrete, non-natural structures and existing water alone.
                hit=clear|water|bed|bankfill
                if not hit.any():continue
                air=region.palette_id(sec,'minecraft:air');waterid=region.palette_id(sec,'minecraft:water',{'level':'0'})
                diorite=region.palette_id(sec,'minecraft:diorite');andesite=region.palette_id(sec,'minecraft:andesite')
                rock=np.where(((x//5)*13+(z//7)*17)%10<7,diorite,andesite)
                for label,mask in [('cleared',clear),('water',water),('bottom',bed),('rim',bankfill)]:stats[label]+=int(mask.sum())
                arr[clear]=air;arr[water]=waterid
                arr[:]=np.where(bed|bankfill,rock[None,:,:],arr)
                changed|=np.any(hit,axis=0)
                region.pack(sec,arr.ravel());chunkdirty=True
            if chunkdirty:
                nchunks+=1
                if args.apply:
                    heights(chunk,changed);region.mark_relight(chunk);chunks[idx]=region.encode_chunk(chunk);dirty=True
        if dirty:region.write_region(path,chunks,times)
    if args.apply:marker.write_text('Illustrative downstream plunge pool applied.\n',encoding='utf-8')
    print(('Applied' if args.apply else 'Would apply'),dict(stats),'in',nchunks,'chunks; water y=',pool_y,'start=',start.round(1),'near dam=',near.round(1))


if __name__=='__main__':main()
