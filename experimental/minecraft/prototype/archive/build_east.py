import json, math, pathlib, sys, time
root=pathlib.Path(__file__).resolve().parent
sys.path[:0]=[str(root.parent/'Livermore-Quarry'),str(root.parent/'Livermore-Arnis'/'python-packages')]
import numpy as np
from scipy.ndimage import map_coordinates, distance_transform_edt
from pyproj import Transformer
from PIL import Image, ImageDraw
import nbtlib
from nbtlib import Compound, String, List, LongArray, Byte, Int, Double, Float
import region_edit as re

world=root/'Hetch Hetchy - Granite Valley'
meta=json.loads((world/'metadata.json').read_text())
source=json.loads((root/'source/terrain.json').read_text())
structures=json.loads((root/'source/structures.json').read_text())
src=np.load(root/'source/decoded.npz')
W,H=meta['maxMcX']+1,meta['maxMcZ']+1
# Pad to whole chunks; the outer border extends the edge values.
PW,PH=math.ceil(W/16)*16,math.ceil(H/16)*16
lon=np.linspace(meta['minGeoLon'],meta['maxGeoLon'],W)
lat=np.linspace(meta['maxGeoLat'],meta['minGeoLat'],H)
LON,LAT=np.meshgrid(lon,lat)
east,north=Transformer.from_crs(4326,32611,always_xy=True).transform(LON,LAT)
cell=source['cell'][0]; ox,oz=source['gridOrigin']; ue,un=source['originUTM']
coords=np.array([(un-north-oz)/cell,(east-ue-ox)/cell])
assert coords[0].min()>=0 and coords[1].min()>=0 and coords[0].max()<src['height'].shape[0]-1 and coords[1].max()<src['height'].shape[1]-1
h=map_coordinates(src['height'],coords,order=1)
shore=map_coordinates(src['shore'],coords,order=1)
water=shore<0
ground=np.clip(np.rint(80+h*.25),-60,305).astype(np.int16)
zz,xx=np.ogrid[:H,:W]
bed_variation=3*np.sin(xx/73.0)*np.cos(zz/91.0)+2*np.sin((xx+zz)/47.0)
depth=np.clip(8+(-shore*.10)+bed_variation,8,32)
ground[water]=80-np.rint(depth[water]).astype(np.int16)
water_y=np.where(water,80,-100).astype(np.int16)
to_latlon=Transformer.from_crs(32611,4326,always_xy=True)
def mc(pt):
    lon,lat=to_latlon.transform(*pt)
    return ((lon-meta['minGeoLon'])/(meta['maxGeoLon']-meta['minGeoLon'])*(W-1),(meta['maxGeoLat']-lat)/(meta['maxGeoLat']-meta['minGeoLat'])*(H-1))
dam=structures['dams'][0]
dam_image=Image.new('1',(W,H));ImageDraw.Draw(dam_image).line([mc(p) for p in dam['crestUTM']],fill=1,width=2)
damdist=distance_transform_edt(~np.asarray(dam_image,dtype=bool))
damtop=np.where(damdist<=6, np.clip(83-np.floor(np.maximum(damdist-1,0)/.18),55,83),-100).astype(np.int16)
river=structures['rivers'][0]
for i in range(len(river['centreUTM'])-1):
    im=Image.new('1',(W,H)); d=ImageDraw.Draw(im)
    d.line([mc(river['centreUTM'][i]),mc(river['centreUTM'][i+1])],fill=1,width=max(2,round((river['width'][i]+river['width'][i+1])*.25)))
    mask=np.asarray(im,dtype=bool)&~water
    ry=int(round(80+((river['surface'][i]+river['surface'][i+1])/2-1151.7)*.25))
    ground[mask]=np.minimum(ground[mask],ry-3);water_y[mask]=ry
water=water_y>-90
# Derive slope before rounding elevations to blocks, avoiding contour stripes.
gy,gx=np.gradient(h.astype(np.float32)*.25);slope=np.hypot(gx,gy)
landcover=np.asarray(Image.open(root/'source/worldcover-east-2021.png').convert('RGB'))
assert landcover.shape[:2]==(H,W)
forest=np.all(landcover==[0,110,0],axis=2)
dry=np.all(landcover==[255,255,76],axis=2)|np.all(landcover==[255,187,34],axis=2)
bare=np.all(landcover==[180,180,180],axis=2)
rock=(~water)&(bare | (slope>.45))
grass=(~water)&~rock&~dry
surface=np.maximum(ground,water_y);surface=np.maximum(surface,damtop)
floor=np.maximum(ground,damtop)
# Sparse procedural conifers in satellite-classified tree-cover areas. These
# represent forest cover, not individual real trees.
tree_ops={};rng=np.random.default_rng(403)
for z0 in range(10,H-10,18):
    for x0 in range(10,W-10,18):
        x=x0+int(rng.integers(-5,6));z=z0+int(rng.integers(-5,6))
        if not forest[z,x] or water[z,x] or slope[z,x]>.9 or shore[z,x]<8 or damtop[z,x]>-90: continue
        base=int(ground[z,x]);height=int(rng.integers(5,9))
        if base+height+1>=318: continue
        for y in range(base+1,base+height+1):
            tree_ops.setdefault((x//16,z//16),[]).append((x%16,y,z%16,11))
            surface[z,x]=max(surface[z,x],y)
        for dy,radius in ((0,2),(1,2),(2,1),(3,1),(4,0)):
            y=base+height-3+dy
            for dz in range(-radius,radius+1):
                for dx in range(-radius,radius+1):
                    if abs(dx)+abs(dz)>radius+1 or (dx==dz==0 and y<=base+height):continue
                    xx=x+dx;zz=z+dz
                    if 0<=xx<W and 0<=zz<H and y>ground[zz,xx] and not water[zz,xx]:
                        tree_ops.setdefault((xx//16,zz//16),[]).append((xx%16,y,zz%16,12))
                        surface[zz,xx]=max(surface[zz,xx],y)
zgrid,xgrid=np.indices((H,W))
dryplants=dry & ~rock & ~water & (damtop < -90) & (((xgrid*17+zgrid*31)%7)<2)
worldsurface=np.maximum(surface,np.where(dryplants,ground+1,-100))
def pad(a): return np.pad(a,((0,PH-H),(0,PW-W)),mode='edge')
ground,water_y,grass,surface,floor,damtop,rock,dry,dryplants,worldsurface=map(pad,(ground,water_y,grass,surface,floor,damtop,rock,dry,dryplants,worldsurface))
np.savez_compressed(root/'scene-raster-east.npz',ground=ground,water_y=water_y,damtop=damtop)
# Overview is a map of the conversion, not an in-game screenshot.
preview=np.zeros((H,W,3),dtype=np.uint8); preview[:]=[81,112,77];preview[dry[:H,:W]]=[182,157,108];preview[rock[:H,:W]]=[189,188,179];preview[water_y[:H,:W]>-90]=[58,104,155];preview[damtop[:H,:W]>-90]=[225,218,199]
Image.fromarray(preview).save(root/'granite-valley-overview.png')
names=['minecraft:air','minecraft:stone','minecraft:dirt','minecraft:grass_block','minecraft:water','minecraft:gravel','minecraft:smooth_stone','minecraft:bedrock','minecraft:diorite','minecraft:andesite','minecraft:coarse_dirt','minecraft:spruce_log','minecraft:spruce_leaves','minecraft:short_dry_grass']
def state(name):
    x=Compound({'Name':String(name)})
    if name=='minecraft:water': x['Properties']=Compound({'level':String('0')})
    if name=='minecraft:grass_block': x['Properties']=Compound({'snowy':String('false')})
    if name=='minecraft:spruce_log': x['Properties']=Compound({'axis':String('y')})
    if name=='minecraft:spruce_leaves': x['Properties']=Compound({'distance':String('7'),'persistent':String('true'),'waterlogged':String('false')})
    return x
def longpack(vals,bits):
    per=64//bits; a=np.asarray(vals,dtype=np.uint64).ravel();a=np.pad(a,(0,(-len(a))%per));a=a.reshape(-1,per)
    words=np.bitwise_or.reduce(a << (np.arange(per,dtype=np.uint64)*np.uint64(bits)),axis=1)
    return LongArray(words.view(np.int64))
def section(y,ids,biome):
    present=np.unique(ids); palette=List[Compound]([state(names[int(i)]) for i in present]); out=Compound({'Y':Byte(y),'biomes':biome,'block_states':Compound({'palette':palette})})
    if len(present)>1:
        lookup=np.zeros(len(names),dtype=np.uint8);lookup[present]=np.arange(len(present),dtype=np.uint8)
        out['block_states']['data']=longpack(lookup[ids],max(4,(len(present)-1).bit_length()))
    return out
def hmap(a): return longpack((a.astype(np.int16)+65).reshape(-1),9)
start=time.time();count=0
for path in sorted((world/'region').glob('r.*.*.mca')):
    chunks,timestamps=re.read_region(path)
    for k,raw in chunks.items():
        chunk=re.decode_chunk(raw);cx=int(chunk['xPos']);cz=int(chunk['zPos'])
        if cx<0 or cz<0 or cx*16>=PW or cz*16>=PH: continue
        sl=np.s_[cz*16:cz*16+16,cx*16:cx*16+16]
        g=ground[sl];wy=water_y[sl];gr=grass[sl];dt=damtop[sl];rk=rock[sl];dr=dry[sl];dp=dryplants[sl]
        zz,xx=np.indices((16,16));variation=((xx+cx*16)*17+(zz+cz*16)*31)%10
        ops=tree_ops.get((cx,cz),[])
        biome=next((s['biomes'] for s in chunk['sections'] if 'biomes' in s),Compound({'palette':List[String]([String('minecraft:forest')])}))
        sections=[]
        for sy in range(-4,20):
            yy=np.arange(sy*16,sy*16+16,dtype=np.int16)[:,None,None]
            ids=np.zeros((16,16,16),dtype=np.uint8)
            ids[:]=np.where(yy<=g[None,:,:],1,0)
            ids=np.where((yy>g[None,:,:]-3)&(yy<=g[None,:,:])&gr[None,:,:],2,ids).astype(np.uint8)
            ids=np.where((yy==g[None,:,:])&gr[None,:,:],3,ids).astype(np.uint8)
            ids=np.where((yy>g[None,:,:]-32)&(yy<=g[None,:,:])&rk[None,:,:],np.where(variation[None,:,:]<6,8,9),ids).astype(np.uint8)
            ids=np.where((yy>g[None,:,:]-3)&(yy<=g[None,:,:])&dr[None,:,:]&~rk[None,:,:],10,ids).astype(np.uint8)
            ids=np.where((yy==g[None,:,:]+1)&dp[None,:,:],13,ids).astype(np.uint8)
            ids=np.where((yy==g[None,:,:])&(wy[None,:,:]>-90),5,ids).astype(np.uint8)
            ids=np.where((yy>g[None,:,:])&(yy<=wy[None,:,:]),4,ids).astype(np.uint8)
            ids=np.where((yy>=56)&(yy<=dt[None,:,:]),6,ids).astype(np.uint8)
            for tx,ty,tz,block in ops:
                if sy*16<=ty<sy*16+16 and ids[ty-sy*16,tz,tx]==0:ids[ty-sy*16,tz,tx]=block
            if sy==-4: ids[0,:,:]=7
            sections.append(section(sy,ids,biome))
        chunk['sections']=List[Compound](sections);chunk['isLightOn']=Byte(0)
        chunk['block_entities']=List[Compound]([]);chunk['block_ticks']=List[Compound]([]);chunk['fluid_ticks']=List[Compound]([])
        for name in ('MOTION_BLOCKING','MOTION_BLOCKING_NO_LEAVES'):chunk['Heightmaps'][name]=hmap(surface[sl])
        chunk['Heightmaps']['WORLD_SURFACE']=hmap(worldsurface[sl])
        chunk['Heightmaps']['OCEAN_FLOOR']=hmap(floor[sl])
        chunks[k]=re.encode_chunk(chunk);count+=1
    re.write_region(path,chunks,timestamps)
    print(path.name,'chunks',count,'seconds',round(time.time()-start),flush=True)

level=nbtlib.load(world/'level.dat');d=level['Data'];d['LevelName']=String('Hetch Hetchy - Granite Valley')
# A safe elevated view looking east toward the dam.
damx,damz=mc(dam['crestUTM'][4]);sx=max(2,int(damx)-90);sz=max(2,int(damz));sy=int(max(surface[sz,sx]+20,105));d['SpawnX']=Int(sx);d['SpawnY']=Int(sy);d['SpawnZ']=Int(sz)
p=d['Player'];p['Pos']=List[Double]([Double(sx+.5),Double(sy),Double(sz+.5)]);p['Rotation']=List[Float]([Float(-90),Float(10)])
if 'abilities' in p:p['abilities']['flying']=Byte(1)
level.save(world/'level.dat')
print('Completed:',count,'chunks; spawn',sx,sy,sz,flush=True)
